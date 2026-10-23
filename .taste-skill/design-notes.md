# ClipIt editor redesign

## Brief and inventory
An actual editing workspace for people making lossless cuts from local media. Primary job: open media, mark ranges, export original streams.
Subject inventory: ClipIt's cut/keep name; local-only FFmpeg worker; no upload/account; stream-copy exports; keyframe-aligned boundaries; 512 MB source limit; Orbit original 12-second sample; editable I/O marks; multiple named ranges; LosslessCut project compatibility; original-source preview; per-stream export selection.
Available imagery: original Orbit video, its source artwork, and extracted real video frames. No stock imagery is appropriate for this functional editor.

## Argument / copy deck
- Open: “Keep the good parts.” / “Cut video and audio without re-encoding. Your files stay on this device.” / “Open file” / “or drop media here · up to 512 MB”. Proof: functioning local file picker and processor.
- Try: “Try the sample” / “Orbit / 12-second original”. Proof: the bundled original media opens in the real editor.
- Preview: source name, size, dimensions, playback, current/total time. Proof: real metadata and video.
- Cut: “Timeline” / “Drag to seek. Pull the edges to trim.” / “Mark in”, “Start time”, “End time”, “Mark out”. Proof: editable timeline and time fields.
- Keep: “Segments” / “Your kept moments” / “No segments yet” / “Open a file, then mark a start and end. Each range becomes a segment.” Proof: selected ranges, names, inclusion, delete, save/load.
- Export: “Export” / “Container” / “Merge selected segments” / “Stream copy. No re-encoding.” / “Cuts snap to nearby keyframes.” Proof: existing actual lossless exports and downloads.

## Direction and idea
Dealt: The product performs, seed 2023749905. No redraws. This is an app, so the marketing-section templates are adapted to a real monitor/inspector/timeline workbench rather than a landing-page scroll. The dealt night/cornflower roles are kept. DM Sans, already self-hosted in the product, takes the type role, consistent with the direction's instruction to match the real product font.

On this page, ClipIt's original Orbit film becomes the working material of a full-width cutting bench.
Live thing: open the actual sample, scrub it, cut it and download lossless ranges.

## Tokens and composition
Colors: ground #0a0d14; surface #131824; raised #1d2533; ink #e9edf3; secondary #a4aebd; action #5a9bfc. Error/segment colors are semantic.
Type: DM Sans throughout, tabular numerals for time. 13px secondary, 15px controls, 17px body, 24px subheads, fluid 40–64px empty-state headline. No mono.
Desktop:
```
wordmark       local-first editor                 open file
source preview / sample invitation     segments + export
transport                             segments + export
timeline tools ----------------------------------------
ruler / source film / kept ranges ----------------------
mark in | time fields | mark out         selected duration
```
Phone: source + preview, two-row transport, full-width timeline, mark controls in a two-column grid, segments, export. Touch targets at least 44px for primary interactions. Functional timeline ticks and playhead lines convey time, not ornament.
Uniqueness review: replace the generic centered empty dropzone with the app's own playable sample; let the timeline span the whole bench instead of trapping it beside an export card; reserve strong blue for actions and selected ranges. No invented metrics or testimonials.

## Baseline critique
ROUND 0
Seen in one second: a dark purple empty panel.
Idea (one sentence): a conventional video-editor shell.
Live thing: sample video, buried in a small text link.
Layout words by section: preview=centered / timeline=boxed / inspector=stacked.
Scores: design 5.5 · usability 5.5 · creativity 5 · content 7 → overall 5.55.
Caps applied: initial inspector failures (9), tiny text, decorative hairlines, mono labels.
Top three problems:
1. desktop-fold.jpg: most controls and helper copy are 9–12px. Raise the real control sizes and contrast.
2. desktop-fold.jpg: the main editing surface is crowded while the preview and segment empty state are mostly empty. Full-width timeline, compact inspector.
3. mobile-fold.jpg: time labels collide and mark controls are squeezed. Fewer ruler labels and a separate mobile control layout.

## Scope of the marketing inspector
Run the gate and review all three widths, but app control density, functional timeline rules, fewer decorative photographs, and interaction-only motion are deliberate exceptions. Do not add unrelated imagery or animate working editing controls to satisfy marketing quotas.

