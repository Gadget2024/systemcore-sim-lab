import test from 'node:test';
import assert from 'node:assert/strict';
import { ControlLease, validateControls, controlsToPacket } from '../lib/lab-controls.mjs';

const controls = (changes = {}) => ({ clientId: 'student-session-1234', enabled: false, mode: 'teleop', throttle: 0,
  turn: 0, stopDistance: 1.5, maxPower: 0.45, cameraCovered: false, encoderSlip: false, resetCounter: 0, ...changes });

test('controls preserve the Java packet order and strip unrelated fields', () => {
  const valid = validateControls(controls({ enabled: true, mode: 'auto', throttle: 0.5, turn: -0.5,
    cameraCovered: true, encoderSlip: true, resetCounter: 3, ignored: 'value' }));
  assert.equal(valid.ignored, undefined);
  assert.deepEqual(controlsToPacket(valid, 42), [1, 1, .5, -.5, 1.5, .45, 1, 1, 3, 42]);
});

test('reject missing, nonfinite, wrong-type, and out-of-range input before publishing', () => {
  for (const bad of [null, [], {}, controls({ clientId: 'short' }), controls({ enabled: 1 }), controls({ mode: 'disabled' }),
    controls({ throttle: NaN }), controls({ turn: Infinity }), controls({ maxPower: .9 }), controls({ stopDistance: 0 }),
    controls({ cameraCovered: 'false' }), controls({ resetCounter: 1.2 })]) assert.throws(() => validateControls(bad));
});

test('enabling needs a live robot and a disabled handshake', () => {
  const lease = new ControlLease();
  assert.throws(() => lease.accept(controls({ enabled: true }), 1000, true), { status: 409 });
  lease.accept(controls(), 1000, false);
  assert.throws(() => lease.accept(controls({ enabled: true }), 1100, false));
  lease.accept(controls(), 1200, true);
  lease.accept(controls({ enabled: true }), 1300, true);
  assert.equal(lease.controls.enabled, true);
});

test('another tab cannot steal the controls; an expired lease cannot resume enabled', () => {
  const lease = new ControlLease();
  lease.accept(controls(), 1000, true);
  lease.accept(controls({ enabled: true }), 1100, true);
  assert.throws(() => lease.accept(controls({ clientId: 'second-session-1234' }), 1200, true), { status: 409 });
  assert.equal(lease.expired(1600), false);
  assert.equal(lease.expired(1601), true);
  assert.throws(() => lease.accept(controls({ enabled: true }), 1700, true));
  lease.accept(controls({ clientId: 'second-session-1234' }), 1800, true);
  assert.equal(lease.owner, 'second-session-1234');
});

test('loss of telemetry or disconnect requires a fresh disabled handshake', () => {
  const lease = new ControlLease();
  lease.accept(controls(), 1000, true);
  lease.accept(controls({ enabled: true }), 1100, true);
  lease.accept(controls(), 1200, false);
  assert.throws(() => lease.accept(controls({ enabled: true }), 1300, true));
  lease.reset();
  assert.throws(() => lease.accept(controls({ enabled: true }), 1400, true));
});
