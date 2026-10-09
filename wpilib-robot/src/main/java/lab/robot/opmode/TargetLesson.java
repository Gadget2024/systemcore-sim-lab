package lab.robot.opmode;

import lab.robot.Robot;
import org.wpilib.opmode.Autonomous;
import org.wpilib.opmode.PeriodicOpMode;

/** Lesson 2: follow the measurements from the delayed, simulated camera. */
@Autonomous(name = "Target approach")
public final class TargetLesson extends PeriodicOpMode {
  private final Robot robot;
  public TargetLesson(Robot robot) { this.robot = robot; }
  @Override public void start() { robot.onModeStart("Auto"); }
  @Override public void periodic() { robot.runAuto(); }
  @Override public void end() { robot.onModeEnd("Auto"); }
}
