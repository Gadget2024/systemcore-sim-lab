import { BARRICADES, FIELD, ROBOT, TARGET, arcadeDrive, autoCommand, initialState, limelightMeasurement, stepRobot } from "./simulator.mjs";

const $ = (selector) => document.querySelector(selector);
const canvas = $("#field");
const context = canvas.getContext("2d");
let state = initialState();
let lastTime = performance.now();
let accumulator = 0;
const fixedStep = 0.02;
const keys = new Set();
const touches = new Set();
let speedLimit = Number(localStorage.getItem("sim-speed-limit") ?? 75) / 100;

$("#speedLimit").value = String(Math.round(speedLimit * 100));
$("#speedLimitValue").textContent = `${Math.round(speedLimit * 100)}%`;

function setMode(mode) {
  if (state.emergencyStopped && mode !== "disabled") return;
  state = { ...state, mode, enabled: mode !== "disabled" };
  document.querySelectorAll(".mode-button").forEach((button) => button.classList.toggle("active", button.dataset.mode === mode));
  $("#robotState").textContent = state.emergencyStopped ? "E-STOPPED" : mode === "disabled" ? "DISABLED" : `${mode.toUpperCase()} ENABLED`;
  $("#robotState").classList.toggle("enabled", state.enabled && !state.emergencyStopped);
  $("#disabledOverlay").classList.toggle("hidden", state.enabled && !state.emergencyStopped);
}

document.querySelectorAll(".mode-button").forEach((button) => button.addEventListener("click", () => setMode(button.dataset.mode)));

$("#resetButton").addEventListener("click", () => {
  const mode = state.mode;
  const enabled = state.enabled;
  state = { ...initialState(), mode, enabled };
});

$("#estopButton").addEventListener("click", () => {
  state = { ...state, emergencyStopped: true, enabled: false, mode: "disabled" };
  $("#estopButton").classList.add("latched");
  $("#estopButton").textContent = "E-stop latched";
  setMode("disabled");
});

$("#estopButton").addEventListener("dblclick", () => {
  state = { ...state, emergencyStopped: false };
  $("#estopButton").classList.remove("latched");
  $("#estopButton").textContent = "E-stop";
  setMode("disabled");
});

$("#speedLimit").addEventListener("input", (event) => {
  speedLimit = Number(event.target.value) / 100;
  localStorage.setItem("sim-speed-limit", String(event.target.value));
  $("#speedLimitValue").textContent = `${event.target.value}%`;
});

const keyMap = new Map([
  ["w", "forward"], ["arrowup", "forward"],
  ["s", "reverse"], ["arrowdown", "reverse"],
  ["a", "left"], ["arrowleft", "left"],
  ["d", "right"], ["arrowright", "right"]
]);

window.addEventListener("keydown", (event) => {
  const control = keyMap.get(event.key.toLowerCase());
  if (control) {
    event.preventDefault();
    keys.add(control);
  }
  if (event.key === "Escape") setMode("disabled");
});

window.addEventListener("keyup", (event) => {
  const control = keyMap.get(event.key.toLowerCase());
  if (control) keys.delete(control);
});

window.addEventListener("blur", () => { keys.clear(); touches.clear(); });

document.querySelectorAll(".drive-button").forEach((button) => {
  const control = button.dataset.control;
  const press = (event) => {
    event.preventDefault();
    if (control === "stop") {
      keys.clear();
      touches.clear();
      return;
    }
    touches.add(control);
    button.classList.add("pressed");
    button.setPointerCapture?.(event.pointerId);
  };
  const release = () => {
    touches.delete(control);
    button.classList.remove("pressed");
  };
  button.addEventListener("pointerdown", press);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
});

function driverInput() {
  const active = new Set([...keys, ...touches]);
  const throttle = (active.has("forward") ? 1 : 0) - (active.has("reverse") ? 1 : 0);
  const turn = (active.has("right") ? 1 : 0) - (active.has("left") ? 1 : 0);
  return { throttle: throttle * speedLimit, turn: turn * speedLimit };
}

