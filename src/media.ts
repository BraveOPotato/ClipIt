// Adapted from ClipForge's FFmpeg pipeline (MIT, Copyright (c) 2026 Anchit).
// https://github.com/jakharanchit/ClipForge/blob/main/src/lib/ffmpeg.ts
// Changes: local assets, WORKERFS input, probing, explicit stream selection,
// checked exit codes, cancellation/retry, bounded output, and finally cleanup.
import { FFmpeg, FFFSType } from "@ffmpeg/ffmpeg";
import coreURL from "@ffmpeg/core?url";
import wasmURL from "@ffmpeg/core/wasm?url";
import type { Segment } from "./editor";

export type MediaInfo = {
  duration: number;
  width: number;
  height: number;
  fps: number;
  streams: { index: number; type: string; codec: string; language?: string }[];
};
export type ExportedClip = { name: string; url: string; size: number };

let instance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;
let active: symbol | null = null;

async function getFFmpeg(onStatus: (message: string) => void): Promise<FFmpeg> {
  if (instance?.loaded) return instance;
  if (loadPromise) return loadPromise;
  const ffmpeg = new FFmpeg();
  instance = ffmpeg;
  onStatus("Loading the local editing engine");
  loadPromise = ffmpeg
    .load({
      coreURL: new URL(coreURL, location.href).href,
      wasmURL: new URL(wasmURL, location.href).href,
    })
    .then(() => ffmpeg)
    .catch((error) => {
      if (instance === ffmpeg) {
        instance = null;
        loadPromise = null;
        ffmpeg.terminate();
      }
      throw new Error(
        `Could not load the editing engine. Refresh and try again. ${String(error)}`,
      );
    });
  return loadPromise;
}

export function cancelProcessing() {
  instance?.terminate();
  instance = null;
  loadPromise = null;
  active = null;
}

function extensionOf(name: string) {
  return name.match(/\.([a-z0-9]{1,8})$/i)?.[1]?.toLowerCase() || "mkv";
}

async function withSource<T>(
  file: File,
  status: (message: string) => void,
  run: (ffmpeg: FFmpeg, input: string, cleanup: Set<string>) => Promise<T>,
): Promise<T> {
  if (active)
    throw new Error(
      "Another operation is still running. Wait for it to finish.",
    );
  const token = Symbol();
  active = token;
  let ffmpeg: FFmpeg | undefined;
  const cleanup = new Set<string>();
  let mounted = false;
  try {
    ffmpeg = await getFFmpeg(status);
    if (active !== token) throw new Error("Processing cancelled.");
    await ffmpeg.createDir("/source");
    const name = `input.${extensionOf(file.name)}`;
    await ffmpeg.mount(
      FFFSType.WORKERFS,
      { blobs: [{ name, data: file }] },
      "/source",
    );
    mounted = true;
    return await run(ffmpeg, `/source/${name}`, cleanup);
  } finally {
    if (ffmpeg?.loaded) {
      for (const path of cleanup) await ffmpeg.deleteFile(path).catch(() => {});
      if (mounted) await ffmpeg.unmount("/source").catch(() => {});
      await ffmpeg.deleteDir("/source").catch(() => {});
    }
    if (active === token) active = null;
  }
}

export async function inspectMedia(
  file: File,
  status: (message: string) => void,
): Promise<MediaInfo> {
  return withSource(file, status, async (ffmpeg, input, cleanup) => {
    status("Reading your media");
    cleanup.add("probe.json");
    const code = await ffmpeg.ffprobe([
      "-v",
      "error",
      "-show_entries",
      "format=duration:stream=index,codec_name,codec_type,width,height,avg_frame_rate,duration:stream_tags=language",
      "-of",
      "json",
      input,
      "-o",
      "probe.json",
    ]);
    // core 0.12.10 leaves ret=-1 after successful ffprobe; validate its output too.
    if (code !== 0 && code !== -1)
      throw new Error(
        "This file could not be read. Choose a supported video or audio file.",
      );
    const info = JSON.parse(
      (await ffmpeg.readFile("probe.json", "utf8")) as string,
    );
    const streams = (info.streams || []) as {
      index: number;
      codec_type: string;
      codec_name: string;
      width?: number;
      height?: number;
      avg_frame_rate?: string;
      duration?: string;
      tags?: { language?: string };
    }[];
    const duration =
      Number(info.format?.duration) ||
      Math.max(0, ...streams.map((s) => Number(s.duration) || 0));
    if (
      !Number.isFinite(duration) ||
      duration <= 0 ||
      !streams.some((s) => s.codec_type === "video" || s.codec_type === "audio")
    )
      throw new Error(
        "This file has no readable media duration. Try another source file.",
      );
    const video = streams.find((s) => s.codec_type === "video");
    const [numerator, denominator] = (video?.avg_frame_rate || "0/1")
      .split("/")
      .map(Number);
    return {
      duration,
      width: video?.width || 0,
      height: video?.height || 0,
      fps: denominator ? numerator / denominator : 0,
      streams: streams.map((s) => ({
        index: s.index,
        type: s.codec_type,
        codec: s.codec_name,
        language: s.tags?.language,
      })),
    };
  });
}

