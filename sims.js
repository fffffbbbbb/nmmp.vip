// 「注册账号」教学模拟 —— 场景模板 + 时间轴脚本
//
// 说明：
//   1. 页面按官网原貌还原（RSI 标识 / 域名 / 邮件主题），顶部有醒目的「非官方网站」提示条
//   2. 场景 A = 注册表单（对应原图 注册账号1.avif）
//      场景 B = 邮箱验证 + 邮件预览同屏（对应原图 注册账号2.avif）
//   3. 时间轴里每一步的 target 都是场景内的 CSS 选择器，由 sim-player.js 负责高亮与定位
//   4. {code} 占位符在播放时替换为本次随机生成的验证码
//   5. 全流程约 31 秒；提示词为短句，详细说明保留在文章底部的红色警示中

(function () {
  'use strict';

  // RSI 风格标识：白色斜体 RSI + 三道橙色斜条
  var LOGO =
    '<svg class="sim-logo" viewBox="0 0 132 44" aria-hidden="true">' +
    '<text x="0" y="35" font-family="Arial Black, Arial, sans-serif" font-size="36" font-style="italic" ' +
      'font-weight="900" fill="#ffffff" letter-spacing="0.5">RSI</text>' +
    '<g fill="#f0a91c">' +
      '<rect x="86" y="4" width="34" height="6" transform="skewX(-20)"/>' +
      '<rect x="82" y="18" width="38" height="6" transform="skewX(-20)"/>' +
      '<rect x="78" y="32" width="42" height="6" transform="skewX(-20)"/>' +
    '</g>' +
    '<text x="122" y="12" font-family="Arial, sans-serif" font-size="10" fill="#c9d6e4">&#174;</text>' +
    '</svg>';

  // Google 四色 G
  var GOOGLE_ICON =
    '<svg class="sim-oauth-svg" viewBox="0 0 24 24" aria-hidden="true">' +
    '<path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/>' +
    '<path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/>' +
    '<path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/>' +
    '<path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"/>' +
    '</svg>';

  // Twitch 紫色图标
  var TWITCH_ICON =
    '<svg class="sim-oauth-svg" viewBox="0 0 24 24" aria-hidden="true">' +
    '<path fill="#9146FF" d="M2.15 0 .75 3.72v16.5h5.8V24h3.5l3.15-3.78h4.9L24 14.4V0H2.15zm19.6 13.2-3.15 3.15h-5.6L10.9 19.5v-3.15H5.25V2.25h16.5V13.2z"/>' +
    '<path fill="#fff" d="M17.3 5.9h-1.8v6h1.8v-6zm-4.9 0H10.6v6h1.8v-6z"/>' +
    '</svg>';

  function sceneRegister() {
    return '' +
      '<div class="sim-scene" data-scene="register">' +
        '<div class="sim-stars" aria-hidden="true"></div>' +
        '<div class="sim-reg-wrap" id="sim-reg-wrap">' +
          '<div class="sim-brand">' + LOGO + '</div>' +
          '<h3 class="sim-h1">开始你的冒险吧！</h3>' +
          '<p class="sim-sub">您的第一次宇宙之旅正在等待着您。</p>' +
          '<p class="sim-sub2">已有账户？<a class="sim-link">立即登录</a>。</p>' +
          '<div class="sim-oauth">' +
            '<button type="button" class="sim-oauth-btn" id="sim-oauth-a" aria-label="使用 Google 登录">' + GOOGLE_ICON + '</button>' +
            '<button type="button" class="sim-oauth-btn" id="sim-oauth-b" aria-label="使用 Twitch 登录">' + TWITCH_ICON + '</button>' +
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
              '<span class="sim-check-text">通过电子邮件接收有关《星际公民》和《第 42 中队》的最新消息和更新。</span></label>' +
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
              '<span class="sim-mail-from">RSI</span>' +
              '<div class="sim-mail-meta">' +
                '<div class="sim-mail-subject" id="sim-mail-subject">Roberts Space Industries - Account activation</div>' +
                '<div class="sim-mail-addr">no-reply@robertsspaceindustries.com · 刚刚</div>' +
              '</div>' +
              '<span class="sim-mail-dot" aria-hidden="true"></span>' +
            '</div>' +
            '<div class="sim-mail-body">' +
              '<p>Hello!</p>' +
              '<p>Welcome to Roberts Space Industries!</p>' +
              '<p>To complete your account creation, please enter the following verification code on the RSI platform:</p>' +
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
        hint: '这是账号注册页（模拟演示，不是官网）', duration: 1400 },

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