function command() {
  if (state.mode === "auto") return autoCommand(state);
  const input = driverInput();
  return arcadeDrive(input.throttle, input.turn);
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.round(rect.width * ratio);
  const height = Math.round(rect.height * ratio);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function drawField() {
  resizeCanvas();
  const w = canvas.width;
  const h = canvas.height;
  const sx = w / FIELD.width;
  const sy = h / FIELD.height;
  const scale = Math.min(sx, sy);
  context.clearRect(0, 0, w, h);

  const gradient = context.createLinearGradient(0, 0, w, h);
  gradient.addColorStop(0, "#0b1b29");
  gradient.addColorStop(1, "#08131e");
  context.fillStyle = gradient;
  context.fillRect(0, 0, w, h);

  context.strokeStyle = "rgba(113, 151, 182, .14)";
  context.lineWidth = 1;
  for (let x = 0; x <= FIELD.width; x += 1) {
    context.beginPath(); context.moveTo(x * sx, 0); context.lineTo(x * sx, h); context.stroke();
  }
  for (let y = 0; y <= FIELD.height; y += 1) {
    context.beginPath(); context.moveTo(0, y * sy); context.lineTo(w, y * sy); context.stroke();
  }

  context.strokeStyle = "rgba(55, 213, 238, .36)";
  context.lineWidth = Math.max(1, scale * .025);
  context.strokeRect(1, 1, w - 2, h - 2);
  context.beginPath(); context.moveTo(w / 2, 0); context.lineTo(w / 2, h); context.stroke();

  context.fillStyle = "#e5604d";
  context.strokeStyle = "rgba(255, 214, 205, .7)";
  for (const block of BARRICADES) {
    const bx = block.x * sx;
    const by = h - (block.y + block.height) * sy;
    context.fillRect(bx, by, block.width * sx, block.height * sy);
    context.strokeRect(bx, by, block.width * sx, block.height * sy);
  }

  const tx = TARGET.x * sx;
  const ty = h - TARGET.y * sy;
  context.fillStyle = "#ffb84a";
  context.shadowColor = "#ffb84a";
  context.shadowBlur = scale * .18;
  context.fillRect(tx - scale * .08, ty - scale * .35, scale * .16, scale * .7);
  context.shadowBlur = 0;

  const vision = limelightMeasurement(state);
  if (vision.tv) {
    context.setLineDash([scale * .1, scale * .09]);
    context.strokeStyle = "rgba(255,184,74,.55)";
    context.beginPath();
    context.moveTo(state.x * sx, h - state.y * sy);
    context.lineTo(tx, ty);
    context.stroke();
    context.setLineDash([]);
  }

  const x = state.x * sx;
  const y = h - state.y * sy;
  context.save();
  context.translate(x, y);
  context.rotate(-state.heading);
  const rw = ROBOT.length * scale;
  const rh = ROBOT.width * scale;
  context.shadowColor = "rgba(55,213,238,.5)";
  context.shadowBlur = scale * .15;
  context.fillStyle = "#37d5ee";
  context.fillRect(-rw / 2, -rh / 2, rw, rh);
  context.shadowBlur = 0;
  context.fillStyle = "#06101a";
  context.fillRect(rw * .12, -rh * .27, rw * .31, rh * .54);
  context.fillStyle = "#ffb84a";
  context.beginPath();
  context.moveTo(rw * .46, 0); context.lineTo(rw * .22, -rh * .18); context.lineTo(rw * .22, rh * .18); context.closePath(); context.fill();
  context.restore();
}

function updateUI() {
  const vision = limelightMeasurement(state);
  const degrees = state.heading * 180 / Math.PI;
  $("#leftSpeed").textContent = state.leftVelocity.toFixed(2);
  $("#rightSpeed").textContent = state.rightVelocity.toFixed(2);
  $("#headingValue").textContent = degrees.toFixed(1);
  $("#batteryValue").textContent = state.battery.toFixed(1);
  $("#poseReadout").textContent = `X ${state.x.toFixed(2)} m · Y ${state.y.toFixed(2)} m · ${degrees.toFixed(0)}°`;
  $("#collisionReadout").textContent = `Contacts ${state.collisions}`;
  $("#tvValue").textContent = vision.tv ? "1" : "0";
  $("#txValue").textContent = `${vision.tx.toFixed(1)}°`;
  $("#tyValue").textContent = `${vision.ty.toFixed(1)}°`;
  $("#taValue").textContent = `${vision.ta.toFixed(2)}%`;
  $("#rangeValue").textContent = `${vision.distance.toFixed(2)} m`;
  $("#targetBadge").textContent = vision.tv ? "TARGET LOCK" : "NO TARGET";
  $("#targetBadge").classList.toggle("no-target", !vision.tv);

  const input = state.mode === "auto"
    ? { throttle: (state.leftCommand + state.rightCommand) / 2, turn: (state.leftCommand - state.rightCommand) / 2 }
    : driverInput();
  $("#throttleValue").textContent = `${Math.round(input.throttle * 100)}%`;
  $("#turnValue").textContent = `${Math.round(input.turn * 100)}%`;
  $("#throttleBar").style.width = `${Math.abs(input.throttle) * 100}%`;
  const turnBar = $("#turnBar");
  turnBar.style.width = `${Math.abs(input.turn) * 50}%`;
  turnBar.style.left = input.turn < 0 ? `${50 - Math.abs(input.turn) * 50}%` : "50%";
}

function frame(now) {
  accumulator += Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  while (accumulator >= fixedStep) {
    const nextCommand = command();
    state = stepRobot(state, nextCommand, fixedStep);
    accumulator -= fixedStep;
  }
  drawField();
  updateUI();
  requestAnimationFrame(frame);
}

async function showNetworkHelp() {
  try {
    const response = await fetch("/api/network");
    const info = await response.json();
    const tailscale = info.addresses.find((item) => item.kind === "tailscale");
    const lan = info.addresses.find((item) => item.kind === "lan");
    if (tailscale) {
      $("#networkHelp").innerHTML = `<strong>Phone-ready:</strong> open http://${tailscale.address}:${info.port} on a device signed into your Tailscale network.`;
    } else if (lan) {
      $("#networkHelp").innerHTML = `<strong>Local network:</strong> open http://${lan.address}:${info.port} on the same Wi-Fi. Start Tailscale to expose a private 100.x address.`;
    } else {
      $("#networkHelp").textContent = `Phone access appears here when a network adapter is active.`;
    }
  } catch {
    $("#networkHelp").textContent = "Phone access details are available when the local server is running.";
  }
}

showNetworkHelp();
setMode("disabled");
requestAnimationFrame(frame);
