import logging
from typing import Dict, Any, List, Optional
import httpx
from app.core.config import settings

logger = logging.getLogger("cloudsentinel.ollama")

class OllamaService:
    """
    Local Ollama inference client.
    Interacts strictly with local loopback (127.0.0.1:11434).
    Validates model availability and handles graceful degradation when Ollama is offline.
    """

    def __init__(self, base_url: Optional[str] = None):
        self.base_url = (base_url or settings.OLLAMA_BASE_URL).rstrip("/")

    def check_health(self) -> Dict[str, Any]:
        """
        Check if local Ollama daemon is active and responding.
        """
        try:
            with httpx.Client(timeout=2.0) as client:
                resp = client.get(f"{self.base_url}/api/version")
                if resp.status_code == 200:
                    version_info = resp.json()
                    return {
                        "available": True,
                        "version": version_info.get("version", "unknown"),
                        "base_url": self.base_url,
                        "error": None,
                    }
                return {
                    "available": False,
                    "version": None,
                    "base_url": self.base_url,
                    "error": f"Ollama returned HTTP status {resp.status_code}",
                }
        except Exception as e:
            return {
                "available": False,
                "version": None,
                "base_url": self.base_url,
                "error": f"Could not connect to Ollama daemon at {self.base_url}: {str(e)}",
            }

    def list_installed_models(self) -> List[str]:
        """
        Retrieve list of installed local models from Ollama.
        """
        try:
            with httpx.Client(timeout=3.0) as client:
                resp = client.get(f"{self.base_url}/api/tags")
                if resp.status_code == 200:
                    data = resp.json()
                    models = [m.get("name") for m in data.get("models", []) if m.get("name")]
                    return models
                return []
        except Exception as e:
            logger.debug(f"Failed to list Ollama models: {e}")
            return []

    def verify_model_exists(self, model_name: str) -> Dict[str, Any]:
        """
        Verify if the desired model is installed locally.
        """
        models = self.list_installed_models()
        exists = any(m == model_name or m.startswith(f"{model_name}:") for m in models)
        return {
            "model": model_name,
            "installed": exists,
            "install_command": f"ollama run {model_name}" if not exists else None,
            "installed_models": models,
        }

    async def generate_response(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.2,
    ) -> str:
        """
        Generate completion using local Ollama model.
        """
        selected_model = model or settings.OLLAMA_MODEL
        payload: Dict[str, Any] = {
            "model": selected_model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": temperature},
        }
        if system_prompt:
            payload["system"] = system_prompt

        try:
            async with httpx.AsyncClient(timeout=settings.OLLAMA_REQUEST_TIMEOUT) as client:
                resp = await client.post(f"{self.base_url}/api/generate", json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    return data.get("response", "").strip()
                else:
                    return f"Error: Ollama returned status {resp.status_code} ({resp.text})"
        except Exception as e:
            return f"Ollama generation failed: {str(e)}. (Ensure Ollama is running at {self.base_url})"

ollama_service = OllamaService()
