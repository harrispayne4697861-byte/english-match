/**
 * app.js · 路由与启动装配
 * 转微信小游戏时：Platform 换成 wx 适配实现，本文件的渲染层换成 canvas 绘制，
 * 下面 STAGES 内容表与引导/路由流程可直接复用。
 */
window.EM = window.EM || {};
window.EM.App = (function () {
  'use strict';

  var Platform = window.EM.Platform;

  // 内容表：年龄段与对应年级文案
  var STAGES = {
    kindergarten: { label: '幼儿园', grades: ['小班', '中班', '大班'] },
    primary: { label: '小学', grades: ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'] },
    junior: { label: '初中', grades: ['一年级', '二年级', '三年级'] }
  };

  var TABS = ['map', 'wrong', 'settings'];

  var state = {
    view: 'onboard',
    step: 1,
    draftStage: null,
    draftGrade: null,
    data: null
  };

  var el = {};

  // 取元素
  function $(id) {
    return document.getElementById(id);
  }

  // 显隐元素
  function setHidden(node, isHidden) {
    if (!node) return;
    if (isHidden) node.setAttribute('hidden', '');
    else node.removeAttribute('hidden');
  }

  // 年龄段中文名
  function stageLabel(stage) {
    return (STAGES[stage] && STAGES[stage].label) || '';
  }

  // 年级中文名（grade 从 1 开始）
  function gradeLabel(stage, grade) {
    var grades = STAGES[stage] ? STAGES[stage].grades : [];
    return grades[grade - 1] || '';
  }

  // 校验档案里的 profile 是否完整合法
  function isValidProfile(profile) {
    if (!profile || !STAGES[profile.stage]) return false;
    var max = STAGES[profile.stage].grades.length;
    return typeof profile.grade === 'number' && profile.grade >= 1 && profile.grade <= max;
  }

  // 缓存元素引用与步骤节点
  function cacheElements() {
    el.views = {
      onboard: $('view-onboard'),
      map: $('view-map'),
      play: $('view-play'),
      wrong: $('view-wrong'),
      settings: $('view-settings')
    };
    el.mapGrid = $('map-grid');
    el.tabbar = $('tabbar');
    el.step1 = $('step-1');
    el.step2 = $('step-2');
    el.step3 = $('step-3');
    el.progress = $('onboard-progress');
    el.gradeHint = $('grade-hint');
    el.gradeList = $('grade-list');
    el.summary = $('onboard-summary');
    el.mapMeta = $('map-meta');
    el.settingsStage = $('settings-stage');
    el.settingsGrade = $('settings-grade');
    el.modal = $('modal-clear');
  }

  // 滚动指定视图回顶部
  function scrollToTop(viewName) {
    var view = el.views[viewName];
    var scroller = view && view.querySelector('.view__scroll');
    if (scroller) scroller.scrollTop = 0;
  }

  // 切换主视图，并同步底部 Tab 的选中态
  function showView(viewName) {
    state.view = viewName;
    Object.keys(el.views).forEach(function (key) {
      setHidden(el.views[key], key !== viewName);
    });
    setHidden(el.tabbar, viewName === 'onboard' || viewName === 'play');
    TABS.forEach(function (tab) {
      var btn = el.tabbar && el.tabbar.querySelector('[data-tab="' + tab + '"]');
      if (!btn) return;
      if (tab === viewName) {
        btn.classList.add('is-active');
        btn.setAttribute('aria-current', 'page');
      } else {
        btn.classList.remove('is-active');
        btn.removeAttribute('aria-current');
      }
    });
    scrollToTop(viewName);
  }

  // 切换到引导页的某一步
  function showStep(step) {
    state.step = step;
    setHidden(el.step1, step !== 1);
    setHidden(el.step2, step !== 2);
    setHidden(el.step3, step !== 3);
    el.progress.textContent = '第 ' + step + ' 步 / 共 3 步';
    scrollToTop('onboard');
  }

  // 第 1 步：选年龄段，按年龄段渲染年级按钮并进入第 2 步
  function pickStage(stage) {
    var info = STAGES[stage];
    if (!info) return;
    state.draftStage = stage;
    state.draftGrade = null;
    el.gradeHint.textContent = '已选择：' + info.label;
    var html = '';
    for (var i = 0; i < info.grades.length; i++) {
      html += '<button class="grade-chip" type="button" data-action="pick-grade" data-grade="' + (i + 1) + '">' +
        info.grades[i] + '</button>';
    }
    el.gradeList.innerHTML = html;
    showStep(2);
  }

  // 第 2 步：选年级，渲染确认摘要并进入第 3 步
  function pickGrade(grade) {
    if (!state.draftStage || !grade) return;
    state.draftGrade = grade;
    el.summary.innerHTML =
      '<p class="summary__row"><span class="summary__key">年龄段</span>' +
      '<span class="summary__value">' + stageLabel(state.draftStage) + '</span></p>' +
      '<p class="summary__row"><span class="summary__key">年级</span>' +
      '<span class="summary__value">' + gradeLabel(state.draftStage, grade) + '</span></p>';
    showStep(3);
  }

  // 第 3 步：写入档案与匿名 deviceId，然后进关卡地图
  function finishOnboarding() {
    if (!state.draftStage || !state.draftGrade) return;
    state.data = {
      schemaVersion: 1,
      deviceId: Platform.createDeviceId(),
      profile: {
        stage: state.draftStage,
        grade: state.draftGrade,
        createdAt: new Date().toISOString()
      }
    };
    Platform.save(state.data);
    enterApp('map');
  }

  // 把档案里的年龄段与年级写入地图顶部和设置页
  function renderProfile() {
    var profile = state.data && state.data.profile;
    if (!isValidProfile(profile)) {
      el.mapMeta.textContent = '';
      el.settingsStage.textContent = '—';
      el.settingsGrade.textContent = '—';
      return;
    }
    el.mapMeta.textContent = stageLabel(profile.stage) + ' · ' + gradeLabel(profile.stage, profile.grade) +
      ' · 等级 Lv.1 XP 0';
    el.settingsStage.textContent = stageLabel(profile.stage);
    el.settingsGrade.textContent = gradeLabel(profile.stage, profile.grade);
  }

  // 存档里 progress 的键名：一个年龄段的一个年级一份进度
  function progressKey(stage, grade) {
    return stage + '_' + grade;
  }

  // 确保存档里有 progress 与 wrongBook 两个容器，老存档升级时也不会报错
  function ensureDataShape() {
    if (!state.data) return;
    if (!state.data.progress || typeof state.data.progress !== 'object') state.data.progress = {};
    if (!state.data.wrongBook || typeof state.data.wrongBook !== 'object') state.data.wrongBook = {};
  }

  // 取当前档案下这个年级的进度表，形如 { '0': { stars: 2, best: 130 } }
  function currentProgress() {
    var profile = state.data && state.data.profile;
    if (!isValidProfile(profile)) return {};
    ensureDataShape();
    var key = progressKey(profile.stage, profile.grade);
    if (!state.data.progress[key] || typeof state.data.progress[key] !== 'object') {
      state.data.progress[key] = {};
    }
    return state.data.progress[key];
  }

  // 当前档案对应的玩法配置
  function currentConfig() {
    var profile = state.data && state.data.profile;
    var all = (window.EM && window.EM.Data && window.EM.Data.STAGE_CONFIG) || null;
    if (!isValidProfile(profile) || !all) return null;
    return all[profile.stage] || null;
  }

  // 第 index 关是否已解锁：第一关永远开放，之后要求上一关至少 1 星
  function isLevelUnlocked(progress, index) {
    if (index <= 0) return true;
    var prev = progress[String(index - 1)];
    return !!(prev && prev.stars > 0);
  }

  // 渲染关卡地图：按玩法配置生成关卡格子，显示星级与锁
  function renderMap() {
    if (!el.mapGrid) return;
    var config = currentConfig();
    var profile = state.data && state.data.profile;
    var hasContent = !!(profile && window.EM && window.EM.Game &&
      window.EM.Game.hasContent(profile.stage, profile.grade));

    if (!config || !hasContent || config.levelCount <= 0) {
      el.mapGrid.innerHTML =
        '<div class="placeholder-card">' +
        '<p class="placeholder-card__emoji">🚧</p>' +
        '<p class="placeholder-card__title">这个年级的关卡还在写</p>' +
        '<p class="placeholder-card__desc">先做的是小学三年级。想先玩的话，去设置里换年级。</p>' +
        '</div>';
      return;
    }

    var progress = currentProgress();
    var html = '';
    for (var i = 0; i < config.levelCount; i++) {
      var rec = progress[String(i)] || null;
      var stars = rec ? rec.stars : 0;
      var unlocked = isLevelUnlocked(progress, i);
      var starHtml = '';
      for (var s = 0; s < 3; s++) {
        starHtml += '<span class="level-cell__star' + (s < stars ? ' is-on' : '') + '">★</span>';
      }
      html += '<button class="level-cell' + (unlocked ? '' : ' is-locked') + '" type="button"' +
        ' data-action="open-level" data-level="' + i + '"' +
        (unlocked ? '' : ' disabled') + '>' +
        '<span class="level-cell__no">' + (i + 1) + '</span>' +
        '<span class="level-cell__stars">' + (unlocked ? starHtml : '<span class="level-cell__lock">🔒</span>') + '</span>' +
        '</button>';
    }
    el.mapGrid.innerHTML = html;
  }

  // 打开第 index 关：切到游戏页并交给 UiGame
  function openLevel(index) {
    var config = currentConfig();
    var profile = state.data && state.data.profile;
    if (!config || !isValidProfile(profile)) return;
    if (!window.EM.Game || !window.EM.UiGame) return;

    var all = window.EM.Game.getWords(profile.stage, profile.grade);
    var need = config.pairsPerLevel;
    if (all.length < need) return;

    // 按关卡序号切片取词，走到词表末尾就绕回去
    var start = (index * need) % all.length;
    var words = [];
    for (var i = 0; i < need; i++) words.push(all[(start + i) % all.length]);

    showView('play');

    window.EM.UiGame.start({
      stage: profile.stage,
      grade: profile.grade,
      levelIndex: index,
      config: config,
      words: words
    });
  }

  // 退出关卡回到地图
  function exitLevel() {
    if (window.EM.UiGame) window.EM.UiGame.stop();
    renderMap();
    showView('map');
  }

  // 一关结束：记进度、记错词，回地图
  function onLevelSettle(result) {
    if (!result) return;
    var progress = currentProgress();
    var key = String(result.levelIndex);
    var old = progress[key] || { stars: 0, best: 0 };
    if (result.stars > old.stars || result.score > old.best) {
      progress[key] = {
        stars: Math.max(old.stars, result.stars),
        best: Math.max(old.best, result.score)
      };
    }
    var wrongIds = result.wrongWordIds || [];
    ensureDataShape();
    for (var i = 0; i < wrongIds.length; i++) {
      var id = wrongIds[i];
      state.data.wrongBook[id] = (state.data.wrongBook[id] || 0) + 1;
    }
    Platform.save(state.data);
    renderProfile();
    renderMap();
  }

  // 进入主应用
  function enterApp(tab) {
    renderProfile();
    renderMap();
    showView(tab || 'map');
  }

  // 打开清空数据的二次确认弹层，并锁住页面滚动
  function openClearModal() {
    setHidden(el.modal, false);
    document.body.classList.add('is-locked');
  }

  // 关闭确认弹层并解锁滚动
  function closeClearModal() {
    setHidden(el.modal, true);
    document.body.classList.remove('is-locked');
  }

  // 确认清空：删掉本机全部数据，回到引导页第 1 步
  function confirmClear() {
    Platform.clear();
    state.data = null;
    state.draftStage = null;
    state.draftGrade = null;
    closeClearModal();
    renderProfile();
    showStep(1);
    showView('onboard');
  }

  // data-action 到处理函数的映射
  var ACTIONS = {
    'pick-stage': function (node) {
      pickStage(node.getAttribute('data-stage'));
    },
    'pick-grade': function (node) {
      pickGrade(parseInt(node.getAttribute('data-grade'), 10));
    },
    'back-to-stage': function () {
      showStep(1);
    },
    'back-to-grade': function () {
      showStep(2);
    },
    'finish-onboard': finishOnboarding,
    'switch-tab': function (node) {
      showView(node.getAttribute('data-tab'));
    },
    'open-level': function (node) {
      openLevel(parseInt(node.getAttribute('data-level'), 10));
    },
    'open-clear': openClearModal,
    'close-modal': closeClearModal,
    'confirm-clear': confirmClear
  };

  // 执行一个动作
  function handleAction(node) {
    var fn = ACTIONS[node.getAttribute('data-action')];
    if (fn) fn(node);
  }

  // 从事件目标向上找到带 data-action 的节点
  function findActionNode(target) {
    if (!target || typeof target.closest !== 'function') return null;
    return target.closest('[data-action]');
  }

  var pressNode = null;
  var pressX = 0;
  var pressY = 0;

  // 按下：记录节点与坐标，给即时按压反馈
  function onPressStart(event) {
    var node = findActionNode(event.target);
    if (!node) return;
    pressNode = node;
    pressX = event.clientX;
    pressY = event.clientY;
    node.classList.add('is-pressed');
  }

  // 抬起：位移过大说明是在滚动，不触发动作
  function onPressEnd(event) {
    var node = pressNode;
    var dx = Math.abs(event.clientX - pressX);
    var dy = Math.abs(event.clientY - pressY);
    releasePress();
    if (!node || dx + dy > 12) return;
    handleAction(node);
  }

  // 清掉按压态
  function releasePress() {
    if (pressNode) pressNode.classList.remove('is-pressed');
    pressNode = null;
  }

  // 统一用 pointer 事件响应点击；不支持时退回 click
  function bindTapEvents() {
    if (window.PointerEvent) {
      document.addEventListener('pointerdown', onPressStart);
      document.addEventListener('pointerup', onPressEnd);
      document.addEventListener('pointercancel', releasePress);
      return;
    }
    document.addEventListener('click', function (event) {
      var node = findActionNode(event.target);
      if (node) handleAction(node);
    });
  }

  // 启动：有档案进地图，没有档案进引导页
  function start() {
    cacheElements();
    bindTapEvents();
    state.data = Platform.load();
    if (state.data && isValidProfile(state.data.profile)) {
      enterApp('map');
      return;
    }
    state.data = null;
    renderProfile();
    showStep(1);
    showView('onboard');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  return {
    start: start,
    showView: showView,
    onLevelSettle: onLevelSettle,
    exitLevel: exitLevel,
    renderMap: renderMap
  };
})();
