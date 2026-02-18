using UnityEngine;
using UnityEngine.SceneManagement;

public class GameFlowManager : MonoBehaviour
{
    public static GameFlowManager Instance { get; private set; }

    private const string FirstRunKey = "FirstRunComplete";

    public bool IsFirstRun => PlayerPrefs.GetInt(FirstRunKey, 0) == 0;

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

    public void StartTherapyFlow()
    {
        if (IsFirstRun)
        {
            SceneManager.LoadScene("Demo_L1");
        }
        else
        {
            SceneManager.LoadScene("Level1");
        }
    }

    public void OnDemoComplete(int levelNumber)
    {
        SceneManager.LoadScene($"Level{levelNumber}");
    }

    public void OnLevelComplete(int levelNumber)
    {
        if (levelNumber >= 7)
        {
            PlayerPrefs.SetInt(FirstRunKey, 1);
            PlayerPrefs.Save();
            SceneManager.LoadScene("SessionSummary");
            return;
        }

        if (IsFirstRun)
        {
            SceneManager.LoadScene($"Demo_L{levelNumber + 1}");
        }
        else
        {
            SceneManager.LoadScene($"Level{levelNumber + 1}");
        }
    }

    public void ReturnToStart()
    {
        SceneManager.LoadScene("StartScreen");
    }
}
