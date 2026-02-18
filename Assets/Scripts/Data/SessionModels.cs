using System;
using System.Collections.Generic;

[Serializable]
public class LevelResult
{
    public int LevelNumber;
    public int BalloonsPopped;
    public int HoldSuccess;
    public float MovementAccuracy;
    public float DurationSeconds;
}

[Serializable]
public class SessionResult
{
    public string SessionId;
    public string PatientName;
    public int Age;
    public string Gender;
    public string AffectedHand;
    public float TotalSessionSeconds;
    public List<LevelResult> Levels = new List<LevelResult>();
}
