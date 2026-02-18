using UnityEngine;

public class StartScreenController : MonoBehaviour
{
    public void OnStartPressed()
    {
        UnityEngine.SceneManagement.SceneManager.LoadScene("PatientEntry");
    }

    public void OnExitPressed()
    {
        Application.Quit();
    }
}
