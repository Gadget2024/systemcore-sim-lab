package lab.robot;

import java.util.Locale;
import org.wpilib.framework.OpModeRobot;
import org.wpilib.driverstation.RobotState;
import org.wpilib.hardware.hal.RobotMode;
import org.wpilib.math.geometry.Pose2d;
import org.wpilib.math.kinematics.DifferentialDriveOdometry;
import org.wpilib.networktables.DoubleArraySubscriber;
import org.wpilib.networktables.NetworkTableInstance;
import org.wpilib.networktables.StringPublisher;
import org.wpilib.simulation.DriverStationSim;

/** Student robot project: real OpMode lifecycle and NetworkTables, with desktop-only motors. */
public final class Robot extends OpModeRobot {
  private final DriveIO drive = new SimDrive();
  private final SimCamera camera = new SimCamera();
  private final AutoController autoController = new AutoController();
  private final DifferentialDriveOdometry odometry = new DifferentialDriveOdometry(
      SimDrive.START_POSE.getRotation(), 0, 0, SimDrive.START_POSE);
  private final DoubleArraySubscriber controls = NetworkTableInstance.getDefault()
      .getDoubleArrayTopic("/LearningLab/controls").subscribe(new double[0]);
  private final StringPublisher telemetry = NetworkTableInstance.getDefault()
      .getStringTopic("/LearningLab/telemetry").publish();
  // Atomic control packet: enable, mode, throttle, turn, stop distance, max power,
  // camera covered, encoder slip, reset counter, heartbeat sequence.
  private DriverControls driverControls = DriverControls.disabled();
  private double lastSequence = -1;
  private double lastResetCounter;
  private long lastInputNanos;
  private double leftPower;
  private double rightPower;
  private String status = "Disabled";
  private String lifecycle = "Waiting for a mode";
  private int telemetryDivider;
  private long telemetrySequence;

  public Robot() {
    if (!isSimulation()) throw new IllegalStateException("LearningLab only runs in desktop simulation");
    // Keep this lesson's simulated Driver Station controls on this computer.
    var networkTables = NetworkTableInstance.getDefault();
    networkTables.stopServer();
    networkTables.startServer("networktables.json", "127.0.0.1", "", 5810);
  }

  public void onModeStart(String name) { lifecycle = name + ".start()"; }
  public void onModeEnd(String name) { stop(); lifecycle = name + ".end()"; }

  private boolean freshInput() {
    return lastInputNanos != 0 && System.nanoTime() - lastInputNanos < 600_000_000L;
  }

  public void stop() {
    leftPower = rightPower = 0;
    drive.setMotorPower(0, 0);
  }

  private void applyPower(double left, double right) {
    if (!freshInput() || !driverControls.enabled() || !RobotState.isEnabled()) { stop(); return; }
    leftPower = left;
    rightPower = right;
    drive.setMotorPower(left, right);
  }

  public void runTeleop() {
    lifecycle = "Teleop.periodic()";
    double forwardPower = driverControls.throttle() * driverControls.maximumForwardPower();
    double clockwiseTurn = driverControls.turn() * driverControls.maximumForwardPower();
    applyPower(AutoController.clamp(forwardPower + clockwiseTurn, -1, 1),
        AutoController.clamp(forwardPower - clockwiseTurn, -1, 1));
    status = "You are driving";
  }

  public void runAuto() {
    lifecycle = "Auto.periodic()";
    var command = autoController.calculate(camera.read(), driverControls.stopDistanceMeters(),
        driverControls.maximumForwardPower());
    applyPower(command.left(), command.right());
    status = command.status();
  }

  @Override public void disabledPeriodic() { stop(); }
  @Override public void nonePeriodic() { stop(); }

  @Override public void robotPeriodic() {
    var incoming = DriverControls.fromPacket(controls.get());
    // A cached NetworkTables value is not proof that the browser is still there.
    // Only a new heartbeat extends the 600 ms deadline for motor commands.
    if (incoming != null && incoming.heartbeatSequence() != lastSequence) {
      driverControls = incoming;
      lastSequence = incoming.heartbeatSequence();
      lastInputNanos = System.nanoTime();
    }
    boolean enabled = freshInput() && driverControls.enabled();
    // This block is simulation-only: the browser acts as a simulated Driver Station.
    // OpModeRobot still calls start/periodic/end; we never call those methods ourselves.
    DriverStationSim.setDsAttached(true);
    DriverStationSim.setRobotMode(driverControls.autonomous() ? RobotMode.AUTONOMOUS : RobotMode.TELEOPERATED);
    String selectedName = driverControls.autonomous() ? "Target approach" : "Learn to drive";
    for (var option : DriverStationSim.getOpModeOptions()) {
      if (option.name.equals(selectedName)) DriverStationSim.setOpMode(option.id);
    }
    DriverStationSim.setEnabled(enabled);
    DriverStationSim.notifyNewData();
    if (!enabled) { stop(); status = freshInput() ? "Disabled" : "Connection paused — disabled"; }
    if (!enabled && driverControls.resetCounter() != lastResetCounter) {
      lastResetCounter = driverControls.resetCounter();
      drive.reset();
      camera.reset();
      odometry.resetPosition(SimDrive.START_POSE.getRotation(), 0, 0, SimDrive.START_POSE);
    }
  }

  @Override public void simulationPeriodic() {
    drive.updateSimulation(getPeriod(), driverControls.encoderUnderReads());
    var sensors = drive.readSensors();
    Pose2d estimatedPose = odometry.update(sensors.heading(), sensors.leftMeters(), sensors.rightMeters());
    camera.update(drive.simulationPose(), driverControls.cameraCovered());
    // Ten dashboard updates per second; physics still advances at 50 Hz.
    if (++telemetryDivider % 5 != 0) return;
    Pose2d truePose = drive.simulationPose();
    var reading = camera.read();
    double poseError = truePose.getTranslation().getDistance(estimatedPose.getTranslation());
    // Increment a heartbeat even while stationary: NT normally suppresses unchanged values.
    telemetry.set(String.format(Locale.ROOT,
        "{\"schema\":1,\"sequence\":%d,\"simulation\":true,\"enabled\":%s,\"mode\":\"%s\","
        + "\"x\":%.6f,\"y\":%.6f,\"heading\":%.6f,\"estimatedX\":%.6f,\"estimatedY\":%.6f,"
        + "\"leftEncoder\":%.6f,\"rightEncoder\":%.6f,\"leftSpeed\":%.6f,\"rightSpeed\":%.6f,"
        + "\"leftPower\":%.6f,\"rightPower\":%.6f,\"battery\":%.6f,\"poseError\":%.6f,"
        + "\"targetVisible\":%s,\"targetDistance\":%.6f,\"targetBearing\":%.6f,"
        + "\"status\":\"%s\",\"lifecycle\":\"%s\"}",
        ++telemetrySequence, RobotState.isEnabled() && freshInput(), driverControls.autonomous() ? "auto" : "teleop",
        truePose.getX(), truePose.getY(), truePose.getRotation().getRadians(), estimatedPose.getX(), estimatedPose.getY(),
        sensors.leftMeters(), sensors.rightMeters(), sensors.leftMetersPerSecond(), sensors.rightMetersPerSecond(),
        leftPower, rightPower, sensors.batteryVolts(), poseError, reading.visible(), reading.distanceMeters(),
        reading.bearingRadians(), status, lifecycle));
    NetworkTableInstance.getDefault().flush();
  }

  @Override public void close() {
    stop(); controls.close(); telemetry.close(); drive.close(); super.close();
  }
}
