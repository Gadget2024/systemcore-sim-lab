# Learn before the hardware arrives

The learning lab runs **real Java robot code with WPILib 2027 Alpha 7** on your computer. The browser sends driver input and displays measurements through NetworkTables 4 (NT4). Four short lessons introduce Teleop, Auto, sensor loss, and position estimation. No controller, camera, gamepad, or robot is needed.

This is an unofficial educational project. It does not emulate Systemcore electronics, its operating system, or a competition field. It has no hardware deployment target.

## 1. Install the web prerequisites

First complete the [README setup](../README.md#first-time-setup): install Git and Node.js (which includes npm), clone the project, and run `npm ci` in the project folder. You need internet access for this step and for the first Java build. Ask your teacher or school IT for help with software installation if needed.

For this Java lab, use a Windows **x64** computer or a Mac. The included robot has been tested on Apple silicon macOS. Windows x64 and Intel macOS instructions are provided, but have not been exercised by this project's author. A phone can use the original quick practice field; these Java lessons run and accept controls on the computer itself. Windows ARM and Chromebooks are outside this guide.

## 2. Install Java JDK 25

A **JDK** contains Java and the tools that compile your `.java` files. Choose **JDK 25**, not a JRE or Java 17/21. This project's pinned WPILib/Gradle combination uses Java 25.

### Windows

1. Open the official [Temurin download page, filtered to Java 25](https://adoptium.net/temurin/releases/?version=25).
2. Choose **Windows**, **x64**, **JDK**, and download the **.msi** installer.
3. Run the installer. Leave **Add to PATH** enabled and enable **Set JAVA_HOME** in Custom Setup. PATH lets your terminal find Java; JAVA_HOME tells build tools where its installation lives. See the [official installer instructions](https://adoptium.net/installation/windows/) if the options look different.
4. Finish the installation and close/reopen PowerShell.
5. Check:

   ```powershell
   java -version
   javac -version
   ```

Both should report version **25** (for example, `25.0.x`). If PowerShell blocks npm scripts later, use `npm.cmd` wherever this guide says `npm`; do not change your execution policy.

### macOS

1. Open the [Temurin Java 25 downloads](https://adoptium.net/temurin/releases/?version=25).
2. Choose **macOS**, **JDK**, and the **.pkg** installer. Choose **aarch64** for an Apple M-series Mac or **x64** for an Intel Mac; **Apple menu > About This Mac** identifies your chip.
3. Open the installer and complete its steps. See the [official macOS installer guide](https://adoptium.net/installation/macOS/).
4. Close/reopen Terminal and check:

   ```bash
   java -version
   javac -version
   ```

Both should report version 25. If you have several Java versions installed, the robot launcher also checks macOS's registered JDK 25 automatically.

You do **not** have to separately install Gradle, the full WPILib installer, VS Code, vendor libraries, or an official Driver Station to run these lessons. The included Gradle wrapper downloads the pinned Java dependencies and desktop native libraries on its first run. This can take several minutes and a substantial download; keep the connection available until it finishes. Later runs reuse the downloads.

## 3. Start two terminals

A terminal running the web server cannot also accept your robot start command. Open a second terminal window, and enter the project folder in **each** window:

**Windows PowerShell:**

```powershell
cd "$env:USERPROFILE\systemcore-sim-lab"
```

**macOS Terminal:**

```bash
cd ~/systemcore-sim-lab
```

If you cloned into a different folder, use its actual path instead.

In the **first** terminal:

```sh
npm start
```

In the **second** terminal:

```sh
npm run robot
```

Wait for `Robot program startup complete`. A running simulation keeps that terminal busy; it does not immediately print `BUILD SUCCESSFUL` or return to a prompt. Open **http://localhost:4173/learn.html** on this same computer. The status should turn green and say **Your robot is connected**. It starts disabled.

To stop, click **Disable**, then press **Ctrl+C** in both terminals (Control+C on macOS). To return another day, repeat these two start commands; you do not need to reinstall anything.

## 4. Try the lessons

Use one lab tab at a time. Hold WASD, arrow keys, or the on-screen direction buttons to drive in Teleop. **Escape**, **Disable**, and **STOP** all disable the Java robot. Switching away from the tab/window also disables it; you must enable again after returning. Keyboard driving pauses while you are editing a slider or menu; click an empty part of the page to resume.

| Lesson | Experiment | What to learn |
| --- | --- | --- |
| Take the wheel | Enable Teleop, drive, turn, then disable and reset. | Motor commands are requests. Encoder distances and wheel speeds describe the response. |
| Tune an approach | Reset, select Auto, and compare 1.5 m and 2.5 m stopping distances. | Each 20 ms loop makes a decision from a camera measurement. Delay and momentum affect the final stop. |
| Lose the target | Cover the camera during Auto, then uncover it. | Auto requests zero power when the delayed camera reports no target. It resumes if the target becomes visible again. |
| Trust, then measure | Reset, enable encoder under-reading, and drive in Teleop. | The outlined position estimate falls behind the actual simulated robot. Encoders report 75% of travel. |

Change one setting at a time. Disable before resetting or changing routines. Reset puts the robot back in the center lane but **keeps your slider and sensor-fault settings**; clear the fault checkboxes when starting a different experiment. The stopping-distance circle is a guide, not an obstacle.

The lesson checkmarks are a student's own progress notes, saved only in that browser. They are not an automated grade or a statement that code is ready for hardware.

## 5. Change a real robot function

Use a plain-text code editor. [Visual Studio Code](https://code.visualstudio.com/download) is optional: install it for your computer, choose **File > Open Folder**, and open `systemcore-sim-lab`. No extensions are required for the commands below.

1. Disable the robot and stop **the second terminal** with Ctrl+C. Leave the web server running.
2. Open [AutoController.java](../wpilib-robot/src/main/java/lab/robot/AutoController.java). Find `calculate()`.
3. Read it in order: stop on missing/invalid vision; stop inside the distance threshold; calculate forward power; calculate steering; produce left/right motor requests.
4. Change `forwardGainPerMeter` from `0.22` to `0.12`. Save the file. A smaller gain should produce a gentler approach when near the target.
5. In that second terminal run:

   ```sh
   npm run test:java
   npm run robot
   ```

6. Return to the page, disable/reset, and enable Auto. Compare the approach. Restore `0.22` to return to the starting behavior.

Another experiment: turn a little in Teleop, disable, choose Auto, and compare `steeringGainPerRadian` values `1.35` and `0.8`. Keep the target within the camera's view. Camera bearing is in **radians**, distance in **meters**, and motor power ranges from **-1 to +1**. Forward power is limited by the slider, but steering can increase one wheel's power above that forward setting.

Do not remove the missing-target check, disabled gate, or stale-input timeout while experimenting. If a test fails, read its expected behavior and compare it with your intended change before altering the test.

### Find your way through the code

| File | Purpose |
| --- | --- |
| [opmode/DriveLesson.java](../wpilib-robot/src/main/java/lab/robot/opmode/DriveLesson.java) | `@Teleop` registers the routine. WPILib calls `start()`, `periodic()`, and `end()`. |
| [opmode/TargetLesson.java](../wpilib-robot/src/main/java/lab/robot/opmode/TargetLesson.java) | `@Autonomous` registers Auto and calls `Robot.runAuto()` each loop. |
| [AutoController.java](../wpilib-robot/src/main/java/lab/robot/AutoController.java) | The small decision function to edit first. It receives camera measurements, never true robot position. |
| [Robot.java](../wpilib-robot/src/main/java/lab/robot/Robot.java) | Connects the routines, checks fresh controls, estimates position, and publishes the dashboard. |
| [DriverControls.java](../wpilib-robot/src/main/java/lab/robot/DriverControls.java) | Converts a numbered network packet into readable names such as `stopDistanceMeters()`. |
| [DriveIO.java](../wpilib-robot/src/main/java/lab/robot/DriveIO.java) | Defines the motor/sensor boundary. |
| [SimDrive.java](../wpilib-robot/src/main/java/lab/robot/SimDrive.java) | WPILib drivetrain physics feeds `EncoderSim` and `Encoder` objects; motor load affects battery voltage. |
| [SimCamera.java](../wpilib-robot/src/main/java/lab/robot/SimCamera.java) | Generates camera readings with range/view limits and 120 ms latency. |
| [src/learning.js](../src/learning.js) | Lesson text, keyboard/buttons, progress, and dashboard drawing. It does not calculate the Java robot's physics. |
| [lib/nt4-bridge.mjs](../lib/nt4-bridge.mjs) | Relays browser controls and real NetworkTables measurements through the Node server. |

```text
Browser driver input → Node bridge → NetworkTables → DriverControls
                                                        ↓
WPILib OpMode periodic() → Robot.runTeleop() / runAuto() → motor requests
                                                        ↓
                     SimDrive physics → encoder readings + ideal heading
                                                        ↓
          DifferentialDriveOdometry → NetworkTables → browser dashboard
```

The simulated camera reads the simulated world, just as a physical camera would observe its surroundings. Auto receives only that camera's delayed observation. The true position is also drawn so students can compare it with their sensor estimate.

## What transfers to Systemcore

Students practice the WPILib 2027 OpMode lifecycle, Java functions and units, motor mixing, sensor-based Auto, encoder measurements, odometry, and NT4 telemetry. This project pins **2027.0.0-alpha-7**, **Gradle 9.4.1**, and **JDK 25**; prerelease APIs can change. Updating WPILib means checking the build and robot code together.

A mentor will still need to create a supported hardware project, configure deployment and the official Driver Station, map actual motor controllers/ports and encoder directions, provide real camera and heading readings, and retune the control code on the team's mechanism. `DriveIO` illustrates where device-specific code belongs. Do not deploy this desktop starter unchanged.

Model limits: a two-NEO-per-side differential drivetrain, an ideal heading sensor, quantized wheel encoders, and a simplified target camera. There is no swerve model, measured Systemcore CPU/network performance, obstacle avoidance, field-wall collision, real Limelight/AprilTag processing, or Systemcore port emulation. The encoder fault is a deliberate measurement error, not a complete tire-slip model. The camera sees at most 11.5 m within a 62.5° horizontal field of view.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Cannot find package 'ws'` or `'@msgpack/msgpack'` | Run `npm ci` in the main project folder, then start again. |
| Launcher says JDK 25 is missing | Check both `java -version` and `javac -version`. Install the **JDK**, reopen the terminal, and verify JAVA_HOME points to JDK 25 on Windows. |
| You intentionally use an unpacked JDK | Set JAVA_HOME to its folder (the folder containing `bin`) in the robot terminal. On macOS a `.jdk` bundle's Java home ends in `Contents/Home`. A mentor can help find the exact path. |
| Gradle download fails | The first build needs access to Gradle, Maven, and WPILib's download servers. Ask school IT about blocked downloads; do not disable certificate checks. Retry the command once connectivity is restored. |
| `gradlew` permission denied on macOS/Linux | From the project folder run `chmod +x wpilib-robot/gradlew` once. |
| Waiting for robot code | Check the second terminal for startup/errors. Use `localhost` on that computer, and run only one Java robot project (NT4 uses port 5810). |
| Another tab is driving | Close the other learning-lab tab and wait a second. Click Disable, then Enable. |
| Connect while disabled before enabling | Click Disable, wait for the connection indicator to turn green, then Enable. |
| Robot will not move in Auto | Uncover the camera and make sure it sees the target. Disable/reset to restore the initial view. It also stops once it reaches the selected distance. |
| Robot is outside the field view | Disable and reset. The Java practice field does not simulate walls. |
| Phone/Tailscale page cannot connect to Java controls | Expected: the Java learning lab only accepts local controls. The original `/` quick practice field still supports phone access. |
| Build errors after editing Java | Fix the first compiler error and run `npm run test:java` again. Java edits need a restart of `npm run robot`; refreshing the page alone does not rebuild Java. |

## Maintainer notes

Run `npm test` for the original model, input validation, control lease, NT4 websocket tests, server routes, and pose playback (arrival jitter, heading wrap, resets, and disconnects). Run `npm run test:java` for the Java controller, camera, and packet tests. `npm run robot -- build` builds and tests the full Java project. The Java tests require JDK 25 and download dependencies on the first run.

Manual integration check: start both processes, drive with W/A/S/D and buttons, use Escape, run Auto to its stop, cover/uncover its camera, inject encoder error, reset, and stop/restart the robot process. Losing control traffic must disable outputs; reconnecting must require a new Enable action. Check both wide and narrow browser layouts.

The browser posts JSON controls to `/api/lab/controls` and receives SSE telemetry from `/api/lab/events`. Routes accept loopback clients with a localhost/loopback Host and reject a foreign Origin. Static serving exposes browser assets and this guide only. The NT4 client and Java NT server use loopback port 5810. `NT_PORT` is a local test override for the Node bridge, not a remote-robot setting.

`/LearningLab/controls` is a `double[]` of ten fields, published atomically:

| Index | Meaning |
| --- | --- |
| 0 | Enable: 0 or 1 |
| 1 | Mode: 1 Auto, 2 Teleop |
| 2–3 | Forward and clockwise turn input, each -1 to 1 |
| 4–5 | Stopping distance (0.5–3 m), maximum forward power (0.1–0.8) |
| 6–7 | Covered camera and encoder under-read switches, 0 or 1 |
| 8 | Reset counter; applied only while disabled |
| 9 | Heartbeat sequence; only a changed sequence refreshes Java's 600 ms watchdog |

`/LearningLab/telemetry` is a JSON string with `schema: 2`, `simulation: true`, a changing `sequence`, monotonic `sampleTimeSeconds`, a `poseResetSequence`, enabled/mode, true and estimated position, encoders/speeds, motor requests, voltage, camera reading, status, and lifecycle label.

The bridge requires fresh telemetry, syncs its NT4 timestamps to the server, grants one browser a 500 ms control lease, and requires a disabled handshake after expiry/reconnection. These are classroom simulation guards, not a hardware safety system.

Physics and pose telemetry run every 20 ms (50 Hz). The bridge forwards new measurements immediately. The browser draws at the display frame rate, interpolating timestamped poses with a 60 ms buffer; numerical readouts remain at 10 Hz. Both the actual and estimated pose use the same playback time. Field resets snap to the new pose, and playback never predicts motion beyond received measurements. Key/button changes send immediately; the 100 ms control heartbeat remains in place.

After upgrading from telemetry schema 1, restart both `npm start` and `npm run robot`, then refresh the page. The browser uses `DriverStationSim` through the Java project; it is not the official Systemcore Driver Station.

Official references:

- [FIRST Systemcore announcement](https://community.firstinspires.org/2026-systemcore-pricing-and-availability)
- [WPILib Systemcore testing releases](https://github.com/wpilibsuite/SystemcoreTesting)
- [OpMode framework](https://docs.wpilib.org/en/latest/docs/software/basic-programming/opmodes.html)
- [WPILib simulation](https://docs.wpilib.org/en/latest/docs/software/wpilib-tools/robot-simulation/introduction.html)
- [Pinned NT4 protocol](https://github.com/wpilibsuite/allwpilib/blob/v2027.0.0-alpha-7/ntcore/doc/networktables4.adoc)
