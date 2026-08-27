import os
import gc
import re
import time
import logging
import threading
import urllib.request
import urllib.parse
import json
from typing import Dict, Any, Optional, List

logger = logging.getLogger("TrixPromptAIO.Translator")

# Thread lock to prevent C++ GIL segfaults during concurrent translations
MODEL_LOCK = threading.Lock()

# In-memory translation cache
TRANSLATION_CACHE: Dict[str, str] = {}

# Active model state
LOADED_MODELS: Dict[str, Any] = {}
CURRENT_MODEL_KEY: Optional[str] = None
LAST_USAGE_TIME: float = time.time()

# NLLB language code mapping (ISO 639-1 -> NLLB flores-200 code)
NLLB_LANG_MAP = {
    "en": "eng_Latn", "ru": "rus_Cyrl", "uk": "ukr_Cyrl", "zh": "zho_Hans",
    "es": "spa_Latn", "de": "deu_Latn", "fr": "fra_Latn", "it": "ita_Latn",
    "pt": "por_Latn", "hi": "hin_Deva", "ja": "jpn_Jpan", "ko": "kor_Hang",
    "ar": "arb_Arab", "tr": "tur_Latn", "pl": "pol_Latn", "nl": "nld_Latn",
    "cs": "ces_Latn", "sv": "swe_Latn", "da": "dan_Latn", "fi": "fin_Latn",
    "no": "nob_Latn", "hu": "hun_Latn", "ro": "ron_Latn", "el": "ell_Grek",
    "he": "heb_Hebr", "th": "tha_Thai", "id": "ind_Latn", "vi": "vie_Latn",
    "ms": "msa_Latn", "bg": "bul_Cyrl", "hr": "hrv_Latn", "sk": "slk_Latn",
    "sl": "slv_Latn", "sr": "srp_Cyrl", "lt": "lit_Latn", "lv": "lvs_Latn",
    "et": "est_Latn", "fa": "pes_Arab", "ur": "urd_Arab", "bn": "ben_Beng",
    "ta": "tam_Taml", "te": "tel_Telu", "mr": "mar_Deva", "gu": "guj_Gujr",
    "kn": "kan_Knda", "ml": "mal_Mlym", "pa": "pan_Guru", "az": "azj_Latn",
    "ka": "kat_Geor", "hy": "hye_Armn", "eu": "eus_Latn", "gl": "glg_Latn",
    "af": "afr_Latn", "sq": "als_Latn", "am": "amh_Ethi", "be": "bel_Cyrl",
    "bs": "bos_Latn", "ca": "cat_Latn", "ceb": "ceb_Latn", "ha": "hau_Latn",
    "is": "isl_Latn", "ig": "ibo_Latn", "ga": "gle_Latn", "jw": "jav_Latn",
    "kk": "kaz_Cyrl", "km": "khm_Khmr", "ku": "kmr_Latn", "ky": "kir_Cyrl",
    "lo": "lao_Laoo", "la": "lat_Latn", "lb": "ltz_Latn", "mk": "mkd_Cyrl",
    "mg": "plt_Latn", "mn": "khk_Cyrl", "my": "mya_Mymr", "ne": "npi_Deva",
    "ps": "pbt_Arab", "si": "sin_Sinh", "so": "som_Latn", "su": "sun_Latn",
    "sw": "swh_Latn", "tg": "tgk_Cyrl", "tt": "tat_Cyrl", "uz": "uzn_Latn",
    "cy": "cym_Latn", "xh": "xho_Latn", "yi": "ydd_Hebr", "yo": "yor_Latn", "zu": "zul_Latn",
}

# M2M-100 language code mapping
M2M_LANG_MAP = {
    "en": "en", "ru": "ru", "uk": "uk", "zh": "zh", "es": "es", "de": "de",
    "fr": "fr", "it": "it", "pt": "pt", "hi": "hi", "ja": "ja", "ko": "ko",
    "ar": "ar", "tr": "tr", "pl": "pl", "nl": "nl", "cs": "cs", "sv": "sv",
    "da": "da", "fi": "fi", "no": "no", "hu": "hu", "ro": "ro", "el": "el",
    "he": "he", "th": "th", "id": "id", "vi": "vi", "ms": "ms", "bg": "bg",
}


