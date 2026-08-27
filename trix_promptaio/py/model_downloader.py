import os
import threading
import logging
from typing import Dict, Any, Callable, Optional

logger = logging.getLogger("TrixPromptAIO.Downloader")

# Models ordered: best quality → fastest
# Using original HuggingFace repos (guaranteed to exist).
# CT2-quantized repos tried first for speed; fallback to original.
import urllib.request
import locale

# Regional HF Endpoint configuration for fast downloading
def configure_hf_mirror():
    """Configures high-speed HuggingFace mirror if direct HF endpoint is slow, restricted, or in known blocked regions."""
    if "HF_ENDPOINT" in os.environ:
        return

    # Check locale to automatically use mirror for regions where HF is known to be slow or blocked
    try:
        loc, _ = locale.getdefaultlocale()
        if loc and (loc.startswith("ru") or loc.startswith("zh")):
            logger.info(f"Locale {loc} detected. Enabling high-speed HuggingFace mirror (https://hf-mirror.com) for fast regional downloads.")
            os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"
            import sys
            if "huggingface_hub" in sys.modules:
                try:
                    import huggingface_hub.constants
                    huggingface_hub.constants.ENDPOINT = "https://hf-mirror.com"
                except Exception:
                    pass
            return
    except Exception:
        pass

    try:
        req = urllib.request.Request("https://huggingface.co/api/models/facebook/nllb-200-distilled-600M", headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=1.0) as resp:
            if resp.status == 200:
                logger.info("Direct connection to HuggingFace (huggingface.co) active.")
                return
    except Exception:
        pass

    logger.info("Enabling high-speed HuggingFace mirror (https://hf-mirror.com) for fast regional downloads.")
    os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"
    import sys
    if "huggingface_hub" in sys.modules:
        try:
            import huggingface_hub.constants
            huggingface_hub.constants.ENDPOINT = "https://hf-mirror.com"
        except Exception:
            pass


# Verified HuggingFace models (100% working repos)
# Sizes are actual download sizes (model weight files), not parameter counts.
# CT2 int8 = CTranslate2 quantized — 4x smaller and faster than original PyTorch weights.
MODEL_REPOS = {
    # ── Multilingual ───────────────────────────────────────────────────────
    "nllb_200_1_3b": {
        "repo":        "facebook/nllb-200-distilled-1.3B",
        # CT2 int8 quantized: ~1.3 GB instead of 5.2 GB
        "ct2_repo":    "JustFrederik/nllb-200-distilled-1.3B-ct2-int8",
        "description": "NLLB-200 1.3B",
        "size":        "~1.3 GB",
        "lang_pairs":  "multilingual",
        "src_lang_map": "nllb",
    },
    "nllb_200_distilled": {
        "repo":        "facebook/nllb-200-distilled-600M",
        # CT2 int8 quantized: ~600 MB instead of 2.46 GB
        "ct2_repo":    "JustFrederik/nllb-200-distilled-600M-ct2-int8",
        "description": "NLLB-200 600M",
        "size":        "~600 MB",
        "lang_pairs":  "multilingual",
        "src_lang_map": "nllb",
    },
    "m2m100_418m": {
        "repo":        "facebook/m2m100_418M",
        # CT2 int8 quantized: ~900 MB instead of 1.8 GB
        "ct2_repo":    "michaelfeil/ct2fast-m2m100_418M",
        "description": "M2M-100 418M",
        "size":        "~900 MB",
        "lang_pairs":  "multilingual",
        "src_lang_map": "m2m100",
    },
    # ── ru → en ──────────────────────────────────────────────────────────────
    "opus_mt_tc_big_ru_en": {
        "repo":        "Helsinki-NLP/opus-mt-tc-big-zle-en",
        "ct2_repo":    "Helsinki-NLP/opus-mt-tc-big-zle-en",
        "description": "Opus-MT Big ru→en",
        "size":        "~500 MB",
        "lang_pairs":  "ru→en",
        "src_lang_map": "none",
    },
    "helsinki_opus_ru_en": {
        "repo":        "Helsinki-NLP/opus-mt-ru-en",
        "ct2_repo":    "Helsinki-NLP/opus-mt-ru-en",
        "description": "Opus-MT Fast ru→en",
        "size":        "~300 MB",
        "lang_pairs":  "ru→en",
        "src_lang_map": "none",
    },
    # ── en → ru ──────────────────────────────────────────────────────────────
    "opus_mt_tc_big_en_ru": {
        "repo":        "Helsinki-NLP/opus-mt-tc-big-en-zle",
        "ct2_repo":    "Helsinki-NLP/opus-mt-tc-big-en-zle",
        "description": "Opus-MT Big en→ru",
        "size":        "~900 MB",
        "lang_pairs":  "en→ru",
        "src_lang_map": "none",
    },
    "opus_mt_en_ru": {
        "repo":        "Helsinki-NLP/opus-mt-en-ru",
        "ct2_repo":    "Helsinki-NLP/opus-mt-en-ru",
        "description": "Opus-MT Fast en→ru",
        "size":        "~300 MB",
        "lang_pairs":  "en→ru",
        "src_lang_map": "none",
    },
}


