import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta
import boto3
from botocore.exceptions import ClientError, BotoCoreError
from botocore.config import Config
from app.cloud.base import BaseCloudConnector
from app.metrics.normalizer import DiscoveredResource, UnifiedMetricSample, MetricNormalizer

logger = logging.getLogger("cloudsentinel.cloud.aws")

# Boto3 client configuration with retries and exponential backoff
BOTO_CONFIG = Config(
    retries={
        "max_attempts": 5,
        "mode": "adaptive",
    },
    connect_timeout=10,
    read_timeout=30,
)

class AWSConnector(BaseCloudConnector):
    """
    AWS Infrastructure Connector using official Boto3 SDK.
    Interacts with AWS STS, EC2, CloudWatch, CloudWatch Logs, and Cost Explorer.
    """

    def __init__(self, connection_id: str, connection_name: str, credentials: Dict[str, Any]):
        super().__init__(connection_id, connection_name, credentials)
        self.region = self.credentials.get("region", "us-east-1")
        self._session = self._create_boto_session()

    def _create_boto_session(self) -> boto3.Session:
        """Create boto3 session with direct credentials, temporary credentials, or IAM Role assumption."""
        access_key = self.credentials.get("aws_access_key_id")
        secret_key = self.credentials.get("aws_secret_access_key")
        session_token = self.credentials.get("aws_session_token")
        role_arn = self.credentials.get("role_arn")

        base_session = boto3.Session(
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            aws_session_token=session_token,
            region_name=self.region,
        )

        if role_arn:
            logger.info(f"Assuming IAM Role ARN: {role_arn}")
            sts_client = base_session.client("sts", config=BOTO_CONFIG)
            assumed = sts_client.assume_role(
                RoleArn=role_arn,
                RoleSessionName=f"CloudSentinel-{self.connection_id[:8]}",
                DurationSeconds=3600,
            )
            creds = assumed["Credentials"]
            return boto3.Session(
                aws_access_key_id=creds["AccessKeyId"],
                aws_secret_access_key=creds["SecretAccessKey"],
                aws_session_token=creds["SessionToken"],
                region_name=self.region,
            )

        return base_session

    def validate_credentials(self) -> Dict[str, Any]:
        """
        Validate AWS credentials using STS GetCallerIdentity.
        """
        try:
            sts = self._session.client("sts", config=BOTO_CONFIG)
            caller = sts.get_caller_identity()
            account_id = caller.get("Account")
            arn = caller.get("Arn")
            user_id = caller.get("UserId")
            logger.info(f"AWS Credentials validated for Account {account_id}, ARN {arn}")
            return {
                "valid": True,
                "account_id": account_id,
                "arn": arn,
                "user_id": user_id,
                "region": self.region,
            }
        except (ClientError, BotoCoreError) as e:
            logger.error(f"AWS Credential validation failed: {e}")
            raise ValueError(f"AWS Authentication failed: {str(e)}")

    def discover_resources(self) -> List[DiscoveredResource]:
        """
        Discover EC2 instances with tags, VPC, IPs, states, and attached EBS volumes.
        """
        ec2 = self._session.client("ec2", config=BOTO_CONFIG)
        discovered: List[DiscoveredResource] = []

        try:
            paginator = ec2.get_paginator("describe_instances")
            for page in paginator.paginate():
                for reservation in page.get("Reservations", []):
                    for inst in reservation.get("Instances", []):
                        instance_id = inst.get("InstanceId")
                        state = inst.get("State", {}).get("Name", "unknown")
                        instance_type = inst.get("InstanceType")
                        az = inst.get("Placement", {}).get("AvailabilityZone")
                        vpc_id = inst.get("VpcId")
                        subnet_id = inst.get("SubnetId")
                        private_ip = inst.get("PrivateIpAddress")
                        public_ip = inst.get("PublicIpAddress")

                        # Parse instance Name tag
                        name = instance_id
                        tags_dict = {}
                        for t in inst.get("Tags", []):
                            k = t.get("Key")
                            v = t.get("Value")
                            if k and v:
                                tags_dict[k] = v
                                if k.lower() == "name":
                                    name = v

                        # EBS volumes attached
                        block_devices = []
                        for bdm in inst.get("BlockDeviceMappings", []):
                            ebs = bdm.get("Ebs", {})
                            block_devices.append({
                                "device_name": bdm.get("DeviceName"),
                                "volume_id": ebs.get("VolumeId"),
                                "status": ebs.get("Status"),
                            })

                        discovered.append(DiscoveredResource(
                            resource_id=instance_id,
                            resource_name=name,
                            provider="aws",
                            resource_type="virtual_machine",
                            region=self.region,
                            zone=az,
                            status=state,
                            ip_address=public_ip,
                            private_ip=private_ip,
                            instance_type=instance_type,
                            tags=tags_dict,
                            raw_metadata={
                                "vpc_id": vpc_id,
                                "subnet_id": subnet_id,
                                "block_devices": block_devices,
                                "architecture": inst.get("Architecture"),
                                "launch_time": inst.get("LaunchTime").isoformat() if inst.get("LaunchTime") else None,
                            }
                        ))
            logger.info(f"Discovered {len(discovered)} EC2 instances in AWS {self.region}")
            return discovered
        except (ClientError, BotoCoreError) as e:
            if "UnauthorizedOperation" in str(e) or "AccessDenied" in str(e):
                logger.warning(
                    f"AWS EC2 DescribeInstances not authorized for user or restricted by SCP in {self.region}: {e}. "
                    "Returning 0 discovered instances. Please ensure ec2:DescribeInstances is permitted in IAM/SCP."
                )
                return []
            logger.error(f"Error discovering EC2 instances: {e}")
            raise RuntimeError(f"AWS EC2 discovery failed: {str(e)}")

    def collect_metrics(
        self,
        resource: DiscoveredResource,
        start_time: datetime,
        end_time: datetime,
        period_seconds: int = 300,
    ) -> List[UnifiedMetricSample]:
        """
        Query CloudWatch via GetMetricData for multi-metric extraction.
        """
        cw = self._session.client("cloudwatch", config=BOTO_CONFIG)
        instance_id = resource.resource_id

        # Metric queries definition
        metric_queries = [
            {
                "Id": "cpu",
                "MetricStat": {
                    "Metric": {
                        "Namespace": "AWS/EC2",
                        "MetricName": "CPUUtilization",
                        "Dimensions": [{"Name": "InstanceId", "Value": instance_id}],
                    },
                    "Period": period_seconds,
                    "Stat": "Average",
                },
                "ReturnData": True,
            },
            {
                "Id": "net_in",
                "MetricStat": {
                    "Metric": {
                        "Namespace": "AWS/EC2",
                        "MetricName": "NetworkIn",
                        "Dimensions": [{"Name": "InstanceId", "Value": instance_id}],
                    },
                    "Period": period_seconds,
                    "Stat": "Average",
                },
                "ReturnData": True,
            },
            {
                "Id": "net_out",
                "MetricStat": {
                    "Metric": {
                        "Namespace": "AWS/EC2",
                        "MetricName": "NetworkOut",
                        "Dimensions": [{"Name": "InstanceId", "Value": instance_id}],
                    },
                    "Period": period_seconds,
                    "Stat": "Average",
                },
                "ReturnData": True,
            },
            {
                "Id": "disk_read",
                "MetricStat": {
                    "Metric": {
                        "Namespace": "AWS/EC2",
                        "MetricName": "DiskReadBytes",
                        "Dimensions": [{"Name": "InstanceId", "Value": instance_id}],
                    },
                    "Period": period_seconds,
                    "Stat": "Average",
                },
                "ReturnData": True,
            },
            {
                "Id": "disk_write",
                "MetricStat": {
                    "Metric": {
                        "Namespace": "AWS/EC2",
                        "MetricName": "DiskWriteBytes",
                        "Dimensions": [{"Name": "InstanceId", "Value": instance_id}],
                    },
                    "Period": period_seconds,
                    "Stat": "Average",
                },
                "ReturnData": True,
            },
        ]

        samples: List[UnifiedMetricSample] = []
        try:
            response = cw.get_metric_data(
                MetricDataQueries=metric_queries,
                StartTime=start_time,
                EndTime=end_time,
                ScanBy="TimestampAscending",
            )

            # Map timestamps to values
            time_map: Dict[datetime, Dict[str, float]] = {}
            for metric_result in response.get("MetricDataResults", []):
                q_id = metric_result.get("Id")
                name_map = {
                    "cpu": "CPUUtilization",
                    "net_in": "NetworkIn",
                    "net_out": "NetworkOut",
                    "disk_read": "DiskReadBytes",
                    "disk_write": "DiskWriteBytes",
                }
                standard_name = name_map.get(q_id, q_id)
                timestamps = metric_result.get("Timestamps", [])
                values = metric_result.get("Values", [])

                for ts, val in zip(timestamps, values):
                    # Ensure timezone aware UTC
                    if ts.tzinfo is None:
                        ts = ts.replace(tzinfo=timezone.utc)
                    if ts not in time_map:
                        time_map[ts] = {}
                    time_map[ts][standard_name] = float(val)

            for ts, metrics_dict in sorted(time_map.items()):
                sample = MetricNormalizer.normalize_aws(
                    resource_id=instance_id,
                    resource_name=resource.resource_name,
                    region=self.region,
                    status=resource.status,
                    timestamp=ts,
                    cloudwatch_metrics=metrics_dict,
                    agent_installed=False, # Agent required for mem/disk%
                )
                samples.append(sample)

            return samples
        except (ClientError, BotoCoreError) as e:
            logger.error(f"CloudWatch metric collection failed for {instance_id}: {e}")
            return []

    def collect_logs(
        self,
        resource_id: str,
        start_time: datetime,
        end_time: datetime,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """
        Query CloudWatch Logs for events relating to this instance if log group exists.
        """
        logs_client = self._session.client("logs", config=BOTO_CONFIG)
        log_group_name = f"/aws/ec2/{resource_id}"
        events: List[Dict[str, Any]] = []

        try:
            start_ms = int(start_time.timestamp() * 1000)
            end_ms = int(end_time.timestamp() * 1000)
            
            resp = logs_client.filter_log_events(
                logGroupName=log_group_name,
                startTime=start_ms,
                endTime=end_ms,
                limit=limit,
            )
            for item in resp.get("events", []):
                events.append({
                    "timestamp": datetime.fromtimestamp(item["timestamp"] / 1000.0, tz=timezone.utc).isoformat(),
                    "message": item.get("message", ""),
                    "log_stream_name": item.get("logStreamName"),
                })
        except logs_client.exceptions.ResourceNotFoundException:
            logger.debug(f"Log group {log_group_name} not found in AWS CloudWatch Logs.")
        except ClientError as e:
            logger.warning(f"Unable to read CloudWatch logs for {resource_id}: {e}")

        return events

    def collect_costs(self, start_date: str, end_date: str) -> List[Dict[str, Any]]:
        """
        Fetch AWS Cost and Usage via Cost Explorer API.
        start_date and end_date in 'YYYY-MM-DD' format.
        """
        ce = self._session.client("ce", config=BOTO_CONFIG)
        records: List[Dict[str, Any]] = []

        try:
            resp = ce.get_cost_and_usage(
                TimePeriod={"Start": start_date, "End": end_date},
                Granularity="DAILY",
                Metrics=["UnblendedCost"],
                GroupBy=[
                    {"Type": "DIMENSION", "Key": "SERVICE"},
                    {"Type": "DIMENSION", "Key": "REGION"},
                ],
            )
            for time_entry in resp.get("ResultsByTime", []):
                p_start = time_entry.get("TimePeriod", {}).get("Start")
                p_end = time_entry.get("TimePeriod", {}).get("End")
                for group in time_entry.get("Groups", []):
                    keys = group.get("Keys", [])
                    service_name = keys[0] if len(keys) > 0 else "Unknown"
                    region = keys[1] if len(keys) > 1 else self.region
                    amount = float(group.get("Metrics", {}).get("UnblendedCost", {}).get("Amount", 0.0))
                    unit = group.get("Metrics", {}).get("UnblendedCost", {}).get("Unit", "USD")

                    records.append({
                        "provider": "aws",
                        "service_name": service_name,
                        "region": region,
                        "amount": amount,
                        "currency": unit,
                        "billing_period_start": p_start,
                        "billing_period_end": p_end,
                    })
        except ClientError as e:
            logger.warning(f"AWS Cost Explorer query failed (permissions may be missing): {e}")

        return records
