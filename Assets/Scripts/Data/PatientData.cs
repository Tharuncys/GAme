using UnityEngine;

public class PatientData : MonoBehaviour
{
    public static PatientData Instance { get; private set; }

    [Header("Patient Entry")]
    public string PatientName;
    public int Age;
    public string Gender;
    public string AffectedHand;

    [Header("Session")]
    public string SessionId;
    public float SessionStartTime;

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

    public void BeginSession(string patientName, int age, string gender, string hand)
    {
        PatientName = patientName;
        Age = age;
        Gender = gender;
        AffectedHand = hand;
        SessionId = System.DateTime.Now.ToString("yyyyMMdd-HHmmss");
        SessionStartTime = Time.time;
    }
}
