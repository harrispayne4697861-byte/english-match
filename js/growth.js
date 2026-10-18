/**
 * growth.js · 等级与经验（纯逻辑，不碰 DOM，不读写 localStorage）
 * 参数都是占位值，等用户确认经验规则后只改 CONFIG 即可，调用方不用动。
 */
window.EM = window.EM || {};
window.EM.Growth = (function () {
  'use strict';

  // 经验参数（占位默认值，可整体替换）
  var CONFIG = {
    baseXp: 10,          // 通关基础经验
    xpPerStar: 10,       // 每颗星额外经验
    firstClearBonus: 20, // 首次通关额外经验
    tryXp: 5,            // 没通关也给一点参与经验
    curveStep: 100,      // 从 Lv.n 升到 Lv.n+1 需要 curveStep * n 点
    maxLevel: 99
  };

  // 从 level 升到 level+1 需要的经验
  function xpNeed(level) {
    var n = level >= 1 ? Math.floor(level) : 1;
    return CONFIG.curveStep * n;
  }

  // 从 Lv.1 升到 level 累计需要的经验
  function totalXpForLevel(level) {
    var n = level >= 1 ? Math.floor(level) : 1;
    return CONFIG.curveStep * (n - 1) * n / 2;
  }

  // 由累计经验反推等级
  function levelFromXp(xp) {
    var left = typeof xp === 'number' && isFinite(xp) && xp > 0 ? Math.floor(xp) : 0;
    var level = 1;
    while (level < CONFIG.maxLevel && left >= totalXpForLevel(level + 1)) level++;
    return level;
  }

  // 经验条要用的信息：当前等级 / 本级已得 / 本级需要 / 百分比
  function levelProgress(xp) {
    var left = typeof xp === 'number' && isFinite(xp) && xp > 0 ? Math.floor(xp) : 0;
    var level = levelFromXp(left);
    var base = totalXpForLevel(level);
    var need = xpNeed(level);
    var into = left - base;
    if (into < 0) into = 0;
    if (into > need) into = need;
    var percent = level >= CONFIG.maxLevel ? 100 : Math.round(into / need * 100);
    return { level: level, into: into, need: need, percent: percent, total: left };
  }

  // 一局结束后应得经验
  function xpForResult(result, firstClear) {
    if (!result) return 0;
    if (!result.passed) return CONFIG.tryXp;
    var stars = Math.max(0, Math.min(3, Math.floor(result.stars || 0)));
    return CONFIG.baseXp + stars * CONFIG.xpPerStar + (firstClear ? CONFIG.firstClearBonus : 0);
  }

  return {
    CONFIG: CONFIG,
    xpNeed: xpNeed,
    totalXpForLevel: totalXpForLevel,
    levelFromXp: levelFromXp,
    levelProgress: levelProgress,
    xpForResult: xpForResult
  };
})();
