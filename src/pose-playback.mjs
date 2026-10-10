// The robot sends measurements in packets; the screen draws on its own frame clock.
// Keep a short buffer so drawing can interpolate between measurements instead of jumping.
const RENDER_DELAY_MS = 60;
const MAX_SAMPLE_GAP_MS = 250;

export class PosePlayback {
  constructor() { this.clear(); }

  clear() {
    this.samples = [];
    this.clockOffsetMs = null;
  }

  add(telemetry, receivedAtMs) {
    const previous = this.samples.at(-1);
    if (previous?.telemetry.sequence === telemetry.sequence) return;

    // A field reset or a restarted connection must appear immediately, never as a drive
    // across the field. Duplicate heartbeat snapshots must not move the playback clock.
    if (previous && (telemetry.poseResetSequence !== previous.telemetry.poseResetSequence
        || telemetry.sequence < previous.telemetry.sequence
        || telemetry.sampleTimeSeconds <= previous.telemetry.sampleTimeSeconds
        || receivedAtMs - previous.receivedAtMs > MAX_SAMPLE_GAP_MS)) this.clear();

    const sampleTimeMs = telemetry.sampleTimeSeconds * 1000;
    if (this.clockOffsetMs === null) this.clockOffsetMs = receivedAtMs - sampleTimeMs;
    this.samples.push({ telemetry, sampleTimeMs, receivedAtMs });
    // Bound memory even when the browser pauses animation in a background tab.
    if (this.samples.length > 32) this.samples.shift();
  }

  at(frameTimeMs) {
    if (this.samples.length === 0) return null;
    // Source timestamps keep packet arrival jitter out of the animation timeline.
    const playbackTimeMs = frameTimeMs - this.clockOffsetMs - RENDER_DELAY_MS;
    const first = this.samples[0];
    if (playbackTimeMs <= first.sampleTimeMs) return first.telemetry;
    for (let index = 1; index < this.samples.length; index++) {
      const after = this.samples[index];
      if (playbackTimeMs > after.sampleTimeMs) continue;
      const before = this.samples[index - 1];
      const fraction = (playbackTimeMs - before.sampleTimeMs) / (after.sampleTimeMs - before.sampleTimeMs);
      const pose = {};
      // Use the same time for the actual robot and its sensor estimate, preserving drift.
      for (const field of ["x", "y", "estimatedX", "estimatedY"]) {
        pose[field] = before.telemetry[field] + (after.telemetry[field] - before.telemetry[field]) * fraction;
      }
      // Crossing +180°/-180° should be a small turn, not an almost-full revolution.
      const headingChange = after.telemetry.heading - before.telemetry.heading;
      const shortestTurn = Math.atan2(Math.sin(headingChange), Math.cos(headingChange));
      pose.heading = before.telemetry.heading + shortestTurn * fraction;
      return pose;
    }
    // Never predict beyond received measurements. Lost traffic freezes the last pose;
    // the existing connection watchdog still disables the robot and clears the display.
    return this.samples.at(-1).telemetry;
  }
}
