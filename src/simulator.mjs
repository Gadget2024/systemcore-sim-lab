// This module contains the robot model and driving rules. It has no browser code,
// so the same functions can be called from the page or from the automated tests.
// Field positions and sizes are in meters. Robot headings are in radians:
// 0 points right across the field, and positive angles turn counterclockwise.
export const FIELD = Object.freeze({ width: 16.54, height: 8.21 });
// trackWidth is the distance between the left and right wheels; maxSpeed is m/s.
export const ROBOT = Object.freeze({ width: 0.78, length: 0.86, trackWidth: 0.62, maxSpeed: 4.5 });
export const TARGET = Object.freeze({ x: 14.65, y: 4.105, height: 1.45 });
// Each rectangle starts at its lower-left corner. The center lane stays open.
// Object.freeze prevents accidental changes to these shared settings at runtime.
export const BARRICADES = Object.freeze([
  { x: 4.8, y: 5.3, width: 0.3, height: 1.4 },
  { x: 4.8, y: 1.51, width: 0.3, height: 1.4 },
  { x: 7.5, y: 6.0, width: 1.5, height: 0.3 },
  { x: 7.5, y: 1.91, width: 1.5, height: 0.3 },
  { x: 11.2, y: 5.3, width: 0.3, height: 1.4 },
  { x: 11.2, y: 1.51, width: 0.3, height: 1.4 }
].map(Object.freeze));

// Keep a number inside an allowed range, such as motor power from -1 to +1.
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
// Express an angle between -PI and +PI so steering uses the shortest turn.
const wrapAngleRadians = (angleRadians) => Math.atan2(Math.sin(angleRadians), Math.cos(angleRadians));

function pushOutOfBarricades(robotX, robotY, robotRadiusMeters) {
  // Treat the robot as a circle for collision checks. If it overlaps a block,
  // move its center just far enough away to put it outside that block.
  let collided = false;
  for (const barricade of BARRICADES) {
    const nearestX = clamp(robotX, barricade.x, barricade.x + barricade.width);
    const nearestY = clamp(robotY, barricade.y, barricade.y + barricade.height);
    const offsetX = robotX - nearestX;
    const offsetY = robotY - nearestY;
    const distanceFromBlockMeters = Math.hypot(offsetX, offsetY);
    if (distanceFromBlockMeters >= robotRadiusMeters) continue;
    collided = true;
    if (distanceFromBlockMeters > 0) {
      robotX = nearestX + offsetX / distanceFromBlockMeters * robotRadiusMeters;
      robotY = nearestY + offsetY / distanceFromBlockMeters * robotRadiusMeters;
    } else {
      // The center is inside the block: leave through whichever face is closest.
      const possibleExits = [
        { depth: robotX - barricade.x, x: barricade.x - robotRadiusMeters, y: robotY },
        { depth: barricade.x + barricade.width - robotX, x: barricade.x + barricade.width + robotRadiusMeters, y: robotY },
        { depth: robotY - barricade.y, x: robotX, y: barricade.y - robotRadiusMeters },
        { depth: barricade.y + barricade.height - robotY, x: robotX, y: barricade.y + barricade.height + robotRadiusMeters }
      ];
      const nearestExit = possibleExits.reduce((closestExit, candidateExit) => candidateExit.depth < closestExit.depth ? candidateExit : closestExit);
      robotX = nearestExit.x;
      robotY = nearestExit.y;
    }
  }
  return { x: robotX, y: robotY, collided };
}

// A fresh state is a snapshot of everything the simulation knows about the robot.
// Keep the field names consistent: app.js and the tests read these same fields.
export function initialState() {
  return {
    x: 2.2,                      // Position of the robot's center in meters.
    y: FIELD.height / 2,
    heading: 0,                  // Radians, not degrees.
    leftVelocity: 0,             // Actual wheel speeds in meters per second.
    rightVelocity: 0,
    leftCommand: 0,              // Requested motor power: -1 reverse, 0 stop, +1 forward.
    rightCommand: 0,
    battery: 12.6,               // Simulated voltage.
    enabled: false,
    mode: "disabled",            // "disabled", "teleop", or "auto".
    elapsed: 0,                  // Simulated seconds since reset.
    collisions: 0,               // Counts time steps with contact, not distinct crashes.
    emergencyStopped: false
  };
}

