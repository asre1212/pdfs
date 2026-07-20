# ScanShrink 📄

**Turn a PDF full of photos/images into a small, clean, "scanned"-looking PDF — entirely on your iPhone. Nothing is ever uploaded.**

ScanShrink is a tiny web app (a PWA) you host for free on GitHub Pages. You open it in
Safari, pick a PDF from the **Files** app, and it re-renders every page as a crisp
scanned document and re-compresses it — usually shrinking the file **by 70–95%**. All
processing runs locally in your browser using JavaScript; **no file ever leaves your
phone** and it even works with airplane mode on after the first load.

---

## ✨ What it does

- 📥 **Pick a PDF from Files** (iCloud Drive, On My iPhone, etc.)
- 🖼️ **Or turn images into a PDF** — pick one or more photos and each becomes a
  page, run through the same scanned-look filter and shrink.
- 🖨️ **Three scan styles**
  - **B&W** — sharp black-on-white via adaptive thresholding. Smallest files. Best for text.
  - **Grayscale** — neutral, contrast-boosted. Good for shaded pages or pencil.
  - **Color** — keeps color but brightens the background like a real scanner.
- 🗜️ **Shrinks the file** by downsampling to your chosen DPI (100–300) and re-compressing.
- 💾 **Save back to Files** — tap *Save to Files* and choose the same folder as the original.
- 🔒 **100% local & private** — no servers, no tracking, no network calls while processing.
- 📴 **Works offline** — installable to your Home Screen; runs without a connection.
- 🔄 **Auto-updates** — when you push a new version to GitHub, installed copies of
  the app pick it up automatically (see below). Only app code updates over the
  network; **your documents and images are still never uploaded.**

---

## 🚀 Set it up (one time, ~2 minutes)

You don't need a Mac or Xcode — just this repo and free GitHub Pages hosting.

1. **Fork or push this repo** to your own GitHub account (it's already here if you're reading this on GitHub).
2. Make sure **Actions are enabled**: **Settings → Actions → General → "Allow all actions and reusable workflows" → Save**.
3. Go to **Settings → Pages → Build and deployment**:
   - **Source:** choose **"GitHub Actions"**
4. Push to the default branch (`main`). The **Deploy to GitHub Pages** workflow
   (in the **Actions** tab) builds and publishes automatically — wait ~1–3 minutes
   for it to go green, then open the published URL
   (looks like `https://<your-username>.github.io/<repo>/`).

> This site is plain static HTML/JS/CSS (no build step). The included workflow
> (`.github/workflows/deploy.yml`) just stamps a unique build version into the
> service worker and uploads the files as-is. A `.nojekyll` file tells Pages to
> serve every file untouched.

### 🔄 How auto-update works

Each deploy stamps a fresh version into `service-worker.js`, so the browser
notices the change, installs the new version in the background, and the app
swaps itself over — no reinstall needed. If you're in the middle of scanning, a
small **"A new version is available — Refresh"** banner appears so nothing is
interrupted; otherwise the update applies silently. This only ever downloads the
app's own code; **no document or image ever leaves your device.**

## 📱 Install on your iPhone

1. Open the published URL in **Safari** (must be Safari for install + Files integration).
2. Tap the **Share** button → **Add to Home Screen**.
3. Launch **ScanShrink** from your Home Screen — it now runs full-screen and offline.

## 🧑‍💻 How to use it

1. Choose a source at the top:
   - **Shrink a PDF** — tap **Choose a PDF** and pick a file from the Files app.
   - **Images → PDF** — tap **Choose images** and pick one or more photos; each
     becomes a page in the output PDF.
2. Pick a **scan style**, adjust **resolution** / **quality** (defaults are good).
3. Tap **Scan & Shrink** (or **Make PDF** for images) and watch the live page preview.
4. Tap **Save to Files** and pick the folder you want to keep it in.

> **Why not overwrite the original automatically?** iOS deliberately sandboxes Safari:
> a web page can read a file you pick and hand you a new one to save, but it cannot
> silently replace a file on disk. Saving to the same folder (the result is named
> `YourFile (scanned).pdf`) keeps both together and is the closest iOS allows without a
> native App Store app.

---

## 🔐 Privacy

- All PDF rendering, filtering, and compression happen **in your browser** via
  [pdf.js](https://mozilla.github.io/pdf.js/) and [pdf-lib](https://pdf-lib.js.org/).
- These libraries are **vendored** into `vendor/` — the app loads **zero third-party
  URLs** at runtime.
- There is **no analytics, no backend, no upload**. You can verify by turning on
  Airplane Mode after the app loads — it still works.

## 🛠️ Project layout

```
index.html            # UI
style.css             # styling
app.js                # all logic: render → filter → compress → rebuild PDF (PDFs + images)
vendor/               # pdf.js + pdf-lib (local copies, no CDN)
icons/                # app icons (generated)
manifest.webmanifest  # PWA manifest
service-worker.js     # offline caching + versioned cache for auto-update
version.json          # build version (stamped on deploy)
.nojekyll             # serve files as-is on GitHub Pages
scripts/gen-icons.js  # regenerates the icons (node scripts/gen-icons.js)
.github/workflows/    # auto-deploy to GitHub Pages (stamps build version)
```

## ⚙️ Tips for best results

- Photographed pages? Use **B&W** at **150 DPI** for the smallest, cleanest output.
- Pages look soft or you need to read fine print? Raise **resolution** to 200–300 DPI.
- Output not small enough? Lower **quality** (Grayscale/Color) or drop to **B&W**.
- Very large PDFs (50+ high-res pages) take longer and use more memory — give it a moment.

## 📄 License

MIT — see [LICENSE](LICENSE).

Bundled libraries keep their own licenses: pdf.js (Apache-2.0) and pdf-lib (MIT).
