package lab.robot;

import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.Test;
import org.wpilib.math.geometry.Pose2d;
import org.wpilib.math.geometry.Rotation2d;
import lab.robot.AutoController.CameraReading;

class LearningRobotTest {
  private final AutoController controller = new AutoController();

  @Test void missingOrInvalidVisionStopsBothMotors() {
    for (var reading : new CameraReading[] {
        new CameraReading(false, 10, .2), new CameraReading(true, Double.NaN, 0),
        new CameraReading(true, 10, Double.POSITIVE_INFINITY) }) {
      var power = controller.calculate(reading, 1.5, .45);
      assertEquals(0, power.left());
      assertEquals(0, power.right());
    }
  }

  @Test void stopsAtTheThresholdAndSlowsDownAsItApproaches() {
    var stopped = controller.calculate(new CameraReading(true, 1.5, 0), 1.5, .45);
    assertEquals(0, stopped.left());
    assertEquals(0, stopped.right());
    var near = controller.calculate(new CameraReading(true, 2, 0), 1.5, .45);
    var far = controller.calculate(new CameraReading(true, 8, 0), 1.5, .45);
    assertTrue(near.left() > 0 && near.left() < far.left());
    assertEquals(.45, far.left());
    assertEquals(far.left(), far.right());
  }

  @Test void counterclockwiseTargetSpeedsUpTheRightWheelAndCommandsStayBounded() {
    var leftTarget = controller.calculate(new CameraReading(true, 10, .3), 1.5, .8);
    var rightTarget = controller.calculate(new CameraReading(true, 10, -.3), 1.5, .8);
    assertTrue(leftTarget.right() > leftTarget.left());
    assertEquals(leftTarget.left(), rightTarget.right());
    assertEquals(leftTarget.right(), rightTarget.left());
    assertTrue(leftTarget.right() <= 1 && leftTarget.left() >= -1);
  }

  @Test void cameraModelsLatencyVisibilityRangeAndReset() {
    var camera = new SimCamera();
    var pose = new Pose2d(4, 4.105, new Rotation2d());
    for (int tick = 0; tick < 6; tick++) camera.update(pose, false);
    assertFalse(camera.read().visible());
    camera.update(pose, false);
    assertTrue(camera.read().visible());
    assertEquals(10.65, camera.read().distanceMeters(), 1e-6);
    for (int tick = 0; tick < 6; tick++) camera.update(pose, true);
    assertTrue(camera.read().visible(), "six samples of delay after covering lens");
    camera.update(pose, true);
    assertFalse(camera.read().visible());
    camera.reset();
    assertFalse(camera.read().visible());
    for (int tick = 0; tick < 7; tick++) camera.update(new Pose2d(4, 4.105, Rotation2d.fromDegrees(90)), false);
    assertFalse(camera.read().visible(), "target outside field of view");
    for (int tick = 0; tick < 7; tick++) camera.update(new Pose2d(0, 4.105, new Rotation2d()), false);
    assertFalse(camera.read().visible(), "target beyond range");
  }

  @Test void controlPacketRejectsBadDataAndGivesFieldsNames() {
    assertNull(DriverControls.fromPacket(new double[0]));
    assertNull(DriverControls.fromPacket(new double[] {1, 2, Double.NaN, 0, 1.5, .45, 0, 0, 0, 1}));
    assertNull(DriverControls.fromPacket(new double[] {1, 3, 0, 0, 1.5, .45, 0, 0, 0, 1}));
    var controls = DriverControls.fromPacket(new double[] {1, 1, .5, -.5, 2.5, .3, 1, 0, 7, 42});
    assertTrue(controls.enabled() && controls.autonomous() && controls.cameraCovered());
    assertEquals(2.5, controls.stopDistanceMeters());
    assertEquals(42, controls.heartbeatSequence());
    assertFalse(DriverControls.disabled().enabled());
  }
}
