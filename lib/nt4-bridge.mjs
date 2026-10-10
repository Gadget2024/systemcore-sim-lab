import { EventEmitter } from "node:events";
import WebSocket from "ws";
import { encode, decodeMulti } from "@msgpack/msgpack";
import { ControlLease, controlsToPacket, validateControls } from "./lab-controls.mjs";

const TELEMETRY_TOPIC = "/LearningLab/telemetry";
const CONTROL_TOPIC = "/LearningLab/controls";
// NT4's binary protocol uses numeric type identifiers.
const DOUBLE_TYPE = 2;
const STRING_TYPE = 4;
const DOUBLE_ARRAY_TYPE = 17;
const microseconds = () => Math.round(performance.now() * 1000);

// A small NT4 client for this classroom contract, not a general-purpose dashboard library.
// Protocol: https://github.com/wpilibsuite/allwpilib/blob/v2027.0.0-alpha-7/ntcore/doc/networktables4.adoc
export class Nt4Bridge extends EventEmitter {
  constructor({ port = 5810 } = {}) {
    super();
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid NetworkTables port");
    this.port = port;
    this.lease = new ControlLease();
    this.sequence = 0;
    this.closed = false;
    this.topics = new Map();
    this.latest = null;
    this.lastTelemetryTime = 0;
    this.timeOffset = null;
    this.timer = setInterval(() => this.tick(), 100);
    this.connect();
  }

  connect() {
    if (this.closed) return;
    // Always loopback. The classroom bridge cannot be pointed at a physical robot.
    const socket = new WebSocket(`ws://127.0.0.1:${this.port}/nt/systemcore-learning-lab`,
      ["v4.1.networktables.first.wpi.edu", "networktables.first.wpi.edu"], { maxPayload: 64 * 1024 });
    this.socket = socket;
    socket.on("open", () => {
      this.topics.clear();
      this.timeOffset = null;
      this.lease.reset();
      this.latest = null;
      // Synchronize timestamps before sending published values.
      socket.send(encode([-1, 0, DOUBLE_TYPE, microseconds()]));
      socket.send(JSON.stringify([
        { method: "subscribe", params: { subuid: 1, topics: [TELEMETRY_TOPIC], options: { periodic: 0.02, all: false } } },
        { method: "publish", params: { name: CONTROL_TOPIC, pubuid: 1, type: "double[]", properties: {} } },
      ]));
      this.lastSync = performance.now();
    });
    socket.on("message", (data, isBinary) => {
      try {
        if (!isBinary) {
          for (const message of JSON.parse(data.toString())) {
            if (message.method === "announce") this.topics.set(message.params.id, message.params.name);
            if (message.method === "unannounce") {
              if (this.topics.get(message.params.id) === TELEMETRY_TOPIC) this.latest = null;
              this.topics.delete(message.params.id);
            }
          }
          return;
        }
        for (const [topicId, timestamp, type, value] of decodeMulti(data)) {
          if (topicId === -1 && Number.isFinite(value)) {
            this.timeOffset = timestamp - (microseconds() + value) / 2;
          } else if (this.topics.get(topicId) === TELEMETRY_TOPIC && type === STRING_TYPE && typeof value === "string") {
            const telemetry = JSON.parse(value);
            if (validTelemetry(telemetry) && telemetry.sequence !== this.latest?.sequence) {
              this.latest = telemetry;
              this.lastTelemetryTime = performance.now();
              // Forward measurements immediately; the watchdog timer is not a frame clock.
              this.emit("snapshot", this.snapshot());
            } else if (!validTelemetry(telemetry)) {
              this.latest = null;
            }
          }
        }
      } catch {
        // Malformed/incompatible data must never leave stale telemetry marked as live.
        this.latest = null;
        this.lease.reset();
      }
    });
    socket.on("error", () => {}); // A stopped robot is a normal state; retry without noisy logs.
    socket.on("close", () => {
      this.latest = null;
      this.timeOffset = null;
      this.lease.reset();
      if (!this.closed) this.retry = setTimeout(() => this.connect(), 1000);
    });
  }

  snapshot() {
    const connected = this.socket?.readyState === WebSocket.OPEN && this.timeOffset !== null
      && this.latest !== null && performance.now() - this.lastTelemetryTime < 1000;
    return { connected, telemetry: connected ? this.latest : null,
      message: connected ? "WPILib robot connected" : "Start the WPILib robot project to connect." };
  }

  acceptControls(body) {
    const controls = validateControls(body);
    this.lease.accept(controls, performance.now(), this.snapshot().connected);
    this.sequence += 1;
    this.publish(controlsToPacket(controls, this.sequence));
  }

  publish(packet) {
    if (this.socket?.readyState !== WebSocket.OPEN || this.timeOffset === null) return;
    const timestamp = Math.max(1, Math.round(microseconds() + this.timeOffset));
    this.socket.send(encode([1, timestamp, DOUBLE_ARRAY_TYPE, packet]));
  }

  tick() {
    const now = performance.now();
    if (this.lease.expired(now) || !this.snapshot().connected) {
      if (this.lease.controls) this.publish(controlsToPacket({ ...this.lease.controls, enabled: false, throttle: 0, turn: 0 }, ++this.sequence));
      this.lease.reset();
    }
    if (this.socket?.readyState === WebSocket.OPEN && now - this.lastSync > 1000) {
      this.socket.send(encode([-1, 0, DOUBLE_TYPE, microseconds()]));
      this.socket.ping();
      this.lastSync = now;
    }
    this.emit("snapshot", this.snapshot());
  }

  close() {
    this.closed = true;
    if (this.lease.controls) this.publish(controlsToPacket({ ...this.lease.controls, enabled: false }, ++this.sequence));
    clearInterval(this.timer);
    clearTimeout(this.retry);
    this.socket?.close();
  }
}

export function validTelemetry(value) {
  if (!value || value.schema !== 2 || value.simulation !== true || typeof value.enabled !== "boolean") return false;
  if (!Number.isSafeInteger(value.sequence) || value.sequence < 0) return false;
  if (!Number.isFinite(value.sampleTimeSeconds) || !Number.isSafeInteger(value.poseResetSequence)
      || value.poseResetSequence < 0) return false;
  if (!["auto", "teleop"].includes(value.mode) || typeof value.targetVisible !== "boolean") return false;
  const numbers = ["x", "y", "heading", "estimatedX", "estimatedY", "leftEncoder", "rightEncoder", "leftSpeed", "rightSpeed", "leftPower", "rightPower", "battery", "poseError", "targetDistance", "targetBearing"];
  return numbers.every(name => Number.isFinite(value[name]))
    && ["status", "lifecycle"].every(name => typeof value[name] === "string" && value[name].length < 120);
}
