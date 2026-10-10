import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { WebSocketServer } from 'ws';
import { encode, decodeMulti } from '@msgpack/msgpack';
import { Nt4Bridge, validTelemetry } from '../lib/nt4-bridge.mjs';

const telemetry = { schema: 2, sequence: 1, sampleTimeSeconds: 1, poseResetSequence: 0,
  simulation: true, enabled: false, mode: 'teleop', x: 4, y: 4,
  heading: 0, estimatedX: 4, estimatedY: 4, leftEncoder: 0, rightEncoder: 0, leftSpeed: 0, rightSpeed: 0,
  leftPower: 0, rightPower: 0, battery: 12, poseError: 0, targetVisible: true, targetDistance: 10,
  targetBearing: 0, status: 'Disabled', lifecycle: 'Teleop.end()' };
const controls = { clientId: 'student-session-1234', enabled: false, mode: 'teleop', throttle: .5, turn: 0,
  stopDistance: 1.5, maxPower: .45, cameraCovered: false, encoderSlip: false, resetCounter: 0 };
async function until(check, timeout = 4000) {
  const deadline = Date.now() + timeout;
  while (!check()) { if (Date.now() > deadline) assert.fail('Timed out waiting for NetworkTables'); await delay(20); }
}
async function fixture(t) {
  const server = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  await once(server, 'listening');
  const state = { packets: [], sequence: 1, publishing: true, advance: true };
  server.on('connection', socket => {
    state.socket = socket;
    socket.on('message', (data, binary) => {
      if (!binary) {
        for (const message of JSON.parse(data.toString())) if (message.method === 'subscribe') {
          state.subscriptionPeriod = message.params.options.periodic;
          socket.send(JSON.stringify([{ method: 'announce', params: { name: '/LearningLab/telemetry', id: 7, type: 'string', properties: {} } }]));
        }
        return;
      }
      for (const packet of decodeMulti(data)) {
        if (packet[0] === -1) socket.send(encode([-1, Math.round(performance.now() * 1000) + 1000000, 2, packet[3]]));
        else state.packets.push(packet);
      }
    });
  });
  const timer = setInterval(() => {
    if (!state.publishing || state.socket?.readyState !== 1) return;
    if (state.advance) state.sequence++;
    state.socket.send(encode([7, 1000000, 4, JSON.stringify({ ...telemetry, sequence: state.sequence })]));
  }, 50);
  const bridge = new Nt4Bridge({ port: server.address().port });
  t.after(() => { clearInterval(timer); bridge.close(); for (const socket of server.clients) socket.terminate(); server.close(); });
  await until(() => bridge.snapshot().connected);
  return { bridge, state };
}

test('only compatible simulation telemetry is accepted', () => {
  assert.ok(validTelemetry(telemetry));
  for (const update of [{ simulation: false }, { schema: 1 }, { x: NaN }, { sequence: undefined },
    { sampleTimeSeconds: NaN }, { poseResetSequence: -1 }, { status: {} }]) {
    assert.equal(validTelemetry({ ...telemetry, ...update }), false);
  }
});

test('new pose measurements reach the dashboard without waiting for the watchdog timer', async t => {
  const { bridge, state } = await fixture(t);
  assert.equal(state.subscriptionPeriod, .02);
  state.publishing = false;
  clearInterval(bridge.timer);
  let received;
  bridge.on('snapshot', snapshot => { received = snapshot.telemetry; });
  state.socket.send(encode([7, 1000000, 4, JSON.stringify({ ...telemetry, sequence: 500, x: 5 })]));
  await until(() => received?.sequence === 500);
  assert.equal(received.x, 5);
});

test('NT4 clock sync, publication, and idle heartbeat work over a real websocket', async t => {
  const { bridge, state } = await fixture(t);
  bridge.acceptControls(controls);
  bridge.acceptControls({ ...controls, enabled: true });
  await until(() => state.packets.length >= 2);
  assert.equal(state.packets[1][2], 17, 'NT4 double[] type');
  assert.ok(state.packets[1][1] > 1000000, 'timestamp uses server clock');
  assert.equal(state.packets[1][3][0], 1);
  await until(() => state.packets.some(packet => packet[3][9] === 3 && packet[3][0] === 0));
  assert.throws(() => bridge.acceptControls({ ...controls, enabled: true }), { status: 409 });
  await delay(1100);
  assert.ok(bridge.snapshot().connected, 'stationary robot still sends a heartbeat');
});

test('replayed telemetry becomes stale and forces disabled output', async t => {
  const { bridge, state } = await fixture(t);
  state.advance = false;
  bridge.acceptControls(controls);
  const heartbeat = setInterval(() => {
    try { bridge.acceptControls({ ...controls, enabled: true }); } catch {}
  }, 100);
  t.after(() => clearInterval(heartbeat));
  await until(() => !bridge.snapshot().connected);
  await until(() => state.packets.length > 2 && state.packets.at(-1)[3][0] === 0);
  assert.equal(bridge.snapshot().telemetry, null);
});

test('reconnecting clears the old enable request', async t => {
  const { bridge, state } = await fixture(t);
  bridge.acceptControls(controls);
  bridge.acceptControls({ ...controls, enabled: true });
  state.socket.terminate();
  await until(() => !bridge.snapshot().connected);
  await until(() => bridge.snapshot().connected);
  assert.throws(() => bridge.acceptControls({ ...controls, enabled: true }), { status: 409 });
  bridge.acceptControls(controls);
  bridge.acceptControls({ ...controls, enabled: true });
});
