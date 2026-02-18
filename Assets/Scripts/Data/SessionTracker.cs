using System.IO;
using System.Text;
using UnityEngine;

public class SessionTracker : MonoBehaviour
{
    public static SessionTracker Instance { get; private set; }

    public SessionResult CurrentSession = new SessionResult();

    private void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }

        Instance = this;
        DontDestroyOnLoad(gameObject);
    }

    public void StartSessionFromPatient()
    {
        if (PatientData.Instance == null)
        {
            return;
        }

        CurrentSession = new SessionResult
        {
            SessionId = PatientData.Instance.SessionId,
            PatientName = PatientData.Instance.PatientName,
            Age = PatientData.Instance.Age,
            Gender = PatientData.Instance.Gender,
            AffectedHand = PatientData.Instance.AffectedHand
        };
    }

    public void AddLevelResult(LevelResult result)
    {
        CurrentSession.Levels.Add(result);
    }

    public void CompleteSession()
    {
        CurrentSession.TotalSessionSeconds = Time.time - PatientData.Instance.SessionStartTime;
        SaveJson();
        SaveCsv();
    }

    private void SaveJson()
    {
        string path = Path.Combine(Application.persistentDataPath, $"session_{CurrentSession.SessionId}.json");
        string json = JsonUtility.ToJson(CurrentSession, true);
        File.WriteAllText(path, json);
    }

    private void SaveCsv()
    {
        string path = Path.Combine(Application.persistentDataPath, $"session_{CurrentSession.SessionId}.csv");
        StringBuilder sb = new StringBuilder();
        sb.AppendLine("Level,BalloonsPopped,HoldSuccess,MovementAccuracy,DurationSeconds");
        foreach (var level in CurrentSession.Levels)
        {
            sb.AppendLine($"{level.LevelNumber},{level.BalloonsPopped},{level.HoldSuccess},{level.MovementAccuracy:F2},{level.DurationSeconds:F2}");
        }
        File.WriteAllText(path, sb.ToString());
    }
}
