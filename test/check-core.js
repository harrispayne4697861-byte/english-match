/**
 * check-core.js · 核心逻辑自检
 * 用法：node test/check-core.js
 */
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');
var sandbox = { window: {}, console: console };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'data-words.js'), 'utf8'), sandbox, { filename: 'data-words.js' });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'core-game.js'), 'utf8'), sandbox, { filename: 'core-game.js' });

var Game = sandbox.window.EM.Game;
var fails = [];
function check(name, ok, detail) {
  if (ok) { console.log('  ok   ' + name); return; }
  fails.push(name);
  console.log('  FAIL ' + name + (detail ? ' -> ' + detail : ''));
}

var words = Game.getWords('primary', 3).slice(0, 4);

// 1. 随机数可复现
var r1 = Game.makeRng(42), r2 = Game.makeRng(42);
var same = true;
for (var i = 0; i < 20; i++) if (r1() !== r2()) same = false;
check('makeRng 同 seed 结果一致', same);

// 2. 棋盘
var s1 = Game.createSession({ words: words, pairs: 4, seconds: 120, seed: 7 });
check('4 对生成 8 块', s1.tiles.length === 8, String(s1.tiles.length));
var pairCount = {};
s1.tiles.forEach(function (t) { pairCount[t.pairId] = (pairCount[t.pairId] || 0) + 1; });
check('每个 pairId 恰好 2 块', Object.keys(pairCount).length === 4 &&
  Object.keys(pairCount).every(function (k) { return pairCount[k] === 2; }));

// 3. 同 seed 棋盘一致
var s2 = Game.createSession({ words: words, pairs: 4, seconds: 120, seed: 7 });
check('同 seed 棋盘一致', s1.tiles.map(function (t) { return t.tileId + t.text; }).join() ===
  s2.tiles.map(function (t) { return t.tileId + t.text; }).join());

// 4. 全对通关 → 100 分 3 星
function pairMap(session) {
  var map = {};
  session.tiles.forEach(function (t) { (map[t.pairId] = map[t.pairId] || []).push(t.tileId); });
  return map;
}
var s3 = Game.createSession({ words: words, pairs: 4, seconds: 120, seed: 9 });
var pm3 = pairMap(s3);
Object.keys(pm3).forEach(function (p) { s3.tap(pm3[p][0]); s3.tap(pm3[p][1]); });
check('全对得分 100', s3.score === 100, String(s3.score));
check('全对 status=won', s3.status === 'won', s3.status);
check('全对 3 星', s3.stars() === 3, String(s3.stars()));

// 5. 先错一次再全对
var s4 = Game.createSession({ words: words, pairs: 4, seconds: 120, seed: 11 });
var pm4 = pairMap(s4);
var keys = Object.keys(pm4);
s4.tap(pm4[keys[0]][0]);
var beforeMs = s4.timeLeftMs;
s4.tap(pm4[keys[1]][0]);
check('错配 mistakes=1', s4.mistakes === 1, String(s4.mistakes));
check('错配扣 3000 毫秒', beforeMs - s4.timeLeftMs === 3000, String(beforeMs - s4.timeLeftMs));
check('错配记录 2 个错词', s4.wrongWordIds.length === 2, String(s4.wrongWordIds.length));
check('错配 combo 归零', s4.combo === 0);
keys.forEach(function (p) {
  if (p === keys[0] || p === keys[1]) return;
  s4.tap(pm4[p][0]); s4.tap(pm4[p][1]);
});
// keys[0] 与 keys[1] 的块还没消，补上
s4.tap(pm4[keys[0]][0]); s4.tap(pm4[keys[0]][1]);
s4.tap(pm4[keys[1]][0]); s4.tap(pm4[keys[1]][1]);
check('先错后全对仍通关', s4.status === 'won', s4.status);
check('有错时最多 2 星', s4.stars() === 2, String(s4.stars()));

// 6. 连点同一块
var s5 = Game.createSession({ words: words, pairs: 4, seconds: 120, seed: 13 });
var tm5 = pairMap(s5);
var anyId = tm5[Object.keys(tm5)[0]][0];
var r5a = s5.tap(anyId);
var r5b = s5.tap(anyId);
check('第一次是 select', r5a.type === 'select', r5a.type);
check('再点同一块是 ignored', r5b.type === 'ignored', r5b.type);
check('再点同一块不扣分', s5.score === 0 && s5.mistakes === 0);

// 7. 点已匹配的块
var r7 = s5.tap(anyId);
var partner = tm5[Object.keys(tm5)[0]].filter(function (id) { return id !== anyId; })[0];
var r7b = s5.tap(partner);
var r7c = s5.tap(anyId);
check('消掉后再点是 ignored', r7c.type === 'ignored', r7c.type);

// 8. 超时
var s6 = Game.createSession({ words: words, pairs: 4, seconds: 5, seed: 17 });
s6.tick(5001);
check('超时 status=timeup', s6.status === 'timeup', s6.status);
check('超时 0 星', s6.stars() === 0, String(s6.stars()));
check('超时后 tap 无效果', s6.tap(pairMap(s6)[Object.keys(pairMap(s6))[0]][0]).type === 'ignored');

// 9. 不计时（幼儿园）
var s7 = Game.createSession({ words: words, pairs: 3, seconds: 0, seed: 19, faceA: 'emoji', faceB: 'en' });
check('不计时 timeLeftMs=Infinity', s7.timeLeftMs === Infinity, String(s7.timeLeftMs));
check('幼儿园面：emoji + en', s7.tiles.some(function (t) { return t.face === 'emoji'; }) &&
  s7.tiles.some(function (t) { return t.face === 'en'; }));

// 10. 空数据不崩
check('不存在的年级返回空数组', Game.getWords('primary', 6).length === 0);
check('不存在的年龄段返回空数组', Game.getWords('nope', 1).length === 0);
check('空词表建局不崩', Game.createSession({ words: [], pairs: 4, seconds: 60, seed: 1 }).tiles.length === 0);

if (fails.length) {
  console.log('\n失败 ' + fails.length + ' 项：' + fails.join('、'));
  process.exit(1);
}
console.log('\n核心逻辑自检全部通过');
