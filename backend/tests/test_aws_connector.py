import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime, timezone, timedelta
from app.cloud.aws.connector import AWSConnector
from app.metrics.normalizer import DiscoveredResource

@pytest.fixture
def sample_aws_creds():
    return {
        "aws_access_key_id": "AKIAIOSFODNN7EXAMPLE",
        "aws_secret_access_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        "region": "us-east-1"
    }

def test_aws_validate_credentials(sample_aws_creds):
    with patch("boto3.Session") as mock_session_cls:
        mock_session = MagicMock()
        mock_sts = MagicMock()
        mock_sts.get_caller_identity.return_value = {
            "Account": "123456789012",
            "Arn": "arn:aws:iam::123456789012:user/Alice",
            "UserId": "AIDAJQABLZS4A3QDU576Q"
        }
        mock_session.client.return_value = mock_sts
        mock_session_cls.return_value = mock_session

        connector = AWSConnector("conn-1", "My AWS Account", sample_aws_creds)
        res = connector.validate_credentials()
        assert res["valid"] is True
        assert res["account_id"] == "123456789012"
        assert res["arn"] == "arn:aws:iam::123456789012:user/Alice"

def test_aws_discover_resources(sample_aws_creds):
    with patch("boto3.Session") as mock_session_cls:
        mock_session = MagicMock()
        mock_ec2 = MagicMock()
        mock_paginator = MagicMock()
        mock_paginator.paginate.return_value = [{
            "Reservations": [{
                "Instances": [{
                    "InstanceId": "i-0123456789abcdef0",
                    "State": {"Name": "running"},
                    "InstanceType": "t3.medium",
                    "Placement": {"AvailabilityZone": "us-east-1a"},
                    "PrivateIpAddress": "10.0.1.25",
                    "PublicIpAddress": "54.210.10.15",
                    "VpcId": "vpc-0abc123",
                    "SubnetId": "subnet-0def456",
                    "Tags": [{"Key": "Name", "Value": "prod-api-server"}]
                }]
            }]
        }]
        mock_ec2.get_paginator.return_value = mock_paginator
        mock_session.client.return_value = mock_ec2
        mock_session_cls.return_value = mock_session

        connector = AWSConnector("conn-1", "My AWS", sample_aws_creds)
        resources = connector.discover_resources()

        assert len(resources) == 1
        r = resources[0]
        assert r.resource_id == "i-0123456789abcdef0"
        assert r.resource_name == "prod-api-server"
        assert r.status == "running"
        assert r.ip_address == "54.210.10.15"
        assert r.private_ip == "10.0.1.25"
        assert r.instance_type == "t3.medium"
        assert r.provider == "aws"

def test_aws_metric_normalization_no_zero_fabrication(sample_aws_creds):
    with patch("boto3.Session") as mock_session_cls:
        mock_session = MagicMock()
        mock_cw = MagicMock()
        now = datetime.now(timezone.utc)
        
        mock_cw.get_metric_data.return_value = {
            "MetricDataResults": [
                {
                    "Id": "cpu",
                    "Timestamps": [now],
                    "Values": [42.5]
                },
                {
                    "Id": "net_in",
                    "Timestamps": [now],
                    "Values": [15240.0]
                }
            ]
        }
        mock_session.client.return_value = mock_cw
        mock_session_cls.return_value = mock_session

        connector = AWSConnector("conn-1", "My AWS", sample_aws_creds)
        res = DiscoveredResource(
            resource_id="i-0123456789abcdef0",
            resource_name="prod-api-server",
            provider="aws",
            region="us-east-1",
            status="running"
        )
        samples = connector.collect_metrics(res, now - timedelta(minutes=10), now)

        assert len(samples) == 1
        s = samples[0]
        assert s.cpu_usage_percent == 42.5
        assert s.network_in_bytes == 15240.0
        # Crucial check: memory_usage_percent must be None (NOT 0.0) because Agent is not installed!
        assert s.memory_usage_percent is None
        assert s.disk_usage_percent is None
        assert "memory_usage_percent" in s.unsupported_metrics
