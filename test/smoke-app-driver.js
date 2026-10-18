// smoke-app-driver.js · app.js 接线冒烟测试（配合 test/_smoke-app.html）
(function () {
  var lines = [];
  var fails = 0;
  function check(name, ok, detail) {
    lines.push((ok ? 'ok   ' : 'FAIL ') + name + (detail ? ' -> ' + detail : ''));
    if (!ok) fails++;
  }
  function report() {
    var box = document.createElement('pre');
    box.id = 'smoke-result';
    box.textContent = lines.join('\n') + '\nSMOKE ' + (fails ? 'FAIL ' + fails : 'PASS');
    document.body.appendChild(box);
    document.title = fails ? 'SMOKE-FAIL' : 'SMOKE-PASS';
  }

  // app.js 用的是 pointerdown / pointerup，模拟一次真实的点按
  function tap(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    var x = r.left + r.width / 2;
    var y = r.top + r.height / 2;
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y }));
    el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x, clientY: y }));
    // 真实浏览器一次点按还会补一个 click；app.js 走 pointer，ui-game.js 走 click
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }));
    return true;
  }

  function byAction(action, extra) {
    return document.querySelector('[data-action="' + action + '"]' + (extra || ''));
  }

  window.addEventListener('error', function (e) {
    lines.push('ERROR ' + e.message + ' @' + (e.filename || '') + ':' + (e.lineno || 0));
  });

  window.addEventListener('load', function () {
    setTimeout(function () {
      try {
      check('启动后停在引导页', !document.getElementById('view-onboard').hasAttribute('hidden'));
      check('引导页第 1 步可见', !document.getElementById('step-1').hasAttribute('hidden'));

      tap(document.querySelector('[data-action="pick-stage"][data-stage="primary"]'));
      setTimeout(function () {
        check('选完年龄段进入第 2 步', !document.getElementById('step-2').hasAttribute('hidden'));
        check('年级按钮渲染出来了', document.querySelectorAll('#grade-list .grade-chip').length === 6,
          String(document.querySelectorAll('#grade-list .grade-chip').length));

        tap(document.querySelector('[data-action="pick-grade"][data-grade="3"]'));
        setTimeout(function () {
          check('选完年级进入第 3 步', !document.getElementById('step-3').hasAttribute('hidden'));

          tap(byAction('finish-onboard'));
          setTimeout(function () {
            check('完成后进入地图', !document.getElementById('view-map').hasAttribute('hidden'));
            check('底部 Tab 出现', !document.getElementById('tabbar').hasAttribute('hidden'));
            var cells = document.querySelectorAll('#map-grid .level-cell');
            check('地图渲染 12 关', cells.length === 12, String(cells.length));
            check('第 1 关可点', cells.length > 0 && !cells[0].disabled);
            check('第 2 关上锁', cells.length > 1 && cells[1].disabled === true);

            tap(cells[0]);
            setTimeout(function () {
              check('进入游戏页', !document.getElementById('view-play').hasAttribute('hidden'));
              check('游戏页 Tab 隐藏', document.getElementById('tabbar').hasAttribute('hidden'));
              var tiles = document.querySelectorAll('#play-board .tile');
              check('棋盘 8 块', tiles.length === 8, String(tiles.length));
              check('HUD 有内容', document.getElementById('play-hud').textContent.length > 0);

              // 点返回，验证退出回地图
              tap(document.getElementById('play-back'));
              setTimeout(function () {
                check('返回后回到地图', !document.getElementById('view-map').hasAttribute('hidden'));
                check('返回后棋盘已清空', document.querySelectorAll('#play-board .tile').length === 0);
                report();
              }, 200);
            }, 300);
          }, 200);
        }, 150);
      }, 150);
      } catch (err) { lines.push('THROWN ' + (err && err.message)); report(); }
    }, 300);
  });
})();
