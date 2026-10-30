// Small SVG charts for the Dashboard: lines, grouped bars and horizontal bars, each with a legend, a hover tooltip and a table view.
// Colours follow the dataviz palette (blue, orange, aqua in a fixed order per person) so a person keeps their colour everywhere.
(function () {
  'use strict';
  var P = window.Panel, esc = P.esc;
  var SERIES = ['#2a78d6', '#eb6834', '#1baf7a'], INK = '#1f2937', MUTED = '#64748b', GRID = '#e2e8f0';
  var uid = 0, tip;

  function tooltip(html, x, y) {
    if (!tip) { tip = document.createElement('div'); tip.className = 'ctip'; document.body.appendChild(tip); }
    if (html === null) { tip.style.display = 'none'; return; }
    tip.innerHTML = html; tip.style.display = 'block';
    var w = tip.offsetWidth; tip.style.left = Math.min(Math.max(8, x + 14), window.innerWidth - w - 8) + 'px'; tip.style.top = Math.max(8, y - tip.offsetHeight - 10) + 'px';
  }
  function legend(items) {
    return '<div class="clegend">' + items.map(function (s) { return '<span><i style="background:' + s.color + '"></i>' + esc(s.name) + '</span>'; }).join('') + '</div>';
  }
  function table(head, rows) {
    return '<table class="table ctable"><thead><tr>' + head.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
  }
  // a chart card: a title, a one-line reading, the chart, and a switch between chart and table
  function card(o) {
    var id = 'c' + (++uid);
    return '<div class="card chartcard" id="' + id + '"><div class="between"><div><h3>' + esc(o.title) + '</h3><div class="muted small">' + esc(o.sub || '') + '</div></div><button class="btn ghost sm" type="button" data-ctable>Table</button></div>' +
      (o.legend || '') + '<div class="cview">' + o.svg + '</div><div class="cview" hidden>' + o.table + '</div></div>';
  }
  function axisY(ticks, x0, x1, y, fmt) {
    return ticks.map(function (t) { return '<line x1="' + x0 + '" x2="' + x1 + '" y1="' + y(t) + '" y2="' + y(t) + '" stroke="' + GRID + '" stroke-width="1"/><text x="' + (x0 - 6) + '" y="' + (y(t) + 4) + '" text-anchor="end" font-size="11" fill="' + MUTED + '">' + fmt(t) + '</text>'; }).join('');
  }

  P.charts = {
    colors: SERIES,
    // one line per person across days; values 0 to 100, null = nothing assigned that day
    lines: function (o) {
      var W = 640, H = 230, l = 34, r = 12, t = 12, b = 26, n = o.labels.length;
      var x = function (i) { return l + (W - l - r) * (n === 1 ? 0.5 : i / (n - 1)); }, y = function (v) { return t + (H - t - b) * (1 - v / 100); };
      var s = axisY([0, 25, 50, 75, 100], l, W - r, y, function (v) { return v + '%'; });
      var any = o.series.some(function (se) { return se.values.some(function (v) { return v !== null; }); });
      if (!any) s += '<text x="' + (W / 2) + '" y="' + (H / 2) + '" text-anchor="middle" font-size="13" fill="' + MUTED + '">No daily tasks were assigned in these 14 days</text>';
      s += o.labels.map(function (d, i) { return i % 2 === (n - 1) % 2 ? '<text x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="11" fill="' + MUTED + '">' + esc(d.slice(8) + '/' + d.slice(5, 7)) + '</text>' : ''; }).join('');
      o.series.forEach(function (se, k) {
        var col = SERIES[k % 3], path = '', pen = false;
        se.values.forEach(function (v, i) { if (v === null) { pen = false; return; } path += (pen ? 'L' : 'M') + x(i) + ' ' + y(v); pen = true; });
        s += '<path d="' + path + '" fill="none" stroke="' + col + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
        se.values.forEach(function (v, i) { if (v !== null) s += '<circle cx="' + x(i) + '" cy="' + y(v) + '" r="3.5" fill="' + col + '" stroke="#fff" stroke-width="2"/>'; });
      });
      s += '<line class="cross" y1="' + t + '" y2="' + (H - b) + '" stroke="' + MUTED + '" stroke-dasharray="3 3" style="display:none"/>';
      var svg = '<svg class="csvg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.title) + '" data-lines>' + s + '</svg>';
      var html = card({ title: o.title, sub: o.sub, svg: svg, legend: legend(o.series.map(function (se, k) { return { name: se.name, color: SERIES[k % 3] }; })),
        table: table(['Day'].concat(o.series.map(function (se) { return se.name; })), o.labels.map(function (d, i) { return [P.fmtDate(d)].concat(o.series.map(function (se) { return se.values[i] === null ? 'no tasks' : se.values[i] + '%'; })); })) });
      return { html: html, wire: function (el) {
        var svgEl = el.querySelector('[data-lines]'), cross = svgEl.querySelector('.cross');
        svgEl.addEventListener('mousemove', function (e) {
          var box = svgEl.getBoundingClientRect(), px = (e.clientX - box.left) / box.width * W;
          var i = Math.max(0, Math.min(n - 1, Math.round((px - l) / ((W - l - r) / Math.max(n - 1, 1)))));
          cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.style.display = '';
          tooltip('<b>' + esc(P.fmtDate(o.labels[i])) + '</b>' + o.series.map(function (se, k) { return '<div><i style="background:' + SERIES[k % 3] + '"></i>' + esc(se.name) + ': ' + (se.values[i] === null ? 'no tasks' : se.values[i] + '%') + '</div>'; }).join(''), e.clientX, e.clientY);
        });
        svgEl.addEventListener('mouseleave', function () { cross.style.display = 'none'; tooltip(null); });
      } };
    },
    // bars per month, one per person; a dashed line in the person's colour is their target
    groups: function (o) {
      var W = 640, H = 230, l = 34, r = 12, t = 14, b = 26, n = o.labels.length, k = o.series.length || 1;
      var max = Math.max(1, Math.max.apply(null, o.series.map(function (se) { return Math.max.apply(null, se.values.concat([se.target || 0])); })));
      max = Math.ceil(max / 2) * 2; if (max < 4) max = 4;
      var y = function (v) { return t + (H - t - b) * (1 - v / max); }, gw = (W - l - r) / n, bw = Math.min(26, (gw - 14) / k);
      var s = axisY([0, max / 2, max], l, W - r, y, function (v) { return v; });
      o.labels.forEach(function (m, i) {
        s += '<text x="' + (l + gw * (i + 0.5)) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="11" fill="' + MUTED + '">' + esc(m) + '</text>';
        o.series.forEach(function (se, j) {
          var bx = l + gw * i + (gw - bw * k - 2 * (k - 1)) / 2 + j * (bw + 2), h = y(0) - y(se.values[i]);
          s += '<g data-bar="' + i + ',' + j + '"><rect x="' + bx + '" y="' + (y(0) - Math.max(h, 0)) + '" width="' + bw + '" height="' + Math.max(h, 0) + '" rx="3" fill="' + SERIES[j % 3] + '"/><rect x="' + (bx - 2) + '" y="' + t + '" width="' + (bw + 4) + '" height="' + (H - t - b) + '" fill="transparent"/></g>';
          if (se.values[i] > 0) s += '<text x="' + (bx + bw / 2) + '" y="' + (y(se.values[i]) - 4) + '" text-anchor="middle" font-size="11" font-weight="600" fill="' + INK + '">' + se.values[i] + '</text>';
        });
      });
      o.series.forEach(function (se, j) { if (se.target) s += '<line x1="' + l + '" x2="' + (W - r) + '" y1="' + y(se.target) + '" y2="' + y(se.target) + '" stroke="' + SERIES[j % 3] + '" stroke-width="1.5" stroke-dasharray="5 4"/>'; });
      var svg = '<svg class="csvg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.title) + '" data-groups>' + s + '</svg>';
      var html = card({ title: o.title, sub: o.sub, svg: svg, legend: legend(o.series.map(function (se, j) { return { name: se.name + (se.target ? ' (target ' + se.target + ', dashed)' : ''), color: SERIES[j % 3] }; })),
        table: table(['Month'].concat(o.series.map(function (se) { return se.name; })), o.labels.map(function (m, i) { return [m].concat(o.series.map(function (se) { return String(se.values[i]); })); })) });
      return { html: html, wire: function (el) {
        var svgEl = el.querySelector('[data-groups]');
        svgEl.addEventListener('mousemove', function (e) {
          var g = e.target.closest('[data-bar]'); if (!g) { tooltip(null); return; }
          var p = g.dataset.bar.split(','), se = o.series[+p[1]];
          tooltip('<b>' + esc(o.labels[+p[0]]) + '</b><div><i style="background:' + SERIES[+p[1] % 3] + '"></i>' + esc(se.name) + ': ' + se.values[+p[0]] + ' new customer' + (se.values[+p[0]] === 1 ? '' : 's') + (se.target ? ' (target ' + se.target + ')' : '') + '</div>', e.clientX, e.clientY);
        });
        svgEl.addEventListener('mouseleave', function () { tooltip(null); });
      } };
    },
    // horizontal bars with the label above each bar: rows = [{ label, value, note, color, text, cells }]
    hbars: function (o) {
      var W = 640, rowH = 46, H = o.rows.length * rowH + 4, l = 4, max = Math.max(1, Math.max.apply(null, o.rows.map(function (r) { return r.value; })));
      var s = o.rows.map(function (r, i) {
        var y0 = i * rowH + 2, bw = Math.max(r.value ? 4 : 0, (W - 150) * r.value / max);
        return '<g data-row="' + i + '"><text x="' + l + '" y="' + (y0 + 13) + '" font-size="12" fill="' + INK + '">' + esc(r.label) + '</text><rect x="' + l + '" y="' + (y0 + 20) + '" width="' + bw + '" height="16" rx="4" fill="' + (r.color || SERIES[0]) + '"/>' +
          '<text x="' + (l + bw + 8) + '" y="' + (y0 + 33) + '" font-size="12" font-weight="600" fill="' + INK + '">' + esc(r.text) + '</text><rect x="0" y="' + y0 + '" width="' + W + '" height="' + (rowH - 4) + '" fill="transparent"/></g>';
      }).join('');
      var svg = '<svg class="csvg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.title) + '" data-hbars>' + s + '</svg>';
      var html = card({ title: o.title, sub: o.sub, svg: svg, table: table(o.head, o.rows.map(function (r) { return r.cells; })) });
      return { html: html, wire: function (el) {
        var svgEl = el.querySelector('[data-hbars]');
        svgEl.addEventListener('mousemove', function (e) { var g = e.target.closest('[data-row]'); if (!g) { tooltip(null); return; } var r = o.rows[+g.dataset.row]; tooltip('<b>' + esc(r.label) + '</b><div>' + esc(r.note || r.text) + '</div>', e.clientX, e.clientY); });
        svgEl.addEventListener('mouseleave', function () { tooltip(null); });
      } };
    },
    // the Chart / Table switch on every chart card
    wireSwitch: function (el) {
      el.addEventListener('click', function (e) {
        var b = e.target.closest('[data-ctable]'); if (!b) return;
        var views = b.closest('.chartcard').querySelectorAll('.cview'), showTable = views[0].hidden === false;
        views[0].hidden = showTable; views[1].hidden = !showTable; b.textContent = showTable ? 'Chart' : 'Table';
      });
    },
  };
})();
