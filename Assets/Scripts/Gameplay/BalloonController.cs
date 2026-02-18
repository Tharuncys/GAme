using UnityEngine;

public class BalloonController : MonoBehaviour
{
    public RectTransform BalloonTransform;
    public RectTransform PlayAreaBounds;

    private LevelConfig _config;
    private Vector2 _velocity;

    public void Initialize(LevelConfig config)
    {
        _config = config;
        float speed = _config.BalloonSpeed;

        switch (_config.LevelType)
        {
            case LevelType.L1_Static:
            case LevelType.L4_StabilityHold:
                _velocity = Vector2.zero;
                break;
            case LevelType.L2_LeftRight:
                _velocity = new Vector2(speed <= 0f ? 1f : speed, 0f);
                break;
            case LevelType.L3_UpDown:
                _velocity = new Vector2(0f, speed <= 0f ? 1f : speed);
                break;
            case LevelType.L5_SmoothTracking:
            case LevelType.L6_Rotation:
            case LevelType.L7_Combined:
                _velocity = new Vector2(speed, speed * 0.7f);
                break;
        }

        if (_config.EnableShrink)
        {
            BalloonTransform.localScale = Vector3.one * Mathf.Max(0.3f, _config.ShrinkFactor);
        }
    }

    public void TickMotion()
    {
        if (_velocity == Vector2.zero)
        {
            return;
        }

        BalloonTransform.anchoredPosition += _velocity * Time.deltaTime * 90f;

        Rect bounds = PlayAreaBounds.rect;
        Vector2 p = BalloonTransform.anchoredPosition;

        if (p.x <= bounds.xMin || p.x >= bounds.xMax)
        {
            _velocity.x *= -1f;
        }

        if (p.y <= bounds.yMin || p.y >= bounds.yMax)
        {
            _velocity.y *= -1f;
        }

        BalloonTransform.anchoredPosition = new Vector2(
            Mathf.Clamp(p.x, bounds.xMin, bounds.xMax),
            Mathf.Clamp(p.y, bounds.yMin, bounds.yMax)
        );
    }
}
