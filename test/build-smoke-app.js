/**
 * build-smoke-app.js · 用 index.html 生成一个可自动点击的冒烟测试页
 * 用法：node test/build-smoke-app.js
 * 产物：test/_smoke-app.html（临时文件，不要提交）
 */
var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..');
var html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
html = html.replace('<head>', '<head>\n<base href="../">');
html = html.replace('</body>', '<script src="test/smoke-app-driver.js"></script>\n</body>');
fs.writeFileSync(path.join(__dirname, '_smoke-app.html'), html, 'utf8');
console.log('生成 test/_smoke-app.html');
