package lab.robot;

import org.wpilib.framework.RobotBase;

/** Starts the same WPILib lifecycle used by robot projects, on a desktop computer. */
public final class Main {
  private Main() {}

  public static void main(String... args) {
    if (!RobotBase.isSimulation()) {
      throw new IllegalStateException("This classroom project is desktop-only. It has no hardware outputs.");
    }
    RobotBase.startRobot(Robot::new);
  }
}