def get_models_dir() -> str:
    try:
        import folder_paths
        if hasattr(folder_paths, "models_dir") and folder_paths.models_dir:
            models_dir = os.path.join(folder_paths.models_dir, "prompt_translation")
            os.makedirs(models_dir, exist_ok=True)
            return models_dir
    except Exception:
        pass
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    models_dir = os.path.join(base_dir, "models", "prompt_translation")
    os.makedirs(models_dir, exist_ok=True)
    return models_dir


def scan_custom_models():
    """Scans the models directory for any custom folders and adds them to MODEL_REPOS."""
    models_dir = get_models_dir()
    if not os.path.exists(models_dir):
        return
    for folder_name in os.listdir(models_dir):
        if folder_name not in MODEL_REPOS and os.path.isdir(os.path.join(models_dir, folder_name)):
            MODEL_REPOS[folder_name] = {
                "repo": "local",
                "ct2_repo": "local",
                "description": f"Custom: {folder_name}",
                "size": "Local",
                "lang_pairs": "custom",
                "src_lang_map": "none",
            }


# Run scan once at startup
scan_custom_models()


def check_model_exists(model_key: str) -> bool:
    if model_key not in MODEL_REPOS:
        return False
    target_dir = os.path.join(get_models_dir(), model_key)
    if not os.path.exists(target_dir):
        return False
    valid_files = [
        "config.json", "model.bin", "pytorch_model.bin", "model.safetensors",
        "spm.model", "source.spm", "sentencepiece.bpe.model", "tokenizer.json", "shared_vocabulary.txt"
    ]
    try:
        files = os.listdir(target_dir)
        return any(f in files for f in valid_files)
    except Exception:
        return False


def get_all_model_status() -> Dict[str, Dict]:
    """Returns download and memory load status for all known models."""
    from py.translation_engine import get_all_models_load_status
    scan_custom_models()
    load_statuses = get_all_models_load_status()
    result = {}
    for key, info in MODEL_REPOS.items():
        ls = load_statuses.get(key, {})
        downloaded = check_model_exists(key)
        result[key] = {
            "key":         key,
            "description": info["description"],
            "size":        info["size"],
            "lang_pairs":  info["lang_pairs"],
            "downloaded":  downloaded,
            "status":      ls.get("status", "loaded" if ls.get("is_loaded") else ("downloaded" if downloaded else "not_downloaded")),
            "is_loaded":   ls.get("is_loaded", False),
            "error":       ls.get("error", None),
        }
    return result


def repair_model_async(
    model_key: str,
    packages: Optional[list] = None,
    progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
) -> bool:
    import sys
    import subprocess

    def _notify(status: str, progress: float, message: str):
        if progress_callback:
            progress_callback({
                "model_key": model_key,
                "status": status,
                "progress": progress,
                "message": message
            })

    def _worker():
        if packages:
            _notify("downloading", 20.0, f"Installing required packages: {', '.join(packages)}...")
            try:
                cmd = [sys.executable, "-m", "pip", "install"] + packages
                subprocess.check_call(cmd)
                _notify("downloading", 70.0, "Package installation complete! Attempting model reload...")
            except Exception as e:
                _notify("error", 0.0, f"Package installation failed: {e}")
                return

        # Next, attempt reload & diagnose
        from py.translation_engine import reload_and_diagnose_model
        _notify("downloading", 85.0, "Reloading model into memory...")
        res = reload_and_diagnose_model(model_key)
        if res.get("status") == "loaded":
            _notify("completed", 100.0, f"Model '{model_key}' successfully loaded!")
        else:
            _notify("error", 0.0, res.get("message", "Model repair failed."))

    thread = threading.Thread(target=_worker, daemon=True)
    thread.start()
    return True


import tqdm

