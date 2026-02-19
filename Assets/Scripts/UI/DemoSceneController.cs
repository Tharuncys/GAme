using UnityEngine;

public class DemoSceneController : MonoBehaviour
{
    public int DemoLevelNumber = 1;

    public void OnContinuePressed()
    {
        GameFlowManager.Instance.OnDemoComplete(DemoLevelNumber);
    }
}
