using System.Text;
using UnityEngine;
using UnityEngine.UI;

public class SessionSummaryController : MonoBehaviour
{
    public Text SummaryText;

    private void Start()
    {
        SessionTracker.Instance.CompleteSession();

        var s = SessionTracker.Instance.CurrentSession;
        StringBuilder sb = new StringBuilder();
        sb.AppendLine($"Patient: {s.PatientName}");
        sb.AppendLine($"Age: {s.Age}");
        sb.AppendLine($"Gender: {s.Gender}");
        sb.AppendLine($"Hand: {s.AffectedHand}");
        sb.AppendLine($"Session: {s.TotalSessionSeconds:F1}s");
        sb.AppendLine();

        foreach (var level in s.Levels)
        {
            sb.AppendLine($"L{level.LevelNumber}: Pops={level.BalloonsPopped}, Hold={level.HoldSuccess}, Accuracy={level.MovementAccuracy:F1}% Time={level.DurationSeconds:F1}s");
        }

        SummaryText.text = sb.ToString();
    }

    public void OnReturnToStartPressed()
    {
        GameFlowManager.Instance.ReturnToStart();
    }
}
