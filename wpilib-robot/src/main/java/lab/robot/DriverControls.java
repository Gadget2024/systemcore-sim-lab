package lab.robot;

/** Give the dashboard's numbered packet fields readable names before robot code uses them. */
public record DriverControls(boolean enabled, boolean autonomous, double throttle, double turn,
    double stopDistanceMeters, double maximumForwardPower, boolean cameraCovered,
    boolean encoderUnderReads, double resetCounter, double heartbeatSequence) {
  public static DriverControls disabled() {
    return new DriverControls(false, false, 0, 0, 1.5, 0.45, false, false, 0, -1);
  }

  /** Null means an invalid packet; it must not refresh the connection watchdog. */
  public static DriverControls fromPacket(double[] packet) {
    if (packet.length != 10) return null;
    for (double value : packet) if (!Double.isFinite(value)) return null;
    if ((packet[0] != 0 && packet[0] != 1) || (packet[1] != 1 && packet[1] != 2)
        || (packet[6] != 0 && packet[6] != 1) || (packet[7] != 0 && packet[7] != 1)) return null;
    return new DriverControls(packet[0] == 1, packet[1] == 1,
        AutoController.clamp(packet[2], -1, 1), AutoController.clamp(packet[3], -1, 1),
        AutoController.clamp(packet[4], 0.5, 3), AutoController.clamp(packet[5], 0.1, 0.8),
        packet[6] == 1, packet[7] == 1, packet[8], packet[9]);
  }
}
