/**
 * 指の操作を読み取る。タップ・長押し・上下左右のスワイプ。
 * 指を動かしている間は onDrag が呼ばれるので、カードを実際に動かして返せる。
 */
(function (global) {
  'use strict';

  var SWIPE_MIN = 56;      // これ以上動かしたらスワイプ
  var SWIPE_VELOCITY = 0.4; // px/ms。速ければ短くてもスワイプ
  var TAP_MAX = 12;        // これ以下ならタップ
  var TAP_TIME = 400;
  var LONG_PRESS = 480;

  function isControl(target) {
    return !!(target && target.closest && target.closest('button, a, input, select, textarea, label, [data-no-gesture]'));
  }

  /**
   * @param {Element} el
   * @param {Object} handlers onTap onLongPress onSwipe(dir) onDrag(dx,dy) onDragEnd()
   */
  function attach(el, handlers) {
    var h = handlers || {};
    var startX = 0, startY = 0, startT = 0;
    var active = false, moved = false, longTimer = null, longFired = false;
    var pointerId = null;

    function clearLong() {
      if (longTimer) { clearTimeout(longTimer); longTimer = null; }
    }

    function down(e) {
      if (active || isControl(e.target)) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      active = true;
      moved = false;
      longFired = false;
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      startT = Date.now();
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
      clearLong();
      longTimer = setTimeout(function () {
        if (!active || moved) return;
        longFired = true;
        if (h.onLongPress) h.onLongPress();
      }, LONG_PRESS);
    }

    function move(e) {
      if (!active || e.pointerId !== pointerId) return;
      var dx = e.clientX - startX;
      var dy = e.clientY - startY;
      if (!moved && Math.abs(dx) + Math.abs(dy) > TAP_MAX) {
        moved = true;
        clearLong();
      }
      if (moved && h.onDrag) h.onDrag(dx, dy);
    }

    function up(e) {
      if (!active || e.pointerId !== pointerId) return;
      active = false;
      pointerId = null;
      clearLong();
      try { el.releasePointerCapture(e.pointerId); } catch (err) {}

      var dx = e.clientX - startX;
      var dy = e.clientY - startY;
      var dt = Math.max(1, Date.now() - startT);
      var adx = Math.abs(dx), ady = Math.abs(dy);
      var dist = Math.max(adx, ady);
      var velocity = dist / dt;

      if (h.onDragEnd) h.onDragEnd();

      if (longFired) return;

      if (dist < TAP_MAX && dt < TAP_TIME) {
        if (h.onTap) h.onTap(e);
        return;
      }
      if (dist < SWIPE_MIN && velocity < SWIPE_VELOCITY) return;

      var dir;
      if (adx > ady * 1.2) dir = dx > 0 ? 'right' : 'left';
      else if (ady > adx * 1.2) dir = dy > 0 ? 'down' : 'up';
      else return;
      if (h.onSwipe) h.onSwipe(dir);
    }

    function cancel(e) {
      if (!active) return;
      active = false;
      pointerId = null;
      clearLong();
      if (h.onDragEnd) h.onDragEnd();
    }

    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', cancel);
    el.addEventListener('lostpointercapture', cancel);
    el.addEventListener('contextmenu', function (e) { if (moved || longFired) e.preventDefault(); });

    return function detach() {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', cancel);
      el.removeEventListener('lostpointercapture', cancel);
    };
  }

  var api = { attach: attach, SWIPE_MIN: SWIPE_MIN };

  global.Flash = global.Flash || {};
  global.Flash.gesture = api;
})(typeof window !== 'undefined' ? window : globalThis);
