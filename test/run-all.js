/**
 * run-all.js · 一次跑完所有检查（词库 / 核心逻辑 / 等级经验 / 两套浏览器冒烟）
 * 用法：node test/run-all.js
 */
var cp = require('child_process');
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var NODE = process.execPath;
var CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
];
var chrome = null;
for (var i = 0; i < CHROME_CANDIDATES.length; i++) {
  if (fs.existsSync(CHROME_CANDIDATES[i])) { chrome = CHROME_CANDIDATES[i]; break; }
}

var failed = 0;

function step(name, fn) {
  process.stdout.write('[' + name + '] ');
  try {
    fn();
    console.log('PASS');
  } catch (err) {
    failed++;
    console.log('FAIL - ' + (err && err.message));
  }
}

function runNode(file) {
  cp.execFileSync(NODE, [path.join(__dirname, file)], { stdio: 'pipe' });
}

function smoke(entry, expect) {
  if (!chrome) throw new Error('找不到 Chrome / Edge，跳过浏览器测试');
  var out = cp.execFileSync(chrome, [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    '--virtual-time-budget=25000', '--dump-dom',
    'file:///' + path.join(__dirname, entry).replace(/\\/g, '/')
  ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (out.indexOf(expect) === -1) throw new Error('页面没有输出 ' + expect);
}

step('词库数据', function () { runNode('check-words.js'); });
step('核心逻辑', function () { runNode('check-core.js'); });
step('等级经验', function () { runNode('check-growth.js'); });
step('对局页冒烟', function () { smoke('smoke.html', 'SMOKE PASS'); });
step('整机接线冒烟', function () {
  runNode('build-smoke-app.js');
  smoke('_smoke-app.html', 'SMOKE PASS');
});

console.log(failed ? '\n有 ' + failed + ' 项失败' : '\n全部通过');
process.exit(failed ? 1 : 0);
