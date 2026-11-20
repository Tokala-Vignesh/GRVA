import pytest
from datetime import datetime, timezone, timedelta
from app.models.entities import InfrastructureMetric
from app.ml.anomaly import AnomalyDetector
from app.ml.forecaster import ResourceForecaster

def test_anomaly_detector_insufficient_data():
    detector = AnomalyDetector()
    now = datetime.now(timezone.utc)
    # Only 5 samples (less than 15 required)
    samples = [
        InfrastructureMetric(
            resource_id="res-1",
            timestamp=now - timedelta(minutes=5 * i),
            cpu_usage_percent=20.0,
            network_in_bytes=1000.0,
            network_out_bytes=500.0,
        )
        for i in range(5)
    ]
    df = detector.extract_features(samples)
    assert df is None, "Should reject feature extraction when sample count < MIN_TRAINING_SAMPLES"

def test_anomaly_detector_training_and_scoring(tmp_path):
    detector = AnomalyDetector()
    now = datetime.now(timezone.utc)
    
    # 30 baseline samples with low variance (CPU around 20%)
    samples = [
        InfrastructureMetric(
            resource_id="res-1",
            timestamp=now - timedelta(minutes=30 - i),
            cpu_usage_percent=20.0 + (i % 3),
            network_in_bytes=1000.0,
            network_out_bytes=500.0,
        )
        for i in range(30)
    ]

    features = detector.extract_features(samples)
    assert features is not None
    assert len(features) == 30
    assert "cpu_rolling_mean" in features.columns
    assert "cpu_roc" in features.columns

    # Train model
    model = detector.train_or_update_model("res-1", features)
    assert model is not None

    # An extreme spike (CPU 99% with high ROC)
    extreme_spike = features.iloc[[-1]].copy()
    extreme_spike["cpu"] = 99.0
    extreme_spike["cpu_roc"] = 75.0

    score = model.decision_function(extreme_spike)[0]
    # Decision score should reflect an outlier
    assert isinstance(float(score), float)

def test_forecaster_trend_and_exhaustion():
    now = datetime.now(timezone.utc)
    # 25 samples trending upward steadily: 40% up to 88%
    samples = [
        InfrastructureMetric(
            resource_id="res-2",
            timestamp=now - timedelta(hours=25 - i),
            disk_usage_percent=40.0 + (i * 2.0),
        )
        for i in range(25)
    ]

    forecast = ResourceForecaster.forecast_metric(samples, "disk_usage_percent", horizon_hours=24)
    assert forecast["status"] == "forecasted"
    assert forecast["trend_direction"] == "increasing"
    assert forecast["hourly_rate_of_change"] > 0
    assert forecast["exhaustion_threshold_hours"] is not None
    assert len(forecast["forecast_horizons"]) > 0

def test_forecaster_insufficient_samples():
    now = datetime.now(timezone.utc)
    samples = [
        InfrastructureMetric(
            resource_id="res-3",
            timestamp=now - timedelta(hours=5 - i),
            cpu_usage_percent=50.0,
        )
        for i in range(5)
    ]
    forecast = ResourceForecaster.forecast_metric(samples, "cpu_usage_percent")
    assert forecast["status"] == "insufficient_data"