class DownloadProgressTqdm(tqdm.tqdm):
    """Custom tqdm progress bar that broadcasts real-time progress to console and UI."""
    _current_model_key: str = ""
    _current_repo: str = ""
    _current_callback: Optional[Callable[[Dict[str, Any]], None]] = None
    _last_pct: float = -1.0
    _active_bars = {}
    _lock = threading.Lock()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        with self._lock:
            self._active_bars[id(self)] = self

    def update(self, n=1):
        super().update(n)
        with self._lock:
            total_bytes = sum(b.total for b in self._active_bars.values() if b.total and b.total > 1024 * 1024)
            current_bytes = sum(b.n for b in self._active_bars.values() if b.total and b.total > 1024 * 1024)

            if total_bytes > 0:
                pct = round((current_bytes / total_bytes) * 100.0, 1)
            else:
                pct = 0.0

            if abs(pct - DownloadProgressTqdm._last_pct) >= 1.0 or pct >= 100.0:
                DownloadProgressTqdm._last_pct = pct
                key = DownloadProgressTqdm._current_model_key
                repo = DownloadProgressTqdm._current_repo
                cb = DownloadProgressTqdm._current_callback

                desc = self.desc or "Downloading"
                mb_curr = round(current_bytes / (1024 * 1024), 1)
                mb_total = round(total_bytes / (1024 * 1024), 1)
                
                msg = f"[{repo}] {desc} | Total: {pct}% ({mb_curr} MB / {mb_total} MB)"
                logger.info(f"[TrixPromptAIO] {msg}")

                if cb:
                    cb({
                        "model_key": key,
                        "status": "downloading",
                        "progress": pct,
                        "message": f"Total: {pct}% ({mb_curr} MB / {mb_total} MB)"
                    })

    def close(self):
        super().close()
        # Deliberately NOT removing from _active_bars so finished files continue to count towards the total



