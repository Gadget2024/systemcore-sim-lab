const find = selector => document.querySelector(selector);
const lessons = [
  { title: "Take the wheel", mode: "teleop", description: "A robot follows commands, then reports what its sensors measured.", steps: ["Keep the routine on Teleop. Enable the robot and hold W or ▲ briefly.", "Release the control. Watch the wheel speeds settle and both encoder distances change.", "Turn with A/D or ◀/▶. Disable the robot before resetting the field."], question: "Why do the two encoder distances change by different amounts when the robot turns?", code: "wpilib-robot/src/main/java/lab/robot/opmode/DriveLesson.java → periodic() → Robot.runTeleop(). SimDrive.java turns motor requests into encoder measurements." },
  { title: "Tune an approach", mode: "auto", description: "An autonomous routine makes a new decision from measurements on every loop.", steps: ["Disable and reset the field. Choose Auto, leave the camera uncovered, then enable.", "Watch forward power fall as the robot gets close. Compare the final range with the stopping-distance setting.", "Disable and reset. Try a 2.5 m stopping distance, or reduce forward power. Change one setting at a time."], question: "Why might the final distance be a little smaller than your stopping setting? Think about camera delay and momentum.", code: "AutoController.java → calculate(). TargetLesson.java calls it from a real WPILib PeriodicOpMode. Edit forwardGainPerMeter or steeringGainPerRadian, restart npm run robot, and compare." },
  { title: "Lose the target", mode: "auto", description: "Good robot code has a plan for a sensor that cannot see its target.", steps: ["Disable, reset, uncover the camera, and enable Auto.", "While approaching, check Cover the camera. The camera reports a lost target after its simulated delay, and Auto requests zero power.", "Uncover it. If the target is still in view, the approach resumes. Try turning away in Teleop before enabling Auto."], question: "Would it be safe to keep using the last direction forever after losing the target?", code: "SimCamera.java models 120 ms latency and a limited field of view. AutoController.calculate() returns zero power when visible is false. It never reads the robot's true position." },
  { title: "Trust, then measure", mode: "teleop", description: "A robot estimates its position from sensors. That estimate can drift.", steps: ["Disable and reset, then check Under-read wheel distance.", "Enable Teleop and drive straight. Compare the cyan robot with its outlined sensor estimate.", "Read the position error. Disable, clear the checkbox, and reset to compare with accurate encoders."], question: "Which position can a real robot actually know? What extra sensor could help correct the estimate?", code: "SimDrive.java feeds simulated distances into WPILib Encoder objects. Robot.simulationPeriodic() uses DifferentialDriveOdometry to estimate position. Ground truth is only for the simulated camera and lesson display." },
];
let completed;
try { completed = new Set(JSON.parse(localStorage.getItem("systemcore-lessons-v1") ?? "[]").filter(index => Number.isInteger(index) && index >= 0 && index < lessons.length)); }
catch { completed = new Set(); }
let selectedLesson = 0;
let connected = false;
let controlsReady = false;
let desiredEnabled = false;
let resetCounter = 0;
let latestTelemetry = null;
let sending = false;
const isLocalBrowser = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
// Remote visitors can read lessons, but controls belong on the robot's computer.
const clientId = isLocalBrowser ? crypto.randomUUID() : "remote-preview-only";
const keyboardDirections = new Set();
const touchDirections = new Set();
const keys = new Map([["w", "forward"], ["arrowup", "forward"], ["s", "reverse"], ["arrowdown", "reverse"], ["a", "left"], ["arrowleft", "left"], ["d", "right"], ["arrowright", "right"]]);

function rememberProgress() { try { localStorage.setItem("systemcore-lessons-v1", JSON.stringify([...completed])); } catch {} }
function showLesson(index) {
  selectedLesson = index;
  const lesson = lessons[index];
  find("#lessonNumber").textContent = `LESSON ${String(index + 1).padStart(2, "0")}`;
  find("#lessonTitle").textContent = lesson.title;
  find("#lessonDescription").textContent = lesson.description;
  find("#lessonQuestion").textContent = lesson.question;
  find("#lessonCode").textContent = lesson.code;
  find("#lessonSteps").replaceChildren(...lesson.steps.map(text => { const item = document.createElement("li"); item.textContent = text; return item; }));
  find("#lessonList").replaceChildren(...lessons.map((item, itemIndex) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "lesson-tab";
    if (itemIndex === index) button.setAttribute("aria-current", "step");
    const number = document.createElement("span"); number.textContent = completed.has(itemIndex) ? "✓" : String(itemIndex + 1).padStart(2, "0");
    const label = document.createElement("strong"); label.textContent = item.title;
    button.append(number, label);
    button.addEventListener("click", () => { disable(); find("#labMode").value = item.mode; showLesson(itemIndex); });
    return button;
  }));
  find("#lessonProgress").textContent = `${completed.size} of 4 lessons checked off`;
  find("#completeLesson").textContent = completed.has(index) ? "Lesson checked off ✓" : "I tried this lesson ✓";
}
find("#completeLesson").addEventListener("click", () => { completed.add(selectedLesson); rememberProgress(); showLesson(selectedLesson); });
find("#clearProgress").addEventListener("click", () => { completed.clear(); rememberProgress(); showLesson(selectedLesson); });

