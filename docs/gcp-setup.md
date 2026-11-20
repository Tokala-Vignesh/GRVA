# Google Cloud Platform (GCP) Connector Setup Guide

## 1. Prerequisites
- An active GCP Project.
- A Service Account with Viewer permissions on Compute Engine and Cloud Monitoring.

---

## 2. Recommended IAM Roles

Assign the following roles to the Service Account in Google Cloud IAM:
1. `Compute Viewer` (`roles/compute.viewer`) — Grants permission to discover Compute Engine instances, machine types, zones, and network configurations.
2. `Monitoring Viewer` (`roles/monitoring.viewer`) — Grants permission to query Cloud Monitoring time series for CPU, network, and disk metrics.
3. `Logs Viewer` (`roles/logging.viewer`) — (Optional) Grants permission to read instance audit logs.

---

## 3. Generating Service Account Key

1. In Google Cloud Console, navigate to **IAM & Admin > Service Accounts**.
2. Select your service account or click **Create Service Account**.
3. Under the **Keys** tab, click **Add Key > Create New Key > JSON**.
4. Download the JSON key file to your workstation.

---

## 4. Configuring in CloudSentinel AI

1. Open CloudSentinel AI and navigate to **Cloud Connections**.
2. Click **Add Connection** and select **GCP**.
3. Enter:
   - **Connection Name**: e.g. `Primary GCP Project`
   - **Project ID**: e.g. `acme-prod-cloud`
   - **Service Account JSON Payload**: Open the downloaded JSON file and paste its contents directly into the box.
4. Click **Save & Secure in Vault**.
5. The credentials will be stored safely in OS Keyring and tested using Compute Engine zone listing.
