/**
 * platform.js · 平台适配层
 * 网页端用 localStorage；转微信小游戏时只把 storageBackend 的四个方法换成
 * wx.getStorageSync / wx.setStorageSync / wx.removeStorageSync / wx.clearStorageSync，上层代码不动。
 */
window.EM = window.EM || {};
window.EM.Platform = (function () {
  'use strict';

  var STORAGE_KEY = 'engl_match_v1';
  var KEY_PREFIX = 'engl_match_';
  var memory = {};

  // 探测 localStorage 是否可用（隐私模式、被禁用时会抛错）
  var hasLocalStorage = (function () {
    try {
      var probe = '__em_probe__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return true;
    } catch (err) {
      return false;
    }
  })();

  // 存储后端：小游戏版替换这四个方法即可
  var storageBackend = {
    get: function (key) {
      if (hasLocalStorage) return window.localStorage.getItem(key);
      return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
    },
    set: function (key, value) {
      if (hasLocalStorage) {
        window.localStorage.setItem(key, value);
        return;
      }
      memory[key] = value;
    },
    remove: function (key) {
      if (hasLocalStorage) {
        window.localStorage.removeItem(key);
        return;
      }
      delete memory[key];
    },
    keys: function () {
      if (hasLocalStorage) return Object.keys(window.localStorage);
      return Object.keys(memory);
    }
  };

  // 生成指定位数的十六进制随机串
  function randomHex(length) {
    var chars = '0123456789abcdef';
    var pool = null;
    var out = '';
    if (window.crypto && window.crypto.getRandomValues) {
      pool = new Uint8Array(length);
      window.crypto.getRandomValues(pool);
    }
    for (var i = 0; i < length; i++) {
      var n = pool ? pool[i] % 16 : Math.floor(Math.random() * 16);
      out += chars.charAt(n);
    }
    return out;
  }

  // 生成匿名设备号，格式 anon-xxxxxxxx
  function createDeviceId() {
    return 'anon-' + randomHex(8);
  }

  // 读取整份档案；数据缺失或损坏时返回 null
  function load() {
    var raw = storageBackend.get(STORAGE_KEY);
    if (!raw) return null;
    try {
      var data = JSON.parse(raw);
      return data && typeof data === 'object' ? data : null;
    } catch (err) {
      return null;
    }
  }

  // 覆盖保存整份档案
  function save(data) {
    try {
      storageBackend.set(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (err) {
      return false;
    }
  }

  // 清空本项目在本机的全部数据，不碰同域其他数据
  function clear() {
    var keys = storageBackend.keys();
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].indexOf(KEY_PREFIX) === 0) storageBackend.remove(keys[i]);
    }
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    load: load,
    save: save,
    clear: clear,
    createDeviceId: createDeviceId,
    isPersistent: function () {
      return hasLocalStorage;
    }
  };
})();
