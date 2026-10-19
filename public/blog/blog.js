// FAQ rows: question, one line of the answer, "Show more"; also the search box on /faq.html.
(function () {
  function fit() {
    document.querySelectorAll('.faq-item').forEach(function (item) {
      var a = item.querySelector('.faq-a'), btn = item.querySelector('.faq-more');
      if (!a || !btn || item.classList.contains('open')) return;
      btn.hidden = a.scrollWidth <= a.clientWidth + 1;
    });
  }
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.faq-more');
    var q = e.target.closest && e.target.closest('.faq-q');
    var item = (btn || q) && (btn || q).closest('.faq-item');
    if (!item) return;
    var open = item.classList.toggle('open');
    var b2 = item.querySelector('.faq-more');
    if (b2) { b2.hidden = false; b2.textContent = open ? 'Show less' : 'Show more'; b2.setAttribute('aria-expanded', open ? 'true' : 'false'); }
  });
  var search = document.getElementById('faqSearch');
  if (search) {
    search.addEventListener('input', function () {
      var term = search.value.trim().toLowerCase(), shown = 0;
      document.querySelectorAll('.faq-item').forEach(function (item) {
        var hit = !term || item.textContent.toLowerCase().indexOf(term) !== -1;
        item.style.display = hit ? '' : 'none';
        if (hit) shown++;
      });
      document.querySelectorAll('.faq-group').forEach(function (g) {
        var any = Array.prototype.some.call(g.querySelectorAll('.faq-item'), function (i) { return i.style.display !== 'none'; });
        g.style.display = any ? '' : 'none';
      });
      var empty = document.getElementById('faqEmpty');
      if (empty) empty.hidden = shown > 0;
    });
  }
  fit();
  window.addEventListener('load', fit);
  window.addEventListener('resize', fit);
})();

// Renders the live product tiles on each blog page from the store's /products.json.
(function () {
  var section = document.querySelector('.blog-products');
  var grid = document.getElementById('blogProductGrid');
  if (!section || !grid) return;

  var category = section.getAttribute('data-category');
  var limit = Number(section.getAttribute('data-limit')) || 8;

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function tile(p) {
    var img = p.Image_Link && p.Image_Link[0];
    var notify = String(p.Availability).toLowerCase() === 'notify';
    var price = p.Price ? '₹' + Number(p.Price).toLocaleString('en-IN') + '/' + (p.Unit || 'KG') : 'Price on request';
    return '<a class="blog-product" href="/product/' + String(p.ProductCode).toLowerCase().trim().replace(/\s+/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') + '">' +
      '<div class="blog-product-img">' + (img ? '<img src="' + esc(img) + '" alt="' + esc(p.ProductCode) + '" loading="lazy" />' : '') + '</div>' +
      '<div class="blog-product-body"><h3>' + esc(p.ProductCode) + '</h3>' +
      '<p class="blog-product-price">' + esc(price) + '</p>' +
      '<span class="blog-stock ' + (notify ? 'is-out' : 'is-in') + '">' + (notify ? 'Available on request' : 'In stock') + '</span></div></a>';
  }

  fetch('/products.json')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      // data-category may list several categories, separated by commas; share the limit between them.
      var wanted = category.split(',').map(function (s) { return s.trim(); });
      var each = Math.ceil(limit / wanted.length);
      var items = [];
      wanted.forEach(function (name) {
        var cat = (data.categories || []).filter(function (c) { return c.name === name; })[0];
        if (cat) items = items.concat(cat.products.slice(0, each));
      });
      grid.innerHTML = items.length ? items.map(tile).join('') : '<p>Browse all sizes in our <a href="/#catalog">product store</a>.</p>';
    })
    .catch(function () {
      grid.innerHTML = '<p>Browse all sizes in our <a href="/#catalog">product store</a>.</p>';
    });
})();
