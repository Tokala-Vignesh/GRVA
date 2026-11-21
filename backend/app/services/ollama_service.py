import json
import logging
from typing import Dict, Any, List, Optional, AsyncGenerator
import httpx
from app.core.config import settings

logger = logging.getLogger("cloudsentinel.ollama")

class OllamaInferenceError(Exception):
    """Exception raised when local/cloud Ollama inference fails."""
    def __init__(self, status_code: int, detail: str, is_cloud_payment_required: bool = False):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail
        self.is_cloud_payment_required = is_cloud_payment_required


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

    def list_models_detailed(self) -> List[Dict[str, Any]]:
        """
        Retrieve list of installed local/remote models from Ollama with detailed metadata.
        """
        try:
            with httpx.Client(timeout=3.0) as client:
                resp = client.get(f"{self.base_url}/api/tags")
                if resp.status_code == 200:
                    data = resp.json()
                    results = []
                    for m in data.get("models", []):
                        name = m.get("name")
                        if not name:
                            continue
                        details = m.get("details", {}) or {}
                        is_remote = bool(m.get("remote_host"))
                        is_cloud = is_remote or (":cloud" in name.lower()) or name.startswith("cloud/")
                        results.append({
                            "name": name,
                            "model": m.get("model", name),
                            "is_remote": is_remote,
                            "is_cloud": is_cloud,
                            "remote_host": m.get("remote_host"),
                            "parameter_size": details.get("parameter_size"),
                            "quantization_level": details.get("quantization_level"),
                            "family": details.get("family"),
                            "size": m.get("size", 0),
                        })
                    return results
                return []
        except Exception as e:
            logger.debug(f"Failed to list detailed Ollama models: {e}")
            return []

    def verify_model_exists(self, model_name: str) -> Dict[str, Any]:
        """
        Verify if the desired model is installed locally.
        """
        models = self.list_installed_models()
        model_clean = model_name.strip().lower()
        exists = any(
            m.lower() == model_clean
            or m.lower().startswith(f"{model_clean}:")
            or model_clean.startswith(f"{m.lower().split(':')[0]}:")
            for m in models
        )
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
        Generate completion using local Ollama model with optimized low-latency options.
        Raises OllamaInferenceError on non-200 status code.
        """
        selected_model = model or settings.OLLAMA_MODEL
        payload: Dict[str, Any] = {
            "model": selected_model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": 512,      # Prevent runaway verbose generation
                "num_ctx": 2048,         # Compact context window for fast local GPU/CPU execution
                "top_k": 40,
                "top_p": 0.9,
                "repeat_penalty": 1.1,   # Prevents looping on small models like gemma
            },
        }
        if system_prompt:
            payload["system"] = system_prompt

        async with httpx.AsyncClient(timeout=settings.OLLAMA_REQUEST_TIMEOUT) as client:
            resp = await client.post(f"{self.base_url}/api/generate", json=payload)
            if resp.status_code == 200:
                data = resp.json()
                return data.get("response", "").strip()
            else:
                is_402 = (resp.status_code == 402)
                err_detail = resp.text
                try:
                    err_json = resp.json()
                    if "error" in err_json:
                        err_detail = err_json["error"]
                except Exception:
                    pass
                raise OllamaInferenceError(
                    status_code=resp.status_code,
                    detail=err_detail,
                    is_cloud_payment_required=is_402,
                )

    async def generate_stream(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.2,
    ) -> AsyncGenerator[str, None]:
        """
        Stream tokens directly from local Ollama model in real-time.
        Yields string tokens chunk-by-chunk.
        """
        selected_model = model or settings.OLLAMA_MODEL
        payload: Dict[str, Any] = {
            "model": selected_model,
            "prompt": prompt,
            "stream": True,
            "options": {
                "temperature": temperature,
                "num_predict": 512,      # Compact token budget for fast local streaming
                "num_ctx": 2048,         # Low context footprint
                "top_k": 40,
                "top_p": 0.9,
                "repeat_penalty": 1.1,   # Eliminates repetitive stalls in gemma/phi
            },
        }
        if system_prompt:
            payload["system"] = system_prompt

        async with httpx.AsyncClient(timeout=settings.OLLAMA_REQUEST_TIMEOUT) as client:
            async with client.stream("POST", f"{self.base_url}/api/generate", json=payload) as resp:
                if resp.status_code != 200:
                    err_text = await resp.aread()
                    raw_err = err_text.decode("utf-8", errors="ignore")
                    err_detail = raw_err
                    try:
                        err_json = json.loads(raw_err)
                        if "error" in err_json:
                            err_detail = err_json["error"]
                    except Exception:
                        pass
                    is_402 = (resp.status_code == 402)
                    raise OllamaInferenceError(
                        status_code=resp.status_code,
                        detail=err_detail,
                        is_cloud_payment_required=is_402,
                    )
                async for line in resp.aiter_lines():
                    if line:
                        try:
                            chunk = json.loads(line)
                            token = chunk.get("response", "")
                            if token:
                                yield token
                            if chunk.get("done", False):
                                break
                        except Exception:
                            continue

ollama_service = OllamaService()
