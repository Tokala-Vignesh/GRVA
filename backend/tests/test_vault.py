import pytest
from app.credentials.vault import vault

def test_credential_vault_operations():
    test_ref = "test_conn_aws_001"
    secret_payload = {
        "aws_access_key_id": "AKIAIOSFODNN7EXAMPLE",
        "aws_secret_access_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        "region": "us-west-2"
    }

    # 1. Store
    stored = vault.set_credentials(test_ref, secret_payload)
    assert stored is True, "Failed to store credentials"

    # 2. Retrieve
    retrieved = vault.get_credentials(test_ref)
    assert retrieved is not None, "Failed to retrieve credentials"
    assert retrieved["aws_access_key_id"] == secret_payload["aws_access_key_id"]
    assert retrieved["aws_secret_access_key"] == secret_payload["aws_secret_access_key"]
    assert retrieved["region"] == "us-west-2"

    # 3. Delete
    deleted = vault.delete_credentials(test_ref)
    assert deleted is True, "Failed to delete credentials"

    # 4. Verify gone
    post_delete = vault.get_credentials(test_ref)
    assert post_delete is None, "Credentials should be None after deletion"

def test_vault_backend_reported():
    backend = vault.backend_name
    assert backend and len(backend) > 0
