# Microsoft Azure Connector Setup Guide

## 1. Prerequisites
- An active Microsoft Azure Subscription.
- An Entra ID (Azure AD) Application Registration / Service Principal.

---

## 2. Creating an Entra ID Application Registration

1. In the Azure Portal, search for **Microsoft Entra ID**.
2. Navigate to **App registrations > New registration**.
3. Name: `CloudSentinelObservability`
4. Account type: `Accounts in this organizational directory only (Single tenant)`.
5. Click **Register**. Note down:
   - **Application (client) ID**
   - **Directory (tenant) ID**
6. Navigate to **Certificates & secrets > Client secrets > New client secret**.
7. Add a description, choose expiration, and copy the **Value** (Client Secret).

---

## 3. Assigning Subscription Reader Role

1. Search for **Subscriptions** in Azure Portal and select your subscription.
2. Note down your **Subscription ID**.
3. Click **Access control (IAM) > Add role assignment**.
4. Select the **Reader** role and assign it to the `CloudSentinelObservability` service principal.

---

## 4. Configuring in CloudSentinel AI

1. Open CloudSentinel AI and navigate to **Cloud Connections**.
2. Click **Add Connection** and select **Azure**.
3. Enter:
   - **Connection Name**: e.g., `Azure Core Infrastructure`
   - **Subscription ID**: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
   - **Tenant ID**: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
   - **Client ID**: Application (client) ID
   - **Client Secret**: Generated secret value
   - **Default Region**: e.g., `eastus`
4. Click **Save & Secure in Vault**.
