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
    el.mapLv = $('map-lv');
    el.xpFill = $('map-xp-fill');
    el.xpNum = $('map-xp-num');
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
    el.mapMeta.textContent = stageLabel(profile.stage) + ' · ' + gradeLabel(profile.stage, profile.grade);
    el.settingsStage.textContent = stageLabel(profile.stage);
    el.settingsGrade.textContent = gradeLabel(profile.stage, profile.grade);
  }

  // 当前累计经验
  function growthXp() {
    if (!state.data) return 0;
    ensureDataShape();
    return state.data.growth.xp;
  }

  // 把等级与经验条画到地图顶部；Growth 没加载时静默跳过
  function renderGrowth() {
    var G = window.EM && window.EM.Growth;
    if (!G || !el.mapLv || !el.xpFill || !el.xpNum) return;
    var info = G.levelProgress(growthXp());
    el.mapLv.textContent = 'Lv.' + info.level;
    el.xpFill.style.width = info.percent + '%';
    el.xpNum.textContent = info.into + ' / ' + info.need;
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
    if (!state.data.growth || typeof state.data.growth !== 'object') state.data.growth = { xp: 0 };
    if (typeof state.data.growth.xp !== 'number' || !isFinite(state.data.growth.xp) || state.data.growth.xp < 0) {
      state.data.growth.xp = 0;
    }
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

  // 科技树几何：3 列蛇形排布，横向用百分比定位，纵向按固定行高定位
  var TREE = { cols: 3, rowHeight: 96, top: 52, designWidth: 300 };

  // 第 index 个节点在设计坐标系里的位置
  function treePos(index) {
    var row = Math.floor(index / TREE.cols);
    var col = index % TREE.cols;
    // 奇数行反向，形成蛇形盘山路；连线只在相邻的两个节点之间，最短最清楚
    if (row % 2 === 1) col = TREE.cols - 1 - col;
    return {
      leftPct: ((col + 0.5) / TREE.cols) * 100,
      x: (col + 0.5) * (TREE.designWidth / TREE.cols),
      y: TREE.top + row * TREE.rowHeight
    };
  }

  // 两个节点之间的连线路径（上下各一半的曲线，像一条盘山路）
  function treeCurve(a, b) {
    var mid = (a.y + b.y) / 2;
    return 'M' + a.x + ' ' + a.y + 'C' + a.x + ' ' + mid + ' ' + b.x + ' ' + mid + ' ' + b.x + ' ' + b.y;
  }

  // 锁图标用内联 SVG，不依赖 emoji 字体
  var LOCK_SVG = '<span class="tree-node__lock"><svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<rect x="5" y="10.5" width="14" height="9.5" rx="3" fill="currentColor"/>' +
    '<path d="M8.2 10.5V8.4a3.8 3.8 0 0 1 7.6 0v2.1" fill="none" stroke="currentColor" ' +
    'stroke-width="2.2" stroke-linecap="round"/></svg></span>';

  // 渲染关卡地图：科技树（节点＝关卡，连线表示推进顺序）
  function renderMap() {
    if (!el.mapGrid) return;
    var config = currentConfig();
    var profile = state.data && state.data.profile;
    var hasContent = !!(profile && window.EM && window.EM.Game &&
      window.EM.Game.hasContent(profile.stage, profile.grade));

    if (!config || !hasContent || config.levelCount <= 0) {
      el.mapGrid.className = 'level-grid';
      el.mapGrid.style.height = '';
      el.mapGrid.innerHTML =
        '<div class="placeholder-card">' +
        '<p class="placeholder-card__emoji">🚧</p>' +
        '<p class="placeholder-card__title">这个年级的关卡还在写</p>' +
        '<p class="placeholder-card__desc">先做的是小学三年级。想先玩的话，去设置里换年级。</p>' +
        '</div>';
      return;
    }

    var progress = currentProgress();
    var count = config.levelCount;
    var nodes = '';
    var passedPath = [];
    var pendingPath = [];
    var current = -1;
    var i;
    var pos;
    var prevPos;

    for (i = 0; i < count; i++) {
      var rec = progress[String(i)] || null;
      var stars = rec ? Math.max(0, Math.min(3, rec.stars || 0)) : 0;
      var unlocked = isLevelUnlocked(progress, i);
      if (unlocked && stars === 0 && current < 0) current = i;

      pos = treePos(i);
      var cls = 'tree-node';
      if (!unlocked) cls += ' is-locked';
      if (stars > 0) cls += ' is-passed';
      if (i === current) cls += ' is-current';

      var starHtml = '';
      for (var s = 0; s < 3; s++) {
        starHtml += '<span class="tree-node__star' + (s < stars ? ' is-on' : '') + '">★</span>';
      }
      nodes += '<button class="' + cls + '" type="button" data-action="open-level" data-level="' + i + '"' +
        (unlocked ? '' : ' disabled') +
        ' style="left:' + pos.leftPct.toFixed(3) + '%;top:' + pos.y + 'px">' +
        '<span class="tree-node__ring"></span>' +
        '<span class="tree-node__no">' + (i + 1) + '</span>' +
        (unlocked ? '<span class="tree-node__stars">' + starHtml + '</span>' : LOCK_SVG) +
        '</button>';

      // 连线 i-1 -> i 是否"已走过"，取决于【前一个节点】是否已通关（不是当前节点）
      if (i > 0) {
        prevPos = treePos(i - 1);
        var curve = treeCurve(prevPos, pos);
        var prevRec = progress[String(i - 1)] || null;
        if (prevRec && Math.max(0, Math.min(3, prevRec.stars || 0)) > 0) passedPath.push(curve);
        else pendingPath.push(curve);
      }
    }

    var rows = Math.ceil(count / TREE.cols);
    var height = TREE.top * 2 + (rows - 1) * TREE.rowHeight;
    el.mapGrid.className = 'map-tree';
    el.mapGrid.style.height = height + 'px';
    el.mapGrid.innerHTML =
      '<svg class="map-tree__lines" viewBox="0 0 ' + TREE.designWidth + ' ' + height + '"' +
      ' preserveAspectRatio="none" aria-hidden="true">' +
      (pendingPath.length ? '<path class="tree-line" d="' + pendingPath.join(' ') + '"/>' : '') +
      (passedPath.length ? '<path class="tree-line is-passed" d="' + passedPath.join(' ') + '"/>' : '') +
      '</svg>' + nodes;
  }

  // 打开第 index 关：切到游戏页并交给 UiGame
  function openLevel(index) {
    var config = currentConfig();
    var profile = state.data && state.data.profile;
    if (!config || !isValidProfile(profile)) return;
    if (!window.EM.Game || !window.EM.UiGame) return;
    // 锁着的关卡一律进不去：disabled 属性在部分浏览器上挡不住 pointer 事件
    if (!(index >= 0 && index < config.levelCount)) return;
    if (!isLevelUnlocked(currentProgress(), index)) return;

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

  // 一关结束：记进度、记错词、加经验，返回本次经验给结算面板用
  function onLevelSettle(result) {
    if (!result || !state.data) return null;
    var G = window.EM && window.EM.Growth;
    var progress = currentProgress();
    var key = String(result.levelIndex);
    var old = progress[key] || null;
    var firstClear = !old || !(old.stars > 0);
    var stars = Math.max(0, Math.min(3, result.stars || 0));

    progress[key] = {
      stars: Math.max(old ? old.stars : 0, stars),
      best: Math.max(old ? old.best : 0, result.score || 0)
    };

    var wrongIds = result.wrongWordIds || [];
    ensureDataShape();
    for (var i = 0; i < wrongIds.length; i++) {
      var id = wrongIds[i];
      state.data.wrongBook[id] = (state.data.wrongBook[id] || 0) + 1;
    }

    var gained = 0;
    var levelBefore = 1;
    var levelAfter = 1;
    if (G) {
      levelBefore = G.levelFromXp(growthXp());
      gained = G.xpForResult({ passed: !!result.passed, stars: stars }, firstClear);
      state.data.growth.xp = growthXp() + gained;
      levelAfter = G.levelFromXp(state.data.growth.xp);
    }

    Platform.save(state.data);
    renderProfile();
    renderGrowth();
    renderMap();

    return { xpGained: gained, level: levelAfter, leveledUp: levelAfter > levelBefore };
  }

  // 进入主应用
  function enterApp(tab) {
    renderProfile();
    renderGrowth();
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
    renderGrowth();
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
