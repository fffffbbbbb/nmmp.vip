// 「注册账号」教学模拟 —— 场景模板 + 时间轴脚本
//
// 说明：
//   1. 品牌已中性化（Nova Star Interactive / novastar.example），仅用于教学演示，非官方网站
//   2. 场景 A = 注册表单（对应原图 注册账号1.avif）
//      场景 B = 邮箱验证 + 邮件预览同屏（对应原图 注册账号2.avif）
//   3. 时间轴里每一步的 target 都是场景内的 CSS 选择器，由 sim-player.js 负责高亮与定位
//   4. {code} 占位符在播放时替换为本次随机生成的验证码
//   5. 全流程约 31 秒；提示词已按快节奏精简，详细说明保留在文章底部的红色警示中

(function () {
  'use strict';

  var LOGO =
    '<svg class="sim-logo" viewBox="0 0 48 48" aria-hidden="true">' +
    '<path d="M24 3.5 L42.5 14 L42.5 34 L24 44.5 L5.5 34 L5.5 14 Z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>' +
    '<path d="M24 12 L27.6 20.4 L36 24 L27.6 27.6 L24 36 L20.4 27.6 L12 24 L20.4 20.4 Z" fill="currentColor"/>' +
    '</svg>';

  function sceneRegister() {
    return '' +
      '<div class="sim-scene" data-scene="register">' +
        '<div class="sim-stars" aria-hidden="true"></div>' +
        '<div class="sim-reg-wrap" id="sim-reg-wrap">' +
          '<div class="sim-brand">' + LOGO + '<span class="sim-brand-name">NOVA STAR</span></div>' +
          '<h3 class="sim-h1">开始你的冒险吧！</h3>' +
          '<p class="sim-sub">您的第一次宇宙之旅正在等待着您。</p>' +
          '<p class="sim-sub2">已有账户？<a class="sim-link">立即登录</a>。</p>' +
          '<div class="sim-oauth">' +
            '<button type="button" class="sim-oauth-btn" id="sim-oauth-a"><span class="sim-oauth-ic">◈</span><span>第三方账号登录</span></button>' +
            '<button type="button" class="sim-oauth-btn" id="sim-oauth-b"><span class="sim-oauth-ic">◉</span><span>社区账号登录</span></button>' +
          '</div>' +
          '<div class="sim-or"><span>或者</span></div>' +
          '<div class="sim-field">' +
            '<input class="sim-input" id="sim-username" type="text" placeholder="帐户名称" autocomplete="off" spellcheck="false">' +
            '<div class="sim-help">您唯一的公开昵称和显示名称。</div>' +
          '</div>' +
          '<div class="sim-field">' +
            '<input class="sim-input" id="sim-email" type="text" placeholder="电子邮件" autocomplete="off" spellcheck="false">' +
          '</div>' +
          '<div class="sim-field">' +
            '<input class="sim-input" id="sim-password" type="text" placeholder="密码" autocomplete="off" spellcheck="false">' +
          '</div>' +
          '<div class="sim-field">' +
            '<input class="sim-input" id="sim-birthday" type="text" placeholder="出生日期" autocomplete="off" spellcheck="false">' +
            '<div class="sim-help">您必须年满 <b class="sim-red">13</b> 岁才能入伍。</div>' +
          '</div>' +
          '<div class="sim-checks" id="sim-checks">' +
            '<label class="sim-check"><input type="checkbox" id="sim-check-news"><span class="sim-box"></span>' +
              '<span class="sim-check-text">通过电子邮件接收有关本作的最新消息和更新。</span></label>' +
            '<label class="sim-check"><input type="checkbox" id="sim-check-terms"><span class="sim-box"></span>' +
              '<span class="sim-check-text">我同意服务条款和隐私政策。</span></label>' +
          '</div>' +
          '<div class="sim-actions">' +
            '<button type="button" class="sim-btn-primary" id="sim-submit">立即入伍</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function sceneVerify() {
    return '' +
      '<div class="sim-scene" data-scene="verify">' +
        '<div class="sim-stars" aria-hidden="true"></div>' +
        '<div class="sim-verify-grid">' +
          '<div class="sim-verify-panel" id="sim-verify-panel">' +
            '<h3 class="sim-h2">验证您的电子邮件</h3>' +
            '<p class="sim-sent">代码已发送至 <b id="sim-sent-to">your.name@example.com</b></p>' +
            '<input class="sim-input sim-code-input" id="sim-code-input" type="text" placeholder="输入您的验证码" autocomplete="off" spellcheck="false">' +
            '<button type="button" class="sim-btn-blue" id="sim-verify-btn">验证电子邮件</button>' +
            '<div class="sim-foot">' +
              '<p>还没有收到我们的电子邮件？</p>' +
              '<p>检查您的垃圾邮件文件夹或重新发送代码(<span class="sim-count">60</span>)。<a class="sim-link">邮箱错误？请联系客服。</a></p>' +
            '</div>' +
          '</div>' +
          '<div class="sim-mail-card" id="sim-mail-card">' +
            '<div class="sim-mail-head">' +
              '<span class="sim-mail-from">NS</span>' +
              '<div class="sim-mail-meta">' +
                '<div class="sim-mail-subject" id="sim-mail-subject">Nova Star Interactive - Account activation</div>' +
                '<div class="sim-mail-addr">no-reply@novastar.example · 刚刚</div>' +
              '</div>' +
              '<span class="sim-mail-dot" aria-hidden="true"></span>' +
            '</div>' +
            '<div class="sim-mail-body">' +
              '<p>Hello!</p>' +
              '<p>Welcome to Nova Star Interactive!</p>' +
              '<p>To complete your account creation, please enter the following verification code on the NOVA STAR platform:</p>' +
              '<p class="sim-mail-label">Your verification code:</p>' +
              '<div class="sim-mail-code" id="sim-mail-code">- - - - - -</div>' +
              '<p class="sim-mail-note">This code is valid for 10 minutes.</p>' +
              '<p class="sim-mail-small">This step helps us keep your account secure.<br>' +
                'If you did not attempt to create an account, please ignore this message.</p>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<svg class="sim-arrow-layer" id="sim-arrow-layer" aria-hidden="true">' +
          '<path id="sim-arrow-path" d=""></path>' +
          '<path id="sim-arrow-head" d=""></path>' +
        '</svg>' +
        '<div class="sim-success" id="sim-success">' +
          '<div class="sim-success-ic">✓</div>' +
          '<div class="sim-success-t">账户已激活，注册完成</div>' +
          '<div class="sim-success-s">接下来去官网登录，即可下载启动器开始游戏</div>' +
          '<a class="sim-success-btn" href="https://robertsspaceindustries.com/en/enlist?referral=STAR-9KWF-Y7CS" target="_blank" rel="noopener">去官网注册</a>' +
        '</div>' +
      '</div>';
  }

  window.SIM_TUTORIALS = window.SIM_TUTORIALS || {};

  window.SIM_TUTORIALS.register = {
    id: 'register',
    firstScene: 'register',
    scenes: {
      register: sceneRegister,
      verify: sceneVerify
    },
    steps: [
      { scene: 'register', label: '进入注册页',
        hint: '账号注册页（模拟演示，非官方网站）', duration: 1400 },

      { scene: 'register', label: '帐户名称', target: '#sim-username',
        hint: '① 帐户名称：注册后改名要花钱，想好再填',
        duration: 2000, action: { type: 'type', target: '#sim-username', text: 'NovaPilot' } },

      { scene: 'register', label: '电子邮件', target: '#sim-email',
        hint: '② 电子邮件：推荐 Gmail / Outlook，别用 163，必须是本人邮箱',
        duration: 2800, action: { type: 'type', target: '#sim-email', text: 'your.name@gmail.com' } },

      { scene: 'register', label: '密码', target: '#sim-password',
        hint: '③ 密码：字母＋数字＋符号',
        duration: 1800, action: { type: 'type', target: '#sim-password', text: '••••••••••' } },

      { scene: 'register', label: '出生日期', target: '#sim-birthday',
        hint: '④ 必须年满 13 岁',
        duration: 1800, action: { type: 'type', target: '#sim-birthday', text: '2000-01-01' } },

      { scene: 'register', label: '勾选条款', target: '#sim-checks',
        hint: '⑤ 服务条款必须勾选',
        duration: 2000, action: { type: 'check', targets: ['#sim-check-news', '#sim-check-terms'] } },

      { scene: 'register', label: '立即注册', target: '#sim-submit',
        hint: '⑥ 填完后点「立即入伍」',
        duration: 2200, action: { type: 'press', target: '#sim-submit', loading: true } },

      { scene: 'register', label: '跳转验证',
        hint: '提交后自动跳到邮箱验证…',
        duration: 1400, action: { type: 'scene', to: 'verify' } },

      { scene: 'verify', label: '验证邮件', target: '#sim-verify-panel',
        hint: '注册完成后会跳到这一步', duration: 1800 },

      { scene: 'verify', label: '邮件到达', target: '#sim-mail-card',
        hint: '你的邮箱收到一封激活邮件', duration: 1800, action: { type: 'email' } },

      { scene: 'verify', label: '邮件主题', target: '#sim-mail-subject',
        hint: '主题：Account activation', duration: 1500 },

      { scene: 'verify', label: '验证码', target: '#sim-mail-code',
        hint: '找到最新的那个验证码',
        duration: 1900, action: { type: 'code' } },

      { scene: 'verify', label: '一分钟一刷', target: '#sim-code-input',
        hint: '验证码一分钟一刷，旧码会失效',
        duration: 2200, action: { type: 'arrow' } },

      { scene: 'verify', label: '填入验证码', target: '#sim-code-input',
        hint: '把验证码填到这里',
        duration: 1800, action: { type: 'type', target: '#sim-code-input', text: '{code}' } },

      { scene: 'verify', label: '点击验证', target: '#sim-verify-btn',
        hint: '点「验证电子邮件」',
        duration: 1800, action: { type: 'press', target: '#sim-verify-btn', loading: true } },

      { scene: 'verify', label: '注册成功', target: '#sim-verify-panel',
        hint: '验证完成才算注册成功', duration: 2600, action: { type: 'success' } },

      { scene: 'verify', label: '完成',
        hint: null, duration: 0, action: { type: 'finish' } }
    ]
  };
})();
