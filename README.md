# ClipIt

A local-first browser adaptation of the LosslessCut editing workflow. Built with React, TypeScript, Vite, and ffmpeg.wasm. This is an independent browser edition, not an official LosslessCut release or a full desktop-feature port.

## Run

```sh
npm ci
npm run dev
```

Open **http://localhost:5173**. Choose a local file or try the included 12-second original sample.

```sh
npm run build    # static application in dist/
npm run preview  # preview the production build on port 4173
```

All media processing takes place in a browser worker. No media is uploaded. The FFmpeg JavaScript core, fonts, and sample are served from the app's own origin; the WASM binary downloads from this repository on GitHub. There is no backend, account system, or analytics.

### Cloudflare Pages

Use build command `npm run build` and output directory `dist`. The 31 MiB WASM binary lives at `wasm/ffmpeg-core-0.12.10.wasm`, outside `public/`, so Vite does not include it in `dist/` or Cloudflare's 25 MiB per-file limit.

Push the `wasm/` directory to the public GitHub repository before deploying. `.env` sets `VITE_FFMPEG_WASM_URL` to its raw GitHub URL (not a GitHub HTML file page). HTML preloads it while the page loads, before React renders or a file is opened. The app consumes that preload before rendering and shares the downloaded binary with the FFmpeg worker through a blob URL, avoiding another GitHub download even after cancellation. The blob is retained for the page's lifetime. An initial download failure does not block rendering, and opening media can retry it. GitHub sees the binary request, never your media. To change the host, override `VITE_FFMPEG_WASM_URL` at build time; it must serve the matching 0.12.10 binary with CORS allowing your app's origin.

## Implemented

- File picker and drag-and-drop; video/audio metadata and browser-native preview.
- Playback speed, mute, fullscreen, frame-sized seeking, and keyboard shortcuts.
- Timeline thumbnails, zoom, seeking, draggable segment boundaries, and editable timecodes.
- Named segments, split, add, delete, include/exclude, invert, undo, and redo.
- Individual segment downloads or merged same-source export.
- Explicit video/audio/subtitle/data track selection and container selection.
- LosslessCut `.llc` v1/v2 JSON5 project import and compatible v2 JSON export (ranges and names). ClipIt's `enabled` field is an extension; desktop LosslessCut may ignore it. Other desktop settings and segment tags are not round-tripped.
- Cancellable processing, retry after failure, virtual-filesystem cleanup, and download links.
- Responsive workspace, keyboard controls, accessible dialogs, and reduced-motion support.

Drag the playhead, ruler, or filmstrip to scrub; drag a segment's edges to trim. These pointer gestures work with mouse or touch without selecting timeline text. Only external file drags activate the media-drop overlay. The focused playhead/ruler also accepts arrow keys, Shift+arrows, Home, and End. Container and merge controls are under **Export options**.

### Phones and tablets

Every feature works with touch alone; keyboard shortcuts are optional. Touch screens get 44px controls, wider trim handles on the selected segment (tap a segment to select it), a **Pan zoomed timeline** slider, and processing progress/Cancel in a dialog that stays on screen. Time fields open a decimal keypad, select their value on tap, and accept plain seconds with `.` or `,` (for example `65,5`). Phone landscape keeps the preview and playback controls on one screen. Fullscreen uses iPhone's native video player. Where the browser supports file sharing, exports also offer **Share / save** (for example, Save Video to Photos). The project picker accepts any file because iOS greys out unknown extensions such as `.llc`. The contents are still validated. The iOS photo picker may supply a compatibility-converted copy of a video; to cut the untouched original, choose it from the Files app.

## Lossless behavior and limits

Every export uses **`-c copy`**. There is no automatic re-encoding fallback. Container changes remux streams; they do not convert codecs. Incompatible track/container combinations return an error rather than silently dropping a track.

Video cuts are **keyframe-based**, not frame-exact. Output can include preroll, extra end frames, or small timestamp gaps around joins. The editor shows requested boundaries, not a promise of exact output duration. Frame-sized preview seeking uses average FPS and is approximate for variable-frame-rate media. Frame-exact smart cuts and keyframe visualization are not implemented.

The app accepts source files up to **512 MiB** and limits collected downloads to **512 MiB**. Merged intermediate clips are limited to **256 MiB** because intermediates and final output coexist. Input is mounted with WORKERFS rather than copied eagerly into WASM memory; outputs still use MEMFS. Real device memory limits can be lower. Desktop LosslessCut remains appropriate for large files.

Browser preview support is narrower than FFmpeg demuxing support. An unplayable source can still be edited with time fields and exported. MP4/H.264/AAC is the verified baseline. Other formats depend on the shipped FFmpeg core and target container. Subtitles/attachments are not selected by default; inspect **Tracks** to include them.

Projects and downloads are session-local until explicitly saved. Reopen the original media before loading a project. There is no persistent media storage or service-worker offline installation.

## Verification

```sh
npm test
npm run build
# With npm run dev running; requires system Chromium, FFmpeg and ffprobe:
npm run test:browser
# Or against the production preview:
BASE_URL=http://localhost:4173 npm run test:browser
# Before pushing the binary, intercept its GitHub URL with the local fixture:
WASM_FIXTURE=1 BASE_URL=http://localhost:4173 npm run test:browser
```

Set `CHROMIUM=/path/to/chromium` if needed. The browser check exercises mouse/touch scrubbing, cancellation, zoomed/scrolled seeking, trim handles, file-only drag-and-drop, the real WASM worker, editing, undo/redo, project round-trip, separate and merged exports, failed-export recovery, cancellation/retry, and responsive layout. A touch-only pass on a 320px phone then uses every feature through taps, finger drags and the system file picker, and checks 44px targets, overflow and landscape fit at phone sizes. It downloads the actual files, independently decodes them, and compares **every compressed audio/video packet's SHA-256 hash with the source** to prove stream copy on the test fixture. Screenshots and files go to ignored `test-results/`.

`bash scripts/make-sample.sh` regenerates the included original sample using ImageMagick and native FFmpeg.

## Base and research

GPT 6.1 Sol researched the upstream options at the user's request. See [RESEARCH.md](RESEARCH.md) for the decision and primary sources.

The media pipeline in `src/media.ts` adapts **ClipForge's MIT-licensed ffmpeg.wasm pipeline**, with substantial corrections: pinned core assets, single-thread operation, WORKERFS input, stream inspection/selection, exit/output validation, cancellation/retry, bounded output memory, and cleanup. The UI and editor state are authored for this browser edition. No Electron or LosslessCut application source is bundled.

Pinned media packages: `@ffmpeg/ffmpeg@0.12.15`, `@ffmpeg/core@0.12.10`. The single-threaded core does not require COOP/COEP or SharedArrayBuffer. Deploy `dist/` on an HTTPS static host (localhost works during development) with normal JavaScript MIME types and worker support. The WASM core is about 32 MB before HTTP compression and starts downloading during page load.

## License

ClipIt is GPL-2.0-or-later; see [LICENSE](LICENSE). The stock FFmpeg core is GPL-2.0-or-later, the wrapper and ClipForge reuse are MIT, and fonts are SIL OFL. Preserve [third-party notices](public/THIRD_PARTY_NOTICES.md), `public/COPYING`, and the font licenses when distributing. GPL distribution requires corresponding source and build materials for the covered software; source/build references are recorded in the notices. The original sample artwork and sample generator are included under this project's license.
