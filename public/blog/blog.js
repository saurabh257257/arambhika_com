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
    return '<a class="blog-product" href="/?product=' + encodeURIComponent(p.ProductCode) + '#catalog">' +
      '<div class="blog-product-img">' + (img ? '<img src="' + esc(img) + '" alt="' + esc(p.ProductCode) + '" loading="lazy" />' : '') + '</div>' +
      '<div class="blog-product-body"><h3>' + esc(p.ProductCode) + '</h3>' +
      '<p class="blog-product-price">' + esc(price) + '</p>' +
      '<span class="blog-stock ' + (notify ? 'is-out' : 'is-in') + '">' + (notify ? 'Out of stock · Notify me' : 'In stock') + '</span></div></a>';
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