// Mix forward/reverse power with steering. Positive turnPower turns clockwise
// by driving the left side faster than the right side. Each output is capped.
export function arcadeDrive(forwardPower, turnPower) {
  const leftMotorPower = clamp(forwardPower + turnPower, -1, 1);
  const rightMotorPower = clamp(forwardPower - turnPower, -1, 1);
  return { left: leftMotorPower, right: rightMotorPower };
}

// Advance the physics by one time step and return a NEW state object.
// This lets callers keep an earlier state to compare before and after a move.
export function stepRobot(robotState, motorCommand, timeStepSeconds) {
  const limitedTimeStepSeconds = clamp(timeStepSeconds, 0, 0.05);
  const canMove = robotState.enabled && !robotState.emergencyStopped && robotState.mode !== "disabled";
  const leftMotorPower = canMove ? clamp(motorCommand.left, -1, 1) : 0;
  const rightMotorPower = canMove ? clamp(motorCommand.right, -1, 1) : 0;

  // Motors approach their requested speeds gradually (a 0.16-second response).
  // Zero power therefore lets velocity decay instead of stopping instantly.
  const velocityResponse = 1 - Math.exp(-limitedTimeStepSeconds / 0.16);
  const leftWheelSpeed = robotState.leftVelocity + (leftMotorPower * ROBOT.maxSpeed - robotState.leftVelocity) * velocityResponse;
  const rightWheelSpeed = robotState.rightVelocity + (rightMotorPower * ROBOT.maxSpeed - robotState.rightVelocity) * velocityResponse;
  const forwardSpeed = (leftWheelSpeed + rightWheelSpeed) / 2;
  const turnSpeedRadiansPerSecond = (rightWheelSpeed - leftWheelSpeed) / ROBOT.trackWidth;
  // Use the heading halfway through the step to approximate travel along a curve.
  const midpointHeadingRadians = robotState.heading + turnSpeedRadiansPerSecond * limitedTimeStepSeconds * 0.5;
  const robotRadiusMeters = Math.hypot(ROBOT.length, ROBOT.width) / 2;
  const proposedX = robotState.x + Math.cos(midpointHeadingRadians) * forwardSpeed * limitedTimeStepSeconds;
  const proposedY = robotState.y + Math.sin(midpointHeadingRadians) * forwardSpeed * limitedTimeStepSeconds;
  const collisionResult = pushOutOfBarricades(proposedX, proposedY, robotRadiusMeters);
  const boundedX = clamp(collisionResult.x, robotRadiusMeters, FIELD.width - robotRadiusMeters);
  const boundedY = clamp(collisionResult.y, robotRadiusMeters, FIELD.height - robotRadiusMeters);
  const collided = collisionResult.collided || boundedX !== collisionResult.x || boundedY !== collisionResult.y;
  const averageMotorLoad = (Math.abs(leftMotorPower) + Math.abs(rightMotorPower)) / 2;

  return {
    ...robotState, // Copy unchanged fields such as mode and enabled into the new state.
    x: boundedX,
    y: boundedY,
    heading: wrapAngleRadians(robotState.heading + turnSpeedRadiansPerSecond * limitedTimeStepSeconds),
    leftVelocity: collided ? leftWheelSpeed * 0.25 : leftWheelSpeed,
    rightVelocity: collided ? rightWheelSpeed * 0.25 : rightWheelSpeed,
    leftCommand: leftMotorPower,
    rightCommand: rightMotorPower,
    // Higher commanded power lowers the displayed battery voltage in this model.
    battery: clamp(12.6 - averageMotorLoad * 1.9, 9.5, 12.6),
    elapsed: robotState.elapsed + limitedTimeStepSeconds,
    collisions: robotState.collisions + (collided ? 1 : 0)
  };
}