def download_model_async(
    model_key: str,
    progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
) -> bool:
    if model_key not in MODEL_REPOS:
        logger.error(f"Unknown model key: {model_key}")
        if progress_callback:
            progress_callback({"model_key": model_key, "status": "error", "progress": 0,
                               "message": f"Unknown model: {model_key}"})
        return False

    configure_hf_mirror()

    try:
        from huggingface_hub import snapshot_download
    except ImportError:
        if progress_callback:
            progress_callback({"model_key": model_key, "status": "error", "progress": 0,
                               "message": "huggingface_hub not installed"})
        return False

    info = MODEL_REPOS[model_key]
    target_dir = os.path.join(get_models_dir(), model_key)
    os.makedirs(target_dir, exist_ok=True)

    def _notify(status: str, progress: float, message: str):
        if progress_callback:
            progress_callback({"model_key": model_key, "status": status,
                               "progress": progress, "message": message})

    def _get_repo_file_manifest(repo_id: str):
        """Query HF API for the list of files and their expected sizes."""
        import urllib.request, json
        from fnmatch import fnmatch

        endpoint = os.environ.get("HF_ENDPOINT", "https://huggingface.co")
        tree_url = f"{endpoint}/api/models/{repo_id}/tree/main?recursive=true"
        req = urllib.request.Request(tree_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=30.0) as resp:
            data = json.loads(resp.read().decode('utf-8'))

        files = [d for d in data if d.get('type') == 'file']
        ignore_patterns = ["*.msgpack", "*.h5", "flax_model*", "tf_model*", "rust_model*"]

        file_paths = [f['path'] for f in files]
        if "pytorch_model.bin" in file_paths and "model.safetensors" in file_paths:
            ignore_patterns.append("*.safetensors")

        valid_files = []
        for f in files:
            if not any(fnmatch(f['path'], p) for p in ignore_patterns):
                valid_files.append(f)
        return valid_files, endpoint

    def _validate_download(repo_id: str) -> bool:
        """Check that all downloaded files match the expected sizes from the API.
        Deletes any truncated/corrupt files so they can be re-downloaded."""
        try:
            valid_files, _ = _get_repo_file_manifest(repo_id)
            all_ok = True
            for f in valid_files:
                path = f['path']
                expected_size = f.get('size', 0)
                local_path = os.path.join(target_dir, path)

                if not os.path.exists(local_path):
                    logger.warning(f"[TrixPromptAIO] Validation: missing file {path}")
                    all_ok = False
                    continue

                actual_size = os.path.getsize(local_path)
                if expected_size > 0 and actual_size != expected_size:
                    logger.warning(
                        f"[TrixPromptAIO] Validation: {path} is truncated "
                        f"({actual_size:,} bytes vs expected {expected_size:,} bytes). Deleting."
                    )
                    try:
                        os.remove(local_path)
                    except OSError:
                        pass
                    all_ok = False

            return all_ok
        except Exception as e:
            logger.warning(f"[TrixPromptAIO] Validation check failed (network?): {e}")
            # If we can't validate, assume it's fine and let the model loader catch errors
            return True

    def _raw_http_download(repo_id: str, label: str) -> bool:
        try:
            logger.info(f"[TrixPromptAIO] Falling back to direct HTTP download for {repo_id}")
            _notify("downloading", 5.0, f"Direct download {label}…")

            valid_files, endpoint = _get_repo_file_manifest(repo_id)

            if not valid_files:
                logger.error(f"[TrixPromptAIO] No valid files found to download for {repo_id}")
                return False

            with DownloadProgressTqdm._lock:
                DownloadProgressTqdm._active_bars.clear()
            DownloadProgressTqdm._current_model_key = model_key
            DownloadProgressTqdm._current_repo = repo_id
            DownloadProgressTqdm._current_callback = progress_callback
            DownloadProgressTqdm._last_pct = -1.0

            import urllib.request
            for f in valid_files:
                path = f['path']
                expected_size = f.get('size', 0)
                file_url = f"{endpoint}/{repo_id}/resolve/main/{path}"
                out_path = os.path.join(target_dir, path)

                os.makedirs(os.path.dirname(out_path), exist_ok=True)

                # Skip only if file exists AND size matches exactly
                if os.path.exists(out_path):
                    actual_size = os.path.getsize(out_path)
                    if expected_size > 0 and actual_size == expected_size:
                        logger.info(f"[TrixPromptAIO] Skipping {path} (already complete, {actual_size:,} bytes)")
                        continue
                    else:
                        logger.info(
                            f"[TrixPromptAIO] Re-downloading {path} "
                            f"(local {actual_size:,} vs expected {expected_size:,} bytes)"
                        )
                        try:
                            os.remove(out_path)
                        except OSError:
                            pass

                req = urllib.request.Request(file_url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req, timeout=60.0) as resp:
                    total_size = int(resp.headers.get('content-length', expected_size))
                    with open(out_path, 'wb') as out_f:
                        with DownloadProgressTqdm(total=total_size, desc=path, unit='B', unit_scale=True) as pbar:
                            while True:
                                chunk = resp.read(8192 * 8)
                                if not chunk:
                                    break
                                out_f.write(chunk)
                                pbar.update(len(chunk))

                # Verify written size
                written_size = os.path.getsize(out_path)
                if expected_size > 0 and written_size != expected_size:
                    logger.error(
                        f"[TrixPromptAIO] {path} size mismatch after download: "
                        f"{written_size:,} vs expected {expected_size:,}"
                    )
                    return False

            _notify("completed", 100.0, f"✅ Downloaded!")
            logger.info(f"[TrixPromptAIO] ✅ Model '{model_key}' ({repo_id}) successfully downloaded via raw HTTP to '{target_dir}'!")
            return True

        except Exception as e:
            logger.error(f"[TrixPromptAIO] Raw HTTP download failed for {repo_id}: {e}")
            return False

    def _try_download(repo_id: str, label: str) -> bool:
        try:
            with DownloadProgressTqdm._lock:
                DownloadProgressTqdm._active_bars.clear()
            DownloadProgressTqdm._current_model_key = model_key
            DownloadProgressTqdm._current_repo = repo_id
            DownloadProgressTqdm._current_callback = progress_callback
            DownloadProgressTqdm._last_pct = -1.0

            logger.info(f"[TrixPromptAIO] Initiating snapshot download of '{repo_id}' to '{target_dir}'...")
            _notify("downloading", 1.0, f"Downloading {label}…")

            snapshot_download(
                repo_id=repo_id,
                local_dir=target_dir,
                local_dir_use_symlinks=False,
                resume_download=True,
                max_workers=4,
                tqdm_class=DownloadProgressTqdm,
                ignore_patterns=["*.msgpack", "*.h5", "flax_model*", "tf_model*", "rust_model*"],
            )

            # Validate file integrity — snapshot_download may "succeed"
            # with truncated files when the mirror can't verify metadata
            if not _validate_download(repo_id):
                logger.warning(f"[TrixPromptAIO] Post-download validation failed for {repo_id}. Triggering raw HTTP fallback...")
                return _raw_http_download(repo_id, label)

            _notify("completed", 100.0, f"✅ Downloaded!")
            logger.info(f"[TrixPromptAIO] ✅ Model '{model_key}' ({repo_id}) successfully downloaded to '{target_dir}'!")
            return True
        except Exception as e:
            logger.warning(f"[TrixPromptAIO] HF Hub download failed from {repo_id} ({e}). Triggering raw HTTP fallback...")
            return _raw_http_download(repo_id, label)

    def _worker():
        configure_hf_mirror()
        ct2_repo  = info.get("ct2_repo", "")
        base_repo = info["repo"]

        if ct2_repo and ct2_repo != base_repo:
            if _try_download(ct2_repo, f"{model_key} (CT2)"):
                return
            _notify("downloading", 25.0, "Trying base repo…")

        if not _try_download(base_repo, model_key):
            _notify("error", 0.0, f"❌ Download failed. Check internet connection.")

    thread = threading.Thread(target=_worker, daemon=True)
    thread.start()
    return True
