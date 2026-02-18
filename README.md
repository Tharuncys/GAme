# Wrist Rehabilitation Balloon Game (Offline, Unity 2D)

This project is structured for a **fully offline Unity 2D rehabilitation game** focused on **hand/wrist motor recovery** after stroke.

## Clinical + Technical Constraints Implemented
- Primary control path: **IMU sensor on wrist/hand → microcontroller → USB/Bluetooth HID virtual joystick → Unity input axes**.
- Physical joystick is supported only as **backup** (calibration/testing/fallback/therapist assist).
- No camera, no cloud, no internet, no VR, no robotics dependency.
- Balloon-only gameplay with simple visuals and beginner-friendly scene flow.

## Required Scene Flow
1. `StartScreen`
2. `PatientEntry`
3. Demo (first launch only): `Demo_L1 -> Level1 -> Demo_L2 -> Level2 ... Demo_L7 -> Level7`
4. Restart flow (after first completion): `Level1 -> Level2 ... Level7`
5. `SessionSummary`

## Unity Setup (Minimal)
- Create scenes with exact names listed above.
- Add `GameFlowManager` in `StartScreen` and mark it persistent.
- Add `PatientData` object in `PatientEntry` and mark persistent.
- Add `LevelController` + `CursorIMUInput` + `BalloonController` in each level.
- Configure Input Manager axes:
  - `Horizontal`, `Vertical` (wrist tilt/flex mapped by HID)
  - `Rotation` (pronation/supination, can be mapped to axis/buttons)

## Level Logic (fixed)
1. L1: single large static balloon (initiation)
2. L2: left/right target popping
3. L3: up/down target popping
4. L4: stability hold-to-pop
5. L5: smooth tracking of slow moving balloon
6. L6: rotation-gated popping
7. L7: combined tilt + hold + rotation with multiple balloons

## Tracking (offline)
Session records include:
- balloons popped
- hold success
- movement accuracy
- session and level duration

Data export is local only (JSON + CSV under `Application.persistentDataPath`).