def detect_language(text: str) -> str:
    """Detects text source language using langdetect or script character analysis."""
    if not text or not text.strip():
        return "en"

    # Try official langdetect if available
    try:
        from langdetect import detect
        lang = detect(text)
        if lang:
            return lang
    except Exception:
        pass

    # Script character distribution fallback
    cyrillic_chars = len(re.findall(r'[Ѐ-ӿ]', text))
    han_chars = len(re.findall(r'[一-鿿]', text))
    devanagari_chars = len(re.findall(r'[ऀ-ॿ]', text))
    japanese_chars = len(re.findall(r'[぀-ヿ]', text))
    korean_chars = len(re.findall(r'[가-힯]', text))
    arabic_chars = len(re.findall(r'[؀-ۿ]', text))

    total_len = max(1, len(text))

    if cyrillic_chars / total_len > 0.15:
        if re.search(r'[іїєґІЇЄҐ]', text):
            return "uk"
        return "ru"

    if han_chars / total_len > 0.15:
        return "zh"

    if devanagari_chars / total_len > 0.15:
        return "hi"

    if japanese_chars / total_len > 0.1:
        return "ja"

    if korean_chars / total_len > 0.1:
        return "ko"

    if arabic_chars / total_len > 0.15:
        return "ar"

    return "en"


MODEL_STATUSES: Dict[str, Dict[str, Any]] = {}

def get_model_status(model_key: str) -> Dict[str, Any]:
    global LOADED_MODELS, MODEL_STATUSES
    if model_key in LOADED_MODELS:
        return {
            "status": "loaded",
            "error": None,
            "is_loaded": True
        }
    elif model_key in MODEL_STATUSES:
        return {
            "status": MODEL_STATUSES[model_key].get("status", "not_loaded"),
            "error": MODEL_STATUSES[model_key].get("error", None),
            "is_loaded": False
        }
    else:
        return {"status": "not_loaded", "error": None, "is_loaded": False}

def get_all_models_load_status() -> Dict[str, Dict[str, Any]]:
    from .model_downloader import MODEL_REPOS, check_model_exists
    result = {}
    for key in MODEL_REPOS:
        st = get_model_status(key)
        downloaded = check_model_exists(key)
        result[key] = {
            "downloaded": downloaded,
            "status": st["status"] if downloaded else "not_downloaded",
            "error": st["error"],
            "is_loaded": st["is_loaded"]
        }
    return result

def _load_model_tokenizer(model_dir: str, lang_map_type: str):
    """Robust tokenizer loader that handles SentencePiece / fast-tokenizer mismatch gracefully."""
    from transformers import AutoTokenizer
    try:
        return AutoTokenizer.from_pretrained(model_dir)
    except Exception as e:
        logger.warning(f"Default AutoTokenizer.from_pretrained failed for '{model_dir}': {e}. Attempting fallback...")
        if lang_map_type == "m2m100":
            try:
                from transformers import M2M100Tokenizer
                return M2M100Tokenizer.from_pretrained(model_dir)
            except Exception:
                pass
        elif lang_map_type == "nllb":
            try:
                from transformers import NllbTokenizer
                return NllbTokenizer.from_pretrained(model_dir)
            except Exception:
                pass
        return AutoTokenizer.from_pretrained(model_dir, use_fast=False)

