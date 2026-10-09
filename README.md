# SystemCore Sim Lab

An FRC learning simulator for Coach Greene, with two ways to practice before Systemcore hardware arrives:

- **Quick practice field** at `/`: a browser-only robot model for trying Teleop, Auto, battery sag, and Limelight-style target data.
- **WPILib learning lab** at `/learn.html`: run a real Java robot project on your computer, with four guided lessons, simulated encoders and camera, position estimation, and live NetworkTables telemetry.

The learning lab teaches WPILib 2027 Alpha 7. It includes a commented Auto function students can change and test, with no robot hardware required.

This is a learning simulator, not an emulator of the SystemCore operating system or its exact electronics.

## First-time setup

These instructions take you from a Windows or macOS computer with no developer tools installed to a running simulator. Follow the section for your computer, then continue with **Download the project**. You only need to install the tools and download the project once.

- [Install the tools on Windows](#install-the-tools-on-windows)
- [Install the tools on macOS](#install-the-tools-on-macos)
- [Download the project](#download-the-project)
- [Start the simulator](#start-the-simulator)
- [Stop and start again](#stop-and-start-again)
- [Troubleshooting](#troubleshooting)
- [Start the WPILib learning lab](#start-the-wpilib-learning-lab)
- [Learn to change the code](#learn-to-change-the-code)

### What you need

| Tool | What it does | How you get it |
| --- | --- | --- |
| A web browser | Displays the simulator. | Use a current version of Edge, Chrome, Firefox, or Safari. |
| Git | Downloads a copy of this repository and retrieves future updates. | Follow the Windows or macOS instructions below. |
| Node.js | Runs the small web server on your computer. | Install **Node.js 24 LTS** from the official download page. LTS means Long Term Support. |
| npm | Runs convenient project commands such as `npm start` and `npm test`. | Included with the Node.js installer; **do not install it separately**. |

You need an internet connection for the downloads and may need an administrator password to install the tools. On a school-managed computer, ask your teacher or IT administrator to install them if you do not have permission.

You do **not** need a GitHub account, an npm account, Codex, a code editor, Java, WPILib, or robot hardware for the **quick practice field**. The **WPILib learning lab** additionally needs **Java JDK 25**; the [learning guide](docs/learning-lab.md) walks through installing it, including Windows and macOS steps. Tailscale is optional and is only used for the phone-access instructions later in this guide. The project declares Node.js 20 as its minimum, but new installations should use the supported LTS version recommended above.

A **terminal** is an application where you type commands. Copy only the lines inside each command box, press **Enter** (or **Return**) after each line, and wait for it to finish before entering the next one. You do not need to type the surrounding backticks or a prompt such as `$` or `PS>`.

### Install the tools on Windows

1. Open the official [Git for Windows download page](https://git-scm.com/install/windows). Download the standalone **x64 Setup** installer for most PCs, or **ARM64 Setup** for a Windows on ARM computer. You can check your processor under **Settings > System > About > System type**.
2. Run the downloaded installer. Keep the default options, including the option that makes Git available from the command line and third-party software (the **PATH** option). PATH is the list of places Windows searches for commands.
3. Open the official [Node.js download page](https://nodejs.org/en/download). Select **Node.js 24 LTS** and **Windows**, then download the **Windows Installer (.msi)** for your computer's architecture. Use the installer download; you do not need Docker or a version manager for this guide.
4. Run the Node.js installer. Keep **npm package manager** and **Add to PATH** enabled. If offered extra tools for compiling native modules, you can leave that option unchecked; this project does not need them.
5. Close any existing terminal windows so they can pick up the new installations. Open the **Start** menu, type **PowerShell**, and open **Windows PowerShell**. A normal window is sufficient; you do not need to run it as administrator.
6. Check that all three commands work:

   ```powershell
   git --version
   node --version
   npm --version
   ```

Each command should print a version number: for example, `git version 2.x.x`, `v24.x.x`, and an npm version number. The actual numbers will vary; the `x` characters here are placeholders, not something to type. If any command fails, use [Troubleshooting](#troubleshooting) before continuing.

### Install the tools on macOS

1. Open **Terminal**: press **Command + Space**, type **Terminal**, and press **Return**.
2. Install Apple's Command Line Tools, which include Git:

   ```bash
   xcode-select --install
   ```

   Click **Install** in the dialog and wait for the installation to finish. If Terminal says the tools are already installed, continue. You do not need the full Xcode application or Homebrew for this setup. This method is listed in the official [Git installation instructions for macOS](https://git-scm.com/install/mac).
3. Open the official [Node.js download page](https://nodejs.org/en/download). Select **Node.js 24 LTS** and **macOS**, then download the **macOS Installer (.pkg)**. Use the installer download; you do not need Docker or a version manager for this guide.
4. Open the downloaded `.pkg` file and complete the installation using the default options. It installs both Node.js and npm. Enter your Mac administrator password if requested.
5. Quit and reopen Terminal, then check the installations:

   ```bash
   git --version
   node --version
   npm --version
   ```

Each command should print a version number: a Git version, a Node.js version such as `v24.x.x`, and an npm version. If a command is missing, use [Troubleshooting](#troubleshooting) before continuing. For more background, see the official [Node.js and npm installation guide](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm/).

### Download the project

Downloading a repository with Git is called **cloning**. The commands below create a new `systemcore-sim-lab` folder inside your user folder and then move your terminal into it. `cd` means "change directory."

**Windows — run in PowerShell:**

```powershell
cd $env:USERPROFILE
git clone https://github.com/Gadget2024/systemcore-sim-lab.git
cd systemcore-sim-lab
dir
```

**macOS — run in Terminal:**

```bash
cd ~
git clone https://github.com/Gadget2024/systemcore-sim-lab.git
cd systemcore-sim-lab
ls
```

You should see files including `README.md`, `package.json`, and `server.mjs`. Keep this terminal window open for the next step. This public repository does not require signing into GitHub or configuring a Git username and email just to download and run it.

Install the project packages once, in this folder:

```sh
npm ci
```

This downloads the pinned NetworkTables bridge dependencies. Wait for it to finish before starting the server. You do not need an npm account or a separate browser build step. If PowerShell blocks `npm.ps1`, use `npm.cmd ci`.

### Start the simulator

In the project folder, run this command in PowerShell or Terminal:

```sh
npm start
```

Wait for the message:

```text
SystemCore Sim running at http://localhost:4173
```

Open your web browser and enter **<http://localhost:4173>** in the address bar. You should see the simulator. `localhost` means this computer. Keep the terminal window open while using the simulator; it is normal for the command to keep running without returning to a prompt.

You can also run `node server.mjs` from the same folder. It starts the same server without using the npm shortcut. Open the address above instead of double-clicking `index.html`, so the simulator can use its server endpoints.

Once setup is complete, you can use the included launchers instead of typing a start command:

- **Windows:** open the project folder in File Explorer and double-click `Start Simulator.cmd`. Keep its window open and browse to <http://localhost:4173>.
- **macOS:** open the project folder in Finder and double-click `Start Simulator.command`. It opens Terminal and then your browser automatically. Keep Terminal open. The `.cmd` file is only for Windows.

Use only one start method at a time to avoid trying to run two servers on the same port.

### Stop and start again

To stop the server, click its terminal window and press **Ctrl + C** (also **Control + C** on macOS, not Command + C). If Windows asks whether to terminate the batch job, enter `Y`. Closing only the browser tab does not stop the server.

The next time you want to use the simulator, double-click your operating system's launcher or open a new terminal and run:

**Windows — PowerShell:**

```powershell
cd "$env:USERPROFILE\systemcore-sim-lab"
npm start
```

**macOS — Terminal:**

```bash
cd ~/systemcore-sim-lab
npm start
```

Then open <http://localhost:4173>. You do not need to reinstall the tools or clone the repository again.

### Get future updates

Stop the server, open a terminal in the project folder using the appropriate `cd` command above, and run:

```sh
git pull --ff-only
npm ci
npm start
```

If Git reports conflicting local changes or says it cannot fast-forward, keep your work and ask for help before resetting or deleting files.

### Troubleshooting

| Problem | What to do |
| --- | --- |
| `git`, `node`, or `npm` is "not recognized" or "command not found" | Finish the relevant installation, close and reopen your terminal, and repeat the version checks. On Windows, rerun the installer if necessary and ensure the tool is added to PATH. If Node works but npm is missing, rerun the Node.js installer with npm enabled. |
| PowerShell says `npm.ps1` cannot be loaded because running scripts is disabled | Use `npm.cmd --version`, `npm.cmd start`, or `npm.cmd test` in place of the corresponding npm command. You can also start with `node server.mjs`. No execution-policy change is needed. |
| The Node.js version is below 20, or npm reports an unsupported engine | Install Node.js 24 LTS using the instructions above, reopen your terminal, and check `node --version` again. |
| Git says the destination folder already exists and is not empty | If it is already your copy of this project, enter that folder and continue. Otherwise, preserve the existing folder and choose a different name: `git clone https://github.com/Gadget2024/systemcore-sim-lab.git systemcore-sim-lab-new`, then `cd systemcore-sim-lab-new`. Use that folder name in later commands too. |
| npm cannot find `package.json`, or Node cannot find `server.mjs` | Your terminal is in the wrong folder. Use the `cd` command in **Stop and start again**, then check for those files with `dir` on Windows or `ls` on macOS. |
| `Cannot find package` (for example `ws`) | Run `npm ci` in the project folder, then start again. This version adds dependencies for the WPILib learning lab. |
| The browser cannot connect | Check that the server is still running and use `http://localhost:4173` on the same computer, including `http://` rather than `https://`. Look for an error in the terminal. |
| `EADDRINUSE` or "address already in use" | Another program or simulator instance is using port 4173. If you already started this simulator, use its browser page or stop that instance with Ctrl + C before starting another. |
| macOS says `Start Simulator.command` is not executable | In Terminal, enter the project folder and run `chmod +x "Start Simulator.command"` once, then try again. You can also start it with `node server.mjs` from that folder. |
| Git cannot download the repository | Check your internet connection and open the repository link in your browser. On a managed school network, ask IT for help if GitHub downloads are blocked. |

## Start the WPILib learning lab

After completing the setup above, follow [Learn before the hardware arrives](docs/learning-lab.md) to install **Java JDK 25**. Then keep `npm start` running and open a **second terminal**, enter the project folder, and run:

```sh
npm run robot
```

The first run downloads WPILib and build tools. Once it says **Robot program startup complete**, open **<http://localhost:4173/learn.html>**. Start with **Take the wheel**, then try tuning Auto, covering the camera, and introducing encoder error. Click **Find this in the robot code** in each lesson to locate the corresponding function.

The lab runs and accepts controls on the same computer. No official Driver Station or full WPILib installation is required for these desktop lessons. It starts disabled and requires a fresh Enable after losing its connection. The guide explains how to edit Java, run tests, and prepare for a future hardware project.

## Drive the quick practice field

- Select **Teleop**, then use WASD, the arrow keys, or the touch controls.
- Select **Auto: target** to run the simple vision-guided routine.
- Select **Disabled** or press Escape to stop commanded output.
- E-stop is deliberately latched. Double-click it to clear, then reselect a mode.

## Open it on a phone with Tailscale (optional)

1. Install [Tailscale](https://tailscale.com/download) on both the computer running the simulator and your phone, following the instructions for each device.
2. Open Tailscale on each device and sign both into the same Tailscale network.
3. Keep the simulator server running on the computer. It listens on all interfaces at port `4173`.
4. On your phone, open the actual `http://100.x.x.x:4173` address printed in the computer's terminal and shown in Coach Mode; replace the `x` placeholders with the displayed numbers. `localhost` on a phone refers to the phone, not your computer.
5. If Windows asks, allow Node.js on **Private networks** only.

Phone/Tailscale access applies to the original quick practice field (`/`). The WPILib lab only accepts controls on the computer running the Java robot.

The simulator has no login of its own. Tailscale provides the private network boundary, so do not expose port 4173 directly to the public internet.

## Test (optional)

From the project folder, run the automated checks:

```sh
npm test
```

Or run them directly with Node.js:

```sh
node --test tests/*.test.mjs
```

A successful run reports zero failed tests. You do not need to start the server to run these checks. After installing JDK 25, use `npm run test:java` for the robot controller and camera tests; the [learning guide](docs/learning-lab.md) has more details.

## Learn to change the code

For the Java learning lab, start with [AutoController.java](wpilib-robot/src/main/java/lab/robot/AutoController.java) and the [step-by-step code exercise](docs/learning-lab.md#5-change-a-real-robot-function).

For the **quick practice field**, start with `autoCommand(robotState)` in [src/simulator.mjs](src/simulator.mjs). It has a numbered walkthrough and named settings so you can see what each value changes. Open the file in a code editor, save your changes, and refresh the simulator's browser tab. Refreshing restarts the browser simulation in Disabled mode; select **Auto: target** again to try your change.

### Where each part lives

| File | What to look for |
| --- | --- |
| [src/simulator.mjs](src/simulator.mjs) | `autoCommand()` chooses Auto motor power; `arcadeDrive()` mixes forward/turn requests; `stepRobot()` updates motion; `limelightMeasurement()` creates camera-like readings. |
| [src/app.js](src/app.js) | `setMode()` selects a mode, `command()` chooses Auto or driver input, and `frame()` advances physics in 20 ms steps. `drawField()` and `updateUI()` display the results. |
| [index.html](index.html) | Buttons, dashboard labels, and the canvas drawing area. Keep IDs and data attributes in sync with `app.js` when editing controls. |
| [styles.css](styles.css) | Colors, layout, and rules for smaller screens. Shared colors are at the top. |
| [server.mjs](server.mjs) | Serves the page and the health/network endpoints. Restart the server after changing this file. |
| [tests/simulator.test.mjs](tests/simulator.test.mjs) | Small examples that set up a robot, run it, and check the result. Run them with `npm test`. |
| `Start Simulator.cmd` / `Start Simulator.command` | Windows/macOS shortcuts for starting the same Node server. |

In Auto, the main loop is:

```text
frame() -> command() -> autoCommand(robotState)
                             | measure distance and choose steering
                             | mix left/right motor commands with arcadeDrive()
                             v
                       stepRobot() -> new robotState -> drawField() / updateUI()
```

A **state** is the robot's current position, motion, and mode. A **command** is the requested left/right motor power. `stepRobot()` turns a command into the next state; it also enforces Disabled and E-stop.

### First experiments with Auto

Change **one setting at a time** inside `autoCommand()`, save, refresh, and select Auto:

| Setting | Default | Experiment and expected result |
| --- | --- | --- |
| `maximumForwardPower` | `0.66` | Try `0.35`. The robot should travel more slowly on the long approach. |
| `stopDistanceMeters` | `1.5` | Try `2.5`. The robot should cut motor power farther from the target. It still coasts briefly. |
| `steeringGainPerRadian` | `1.35` | Try `0.8` for gentler steering. First use Teleop to turn away from the target in the open center lane, then select Auto to observe the correction. |

`minimumForwardPower` and `maximumForwardPower` are fractions of full power: keep `0 <= minimumForwardPower <= maximumForwardPower <= 1`. Steering changes each wheel's request, so the forward limit is not a separate cap on each wheel. `approachOffsetMeters` is the reference used in the slowdown formula, not the stop threshold; keep it below `stopDistanceMeters`. The inline comments explain the other settings.

Run `npm test` after editing. If a test fails after an intentional behavior change, read the expected result and compare it with your goal before changing either the code or the test. There is no browser build step for these edits; `npm ci` is only needed during setup or when package dependencies change. Changes to browser files only require a refresh; changes to `server.mjs` require stopping and restarting `npm start`.

### Read the names and units

- Variables such as `distanceToTargetMeters`, `headingErrorRadians`, and `physicsStepSeconds` include their units. The model stores angles in radians; the dashboard converts them to degrees.
- `robotState.x` and `.y` are the robot center's field coordinates in meters. Variables ending in `Pixel` or `Pixels` are drawing coordinates on the screen.
- Motor power ranges from `-1` (full reverse) through `0` (no power) to `1` (full forward). Actual wheel speed changes gradually.
- The short output names `tv`, `tx`, `ty`, and `ta` are retained for the Limelight-style dashboard. Their meaning is documented beside the return value of `limelightMeasurement()`.

The **quick practice field's** Auto knows the exact simulated position and target distance, even when the camera panel says **NO TARGET**. It does not avoid obstacles, and the speed-limit slider affects Teleop only. Its `complete` result cuts motor power near the target but does not switch the UI out of Auto. Use **Disabled**, **Escape**, or **E-stop** to interrupt Auto; the touch **STOP** button only clears manual inputs.

## Path to hardware

The [WPILib learning lab](docs/learning-lab.md) now provides the Java OpMode project, simulated sensors, odometry, and NT4 bridge. Its Auto uses delayed camera measurements and stops when the target is lost. The original quick practice field remains a separate, simpler JavaScript model.

This starter intentionally has no hardware deployment target. A mentor must set up the team's supported hardware project, motor controllers, sensors, camera input, Driver Station, and tuning. The lab practices transferable programming skills; it does not reproduce Systemcore's processor, ports, or operating system. See the [learning guide's model limits and hardware path](docs/learning-lab.md#what-transfers-to-systemcore).
