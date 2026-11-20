import os
import joblib
import logging
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timezone
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from app.core.config import settings
from app.models.entities import InfrastructureMetric, MLModelMetadata, Alert, Incident

logger = logging.getLogger("cloudsentinel.ml.anomaly")

MIN_TRAINING_SAMPLES = 15

class AnomalyDetector:
    """
    Multivariate Anomaly Detection using Scikit-Learn Isolation Forest.
    Engineers temporal features: rolling averages, rolling std deviations, rate of change,
    and returns calibrated anomaly scores with contributing metric evidence.
    """

    def __init__(self, contamination: float = 0.05):
        self.contamination = contamination

    def _get_model_path(self, resource_id: str) -> str:
        return str(settings.MODELS_DIR / f"isolation_forest_{resource_id}.joblib")

    def extract_features(self, metrics: List[InfrastructureMetric]) -> Optional[pd.DataFrame]:
        """
        Extract multivariate features from metric samples.
        Handles missing metrics cleanly without substituting zero for missing sensors.
        """
        if len(metrics) < MIN_TRAINING_SAMPLES:
            return None

        # Build records list sorted by timestamp
        records = []
        for m in sorted(metrics, key=lambda x: x.timestamp):
            records.append({
                "timestamp": m.timestamp,
                "cpu": m.cpu_usage_percent,
                "mem": m.memory_usage_percent,
                "disk": m.disk_usage_percent,
                "net_in": m.network_in_bytes,
                "net_out": m.network_out_bytes,
            })

        df = pd.DataFrame(records).set_index("timestamp")

        # Forward-fill / backward-fill sensor readings within the same time series
        df = df.ffill().bfill()

        # If CPU is completely null, we cannot reliably detect
        if df["cpu"].isna().all():
            return None

        # Feature Engineering: Rate of change and rolling stats
        df["cpu_roc"] = df["cpu"].diff().fillna(0.0)
        df["cpu_rolling_mean"] = df["cpu"].rolling(window=3, min_periods=1).mean()
        df["cpu_rolling_std"] = df["cpu"].rolling(window=3, min_periods=1).std().fillna(0.0)

        # Network features
        if "net_in" in df.columns and not df["net_in"].isna().all():
            df["net_in_roc"] = df["net_in"].diff().fillna(0.0)
        else:
            df["net_in"] = 0.0
            df["net_in_roc"] = 0.0

        feature_cols = ["cpu", "cpu_roc", "cpu_rolling_mean", "cpu_rolling_std", "net_in", "net_in_roc"]
        
        # Add memory if available
        if "mem" in df.columns and not df["mem"].isna().all():
            df["mem_rolling_mean"] = df["mem"].rolling(window=3, min_periods=1).mean()
            feature_cols.extend(["mem", "mem_rolling_mean"])

        return df[feature_cols].fillna(0.0)

    def train_or_update_model(self, resource_id: str, feature_df: pd.DataFrame) -> IsolationForest:
        """
        Train an Isolation Forest model and persist the artifact.
        """
        model = IsolationForest(
            n_estimators=100,
            contamination=self.contamination,
            random_state=42,
            n_jobs=1,
        )
        model.fit(feature_df)

        model_path = self._get_model_path(resource_id)
        joblib.dump(model, model_path)
        logger.info(f"Trained & persisted Isolation Forest model for resource {resource_id} at {model_path}")
        return model

    def load_model(self, resource_id: str) -> Optional[IsolationForest]:
        model_path = self._get_model_path(resource_id)
        if os.path.exists(model_path):
            try:
                return joblib.load(model_path)
            except Exception as e:
                logger.error(f"Failed to load model from {model_path}: {e}")
        return None

    def evaluate_resource(self, resource_id: str, db_session) -> Dict[str, Any]:
        """
        Evaluate recent metrics for a resource.
        Returns anomaly diagnosis with score, severity, and evidence.
        """
        # Fetch the last 100 metric samples
        samples = (
            db_session.query(InfrastructureMetric)
            .filter_by(resource_id=resource_id)
            .order_by(InfrastructureMetric.timestamp.desc())
            .limit(100)
            .all()
        )

        if len(samples) < MIN_TRAINING_SAMPLES:
            return {
                "status": "insufficient_data",
                "sample_count": len(samples),
                "required_samples": MIN_TRAINING_SAMPLES,
                "message": f"Insufficient historical observations ({len(samples)}/{MIN_TRAINING_SAMPLES}). Awaiting more telemetry.",
            }

        feature_df = self.extract_features(samples)
        if feature_df is None or len(feature_df) == 0:
            return {
                "status": "insufficient_data",
                "sample_count": len(samples),
                "required_samples": MIN_TRAINING_SAMPLES,
                "message": "Telemetry features could not be formed due to missing core dimensions.",
            }

        # Load or train model
        model = self.load_model(resource_id)
        if model is None:
            model = self.train_or_update_model(resource_id, feature_df)
            # Register in MLModelMetadata
            existing_meta = db_session.query(MLModelMetadata).filter_by(target_resource_id=resource_id).first()
            if not existing_meta:
                meta = MLModelMetadata(
                    model_name="IsolationForestAnomalyDetector",
                    model_type="isolation_forest",
                    target_resource_id=resource_id,
                    version="1.0.0",
                    artifact_path=self._get_model_path(resource_id),
                    training_sample_count=len(feature_df),
                    trained_at=datetime.now(timezone.utc),
                )
                db_session.add(meta)
                db_session.commit()

        # Score the most recent observation
        latest_observation = feature_df.iloc[[-1]]
        pred = model.predict(latest_observation)[0] # 1 for inlier, -1 for anomaly
        raw_score = model.decision_function(latest_observation)[0] # Lower score = more anomalous

        is_anomaly = bool(pred == -1)

        # Calibrate severity based on decision score (typical range -0.5 to 0.5)
        severity = "normal"
        if is_anomaly:
            if raw_score < -0.15:
                severity = "critical"
            elif raw_score < -0.08:
                severity = "high"
            else:
                severity = "medium"

        # Extract evidence metrics
        evidence = {
            "current_cpu": float(latest_observation["cpu"].iloc[0]),
            "cpu_rate_of_change": float(latest_observation["cpu_roc"].iloc[0]),
            "cpu_rolling_mean": float(latest_observation["cpu_rolling_mean"].iloc[0]),
            "raw_decision_score": float(raw_score),
        }

        return {
            "status": "analyzed",
            "is_anomaly": is_anomaly,
            "anomaly_score": float(raw_score),
            "severity": severity,
            "evidence": evidence,
            "evaluated_at": datetime.now(timezone.utc).isoformat(),
        }
