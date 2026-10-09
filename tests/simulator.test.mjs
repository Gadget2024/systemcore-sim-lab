import test from "node:test";
import assert from "node:assert/strict";
import { BARRICADES, FIELD, arcadeDrive, autoCommand, initialState, limelightMeasurement, stepRobot } from "../src/simulator.mjs";

// Hold one motor command for the requested duration in 20 ms physics steps.
// Auto needs a different loop below because it recalculates commands as it moves.
function simulateForSeconds(startingState, motorCommand, durationSeconds) {
  let robotState = startingState;
  const timeStepSeconds = 0.02;
  for (let elapsedSeconds = 0; elapsedSeconds < durationSeconds; elapsedSeconds += timeStepSeconds) {
    robotState = stepRobot(robotState, motorCommand, timeStepSeconds);
  }
  return robotState;
}

// Each test creates a state, performs an action, then checks the expected outcome.
// assert.equal checks equality; assert.ok checks whether a condition is true.
test("disabled robot ignores drive output", () => {
  const startingState = initialState();
  const endingState = simulateForSeconds(startingState, { left: 1, right: 1 }, 1);
  assert.equal(endingState.x, startingState.x);
  assert.equal(endingState.y, startingState.y);
  assert.equal(endingState.leftCommand, 0);
});

test("enabled drivetrain moves forward and voltage sags under load", () => {
  const startingState = { ...initialState(), enabled: true, mode: "teleop" };
  const endingState = simulateForSeconds(startingState, { left: 0.7, right: 0.7 }, 1);
  assert.ok(endingState.x > startingState.x + 2);
  assert.ok(Math.abs(endingState.y - startingState.y) < 0.001);
  assert.ok(endingState.battery < 12.6);
});

test("opposed wheel speeds turn the robot in place", () => {
  const startingState = { ...initialState(), enabled: true, mode: "teleop" };
  const endingState = simulateForSeconds(startingState, { left: 0.4, right: -0.4 }, 0.6);
  assert.ok(Math.abs(endingState.heading) > 1);
  assert.ok(Math.abs(endingState.x - startingState.x) < 0.05);
});

test("arcade drive output stays normalized", () => {
  assert.deepEqual(arcadeDrive(1, 1), { left: 1, right: 0 });
  assert.deepEqual(arcadeDrive(-1, -1), { left: -1, right: 0 });
});

test("Limelight-style target solution reports a centered target", () => {
  const robotState = { ...initialState(), x: 5, y: FIELD.height / 2, heading: 0 };
  const targetMeasurement = limelightMeasurement(robotState);
  assert.equal(targetMeasurement.tv, true);
  assert.ok(Math.abs(targetMeasurement.tx) < 0.001);
  assert.ok(targetMeasurement.distance > 9);
});

test("auto command stops near the target", () => {
  const robotState = { ...initialState(), x: 13.4, y: FIELD.height / 2, heading: 0 };
  assert.equal(autoCommand(robotState).complete, true);
});

test("field boundaries contain the robot", () => {
  const startingState = { ...initialState(), x: FIELD.width - 0.5, enabled: true, mode: "teleop" };
  const endingState = simulateForSeconds(startingState, { left: 1, right: 1 }, 2);
  assert.ok(endingState.x < FIELD.width);
  assert.ok(endingState.collisions > 0);
});

test("barricades stop the robot", () => {
  const barricade = BARRICADES[0];
  const startingState = { ...initialState(), y: barricade.y + barricade.height / 2, enabled: true, mode: "teleop" };
  const endingState = simulateForSeconds(startingState, { left: 1, right: 1 }, 3);
  assert.ok(endingState.x < barricade.x);
  assert.ok(endingState.collisions > 0);
});

test("auto routine reaches the target without touching a barricade", () => {
  let robotState = { ...initialState(), enabled: true, mode: "auto" };
  // Allow at most 30 simulated seconds. Recalculate Auto's command on every step.
  for (let stepNumber = 0; stepNumber < 1500 && !autoCommand(robotState).complete; stepNumber += 1) {
    robotState = stepRobot(robotState, autoCommand(robotState), 0.02);
  }
  assert.equal(autoCommand(robotState).complete, true);
  assert.equal(robotState.collisions, 0);
});
