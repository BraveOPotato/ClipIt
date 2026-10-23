import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatTime,
  parseTime,
  segment,
  splitSegment,
  invertSegments,
  readProject,
  writeProject,
} from "./editor.ts";

test("editing preserves valid ranges, overlapping inversion, and project round trips", () => {
  assert.equal(formatTime(59.9999), "00:01:00.000");
  assert.equal(parseTime("01:02:03.125"), 3723.125);
  assert.equal(parseTime("00:67:00"), null);
  assert.equal(parseTime("-2"), null);
  const first = segment(2, 8, "Keep");
  const edit = { segments: [first], selected: first.id };
  assert.equal(splitSegment(edit, 2), edit);
  const split = splitSegment(edit, 5);
  assert.deepEqual(
    split.segments.map((s) => [s.start, s.end]),
    [
      [2, 5],
      [5, 8],
    ],
  );
  assert.deepEqual(
    invertSegments([segment(2, 6), segment(4, 8)], 10).map((s) => [
      s.start,
      s.end,
    ]),
    [
      [0, 2],
      [8, 10],
    ],
  );
  assert.deepEqual(
    readProject(writeProject("video.mp4", split.segments), 10).map(
      ({ id, ...s }) => s,
    ),
    split.segments.map(({ id, ...s }) => s),
  );
  assert.throws(() =>
    readProject('{"cutSegments":[{"start":8,"end":12}]}', 10),
  );
  assert.throws(() =>
    readProject('{"cutSegments":[{"start":"1","end":4}]}', 10),
  );
  assert.throws(() => readProject("{cutSegments:[{start:10,end:10.01}]}", 10));
  assert.throws(() => readProject("{cutSegments:[null]}", 10));
  assert.throws(() => readProject("{version:3,cutSegments:[]}", 10));
  assert.deepEqual(
    readProject(
      "{version:2, /* LosslessCut writes JSON5 */ cutSegments:[{start:1,name:'Scene',},],}",
      10,
    ).map((s) => [s.start, s.end, s.name]),
    [[1, 10, "Scene"]],
  );
});
