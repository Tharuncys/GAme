using UnityEngine;

public class CursorIMUInput : MonoBehaviour
{
    [Header("Cursor")]
    public RectTransform CursorTransform;
    public float CursorSpeed = 450f;
    public RectTransform PlayAreaBounds;

    [Header("IMU HID Axes")]
    public string HorizontalAxis = "Horizontal";
    public string VerticalAxis = "Vertical";
    public string RotationAxis = "Rotation";

    [Header("Fallback")]
    public bool EnableKeyboardFallback = true;

    public Vector2 CurrentInput { get; private set; }
    public float CurrentRotationInput { get; private set; }

    private void Update()
    {
        float x = Input.GetAxis(HorizontalAxis);
        float y = Input.GetAxis(VerticalAxis);
        float rotation = Input.GetAxis(RotationAxis);

        if (EnableKeyboardFallback && Mathf.Approximately(x, 0f) && Mathf.Approximately(y, 0f))
        {
            x = Input.GetAxis("Horizontal");
            y = Input.GetAxis("Vertical");
        }

        CurrentInput = new Vector2(x, y);
        CurrentRotationInput = rotation;

        Vector2 delta = CurrentInput * CursorSpeed * Time.deltaTime;
        CursorTransform.anchoredPosition += delta;
        ClampToBounds();
    }

    private void ClampToBounds()
    {
        Rect rect = PlayAreaBounds.rect;
        Vector2 p = CursorTransform.anchoredPosition;
        p.x = Mathf.Clamp(p.x, rect.xMin, rect.xMax);
        p.y = Mathf.Clamp(p.y, rect.yMin, rect.yMax);
        CursorTransform.anchoredPosition = p;
    }
}
