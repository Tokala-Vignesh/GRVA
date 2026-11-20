# AWS Cloud Connector Setup Guide

## 1. Prerequisites
- An active AWS Account.
- An IAM User or IAM Role with read-only observability permissions.
- Access Key ID and Secret Access Key (or STS temporary credentials).

---

## 2. Minimal Required IAM Policy

Create an IAM Policy named `CloudSentinelObservabilityPolicy`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CallerIdentityAndEC2Discovery",
      "Effect": "Allow",
      "Action": [
        "sts:GetCallerIdentity",
        "ec2:DescribeInstances",
        "ec2:DescribeInstanceStatus",
        "ec2:DescribeRegions",
        "ec2:DescribeVolumes",
        "ec2:DescribeVpcs",
        "ec2:DescribeSubnets",
        "ec2:DescribeTags"
      ],
      "Resource": "*"
    },
    {
      "Sid": "CloudWatchTelemetry",
      "Effect": "Allow",
      "Action": [
        "cloudwatch:GetMetricData",
        "cloudwatch:GetMetricStatistics",
        "cloudwatch:ListMetrics",
        "logs:DescribeLogGroups",
        "logs:FilterLogEvents"
      ],
      "Resource": "*"
    },
    {
      "Sid": "OptionalCostExplorer",
      "Effect": "Allow",
      "Action": [
        "ce:GetCostAndUsage"
      ],
      "Resource": "*"
    }
  ]
}
```

---

## 3. Configuring in CloudSentinel AI

1. Open CloudSentinel AI and navigate to **Cloud Connections** from the sidebar.
2. Click **Add Connection** and choose the **AWS** tab.
3. Enter:
   - **Connection Name**: e.g., `Production AWS Workloads`
   - **Access Key ID**: `AKIA...`
   - **Secret Access Key**: `••••••••••••`
   - **Default Region**: e.g., `us-east-1`
   - **Role ARN (Optional)**: If using cross-account role assumption, specify `arn:aws:iam::123456789012:role/CloudSentinelRole`.
4. Click **Save & Secure in Vault**.
5. Credentials will be validated immediately via `sts:GetCallerIdentity` and stored encrypted in your operating system's native credential manager.
