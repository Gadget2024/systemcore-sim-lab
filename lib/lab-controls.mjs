// A single packet keeps related controls together when they cross NetworkTables.
// DriverControls.java decodes these fields; docs/learning-lab.md documents the contract.
export function validateControls(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected controls");
  if (typeof value.clientId !== "string" || !/^[a-zA-Z0-9-]{16,64}$/.test(value.clientId)) throw new Error("Invalid classroom session");
  if (!["auto", "teleop"].includes(value.mode)) throw new Error("Choose Auto or Teleop");
  for (const name of ["enabled", "cameraCovered", "encoderSlip"]) {
    if (typeof value[name] !== "boolean") throw new Error(`Invalid ${name}`);
  }
  const ranges = { throttle: [-1, 1], turn: [-1, 1], stopDistance: [0.5, 3], maxPower: [0.1, 0.8], resetCounter: [0, 1e9] };
  for (const [name, [minimum, maximum]] of Object.entries(ranges)) {
    if (typeof value[name] !== "number" || !Number.isFinite(value[name]) || value[name] < minimum || value[name] > maximum) {
      throw new Error(`Invalid ${name}`);
    }
  }
  if (!Number.isInteger(value.resetCounter)) throw new Error("Invalid reset counter");
  return Object.fromEntries(["clientId", "mode", "enabled", "cameraCovered", "encoderSlip", ...Object.keys(ranges)].map(name => [name, value[name]]));
}

export function controlsToPacket(controls, sequence) {
  return [Number(controls.enabled), controls.mode === "auto" ? 1 : 2,
    controls.throttle, controls.turn, controls.stopDistance, controls.maxPower,
    Number(controls.cameraCovered), Number(controls.encoderSlip), controls.resetCounter, sequence];
}

// One browser holds a short lease. An idle or disconnected tab cannot leave outputs enabled.
export class ControlLease {
  constructor() { this.reset(); }
  reset() { this.owner = null; this.lastSeen = 0; this.armed = false; this.controls = null; }
  accept(controls, now, ready) {
    if (this.owner && now - this.lastSeen <= 500 && this.owner !== controls.clientId) {
      throw Object.assign(new Error("Another tab is driving. Close it or pause it first."), { status: 409 });
    }
    if (this.owner !== controls.clientId || now - this.lastSeen > 500 || !ready) this.armed = false;
    if (controls.enabled && (!ready || !this.armed)) {
      throw Object.assign(new Error("Connect while disabled before enabling the robot."), { status: 409 });
    }
    this.owner = controls.clientId;
    this.lastSeen = now;
    this.controls = controls;
    if (!controls.enabled && ready) this.armed = true;
  }
  expired(now) { return this.controls !== null && now - this.lastSeen > 500; }
}
