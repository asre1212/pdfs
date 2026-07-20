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
    source: 'pdf',   // 'pdf' | 'images'
    file: null,      // the picked PDF (source === 'pdf')
    images: [],      // the picked image files (source === 'images')
    mode: 'bw',      // 'bw' | 'gray' | 'color'
    dpi: 150,
    quality: 0.65,
    resultUrl: null,
    outName: 'scanned.pdf',
    busy: false,     // true while processing (used to defer auto-update)
  };

  // ---- element refs ----
  const $ = (id) => document.getElementById(id);
  const els = {
    fileInput: $('fileInput'),
    pickCard: $('pickCard'),
    sourceSeg: $('sourceSeg'),
    dzTitle: $('dzTitle'), dzSub: $('dzSub'),
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
    updateBanner: $('updateBanner'), updateBtn: $('updateBtn'),
  };

  const MODE_HINTS = {
    bw: 'Sharp black-on-white — smallest files, best for text documents.',
    gray: 'Neutral grayscale — good for documents with light shading or pencil.',
    color: 'Keeps color but brightens the background — best for receipts, forms with color.',
  };

  // Per-source UI config (file picker + button labels).
  const SOURCE_UI = {
    pdf: {
      accept: 'application/pdf,.pdf',
      multiple: false,
      dzTitle: 'Choose a PDF',
      dzSub: 'Tap to pick from the Files app',
      runLabel: 'Scan & Shrink',
      resultLabel: 'Scanned',
    },
    images: {
      // image/* makes iOS Safari offer "Photo Library" (the Photos app); the
      // explicit extensions make sure HEIC/JPEG/PNG are always selectable.
      accept: 'image/*,.heic,.heif,.jpg,.jpeg,.png',
      multiple: true,
      dzTitle: 'Choose photos',
      dzSub: 'Pick from Photos or Files (HEIC, JPEG, PNG) — each becomes a page',
      runLabel: 'Make PDF',
      resultLabel: 'PDF',
    },
  };

  // Reference long-edge for image pages: 11in (792pt), like a standard page.
  const IMG_PAGE_LONG_EDGE_PT = 792;

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

  // ---- source selection (PDF vs Images) ----
  els.sourceSeg.addEventListener('click', (e) => {
    const btn = e.target.closest('.seg');
    if (!btn) return;
    setSource(btn.dataset.source);
  });

  function setSource(source) {
    if (!SOURCE_UI[source]) return;
    state.source = source;
    const ui = SOURCE_UI[source];
    [...els.sourceSeg.children].forEach((b) => b.classList.toggle('active', b.dataset.source === source));
    els.fileInput.setAttribute('accept', ui.accept);
    if (ui.multiple) els.fileInput.setAttribute('multiple', '');
    else els.fileInput.removeAttribute('multiple');
    els.dzTitle.textContent = ui.dzTitle;
    els.dzSub.textContent = ui.dzSub;
    els.runBtn.textContent = ui.runLabel;
    els.fileInput.value = '';
    clearErr();
  }

  // ---- file selection ----
  els.fileInput.addEventListener('change', (e) => {
    const files = e.target.files ? [...e.target.files] : [];
    if (!files.length) return;
    clearErr();
    if (state.source === 'images') selectImages(files);
    else selectPdf(files[0]);
  });

  function selectPdf(f) {
    if (!f) return;
    if (f.type && f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name)) {
      showErr('Please choose a PDF file.');
      return;
    }
    state.file = f;
    state.images = [];
    const base = f.name.replace(/\.pdf$/i, '');
    state.outName = `${base} (scanned).pdf`;
    els.filemeta.innerHTML =
      `<span style="font-size:20px">📄</span>` +
      `<div style="min-width:0"><div class="fm-name">${escapeHtml(f.name)}</div>` +
      `<div class="fm-size">${fmtBytes(f.size)}</div></div>`;
    goToOptions();
  }

  function selectImages(files) {
    const imgs = files.filter((f) => (f.type && f.type.startsWith('image/')) || /\.(png|jpe?g|gif|bmp|webp|heic|heif|tiff?)$/i.test(f.name));
    if (!imgs.length) {
      showErr('Please choose one or more image files.');
      return;
    }
    state.images = imgs;
    state.file = null;
    const totalSize = imgs.reduce((s, f) => s + f.size, 0);
    const base = imgs.length === 1 ? imgs[0].name.replace(/\.[^.]+$/, '') : 'Scanned';
    state.outName = `${base}.pdf`;
    const label = imgs.length === 1 ? escapeHtml(imgs[0].name) : `${imgs.length} images`;
    els.filemeta.innerHTML =
      `<span style="font-size:20px">🖼️</span>` +
      `<div style="min-width:0"><div class="fm-name">${label}</div>` +
      `<div class="fm-size">${fmtBytes(totalSize)}</div></div>`;
    goToOptions();
  }

  function goToOptions() {
    hide(els.pickCard);
    show(els.optionsCard);
    hide(els.resultCard);
  }

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

  // Quality slider only applies to JPEG (gray/color); hide it for the B&W default.
  els.qualityOpt.style.display = state.mode === 'bw' ? 'none' : '';

  function resetToStart() {
    if (state.resultUrl) { URL.revokeObjectURL(state.resultUrl); state.resultUrl = null; }
    state.file = null;
    state.images = [];
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
    const isImages = state.source === 'images';
    if (isImages ? !state.images.length : !state.file) return;
    clearErr();
    hide(els.optionsCard);
    show(els.progressCard);
    els.progFill.style.width = '0%';
    els.progTitle.textContent = isImages ? 'Preparing images…' : 'Opening PDF…';
    els.progSub.textContent = '';
    state.busy = true;

    const onProgress = (done, total, note) => {
      const pct = total ? Math.round((done / total) * 100) : 0;
      els.progFill.style.width = pct + '%';
      els.progTitle.textContent = isImages ? 'Building PDF…' : 'Scanning & shrinking…';
      els.progSub.textContent = note || `Page ${done} of ${total}`;
    };

    try {
      const out = isImages
        ? await processImages(state.images, state, onProgress)
        : await processPdf(state.file, state, onProgress);

      if (state.resultUrl) URL.revokeObjectURL(state.resultUrl);
      const blob = new Blob([out.bytes], { type: 'application/pdf' });
      state.resultUrl = URL.createObjectURL(blob);

      els.saveBtn.href = state.resultUrl;
      els.saveBtn.setAttribute('download', state.outName);

      const orig = isImages
        ? state.images.reduce((s, f) => s + f.size, 0)
        : state.file.size;
      const now = out.bytes.byteLength;
      const origLabel = isImages ? 'Images' : 'Original';
      const resultLabel = SOURCE_UI[state.source].resultLabel;
      const pctSmaller = orig > 0 ? Math.round((1 - now / orig) * 100) : 0;
      const stats =
        statTile(fmtBytes(orig), origLabel) +
        statTile(fmtBytes(now), resultLabel);
      // Only show a "smaller" tile when it's a meaningful shrink (PDFs always;
      // images may grow, so show the delta only when it actually shrank).
      els.stats.innerHTML = (pctSmaller > 0)
        ? stats + statTile(pctSmaller + '%', 'Smaller', true)
        : stats + statTile(`${out.pages} ${out.pages === 1 ? 'page' : 'pages'}`, 'Pages');

      hide(els.progressCard);
      show(els.resultCard);
    } catch (err) {
      console.error(err);
      hide(els.progressCard);
      show(els.optionsCard);
      showErr('Could not process this ' + (isImages ? 'image set' : 'PDF') + ': ' + (err && err.message ? err.message : err));
    } finally {
      state.busy = false;
      maybeApplyPendingUpdate();
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

      // filter → preview → encode → embed → add page (keeps original page size)
      await embedCanvasAsPage(outDoc, renderCanvas, renderCtx, ptView.width, ptView.height, opts);

      onProgress(i, total, `Compressed page ${i} of ${total}`);
      await nextFrame();
    }

    onProgress(total, total, 'Finalizing PDF…');
    const bytes = await outDoc.save({ useObjectStreams: true });
    try { await pdf.destroy(); } catch (_) {}
    return { bytes, pages: total };
  }

  // ---- images -> PDF (same scanned-look filter + shrink) ----
  async function processImages(files, opts, onProgress) {
    const total = files.length;
    const outDoc = await PDFLib.PDFDocument.create();

    const renderCanvas = document.createElement('canvas');
    const renderCtx = renderCanvas.getContext('2d', { willReadFrequently: true });

    for (let i = 0; i < total; i++) {
      onProgress(i, total, `Rendering image ${i + 1} of ${total}…`);
      await nextFrame();

      const bitmap = await loadImage(files[i]);
      const natW = bitmap.naturalWidth || bitmap.width;
      const natH = bitmap.naturalHeight || bitmap.height;
      if (!natW || !natH) { closeBitmap(bitmap); throw new Error(`Could not read image "${files[i].name}".`); }

      // Page size in points: fixed long edge (like a standard page), image aspect.
      const long = IMG_PAGE_LONG_EDGE_PT;
      const short = Math.round(long * (Math.min(natW, natH) / Math.max(natW, natH)));
      const pwPts = natW >= natH ? long : short;
      const phPts = natW >= natH ? short : long;

      // Raster size for the chosen DPI, but never upsample beyond the source.
      const scale = opts.dpi / 72;
      const targetW = Math.max(1, Math.min(natW, Math.round(pwPts * scale)));
      const targetH = Math.max(1, Math.min(natH, Math.round(phPts * scale)));

      renderCanvas.width = targetW;
      renderCanvas.height = targetH;
      renderCtx.fillStyle = '#ffffff';
      renderCtx.fillRect(0, 0, targetW, targetH);
      renderCtx.drawImage(bitmap, 0, 0, targetW, targetH);
      closeBitmap(bitmap);

      await embedCanvasAsPage(outDoc, renderCanvas, renderCtx, pwPts, phPts, opts);

      onProgress(i + 1, total, `Added page ${i + 1} of ${total}`);
      await nextFrame();
    }

    onProgress(total, total, 'Finalizing PDF…');
    const bytes = await outDoc.save({ useObjectStreams: true });
    return { bytes, pages: total };
  }

  // Shared: apply the scanned-look filter to the canvas, preview it, encode,
  // embed into `outDoc`, and add a page of the given point size.
  async function embedCanvasAsPage(outDoc, canvas, ctx, pwPts, phPts, opts) {
    applyFilter(ctx, canvas.width, canvas.height, opts.mode);
    drawPreview(canvas);

    let embedded;
    if (opts.mode === 'bw') {
      const blob = await canvasToBlob(canvas, 'image/png');
      embedded = await outDoc.embedPng(await blob.arrayBuffer());
    } else {
      const blob = await canvasToBlob(canvas, 'image/jpeg', opts.quality);
      embedded = await outDoc.embedJpg(await blob.arrayBuffer());
    }

    const pageOut = outDoc.addPage([pwPts, phPts]);
    pageOut.drawImage(embedded, { x: 0, y: 0, width: pwPts, height: phPts });
  }

  // Decode an image file (HEIC/JPEG/PNG) to something drawable.
  // Prefer createImageBitmap with EXIF orientation applied — iPhone photos are
  // commonly stored rotated, and without this they'd come out sideways. Fall
  // back to <img> (Safari decodes HEIC there; canvas draw honors orientation).
  async function loadImage(file) {
    if ('createImageBitmap' in window) {
      try {
        return await createImageBitmap(file, { imageOrientation: 'from-image' });
      } catch (_) {
        // Older engines may reject the options form — retry without it.
        try { return await createImageBitmap(file); } catch (_2) { /* fall through */ }
      }
    }
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const im = new Image();
        im.decoding = 'async';
        // Honor EXIF orientation when the image is drawn onto a canvas.
        try { im.style.imageOrientation = 'from-image'; } catch (_) {}
        im.onload = () => resolve(im);
        im.onerror = () => reject(new Error(`Couldn't open "${file.name}" — this image format isn't supported on this device.`));
        im.src = url;
      });
      img._objectUrl = url;
      return img;
    } catch (err) {
      URL.revokeObjectURL(url);
      throw err;
    }
  }

  function closeBitmap(bitmap) {
    if (!bitmap) return;
    if (typeof bitmap.close === 'function') bitmap.close();
    if (bitmap._objectUrl) { URL.revokeObjectURL(bitmap._objectUrl); bitmap._objectUrl = null; }
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

  // ---- service worker: offline cache + auto-update ----
  // When a new version is deployed to GitHub, the browser re-fetches the
  // service worker, installs it in the background, and we surface it here.
  let swRegistration = null;
  let pendingWorker = null;      // a new, installed worker waiting to activate
  let reloadingForUpdate = false;

  // True only when nothing is in flight and nothing would be lost on reload.
  function isIdleAtStart() {
    return !state.busy && !state.file && !state.images.length &&
      els.resultCard.classList.contains('hidden') &&
      els.progressCard.classList.contains('hidden');
  }

  function showUpdateBanner() {
    if (els.updateBanner) show(els.updateBanner);
  }

  function applyUpdate() {
    const worker = pendingWorker || (swRegistration && swRegistration.waiting);
    if (!worker) return;
    reloadingForUpdate = true;
    // Ask the waiting worker to take over; controllerchange then reloads us.
    worker.postMessage({ type: 'SKIP_WAITING' });
  }

  // Called when the app becomes idle again, to seamlessly apply a pending update.
  function maybeApplyPendingUpdate() {
    if (pendingWorker && isIdleAtStart()) applyUpdate();
  }

  function onUpdateAvailable(worker) {
    pendingWorker = worker;
    showUpdateBanner();
    // If the user isn't in the middle of anything, update seamlessly now.
    if (isIdleAtStart()) applyUpdate();
  }

  function watchInstallingWorker(worker) {
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      // A freshly installed worker while one already controls the page = update.
      if (worker.state === 'installed' && navigator.serviceWorker.controller) {
        onUpdateAvailable(worker);
      }
    });
  }

  if ('serviceWorker' in navigator) {
    if (els.updateBtn) els.updateBtn.addEventListener('click', applyUpdate);

    // Reload once the new worker has taken control.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloadingForUpdate) window.location.reload();
    });

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js', { updateViaCache: 'none' })
        .then((reg) => {
          swRegistration = reg;
          // A new version may already be waiting from a previous visit.
          if (reg.waiting && navigator.serviceWorker.controller) onUpdateAvailable(reg.waiting);
          watchInstallingWorker(reg.installing);
          reg.addEventListener('updatefound', () => watchInstallingWorker(reg.installing));

          // Proactively check for a new deploy now and periodically.
          reg.update().catch(() => {});
          setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
        })
        .catch(() => {});
    });

    // Check for updates whenever the app comes back to the foreground.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && swRegistration) {
        swRegistration.update().catch(() => {});
      }
    });
  }
})();
