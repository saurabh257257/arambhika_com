(function () {
  'use strict';
  // on a phone the filters fold away until asked for, so the products come first (they stay open when no script runs)
  var d = document.getElementById('fwrap');
  if (d && window.matchMedia('(max-width: 860px)').matches) d.open = false;
})();