// Generate camera-like readings from the exact simulated positions.
// This simplified camera checks angle and range; it does not model blocked views.
export function limelightMeasurement(robotState) {
  const targetOffsetX = TARGET.x - robotState.x;
  const targetOffsetY = TARGET.y - robotState.y;
  const distanceToTargetMeters = Math.hypot(targetOffsetX, targetOffsetY);
  const targetBearingRadians = Math.atan2(targetOffsetY, targetOffsetX);
  const horizontalOffsetDegrees = wrapAngleRadians(targetBearingRadians - robotState.heading) * 180 / Math.PI;
  const fieldOfViewDegrees = 62.5;
  const targetVisible = Math.abs(horizontalOffsetDegrees) <= fieldOfViewDegrees / 2 && distanceToTargetMeters <= 11.5;
  // The simulated camera is 0.62 m above the floor and tilted upward by 22 degrees.
  const verticalOffsetDegrees = Math.atan2(TARGET.height - 0.62, Math.max(distanceToTargetMeters, 0.01)) * 180 / Math.PI - 22;
  const targetAreaPercent = targetVisible ? clamp(8 / Math.max(distanceToTargetMeters * distanceToTargetMeters, 0.5), 0.03, 16) : 0;

  // Keep the familiar Limelight field names at the boundary with the dashboard:
  // tv = target visible, tx/ty = horizontal/vertical angle, ta = image area percent.
  // Distance remains available even when tv is false; Auto relies on that here.
  return {
    tv: targetVisible,
    tx: targetVisible ? horizontalOffsetDegrees : 0,
    ty: targetVisible ? verticalOffsetDegrees : 0,
    ta: targetAreaPercent,
    distance: distanceToTargetMeters
  };
}

// AUTO ROUTINE: app.js calls this every 0.02 seconds while Auto is selected.
// It returns motor commands; stepRobot() applies them to the robot afterward.
// This routine knows the exact simulated pose. It does not require camera lock
// and does not plan a path around barricades. The default center lane is clear.
export function autoCommand(robotState) {
  // Start learning by changing ONE setting, saving, and refreshing the browser.
  const stopDistanceMeters = 1.5;        // Larger = stop farther from the target.
  const approachOffsetMeters = 1.2;     // Reference distance for the slowdown formula,
                                       // not the stopping threshold. Keep below stopDistanceMeters.
  const forwardGainPerMeter = 0.22;     // Larger = more forward power at a given distance.
  const minimumForwardPower = 0.18;     // Keep approaching until the stop check succeeds.
  const maximumForwardPower = 0.66;     // Maximum forward request; 0.66 means 66% power.
  const steeringGainPerRadian = 1.35;   // Larger = stronger steering for the same error.
  const maximumTurnPower = 0.58;        // Limit the steering correction in either direction.

  // 1. Measure distance, then stop before calculating any further driving command.
  const targetMeasurement = limelightMeasurement(robotState);
  const distanceToTargetMeters = targetMeasurement.distance;
  if (distanceToTargetMeters < stopDistanceMeters) {
    // The physics still allows brief coasting. The UI stays in Auto mode;
    // complete is useful to tests, but app.js does not switch modes based on it.
    return { left: 0, right: 0, complete: true };
  }

  // 2. Find the shortest turn from our current heading to the target's bearing.
  const targetBearingRadians = Math.atan2(TARGET.y - robotState.y, TARGET.x - robotState.x);
  const headingErrorRadians = wrapAngleRadians(targetBearingRadians - robotState.heading);

  // 3. Proportional control: multiply an error by a gain to choose a correction.
  // Distance controls forward power; heading error controls steering power.
  // clamp() keeps those requests within the limits chosen above.
  const forwardPower = clamp(
    (distanceToTargetMeters - approachOffsetMeters) * forwardGainPerMeter,
    minimumForwardPower,
    maximumForwardPower
  );
  const steeringPower = clamp(headingErrorRadians * steeringGainPerRadian, -maximumTurnPower, maximumTurnPower);

  // 4. Convert forward and steering requests into left/right motor commands.
  // Positive heading error means counterclockwise, but arcadeDrive's positive
  // turn means clockwise. The minus sign converts between those conventions.
  const motorCommand = arcadeDrive(forwardPower, -steeringPower);
  return { ...motorCommand, complete: false };
}
