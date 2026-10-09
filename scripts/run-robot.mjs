import { spawn, spawnSync } from "node:child_process";
import { accessSync, constants } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Find JDK 25 without requiring students to edit their shell configuration.
const isWindows = process.platform === "win32";
const javaName = isWindows ? "java.exe" : "java";
const javacName = isWindows ? "javac.exe" : "javac";
const candidates = [process.env.JAVA_HOME];
if (process.platform === "darwin") {
  const installedJava = spawnSync("/usr/libexec/java_home", ["-v", "25"], { encoding: "utf8" });
  if (installedJava.status === 0) candidates.push(installedJava.stdout.trim());
  candidates.push(join(homedir(), ".wpilib", "2027_alpha7", "jdk"));
} else if (isWindows) {
  candidates.push(join(process.env.PUBLIC ?? "C:\\Users\\Public", "wpilib", "2027_alpha7", "jdk"));
} else {
  candidates.push(join(process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share"), "wpilib", "2027_alpha7", "jdk"));
}
// An undefined home means use java/javac already on PATH.
candidates.push(undefined);
let javaEnvironment;
for (const candidate of candidates) {
  if (candidate === "") continue;
  const java = candidate ? join(candidate, "bin", javaName) : javaName;
  const javac = candidate ? join(candidate, "bin", javacName) : javacName;
  const version = spawnSync(java, ["-version"], { encoding: "utf8" });
  const compiler = spawnSync(javac, ["-version"], { encoding: "utf8" });
  if (/version "25[.\"]/.test(version.stderr ?? "") && /javac 25(?:\.|\s|$)/.test(compiler.stdout ?? "")) {
    javaEnvironment = { ...process.env };
    if (candidate) javaEnvironment.JAVA_HOME = candidate;
    else delete javaEnvironment.JAVA_HOME;
    break;
  }
}
if (!javaEnvironment) {
  console.error("The robot lessons need Java JDK 25. Node/npm alone runs the quick practice field.");
  console.error("Install Temurin JDK 25: https://adoptium.net/temurin/releases/?version=25");
  console.error("Then reopen your terminal. Step-by-step help: docs/learning-lab.md");
  process.exit(1);
}
const task = process.argv[2] ?? "run";
if (!["run", "test", "build"].includes(task)) {
  console.error("Choose run, test, or build. Example: npm run test:java");
  process.exit(1);
}
const robotDirectory = fileURLToPath(new URL("../wpilib-robot/", import.meta.url));
// On Windows cmd.exe executes the fixed wrapper name in its working directory.
// User paths and parameters are never interpolated into a shell command.
const executable = isWindows ? (process.env.ComSpec ?? "cmd.exe") : "./gradlew";
const args = isWindows ? ["/d", "/c", `gradlew.bat ${task} --console=plain`] : [task, "--console=plain"];
if (!isWindows) {
  try { accessSync(join(robotDirectory, "gradlew"), constants.X_OK); }
  catch { console.error("Run chmod +x wpilib-robot/gradlew once, then try again."); process.exit(1); }
}
console.log(task === "run" ? "Starting your desktop robot. Keep this terminal open; Ctrl+C stops it." : `Checking the Java robot (${task})…`);
const child = spawn(executable, args, { cwd: robotDirectory, env: javaEnvironment, stdio: "inherit" });
child.on("error", error => { console.error(`Cannot start the robot: ${error.message}`); process.exitCode = 1; });
// Both processes share the terminal. Relay termination when launched without one, too.
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", code => { process.exitCode = code ?? 1; });
