// 教学模拟播放器 —— 把「场景模板 + 时间轴脚本」渲染成一个可自动演示、可交互、可回看的播放器
//
// 能力：
//   · 自动演示：按时间轴逐步推进（进入视口才开始播，划出视口自动暂停）
//   · 用户接管：用户点击/输入立即暂停自动播放，可一键恢复
//   · 进度条：按步骤分段，可点击跳转到任意一步（会自动补齐该步之前的状态）
//   · 提示开关：关闭后所有提示词完全透明（opacity:0，不改变布局）
//   · 降级：系统开启"减少动态效果"时直接停在首屏，不自动播放
//
// 用法：window.createSimPlayer(宿主元素, window.SIM_TUTORIALS.register)

(function () {
  'use strict';

  var REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var MASK = '••••••••••';

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function make(html) {
    var t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function q(sel, root) { return (root || document).querySelector(sel); }

  function SimPlayer(host, cfg) {
    this.host = host;
    this.cfg = cfg;
    this.steps = cfg.steps;
    this.index = -1;
    this.auto = !REDUCED;
    this.playing = false;
    this.hintsOn = true;
    this.arrowOn = false;
    this.timer = null;
    this.token = 0;
    this.visible = false;
    this.code = this.makeCode();

    this.build();
    this.bind();
    this.watch();
    this.goto(0, { autoplay: false });
    if (REDUCED) this.window.classList.add('reduced');
  }

  SimPlayer.prototype.makeCode = function () {
    return String(Math.floor(100000 + Math.random() * 900000));
  };

  // ---------------------------------------------------------------- 构建 DOM
  SimPlayer.prototype.build = function () {
    var self = this;
    var scenes = '';
    Object.keys(this.cfg.scenes).forEach(function (k) { scenes += self.cfg.scenes[k](); });

    this.window = make(
      '<div class="sim-window" tabindex="0">' +
        '<div class="sim-titlebar">' +
          '<span class="sim-dots" aria-hidden="true"><i></i><i></i><i></i></span>' +
          '<span class="sim-url">novastar.example/enlist</span>' +
          '<span class="sim-badge">模拟演示 · 非官方网站</span>' +
        '</div>' +
        '<div class="sim-stage">' + scenes +
          '<div class="sim-hint-layer">' +
            '<div class="sim-hint" id="sim-hint">' +
              '<span class="sim-hint-badge">1</span>' +
              '<span class="sim-hint-text"></span>' +
              '<i class="sim-hint-tail"></i>' +
            '</div>' +
          '</div>' +
          '<div class="sim-takeover">已由你接管 · <button type="button" class="sim-takeover-btn">继续自动演示</button></div>' +
        '</div>' +
        '<div class="sim-controls">' +
          '<button type="button" class="sim-ctrl" data-act="toggle" title="播放 / 暂停">▶</button>' +
          '<button type="button" class="sim-ctrl" data-act="replay" title="从头重播">↺</button>' +
          '<button type="button" class="sim-ctrl" data-act="skip" title="跳到结束">⏭</button>' +
          '<button type="button" class="sim-ctrl sim-ctrl-hint" data-act="hints" title="显示 / 隐藏提示词">💡 提示</button>' +
          '<div class="sim-bar" role="progressbar"></div>' +
          '<span class="sim-counter"><b class="sim-step-label">准备中</b><em class="sim-count-num">0/0</em></span>' +
        '</div>' +
      '</div>');

    this.host.appendChild(this.window);

    this.stage = q('.sim-stage', this.window);
    this.hint = q('#sim-hint', this.window);
    this.hintBadge = q('.sim-hint-badge', this.window);
    this.hintText = q('.sim-hint-text', this.window);
    this.bar = q('.sim-bar', this.window);
    this.stepLabel = q('.sim-step-label', this.window);
    this.counterNum = q('.sim-count-num', this.window);
    this.takeoverEl = q('.sim-takeover', this.window);
    this.toggleBtn = q('[data-act="toggle"]', this.window);
    var hintBtn = q('[data-act="hints"]', this.window);
    if (hintBtn) hintBtn.classList.add('on');

    // 进度条分段
    this.segs = this.steps.map(function (s, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'sim-seg';
      b.title = (i + 1) + '. ' + (s.label || '');
      b.addEventListener('click', function () { self.jumpTo(i); });
      self.bar.appendChild(b);
      return b;
    });
  };

  // ---------------------------------------------------------------- 事件绑定
  SimPlayer.prototype.bind = function () {
    var self = this;

    this.window.addEventListener('click', function (e) {
      var btn = e.target.closest('.sim-ctrl');
      if (btn) {
        var act = btn.getAttribute('data-act');
        if (act === 'toggle') self.togglePlay();
        else if (act === 'replay') self.replay();
        else if (act === 'skip') self.jumpTo(self.steps.length - 1);
        else if (act === 'hints') self.toggleHints();
        return;
      }
      if (e.target.closest('.sim-takeover-btn')) { self.resumeAuto(); return; }
    });

    // 用户动手 → 接管
    this.stage.addEventListener('pointerdown', function (e) {
      if (e.target.closest('input, button, label, a')) self.takeover();
    }, true);
    this.stage.addEventListener('input', function () { self.takeover(); });

    this.window.addEventListener('keydown', function (e) {
      if (e.key === ' ') { e.preventDefault(); self.togglePlay(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); self.jumpTo(self.index + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); self.jumpTo(self.index - 1); }
    });
  };

  // ---------------------------------------------------------------- 可见性 / 尺寸
  SimPlayer.prototype.watch = function () {
    var self = this;

    if ('IntersectionObserver' in window) {
      this.io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          self.visible = entry.isIntersecting;
          if (self.visible) {
            self.reposition();
            if (self.auto && !self.playing && self.index < self.steps.length - 1) {
              self.playing = true;
              self.scheduleNext();
              self.updatePlayButton();
            }
          } else {
            clearTimeout(self.timer);
            self.playing = false;
            self.updatePlayButton();
          }
        });
      }, { threshold: 0.3 });
      this.io.observe(this.window);
    } else {
      this.visible = true;
    }

    if ('ResizeObserver' in window) {
      this.ro = new ResizeObserver(function () { self.reposition(); });
      this.ro.observe(this.stage);
    }
    window.addEventListener('resize', function () { self.reposition(); });
  };

  SimPlayer.prototype.reposition = function () {
    var step = this.steps[this.index];
    if (step) this.positionHint(step.target);
    if (this.arrowOn) this.drawArrow();
  };

  // ---------------------------------------------------------------- 状态
  SimPlayer.prototype.resetState = function () {
    var st = this.stage;
    ['#sim-username', '#sim-email', '#sim-password', '#sim-birthday', '#sim-code-input'].forEach(function (sel) {
      var n = q(sel, st); if (n) n.value = '';
    });
    ['#sim-check-news', '#sim-check-terms'].forEach(function (sel) {
      var n = q(sel, st); if (n) { n.checked = false; n.closest('.sim-check').classList.remove('on'); }
    });
    var mail = q('#sim-mail-card', st); if (mail) mail.classList.remove('in');
    var codeEl = q('#sim-mail-code', st); if (codeEl) codeEl.textContent = '- - - - - -';
    var succ = q('#sim-success', st); if (succ) succ.classList.remove('on');
    var layer = q('#sim-arrow-layer', st); if (layer) layer.classList.remove('on');
    ['#sim-submit', '#sim-verify-btn'].forEach(function (sel) {
      var n = q(sel, st); if (n) n.classList.remove('loading', 'pressed');
    });
    this.arrowOn = false;
    this.setScene(this.cfg.firstScene);
  };

  SimPlayer.prototype.setScene = function (name) {
    var scenes = this.stage.querySelectorAll('.sim-scene');
    for (var i = 0; i < scenes.length; i++) {
      scenes[i].classList.toggle('on', scenes[i].getAttribute('data-scene') === name);
    }
    this.syncSentTo();
  };

  // 邮箱验证页的收件地址跟随第一步填入的邮箱
  SimPlayer.prototype.syncSentTo = function () {
    var out = q('#sim-sent-to', this.stage);
    if (!out) return;
    var input = q('#sim-email', this.stage);
    out.textContent = (input && input.value) ? input.value : 'your.name@example.com';
  };

  // 把第 0..i-1 步的「最终状态」瞬间补齐（用于进度条跳转 / 回看）
  SimPlayer.prototype.applyStateUpTo = function (i) {
    for (var k = 0; k < i; k++) {
      var step = this.steps[k];
      if (step.scene) this.setScene(step.scene);
      this.runAction(step, true);
    }
    var cur = this.steps[i];
    if (cur && cur.scene) this.setScene(cur.scene);
  };

  // ---------------------------------------------------------------- 播放控制
  SimPlayer.prototype.goto = function (i, opts) {
    opts = opts || {};
    i = Math.max(0, Math.min(i, this.steps.length - 1));
    this.token++;
    clearTimeout(this.timer);

    this.resetState();
    this.applyStateUpTo(i);
    this.index = i;

    var step = this.steps[i];
    this.runAction(step, false);
    this.updateHint();
    this.updateProgress();

    if (opts.autoplay === false) {
      this.playing = false;
    } else if (this.auto) {
      this.playing = true;
      this.scheduleNext();
    } else {
      this.playing = false;
    }
    this.updatePlayButton();
  };

  SimPlayer.prototype.next = function () {
    if (this.index >= this.steps.length - 1) {
      this.playing = false;
      clearTimeout(this.timer);
      this.updatePlayButton();
      return;
    }
    this.goto(this.index + 1, { autoplay: this.auto });
  };

  SimPlayer.prototype.scheduleNext = function () {
    var self = this;
    clearTimeout(this.timer);
    var step = this.steps[this.index];
    if (!step || !step.duration) return;
    this.timer = setTimeout(function () { self.next(); }, step.duration);
  };

  SimPlayer.prototype.jumpTo = function (i) {
    // 手动跳转视为想继续看演示
    this.auto = true;
    this.window.classList.remove('taken');
    this.goto(i, { autoplay: true });
  };

  SimPlayer.prototype.replay = function () {
    this.code = this.makeCode();
    this.auto = true;
    this.window.classList.remove('taken');
    this.goto(0, { autoplay: true });
  };

  SimPlayer.prototype.togglePlay = function () {
    if (this.playing) {
      this.playing = false;
      clearTimeout(this.timer);
    } else {
      this.auto = true;
      this.window.classList.remove('taken');
      this.playing = true;
      if (this.index >= this.steps.length - 1) { this.goto(0, { autoplay: true }); return; }
      this.scheduleNext();
    }
    this.updatePlayButton();
  };

  SimPlayer.prototype.takeover = function () {
    if (!this.auto) return;
    this.auto = false;
    this.playing = false;
    clearTimeout(this.timer);
    this.window.classList.add('taken');
    this.updatePlayButton();
  };

  SimPlayer.prototype.resumeAuto = function () {
    this.auto = true;
    this.playing = true;
    this.window.classList.remove('taken');
    this.scheduleNext();
    this.updatePlayButton();
  };

  SimPlayer.prototype.toggleHints = function () {
    this.hintsOn = !this.hintsOn;
    this.window.classList.toggle('no-hints', !this.hintsOn);
    var btn = q('[data-act="hints"]', this.window);
    if (btn) btn.classList.toggle('on', this.hintsOn);
    this.updateHint();
  };

  SimPlayer.prototype.updatePlayButton = function () {
    if (this.toggleBtn) this.toggleBtn.textContent = this.playing ? '⏸' : '▶';
    this.window.classList.toggle('playing', this.playing);
  };

  SimPlayer.prototype.updateProgress = function () {
    var self = this;
    this.segs.forEach(function (seg, i) {
      seg.classList.toggle('done', i < self.index);
      seg.classList.toggle('cur', i === self.index);
    });
    var step = this.steps[this.index];
    if (this.stepLabel) this.stepLabel.textContent = step ? (step.label || '') : '';
    if (this.counterNum) this.counterNum.textContent = (this.index + 1) + '/' + this.steps.length;
  };

  // ---------------------------------------------------------------- 动作执行
  SimPlayer.prototype.runAction = function (step, instant) {
    if (!step || !step.action) return;
    var self = this;
    var token = this.token;
    var a = step.action;
    var node;

    switch (a.type) {
      case 'scene':
        this.setScene(a.to);
        break;

      case 'type':
        node = q(a.target, this.stage);
        if (!node) return;
        var text = String(a.text || '').replace('{code}', this.code);
        if (instant) { node.value = text; this.syncSentTo(); }
        else this.typeText(node, text, token);
        break;

      case 'check':
        (a.targets || []).forEach(function (sel, i) {
          var box = q(sel, this.stage);
          if (!box) return;
          var wrap = box.closest('.sim-check');
          if (instant) { box.checked = true; if (wrap) wrap.classList.add('on'); }
          else setTimeout(function () {
            if (token !== self.token) return;
            box.checked = true;
            if (wrap) wrap.classList.add('on');
          }, i * 380);
        }, this);
        break;

      case 'press':
        node = q(a.target, this.stage);
        if (!node) return;
        if (instant) { if (a.loading) node.classList.add('loading'); return; }
        node.classList.add('pressed');
        setTimeout(function () {
          if (token !== self.token) return;
          node.classList.remove('pressed');
          if (a.loading) node.classList.add('loading');
        }, 320);
        break;

      case 'email':
        var mail = q('#sim-mail-card', this.stage);
        if (mail) mail.classList.add('in');
        break;

      case 'code':
        var codeEl = q('#sim-mail-code', this.stage);
        if (!codeEl) return;
        if (instant) { codeEl.textContent = this.code; codeEl.classList.add('flash'); }
        else this.typeText(codeEl, this.code, token, 90, true);
        break;

      case 'arrow':
        this.showArrow(!instant || true);
        break;

      case 'success':
      case 'finish':
        var succ = q('#sim-success', this.stage);
        if (succ) succ.classList.add('on');
        break;
    }
  };

  SimPlayer.prototype.typeText = function (node, text, token, speed, isText) {
    var self = this;
    if (isText) node.textContent = ''; else node.value = '';
    var chars = String(text).split('');
    var i = 0;
    function tick() {
      if (token !== self.token) return;
      if (i >= chars.length) {
        if (isText) node.classList.add('flash');
        self.syncSentTo();
        return;
      }
      if (isText) node.textContent += chars[i]; else node.value += chars[i];
      i++;
      self.timerTyping = setTimeout(tick, speed || 42);
    }
    tick();
  };

  // ---------------------------------------------------------------- 提示词
  SimPlayer.prototype.updateHint = function () {
    var step = this.steps[this.index];
    if (!step || !step.hint) { this.hint.classList.remove('on'); return; }
    this.hintText.textContent = step.hint;
    this.hintBadge.textContent = String(this.index + 1);
    this.hint.classList.add('on');
    this.positionHint(step.target);
  };

  SimPlayer.prototype.positionHint = function (targetSel) {
    var stageRect = this.stage.getBoundingClientRect();
    if (!stageRect.width) return;   // 容器被隐藏时测不到，等可见后由 ResizeObserver 补算
    var hint = this.hint;
    var hw = hint.offsetWidth, hh = hint.offsetHeight;
    var pad = 10;
    var target = targetSel ? q(targetSel, this.stage) : null;
    var top, left, below = true, tail = hw / 2, flat = false;
    // 窄屏下不做锚定，改成底部字幕条：避免气泡遮住目标下方的按钮
    var narrow = stageRect.width < 720;

    if (!narrow && target && target.offsetParent !== null && target.getBoundingClientRect().width) {
      var r = target.getBoundingClientRect();
      var tTop = r.top - stageRect.top;
      var tBottom = r.bottom - stageRect.top;
      var tCenter = r.left - stageRect.left + r.width / 2;
      if (tBottom + pad + hh + 14 <= stageRect.height) {
        top = tBottom + pad + 8;
        below = true;
      } else {
        top = Math.max(6, tTop - hh - pad - 8);
        below = false;
      }
      left = Math.max(8, Math.min(tCenter - hw / 2, stageRect.width - hw - 8));
      tail = Math.max(18, Math.min(tCenter - left, hw - 18));
    } else {
      left = Math.max(8, (stageRect.width - hw) / 2);
      top = Math.max(8, stageRect.height - hh - 16);
      below = true;
      tail = hw / 2;
      flat = true;   // 没有锚点元素时做成一枚居中的"字幕条"，不画小三角
    }

    hint.style.left = Math.round(left) + 'px';
    hint.style.top = Math.round(top) + 'px';
    hint.classList.toggle('below', !flat && below);
    hint.classList.toggle('above', !flat && !below);
    hint.classList.toggle('flat', flat);
    hint.style.setProperty('--tail', Math.round(tail) + 'px');
  };

  // ---------------------------------------------------------------- 箭头（还原图二那支红箭头）
  SimPlayer.prototype.showArrow = function (on) {
    this.arrowOn = !!on;
    var layer = q('#sim-arrow-layer', this.stage);
    if (layer) layer.classList.toggle('on', !!on);
    if (on) this.drawArrow();
  };

  SimPlayer.prototype.drawArrow = function () {
    var path = q('#sim-arrow-path', this.stage);
    var head = q('#sim-arrow-head', this.stage);
    var from = q('#sim-code-input', this.stage);
    var to = q('#sim-mail-code', this.stage);
    if (!path || !head || !from || !to) return;
    if (this.stage.getBoundingClientRect().width < 720) return;   // 窄屏堆叠布局下不画箭头

    var s = this.stage.getBoundingClientRect();
    var fr = from.getBoundingClientRect();
    var tr = to.getBoundingClientRect();
    if (!fr.width || !tr.width) return;

    var x1 = fr.left - s.left + fr.width - 4;
    var y1 = fr.top - s.top + fr.height / 2;
    var x2 = tr.left - s.left - 14;
    var y2 = tr.top - s.top + tr.height / 2;
    var cx = (x1 + x2) / 2;
    var cy = Math.min(y1, y2) - 54;

    path.setAttribute('d', 'M' + x1 + ',' + y1 + ' Q' + cx + ',' + cy + ' ' + x2 + ',' + y2);
    head.setAttribute('d', 'M' + (x2 - 18) + ',' + (y2 - 10) + ' L' + x2 + ',' + y2 + ' L' + (x2 - 18) + ',' + (y2 + 10) + ' Z');

    var len = path.getTotalLength ? path.getTotalLength() : 400;
    path.style.transition = 'none';
    path.style.strokeDasharray = len;
    path.style.strokeDashoffset = len;
    head.style.transition = 'none';
    head.style.opacity = '0';
    requestAnimationFrame(function () {
      path.style.transition = 'stroke-dashoffset .68s ease-out';
      path.style.strokeDashoffset = '0';
      setTimeout(function () {
        head.style.transition = 'opacity .25s';
        head.style.opacity = '1';
      }, 620);
    });
  };

  window.createSimPlayer = function (host, cfg) {
    return new SimPlayer(host, cfg);
  };
})();
