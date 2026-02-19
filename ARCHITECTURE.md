# Modular Architecture (Offline)

## Signal Path
1. **IMU on wrist/hand** measures tilt + rotation.
2. **Microcontroller firmware** converts IMU angles into HID joystick axes/buttons.
3. Device exposes as **USB/Bluetooth virtual joystick**.
4. **Unity 2D game** reads HID using Input axes:
   - Horizontal / Vertical (tilt, flexion-extension)
   - Rotation (pronation/supination)

Optional backup: physical joystick can publish same HID axes for calibration and therapist assist.

## Why this is clinically aligned
- L1 initiation: gentle first wrist activation.
- L2-L3 directional control: selective motor recruitment.
- L4 stability hold: sustained control and tremor reduction.
- L5 smooth tracking: continuous motor coordination.
- L6 rotation gating: pronation/supination training.
- L7 combined tasks: functional hand-wrist integration.

## Safety and Reliability
- Offline-only runtime.
- Large visual targets and simple UI.
- Deterministic level progression.
- Local-only tracking files for privacy and robustness.