function updateButtons() {
  find("#enableRobot").disabled = !connected || !controlsReady || desiredEnabled;
  find("#resetRobot").disabled = !connected || desiredEnabled || latestTelemetry?.enabled;
  find("#labMode").disabled = desiredEnabled;
}
function disable(message = "Disabled. You can reset or choose another routine.") {
  desiredEnabled = false;
  keyboardDirections.clear(); touchDirections.clear();
  document.querySelectorAll("[data-lab-direction]").forEach(button => button.classList.remove("pressed"));
  find("#controlNotice").textContent = message;
  updateButtons();
  void sendControls();
}
function readDriverControls() {
  const held = new Set([...keyboardDirections, ...touchDirections]);
  return { clientId, enabled: desiredEnabled, mode: find("#labMode").value,
    throttle: Number(held.has("forward")) - Number(held.has("reverse")),
    turn: Number(held.has("right")) - Number(held.has("left")),
    stopDistance: Number(find("#labStopDistance").value), maxPower: Number(find("#labPower").value) / 100,
    cameraCovered: find("#cameraCovered").checked, encoderSlip: find("#encoderSlip").checked, resetCounter };
}
async function sendControls() {
  if (sending || document.hidden || !isLocalBrowser) return;
  sending = true;
  try {
    const controls = readDriverControls();
    const response = await fetch("/api/lab/controls", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(controls), signal: AbortSignal.timeout(1200) });
    if (!response.ok) {
      controlsReady = false;
      desiredEnabled = false;
      const error = await response.json();
      find("#controlNotice").textContent = error.error ?? "Controls paused. Disable and try again.";
    } else if (!controls.enabled && connected) {
      // After refresh/reconnect, wait for a disabled handshake before offering Enable.
      if (!controlsReady) find("#controlNotice").textContent = "Connected. Choose a routine, then enable when ready.";
      controlsReady = true;
    }
  } catch { controlsReady = false; desiredEnabled = false; find("#controlNotice").textContent = "Connection interrupted — controls disabled."; }
  finally { sending = false; updateButtons(); }
}
find("#enableRobot").addEventListener("click", () => { if (!connected || !controlsReady) return; desiredEnabled = true; find("#controlNotice").textContent = "Robot enabled. Press Escape or Disable to stop."; updateButtons(); void sendControls(); });
for (const id of ["#disableRobot", "#stopRobot"]) find(id).addEventListener("click", () => disable());
find("#resetRobot").addEventListener("click", () => { if (!desiredEnabled && !latestTelemetry?.enabled) { resetCounter++; void sendControls(); } });
find("#labMode").addEventListener("change", () => disable());
for (const id of ["#labPower", "#labStopDistance"]) find(id).addEventListener("input", () => {
  find("#labPowerValue").textContent = `${find("#labPower").value}%`;
  find("#labStopValue").textContent = `${Number(find("#labStopDistance").value).toFixed(1)} m`;
});
window.addEventListener("keydown", event => {
  if (event.key === "Escape") { disable(); return; }
  // Let arrows operate form fields normally when a student is editing a setting.
  if (event.target.closest("input, select, textarea, [contenteditable]")) return;
  const direction = keys.get(event.key.toLowerCase());
  if (direction) { event.preventDefault(); keyboardDirections.add(direction); }
});
window.addEventListener("keyup", event => { keyboardDirections.delete(keys.get(event.key.toLowerCase())); });
window.addEventListener("blur", () => disable("Paused because this window lost focus. Enable when ready."));
document.addEventListener("visibilitychange", () => { if (document.hidden) disable("Paused while this tab was away. Enable when ready."); });
window.addEventListener("pagehide", () => {
  desiredEnabled = false;
  if (isLocalBrowser) navigator.sendBeacon("/api/lab/controls", new Blob([JSON.stringify(readDriverControls())], { type: "application/json" }));
});
for (const button of document.querySelectorAll("[data-lab-direction]")) {
  const direction = button.dataset.labDirection;
  button.addEventListener("pointerdown", event => { event.preventDefault(); touchDirections.add(direction); button.classList.add("pressed"); button.setPointerCapture(event.pointerId); });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) button.addEventListener(type, () => { touchDirections.delete(direction); button.classList.remove("pressed"); });
}

