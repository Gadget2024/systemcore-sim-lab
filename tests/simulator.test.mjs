import test from "node:test";
import assert from "node:assert/strict";
import { BARRICADES, FIELD, arcadeDrive, autoCommand, initialState, limelightMeasurement, stepRobot } from "../src/simulator.mjs";

function run(state, command, seconds) {
  let next = state;
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.02) next = stepRobot(next, command, 0.02);
  return next;
}

test("disabled robot ignores drive output", () => {
  const start = initialState();
  const end = run(start, { left: 1, right: 1 }, 1);
  assert.equal(end.x, start.x);
  assert.equal(end.y, start.y);
  assert.equal(end.leftCommand, 0);
});

test("enabled drivetrain moves forward and voltage sags under load", () => {
  const start = { ...initialState(), enabled: true, mode: "teleop" };
  const end = run(start, { left: 0.7, right: 0.7 }, 1);
  assert.ok(end.x > start.x + 2);
  assert.ok(Math.abs(end.y - start.y) < 0.001);
  assert.ok(end.battery < 12.6);
});

test("opposed wheel speeds turn the robot in place", () => {
  const start = { ...initialState(), enabled: true, mode: "teleop" };
  const end = run(start, { left: 0.4, right: -0.4 }, 0.6);
  assert.ok(Math.abs(end.heading) > 1);
  assert.ok(Math.abs(end.x - start.x) < 0.05);
});

test("arcade drive output stays normalized", () => {
  assert.deepEqual(arcadeDrive(1, 1), { left: 1, right: 0 });
  assert.deepEqual(arcadeDrive(-1, -1), { left: -1, right: 0 });
});

test("Limelight-style target solution reports a centered target", () => {
  const state = { ...initialState(), x: 5, y: FIELD.height / 2, heading: 0 };
  const measurement = limelightMeasurement(state);
  assert.equal(measurement.tv, true);
  assert.ok(Math.abs(measurement.tx) < 0.001);
  assert.ok(measurement.distance > 9);
});

test("auto command stops near the target", () => {
  const state = { ...initialState(), x: 13.4, y: FIELD.height / 2, heading: 0 };
  assert.equal(autoCommand(state).complete, true);
});

test("field boundaries contain the robot", () => {
  const start = { ...initialState(), x: FIELD.width - 0.5, enabled: true, mode: "teleop" };
  const end = run(start, { left: 1, right: 1 }, 2);
  assert.ok(end.x < FIELD.width);
  assert.ok(end.collisions > 0);
});

test("barricades stop the robot", () => {
  const block = BARRICADES[0];
  const start = { ...initialState(), y: block.y + block.height / 2, enabled: true, mode: "teleop" };
  const end = run(start, { left: 1, right: 1 }, 3);
  assert.ok(end.x < block.x);
  assert.ok(end.collisions > 0);
});

test("auto routine reaches the target without touching a barricade", () => {
  let state = { ...initialState(), enabled: true, mode: "auto" };
  for (let step = 0; step < 1500 && !autoCommand(state).complete; step += 1) state = stepRobot(state, autoCommand(state), 0.02);
  assert.equal(autoCommand(state).complete, true);
  assert.equal(state.collisions, 0);
});
