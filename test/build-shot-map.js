/**
 * build-shot-map.js · 生成 390px 宽的人工核对截图页（不是测试用例）
 *   _shot-map.html     预置存档，直接进科技树地图
 *   _shot-onboard.html 清空存档，进引导页（核对三张插画）
 */
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

var seed = {
  schemaVersion: 1,
  deviceId: 'anon-shot0000',
  profile: { stage: 'primary', grade: 3, createdAt: '2026-01-01T00:00:00.000Z' },
  progress: {
    primary_3: {
      '0': { stars: 3, best: 150 },
      '1': { stars: 2, best: 130 },
      '2': { stars: 1, best: 90 }
    }
  },
  wrongBook: { 'p3-003': 2 },
  growth: { xp: 260 }
};

function build(script, file) {
  var inject = '<base href="../"><script>' + script + '<\/script>';
  fs.writeFileSync(path.join(__dirname, file), html.replace('<title>', inject + '<title>'), 'utf8');
  console.log('已生成 test/' + file);
}

build('localStorage.setItem("engl_match_v1", ' + JSON.stringify(JSON.stringify(seed)) + ');', '_shot-map.html');
build('localStorage.removeItem("engl_match_v1");', '_shot-onboard.html');
