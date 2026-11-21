(function () {
  'use strict';
  var main = document.getElementById('mainimg');
  if (!main) return;
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('.th') : null;
    if (!b) return;
    main.src = b.getAttribute('data-src');
    [].forEach.call(document.querySelectorAll('.th'), function (x) { x.classList.toggle('on', x === b); });
  });
})();
