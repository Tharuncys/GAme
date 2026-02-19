using UnityEngine;
using UnityEngine.UI;

public class LevelController : MonoBehaviour
{
    [Header("References")]
    public CursorIMUInput CursorInput;
    public BalloonController BalloonPrefab;
    public RectTransform BalloonParent;
    public RectTransform PlayAreaBounds;

    [Header("UI")]
    public Text PopCountText;
    public Text TimerText;

    [Header("Level")]
    public int LevelNumber = 1;

    private LevelConfig _config;
    private float _remaining;
    private int _pops;
    private int _holdSuccess;
    private float _holdTimer;
    private float _movementScore;
    private float _samples;
    private float _startTime;

    private BalloonController[] _activeBalloons;

    private void Start()
    {
        _config = LevelConfig.Create(LevelNumber);
        _remaining = _config.LevelDurationSeconds;
        _startTime = Time.time;
        SpawnBalloons();
    }

    private void Update()
    {
        _remaining -= Time.deltaTime;
        TimerText.text = $"Time: {Mathf.Max(0f, _remaining):F1}s";
        PopCountText.text = $"Pops: {_pops}/{_config.TargetPops}";

        foreach (var balloon in _activeBalloons)
        {
            balloon.TickMotion();
            EvaluateBalloonInteraction(balloon);
        }

        TrackMovementAccuracy();

        if (_pops >= _config.TargetPops || _remaining <= 0f)
        {
            CompleteLevel();
        }
    }

    private void SpawnBalloons()
    {
        _activeBalloons = new BalloonController[_config.BalloonCount];
        for (int i = 0; i < _config.BalloonCount; i++)
        {
            BalloonController balloon = Instantiate(BalloonPrefab, BalloonParent);
            balloon.PlayAreaBounds = PlayAreaBounds;
            balloon.BalloonTransform.anchoredPosition = new Vector2(Random.Range(-220f, 220f), Random.Range(-120f, 120f));
            balloon.Initialize(_config);
            _activeBalloons[i] = balloon;
        }
    }

    private void EvaluateBalloonInteraction(BalloonController balloon)
    {
        float distance = Vector2.Distance(CursorInput.CursorTransform.anchoredPosition, balloon.BalloonTransform.anchoredPosition);
        bool overBalloon = distance < 40f * balloon.BalloonTransform.localScale.x;

        if (!overBalloon)
        {
            if (_config.RequireHold)
            {
                _holdTimer = 0f;
            }
            return;
        }

        if (_config.RequireRotation)
        {
            if (Mathf.Abs(CursorInput.CurrentRotationInput) < _config.RotationThreshold)
            {
                return;
            }
        }

        if (_config.RequireHold)
        {
            _holdTimer += Time.deltaTime;
            if (_holdTimer >= _config.HoldDuration)
            {
                _holdSuccess++;
                _holdTimer = 0f;
                PopAndRespawn(balloon);
            }
            return;
        }

        if (Input.GetButtonDown("Submit") || Input.GetMouseButtonDown(0))
        {
            PopAndRespawn(balloon);
        }
    }

    private void PopAndRespawn(BalloonController balloon)
    {
        _pops++;
        balloon.BalloonTransform.anchoredPosition = new Vector2(Random.Range(-220f, 220f), Random.Range(-120f, 120f));
    }

    private void TrackMovementAccuracy()
    {
        Vector2 inVec = CursorInput.CurrentInput;
        float magnitude = Mathf.Clamp01(inVec.magnitude);
        _movementScore += magnitude;
        _samples += 1f;
    }

    private void CompleteLevel()
    {
        float duration = Time.time - _startTime;
        float accuracy = _samples <= 0f ? 0f : (_movementScore / _samples) * 100f;

        SessionTracker.Instance.AddLevelResult(new LevelResult
        {
            LevelNumber = _config.LevelNumber,
            BalloonsPopped = _pops,
            HoldSuccess = _holdSuccess,
            MovementAccuracy = accuracy,
            DurationSeconds = duration
        });

        GameFlowManager.Instance.OnLevelComplete(LevelNumber);
    }
}
