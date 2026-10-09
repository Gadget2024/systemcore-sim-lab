# Third-party notices

The WPILib Gradle starter configuration and wrapper files were adapted/copied from
[wpilibsuite/vscode-wpilib v2027.0.0-alpha-7](https://github.com/wpilibsuite/vscode-wpilib/tree/v2027.0.0-alpha-7/vscode-wpilib/resources/gradle).
The WPILib project's BSD license is included in [licenses/WPILib-BSD.txt](licenses/WPILib-BSD.txt).

The Gradle wrapper (`wpilib-robot/gradlew`, `gradlew.bat`, and
`gradle/wrapper/gradle-wrapper.jar`) is distributed under the Apache License 2.0,
included in [licenses/Gradle-Apache-2.0.txt](licenses/Gradle-Apache-2.0.txt).
The wrapper downloads Gradle 9.4.1, verified against its official SHA-256 checksum.

WPILib, its transitive dependencies, JUnit, and the desktop native libraries are
resolved by Gradle and retain their respective licenses. The npm packages `ws`
and `@msgpack/msgpack` retain their license files in their installed packages;
versions are pinned in `package-lock.json`. This project is not endorsed by FIRST,
WPILib, or Systemcore's manufacturer.
