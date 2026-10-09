import { BARRICADES, FIELD, ROBOT, TARGET, arcadeDrive, autoCommand, initialState, limelightMeasurement, stepRobot } from "./simulator.mjs";

// Find a page element by its CSS selector, for example "#field" for id="field".
const findElement = (selector) => document.querySelector(selector);
const fieldCanvas = findElement("#field");
const drawingContext = fieldCanvas.getContext("2d");
// robotState is the current snapshot. Each physics step replaces it with a new one.
let robotState = initialState();
let previousFrameTimeMs = performance.now();
let pendingSimulationSeconds = 0;
// 0.02 seconds = 20 milliseconds = 50 robot updates per simulated second.
const physicsStepSeconds = 0.02;
const pressedKeyboardControls = new Set();
const pressedTouchControls = new Set();
// This saved slider value affects Teleop only; Auto has its own power settings.
let driverSpeedLimitFraction = Number(localStorage.getItem("sim-speed-limit") ?? 75) / 100;

findElement("#speedLimit").value = String(Math.round(driverSpeedLimitFraction * 100));
findElement("#speedLimitValue").textContent = `${Math.round(driverSpeedLimitFraction * 100)}%`;

// Mode selection enables outputs unless E-stop is latched.
function setMode(mode) {
  if (robotState.emergencyStopped && mode !== "disabled") return;
  robotState = { ...robotState, mode, enabled: mode !== "disabled" };
  document.querySelectorAll(".mode-button").forEach((button) => button.classList.toggle("active", button.dataset.mode === mode));
  findElement("#robotState").textContent = robotState.emergencyStopped ? "E-STOPPED" : mode === "disabled" ? "DISABLED" : `${mode.toUpperCase()} ENABLED`;
  findElement("#robotState").classList.toggle("enabled", robotState.enabled && !robotState.emergencyStopped);
  findElement("#disabledOverlay").classList.toggle("hidden", robotState.enabled && !robotState.emergencyStopped);
}

document.querySelectorAll(".mode-button").forEach((button) => button.addEventListener("click", () => setMode(button.dataset.mode)));

// Reset the pose and motion while keeping the currently selected mode.
findElement("#resetButton").addEventListener("click", () => {
  const mode = robotState.mode;
  const enabled = robotState.enabled;
  robotState = { ...initialState(), mode, enabled };
});

// A single click latches E-stop; a double-click clears it and leaves the robot disabled.
findElement("#estopButton").addEventListener("click", () => {
  robotState = { ...robotState, emergencyStopped: true, enabled: false, mode: "disabled" };
  findElement("#estopButton").classList.add("latched");
  findElement("#estopButton").textContent = "E-stop latched";
  setMode("disabled");
});

findElement("#estopButton").addEventListener("dblclick", () => {
  robotState = { ...robotState, emergencyStopped: false };
  findElement("#estopButton").classList.remove("latched");
  findElement("#estopButton").textContent = "E-stop";
  setMode("disabled");
});

findElement("#speedLimit").addEventListener("input", (event) => {
  driverSpeedLimitFraction = Number(event.target.value) / 100;
  localStorage.setItem("sim-speed-limit", String(event.target.value));
  findElement("#speedLimitValue").textContent = `${event.target.value}%`;
});

// Keyboard and touch input both become the same direction names.
const keyboardControlNames = new Map([
  ["w", "forward"], ["arrowup", "forward"],
  ["s", "reverse"], ["arrowdown", "reverse"],
  ["a", "left"], ["arrowleft", "left"],
  ["d", "right"], ["arrowright", "right"]
]);

window.addEventListener("keydown", (event) => {
  const control = keyboardControlNames.get(event.key.toLowerCase());
  if (control) {
    event.preventDefault();
    pressedKeyboardControls.add(control);
  }
  if (event.key === "Escape") setMode("disabled");
});

window.addEventListener("keyup", (event) => {
  const control = keyboardControlNames.get(event.key.toLowerCase());
  if (control) pressedKeyboardControls.delete(control);
});

// Release remembered inputs when the browser loses focus, so Teleop cannot stick.
window.addEventListener("blur", () => {
  pressedKeyboardControls.clear();
  pressedTouchControls.clear();
});

