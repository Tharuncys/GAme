using UnityEngine;

[System.Serializable]
public class LevelConfig
{
    public int LevelNumber;
    public LevelType LevelType;
    public int TargetPops;
    public float LevelDurationSeconds;
    public float BalloonSpeed;
    public bool RequireHold;
    public float HoldDuration;
    public bool RequireRotation;
    public float RotationThreshold;
    public bool EnableShrink;
    public float ShrinkFactor;
    public int BalloonCount;

    public static LevelConfig Create(int number)
    {
        switch (number)
        {
            case 1:
                return new LevelConfig { LevelNumber = 1, LevelType = LevelType.L1_Static, TargetPops = 8, LevelDurationSeconds = 60f, BalloonSpeed = 0f, BalloonCount = 1, EnableShrink = false };
            case 2:
                return new LevelConfig { LevelNumber = 2, LevelType = LevelType.L2_LeftRight, TargetPops = 10, LevelDurationSeconds = 70f, BalloonSpeed = 0f, BalloonCount = 1, EnableShrink = false };
            case 3:
                return new LevelConfig { LevelNumber = 3, LevelType = LevelType.L3_UpDown, TargetPops = 10, LevelDurationSeconds = 70f, BalloonSpeed = 0f, BalloonCount = 1, EnableShrink = false };
            case 4:
                return new LevelConfig { LevelNumber = 4, LevelType = LevelType.L4_StabilityHold, TargetPops = 8, LevelDurationSeconds = 80f, BalloonSpeed = 0f, BalloonCount = 1, RequireHold = true, HoldDuration = 1.2f };
            case 5:
                return new LevelConfig { LevelNumber = 5, LevelType = LevelType.L5_SmoothTracking, TargetPops = 10, LevelDurationSeconds = 80f, BalloonSpeed = 1.1f, BalloonCount = 1 };
            case 6:
                return new LevelConfig { LevelNumber = 6, LevelType = LevelType.L6_Rotation, TargetPops = 10, LevelDurationSeconds = 90f, BalloonSpeed = 1.1f, BalloonCount = 1, RequireRotation = true, RotationThreshold = 0.45f };
            case 7:
                return new LevelConfig { LevelNumber = 7, LevelType = LevelType.L7_Combined, TargetPops = 12, LevelDurationSeconds = 100f, BalloonSpeed = 1.2f, BalloonCount = 3, RequireHold = true, HoldDuration = 0.8f, RequireRotation = true, RotationThreshold = 0.4f, EnableShrink = true, ShrinkFactor = 0.75f };
            default:
                return null;
        }
    }
}
