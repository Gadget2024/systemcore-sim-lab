export const FIELD = Object.freeze({ width: 16.54, height: 8.21 });
export const ROBOT = Object.freeze({ width: 0.78, length: 0.86, trackWidth: 0.62, maxSpeed: 4.5 });
export const TARGET = Object.freeze({ x: 14.65, y: 4.105, height: 1.45 });
// Axis-aligned blocks, x/y at the lower-left corner. The centre lane stays open for the auto routine.
export const BARRICADES = Object.freeze([
  { x: 4.8, y: 5.3, width: 0.3, height: 1.4 },
  { x: 4.8, y: 1.51, width: 0.3, height: 1.4 },
  { x: 7.5, y: 6.0, width: 1.5, height: 0.3 },
  { x: 7.5, y: 1.91, width: 1.5, height: 0.3 },
  { x: 11.2, y: 5.3, width: 0.3, height: 1.4 },
  { x: 11.2, y: 1.51, width: 0.3, height: 1.4 }
].map(Object.freeze));

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const wrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));

function pushOutOfBarricades(x, y, radius) {
  let collided = false;
  for (const block of BARRICADES) {
    const nearestX = clamp(x, block.x, block.x + block.width);
    const nearestY = clamp(y, block.y, block.y + block.height);
    const dx = x - nearestX;
    const dy = y - nearestY;
    const gap = Math.hypot(dx, dy);
    if (gap >= radius) continue;
    collided = true;
    if (gap > 0) {
      x = nearestX + dx / gap * radius;
      y = nearestY + dy / gap * radius;
    } else {
      // Centre is inside the block: leave through the closest face.
      const exits = [
        { depth: x - block.x, x: block.x - radius, y },
        { depth: block.x + block.width - x, x: block.x + block.width + radius, y },
        { depth: y - block.y, x, y: block.y - radius },
        { depth: block.y + block.height - y, x, y: block.y + block.height + radius }
      ];
      const exit = exits.reduce((best, option) => option.depth < best.depth ? option : best);
      x = exit.x;
      y = exit.y;
    }
  }
  return { x, y, collided };
}

export function initialState() {
  return {
    x: 2.2,
    y: FIELD.height / 2,
    heading: 0,
    leftVelocity: 0,
    rightVelocity: 0,
    leftCommand: 0,
    rightCommand: 0,
    battery: 12.6,
    enabled: false,
    mode: "disabled",
    elapsed: 0,
    collisions: 0,
    emergencyStopped: false
  };
}

export function arcadeDrive(throttle, turn) {
  const left = clamp(throttle + turn, -1, 1);
  const right = clamp(throttle - turn, -1, 1);
  return { left, right };
}

export function stepRobot(state, command, dt) {
  const safeDt = clamp(dt, 0, 0.05);
  const canMove = state.enabled && !state.emergencyStopped && state.mode !== "disabled";
  const leftCommand = canMove ? clamp(command.left, -1, 1) : 0;
  const rightCommand = canMove ? clamp(command.right, -1, 1) : 0;
  const response = 1 - Math.exp(-safeDt / 0.16);
  const leftVelocity = state.leftVelocity + (leftCommand * ROBOT.maxSpeed - state.leftVelocity) * response;
  const rightVelocity = state.rightVelocity + (rightCommand * ROBOT.maxSpeed - state.rightVelocity) * response;
  const linearVelocity = (leftVelocity + rightVelocity) / 2;
  const angularVelocity = (rightVelocity - leftVelocity) / ROBOT.trackWidth;
  const headingMidpoint = state.heading + angularVelocity * safeDt * 0.5;
  const radius = Math.hypot(ROBOT.length, ROBOT.width) / 2;
  const nextX = state.x + Math.cos(headingMidpoint) * linearVelocity * safeDt;
  const nextY = state.y + Math.sin(headingMidpoint) * linearVelocity * safeDt;
  const cleared = pushOutOfBarricades(nextX, nextY, radius);
  const x = clamp(cleared.x, radius, FIELD.width - radius);
  const y = clamp(cleared.y, radius, FIELD.height - radius);
  const collided = cleared.collided || x !== cleared.x || y !== cleared.y;
  const load = (Math.abs(leftCommand) + Math.abs(rightCommand)) / 2;

  return {
    ...state,
    x,
    y,
    heading: wrap(state.heading + angularVelocity * safeDt),
    leftVelocity: collided ? leftVelocity * 0.25 : leftVelocity,
    rightVelocity: collided ? rightVelocity * 0.25 : rightVelocity,
    leftCommand,
    rightCommand,
    battery: clamp(12.6 - load * 1.9, 9.5, 12.6),
    elapsed: state.elapsed + safeDt,
    collisions: state.collisions + (collided ? 1 : 0)
  };
}

export function limelightMeasurement(state) {
  const dx = TARGET.x - state.x;
  const dy = TARGET.y - state.y;
  const distance = Math.hypot(dx, dy);
  const bearing = Math.atan2(dy, dx);
  const tx = wrap(bearing - state.heading) * 180 / Math.PI;
  const fov = 62.5;
  const tv = Math.abs(tx) <= fov / 2 && distance <= 11.5;
  const ty = Math.atan2(TARGET.height - 0.62, Math.max(distance, 0.01)) * 180 / Math.PI - 22;
  const ta = tv ? clamp(8 / Math.max(distance * distance, 0.5), 0.03, 16) : 0;
  return { tv, tx: tv ? tx : 0, ty: tv ? ty : 0, ta, distance };
}

export function autoCommand(state) {
  const vision = limelightMeasurement(state);
  if (vision.distance < 1.5) return { left: 0, right: 0, complete: true };

  const desired = Math.atan2(TARGET.y - state.y, TARGET.x - state.x);
  const error = wrap(desired - state.heading);
  const throttle = clamp((vision.distance - 1.2) * 0.22, 0.18, 0.66);
  const turn = clamp(error * 1.35, -0.58, 0.58);
  const drive = arcadeDrive(throttle, -turn);
  return { ...drive, complete: false };
}
