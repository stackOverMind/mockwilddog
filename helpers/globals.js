;(function (window) {
  'use strict';
  if (typeof window !== 'undefined' && window.mockwilddog) {
    window.MockWilddog = window.mockwilddog.MockWilddog;
    window.MockWilddogSimpleLogin = window.mockwilddog.MockWilddogSimpleLogin;

    var originals = false;
    window.MockWilddog.override = function () {
      originals = {
        wilddog: window.Wilddog,
      };
      window.Wilddog = window.mockwilddog.MockWilddog;
    };
    window.MockWilddog.restore = function () {
      if (!originals) return;
      window.Wilddog = originals.wilddog;
    };
  }
})(window);
