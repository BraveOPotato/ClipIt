import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

// Run against npm run dev, or BASE_URL=http://localhost:4173 npm run test:browser.
// Requires Chromium and native ffprobe (for independent packet-level verification).
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 960 },
  acceptDownloads: true,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await mkdir("test-results", { recursive: true });

function probe(path) {
  return JSON.parse(
    execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_format",
        "-show_streams",
        "-show_packets",
        "-show_data_hash",
        "sha256",
        "-of",
        "json",
        path,
      ],
      { maxBuffer: 20 * 1024 * 1024 },
    ),
  );
}
const source = probe("public/sample.mp4");
const sourcePackets = new Set(source.packets.map((p) => p.data_hash));
async function field(label, value) {
  await page.getByRole("textbox", { name: label, exact: true }).fill(value);
  await page.getByRole("textbox", { name: label, exact: true }).press("Enter");
}
async function ready() {
  await page.waitForFunction(
    () =>
      !document.querySelector(".processing") &&
      !!document.querySelector("video"),
    undefined,
    { timeout: 60000 },
  );
}
async function collectDownloads(prefix, count) {
  await page
    .getByRole("heading", { name: "Your cuts are ready." })
    .waitFor({ timeout: 60000 });
  const links = page.locator(".download-list a");
  assert.equal(await links.count(), count);
  const paths = [];
  for (let i = 0; i < count; i++) {
    const event = page.waitForEvent("download");
    await links.nth(i).click();
    const download = await event;
    const path = `test-results/${prefix}-${i}.mp4`;
    await download.saveAs(path);
    const out = probe(path);
    assert.equal(out.streams[0].codec_name, "h264");
    assert.equal(out.streams[1].codec_name, "aac");
    assert.ok(
      Number(out.format.duration) > 0.9 && Number(out.format.duration) < 8,
      "Export has the intended short duration",
    );
    assert.ok(out.packets.length > 30);
    assert.ok(
      out.packets.every((p) => sourcePackets.has(p.data_hash)),
      "Every exported encoded packet must match a source packet (no re-encoding)",
    );
    // Full decode catches broken starts / invalid container structures.
    execFileSync("ffmpeg", [
      "-v",
      "error",
      "-i",
      path,
      "-fps_mode",
      "passthrough",
      "-enc_time_base",
      "demux",
      "-f",
      "null",
      "-",
    ]);
    paths.push(path);
  }
  await page.getByRole("button", { name: "Close dialog" }).click();
  return paths;
}

