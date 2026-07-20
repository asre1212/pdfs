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
- 🖨️ **Three scan styles**
  - **B&W** — sharp black-on-white via adaptive thresholding. Smallest files. Best for text.
  - **Grayscale** — neutral, contrast-boosted. Good for shaded pages or pencil.
  - **Color** — keeps color but brightens the background like a real scanner.
- 🗜️ **Shrinks the file** by downsampling to your chosen DPI (100–300) and re-compressing.
- 💾 **Save back to Files** — tap *Save to Files* and choose the same folder as the original.
- 🔒 **100% local & private** — no servers, no tracking, no network calls while processing.
- 📴 **Works offline** — installable to your Home Screen; runs without a connection.

---

## 🚀 Set it up (one time, ~2 minutes)

You don't need a Mac or Xcode — just this repo and free GitHub Pages hosting.

1. **Fork or push this repo** to your own GitHub account (it's already here if you're reading this on GitHub).
2. Make sure **Actions are enabled**: **Settings → Actions → General → "Allow all actions and reusable workflows" → Save**.
3. Go to **Settings → Pages → Build and deployment**:
   - **Source:** choose **"Deploy from a branch"**
   - **Branch:** select this branch and folder **`/ (root)`**, then **Save**
4. Wait ~1–3 minutes for the **`pages build and deployment`** run (in the **Actions** tab) to go green,
   then open the published URL (looks like `https://<your-username>.github.io/<repo>/`).

> This site is plain static HTML/JS/CSS (no build step), so GitHub's built-in
> branch deployment serves it directly. A `.nojekyll` file tells Pages to serve
> every file as-is.

## 📱 Install on your iPhone

1. Open the published URL in **Safari** (must be Safari for install + Files integration).
2. Tap the **Share** button → **Add to Home Screen**.
3. Launch **ScanShrink** from your Home Screen — it now runs full-screen and offline.

## 🧑‍💻 How to use it

1. Tap **Choose a PDF** and select a file from the Files app.
2. Pick a **scan style**, adjust **resolution** / **quality** (defaults are good).
3. Tap **Scan & Shrink** and watch the live page preview.
4. Tap **Save to Files** and pick the **same folder** your original is in.

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
app.js                # all logic: render → filter → compress → rebuild PDF
vendor/               # pdf.js + pdf-lib (local copies, no CDN)
icons/                # app icons (generated)
manifest.webmanifest  # PWA manifest
service-worker.js     # offline caching
scripts/gen-icons.js  # regenerates the icons (node scripts/gen-icons.js)
.github/workflows/    # auto-deploy to GitHub Pages
```

## ⚙️ Tips for best results

- Photographed pages? Use **B&W** at **150 DPI** for the smallest, cleanest output.
- Pages look soft or you need to read fine print? Raise **resolution** to 200–300 DPI.
- Output not small enough? Lower **quality** (Grayscale/Color) or drop to **B&W**.
- Very large PDFs (50+ high-res pages) take longer and use more memory — give it a moment.

## 📄 License

MIT — see [LICENSE](LICENSE).

Bundled libraries keep their own licenses: pdf.js (Apache-2.0) and pdf-lib (MIT).
