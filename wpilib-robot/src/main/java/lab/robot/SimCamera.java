package lab.robot;

import java.util.ArrayDeque;
import org.wpilib.math.geometry.Pose2d;
import lab.robot.AutoController.CameraReading;

/** A deliberately simple camera model: limited field of view, range, and 120 ms delay. */
public final class SimCamera {
  private final ArrayDeque<CameraReading> delayedFrames = new ArrayDeque<>();
  private CameraReading latest = new CameraReading(false, 0, 0);

  public CameraReading read() { return latest; }

  public void update(Pose2d truePose, boolean coverLens) {
    double offsetX = 14.65 - truePose.getX();
    double offsetY = 4.105 - truePose.getY();
    double distance = Math.hypot(offsetX, offsetY);
    double bearing = Math.atan2(offsetY, offsetX) - truePose.getRotation().getRadians();
    bearing = Math.atan2(Math.sin(bearing), Math.cos(bearing));
    boolean visible = !coverLens && distance <= 11.5 && Math.abs(bearing) <= Math.toRadians(31.25);
    delayedFrames.add(new CameraReading(visible, visible ? distance : 0, visible ? bearing : 0));
    if (delayedFrames.size() > 6) latest = delayedFrames.remove();
  }

  public void reset() { delayedFrames.clear(); latest = new CameraReading(false, 0, 0); }
}
