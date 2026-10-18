/**
 * check-growth.js · 等级/经验纯逻辑检查（不需要浏览器）
 */
var fs = require('fs');
var path = require('path');

var code = fs.readFileSync(path.join(__dirname, '..', 'js', 'growth.js'), 'utf8');
var sandbox = { window: {} };
new Function('window', code + '\n;')(sandbox.window);

var G = sandbox.window.EM.Growth;
var failures = 0;
var checks = 0;

function eq(actual, expected, label) {
  checks++;
  if (actual !== expected) {
    failures++;
    console.log('FAIL ' + label + ' -> 实际 ' + JSON.stringify(actual) + ' 期望 ' + JSON.stringify(expected));
  }
}

eq(G.levelFromXp(0), 1, 'Lv: 0xp = 1 级');
eq(G.levelFromXp(99), 1, 'Lv: 99xp 还在 1 级');
eq(G.levelFromXp(100), 2, 'Lv: 100xp = 2 级');
eq(G.levelFromXp(299), 2, 'Lv: 299xp 还在 2 级');
eq(G.levelFromXp(300), 3, 'Lv: 300xp = 3 级');
eq(G.levelFromXp(600), 4, 'Lv: 600xp = 4 级');
eq(G.levelFromXp(-5), 1, 'Lv: 负数经验不炸');
eq(G.xpNeed(1), 100, 'need: 1->2 要 100');
eq(G.xpNeed(3), 300, 'need: 3->4 要 300');
eq(G.totalXpForLevel(1), 0, 'total: 1 级累计 0');
eq(G.totalXpForLevel(4), 600, 'total: 4 级累计 600');

var p1 = G.levelProgress(150);
eq(p1.level, 2, 'bar: 150xp 等级');
eq(p1.into, 50, 'bar: 150xp 本级 50');
eq(p1.need, 200, 'bar: 2 级需要 200');
eq(p1.percent, 25, 'bar: 25%');

var p2 = G.levelProgress(1050);
eq(p2.level, 5, 'bar: 1050xp 等级 5');
eq(p2.into, 50, 'bar: 1050xp 本级 50');
eq(p2.percent, 10, 'bar: 10%');

eq(G.xpForResult({ passed: true, stars: 3 }, true), 60, 'xp: 首通三星 = 10+30+20');
eq(G.xpForResult({ passed: true, stars: 1 }, false), 20, 'xp: 重复通关一星 = 10+10');
eq(G.xpForResult({ passed: false, stars: 0 }, false), 5, 'xp: 没通关 = 参与经验');
eq(G.xpForResult(null), 0, 'xp: 空结果 = 0');
eq(G.xpForResult({ passed: true, stars: 9 }, false), 40, 'xp: 星级越界被夹到 3');

var last = 0;
var monotonic = true;
for (var xp = 0; xp <= 5000; xp += 25) {
  var lv = G.levelFromXp(xp);
  if (lv < last) monotonic = false;
  last = lv;
  var pr = G.levelProgress(xp);
  if (pr.percent < 0 || pr.percent > 100) monotonic = false;
}
eq(monotonic, true, '单调: 等级不下降且百分比在 0..100');
eq(G.levelFromXp(1e9), G.CONFIG.maxLevel, '上限: 经验封顶不超最大等级');

if (failures) {
  console.log('GROWTH FAIL ' + failures + '/' + checks);
  process.exit(1);
}
console.log('GROWTH PASS ' + checks);
process.exit(0);
