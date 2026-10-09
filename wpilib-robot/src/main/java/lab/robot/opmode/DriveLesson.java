package lab.robot.opmode;

import lab.robot.Robot;
import org.wpilib.opmode.PeriodicOpMode;
import org.wpilib.opmode.Teleop;

/** WPILib discovers this annotation and adds the routine to its OpMode list. */
@Teleop(name = "Learn to drive")
public final class DriveLesson extends PeriodicOpMode {
  private final Robot robot;
  public DriveLesson(Robot robot) { this.robot = robot; }
  @Override public void start() { robot.onModeStart("Teleop"); }
  @Override public void periodic() { robot.runTeleop(); }
  @Override public void end() { robot.onModeEnd("Teleop"); }
}
