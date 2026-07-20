/* ScanShrink — local, in-browser PDF "scanner" + shrinker.
 * Renders each PDF page, applies a scanned-document filter, downsamples,
 * and rebuilds a compressed PDF. No network, no uploads. */

(() => {
  'use strict';

  // pdf.js worker (vendored locally so the app runs fully offline)
  if (window['pdfjsLib']) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
  }
  const PDFLib = window['PDFLib'];

  // ---- state ----
  const state = {
    file: null,
    mode: 'bw',      // 'bw' | 'gray' | 'color'
    dpi: 150,
    quality: 0.65,
    resultUrl: null,
    outName: 'scanned.pdf',
  };

  // ---- element refs ----
  const $ = (id) => document.getElementById(id);
  const els = {
    fileInput: $('fileInput'),
    pickCard: $('pickCard'),
    optionsCard: $('optionsCard'),
    progressCard: $('progressCard'),
    resultCard: $('resultCard'),
    filemeta: $('filemeta'),
    modeSeg: $('modeSeg'),
    modeHint: $('modeHint'),
    qualityOpt: $('qualityOpt'),
    dpi: $('dpi'), dpiVal: $('dpiVal'),
    quality: $('quality'), qVal: $('qVal'),
    runBtn: $('runBtn'), resetBtn: $('resetBtn'),
    progTitle: $('progTitle'), progSub: $('progSub'), progFill: $('progFill'),
    preview: $('preview'),
    stats: $('stats'), saveBtn: $('saveBtn'), anotherBtn: $('anotherBtn'),
    err: $('err'),
  };

  const MODE_HINTS = {
    bw: 'Sharp black-on-white — smallest files, best for text documents.',
    gray: 'Neutral grayscale — good for documents with light shading or pencil.',
    color: 'Keeps color but brightens the background — best for receipts, forms with color.',
  };

  // ---- helpers ----
  const fmtBytes = (b) => {
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(0) + ' KB';
    return (b / (1024 * 1024)).toFixed(1) + ' MB';
  };
  const showErr = (msg) => {
    els.err.textContent = '⚠️ ' + msg;
    els.err.classList.remove('hidden');
  };
  const clearErr = () => els.err.classList.add('hidden');
  const show = (el) => el.classList.remove('hidden');
  const hide = (el) => el.classList.add('hidden');
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

  // ---- file selection ----
  els.fileInput.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (f.type && f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name)) {
      showErr('Please choose a PDF file.');
      return;
    }
    clearErr();
    state.file = f;
    const base = f.name.replace(/\.pdf$/i, '');
    state.outName = `${base} (scanned).pdf`;
    els.filemeta.innerHTML =
      `<span style="font-size:20px">📄</span>` +
      `<div style="min-width:0"><div class="fm-name">${escapeHtml(f.name)}</div>` +
      `<div class="fm-size">${fmtBytes(f.size)}</div></div>`;
    hide(els.pickCard);
    show(els.optionsCard);
    hide(els.resultCard);
  });

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---- options wiring ----
  els.modeSeg.addEventListener('click', (e) => {
    const btn = e.target.closest('.seg');
    if (!btn) return;
    state.mode = btn.dataset.mode;
    [...els.modeSeg.children].forEach((b) => b.classList.toggle('active', b === btn));
    els.modeHint.textContent = MODE_HINTS[state.mode];
    // Quality slider only matters for JPEG (gray/color); B&W uses lossless PNG.
    els.qualityOpt.style.display = state.mode === 'bw' ? 'none' : '';
  });

  els.dpi.addEventListener('input', () => {
    state.dpi = parseInt(els.dpi.value, 10);
    els.dpiVal.textContent = state.dpi + ' DPI';
  });
  els.quality.addEventListener('input', () => {
    state.quality = parseInt(els.quality.value, 10) / 100;
    els.qVal.textContent = els.quality.value + '%';
  });

  els.resetBtn.addEventListener('click', resetToStart);
  els.anotherBtn.addEventListener('click', resetToStart);

  function resetToStart() {
    if (state.resultUrl) { URL.revokeObjectURL(state.resultUrl); state.resultUrl = null; }
    state.file = null;
    els.fileInput.value = '';
    clearErr();
    hide(els.optionsCard);
    hide(els.progressCard);
    hide(els.resultCard);
    show(els.pickCard);
  }

  // ---- run ----
  els.runBtn.addEventListener('click', run);

  async function run() {
    if (!state.file) return;
    clearErr();
    hide(els.optionsCard);
    show(els.progressCard);
    els.progFill.style.width = '0%';
    els.progTitle.textContent = 'Opening PDF…';
    els.progSub.textContent = '';

    try {
      const out = await processPdf(state.file, state, (done, total, note) => {
        const pct = total ? Math.round((done / total) * 100) : 0;
        els.progFill.style.width = pct + '%';
        els.progTitle.textContent = 'Scanning & shrinking…';
        els.progSub.textContent = note || `Page ${done} of ${total}`;
      });

      if (state.resultUrl) URL.revokeObjectURL(state.resultUrl);
      const blob = new Blob([out.bytes], { type: 'application/pdf' });
      state.resultUrl = URL.createObjectURL(blob);

      els.saveBtn.href = state.resultUrl;
      els.saveBtn.setAttribute('download', state.outName);

      const orig = state.file.size;
      const now = out.bytes.byteLength;
      const pctSmaller = orig > 0 ? Math.max(0, Math.round((1 - now / orig) * 100)) : 0;
      els.stats.innerHTML =
        statTile(fmtBytes(orig), 'Original') +
        statTile(fmtBytes(now), 'Scanned') +
        statTile(pctSmaller + '%', 'Smaller', now <= orig);

      hide(els.progressCard);
      show(els.resultCard);
    } catch (err) {
      console.error(err);
      hide(els.progressCard);
      show(els.optionsCard);
      showErr('Could not process this PDF: ' + (err && err.message ? err.message : err));
    }
  }

  function statTile(num, lab, good) {
    return `<div class="stat"><div class="s-num ${good ? 'good' : ''}">${num}</div><div class="s-lab">${lab}</div></div>`;
  }

  // ---- core processing ----
  async function processPdf(file, opts, onProgress) {
    const buf = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buf), disableAutoFetch: true });
    const pdf = await loadingTask.promise;
    const total = pdf.numPages;

    const outDoc = await PDFLib.PDFDocument.create();
    const scale = opts.dpi / 72;

    // reusable canvases
    const renderCanvas = document.createElement('canvas');
    const renderCtx = renderCanvas.getContext('2d', { willReadFrequently: true });

    for (let i = 1; i <= total; i++) {
      onProgress(i - 1, total, `Rendering page ${i} of ${total}…`);
      await nextFrame();

      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale });
      const ptView = page.getViewport({ scale: 1 }); // page size in PDF points

      renderCanvas.width = Math.max(1, Math.floor(viewport.width));
      renderCanvas.height = Math.max(1, Math.floor(viewport.height));
      renderCtx.fillStyle = '#ffffff';
      renderCtx.fillRect(0, 0, renderCanvas.width, renderCanvas.height);

      await page.render({ canvasContext: renderCtx, viewport, background: '#ffffff' }).promise;
      page.cleanup();

      // apply the scanned-look filter in place
      applyFilter(renderCtx, renderCanvas.width, renderCanvas.height, opts.mode);

      // show a live preview
      drawPreview(renderCanvas);

      // encode + embed
      let embedded;
      if (opts.mode === 'bw') {
        const blob = await canvasToBlob(renderCanvas, 'image/png');
        embedded = await outDoc.embedPng(await blob.arrayBuffer());
      } else {
        const blob = await canvasToBlob(renderCanvas, 'image/jpeg', opts.quality);
        embedded = await outDoc.embedJpg(await blob.arrayBuffer());
      }

      const pw = ptView.width, ph = ptView.height;
      const pageOut = outDoc.addPage([pw, ph]);
      pageOut.drawImage(embedded, { x: 0, y: 0, width: pw, height: ph });

      onProgress(i, total, `Compressed page ${i} of ${total}`);
      await nextFrame();
    }

    onProgress(total, total, 'Finalizing PDF…');
    const bytes = await outDoc.save({ useObjectStreams: true });
    try { await pdf.destroy(); } catch (_) {}
    return { bytes };
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Image encoding failed'))),
        type,
        quality
      );
    });
  }

  // Live preview (scaled down for speed)
  function drawPreview(src) {
    const c = els.preview;
    const maxW = 720;
    const s = Math.min(1, maxW / src.width);
    c.width = Math.round(src.width * s);
    c.height = Math.round(src.height * s);
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  }

  // ---- filters ----
  function applyFilter(ctx, w, h, mode) {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;

    if (mode === 'color') {
      // Brighten background / add contrast so the page looks like a clean scan.
      // Simple levels: map [black..whitePoint] -> [0..255], gentle gamma.
      const whitePoint = 235, gamma = 0.9;
      const lut = buildLevelsLUT(0, whitePoint, gamma);
      for (let i = 0; i < d.length; i += 4) {
        d[i] = lut[d[i]];
        d[i + 1] = lut[d[i + 1]];
        d[i + 2] = lut[d[i + 2]];
      }
      ctx.putImageData(img, 0, 0);
      return;
    }

    // grayscale luminance buffer
    const n = w * h;
    const gray = new Uint8ClampedArray(n);
    for (let p = 0, i = 0; p < n; p++, i += 4) {
      gray[p] = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
    }

    if (mode === 'gray') {
      const lut = buildLevelsLUT(20, 235, 0.85); // lift contrast, whiten background
      for (let p = 0, i = 0; p < n; p++, i += 4) {
        const v = lut[gray[p]];
        d[i] = d[i + 1] = d[i + 2] = v;
      }
      ctx.putImageData(img, 0, 0);
      return;
    }

    // mode === 'bw' : adaptive threshold (Bradley-Roth) via integral image
    adaptiveThreshold(gray, w, h);
    for (let p = 0, i = 0; p < n; p++, i += 4) {
      const v = gray[p];
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(img, 0, 0);
  }

  function buildLevelsLUT(black, white, gamma) {
    const lut = new Uint8ClampedArray(256);
    const span = Math.max(1, white - black);
    for (let v = 0; v < 256; v++) {
      let t = (v - black) / span;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      lut[v] = Math.round(Math.pow(t, gamma) * 255);
    }
    return lut;
  }

  // Bradley adaptive thresholding using an integral image.
  function adaptiveThreshold(gray, w, h) {
    const n = w * h;
    // integral image (row-major), use Float64 to avoid overflow on big pages
    const integral = new Float64Array(n);
    for (let y = 0; y < h; y++) {
      let rowSum = 0;
      const off = y * w;
      for (let x = 0; x < w; x++) {
        rowSum += gray[off + x];
        integral[off + x] = (y === 0 ? 0 : integral[off - w + x]) + rowSum;
      }
    }
    // window ~ 1/12 of width, threshold t% below local mean
    const s = Math.max(8, Math.floor(w / 12));
    const half = s >> 1;
    const t = 0.86; // pixel is black if < 86% of local average
    for (let y = 0; y < h; y++) {
      const y1 = Math.max(0, y - half), y2 = Math.min(h - 1, y + half);
      for (let x = 0; x < w; x++) {
        const x1 = Math.max(0, x - half), x2 = Math.min(w - 1, x + half);
        const count = (x2 - x1) * (y2 - y1);
        const A = (x1 > 0 && y1 > 0) ? integral[(y1 - 1) * w + (x1 - 1)] : 0;
        const B = (y1 > 0) ? integral[(y1 - 1) * w + x2] : 0;
        const C = (x1 > 0) ? integral[y2 * w + (x1 - 1)] : 0;
        const D = integral[y2 * w + x2];
        const sum = D - B - C + A;
        const p = y * w + x;
        gray[p] = (gray[p] * count < sum * t) ? 0 : 255;
      }
    }
  }

  // ---- register service worker for offline use ----
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch(() => {});
    });
  }
})();
