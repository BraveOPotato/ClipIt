# ClipIt third-party notices

## ClipForge

`src/media.ts` adapts the loading, trimming, and concatenation workflow from:
https://github.com/jakharanchit/ClipForge/blob/main/src/lib/ffmpeg.ts

MIT License

Copyright (c) 2026 Anchit

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## FFmpeg WebAssembly

- `@ffmpeg/ffmpeg` 0.12.15: MIT. Source and license: https://github.com/ffmpegwasm/ffmpeg.wasm/tree/main/packages/ffmpeg
- `@ffmpeg/core` 0.12.10: GPL-2.0-or-later. Core build scripts, component versions and licensing: https://github.com/ffmpegwasm/ffmpeg.wasm
- FFmpeg source: https://github.com/ffmpegwasm/FFmpeg
- Build instructions: https://ffmpegwasm.netlify.app/docs/contribution/core/
- FFmpeg licensing information: https://ffmpeg.org/legal.html

The stock core includes third-party codec libraries and is licensed under the GPL even when used only for stream copy. The GPL v2 text is included at `/COPYING`. When distributing binaries, supply the corresponding source and build materials for the covered versions under the applicable GPL terms; this notice does not substitute for the source-distribution obligation.

## Application runtime dependencies

The complete installed license texts for React, React DOM, Scheduler, Lucide React, JSON5 and the ffmpeg.wasm wrapper are included at `/DEPENDENCY_LICENSES.txt`. Dependency versions are pinned in the application's `package-lock.json`.

## Fonts

- DM Sans: SIL Open Font License 1.1. Copyright and license: `/fonts/DM-Sans-OFL.txt`.
- IBM Plex Mono: SIL Open Font License 1.1. Copyright and license: `/fonts/IBM-Plex-Mono-OFL.txt`.

Fonts are self-hosted and unmodified.

## LosslessCut

Workflow and project-format reference: https://github.com/mifi/lossless-cut

ClipIt is independent and is not endorsed by or affiliated with LosslessCut. No LosslessCut application source code is included in this edition.