export async function exportClips(
  file: File,
  segments: Segment[],
  format: string,
  merge: boolean,
  tracks: number[],
  progress: (message: string, value: number | null) => void,
): Promise<ExportedClip[]> {
  if (
    !segments.length ||
    !tracks.length ||
    segments.some(
      (s) =>
        !Number.isFinite(s.start) ||
        !Number.isFinite(s.end) ||
        s.start < 0 ||
        s.end <= s.start,
    )
  )
    throw new Error("Select at least one valid segment and track.");
  return withSource(
    file,
    (label) => progress(label, null),
    async (ffmpeg, input, cleanup) => {
      const extension = format === "original" ? extensionOf(file.name) : format;
      if (!/^[a-z0-9]{1,8}$/.test(extension))
        throw new Error("Unsupported output container.");
      const base = file.name
        .replace(/\.[^.]+$/, "")
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
        .slice(0, 100);
      const results: ExportedClip[] = [];
      const parts: string[] = [];
      let outputBytes = 0;
      let lastLogs: string[] = [];
      const log = ({ message }: { message: string }) => {
        lastLogs = [...lastLogs.slice(-7), message];
      };
      ffmpeg.on("log", log);
      async function execute(args: string[]) {
        lastLogs = [];
        const code = await ffmpeg.exec(args);
        if (code !== 0)
          throw new Error(
            `The selected tracks cannot be copied into this container. Try “Same as source” or MKV, or deselect incompatible tracks.\n${lastLogs.slice(-3).join("\n")}`,
          );
      }
      async function collect(path: string, name: string) {
        const data = await ffmpeg.readFile(path);
        if (!(data instanceof Uint8Array) || !data.byteLength)
          throw new Error("The export is empty. Choose a longer segment.");
        outputBytes += data.byteLength;
        if (outputBytes > 512 * 1024 * 1024)
          throw new Error(
            "This export exceeds the 512 MB browser budget. Export fewer segments at once.",
          );
        const mime: Record<string, string> = {
          mp4: "video/mp4",
          mov: "video/quicktime",
          mkv: "video/x-matroska",
          webm: "video/webm",
          mp3: "audio/mpeg",
          m4a: "audio/mp4",
          wav: "audio/wav",
        };
        const blob = new Blob([data], {
          type: mime[extension] || "application/octet-stream",
        });
        results.push({ name, url: URL.createObjectURL(blob), size: blob.size });
        await ffmpeg.deleteFile(path);
        cleanup.delete(path);
      }
      try {
        for (const [i, s] of segments.entries()) {
          progress(
            `Cutting segment ${i + 1} of ${segments.length}`,
            i / (segments.length + (merge ? 1 : 0)),
          );
          const path = `clip-${i}.${extension}`;
          cleanup.add(path);
          parts.push(path);
          // Stream copy is intentionally keyframe-based: no transcoding fallback.
          await execute([
            "-ss",
            String(s.start),
            "-i",
            input,
            "-t",
            String(s.end - s.start),
            ...tracks.flatMap((index) => ["-map", `0:${index}`]),
            "-map_metadata",
            "0",
            "-c",
            "copy",
            "-avoid_negative_ts",
            "make_zero",
            path,
          ]);
          if (!merge)
            await collect(
              path,
              `${base}-${String(i + 1).padStart(2, "0")}${s.name ? `-${s.name.replace(/[^a-zA-Z0-9 _-]/g, "_").slice(0, 60)}` : ""}.${extension}`,
            );
          else {
            // ponytail: MEMFS buffers merged intermediates; use a streaming remuxer for larger projects.
            const sizeFile = `size-${i}.txt`;
            cleanup.add(sizeFile);
            const code = await ffmpeg.ffprobe([
              "-v",
              "error",
              "-show_entries",
              "format=size",
              "-of",
              "default=noprint_wrappers=1:nokey=1",
              path,
              "-o",
              sizeFile,
            ]);
            const bytes = Number(await ffmpeg.readFile(sizeFile, "utf8"));
            if (
              (code !== 0 && code !== -1) ||
              !Number.isFinite(bytes) ||
              bytes <= 0
            )
              throw new Error("Could not verify the intermediate export.");
            outputBytes += bytes;
            if (outputBytes > 256 * 1024 * 1024)
              throw new Error(
                "Merged exports are limited to 256 MB of intermediate clips. Export fewer or shorter segments.",
              );
          }
        }
        if (merge) {
          progress(
            "Merging your segments",
            segments.length / (segments.length + 1),
          );
          cleanup.add("concat.txt");
          await ffmpeg.writeFile(
            "concat.txt",
            parts.map((path) => `file '${path}'`).join("\n"),
          );
          const path = `merged.${extension}`;
          cleanup.add(path);
          // All clips share one source/configuration; skip redundant H.264 header injection.
          await execute([
            "-f",
            "concat",
            "-safe",
            "0",
            "-auto_convert",
            "0",
            "-i",
            "concat.txt",
            "-map",
            "0",
            "-c",
            "copy",
            "-avoid_negative_ts",
            "make_zero",
            path,
          ]);
          outputBytes = 0;
          await collect(path, `${base}-merged.${extension}`);
        }
        progress("Export complete", 1);
        return results;
      } catch (error) {
        results.forEach((result) => URL.revokeObjectURL(result.url));
        throw error;
      } finally {
        ffmpeg.off("log", log);
      }
    },
  );
}
