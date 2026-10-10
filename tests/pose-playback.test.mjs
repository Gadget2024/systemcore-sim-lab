import test from "node:test";
import assert from "node:assert/strict";
import { PosePlayback } from "../src/pose-playback.mjs";

const measurement = (timeMs, changes = {}) => ({
  sequence: timeMs / 20 + 1, sampleTimeSeconds: timeMs / 1000, poseResetSequence: 0,
  x: timeMs / 1000, y: 2, heading: 0, estimatedX: timeMs / 1000 * .75, estimatedY: 2,
  ...changes,
});
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≈ ${expected}`);

test("50 Hz measurements produce evenly spaced display frames despite arrival jitter", () => {
  const playback = new PosePlayback();
  playback.add(measurement(0), 1000);
  for (const time of [20, 40, 60, 80, 100]) {
    playback.add(measurement(time), 1000 + time + (time === 40 ? 17 : 0));
  }
  const positions = [1060, 1076, 1092, 1108, 1124, 1140, 1156].map(time => playback.at(time));
  for (let index = 1; index < positions.length; index++) {
    close(positions[index].x - positions[index - 1].x, .016);
    close(positions[index].estimatedX, positions[index].x * .75);
  }
});

test("heading interpolation takes the short turn across ±180 degrees", () => {
  const playback = new PosePlayback();
  playback.add(measurement(0, { heading: 179 * Math.PI / 180 }), 0);
  playback.add(measurement(20, { heading: -179 * Math.PI / 180 }), 20);
  close(playback.at(70).heading, Math.PI);
});

test("field reset and robot restart snap to the new pose", () => {
  const playback = new PosePlayback();
  playback.add(measurement(0, { x: 14 }), 0);
  playback.add(measurement(20, { x: 4, poseResetSequence: 1 }), 20);
  assert.equal(playback.at(20).x, 4);
  playback.add(measurement(0, { x: 3 }), 30);
  assert.equal(playback.at(30).x, 3);
});

test("duplicate snapshots cannot restart or delay playback", () => {
  const playback = new PosePlayback();
  playback.add(measurement(0), 0);
  playback.add(measurement(20), 20);
  playback.add(measurement(20), 69);
  close(playback.at(70).x, .01);
});

test("missing data never extrapolates motion, and disconnect clears the display", () => {
  const playback = new PosePlayback();
  assert.equal(playback.at(0), null);
  playback.add(measurement(0), 0);
  playback.add(measurement(20), 20);
  assert.equal(playback.at(200).x, .02);
  playback.clear();
  assert.equal(playback.at(220), null);
});

test("a long gap resumes immediately instead of replaying old motion", () => {
  const playback = new PosePlayback();
  playback.add(measurement(0, { x: 4 }), 0);
  playback.add(measurement(1000, { x: 8 }), 1000);
  assert.equal(playback.at(1000).x, 8);
});
