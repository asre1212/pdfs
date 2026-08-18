# ScanShrink 📄

**Shrink photo-PDFs, turn photos into PDFs, and permanently redact PDFs — entirely on your iPhone. Nothing is ever uploaded.**

ScanShrink is a tiny web app (a PWA) you host for free on GitHub Pages. You open it in
Safari, pick a PDF from the **Files** app, and it re-renders every page as a crisp
scanned document and re-compresses it — usually shrinking the file **by 70–95%**. It
can also **black out anything on a page for good**. All processing runs locally in your
browser using JavaScript; **no file ever leaves your phone** and it even works with
airplane mode on after the first load.

---

## ✨ What it does

- 📥 **Pick a PDF from Files** (iCloud Drive, On My iPhone, etc.)
- 🖼️ **Or turn photos into a PDF** — pick one or more images straight from the
  **Photos** app (or Files). Handles **HEIC** (iPhone photos), **JPEG**, and
  **PNG**, fixes their rotation, and makes each one a page run through the same
  scanned-look filter and shrink.
- 🖍️ **Redact a PDF permanently** — pick a PDF from **Files**, drag boxes over the
  bits that must disappear, and get back a file where that content is *gone*, not
  hidden under a black rectangle. See [Redaction](#-redaction) below.
- 🖨️ **Three scan styles**
  - **B&W** — sharp black-on-white via adaptive thresholding. Smallest files. Best for text.
  - **Grayscale** — neutral, contrast-boosted. Good for shaded pages or pencil.
  - **Color** — keeps color but brightens the background like a real scanner.
- 🗜️ **Shrinks the file** by downsampling to your chosen DPI (100–300) and re-compressing.
- 💾 **Save back to Files** — tap *Save to Files* and choose the same folder as the
  original; on browsers with the File System Access API you can write straight back
  over the file you opened.
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
   - **Shrink PDF** — tap **Choose a PDF** and pick a file from the Files app.
   - **Images → PDF** — tap **Choose photos** and pick one or more images from
     the **Photos** app (or Files). HEIC, JPEG, and PNG all work; each becomes a
     page in the output PDF.
   - **Redact PDF** — tap **Choose a PDF to redact** and pick a file from the Files
     app, then draw over what should disappear.
2. Pick a **scan style**, adjust **resolution** / **quality** (defaults are good).
3. Tap **Scan & Shrink** (or **Make PDF** / **Redact PDF**) and watch the live page preview.
4. Tap **Save to Files** and pick the folder you want to keep it in.

---

## 🖍️ Redaction

Tap **Redact PDF**, choose a file, and you get a page-by-page editor:

- **Drag** across any text, signature, photo or stamp to cover it. Draw as many
  boxes as you like, on as many pages as you like.
- Tap a box's **✕** to remove it; **Undo**, **Clear page** and **Clear all** are there
  for bigger changes. Use **‹ ›** to move between pages.
- **Pages to flatten** — *Redacted pages* (default) turns only the pages you marked
  into images and copies every other page through untouched, so their text stays
  selectable. *Every page* flattens the whole document, which also drops every
  remaining text layer, annotation and form field.
- **Saved file name** — *Add "(redacted)"* saves alongside the original; *Keep
  original name* keeps the exact file name so you can replace the original in place.
- **Output detail** sets the DPI the redacted pages are re-rendered at (200 is a good
  default; raise it for fine print).

### Why this is permanent

Most "redaction" goes wrong the same way: a black rectangle is drawn *on top of* the
page, and the text underneath is still in the file — selectable, searchable, and one
copy-paste away from being read.

ScanShrink never does that. A redacted page is re-rendered into a canvas, the boxes are
painted onto **that canvas**, and only the resulting flat image is written into the new
PDF. The original text, vectors, images and annotations of that page are never copied
into the output at all, so there is nothing left to select, search or recover. Document
metadata (title, author, subject, keywords) is dropped too.

The trade-off is the usual one for real redaction: a redacted page becomes an image, so
its text is no longer selectable and the file gets bigger. Pages you didn't touch keep
their original quality and text unless you pick *Every page*.

> **Check your work.** The boxes you draw are what gets removed — content you can't see
> on screen (an off-page layer, an attachment, a comment thread) isn't part of the page
> image. Pick *Every page* when you want the whole document flattened.

### Saving it back where it came from

- **iPhone / iPad (Safari):** tap **Save to Files** and choose the original's folder.
  Pick **Keep original name** first and iOS offers to *replace* the existing file, which
  is as close to saving in place as Safari allows.
- **Desktop Safari, Chrome, Edge:** the file is opened through the File System Access
  API, so the result card also offers **Replace the original file** — it writes the
  redacted PDF straight back over the file you opened, same folder, same name (you're
  asked to confirm first, because the original is gone afterwards) — and **Save to the
  original folder…**, which opens the save dialog already pointed at it.

> iOS deliberately sandboxes Safari: a web page can read a file you pick and hand you a
> new one to save, but it cannot silently write over a file on disk. Everything above is
> the closest iOS allows without a native App Store app.

---

## 🔐 Privacy

- All PDF rendering, filtering, redaction, and compression happen **in your browser** via
  [pdf.js](https://mozilla.github.io/pdf.js/) and [pdf-lib](https://pdf-lib.js.org/).
- These libraries are **vendored** into `vendor/` — the app loads **zero third-party
  URLs** at runtime.
- There is **no analytics, no backend, no upload**. You can verify by turning on
  Airplane Mode after the app loads — it still works.

## 🛠️ Project layout

```
index.html            # UI
style.css             # styling
app.js                # all logic: render → filter/redact → compress → rebuild PDF
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
- Redacting? Draw boxes a little larger than the text — descenders and italics like to
  poke out — and zoom the page in Safari if you need to be precise.

## 📄 License

MIT — see [LICENSE](LICENSE).

Bundled libraries keep their own licenses: pdf.js (Apache-2.0) and pdf-lib (MIT).