def reload_and_diagnose_model(model_key: str) -> Dict[str, Any]:
    from .model_downloader import get_models_dir, check_model_exists, MODEL_REPOS

    global MODEL_STATUSES, CURRENT_MODEL_KEY, LOADED_MODELS

    MODEL_STATUSES[model_key] = {"status": "loading", "error": None}

    if not check_model_exists(model_key):
        err_msg = f"Model '{model_key}' files not found locally."
        MODEL_STATUSES[model_key] = {"status": "error", "error": err_msg}
        return {"status": "error", "error": err_msg, "message": err_msg}

    model_dir = os.path.join(get_models_dir(), model_key)
    model_info = MODEL_REPOS.get(model_key, {})
    lang_map_type = model_info.get("src_lang_map", "none")

    if not MODEL_LOCK.acquire(timeout=30):
        err_msg = "Model lock timeout — another operation in progress"
        MODEL_STATUSES[model_key] = {"status": "error", "error": err_msg}
        return {"status": "error", "error": err_msg, "message": err_msg}
    try:
        if CURRENT_MODEL_KEY and CURRENT_MODEL_KEY != model_key:
            LOADED_MODELS.clear()
            CURRENT_MODEL_KEY = None
            gc.collect()

        try:
            has_ct2 = os.path.exists(os.path.join(model_dir, "model.bin"))

            if has_ct2:
                import ctranslate2
                tokenizer = _load_model_tokenizer(model_dir, lang_map_type)
                translator = ctranslate2.Translator(model_dir, device="cpu", compute_type="int8", inter_threads=2)
                LOADED_MODELS[model_key] = {"type": "ct2", "translator": translator, "tokenizer": tokenizer}
            else:
                from transformers import AutoModelForSeq2SeqLM
                try:
                    from transformers import M2M100ForConditionalGeneration
                except ImportError:
                    M2M100ForConditionalGeneration = None

                tokenizer = _load_model_tokenizer(model_dir, lang_map_type)
                if lang_map_type == "m2m100" and M2M100ForConditionalGeneration:
                    model = M2M100ForConditionalGeneration.from_pretrained(model_dir)
                else:
                    model = AutoModelForSeq2SeqLM.from_pretrained(model_dir)

                LOADED_MODELS[model_key] = {"type": "transformers", "model": model, "tokenizer": tokenizer}

            CURRENT_MODEL_KEY = model_key
            MODEL_STATUSES[model_key] = {"status": "loaded", "error": None}
            logger.info(f"Successfully loaded model '{model_key}' into memory.")
            return {"status": "loaded", "message": f"Successfully loaded '{model_key}' into memory!"}

        except MemoryError:
            logger.error(f"Out of memory loading model '{model_key}' — unloading and falling back")
            LOADED_MODELS.clear()
            CURRENT_MODEL_KEY = None
            gc.collect()
            MODEL_STATUSES[model_key] = {"status": "error", "error": "Out of memory"}
            return {"status": "error", "error": "Out of memory", "message": "Not enough RAM to load this model"}

        except Exception as e:
            err_str = str(e)
            logger.error(f"Reload failed for model '{model_key}': {err_str}")
            MODEL_STATUSES[model_key] = {"status": "error", "error": err_str}

            missing_packages = []
            if "No module named" in err_str or "ImportError" in err_str:
                match = re.search(r"No module named ['\"]([^'\"]+)['\"]", err_str)
                if match:
                    missing_packages.append(match.group(1))

            if missing_packages:
                return {
                    "status": "missing_deps",
                    "error": err_str,
                    "missing_packages": missing_packages,
                    "message": f"Missing required Python libraries: {', '.join(missing_packages)}"
                }

            return {
                "status": "error",
                "error": err_str,
                "message": f"Model load error: {err_str}"
            }
    finally:
        MODEL_LOCK.release()


def unload_all_models():
    """Immediately unloads all offline models from RAM and VRAM."""
    global LOADED_MODELS, CURRENT_MODEL_KEY, MODEL_STATUSES
    with MODEL_LOCK:
        if LOADED_MODELS or CURRENT_MODEL_KEY:
            logger.info(f"Unloading offline models from memory ({list(LOADED_MODELS.keys())})")
            LOADED_MODELS.clear()
            MODEL_STATUSES.clear()
            CURRENT_MODEL_KEY = None
            gc.collect()
            try:
                import torch
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
            except Exception:
                pass


