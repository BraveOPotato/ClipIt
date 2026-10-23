# Browser LosslessCut base research

Research delegated to **GPT 6.1 Sol** on October 16, 2026. Primary sources were inspected, followed by implementation-time browser verification.

## Decision

Use **ClipForge's ffmpeg.wasm export pipeline as a starting point**, with a new browser-native UI. Keep `-c copy` as an invariant. The actual LosslessCut application is strongly coupled to Electron, Node filesystem access, native subprocesses, and native FFmpeg/ffprobe; transplanting the entire app would require considerably more replacement code.

### Candidates

- **[LosslessCut](https://github.com/mifi/lossless-cut)** — GPL-2.0-only, established desktop workflow. Pure segment logic is reusable, but its [renderer FFmpeg module](https://github.com/mifi/lossless-cut/blob/master/src/renderer/src/ffmpeg.ts) and [main processing module](https://github.com/mifi/lossless-cut/blob/master/src/main/ffmpeg.ts) rely on desktop APIs. Its [project store](https://github.com/mifi/lossless-cut/blob/master/src/renderer/src/edlStore.ts) establishes `.llc` as JSON5 with v1/v2 schemas. Used as a workflow/file-format reference, not copied application code.
- **[ClipForge](https://github.com/jakharanchit/ClipForge)** — MIT, React/TypeScript/Vite, client-side segment editing and ffmpeg.wasm exports. Selected as the processing base. Its [exporter](https://github.com/jakharanchit/ClipForge/blob/main/src/lib/ffmpeg.ts) needed checked failures, explicit track mapping, local assets, retryable initialization, cancellation, and cleanup. Other upstream export presets re-encode; only the lossless stream-copy path was adapted.
- **[htmlapps-lossless-video-cutter](https://github.com/ttomohisa/htmlapps-lossless-video-cutter)** — browser-local, MIT application, custom LGPL core, WORKERFS, offline packaging. A good single-range tool, but its custom runtime/build workflow was less convenient for this multi-segment React app.
- **[web-lossless-cut](https://github.com/XtracT/web-lossless-cut)** — browser UI backed by Node/Docker processing; does not meet browser-only execution.
- **[Mediabunny](https://github.com/Vanilagy/mediabunny)** — MPL-2.0, a promising streaming media foundation. Version [1.56.0](https://github.com/Vanilagy/mediabunny/releases/tag/v1.56.0) added lossless conversion of arbitrary trim ranges. `copy: { mode: 'forced', boundaryPolicy: 'expand' }` prevents transcoding, but discarded tracks must be checked. Same-source concatenation would require more custom packet/timestamp logic. Prefer this for a future streaming / large-file version, rather than adding a second engine now.
- **[MP4Box.js](https://github.com/gpac/mp4box.js)** — BSD-3-Clause, incremental MP4 parsing and sample extraction; too low-level and MP4-specific to be the shortest complete editing base.

## Practical findings

1. `@ffmpeg/ffmpeg` and `@ffmpeg/core` have independent versions. This app pins wrapper **0.12.15** and single-thread core **0.12.10**, uses the current `FFmpeg` class API, and self-hosts both core assets through Vite.
2. Single-threaded workers avoid cross-origin isolation requirements. Stream copy has little need for multi-threaded codec acceleration.
3. WORKERFS accepts File/Blob input without eagerly copying the whole source into WASM memory. Output files are still memory-backed, so the app uses conservative source/output limits.
4. Lossless cuts depend on keyframes and packet boundaries. `-ss`/`-t` are requested marks, not a guarantee of frame-exact independent clips. MP4 edit lists and B-frames also affect apparent durations. See [FFmpeg seeking/stream-copy docs](https://ffmpeg.org/ffmpeg.html).
5. Same-source concat uses the [concat demuxer](https://ffmpeg.org/ffmpeg-formats.html#concat-1), explicit stream mapping, and `-c copy`. Disabling concat's automatic bitstream conversion avoids unnecessary H.264 header insertion for clips with identical source decoder configuration.
6. Actual browser execution exposed a **core 0.12.10 ffprobe quirk**: successful probes can return `-1` with valid JSON. The implementation checks both the return code and the parsed metadata/output instead of treating `-1` alone as a definitive failure. Normal FFmpeg exports still require exit code zero.
7. Upstream code review is not export verification. The included browser check independently downloads, probes, decodes, and packet-hash-compares the produced media; separate and merged sample exports passed.

## License notes

ClipForge's MIT notice is preserved. The stock ffmpeg.wasm core is **GPL-2.0-or-later**, irrespective of whether only stream copy is used. The wrapper's MIT license does not replace the core's license. ClipIt uses GPL-2.0-or-later and includes source/build links and notices. Reusing actual LosslessCut code in a later version requires observing its GPL-2.0-only terms. See [FFmpeg legal information](https://ffmpeg.org/legal.html).
