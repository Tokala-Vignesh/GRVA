import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta
import numpy as np
import pandas as pd
from app.models.entities import InfrastructureMetric

logger = logging.getLogger("cloudsentinel.ml.forecaster")

MIN_FORECAST_SAMPLES = 20

class ResourceForecaster:
    """
    Predictive Analytics & Time-Series Forecasting Engine.
    Estimates trend trajectories and exhaustion thresholds for CPU, RAM, and Disk
    using linear trend regression and exponential smoothing with confidence intervals.
    """

    @staticmethod
    def forecast_metric(
        metrics: List[InfrastructureMetric],
        metric_name: str, # "cpu_usage_percent", "memory_usage_percent", "disk_usage_percent"
        horizon_hours: int = 24,
    ) -> Dict[str, Any]:
        """
        Produce a forecast for the given metric.
        Requires >= 20 historical observations; otherwise returns insufficient_data.
        """
        # Filter non-null sorted points
        valid_points = []
        for m in sorted(metrics, key=lambda x: x.timestamp):
            val = getattr(m, metric_name, None)
            if val is not None:
                valid_points.append((m.timestamp, float(val)))

        if len(valid_points) < MIN_FORECAST_SAMPLES:
            return {
                "status": "insufficient_data",
                "metric_name": metric_name,
                "sample_count": len(valid_points),
                "required_samples": MIN_FORECAST_SAMPLES,
                "message": f"Predictive analytics requires at least {MIN_FORECAST_SAMPLES} observations. Currently have {len(valid_points)}.",
            }

        # Convert to time delta in hours from start
        start_ts = valid_points[0][0]
        x_hours = np.array([(pt[0] - start_ts).total_seconds() / 3600.0 for pt in valid_points])
        y_vals = np.array([pt[1] for pt in valid_points])

        # Linear regression slope and intercept: y = slope * x + intercept
        slope, intercept = np.polyfit(x_hours, y_vals, 1)

        # Residual standard deviation for confidence bounds
        predicted_historical = slope * x_hours + intercept
        residuals = y_vals - predicted_historical
        std_error = float(np.std(residuals)) if len(residuals) > 1 else 1.0

        # Forecast points for future horizons
        last_x = x_hours[-1]
        last_ts = valid_points[-1][0]

        forecast_points = []
        steps = [1, 3, 6, 12, horizon_hours]
        for h in steps:
            target_x = last_x + h
            projected = float(slope * target_x + intercept)
            # Bound percentages between 0 and 100
            projected_clamped = max(0.0, min(100.0, projected))
            lower_bound = max(0.0, projected - 1.96 * std_error)
            upper_bound = min(100.0, projected + 1.96 * std_error)
            future_ts = last_ts + timedelta(hours=h)

            forecast_points.append({
                "horizon_hours": h,
                "timestamp": future_ts.isoformat(),
                "projected_value": round(projected_clamped, 2),
                "lower_bound": round(lower_bound, 2),
                "upper_bound": round(upper_bound, 2),
            })

        # Calculate Time-To-Exhaustion (e.g. reaching 95% or 100% capacity)
        exhaustion_hours = None
        if slope > 0.01: # Upward trend
            # target = 95.0
            hours_to_95 = (95.0 - (slope * last_x + intercept)) / slope
            if hours_to_95 > 0:
                exhaustion_hours = round(float(hours_to_95), 1)

        trend_direction = "stable"
        if slope > 0.1:
            trend_direction = "increasing"
        elif slope < -0.1:
            trend_direction = "decreasing"

        return {
            "status": "forecasted",
            "metric_name": metric_name,
            "sample_count": len(valid_points),
            "trend_direction": trend_direction,
            "hourly_rate_of_change": round(float(slope), 3),
            "exhaustion_threshold_hours": exhaustion_hours,
            "forecast_horizons": forecast_points,
            "forecasted_at": datetime.now(timezone.utc).isoformat(),
        }