def _chunk_prompt_text(text: str, max_chars: int = 350) -> List[str]:
    """Splits long prompt text into smaller chunks by lines, commas, or spaces to avoid context overflow."""
    text = text.strip()
    if not text or len(text) <= max_chars:
        return [text] if text else []

    lines = text.split("\n")
    chunks = []
    current = ""

    for line in lines:
        if len(current) + len(line) + 1 <= max_chars:
            current = (current + "\n" + line).strip()
        else:
            if current:
                chunks.append(current)
            if len(line) <= max_chars:
                current = line
            else:
                sub_parts = re.split(r"(?<=[,.!?])\s+", line)
                sub = ""
                for part in sub_parts:
                    if len(sub) + len(part) + 1 <= max_chars:
                        sub = (sub + " " + part).strip()
                    else:
                        if sub:
                            chunks.append(sub)
                        if len(part) <= max_chars:
                            sub = part
                        else:
                            words = part.split(" ")
                            w_sub = ""
                            for w in words:
                                if len(w_sub) + len(w) + 1 <= max_chars:
                                    w_sub = (w_sub + " " + w).strip()
                                else:
                                    if w_sub:
                                        chunks.append(w_sub)
                                    w_sub = w
                            if w_sub:
                                sub = w_sub
                if sub:
                    current = sub
    if current:
        chunks.append(current)
    return [c for c in chunks if c.strip()]


