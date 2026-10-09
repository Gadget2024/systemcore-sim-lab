package lab.robot;

import org.wpilib.hardware.rotation.Encoder;
import org.wpilib.math.geometry.Pose2d;
import org.wpilib.math.geometry.Rotation2d;
import org.wpilib.math.system.DCMotor;
import org.wpilib.simulation.BatterySim;
import org.wpilib.simulation.DifferentialDrivetrainSim;
import org.wpilib.simulation.EncoderSim;
import org.wpilib.simulation.RoboRioSim;

/** WPILib's motor/drive model feeds WPILib Encoder objects, just as real sensors feed robot code. */
public final class SimDrive implements DriveIO {
  public static final Pose2d START_POSE = new Pose2d(4.0, 4.105, new Rotation2d());
  private final Encoder leftEncoder = new Encoder(0, 1);
  private final Encoder rightEncoder = new Encoder(2, 3);
  private final EncoderSim leftEncoderSim = new EncoderSim(leftEncoder);
  private final EncoderSim rightEncoderSim = new EncoderSim(rightEncoder);
  // Two NEO motors per side; gearing, inertia, mass, wheel radius, and wheel spacing.
  private DifferentialDrivetrainSim physics = createPhysics();
  private double leftPower;
  private double rightPower;
  private double measuredLeftMeters;
  private double measuredRightMeters;
  private double previousLeftMeters;
  private double previousRightMeters;
  private double batteryVolts = 12.6;

  private static DifferentialDrivetrainSim createPhysics() {
    return new DifferentialDrivetrainSim(DCMotor.getNEO(2), 8.0, 7.5, 50.0, 0.0762, 0.62, null);
  }

  public SimDrive() {
    leftEncoder.setDistancePerPulse(0.001);
    rightEncoder.setDistancePerPulse(0.001);
    reset();
  }

  @Override public void setMotorPower(double left, double right) {
    leftPower = AutoController.clamp(left, -1, 1);
    rightPower = AutoController.clamp(right, -1, 1);
  }

  @Override public void updateSimulation(double seconds, boolean encoderSlip) {
    physics.setInputs(leftPower * batteryVolts, rightPower * batteryVolts);
    physics.update(seconds);
    // Lesson 4: a wheel/sensor that under-reports distance makes estimated pose drift.
    double measurementScale = encoderSlip ? 0.75 : 1.0;
    measuredLeftMeters += (physics.getLeftPosition() - previousLeftMeters) * measurementScale;
    measuredRightMeters += (physics.getRightPosition() - previousRightMeters) * measurementScale;
    previousLeftMeters = physics.getLeftPosition();
    previousRightMeters = physics.getRightPosition();
    leftEncoderSim.setDistance(measuredLeftMeters);
    rightEncoderSim.setDistance(measuredRightMeters);
    leftEncoderSim.setRate(physics.getLeftVelocity() * measurementScale);
    rightEncoderSim.setRate(physics.getRightVelocity() * measurementScale);
    batteryVolts = BatterySim.calculateDefaultBatteryLoadedVoltage(physics.getCurrentDraw());
    RoboRioSim.setVInVoltage(batteryVolts);
  }

  @Override public Sensors readSensors() {
    return new Sensors(leftEncoder.getDistance(), rightEncoder.getDistance(),
        leftEncoder.getRate(), rightEncoder.getRate(), physics.getHeading(), batteryVolts);
  }

  @Override public Pose2d simulationPose() { return physics.getPose(); }

  @Override public void reset() {
    setMotorPower(0, 0);
    physics = createPhysics();
    physics.setPose(START_POSE);
    measuredLeftMeters = measuredRightMeters = previousLeftMeters = previousRightMeters = 0;
    leftEncoderSim.setDistance(0);
    rightEncoderSim.setDistance(0);
    leftEncoderSim.setRate(0);
    rightEncoderSim.setRate(0);
    batteryVolts = 12.6;
    RoboRioSim.setVInVoltage(batteryVolts);
  }

  @Override public void close() { leftEncoder.close(); rightEncoder.close(); }
}
