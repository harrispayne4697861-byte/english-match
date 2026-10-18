/**
 * ui-game.js · 对局页渲染层
 * 只负责把 #view-play 里的 play-* 容器画出来、接点击、跑计时；
 * 棋盘判定与计分全部来自 js/core-game.js，进度存储全部交给 js/app.js。
 */
window.EM = window.EM || {};
window.EM.UiGame = (function () {
  'use strict';

  var boardEl = null;
  var hudEl = null;
  var settleEl = null;
  var backEl = null;

  var payload = null;
  var session = null;
  var timerId = 0;
  var lastTickAt = 0;
  var inputLocked = false;
  var finished = false;
  var bound = false;

  // 取元素
  function byId(id) {
    return document.getElementById(id);
  }

  // 转义放进 innerHTML 的文本
  function escapeHtml(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // 毫秒转 m:ss；不计时返回空串
  function formatTime(ms) {
    if (ms === Infinity) return '';
    var total = Math.max(0, Math.ceil(ms / 1000));
    var minute = Math.floor(total / 60);
    var second = total % 60;
    return minute + ':' + (second < 10 ? '0' : '') + second;
  }

  // 停止计时器
  function stopTimer() {
    if (timerId) {
      window.clearInterval(timerId);
      timerId = 0;
    }
  }

  // 动画期间锁住输入，避免连点把状态打乱
  function lockInput(ms) {
    inputLocked = true;
    window.setTimeout(function () {
      inputLocked = false;
    }, ms);
  }

  // 刷新顶部信息条
  function renderHud() {
    if (!hudEl || !session) return;
    var parts = [];
    parts.push('<span class="play-hud__item">第 ' + (payload.levelIndex + 1) + ' 关</span>');
    parts.push('<span class="play-hud__item">' + session.score + ' 分</span>');
    if (session.combo > 1) {
      parts.push('<span class="play-hud__item is-hot">连击 ×' + session.combo + '</span>');
    }
    if (session.timeLeftMs !== Infinity) {
      var warn = session.timeLeftMs <= 15000 ? ' is-warn' : '';
      parts.push('<span class="play-hud__item' + warn + '">' + formatTime(session.timeLeftMs) + '</span>');
    }
    hudEl.innerHTML = parts.join('');
  }

  // 按关卡数据铺满棋盘
  function renderBoard() {
    if (!boardEl) return;
    boardEl.style.setProperty('--cols', String(payload.config.cols || 4));
    var html = '';
    for (var i = 0; i < session.tiles.length; i++) {
      var tile = session.tiles[i];
      html += '<button class="tile" type="button" data-tile-id="' + escapeHtml(tile.tileId) +
        '" data-face="' + escapeHtml(tile.face) + '">' + escapeHtml(tile.text) + '</button>';
    }
    boardEl.innerHTML = html;
  }

  // 按 tileId 找方块节点
  function tileNode(tileId) {
    if (!boardEl) return null;
    return boardEl.querySelector('[data-tile-id="' + tileId + '"]');
  }

  // 点击一个方块
  function handleTap(node) {
    var tileId = node.getAttribute('data-tile-id');

    // 再点一次已选中的方块 = 取消选择
    if (node.classList.contains('is-selected')) {
      node.classList.remove('is-selected');
      session.tap(tileId);
      return;
    }

    var result = session.tap(tileId);

    if (result.type === 'ignored') return;

    if (result.type === 'select') {
      node.classList.add('is-selected');
      return;
    }

    if (result.type === 'match') {
      var first = boardEl.querySelector('.tile.is-selected');
      if (first) {
        first.classList.remove('is-selected');
        first.classList.add('is-matched');
      }
      node.classList.add('is-matched');
      lockInput(240);
      window.setTimeout(function () {
        if (first) {
          first.classList.remove('is-matched');
          first.classList.add('is-cleared');
        }
        node.classList.remove('is-matched');
        node.classList.add('is-cleared');
      }, 220);
      renderHud();
      if (session.status === 'won') window.setTimeout(finish, 260);
      return;
    }

    if (result.type === 'mismatch') {
      var wrongFirst = boardEl.querySelector('.tile.is-selected');
      if (wrongFirst) {
        wrongFirst.classList.remove('is-selected');
        wrongFirst.classList.add('is-wrong');
      }
      node.classList.add('is-wrong');
      lockInput(340);
      window.setTimeout(function () {
        if (wrongFirst) wrongFirst.classList.remove('is-wrong');
        node.classList.remove('is-wrong');
      }, 320);
      renderHud();
    }
  }

  // 棋盘上的点击（事件委托，棋盘重绘后不用重新绑定）
  function onBoardClick(event) {
    if (!session || finished || inputLocked) return;
    var target = event.target;
    var node = target && target.closest ? target.closest('.tile') : null;
    if (node && boardEl.contains(node)) handleTap(node);
  }

  // 跑一帧计时
  function startTimer() {
    if (!payload || payload.config.seconds <= 0) return;
    lastTickAt = Date.now();
    timerId = window.setInterval(function () {
      var now = Date.now();
      var delta = now - lastTickAt;
      lastTickAt = now;
      var status = session.tick(delta);
      renderHud();
      if (status !== 'playing') {
        stopTimer();
        finish();
      }
    }, 200);
  }

  // 结算面板
  function showSettle(result) {
    if (!settleEl) return;
    var stars = '';
    for (var i = 0; i < 3; i++) {
      stars += '<span class="play-settle__star' + (i < result.stars ? ' is-on' : '') + '">★</span>';
    }
    var title = result.passed ? '过关！' : '时间到';
    var meta = result.passed ?
      ('得分 ' + result.score + ' · 错 ' + result.mistakes + ' 次') :
      ('还差一点，得分 ' + result.score);
    settleEl.innerHTML =
      '<div class="play-settle__box">' +
      '<p class="play-settle__title">' + title + '</p>' +
      '<p class="play-settle__stars">' + stars + '</p>' +
      '<p class="play-settle__meta">' + meta + '</p>' +
      '<button class="btn btn--primary" type="button" data-settle="again">再玩一次</button>' +
      '<button class="btn btn--ghost" type="button" data-settle="back">回到地图</button>' +
      '</div>';
    settleEl.removeAttribute('hidden');
  }

  // 隐藏结算面板
  function hideSettle() {
    if (!settleEl) return;
    settleEl.setAttribute('hidden', '');
    settleEl.innerHTML = '';
  }

  // 一关结束：算结果、显示面板、通知上层存档
  function finish() {
    if (finished) return;
    finished = true;
    stopTimer();
    inputLocked = true;

    var summary = session.summary();
    var result = {
      levelIndex: payload.levelIndex,
      score: summary.score,
      stars: summary.stars,
      mistakes: summary.mistakes,
      passed: summary.status === 'won',
      wrongWordIds: summary.wrongWordIds || [],
      usedMs: typeof summary.usedMs === 'number' ? summary.usedMs : 0
    };
    showSettle(result);
    if (window.EM.App && window.EM.App.onLevelSettle) {
      window.EM.App.onLevelSettle(result);
    }
  }

  // 结算面板上的两个按钮
  function onSettleClick(event) {
    var target = event.target;
    var node = target && target.closest ? target.closest('[data-settle]') : null;
    if (!node) return;
    var action = node.getAttribute('data-settle');
    if (action === 'again') {
      start(payload);
      return;
    }
    if (window.EM.App && window.EM.App.exitLevel) window.EM.App.exitLevel();
  }

  // 顶部返回
  function onBackClick() {
    if (window.EM.App && window.EM.App.exitLevel) window.EM.App.exitLevel();
  }

  // 开始（或重开）一关
  function start(nextPayload) {
    if (!nextPayload || !window.EM.Game) return;
    cacheRefs();
    stopTimer();
    hideSettle();

    payload = nextPayload;
    finished = false;
    inputLocked = false;

    session = window.EM.Game.createSession({
      words: payload.words,
      pairs: payload.config.pairsPerLevel,
      seconds: payload.config.seconds,
      faceA: payload.config.faceA,
      faceB: payload.config.faceB,
      seed: Math.floor(Math.random() * 1000000)
    });

    renderBoard();
    renderHud();
    startTimer();

    if (!bound) {
      if (boardEl) boardEl.addEventListener('click', onBoardClick);
      if (backEl) backEl.addEventListener('click', onBackClick);
      if (settleEl) settleEl.addEventListener('click', onSettleClick);
      bound = true;
    }
  }

  // 缓存容器引用
  function cacheRefs() {
    boardEl = byId('play-board');
    hudEl = byId('play-hud');
    settleEl = byId('play-settle');
    backEl = byId('play-back');
  }

  // 离开对局：清定时器、解绑、清空容器
  function stop() {
    stopTimer();
    if (bound) {
      if (boardEl) boardEl.removeEventListener('click', onBoardClick);
      if (backEl) backEl.removeEventListener('click', onBackClick);
      if (settleEl) settleEl.removeEventListener('click', onSettleClick);
      bound = false;
    }
    hideSettle();
    if (boardEl) boardEl.innerHTML = '';
    if (hudEl) hudEl.innerHTML = '';
    session = null;
    payload = null;
    finished = false;
    inputLocked = false;
  }

  return {
    start: start,
    stop: stop
  };
})();