document.querySelectorAll(".drive-button").forEach((button) => {
  const control = button.dataset.control;
  const handlePress = (event) => {
    event.preventDefault();
    // This STOP button clears manual inputs only; use Disabled/Escape to stop Auto.
    if (control === "stop") {
      pressedKeyboardControls.clear();
      pressedTouchControls.clear();
      return;
    }
    pressedTouchControls.add(control);
    button.classList.add("pressed");
    // Keep receiving the release event even if the finger moves off the button.
    button.setPointerCapture?.(event.pointerId);
  };
  const handleRelease = () => {
    pressedTouchControls.delete(control);
    button.classList.remove("pressed");
  };
  button.addEventListener("pointerdown", handlePress);
  button.addEventListener("pointerup", handleRelease);
  button.addEventListener("pointercancel", handleRelease);
  button.addEventListener("lostpointercapture", handleRelease);
});

// Opposite held directions cancel. Scale the remaining request by the Teleop slider.
function driverInput() {
  const activeControls = new Set([...pressedKeyboardControls, ...pressedTouchControls]);
  const forwardInput = (activeControls.has("forward") ? 1 : 0) - (activeControls.has("reverse") ? 1 : 0);
  const turningInput = (activeControls.has("right") ? 1 : 0) - (activeControls.has("left") ? 1 : 0);
  return { throttle: forwardInput * driverSpeedLimitFraction, turn: turningInput * driverSpeedLimitFraction };
}

// Choose who controls the motors on this step. Auto ignores manual drive inputs.
// stepRobot() applies the disabled/E-stop checks to either source of commands.
function command() {
  if (robotState.mode === "auto") return autoCommand(robotState);
  const driverCommand = driverInput();
  return arcadeDrive(driverCommand.throttle, driverCommand.turn);
}

// Match drawing resolution to the displayed size, including high-density screens.
function resizeCanvas() {
  const canvasBounds = fieldCanvas.getBoundingClientRect();
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const canvasWidthPixels = Math.round(canvasBounds.width * pixelRatio);
  const canvasHeightPixels = Math.round(canvasBounds.height * pixelRatio);
  if (fieldCanvas.width !== canvasWidthPixels || fieldCanvas.height !== canvasHeightPixels) {
    fieldCanvas.width = canvasWidthPixels;
    fieldCanvas.height = canvasHeightPixels;
  }
}

