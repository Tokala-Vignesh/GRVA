import os
import json
import base64
import logging
from typing import Dict, Any, Optional
import keyring
from keyring.errors import KeyringError
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from app.core.config import settings

logger = logging.getLogger("cloudsentinel.vault")

SERVICE_NAME = "CloudSentinelAI"

class CredentialVault:
    """
    OS-Native Secure Credential Vault.
    Uses Windows Credential Manager / macOS Keychain / Linux Secret Service via Python keyring.
    Provides authenticated AES-256-GCM fallback encryption if the OS keyring is unavailable,
    never falling back to unencrypted plain text.
    """

    def __init__(self):
        self._keyring_backend = keyring.get_keyring()
        self._keyring_available = self._test_keyring()
        if not self._keyring_available:
            logger.warning(
                f"OS native keyring ({self._keyring_backend.name}) is not fully accessible. "
                "Utilizing local PBKDF2-derived AES-256-GCM encrypted vault."
            )
            self._init_fallback_vault()

    def _test_keyring(self) -> bool:
        """Test if OS Keyring is functional and writable."""
        test_key = "__cloudsentinel_vault_probe__"
        test_val = "probe_ok"
        try:
            keyring.set_password(SERVICE_NAME, test_key, test_val)
            val = keyring.get_password(SERVICE_NAME, test_key)
            keyring.delete_password(SERVICE_NAME, test_key)
            return val == test_val
        except (KeyringError, Exception) as e:
            logger.debug(f"Keyring self-test failed: {e}")
            return False

    def _init_fallback_vault(self) -> None:
        """Initialize the local encrypted vault directory and master salt."""
        self._vault_dir = settings.DATA_DIR / ".vault"
        self._vault_dir.mkdir(parents=True, exist_ok=True)
        salt_file = self._vault_dir / ".vault_salt"
        if not salt_file.exists():
            salt = os.urandom(16)
            salt_file.write_bytes(salt)
        else:
            salt = salt_file.read_bytes()

        # Derive 256-bit AES-GCM key from local machine signature and token
        machine_secret = (os.getenv("COMPUTERNAME", "") + os.getenv("USER", "") + settings.API_TOKEN).encode("utf-8")
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        self._aesgcm_key = kdf.derive(machine_secret)
        self._aesgcm = AESGCM(self._aesgcm_key)

    def set_credentials(self, credential_ref: str, secret_data: Dict[str, Any]) -> bool:
        """
        Store sensitive provider credentials securely.
        Never stores in plaintext.
        """
        payload_str = json.dumps(secret_data)

        if self._keyring_available:
            try:
                keyring.set_password(SERVICE_NAME, credential_ref, payload_str)
                logger.info(f"Stored credentials in OS Keyring for ref '{credential_ref}'")
                return True
            except Exception as e:
                logger.error(f"Failed storing in OS keyring: {e}. Switching to encrypted vault.")

        # Fallback to AES-256-GCM encrypted vault
        try:
            nonce = os.urandom(12)
            ciphertext = self._aesgcm.encrypt(nonce, payload_str.encode("utf-8"), credential_ref.encode("utf-8"))
            encrypted_payload = base64.b64encode(nonce + ciphertext).decode("ascii")
            
            vault_file = self._vault_dir / f"{credential_ref}.enc"
            vault_file.write_text(encrypted_payload, encoding="utf-8")
            logger.info(f"Stored encrypted credentials in local vault for ref '{credential_ref}'")
            return True
        except Exception as e:
            logger.error(f"Failed storing credentials in encrypted vault: {e}")
            raise RuntimeError(f"Could not securely persist credentials: {e}")

    def get_credentials(self, credential_ref: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve sensitive provider credentials securely.
        """
        if self._keyring_available:
            try:
                val = keyring.get_password(SERVICE_NAME, credential_ref)
                if val:
                    return json.loads(val)
            except Exception as e:
                logger.debug(f"Keyring read failed for {credential_ref}: {e}")

        # Try fallback vault
        if hasattr(self, "_vault_dir"):
            vault_file = self._vault_dir / f"{credential_ref}.enc"
            if vault_file.exists():
                try:
                    raw_data = base64.b64decode(vault_file.read_text(encoding="utf-8"))
                    nonce = raw_data[:12]
                    ciphertext = raw_data[12:]
                    decrypted = self._aesgcm.decrypt(nonce, ciphertext, credential_ref.encode("utf-8"))
                    return json.loads(decrypted.decode("utf-8"))
                except Exception as e:
                    logger.error(f"Failed to decrypt credentials for {credential_ref}: {e}")
                    return None

        return None

    def delete_credentials(self, credential_ref: str) -> bool:
        """
        Remove stored credentials securely.
        """
        success = False
        if self._keyring_available:
            try:
                keyring.delete_password(SERVICE_NAME, credential_ref)
                success = True
            except Exception as e:
                logger.debug(f"Keyring delete failed: {e}")

        if hasattr(self, "_vault_dir"):
            vault_file = self._vault_dir / f"{credential_ref}.enc"
            if vault_file.exists():
                try:
                    vault_file.unlink()
                    success = True
                except Exception as e:
                    logger.error(f"Failed to delete vault file {vault_file}: {e}")

        return success

    @property
    def is_using_os_keyring(self) -> bool:
        return self._keyring_available

    @property
    def backend_name(self) -> str:
        if self._keyring_available:
            return self._keyring_backend.name
        return "Local AES-256-GCM Encrypted Vault (Authenticated PBKDF2)"


# Global singleton instance
vault = CredentialVault()
