/**
 * Third-Party Ad Server Runtime Emulator (e.g. Sizmek / Flashtalking / Adform Tag)
 * Simulates third-party client-side ad environment loading, click tracking,
 * and lifecycle events.
 */
(function(window) {
  'use strict';

  var AdLoader = {
    version: '3.4.1',
    isLoaded: false,
    initialized: false,
    callbacks: [],

    onReady: function(callback) {
      if (this.isLoaded) {
        callback();
      } else {
        this.callbacks.push(callback);
      }
    },

    init: function() {
      if (this.initialized) return;
      this.initialized = true;

      // Simulate runtime setup
      window.__adRuntime = {
        platform: 'MockAdServer',
        clickTag: 'https://example.com/click-nexus',
        impressionsLogged: 1
      };

      var self = this;
      function finishLoading() {
        self.isLoaded = true;
        // Dispatch standard ad lifecycle events
        window.dispatchEvent(new CustomEvent('AdLoaded', { detail: { format: '300x250' } }));
        window.dispatchEvent(new CustomEvent('adInitialized'));

        for (var i = 0; i < self.callbacks.length; i++) {
          try {
            self.callbacks[i]();
          } catch (e) {
            console.error('Error in AdLoader callback:', e);
          }
        }
      }

      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(finishLoading, 10);
      } else {
        window.addEventListener('DOMContentLoaded', finishLoading);
        window.addEventListener('load', finishLoading);
      }
    }
  };

  window.AdServerLoader = AdLoader;
  AdLoader.init();
})(window);