// Drawing reads robotState without changing physics. The field uses meters and
// upward-positive Y; the canvas uses pixels and downward-positive Y.
function drawField() {
  resizeCanvas();
  const canvasWidthPixels = fieldCanvas.width;
  const canvasHeightPixels = fieldCanvas.height;
  const pixelsPerMeterX = canvasWidthPixels / FIELD.width;
  const pixelsPerMeterY = canvasHeightPixels / FIELD.height;
  const pixelsPerMeter = Math.min(pixelsPerMeterX, pixelsPerMeterY);
  drawingContext.clearRect(0, 0, canvasWidthPixels, canvasHeightPixels);

  const fieldGradient = drawingContext.createLinearGradient(0, 0, canvasWidthPixels, canvasHeightPixels);
  fieldGradient.addColorStop(0, "#0b1b29");
  fieldGradient.addColorStop(1, "#08131e");
  drawingContext.fillStyle = fieldGradient;
  drawingContext.fillRect(0, 0, canvasWidthPixels, canvasHeightPixels);

  // Draw a one-meter grid before adding obstacles, the target, and the robot.
  drawingContext.strokeStyle = "rgba(113, 151, 182, .14)";
  drawingContext.lineWidth = 1;
  for (let gridXMeter = 0; gridXMeter <= FIELD.width; gridXMeter += 1) {
    drawingContext.beginPath();
    drawingContext.moveTo(gridXMeter * pixelsPerMeterX, 0);
    drawingContext.lineTo(gridXMeter * pixelsPerMeterX, canvasHeightPixels);
    drawingContext.stroke();
  }
  for (let gridYMeter = 0; gridYMeter <= FIELD.height; gridYMeter += 1) {
    drawingContext.beginPath();
    drawingContext.moveTo(0, gridYMeter * pixelsPerMeterY);
    drawingContext.lineTo(canvasWidthPixels, gridYMeter * pixelsPerMeterY);
    drawingContext.stroke();
  }

  drawingContext.strokeStyle = "rgba(55, 213, 238, .36)";
  drawingContext.lineWidth = Math.max(1, pixelsPerMeter * .025);
  drawingContext.strokeRect(1, 1, canvasWidthPixels - 2, canvasHeightPixels - 2);
  drawingContext.beginPath();
  drawingContext.moveTo(canvasWidthPixels / 2, 0);
  drawingContext.lineTo(canvasWidthPixels / 2, canvasHeightPixels);
  drawingContext.stroke();

  drawingContext.fillStyle = "#e5604d";
  drawingContext.strokeStyle = "rgba(255, 214, 205, .7)";
  for (const barricade of BARRICADES) {
    const barricadeXPixel = barricade.x * pixelsPerMeterX;
    const barricadeYPixel = canvasHeightPixels - (barricade.y + barricade.height) * pixelsPerMeterY;
    drawingContext.fillRect(barricadeXPixel, barricadeYPixel, barricade.width * pixelsPerMeterX, barricade.height * pixelsPerMeterY);
    drawingContext.strokeRect(barricadeXPixel, barricadeYPixel, barricade.width * pixelsPerMeterX, barricade.height * pixelsPerMeterY);
  }

  const targetXPixel = TARGET.x * pixelsPerMeterX;
  const targetYPixel = canvasHeightPixels - TARGET.y * pixelsPerMeterY;
  drawingContext.fillStyle = "#ffb84a";
  drawingContext.shadowColor = "#ffb84a";
  drawingContext.shadowBlur = pixelsPerMeter * .18;
  drawingContext.fillRect(targetXPixel - pixelsPerMeter * .08, targetYPixel - pixelsPerMeter * .35, pixelsPerMeter * .16, pixelsPerMeter * .7);
  drawingContext.shadowBlur = 0;

  // Show a dashed sight line only when the simulated camera sees the target.
  const targetMeasurement = limelightMeasurement(robotState);
  if (targetMeasurement.tv) {
    drawingContext.setLineDash([pixelsPerMeter * .1, pixelsPerMeter * .09]);
    drawingContext.strokeStyle = "rgba(255,184,74,.55)";
    drawingContext.beginPath();
    drawingContext.moveTo(robotState.x * pixelsPerMeterX, canvasHeightPixels - robotState.y * pixelsPerMeterY);
    drawingContext.lineTo(targetXPixel, targetYPixel);
    drawingContext.stroke();
    drawingContext.setLineDash([]);
  }

  const robotXPixel = robotState.x * pixelsPerMeterX;
  const robotYPixel = canvasHeightPixels - robotState.y * pixelsPerMeterY;
  // Save/restore keeps this robot-only rotation from affecting the next drawing.
  drawingContext.save();
  drawingContext.translate(robotXPixel, robotYPixel);
  drawingContext.rotate(-robotState.heading);
  const robotLengthPixels = ROBOT.length * pixelsPerMeter;
  const robotWidthPixels = ROBOT.width * pixelsPerMeter;
  drawingContext.shadowColor = "rgba(55,213,238,.5)";
  drawingContext.shadowBlur = pixelsPerMeter * .15;
  drawingContext.fillStyle = "#37d5ee";
  drawingContext.fillRect(-robotLengthPixels / 2, -robotWidthPixels / 2, robotLengthPixels, robotWidthPixels);
  drawingContext.shadowBlur = 0;
  drawingContext.fillStyle = "#06101a";
  drawingContext.fillRect(robotLengthPixels * .12, -robotWidthPixels * .27, robotLengthPixels * .31, robotWidthPixels * .54);
  drawingContext.fillStyle = "#ffb84a";
  drawingContext.beginPath();
  drawingContext.moveTo(robotLengthPixels * .46, 0);
  drawingContext.lineTo(robotLengthPixels * .22, -robotWidthPixels * .18);
  drawingContext.lineTo(robotLengthPixels * .22, robotWidthPixels * .18);
  drawingContext.closePath();
  drawingContext.fill();
  drawingContext.restore();
}

