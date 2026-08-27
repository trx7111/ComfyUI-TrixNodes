"""
CivitAI API integration for automatic trigger word fetching.
Supports civitai.red (primary) with civitai.com fallback, fast SHA256 hashing,
local .civitai.info sidecar parsing, and model name query fallback.
"""

import asyncio
import aiohttp
import hashlib
import os
import json
import re
from typing import Optional, List, Dict, Any

from .lora_utils import resolve_lora_full_path, extract_trigger_words

try:
    import folder_paths
    COMFYUI_AVAILABLE = True
except ImportError:
    print("Super LoRA Loader: ComfyUI folder_paths not available for CivitAI service")
    folder_paths = None
    COMFYUI_AVAILABLE = False


class CivitAiService:
    """
    Service for fetching LoRA metadata from CivitAI API (civitai.red -> civitai.com).
    """

    BASE_URLS = [
        "https://civitai.red/api/v1",
        "https://civitai.com/api/v1"
    ]

    def __init__(self):
        self._session: Optional[aiohttp.ClientSession] = None
        self._cache: Dict[str, Dict[str, Any]] = {}

    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create aiohttp session with standard browser headers."""
        if self._session is None or self._session.closed:
            timeout = aiohttp.ClientTimeout(total=8, connect=4)
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ComfyUI-TrixNodes/1.0",
                "Accept": "application/json",
            }
            self._session = aiohttp.ClientSession(timeout=timeout, headers=headers)
        return self._session

    async def close(self):
        """Close the aiohttp session."""
        if self._session and not self._session.closed:
            await self._session.close()

    def _calculate_file_hash(self, file_path: str) -> Optional[str]:
        """
        Calculate SHA256 hash of a LoRA file using high-speed 1MB chunked reading.
        """
        try:
            hash_sha256 = hashlib.sha256()
            with open(file_path, "rb") as f:
                for chunk in iter(lambda: f.read(1024 * 1024), b""):
                    hash_sha256.update(chunk)
            return hash_sha256.hexdigest().upper()
        except Exception as e:
            print(f"CivitAI Service: Error calculating hash for '{file_path}': {e}")
            return None

    def _check_local_sidecar(self, file_path: str) -> Optional[Dict[str, Any]]:
        """
        Check for local .civitai.info, .info, or .json sidecar files next to the LoRA.
        """
        try:
            base, _ = os.path.splitext(file_path)
            candidates = [
                f"{file_path}.civitai.info",
                f"{base}.civitai.info",
                f"{base}.info",
                f"{base}.json"
            ]
            for cand in candidates:
                if os.path.isfile(cand):
                    with open(cand, "r", encoding="utf-8", errors="ignore") as f:
                        data = json.load(f)
                        if isinstance(data, dict):
                            trained = data.get("trainedWords") or data.get("trigger_words")
                            if trained:
                                return data
        except Exception:
            pass
        return None

    async def get_model_info_by_hash(self, file_hash: str) -> Optional[Dict[str, Any]]:
        """
        Get model information from CivitAI by file hash.
        Tries civitai.red first, then civitai.com fallback.
        """
        if not file_hash:
            return None

        file_hash_upper = file_hash.upper()
        if file_hash_upper in self._cache:
            return self._cache[file_hash_upper]

        session = await self._get_session()

        for base_url in self.BASE_URLS:
            url = f"{base_url}/model-versions/by-hash/{file_hash_upper}"
            try:
                async with session.get(url) as response:
                    if response.status == 200:
                        data = await response.json()
                        if isinstance(data, dict) and data.get("id"):
                            self._cache[file_hash_upper] = data
                            return data
                    elif response.status == 404:
                        continue
            except Exception as e:
                print(f"CivitAI Service: Query error on {base_url} for hash {file_hash_upper}: {e}")
                continue

        return None

    async def get_model_info_by_name(self, clean_name: str) -> Optional[Dict[str, Any]]:
        """
        Fallback search by model name if file hash is not matched.
        """
        if not clean_name:
            return None

        # Clean filename into readable search query
        query = re.sub(r"[_\-\.]+", " ", clean_name).strip()
        if len(query) < 3:
            return None

        session = await self._get_session()

        for base_url in self.BASE_URLS:
            url = f"{base_url}/models"
            params = {"query": query, "types": "LORA", "limit": "1"}
            try:
                async with session.get(url, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        items = data.get("items", [])
                        if items and isinstance(items, list):
                            first_item = items[0]
                            versions = first_item.get("modelVersions", [])
                            if versions and isinstance(versions, list):
                                v = versions[0]
                                v["model"] = first_item
                                v["modelId"] = first_item.get("id")
                                return v
            except Exception:
                continue

        return None

    async def get_trigger_words(self, lora_filename: str) -> List[str]:
        """
        Get trigger words for a LoRA file from CivitAI (civitai.red -> civitai.com -> local sidecar -> metadata).
        """
        if not lora_filename or lora_filename == "None":
            return []

        full_path = resolve_lora_full_path(lora_filename)
        trigger_words: List[str] = []

        # 1. Check local sidecar files
        if full_path:
            sidecar = self._check_local_sidecar(full_path)
            if sidecar:
                tw = sidecar.get("trainedWords") or sidecar.get("trigger_words") or []
                if isinstance(tw, list):
                    for w in tw:
                        if isinstance(w, str) and w.strip():
                            trigger_words.append(w.strip())
                        elif isinstance(w, dict) and "word" in w:
                            trigger_words.append(str(w["word"]).strip())
                elif isinstance(tw, str) and tw.strip():
                    trigger_words = [t.strip() for t in tw.split(",") if t.strip()]

                if trigger_words:
                    return trigger_words[:5]

        # 2. Query CivitAI by file hash
        if full_path:
            file_hash = self._calculate_file_hash(full_path)
            if file_hash:
                model_info = await self.get_model_info_by_hash(file_hash)
                if model_info:
                    trained_words = model_info.get("trainedWords", [])
                    if trained_words:
                        for word in trained_words:
                            if isinstance(word, str) and word.strip():
                                trigger_words.append(word.strip())
                            elif isinstance(word, dict) and "word" in word:
                                trigger_words.append(str(word["word"]).strip())

                    if trigger_words:
                        return trigger_words[:5]

        # 3. Fallback search by model name on CivitAI
        clean_base = os.path.splitext(os.path.basename(lora_filename))[0]
        model_info = await self.get_model_info_by_name(clean_base)
        if model_info:
            trained_words = model_info.get("trainedWords", [])
            if trained_words:
                for word in trained_words:
                    if isinstance(word, str) and word.strip():
                        trigger_words.append(word.strip())
                    elif isinstance(word, dict) and "word" in word:
                        trigger_words.append(str(word["word"]).strip())

            if trigger_words:
                return trigger_words[:5]

        # 4. Fallback: extract from Safetensors header metadata
        try:
            meta_words = extract_trigger_words(lora_filename, max_words=5)
            if meta_words:
                return meta_words
        except Exception:
            pass

        return []

    async def get_model_gallery(self, lora_filename: str, limit: int = 15) -> Dict[str, Any]:
        """
        Fetch full model info, trigger words, description, and preview/gallery images with generation metadata.
        """
        if not lora_filename or lora_filename == "None":
            return {"success": False, "error": "No LoRA filename provided", "images": []}

        full_path = resolve_lora_full_path(lora_filename)
        model_info = None

        # 1. Try by hash
        if full_path:
            file_hash = self._calculate_file_hash(full_path)
            if file_hash:
                model_info = await self.get_model_info_by_hash(file_hash)

        # 2. Fallback by name
        if not model_info:
            clean_base = os.path.splitext(os.path.basename(lora_filename))[0]
            model_info = await self.get_model_info_by_name(clean_base)

        if not model_info:
            return {"success": False, "error": "Model not found on Civitai", "images": []}

        model_id = model_info.get("modelId") or model_info.get("model", {}).get("id")
        version_id = model_info.get("id")
        model_name = model_info.get("model", {}).get("name") or model_info.get("name") or ""
        description = model_info.get("description") or model_info.get("model", {}).get("description") or ""
        trained_words = model_info.get("trainedWords") or []
        base_model = model_info.get("baseModel") or ""

        # Extract images from model_info
        raw_images = list(model_info.get("images") or [])
        session = await self._get_session()

        # If we have version_id, also try querying images API for community gallery images with full meta
        if version_id:
            for base_url in self.BASE_URLS:
                url = f"{base_url}/images"
                params = {"modelVersionId": str(version_id), "limit": str(limit), "sort": "Most Reactions"}
                try:
                    async with session.get(url, params=params) as response:
                        if response.status == 200:
                            data = await response.json()
                            items = data.get("items", [])
                            if items:
                                existing_ids = {str(img.get("id")) for img in raw_images if isinstance(img, dict) and img.get("id")}
                                for item in items:
                                    if isinstance(item, dict) and str(item.get("id")) not in existing_ids:
                                        raw_images.append(item)
                                break
                except Exception:
                    continue

        images = []
        for img in raw_images[:limit]:
            if not isinstance(img, dict):
                continue
            url = img.get("url")
            if not url:
                continue
            meta = img.get("meta") or {}
            if not isinstance(meta, dict):
                meta = {}

            clean_meta = {
                "prompt": meta.get("prompt") or "",
                "negativePrompt": meta.get("negativePrompt") or "",
                "cfgScale": meta.get("cfgScale") or meta.get("cfg"),
                "steps": meta.get("steps"),
                "sampler": meta.get("sampler") or meta.get("samplerName"),
                "seed": meta.get("seed"),
                "size": meta.get("Size") or (f"{img.get('width')}x{img.get('height')}" if img.get('width') else ""),
                "model": meta.get("Model") or meta.get("hashes", {}).get("model") or base_model or model_name or "",
                "resources": meta.get("resources") or []
            }

            images.append({
                "id": img.get("id"),
                "url": url,
                "width": img.get("width"),
                "height": img.get("height"),
                "nsfwLevel": img.get("nsfwLevel"),
                "meta": clean_meta
            })

        civitai_url = None
        if model_id:
            civitai_url = f"https://civitai.red/models/{model_id}?modelVersionId={version_id}" if version_id else f"https://civitai.red/models/{model_id}"

        return {
            "success": True,
            "modelId": model_id,
            "modelVersionId": version_id,
            "modelName": model_name,
            "description": description,
            "trainedWords": trained_words,
            "baseModel": base_model,
            "civitai_url": civitai_url,
            "images": images
        }

    def get_trigger_words_sync(self, lora_filename: str) -> List[str]:
        """
        Synchronous wrapper for getting trigger words.
        """
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                return loop.create_task(self.get_trigger_words(lora_filename))
            return loop.run_until_complete(self.get_trigger_words(lora_filename))
        except Exception:
            return asyncio.run(self.get_trigger_words(lora_filename))


# Global service instance
_civitai_service = CivitAiService()


def get_civitai_service() -> CivitAiService:
    """Get the global CivitAI service instance."""
    return _civitai_service
