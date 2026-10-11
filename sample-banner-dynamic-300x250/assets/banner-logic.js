/**
 * Creative Logic and Interactivity
 */
(function() {
  'use strict';

  function setupBanner() {
    var stage = document.getElementById('ad-stage');
    var cta = document.querySelector('.cta-btn');
    var isi = document.getElementById('safety-scroll-pane');

    if (stage) {
      stage.style.visibility = 'visible';
    }

    if (cta) {
      cta.addEventListener('click', function(e) {
        e.stopPropagation();
        var url = window.__adRuntime ? window.__adRuntime.clickTag : 'https://example.com';
        window.open(url, '_blank');
      });
    }

    // Mark as ready
    document.body.setAttribute('data-ad-ready', 'true');
  }

  if (window.AdServerLoader) {
    window.AdServerLoader.onReady(setupBanner);
  } else {
    window.addEventListener('DOMContentLoaded', setupBanner);
  }
})();