// Convert the latest model values to dashboard text, percentages, and bar widths.
function updateUI() {
  const targetMeasurement = limelightMeasurement(robotState);
  const headingDegrees = robotState.heading * 180 / Math.PI;
  findElement("#leftSpeed").textContent = robotState.leftVelocity.toFixed(2);
  findElement("#rightSpeed").textContent = robotState.rightVelocity.toFixed(2);
  findElement("#headingValue").textContent = headingDegrees.toFixed(1);
  findElement("#batteryValue").textContent = robotState.battery.toFixed(1);
  findElement("#poseReadout").textContent = `X ${robotState.x.toFixed(2)} m · Y ${robotState.y.toFixed(2)} m · ${headingDegrees.toFixed(0)}°`;
  findElement("#collisionReadout").textContent = `Contacts ${robotState.collisions}`;
  findElement("#tvValue").textContent = targetMeasurement.tv ? "1" : "0";
  findElement("#txValue").textContent = `${targetMeasurement.tx.toFixed(1)}°`;
  findElement("#tyValue").textContent = `${targetMeasurement.ty.toFixed(1)}°`;
  findElement("#taValue").textContent = `${targetMeasurement.ta.toFixed(2)}%`;
  findElement("#rangeValue").textContent = `${targetMeasurement.distance.toFixed(2)} m`;
  findElement("#targetBadge").textContent = targetMeasurement.tv ? "TARGET LOCK" : "NO TARGET";
  findElement("#targetBadge").classList.toggle("no-target", !targetMeasurement.tv);

  // In Auto, reconstruct the displayed inputs from actual motor commands.
  const driverCommand = robotState.mode === "auto"
    ? { throttle: (robotState.leftCommand + robotState.rightCommand) / 2, turn: (robotState.leftCommand - robotState.rightCommand) / 2 }
    : driverInput();
  findElement("#throttleValue").textContent = `${Math.round(driverCommand.throttle * 100)}%`;
  findElement("#turnValue").textContent = `${Math.round(driverCommand.turn * 100)}%`;
  findElement("#throttleBar").style.width = `${Math.abs(driverCommand.throttle) * 100}%`;
  const turnBar = findElement("#turnBar");
  turnBar.style.width = `${Math.abs(driverCommand.turn) * 50}%`;
  turnBar.style.left = driverCommand.turn < 0 ? `${50 - Math.abs(driverCommand.turn) * 50}%` : "50%";
}

// Browsers redraw at varying rates. Accumulate real time, then advance physics
// in fixed 20 ms chunks. Limit catch-up to 0.1 seconds after a pause or slow frame.
function frame(frameTimeMs) {
  pendingSimulationSeconds += Math.min((frameTimeMs - previousFrameTimeMs) / 1000, 0.1);
  previousFrameTimeMs = frameTimeMs;
  while (pendingSimulationSeconds >= physicsStepSeconds) {
    // Read controls -> choose motor power -> update the robot. Repeat as needed.
    const motorCommand = command();
    robotState = stepRobot(robotState, motorCommand, physicsStepSeconds);
    pendingSimulationSeconds -= physicsStepSeconds;
  }
  // Render after the physics catches up, then ask the browser for another frame.
  drawField();
  updateUI();
  requestAnimationFrame(frame);
}

// The Node server supplies addresses; this only displays a phone-access hint.
async function showNetworkHelp() {
  try {
    const response = await fetch("/api/network");
    const networkInfo = await response.json();
    const tailscaleAddress = networkInfo.addresses.find((networkAddress) => networkAddress.kind === "tailscale");
    const localNetworkAddress = networkInfo.addresses.find((networkAddress) => networkAddress.kind === "lan");
    if (tailscaleAddress) {
      findElement("#networkHelp").innerHTML = `<strong>Phone-ready:</strong> open http://${tailscaleAddress.address}:${networkInfo.port} on a device signed into your Tailscale network.`;
    } else if (localNetworkAddress) {
      findElement("#networkHelp").innerHTML = `<strong>Local network:</strong> open http://${localNetworkAddress.address}:${networkInfo.port} on the same Wi-Fi. Start Tailscale to expose a private 100.x address.`;
    } else {
      findElement("#networkHelp").textContent = `Phone access appears here when a network adapter is active.`;
    }
  } catch {
    findElement("#networkHelp").textContent = "Phone access details are available when the local server is running.";
  }
}

// Start the page with outputs disabled. Drawing continues in every mode.
showNetworkHelp();
setMode("disabled");
requestAnimationFrame(frame);
