package lab.robot;

/** A small, testable lesson: choose motor power from camera measurements, not true pose. */
public final class AutoController {
  public record CameraReading(boolean visible, double distanceMeters, double bearingRadians) {}
  public record MotorPower(double left, double right, String status) {}

  public MotorPower calculate(CameraReading camera, double stopDistanceMeters, double maximumPower) {
    // Lesson 3: never keep driving on a missing target or invalid measurement.
    if (!camera.visible() || !Double.isFinite(camera.distanceMeters())
        || !Double.isFinite(camera.bearingRadians())) {
      return new MotorPower(0, 0, "Target lost — stopped");
    }
    if (camera.distanceMeters() <= stopDistanceMeters) {
      return new MotorPower(0, 0, "Target reached");
    }
    // Lesson 2: tune one value at a time, then watch the approach and stopping distance.
    final double forwardGainPerMeter = 0.22;
    final double steeringGainPerRadian = 1.35;
    double forwardPower = clamp((camera.distanceMeters() - stopDistanceMeters) * forwardGainPerMeter, 0.08, maximumPower);
    double counterclockwiseTurn = clamp(camera.bearingRadians() * steeringGainPerRadian, -0.45, 0.45);
    return new MotorPower(clamp(forwardPower - counterclockwiseTurn, -1, 1),
        clamp(forwardPower + counterclockwiseTurn, -1, 1), "Approaching target");
  }

  public static double clamp(double value, double minimum, double maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }
}