try {
  await page.goto(process.env.BASE_URL || "http://localhost:5173");
  await page.getByRole("heading", { name: "Keep the good parts." }).waitFor();
  await page.screenshot({
    path: "test-results/desktop-empty.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Try the sample" })
    .click();
  await ready();
  await page.waitForFunction(
    () => document.querySelector("video")?.readyState >= 2,
  );
  assert.equal(await page.locator("video").evaluate((v) => v.duration), 12);

  // Scrubbing must remain a pointer interaction, never native text/file dragging.
  const ruler = page.getByRole("slider", { name: "Playhead position" });
  const timeline = await page.locator(".timeline-content").boundingBox();
  await page.evaluate(() => {
    window.getSelection().removeAllRanges();
    window.nativeDrags = 0;
    document.addEventListener("dragstart", () => window.nativeDrags++);
  });
  async function assertScrub(fraction) {
    assert.ok(Math.abs(Number(await ruler.getAttribute("aria-valuenow")) - 12 * fraction) < 0.1);
    assert.equal(await page.evaluate(() => window.getSelection().toString()), "", "Scrubbing must not select text");
    assert.equal(await page.locator(".drop-overlay").count(), 0, "Scrubbing must not show the file drop overlay");
    assert.equal(await page.evaluate(() => window.nativeDrags), 0, "Scrubbing must not start a native drag");
  }
  for (const selector of [".ruler", ".filmstrip", ".playhead-handle"]) {
    await ruler.click({ position: { x: timeline.width * 0.2, y: 10 } });
    const box = await page.locator(selector).boundingBox();
    await page.mouse.move(box.x + (selector === ".playhead-handle" ? box.width / 2 : box.width * 0.2), box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(timeline.x + timeline.width * 0.7, box.y + box.height / 2, { steps: 20 });
    await assertScrub(0.7);
    // Capture keeps dragging when the pointer leaves the original target.
    await page.mouse.move(timeline.x - 10, timeline.y - 15, { steps: 6 });
    await assertScrub(0);
    await page.mouse.up();
    await page.mouse.move(timeline.x + timeline.width * 0.8, box.y + box.height / 2);
    await assertScrub(0);
  }
  await ruler.click({ button: "right", position: { x: timeline.width * 0.5, y: 10 } });
  await assertScrub(0);
  await page.keyboard.press("Escape");
  await ruler.focus();
  await page.keyboard.press("End");
  await assertScrub(1);
  await page.keyboard.press("Home");
  await page.keyboard.press("Shift+ArrowRight");
  await assertScrub(5 / 12);

  // Trim handles share the selection protection and commit a single undoable edit.
  for (const [edge, fraction] of [["start", 0.2], ["end", 0.8]]) {
    const handle = page.getByRole("button", { name: `Drag segment 1 ${edge}`, exact: true });
    const box = await handle.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(timeline.x + timeline.width * fraction, box.y + box.height / 2, { steps: 12 });
    assert.equal(await page.evaluate(() => window.getSelection().toString()), "");
    assert.equal(await page.locator(".drop-overlay").count(), 0);
    await page.mouse.up();
    const value = await page.getByRole("textbox", { name: edge === "start" ? "Start time" : "End time", exact: true }).inputValue();
    assert.equal(value, edge === "start" ? "00:00:02.400" : "00:00:09.600");
    await page.getByRole("button", { name: "Undo (Ctrl+Z)", exact: true }).click();
    await page.waitForFunction(() => document.querySelector('input[aria-label="Start time"]').value === "00:00:00.000" && document.querySelector('input[aria-label="End time"]').value === "00:00:12.000");
    assert.equal(await page.getByRole("textbox", { name: "Start time", exact: true }).inputValue(), "00:00:00.000");
    assert.equal(await page.getByRole("textbox", { name: "End time", exact: true }).inputValue(), "00:00:12.000");
  }

  await page.evaluate(() => {
    const dataTransfer = new DataTransfer();
    dataTransfer.setData("text/plain", "selected timeline text");
    document.querySelector(".app").dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer }));
  });
  assert.equal(await page.locator(".drop-overlay").count(), 0, "Text drags anywhere in the app are not media drops");
  await page.evaluate(() => {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File([""], "media.mp4", { type: "video/mp4" }));
    document.querySelector(".app").dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer }));
  });
  assert.equal(await page.locator(".drop-overlay").count(), 1, "External file drags still show the media drop target");
  await page.locator(".app").dispatchEvent("dragleave");
  assert.equal(await page.locator(".drop-overlay").count(), 0);
  await page.evaluate(async () => {
    const blob = await (await fetch("/sample.mp4")).blob();
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File([blob], "Dropped sample.mp4", { type: "video/mp4" }));
    document.querySelector(".app").dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer }));
  });
  await ready();
  assert.match(await page.locator(".source-title").textContent(), /Dropped sample/);
  assert.equal(await page.locator(".track-row").count(), 0);
  await page.getByRole("button", { name: "Tracks", exact: true }).click();
  assert.equal(await page.locator(".track-row").count(), 2);
  await page
    .getByRole("button", { name: "Segments", exact: false })
    .first()
    .click();

  await field("Start time", "2");
  await field("End time", "6");
  await page.locator("video").evaluate((v) => {
    v.currentTime = 4;
  });
  await page.waitForFunction(() =>
    document.querySelector(".timecode")?.textContent.startsWith("00:00:04.000"),
  );
  await page.locator(".source-title").click();
  await page.keyboard.press("b");
  assert.equal(await page.locator(".segment-card").count(), 2);
  await page.keyboard.press("Control+z");
  assert.equal(await page.locator(".segment-card").count(), 1);
  await page.keyboard.press("Control+Shift+z");
  assert.equal(await page.locator(".segment-card").count(), 2);
  await page
    .getByRole("textbox", { name: "Segment 1 name" })
    .fill("First orbit");
  await page.getByRole("textbox", { name: "Segment 1 name" }).press("Tab");

  const projectEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save project" }).click();
  const project = await projectEvent;
  await project.saveAs("test-results/project.llc");
  const projectJSON = JSON.parse(
    await readFile("test-results/project.llc", "utf8"),
  );
  assert.deepEqual(
    projectJSON.cutSegments.map((s) => [s.start, s.end]),
    [
      [2, 4],
      [4, 6],
    ],
  );
  await page
    .getByRole("button", { name: "Delete segment 2", exact: true })
    .click();
  assert.equal(await page.locator(".segment-card").count(), 1);
  await page
    .locator('input[accept=".llc,.json"]')
    .setInputFiles("test-results/project.llc");
  await page.waitForFunction(
    () => document.querySelectorAll(".segment-card").length === 2,
  );
  assert.equal(await page.locator(".segment-card").count(), 2);

  await page.getByRole("button", { name: "Export 2 segments" }).click();
  await collectDownloads("separate", 2);
  await page.locator(".export-options summary").click();
  await page.getByRole("checkbox", { name: "Merge selected segments" }).check();
  await page.getByRole("button", { name: "Export 2 segments" }).click();
  await collectDownloads("merged", 1);

  // A failed mux must not poison the worker or destroy the source / edit state.
  await page.locator(".select-wrap select").selectOption("mp3");
  await page.getByRole("button", { name: "Export 2 segments" }).click();
  await page.getByRole("alert").waitFor({ timeout: 30000 });
  assert.match(await page.getByRole("alert").textContent(), /cannot be copied/);
  await page.getByRole("button", { name: "Dismiss error" }).click();
  await page.locator(".select-wrap select").selectOption("original");
  await page.getByRole("button", { name: "Export 2 segments" }).click();
  await collectDownloads("retry", 1);

  await page.getByRole("button", { name: "Invert", exact: true }).click();
  assert.match(
    await page.locator(".segment-range").first().textContent(),
    /00:00:00.000.*00:00:02.000/,
  );
  await page
    .getByRole("button", { name: "Undo (Ctrl+Z)", exact: true })
    .click();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  assert.equal(
    await page.locator(".timeline-content").evaluate((e) => e.style.width),
    "200%",
  );
  await page.locator(".timeline-scroll").evaluate((e) => { e.scrollLeft = e.clientWidth / 2; });
  const zoomed = await page.locator(".timeline-content").boundingBox();
  const viewport = await page.locator(".timeline-scroll").boundingBox();
  const zoomX = viewport.x + viewport.width * 0.6;
  await page.mouse.move(viewport.x + 20, zoomed.y + 12);
  await page.mouse.down();
  await page.mouse.move(zoomX, zoomed.y + 12, { steps: 10 });
  await assertScrub((zoomX - zoomed.x) / zoomed.width);
  await page.mouse.up();
  await page.getByRole("button", { name: "Zoom out", exact: true }).click();
  await page.locator(".export-options summary").click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "test-results/desktop-editor.png",
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "Mobile layout must not overflow horizontally",
  );
  // Real touch input: capture, cancellation and a subsequent gesture all work.
  await ruler.scrollIntoViewIfNeeded();
  const touchRuler = await ruler.boundingBox();
  const cdp = await page.context().newCDPSession(page);
  const touch = async (type, fraction) => cdp.send("Input.dispatchTouchEvent", {
    type,
    touchPoints: fraction === undefined ? [] : [{ x: touchRuler.x + touchRuler.width * fraction, y: touchRuler.y + 18 }],
  });
  await touch("touchStart", 0.25);
  await touch("touchMove", 0.75);
  await assertScrub(0.75);
  await touch("touchCancel");
  await touch("touchStart", 0.5);
  await touch("touchMove", 0.6);
  await touch("touchEnd");
  await assertScrub(0.6);
  await cdp.detach();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "test-results/mobile-editor.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "All shortcuts" }).click();
  await page
    .getByRole("heading", { name: "A few keys. Faster cuts." })
    .waitFor();
  await page.keyboard.press("Escape");
  await page.locator("dialog").waitFor({ state: "detached", timeout: 5000 });

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.evaluate(() => window.scrollTo(0, 0));
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Tablet layout must not overflow");
  await page.screenshot({ path: "test-results/tablet-editor.png", fullPage: true });
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(await page.locator(".switch").evaluate((e) => getComputedStyle(e, "::after").transitionDuration), "0s");

  // Cancel loading, then retry. A terminated loading promise must not be cached.
  const retry = await browser.newPage();
  await retry.route("**/*.wasm*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue().catch(() => {});
  });
  await retry.goto(process.env.BASE_URL || "http://localhost:5173");
  await retry
    .getByRole("button", { name: "Try the sample" })
    .click();
  await retry.getByRole("button", { name: "Cancel", exact: true }).click();
  await retry
    .getByRole("button", { name: "Try the sample" })
    .click();
  await retry.waitForFunction(
    () =>
      !document.querySelector(".processing") &&
      !!document.querySelector("video"),
    undefined,
    { timeout: 60000 },
  );
  await retry.close();
  assert.deepEqual(errors, [], "No uncaught browser errors");
  console.log(
    "PASS: pointer scrubbing, trim drags, text-selection protection, file-only drag overlay, real file drop, keyboard seeking, real WASM import, segment edits, undo/redo, project round-trip, individual + merged downloads, packet-identical stream copy, decode validation, failure recovery, cancellation/retry, and responsive layout.",
  );
} finally {
  await browser.close();
}