function showTelemetry(snapshot) {
  const wasConnected = connected;
  connected = snapshot.connected;
  latestTelemetry = snapshot.telemetry;
  find("#connectionDot").classList.toggle("ready", connected);
  find("#connectionLabel").textContent = connected ? "Your robot is connected" : "Waiting for robot code";
  find("#connectionDetail").textContent = connected ? "Measurements are coming from your running WPILib project." : snapshot.message;
  find("#setupPanel").hidden = connected;
  if (!connected) {
    controlsReady = false;
    if (wasConnected || desiredEnabled) disable("Robot connection lost. Reconnect, then enable again.");
    find("#robotStatus").textContent = "Waiting for the robot";
    for (const id of ["leftEncoder", "rightEncoder", "poseError", "labBattery", "cameraState", "cameraRange", "motorPower", "lifecycle"]) find(`#${id}`).textContent = "—";
  } else {
    const robot = latestTelemetry;
    find("#robotStatus").textContent = robot.status;
    find("#leftEncoder").textContent = `${robot.leftEncoder.toFixed(2)} m`;
    find("#rightEncoder").textContent = `${robot.rightEncoder.toFixed(2)} m`;
    find("#poseError").textContent = `${robot.poseError.toFixed(2)} m`;
    find("#labBattery").textContent = `${robot.battery.toFixed(1)} V`;
    find("#cameraState").textContent = robot.targetVisible ? "Target visible" : "No target";
    find("#cameraRange").textContent = robot.targetVisible ? `${robot.targetDistance.toFixed(2)} m` : "—";
    find("#motorPower").textContent = `${Math.round(robot.leftPower * 100)}% / ${Math.round(robot.rightPower * 100)}%`;
    find("#lifecycle").textContent = robot.lifecycle;
  }
  updateButtons(); drawField();
}
if (isLocalBrowser) {
  const events = new EventSource("/api/lab/events");
  events.onmessage = event => showTelemetry(JSON.parse(event.data));
  events.onerror = () => showTelemetry({ connected: false, telemetry: null, message: "Check that npm start is still running." });
} else {
  showTelemetry({ connected: false, telemetry: null, message: `Open http://localhost:${location.port || 4173}/learn.html on the computer running the robot to drive.` });
  find("#controlNotice").textContent = "You can read the lessons here. Use the server computer for Java robot controls.";
}

function drawField() {
  const canvas = find("#labField"); const context = canvas.getContext("2d");
  const width = canvas.width; const height = canvas.height;
  const scaleX = width / 16.54; const scaleY = height / 8.21; const scale = Math.min(scaleX, scaleY);
  context.clearRect(0, 0, width, height); context.fillStyle = "#081522"; context.fillRect(0, 0, width, height);
  context.strokeStyle = "#213349"; context.lineWidth = 1;
  for (let meter = 0; meter < 17; meter++) { context.beginPath(); context.moveTo(meter * scaleX, 0); context.lineTo(meter * scaleX, height); context.stroke(); }
  for (let meter = 0; meter < 9; meter++) { context.beginPath(); context.moveTo(0, meter * scaleY); context.lineTo(width, meter * scaleY); context.stroke(); }
  const targetX = 14.65 * scaleX; const targetY = height - 4.105 * scaleY;
  context.strokeStyle = "#ffb84a55"; context.setLineDash([6, 6]); context.beginPath(); context.ellipse(targetX, targetY, Number(find("#labStopDistance").value) * scaleX, Number(find("#labStopDistance").value) * scaleY, 0, 0, Math.PI * 2); context.stroke(); context.setLineDash([]);
  context.fillStyle = "#ffb84a"; context.fillRect(targetX - 5, targetY - 22, 10, 44);
  if (!latestTelemetry) { context.fillStyle = "#aec5d8"; context.font = "22px system-ui"; context.textAlign = "center"; context.fillText("Connect your robot to see it here", width / 2, height / 2); return; }
  const robot = latestTelemetry;
  for (const estimated of [false, true]) {
    const x = estimated ? robot.estimatedX : robot.x; const y = estimated ? robot.estimatedY : robot.y;
    context.save(); context.translate(x * scaleX, height - y * scaleY); context.rotate(-robot.heading);
    const robotLength = 0.86 * scale; const robotWidth = 0.78 * scale;
    if (estimated) { context.strokeStyle = "#eaf6ff"; context.lineWidth = 2; context.setLineDash([6, 3]); context.strokeRect(-robotLength / 2 - 3, -robotWidth / 2 - 3, robotLength + 6, robotWidth + 6); }
    else { context.fillStyle = "#37d5ee"; context.fillRect(-robotLength / 2, -robotWidth / 2, robotLength, robotWidth); context.fillStyle = "#06121e"; context.beginPath(); context.moveTo(robotLength * .4, 0); context.lineTo(0, -robotWidth * .25); context.lineTo(0, robotWidth * .25); context.fill(); }
    context.restore();
  }
  if (robot.x < 0 || robot.x > 16.54 || robot.y < 0 || robot.y > 8.21) {
    context.fillStyle = "#ffb84a"; context.font = "20px system-ui"; context.textAlign = "center"; context.fillText("Outside the practice view — disable and reset", width / 2, 35);
  }
}
showLesson(0); drawField();
setInterval(() => void sendControls(), 100);
