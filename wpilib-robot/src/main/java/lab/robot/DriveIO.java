package lab.robot;

import org.wpilib.math.geometry.Pose2d;
import org.wpilib.math.geometry.Rotation2d;

/** Boundary between student control code and motors/sensors. A real robot needs its own implementation. */
public interface DriveIO extends AutoCloseable {
  record Sensors(double leftMeters, double rightMeters, double leftMetersPerSecond,
      double rightMetersPerSecond, Rotation2d heading, double batteryVolts) {}
  void setMotorPower(double leftPower, double rightPower);
  Sensors readSensors();
  void updateSimulation(double seconds, boolean encoderSlip);
  void reset();
  // Only the simulated camera and visualization may read ground truth; Auto must not.
  Pose2d simulationPose();
  @Override void close();
}
