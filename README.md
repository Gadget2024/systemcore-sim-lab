# SystemCore Sim Lab

A no-install, browser-based FRC learning simulator for Coach Greene. It demonstrates the control loop, differential-drive physics, pose estimation, battery sag, field boundaries, and Limelight-style target data before SystemCore hardware is available.

This is a learning simulator, not an emulator of the SystemCore operating system or its exact electronics.

## Before starting

Install [Node.js 20 or newer](https://nodejs.org/) on the computer that will run the simulator.

## Start on Windows

Double-click `Start Simulator.cmd`. Keep its window open, then browse to <http://localhost:4173>.

Alternatively, from PowerShell in this folder, run:

```powershell
node server.mjs
```

Then open <http://localhost:4173>.

If `node` is not on PATH, use the Node executable bundled with Codex:

```powershell
& "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" server.mjs
```

## Start on macOS

Do not open the `.cmd` file; it is only for Windows.

Double-click `Start Simulator.command`. A Terminal window will start the server and the simulator will open automatically in your browser. Keep the Terminal window open while using it.

When the project was cloned with Git, the launcher should already be executable. If macOS instead reports a permissions problem, open Terminal in the project folder and run this once:

```bash
chmod +x "Start Simulator.command"
```

You can also start it manually from that folder:

```bash
node server.mjs
```

Then open <http://localhost:4173>.

## Drive the simulator

- Select **Teleop**, then use WASD, the arrow keys, or the touch controls.
- Select **Auto: target** to run the simple vision-guided routine.
- Select **Disabled** or press Escape to stop commanded output.
- E-stop is deliberately latched. Double-click it to clear, then reselect a mode.

## Open it on a phone with Tailscale

1. Sign the laptop and phone into the same Tailscale network.
2. Keep this server running. It listens on all interfaces at port `4173`.
3. Use the `http://100.x.x.x:4173` address printed in PowerShell and shown in Coach Mode.
4. If Windows asks, allow Node.js on **Private networks** only.

The simulator has no login of its own. Tailscale provides the private network boundary, so do not expose port 4173 directly to the public internet.

## Test

```powershell
node --test tests/*.test.mjs
```

## Path to a real WPILib project

The next integration step is to add a 2027 Alpha 6 Java robot project after the official WPILib installer is installed. Keep hardware calls behind subsystem interfaces, use WPILib simulation models in `simulationPeriodic()`, and publish the same telemetry names to NetworkTables. A small bridge can then replace this page's local simulated values with live NT4 values while keeping the phone dashboard.

Official references:

- [SystemcoreTesting](https://github.com/wpilibsuite/SystemcoreTesting)
- [2027 WPILib simulation introduction](https://docs.wpilib.org/en/2027/docs/software/wpilib-tools/robot-simulation/introduction.html)
- [NetworkTables overview](https://docs.wpilib.org/en/2027/docs/software/networktables/networktables-intro.html)
