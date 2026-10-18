/**
 * core-game.js · 核心玩法逻辑（纯计算，不碰页面）
 * 负责：读词库、生成棋盘、配对判定、计分连击、计时、星级。
 * 页面上怎么显示由 js/ui-game.js 负责；它只调用这里的 tap / tick / summary。
 */
window.EM = window.EM || {};
window.EM.Game = (function () {
  'use strict';

  var BASE_SCORE = 10;      // 每对基础分，实际得分 = 基础分 × 当前连击
  var PENALTY_MS = 3000;    // 配对错误扣掉的秒数
  var MIN_PAIRS = 1;

  // 某个年龄段某个年级的词表；取不到一律返回空数组，不抛错
  function getWords(stage, grade) {
    var data = window.EM && window.EM.Data;
    if (!data || !data.WORDS) return [];
    var byGrade = data.WORDS[stage];
    if (!byGrade) return [];
    var list = byGrade[grade];
    if (Object.prototype.toString.call(list) !== '[object Array]') return [];
    return list;
  }

  // 这个词表够不够开一关（至少 MIN_PAIRS 条）
  function hasContent(stage, grade) {
    return getWords(stage, grade).length >= MIN_PAIRS;
  }

  // 可复现的伪随机数：同一个 seed 每次结果都一样，方便复现问题
  function makeRng(seed) {
    var s = (seed >>> 0) || 1;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 原地打乱数组（Fisher-Yates）
  function shuffle(list, rng) {
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
    }
    return list;
  }

  // 一个单词在某一面显示什么字
  function faceText(word, face) {
    if (face === 'zh') return word.zh || '';
    if (face === 'emoji') return word.emoji || '';
    return word.en || '';
  }

  // 把词表摊成方块：每个词出两块（一面 A、一面 B），再整体打乱
  function buildTiles(words, rng, faceA, faceB) {
    var random = rng || makeRng(1);
    var a = faceA || 'en';
    var b = faceB || 'zh';
    var tiles = [];
    for (var i = 0; i < words.length; i++) {
      var word = words[i];
      tiles.push({
        tileId: 't' + tiles.length,
        pairId: 'p' + i,
        wordId: word.id,
        face: a,
        text: faceText(word, a),
        matched: false
      });
      tiles.push({
        tileId: 't' + tiles.length,
        pairId: 'p' + i,
        wordId: word.id,
        face: b,
        text: faceText(word, b),
        matched: false
      });
    }
    return shuffle(tiles, random);
  }

  // 开一局
  function createSession(opts) {
    var cfg = opts || {};
    var pairs = Math.max(MIN_PAIRS, cfg.pairs || 4);
    var words = (cfg.words || []).slice(0, pairs);
    var seconds = cfg.seconds > 0 ? cfg.seconds : 0;
    var initialMs = seconds > 0 ? seconds * 1000 : Infinity;

    var rng = makeRng(cfg.seed == null ? 1 : cfg.seed);
    var tiles = buildTiles(words, rng, cfg.faceA, cfg.faceB);

    var score = 0;
    var combo = 0;
    var comboMax = 0;
    var mistakes = 0;
    var status = 'playing';
    var timeLeftMs = initialMs;
    var elapsedMs = 0;
    var wrongWordIds = [];
    var selectedTileId = null;

    // 按 tileId 找方块；找不到返回 null
    function findTile(tileId) {
      for (var i = 0; i < tiles.length; i++) {
        if (tiles[i].tileId === tileId) return tiles[i];
      }
      return null;
    }

    // 错词去重记录，保持首次出错的顺序
    function rememberWrong(wordId) {
      if (!wordId) return;
      if (wrongWordIds.indexOf(wordId) !== -1) return;
      wrongWordIds.push(wordId);
    }

    // 是否全部消完
    function allMatched() {
      for (var i = 0; i < tiles.length; i++) {
        if (!tiles[i].matched) return false;
      }
      return true;
    }

    // 点一个方块，返回这一步发生了什么
    function tap(tileId) {
      var tile = findTile(tileId);
      if (status !== 'playing' || !tile || tile.matched) {
        return { type: 'ignored', tileId: tileId };
      }

      // 第一次点：选中
      if (selectedTileId === null) {
        selectedTileId = tile.tileId;
        return {
          type: 'select',
          tileId: tile.tileId,
          pairId: tile.pairId,
          wordId: tile.wordId,
          face: tile.face
        };
      }

      // 又点了一下自己：取消选中
      if (selectedTileId === tile.tileId) {
        selectedTileId = null;
        return { type: 'ignored', tileId: tile.tileId };
      }

      var first = findTile(selectedTileId);
      selectedTileId = null;

      // 配对成功
      if (first && first.pairId === tile.pairId) {
        first.matched = true;
        tile.matched = true;
        combo += 1;
        if (combo > comboMax) comboMax = combo;
        var gained = BASE_SCORE * combo;
        score += gained;
        if (allMatched()) status = 'won';
        return {
          type: 'match',
          tileId: tile.tileId,
          pairId: tile.pairId,
          wordId: tile.wordId,
          gained: gained,
          combo: combo
        };
      }

      // 配对失败
      combo = 0;
      mistakes += 1;
      if (first) rememberWrong(first.wordId);
      rememberWrong(tile.wordId);

      var penalty = 0;
      if (seconds > 0) {
        penalty = Math.min(PENALTY_MS, timeLeftMs);
        timeLeftMs = Math.max(0, timeLeftMs - PENALTY_MS);
      }

      return {
        type: 'mismatch',
        tileId: tile.tileId,
        pairId: tile.pairId,
        wordId: tile.wordId,
        alsoPairId: first ? first.pairId : null,
        alsoWordId: first ? first.wordId : null,
        timePenaltyMs: penalty
      };
    }

    // 走时间：传进去多少毫秒就扣多少，返回当前状态
    function tick(deltaMs) {
      if (status !== 'playing') return status;
      var delta = deltaMs > 0 ? deltaMs : 0;
      elapsedMs += delta;
      if (seconds > 0) {
        timeLeftMs -= delta;
        if (timeLeftMs <= 0) {
          timeLeftMs = 0;
          status = 'timeup';
        }
      }
      return status;
    }

    // 评级：全对且时间过半 → 3 星；错 1~2 次 → 2 星；其它过关 → 1 星
    function stars() {
      if (status !== 'won') return 0;
      var timeOk = seconds > 0 ? timeLeftMs > initialMs * 0.5 : true;
      if (mistakes === 0 && timeOk) return 3;
      if (mistakes <= 2) return 2;
      return 1;
    }

    // 一局的成绩单
    function summary() {
      return {
        score: score,
        comboMax: comboMax,
        mistakes: mistakes,
        usedMs: elapsedMs,
        stars: stars(),
        wrongWordIds: wrongWordIds.slice(),
        status: status
      };
    }

    // 对外只读字段，页面层不需要也不允许直接改内部状态
    var session = {
      tiles: tiles,
      tap: tap,
      tick: tick,
      stars: stars,
      summary: summary
    };
    Object.defineProperty(session, 'score', { get: function () { return score; } });
    Object.defineProperty(session, 'combo', { get: function () { return combo; } });
    Object.defineProperty(session, 'mistakes', { get: function () { return mistakes; } });
    Object.defineProperty(session, 'status', { get: function () { return status; } });
    Object.defineProperty(session, 'timeLeftMs', { get: function () { return timeLeftMs; } });
    Object.defineProperty(session, 'wrongWordIds', { get: function () { return wrongWordIds.slice(); } });

    return session;
  }

  return {
    getWords: getWords,
    hasContent: hasContent,
    makeRng: makeRng,
    buildTiles: buildTiles,
    createSession: createSession
  };
})();
