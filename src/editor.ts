export type Segment = {
  id: string;
  name: string;
  start: number;
  end: number;
  enabled: boolean;
};
export type Edit = { segments: Segment[]; selected: string | null };

export function segment(start: number, end: number, name = ""): Segment {
  return { id: crypto.randomUUID(), name, start, end, enabled: true };
}

export function formatTime(seconds: number, precise = true): string {
  const ms = Math.round(
    Math.max(0, Number.isFinite(seconds) ? seconds : 0) * 1000,
  );
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor(ms / 60000) % 60;
  const secs = Math.floor(ms / 1000) % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}${precise ? `.${String(ms % 1000).padStart(3, "0")}` : ""}`;
}

export function parseTime(value: string): number | null {
  // Phone decimal keypads show "," instead of "." in many locales.
  const text = value.trim().replace(",", ".");
  if (!/^\d+(?::[0-5]?\d){0,2}(?:\.\d{1,3})?$/.test(text)) return null;
  const parts = text.split(":").map(Number);
  return parts.reduce((total, part) => total * 60 + part, 0);
}

export function splitSegment(edit: Edit, time: number): Edit {
  const current = edit.segments.find((s) => s.id === edit.selected);
  if (!current || time <= current.start + 0.001 || time >= current.end - 0.001)
    return edit;
  const right = segment(
    time,
    current.end,
    current.name ? `${current.name} (2)` : "",
  );
  right.enabled = current.enabled;
  return {
    selected: right.id,
    segments: edit.segments.flatMap((s) =>
      s.id === current.id ? [{ ...s, end: time }, right] : [s],
    ),
  };
}

export function invertSegments(
  segments: Segment[],
  duration: number,
): Segment[] {
  const sorted = segments
    .filter((s) => s.enabled)
    .sort((a, b) => a.start - b.start);
  const result: Segment[] = [];
  let cursor = 0;
  for (const s of sorted) {
    if (s.start > cursor + 0.001) result.push(segment(cursor, s.start));
    cursor = Math.max(cursor, s.end);
  }
  if (cursor < duration - 0.001) result.push(segment(cursor, duration));
  return result;
}

export function readProject(text: string, duration: number): Segment[] {
  const data = JSON5.parse(text);
  if (
    !data ||
    (data.version !== undefined && data.version !== 1 && data.version !== 2) ||
    !Array.isArray(data.cutSegments) ||
    data.cutSegments.length > 1000
  )
    throw new Error(
      "Choose a valid LosslessCut / ClipIt project (v1 or v2) with up to 1,000 segments.",
    );
  return data.cutSegments.map(
    (s: {
      start?: unknown;
      end?: unknown;
      name?: unknown;
      enabled?: unknown;
    }) => {
      if (!s || typeof s !== "object")
        throw new Error("The project contains an invalid segment.");
      const start = s.start === undefined ? 0 : s.start;
      const end = s.end === undefined ? duration : s.end;
      if (
        typeof start !== "number" ||
        typeof end !== "number" ||
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        start < 0 ||
        end > duration + 0.05 ||
        start >= Math.min(end, duration)
      ) {
        throw new Error(
          "Project segments fall outside this video. Open the matching source file first.",
        );
      }
      return {
        ...segment(
          start,
          Math.min(end, duration),
          typeof s.name === "string" ? s.name : "",
        ),
        enabled: s.enabled !== false,
      };
    },
  );
}

export function writeProject(fileName: string, segments: Segment[]): string {
  return JSON.stringify(
    {
      version: 2,
      mediaFileName: fileName,
      cutSegments: segments.map(({ start, end, name, enabled }) => ({
        start,
        end,
        name,
        enabled,
      })),
    },
    null,
    2,
  );
}

export function fileSize(bytes: number): string {
  return bytes >= 1024 ** 3
    ? `${(bytes / 1024 ** 3).toFixed(2)} GB`
    : bytes >= 1024 ** 2
      ? `${(bytes / 1024 ** 2).toFixed(1)} MB`
      : `${Math.ceil(bytes / 1024)} KB`;
}
import JSON5 from "json5";
