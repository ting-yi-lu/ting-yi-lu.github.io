// Ionized-bubble probability calculator.
// Data: window.BUBBLE_DATA, histograms of bubble radius (mean-free-path method) from Lu et al. (2024).
(function () {
  'use strict';
  var D = window.BUBBLE_DATA;
  if (!D) return;
  var NB = D.nb, R0 = D.r0, FAC = D.f;
  var NAVY = '#1d2b6b', NAVY2 = '#8a93c4', GREY = '#9b9b9b', GRID = '#ececec', INK = '#333';

  // ---------- data helpers ----------
  function expand(t) {               // trimmed [start, c...] -> full array of length NB
    var a = new Array(NB).fill(0);
    if (!t || !t.length) return a;
    for (var i = 1; i < t.length; i++) a[t[0] + i - 1] = t[i];
    return a;
  }
  var cache = {};
  function hist(model, z, ix, tracer, param) {
    var key = [model, z, ix, tracer, param].join('|');
    if (cache[key]) return cache[key];
    var s = D.sets[model][z][ix], h;
    if (tracer === 'rand') h = expand(s.rand);
    else if (tracer === 'muv') h = expand(s.muv[String(param)]);
    else {                           // overdensity: fields with at least `param` galaxies
      h = new Array(NB).fill(0);
      for (var n = param; n < s.od.length; n++) {
        var e = expand(s.od[n]);
        for (var b = 0; b < NB; b++) h[b] += e[b];
      }
    }
    return (cache[key] = h);
  }
  var radius = function (b) { return R0 * Math.pow(FAC, b - 1); };   // cMpc, bin b >= 1
  function prob(h, rminC) {          // P(R >= rmin), counts
    var N = 0, n = 0;
    for (var b = 0; b < NB; b++) {
      N += h[b];
      if (b >= 1 && radius(b) >= rminC * (1 - 1e-6)) n += h[b];
    }
    return { N: N, n: n, p: N ? n / N : NaN, f0: N ? h[0] / N : NaN };
  }

  // ---------- state & controls ----------
  var $ = function (id) { return document.getElementById(id); };
  var form = $('form');
  function radio(name) { return form.querySelector('input[name="' + name + '"]:checked').value; }
  function state() {
    return {
      model: radio('model'), z: radio('z'), ix: +$('xhi').value, tracer: radio('tracer'),
      muv: +$('muv').value, nmin: +$('od').value + 1, lr: +$('rmin').value
    };
  }
  var MODEL_NAME = { fg: 'gradual', bg: 'rapid' };

  // ---------- formatting ----------
  function pct(p) {
    if (!(p > 0)) return '0%';
    var v = p * 100;
    if (v >= 99.5) return v >= 99.95 ? '> 99.9%' : v.toFixed(1) + '%';
    if (v >= 10) return Math.round(v) + '%';
    if (v >= 1) return v.toFixed(1) + '%';
    if (v >= 0.1) return v.toFixed(2) + '%';
    return v.toPrecision(2) + '%';
  }
  function fmtR(x) { return x >= 10 ? x.toFixed(0) : x >= 1 ? x.toFixed(1) : x.toFixed(2); }
  function nfmt(n) { return n.toLocaleString('en-US'); }
  function minus(s) { return String(s).replace('-', '−'); }

  // ---------- main update ----------
  function update() {
    var s = state(), set = D.sets[s.model][s.z][s.ix], zf = +s.z;
    var rminP = Math.pow(10, s.lr), rminC = rminP * (1 + zf);
    var param = s.tracer === 'muv' ? s.muv : s.tracer === 'od' ? s.nmin : null;

    $('opt-muv').hidden = s.tracer !== 'muv';
    $('opt-od').hidden = s.tracer !== 'od';
    $('xhio').textContent = set.x.toFixed(2);
    $('muvo').textContent = minus(s.muv);
    $('odo').textContent = (s.nmin / set.mN).toFixed(1) + (s.nmin >= set.od.length - 1 ? '+' : '');
    $('odhint').innerHTML = 'At least ' + s.nmin + (s.nmin >= set.od.length - 1 ? '' : '') + ' galaxies with M<sub>UV</sub> ≤ −19 in the field, where ⟨N⟩ = ' + set.mN.toFixed(2) + ' at z = ' + zf + '.';
    $('rmino').textContent = fmtR(rminP) + ' pMpc';
    $('rminhint').textContent = '= ' + fmtR(rminC) + ' comoving Mpc at z = ' + zf + '.';

    var h = hist(s.model, s.z, s.ix, s.tracer, param);
    var hr = hist(s.model, s.z, s.ix, 'rand', null);
    var P = prob(h, rminC), Pr = prob(hr, rminC);

    var what = s.tracer === 'muv' ? 'an M<sub>UV</sub> = ' + minus(s.muv) + ' galaxy'
      : s.tracer === 'od' ? 'a field with N/⟨N⟩ ≥ ' + (s.nmin / set.mN).toFixed(1) + ' (at least ' + s.nmin + ' galaxies with M<sub>UV</sub> ≤ −19)'
      : 'a random position';
    $('question').innerHTML = 'Probability that ' + what + ' at z = ' + zf + ' sits in an ionized bubble with R ≥ ' + fmtR(rminP) +
      ' pMpc, when x<sub>HI</sub> = ' + set.x.toFixed(2) + ' in the ' + MODEL_NAME[s.model] + ' model';

    var unit = s.tracer === 'muv' ? 'galaxies' : s.tracer === 'od' ? 'fields' : 'random positions';
    if (P.N === 0) {
      $('pbig').textContent = '—';
      $('prow').innerHTML = '';
      $('psmall').textContent = 'No simulated ' + unit + ' of this kind at this redshift and neutral fraction.';
    } else {
      var small = P.N < 300;
      if (P.n === 0) $('pbig').textContent = '< ' + pct(3 / P.N);
      else $('pbig').textContent = pct(P.p);
      var row = '';
      if (s.tracer !== 'rand') {
        row += '<span>Random position: <b>' + (Pr.n ? pct(Pr.p) : '< ' + pct(3 / Pr.N)) + '</b></span>';
        if (P.n && Pr.n) row += '<span>Enhancement: <b>×' + (P.p / Pr.p >= 10 ? Math.round(P.p / Pr.p) : (P.p / Pr.p).toFixed(1)) + '</b></span>';
        else if (P.n && !Pr.n) row += '<span>Enhancement: <b>> ×' + Math.floor(P.p / (3 / Pr.N)) + '</b></span>';
      }
      row += '<span>In neutral gas (R = 0): <b>' + pct(P.f0) + '</b></span>';
      $('prow').innerHTML = row;
      $('psmall').innerHTML = 'From ' + nfmt(P.N) + ' simulated ' + unit + ' (' + nfmt(P.n) + ' in such bubbles)' +
        (P.n === 0 ? '. None of them is, so the value is a 95% upper limit.' : '.') +
        (small ? ' The sample is small, so treat the value as approximate.' : '');
    }
    chartX(s, param, rminC);
    chartBSD(h, hr, s, rminC);
  }

  // ---------- SVG helpers ----------
  var W = 360, H = 280, L = 50, R = 12, T = 12, B = 44;
  function el(tag, attrs, text) {
    var s = '<' + tag;
    for (var k in attrs) s += ' ' + k + '="' + attrs[k] + '"';
    return text == null ? s + '/>' : s + '>' + text + '</' + tag + '>';
  }
  function logTicks(a, b) { var t = []; for (var e = Math.ceil(a - 1e-9); e <= Math.floor(b + 1e-9); e++) t.push(e); return t; }
  function powLabel(e) {
    if (e === 0) return '1'; if (e === 1) return '10'; if (e === 2) return '100';
    if (e === -1) return '0.1'; if (e === -2) return '0.01';
    return '10<tspan dy="-6" font-size="9">' + minus(e) + '</tspan>';
  }
  function legend(id, items) {
    $(id).innerHTML = items.map(function (it) {
      return '<span><i style="border-top-color:' + it.c + ';border-top-style:' + (it.d ? 'dashed' : 'solid') + '"></i>' + it.t + '</span>';
    }).join('');
  }

  // ---------- chart 1: P(R >= rmin) against x_HI ----------
  function chartX(s, param, rminC) {
    var other = s.model === 'fg' ? 'bg' : 'fg';
    var series = [];
    function curve(model, tracer, prm) {
      return D.sets[model][s.z].map(function (set, i) {
        var P = prob(hist(model, s.z, i, tracer, prm), rminC);
        return { x: set.x, p: P.p, N: P.N, n: P.n };
      });
    }
    if (s.tracer !== 'rand') {
      series.push({ pts: curve(s.model, s.tracer, param), c: NAVY, d: false, w: 2.6, t: (s.tracer === 'muv' ? 'M<sub>UV</sub> = ' + minus(s.muv) : 'N/⟨N⟩ ≥ ' + (s.nmin / D.sets[s.model][s.z][s.ix].mN).toFixed(1)) + ', ' + MODEL_NAME[s.model] });
      series.push({ pts: curve(other, s.tracer, param), c: NAVY2, d: true, w: 2, t: MODEL_NAME[other] + ' model' });
      series.push({ pts: curve(s.model, 'rand', null), c: GREY, d: false, w: 2, t: 'random positions' });
    } else {
      series.push({ pts: curve(s.model, 'rand', null), c: NAVY, d: false, w: 2.6, t: 'random positions, ' + MODEL_NAME[s.model] });
      series.push({ pts: curve(other, 'rand', null), c: NAVY2, d: true, w: 2, t: MODEL_NAME[other] + ' model' });
    }
    var lo = 0;
    series.forEach(function (sr) { sr.pts.forEach(function (q) { if (q.n > 0) lo = Math.min(lo, Math.log10(q.p)); }); });
    var ya = Math.max(-5, Math.floor(lo - 0.15)), yb = 0;
    if (ya > -1) ya = -1;
    var xs = function (x) { return L + x * (W - L - R); };
    var ys = function (lp) { return T + (yb - lp) / (yb - ya) * (H - T - B); };
    var g = '';
    logTicks(ya, yb).forEach(function (e) {
      var y = ys(e).toFixed(1);
      g += el('line', { x1: L, x2: W - R, y1: y, y2: y, stroke: GRID });
      g += el('text', { x: L - 6, y: +y + 4, 'text-anchor': 'end', 'font-size': 12, fill: '#666' }, powLabel(e));
    });
    [0, 0.2, 0.4, 0.6, 0.8, 1].forEach(function (x) {
      g += el('line', { x1: xs(x), x2: xs(x), y1: H - B, y2: H - B + 4, stroke: '#999' });
      g += el('text', { x: xs(x), y: H - B + 16, 'text-anchor': 'middle', 'font-size': 12, fill: '#666' }, x.toFixed(1));
    });
    g += el('rect', { x: L, y: T, width: W - L - R, height: H - T - B, fill: 'none', stroke: '#cfcfcf' });
    var cx = xs(D.sets[s.model][s.z][s.ix].x);
    g += el('line', { x1: cx, x2: cx, y1: T, y2: H - B, stroke: NAVY, 'stroke-opacity': 0.25, 'stroke-width': 6 });
    series.slice().reverse().forEach(function (sr) {
      var d = '', pen = false;
      sr.pts.forEach(function (q) {
        if (q.n > 0) { d += (pen ? 'L' : 'M') + xs(q.x).toFixed(1) + ' ' + ys(Math.log10(q.p)).toFixed(1); pen = true; }
        else pen = false;
      });
      g += el('path', { d: d, fill: 'none', stroke: sr.c, 'stroke-width': sr.w, 'stroke-dasharray': sr.d ? '6 4' : 'none', 'stroke-linejoin': 'round' });
      sr.pts.forEach(function (q) {
        if (q.n > 0) g += el('circle', { cx: xs(q.x).toFixed(1), cy: ys(Math.log10(q.p)).toFixed(1), r: 2.6, fill: sr.c });
        else if (q.N > 0) {   // upper limit marker
          var yy = ys(Math.max(ya, Math.log10(3 / q.N)));
          g += el('path', { d: 'M' + (xs(q.x) - 4).toFixed(1) + ' ' + (yy - 3).toFixed(1) + 'h8l-4 7z', fill: 'none', stroke: sr.c, 'stroke-width': 1.3 });
        }
      });
    });
    g += el('text', { x: (L + W - R) / 2, y: H - 8, 'text-anchor': 'middle', 'font-size': 13.5, fill: INK }, 'IGM neutral fraction x<tspan dy="3" font-size="9">HI</tspan>');
    g += el('text', { transform: 'translate(13,' + ((T + H - B) / 2) + ') rotate(-90)', 'text-anchor': 'middle', 'font-size': 13.5, fill: INK }, 'P(R ≥ ' + fmtR(rminC / (1 + +s.z)) + ' pMpc)');
    $('c1').innerHTML = g;
    var items = series.map(function (sr) { return { c: sr.c, d: sr.d, t: sr.t }; });
    var hasLim = series.some(function (sr) { return sr.pts.some(function (q) { return q.n === 0 && q.N > 0; }); });
    if (hasLim) items.push({ c: 'transparent', t: '<span style="color:#888">▽ upper limit (none of the sample)</span>' });
    legend('l1', items);
  }

  // ---------- chart 2: bubble size distribution ----------
  function chartBSD(h, hr, s, rminC) {
    var REB = 3, dlog = REB * Math.log10(FAC);
    function dist(hh) {
      var N = 0; for (var b = 0; b < NB; b++) N += hh[b];
      var pts = [];
      for (var b0 = 1; b0 < NB; b0 += REB) {
        var c = 0; for (var k = b0; k < b0 + REB && k < NB; k++) c += hh[k];
        var rc = R0 * Math.pow(FAC, b0 - 1 + (REB - 1) / 2);
        pts.push({ r: rc, y: N ? c / N / dlog : 0, c: c });
      }
      return { N: N, pts: pts, f0: N ? hh[0] / N : 0 };
    }
    var A = s.tracer === 'rand' ? null : dist(h), Rd = dist(hr);
    var xa = Math.log10(0.5), xb = Math.log10(400);
    var top = -9, all = (A ? A.pts : []).concat(Rd.pts);
    all.forEach(function (q) { if (q.y > 0) top = Math.max(top, Math.log10(q.y)); });
    var yb = Math.ceil(top + 0.05), ya = yb - 4;
    var xs = function (lr) { return L + (lr - xa) / (xb - xa) * (W - L - R); };
    var ys = function (ly) { return T + (yb - ly) / (yb - ya) * (H - T - B); };
    var g = '';
    var xr = xs(Math.log10(rminC));
    if (xr < W - R) g += el('rect', { x: Math.max(L, xr).toFixed(1), y: T, width: (W - R - Math.max(L, xr)).toFixed(1), height: H - T - B, fill: '#e9ecf7' });
    logTicks(ya, yb).forEach(function (e) {
      var y = ys(e).toFixed(1);
      g += el('line', { x1: L, x2: W - R, y1: y, y2: y, stroke: GRID });
      g += el('text', { x: L - 6, y: +y + 4, 'text-anchor': 'end', 'font-size': 12, fill: '#666' }, powLabel(e));
    });
    [0, 1, 2].forEach(function (e) {
      g += el('line', { x1: xs(e), x2: xs(e), y1: H - B, y2: H - B + 4, stroke: '#999' });
      g += el('text', { x: xs(e), y: H - B + 16, 'text-anchor': 'middle', 'font-size': 12, fill: '#666' }, powLabel(e));
      for (var m = 2; m < 10; m++) { var lx = e + Math.log10(m); if (lx < xb && lx > xa) g += el('line', { x1: xs(lx), x2: xs(lx), y1: H - B, y2: H - B + 2.5, stroke: '#bbb' }); }
    });
    if (xs(-1) < L) {} // 0.1 is off the axis
    g += el('rect', { x: L, y: T, width: W - L - R, height: H - T - B, fill: 'none', stroke: '#cfcfcf' });
    if (xr > L && xr < W - R) {
      g += el('line', { x1: xr, x2: xr, y1: T, y2: H - B, stroke: NAVY, 'stroke-width': 1.2, 'stroke-dasharray': '3 3' });
      g += el('text', { x: xr + 4, y: T + 13, 'font-size': 12, fill: NAVY }, 'R ≥ ' + fmtR(rminC / (1 + +s.z)) + ' pMpc');
    }
    function line(dd, c, w, dash) {
      var d = '', pen = false;
      dd.pts.forEach(function (q) {
        if (q.y > 0 && Math.log10(q.y) >= ya - 0.3) { d += (pen ? 'L' : 'M') + xs(Math.log10(q.r)).toFixed(1) + ' ' + ys(Math.max(ya, Math.log10(q.y))).toFixed(1); pen = true; }
        else pen = false;
      });
      return el('path', { d: d, fill: 'none', stroke: c, 'stroke-width': w, 'stroke-dasharray': dash || 'none', 'stroke-linejoin': 'round' });
    }
    g += line(Rd, GREY, 2);
    if (A) g += line(A, NAVY, 2.6);
    g += el('text', { x: (L + W - R) / 2, y: H - 8, 'text-anchor': 'middle', 'font-size': 13.5, fill: INK }, 'Bubble radius R (comoving Mpc)');
    g += el('text', { transform: 'translate(13,' + ((T + H - B) / 2) + ') rotate(-90)', 'text-anchor': 'middle', 'font-size': 13.5, fill: INK }, 'dP / dlog R');
    $('c2').innerHTML = g;
    var items = [];
    if (A) items.push({ c: NAVY, t: (s.tracer === 'muv' ? 'M<sub>UV</sub> = ' + minus(s.muv) + ' galaxies' : 'overdense fields') + ' (' + pct(A.f0) + ' at R = 0)' });
    items.push({ c: GREY, t: 'random positions (' + pct(Rd.f0) + ' at R = 0)' });
    legend('l2', items);
  }

  form.addEventListener('input', update);
  form.addEventListener('change', update);
  update();
})();
