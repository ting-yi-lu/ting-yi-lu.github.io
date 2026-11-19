// Renders a PDF into the page with pdf.js, so it shows inside the site (menu bar stays on top)
// and works on phones, where browsers often cannot display an embedded PDF.
// Usage: <div class="pdf-view" data-pdf="file.pdf"></div>
(function () {
  var box = document.querySelector('.pdf-view');
  if (!box || !window.pdfjsLib) return;
  var url = box.getAttribute('data-pdf');
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'assets/pdfjs/pdf.worker.min.js';

  var status = document.createElement('p');
  status.className = 'status';
  status.textContent = 'Loading…';
  box.appendChild(status);

  pdfjsLib.getDocument(url).promise.then(function (pdf) {
    status.remove();
    var slots = [];
    var io = null;
    var aspect = 1.294; // A4/letter until the real page size is known

    for (var n = 1; n <= pdf.numPages; n++) {
      var c = document.createElement('canvas');
      c.setAttribute('aria-label', 'Page ' + n);
      c.dataset.page = n;
      box.appendChild(c);
      slots.push(c);
    }

    function sizePlaceholders() {
      var w = box.clientWidth;
      slots.forEach(function (c) { if (!c.dataset.done) c.style.height = Math.round(w * aspect) + 'px'; });
    }

    function render(c) {
      if (c.dataset.busy || c.dataset.done) return;
      c.dataset.busy = 1;
      pdf.getPage(+c.dataset.page).then(function (page) {
        var base = page.getViewport({ scale: 1 });
        var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        var scale = (box.clientWidth / base.width) * dpr;
        var vp = page.getViewport({ scale: scale });
        c.width = Math.floor(vp.width);
        c.height = Math.floor(vp.height);
        return page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise.then(function () {
          c.style.height = '';
          c.dataset.done = 1;
          delete c.dataset.busy;
        });
      }).catch(function () { delete c.dataset.busy; });
    }

    pdf.getPage(1).then(function (p) {
      var v = p.getViewport({ scale: 1 });
      aspect = v.height / v.width;
      sizePlaceholders();
      // Render pages only as they come near the screen (the thesis is long).
      if ('IntersectionObserver' in window) {
        io = new IntersectionObserver(function (entries) {
          entries.forEach(function (e) { if (e.isIntersecting) render(e.target); });
        }, { rootMargin: '1200px 0px' });
        slots.forEach(function (c) { io.observe(c); });
      } else {
        slots.forEach(render);
      }
    });

    // Re-render sharper after a big width change (e.g. phone rotated).
    var lastW = box.clientWidth, t;
    window.addEventListener('resize', function () {
      clearTimeout(t);
      t = setTimeout(function () {
        if (Math.abs(box.clientWidth - lastW) < 80) return;
        lastW = box.clientWidth;
        slots.forEach(function (c) {
          if (!c.dataset.done) return;
          delete c.dataset.done;
          // re-observing makes the observer re-render only pages near the screen
          if (io) { io.unobserve(c); io.observe(c); } else { render(c); }
        });
        sizePlaceholders();
      }, 250);
    });
  }).catch(function () {
    status.innerHTML = 'The PDF could not be shown here. <a href="' + url + '">Open it directly</a>.';
  });
})();