class TranslationRouter:
    """Routes translation requests to online or offline engines with full thread safety."""

    @staticmethod
    def translate(
        text: str,
        engine: str = "online_google",
        src_lang: str = "auto",
        tgt_lang: str = "en",
        offline_model: Optional[str] = None
    ) -> str:
        if not text or not text.strip():
            return ""

        return TranslationRouter._translate_segmented(text, engine, src_lang, tgt_lang, offline_model)

    @staticmethod
    def _translate_segmented(
        text: str,
        engine: str = "online_google",
        src_lang: str = "auto",
        tgt_lang: str = "en",
        offline_model: Optional[str] = None
    ) -> str:
        parts = re.split(r'(\n|,|;)', text)
        result_parts = []

        for part in parts:
            if part in ["\n", ",", ";"]:
                result_parts.append(part)
                continue

            stripped = part.strip()
            if not stripped:
                result_parts.append(part)
                continue

            detected = detect_language(stripped)

            should_translate = False
            if src_lang == "auto":
                # In Auto mode: translate any segment that is NOT already in tgt_lang
                should_translate = (detected != tgt_lang)
            else:
                # In specific source mode: translate ONLY segments matching src_lang!
                should_translate = (detected == src_lang)

            if not should_translate:
                result_parts.append(part)
            else:
                effective_src = detected if src_lang == "auto" else src_lang
                translated = TranslationRouter._translate_single(
                    stripped, engine, effective_src, tgt_lang, offline_model
                )
                if not translated:
                    translated = stripped

                leading = part[:len(part) - len(part.lstrip())]
                trailing = part[len(part.rstrip()):]
                result_parts.append(leading + translated + trailing)

        return "".join(result_parts)

    @staticmethod
    def _translate_single(
        text: str,
        engine: str = "online_google",
        src_lang: str = "auto",
        tgt_lang: str = "en",
        offline_model: Optional[str] = None
    ) -> str:
        if not text or not text.strip():
            return ""

        effective_src = src_lang if src_lang != "auto" else detect_language(text)
        if effective_src == tgt_lang:
            return text

        cache_key = f"{engine}:{offline_model}:{effective_src}:{tgt_lang}:{text}"
        if cache_key in TRANSLATION_CACHE:
            return TRANSLATION_CACHE[cache_key]

        resolved_model = offline_model or "helsinki_opus_ru_en"

        # Protect prompt weights (e.g. :1.2, :0.8) from translation distortion
        weights = []
        def _save_weight(m):
            weights.append(m.group(0))
            return f"__WEIGHT_{len(weights)-1}__"

        protected_text = re.sub(r':\s*\d+(?:\.\d+)?', _save_weight, text)

        translated = ""
        try:
            if engine == "online_google":
                translated = TranslationRouter._translate_google(protected_text, effective_src, tgt_lang)
            elif engine == "online_bing":
                translated = TranslationRouter._translate_bing(protected_text, effective_src, tgt_lang)
            elif engine == "offline":
                translated = TranslationRouter._translate_offline(protected_text, resolved_model, effective_src, tgt_lang)
            else:
                translated = TranslationRouter._translate_google(protected_text, effective_src, tgt_lang)
        except Exception as e:
            logger.warning(f"Translation engine notice ({engine}): {e}")
            if engine != "offline":
                try:
                    translated = TranslationRouter._translate_google(protected_text, effective_src, tgt_lang)
                except Exception:
                    translated = text
            else:
                translated = text

        if translated:
            def _restore_weight(m):
                idx = int(m.group(1))
                return weights[idx] if idx < len(weights) else m.group(0)

            translated = re.sub(r'__WEIGHT_(\d+)__', _restore_weight, translated)
            TRANSLATION_CACHE[cache_key] = translated

        return translated or text

    _BING_SESSION_CACHE = {
        "ig": None,
        "iid": "translator.5023",
        "key": None,
        "token": None,
        "expires": 0
    }

    @classmethod
    def _get_bing_session(cls) -> Dict[str, Any]:
        now = time.time()
        if cls._BING_SESSION_CACHE.get("token") and now < cls._BING_SESSION_CACHE.get("expires", 0):
            return cls._BING_SESSION_CACHE

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Referer": "https://www.bing.com/translator"
        }
        try:
            req = urllib.request.Request("https://www.bing.com/translator", headers=headers)
            with urllib.request.urlopen(req, timeout=5) as r:
                html = r.read().decode("utf-8")
                ig_m = re.search(r'IG:"([A-Za-z0-9]+)"', html)
                iid_m = re.search(r'data-iid="([^"]+)"', html)
                params_m = re.search(r'params_AbusePreventionHelper\s*=\s*(\[[^\]]+\]);', html)

                ig = ig_m.group(1) if ig_m else ""
                iid = iid_m.group(1) if iid_m else "translator.5023"
                key, token = None, None
                if params_m:
                    raw_params = json.loads(params_m.group(1))
                    key, token = raw_params[0], raw_params[1]

                cls._BING_SESSION_CACHE = {
                    "ig": ig,
                    "iid": iid,
                    "key": key,
                    "token": token,
                    "expires": now + 1800  # valid for 30 minutes
                }
        except Exception:
            pass

        return cls._BING_SESSION_CACHE

    @classmethod
    def _translate_bing(cls, text: str, src_lang: str, tgt_lang: str) -> str:
        if not text or not text.strip():
            return text

        src = "auto-detect" if src_lang in ("auto", None, "") else src_lang
        tgt = tgt_lang or "en"

        try:
            sess = cls._get_bing_session()
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                "Referer": "https://www.bing.com/translator",
                "Content-Type": "application/x-www-form-urlencoded"
            }
            post_dict = {
                "fromLang": src,
                "text": text,
                "to": tgt,
            }
            if sess.get("key") and sess.get("token"):
                post_dict["key"] = sess["key"]
                post_dict["token"] = sess["token"]

            post_data = urllib.parse.urlencode(post_dict).encode("utf-8")
            t_url = f"https://www.bing.com/ttranslatev3?isVertical=1&IG={sess.get('ig', '')}&IID={sess.get('iid', 'translator.5023')}"
            t_req = urllib.request.Request(t_url, data=post_data, headers=headers)
            with urllib.request.urlopen(t_req, timeout=6) as t_resp:
                content = t_resp.read().decode("utf-8")
                res_json = json.loads(content)
                if isinstance(res_json, list) and len(res_json) > 0 and "translations" in res_json[0]:
                    return res_json[0]["translations"][0]["text"]
        except Exception:
            pass

        # Fallback to Google if Bing fails
        return cls._translate_google(text, src_lang, tgt_lang)

    @classmethod
    def _translate_google(cls, text: str, src_lang: str, tgt_lang: str) -> str:
        if not text or not text.strip():
            return text

        src = "auto" if src_lang in ("auto", None, "") else src_lang
        tgt = tgt_lang or "en"

        # Tier 1: Google Chrome-Extension translation API (fast, unthrottled, works across VPNs)
        try:
            url = f"https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl={src}&tl={tgt}&q={urllib.parse.quote(text)}"
            req = urllib.request.Request(url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            })
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                if isinstance(data, list):
                    res = data[0]
                    if isinstance(res, list) and len(res) > 0 and isinstance(res[0], str):
                        return res[0]
                    elif isinstance(res, str):
                        return res
                elif isinstance(data, str):
                    return data
        except Exception:
            pass

        # Tier 2: Google Android App Client API
        try:
            url = f"https://translate.google.com/translate_a/single?client=at&sl={src}&tl={tgt}&dt=t&q={urllib.parse.quote(text)}"
            req = urllib.request.Request(url, headers={
                "User-Agent": "GoogleTranslate/6.28.0.05.421483610 (Linux; U; Android 12; Pixel 6)"
            })
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                if data and isinstance(data, list) and isinstance(data[0], list):
                    res = "".join(s[0] for s in data[0] if s and s[0])
                    if res:
                        return res
        except Exception:
            pass

        # Tier 3: MyMemory Translation API
        try:
            sl_code = "ru" if src == "auto" else src
            url = f"https://api.mymemory.translated.net/get?q={urllib.parse.quote(text)}&langpair={sl_code}|{tgt}"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
            with urllib.request.urlopen(req, timeout=5) as resp:
                d = json.loads(resp.read().decode("utf-8"))
                res = d.get("responseData", {}).get("translatedText", "")
                if res and not res.startswith("MYMEMORY WARNING"):
                    return res
        except Exception:
            pass

        # Tier 4: Google gtx Web API
        try:
            url = f"https://translate.googleapis.com/translate_a/single?client=gtx&sl={src}&tl={tgt}&dt=t&q={urllib.parse.quote(text)}"
            req = urllib.request.Request(url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            })
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                if data and isinstance(data, list) and isinstance(data[0], list):
                    res = "".join(s[0] for s in data[0] if s and s[0])
                    if res:
                        return res
        except Exception:
            pass

        return text

    @staticmethod
    def _translate_offline(text: str, model_key: str, src_lang: str, tgt_lang: str) -> str:
        from py.model_downloader import get_models_dir, check_model_exists, MODEL_REPOS

        if not check_model_exists(model_key):
            logger.warning(f"Offline model '{model_key}' not found locally.")
            return text

        model_dir = os.path.join(get_models_dir(), model_key)
        model_info = MODEL_REPOS.get(model_key, {})
        lang_map_type = model_info.get("src_lang_map", "none")

        global CURRENT_MODEL_KEY, LOADED_MODELS

        if not MODEL_LOCK.acquire(timeout=15):
            logger.warning(f"MODEL_LOCK timeout after 15s — falling back to Google translate")
            try:
                return TranslationRouter._translate_google(text, src_lang, tgt_lang)
            except Exception:
                return text
        try:
            # If switching to a different offline model, immediately unload previous model
            if CURRENT_MODEL_KEY and CURRENT_MODEL_KEY != model_key:
                logger.info(f"Model switch detected: unloading '{CURRENT_MODEL_KEY}' -> loading '{model_key}'")
                LOADED_MODELS.clear()
                CURRENT_MODEL_KEY = None
                gc.collect()
                try:
                    import torch
                    if torch.cuda.is_available():
                        torch.cuda.empty_cache()
                except Exception:
                    pass

            try:
                has_ct2 = os.path.exists(os.path.join(model_dir, "model.bin"))

                if model_key not in LOADED_MODELS:
                    logger.info(f"Loading offline model into RAM ({'CTranslate2' if has_ct2 else 'Transformers'}): {model_key}")

                    if has_ct2:
                        import ctranslate2
                        tokenizer = _load_model_tokenizer(model_dir, lang_map_type)
                        translator = ctranslate2.Translator(model_dir, device="cpu", compute_type="int8", inter_threads=2)
                        LOADED_MODELS[model_key] = {"type": "ct2", "translator": translator, "tokenizer": tokenizer}
                    else:
                        from transformers import AutoModelForSeq2SeqLM
                        try:
                            from transformers import M2M100ForConditionalGeneration
                        except ImportError:
                            M2M100ForConditionalGeneration = None

                        tokenizer = _load_model_tokenizer(model_dir, lang_map_type)
                        if lang_map_type == "m2m100" and M2M100ForConditionalGeneration:
                            model = M2M100ForConditionalGeneration.from_pretrained(model_dir)
                        else:
                            model = AutoModelForSeq2SeqLM.from_pretrained(model_dir)

                        LOADED_MODELS[model_key] = {"type": "transformers", "model": model, "tokenizer": tokenizer}

                    CURRENT_MODEL_KEY = model_key

                LAST_USAGE_TIME = time.time()
                mod = LOADED_MODELS[model_key]
                mod_type = mod.get("type", "ct2")
                tokenizer = mod["tokenizer"]

                # Break long prompts into safe chunks to avoid model context overflow
                chunks = _chunk_prompt_text(text, max_chars=350)
                if not chunks:
                    return text

                translated_chunks = []

                for chunk in chunks:
                    # ── 1. CTranslate2 Engine ──────────────────────────────────────────
                    if mod_type == "ct2":
                        translator = mod["translator"]
                        if lang_map_type == "nllb":
                            nllb_src = NLLB_LANG_MAP.get(src_lang, "rus_Cyrl")
                            nllb_tgt = NLLB_LANG_MAP.get(tgt_lang, "eng_Latn")
                            tokenizer.src_lang = nllb_src
                            encoded = tokenizer(chunk, return_tensors="pt", padding=True, truncation=True, max_length=512)
                            source_tokens = tokenizer.convert_ids_to_tokens(encoded["input_ids"][0].tolist())
                            target_prefix = [nllb_tgt]
                            results = translator.translate_batch(
                                [source_tokens],
                                target_prefix=[target_prefix],
                                max_decoding_length=256,
                                beam_size=4,
                            )
                            target_tokens = results[0].hypotheses[0][1:]
                            t_out = tokenizer.decode(tokenizer.convert_tokens_to_ids(target_tokens), skip_special_tokens=True)
                            translated_chunks.append(t_out)
                        elif lang_map_type == "m2m100":
                            m2m_src = M2M_LANG_MAP.get(src_lang, "ru")
                            m2m_tgt = M2M_LANG_MAP.get(tgt_lang, "en")
                            tokenizer.src_lang = m2m_src
                            encoded = tokenizer(chunk, return_tensors="pt", padding=True, truncation=True, max_length=512)
                            source_tokens = tokenizer.convert_ids_to_tokens(encoded["input_ids"][0].tolist())
                            tgt_lang_token = f"__{m2m_tgt}__" if not hasattr(tokenizer, "get_lang_token") else tokenizer.get_lang_token(m2m_tgt)
                            results = translator.translate_batch(
                                [source_tokens],
                                target_prefix=[[tgt_lang_token]],
                                max_decoding_length=256,
                                beam_size=4,
                            )
                            target_tokens = results[0].hypotheses[0][1:]
                            t_out = tokenizer.decode(tokenizer.convert_tokens_to_ids(target_tokens), skip_special_tokens=True)
                            translated_chunks.append(t_out)
                        else:
                            encoded_ids = tokenizer.encode(chunk, truncation=True, max_length=512)
                            source_tokens = tokenizer.convert_ids_to_tokens(encoded_ids)
                            results = translator.translate_batch(
                                [source_tokens],
                                max_decoding_length=256,
                                beam_size=4,
                            )
                            target_tokens = results[0].hypotheses[0]
                            t_out = tokenizer.decode(tokenizer.convert_tokens_to_ids(target_tokens), skip_special_tokens=True)
                            translated_chunks.append(t_out)

                    # ── 2. Transformers Engine (PyTorch native) ────────────────────────
                    else:
                        model = mod["model"]
                        device = next(model.parameters()).device

                        if lang_map_type == "nllb":
                            nllb_src = NLLB_LANG_MAP.get(src_lang, "rus_Cyrl")
                            nllb_tgt = NLLB_LANG_MAP.get(tgt_lang, "eng_Latn")
                            tokenizer.src_lang = nllb_src
                            inputs = tokenizer(chunk, return_tensors="pt", truncation=True, max_length=512).to(device)
                            tgt_lang_id = tokenizer.convert_tokens_to_ids(nllb_tgt)
                            outputs = model.generate(**inputs, forced_bos_token_id=tgt_lang_id, max_length=256)
                            t_out = tokenizer.decode(outputs[0], skip_special_tokens=True)
                            translated_chunks.append(t_out)

                        elif lang_map_type == "m2m100":
                            m2m_src = M2M_LANG_MAP.get(src_lang, "ru")
                            m2m_tgt = M2M_LANG_MAP.get(tgt_lang, "en")
                            tokenizer.src_lang = m2m_src
                            inputs = tokenizer(chunk, return_tensors="pt", truncation=True, max_length=512).to(device)
                            tgt_lang_id = tokenizer.get_lang_id(m2m_tgt)
                            outputs = model.generate(**inputs, forced_bos_token_id=tgt_lang_id, max_length=256)
                            t_out = tokenizer.decode(outputs[0], skip_special_tokens=True)
                            translated_chunks.append(t_out)

                        else:
                            inputs = tokenizer(chunk, return_tensors="pt", truncation=True, max_length=512).to(device)
                            outputs = model.generate(**inputs, max_length=256)
                            t_out = tokenizer.decode(outputs[0], skip_special_tokens=True)
                            translated_chunks.append(t_out)

                join_delim = "\n" if "\n" in text else ", "
                return join_delim.join(translated_chunks)

            except MemoryError:
                logger.error(f"Out of memory loading model '{model_key}' — unloading and falling back")
                LOADED_MODELS.clear()
                CURRENT_MODEL_KEY = None
                gc.collect()
                MODEL_STATUSES[model_key] = {"status": "error", "error": "Out of memory"}
                return {"status": "error", "error": "Out of memory", "message": "Not enough RAM to load this model"}

            except Exception as offline_err:
                logger.error(f"Offline translation error ({model_key}): {offline_err} — falling back to Google")
                try:
                    return TranslationRouter._translate_google(text, src_lang, tgt_lang)
                except Exception:
                    return text
        finally:
            MODEL_LOCK.release()


def unload_idle_models(idle_seconds: int = 300):
    """Unloads offline translation models if idle for too long."""
    global LAST_USAGE_TIME
    if time.time() - LAST_USAGE_TIME > idle_seconds:
        unload_all_models()

def _start_idle_cleanup_daemon():
    """Background daemon that periodically checks and unloads idle translation models."""
    import threading
    def _cleanup_loop():
        while True:
            time.sleep(60)
            try:
                unload_idle_models(300)
            except Exception:
                pass
    t = threading.Thread(target=_cleanup_loop, daemon=True, name="TrixTranslationIdleCleanup")
    t.start()

_start_idle_cleanup_daemon()

# Alias for backward compatibility and test suites
Translator = TranslationRouter