## Review rounds
ROUND 1
Seen in one second: the Orbit sample beside a large invitation to cut.
Idea (one sentence): ClipIt's original Orbit film becomes the working material of a full-width cutting bench.
Live thing: the sample opens in the actual cutter.
Layout words by section: invitation=split / monitor=stage / inspector=stack / timeline=full-width.
Scores: design 7 · usability 7 · creativity 7 · content 8 → overall 7.1 (app-adapted rubric).
Caps applied: marketing-only image-count/focal-size/motion quotas not applicable to a functioning editor; all other checks enforced.
Top three problems:
1. review-1/desktop-fold.jpg: the sample's 4:3 crop cuts the Orbit title. Restore the actual 16:9 frame.
2. review-1/desktop-fold.jpg: expanded export settings and duplicate add controls push the cutting bench below the fold. Collapse export options natively and remove the duplicate Add action.
3. review-1/mobile-page-01.jpg: the initial inspector remains too tall for its content. Reduce redundant blocks; retain the export action and keyframe guidance.

ROUND 2
Seen in one second: source monitor, cutting bench, export action.
Idea (one sentence): ClipIt's original Orbit film becomes the working material of a full-width cutting bench.
Live thing: mouse, keyboard and touch scrubbing, trimming and real stream-copy exports.
Layout words by section: invitation=split / monitor=stage / inspector=stack / timeline=full-width.
Scores: design 7.5 · usability 7.5 · creativity 7 · content 8 → overall 7.45 (app-adapted rubric).
Caps applied: same explicit app-specific adaptations.
Top three problems:
1. test-results/mobile-editor.png: a save/import toast covers mark fields. Move routine confirmations into the existing live status bar.
2. test-results/debug-editor.png: the playhead is clipped at the left endpoint. Give the timeline scrollport real side padding for both endpoint handles.
3. review-2/mobile-fold.jpg: a lone plus has weak discoverability. Add a visible “Add” label; enlarge mobile time-field text to 16px.

ROUND 3
Seen in one second: the media itself, with blue kept ranges below.
Idea (one sentence): ClipIt's original Orbit film becomes the working material of a full-width cutting bench.
Live thing: open the sample, scrub, trim, export.
Layout words by section: invitation=split / monitor=stage / inspector=stack / timeline=full-width.
Scores: design 7.8 · usability 8 · creativity 7 · content 8 → overall 7.74 (app-adapted rubric, subjective self-review).
Caps applied: the three marketing-only thresholds are explicitly allowed, rather than adding decorative media or animated editing controls.
Remaining limitations:
1. Very short segments truncate their names at phone width; the segment list retains full names and timeline zoom is available.
2. Many segments or expanded export options can require scrolling on shorter laptops.
3. Mobile keeps preview/timeline before the inspector, so exporting requires scrolling below the editing controls.

## Final verification
- `npm test`: passed editor logic and project round-trip checks.
- `npm run build`: passed TypeScript and production build.
- `npm run test:browser`: passed real mouse and touch scrubbing, cancellation/restart, pointer capture beyond targets, right-button rejection, keyboard endpoints, no selected text/native drags/drop overlay, segment-handle undo, zoomed/scrolled seeking, text-vs-file drag discrimination and a real file drop. Also passed actual FFmpeg exports, compressed-packet identity, independent decode, failure recovery, cancellation/retry, responsive overflow and reduced-motion checks.
- Source lint: zero failures. Two warnings are legitimate zero-padding for timecodes and exported file names.
- Final browser inspector: 1440, 768, 390px; zero failures with `--allow few-pictures,focal-point,still-page`. One defended no-footage warning: the empty state waits for the visitor to open the original sample instead of autoplaying media. Loaded-state screenshots in `test-results/` show the actual video and generated thumbnails.
- The final empty-state screenshots and loaded desktop/tablet/mobile screenshots were opened and reviewed.

## Assets and launch content
No found photographs, stock imagery, external clips, new fonts or dependencies. `public/sample-poster.jpg` is an actual frame extracted from this project's original `public/sample.mp4`; `scripts/make-sample.sh` now reproduces it. The sample artwork is `scripts/sample.svg`, project-authored, GPL-2.0-or-later under the existing project licence. Its caption says “Orbit · 12-second original”; the film includes the ClipIt Original credit. The only placeholder content is the existing intentionally labelled demo film. No customer claims or launch content need replacement.
