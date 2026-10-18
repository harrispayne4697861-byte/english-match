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
            var cells = document.querySelectorAll('#map-grid .tree-node');
            check('地图渲染 12 关', cells.length === 12, String(cells.length));
            check('第 1 关可点', cells.length > 0 && !cells[0].disabled);
            check('第 2 关上锁', cells.length > 1 && cells[1].disabled === true);
            check('地图画出了科技树连线', document.querySelectorAll('#map-grid .tree-line').length >= 1,
              String(document.querySelectorAll('#map-grid .tree-line').length));
            check('第 1 关是当前关高亮', cells.length > 0 && cells[0].classList.contains('is-current'));
            check('经验条渲染出来了', !!document.getElementById('map-xp-fill') &&
              document.getElementById('map-xp-num').textContent.indexOf('/') > 0);

            tap(cells[1]);
            setTimeout(function () {
              check('点锁着的第 2 关进不去', document.getElementById('view-play').hasAttribute('hidden'));
              check('点锁着的关卡不会生成棋盘', document.querySelectorAll('#play-board .tile').length === 0);

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

                var xpBefore = document.getElementById('map-xp-num').textContent;

                // 再进第 1 关，按 data-pair-id 把四对全部消除，走完一整关
                tap(document.querySelectorAll('#map-grid .tree-node')[0]);
                setTimeout(function () {
                  var tiles = Array.prototype.slice.call(document.querySelectorAll('#play-board .tile'));
                  var groups = {};
                  tiles.forEach(function (t) {
                    var k = t.getAttribute('data-pair-id');
                    (groups[k] = groups[k] || []).push(t);
                  });
                  var seq = [];
                  Object.keys(groups).forEach(function (k) {
                    seq.push(groups[k][0], groups[k][1]);
                  });
                  check('四对词都拿到了配对编号', seq.length === 8, String(seq.length));

                  var i = 0;
                  (function step() {
                    if (i >= seq.length) {
                      setTimeout(function () {
                        check('消完四对就弹结算面板', !document.getElementById('play-settle').hasAttribute('hidden'));
                        check('结算面板显示本次经验', !!document.querySelector('.play-settle__xp'));
                        tap(document.querySelector('[data-settle="back"]'));
                        setTimeout(function () {
                          var xpAfter = document.getElementById('map-xp-num').textContent;
                          check('经验条随对局变化', xpAfter !== xpBefore, xpBefore + ' -> ' + xpAfter);
                          var first = document.querySelectorAll('#map-grid .tree-node')[0];
                          check('第 1 关变成已通关', first.classList.contains('is-passed'));
                          check('第 1 关到第 2 关的连线变成实线',
                            document.querySelectorAll('#map-grid .tree-line.is-passed').length >= 1,
                            String(document.querySelectorAll('#map-grid .tree-line.is-passed').length));
                          check('第 1 关拿到星级',
                            first.querySelectorAll('.tree-node__star.is-on').length >= 1,
                            String(first.querySelectorAll('.tree-node__star.is-on').length));
                          report();
                        }, 300);
                      }, 400);
                      return;
                    }
                    tap(seq[i++]);
                    setTimeout(step, 300);
                  })();
                }, 300);
              }, 200);
            }, 300);
            }, 300);
          }, 200);
        }, 150);
      }, 150);
      } catch (err) { lines.push('THROWN ' + (err && err.message)); report(); }
    }, 300);
  });
})();
