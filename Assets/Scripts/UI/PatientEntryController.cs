using UnityEngine;
using UnityEngine.UI;

public class PatientEntryController : MonoBehaviour
{
    public InputField NameInput;
    public InputField AgeInput;
    public Dropdown GenderDropdown;
    public Dropdown HandDropdown;

    public void OnStartSessionPressed()
    {
        string name = NameInput.text.Trim();
        int age = 0;
        int.TryParse(AgeInput.text.Trim(), out age);
        string gender = GenderDropdown.options[GenderDropdown.value].text;
        string hand = HandDropdown.options[HandDropdown.value].text;

        PatientData.Instance.BeginSession(name, age, gender, hand);
        SessionTracker.Instance.StartSessionFromPatient();
        GameFlowManager.Instance.StartTherapyFlow();
    }
}
