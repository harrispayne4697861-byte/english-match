/**
 * check-words.js · 词库自检
 * 用法：node test/check-words.js
 */
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');
var sandbox = { window: {}, console: console };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'data-words.js'), 'utf8'), sandbox, { filename: 'data-words.js' });

var Data = sandbox.window.EM.Data;
var list = Data.WORDS.primary[3];
var fails = [];

function check(name, ok, detail) {
  if (ok) { console.log('  ok   ' + name); return; }
  fails.push(name + (detail ? ' -> ' + detail : ''));
  console.log('  FAIL ' + name + (detail ? ' -> ' + detail : ''));
}

console.log('词库：primary[3] 共 ' + list.length + ' 条');
check('100 条', list.length === 100, String(list.length));

var ids = {}, ens = {};
for (var i = 0; i < list.length; i++) {
  var w = list[i];
  check('id 唯一 ' + w.id, !ids[w.id]); ids[w.id] = 1;
  check('en 唯一 ' + w.en, !ens[w.en]); ens[w.en] = 1;
  check('id 前缀 p3- ' + w.id, w.id.indexOf('p3-') === 0);
  check('en 小写且无首尾空格 ' + w.en, w.en === w.en.toLowerCase() && w.en === w.en.trim());
  check('zh 非空且不超过 6 字 ' + w.zh, !!w.zh && w.zh.length <= 6, w.zh);
  check('ph 不带斜杠 ' + w.en, w.ph.indexOf('/') === -1);
}
check('id 连续到 p3-100', ids['p3-100'] === 1);

var empty = true;
['kindergarten', 'junior'].forEach(function (stage) {
  Object.keys(Data.WORDS[stage]).forEach(function (g) {
    if (Data.WORDS[stage][g].length !== 0) empty = false;
  });
});
[1, 2, 4, 5, 6].forEach(function (g) {
  if (Data.WORDS.primary[g].length !== 0) empty = false;
});
check('其余年级都是空数组', empty);
check('STAGE_CONFIG 三段落齐全', !!(Data.STAGE_CONFIG.kindergarten && Data.STAGE_CONFIG.primary && Data.STAGE_CONFIG.junior));

if (fails.length) {
  console.log('\n失败 ' + fails.length + ' 项');
  process.exit(1);
}
console.log('\n词库自检全部通过');
