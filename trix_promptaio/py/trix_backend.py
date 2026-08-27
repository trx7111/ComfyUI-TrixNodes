import os
import re
import io
import time
import json
import base64
import glob
import math
import hashlib
import logging
import threading
from typing import Dict, List, Tuple, Any, Optional

import requests
from aiohttp import web
from PIL import Image

from server import PromptServer
from .excel_manager import ExcelStyleManager

logger = logging.getLogger("ComfyUI-TrixPromptAIO.Backend")

# ============================================================================
# 1. STYLE MANAGER MODULE
# ============================================================================

class StyleManager:
    """Manager for prompt styles, presets, categories, and favorites using Excel files."""

    INCREMENT_COUNTERS: Dict[str, int] = {}
    LAST_CHOSEN_INDEX: Dict[str, int] = {}
    LAST_GROUP_SEED: Dict[str, int] = {}
    LAST_EXPANDED_DETAILS: Dict[str, List[dict]] = {}
    NODE_INCREMENT_SEEDS: Dict[str, int] = {}
    LAST_START_SEED: Dict[str, int] = {}
    FAVORITES_SET: set = set()

    @staticmethod
    def load_styles() -> List[Dict[str, Any]]:
        styles, _ = ExcelStyleManager.load_master_data()
        return styles

    @staticmethod
    def get_categories() -> List[str]:
        return ExcelStyleManager.get_categories()

    @staticmethod
    def save_styles(styles_list: List[dict]):
        ExcelStyleManager.clear_cache()
        by_cat = {}
        all_styles, all_images = ExcelStyleManager.load_master_data()

        for s in styles_list:
            cat = ExcelStyleManager._sanitize_name(s.get("categoryKey") or s.get("category") or "custom")
            if cat not in by_cat:
                by_cat[cat] = []
            by_cat[cat].append(s)

        for cat, c_styles in by_cat.items():
            StyleManager._write_category_to_disk(cat, c_styles, all_images)

        ExcelStyleManager.clear_cache()

    @staticmethod
    def _write_category_to_disk(cat_clean: str, styles_for_cat: List[dict], all_images: Dict[str, Tuple[bytes, str]]):
        try:
            import xlsxwriter
        except ImportError:
            raise RuntimeError("The 'xlsxwriter' package is required to write style Excel files. Please install it using 'pip install xlsxwriter'.")

        styles_dir = ExcelStyleManager.get_styles_dir()
        cat_path = os.path.join(styles_dir, f"{cat_clean}.xlsx")
        tmp_path = cat_path + ".tmp"

        wb = xlsxwriter.Workbook(tmp_path)
        ws = wb.add_worksheet("Styles")

        fmt_header = wb.add_format({
            'bold': True, 'font_color': 'white', 'bg_color': '#333333',
            'align': 'center', 'valign': 'vcenter', 'border': 1
        })
        fmt_cell = wb.add_format({'valign': 'top', 'text_wrap': True})

        ws.set_column('A:A', 5)
        ws.set_column('B:B', 15)
        ws.set_column('C:C', 20)
        ws.set_column('D:D', 15)
        ws.set_column('E:E', 40)
        ws.set_column('F:F', 30)

        headers = ["ID", "Image", "Name", "Tag", "Prompt", "Negative Prompt"]
        for col_idx, h in enumerate(headers):
            ws.write(0, col_idx, h, fmt_header)
        ws.set_row(0, 24)

        for i, s in enumerate(styles_for_cat):
            row_idx = i + 1
            ws.set_row(row_idx, 68)

            ws.write(row_idx, 0, i + 1, fmt_cell)
            ws.write(row_idx, 2, s.get("name", ""), fmt_cell)
            ws.write(row_idx, 3, s.get("tag", ""), fmt_cell)
            ws.write(row_idx, 4, s.get("positive") or s.get("prompt") or "", fmt_cell)
            ws.write(row_idx, 5, s.get("negative") or s.get("negative_prompt") or "", fmt_cell)

            thumb = s.get("thumbnail")
            thumbs_to_draw = []
            if isinstance(thumb, list):
                thumbs_to_draw = [t for t in thumb if t and t in all_images]
            elif isinstance(thumb, str) and thumb in all_images:
                thumbs_to_draw = [thumb]

            if thumbs_to_draw:
                t1 = thumbs_to_draw[0]
                if t1 in all_images:
                    img_bytes, mime = all_images[t1]
                    try:
                        with Image.open(io.BytesIO(img_bytes)) as pil_img:
                            w, h = pil_img.size
                            scale = 88.0 / max(1, max(w, h))
                        ws.insert_image(row_idx, 1, t1, {'image_data': io.BytesIO(img_bytes), 'x_scale': scale, 'y_scale': scale, 'x_offset': 4, 'y_offset': 4, 'object_position': 1})
                    except Exception as e:
                        logger.error(f"Error scaling image {t1}: {e}")

        wb.close()

        try:
            if os.path.exists(cat_path):
                os.remove(cat_path)
            os.rename(tmp_path, cat_path)
            logger.info(f"Rebuilt {cat_clean}.xlsx with {len(styles_for_cat)} styles.")
        except Exception as err:
            logger.error(f"Error replacing {cat_clean}.xlsx: {err}")
        finally:
            if os.path.exists(tmp_path):
                try: os.remove(tmp_path)
                except Exception: pass

    @staticmethod
    def create_category(category_key: str) -> List[Dict[str, Any]]:
        cat_clean = ExcelStyleManager._sanitize_name(category_key)
        styles_dir = ExcelStyleManager.get_styles_dir()
        cat_path = os.path.join(styles_dir, f"{cat_clean}.xlsx")

        if not os.path.exists(cat_path):
            StyleManager._write_category_to_disk(cat_clean, [], {})
            ExcelStyleManager.clear_cache()
        return StyleManager.load_styles()

    @staticmethod
    def save_custom_style(style_data: dict) -> List[Dict[str, Any]]:
        name = str(style_data.get("name", "")).strip()
        if not name:
            name = f"custom_{int(time.time())}"

        cat_raw = style_data.get("categoryKey") or style_data.get("category") or "custom"
        cat_clean = ExcelStyleManager._sanitize_name(cat_raw)

        all_styles, all_images = ExcelStyleManager.load_master_data()

        img1_b64 = style_data.get("image1_base64")
        img2_b64 = style_data.get("image2_base64")

        def process_b64(b64_str):
            if b64_str:
                try:
                    data = b64_str.split(",", 1)[1] if "," in b64_str else b64_str
                    img_bytes = base64.b64decode(data)
                    with Image.open(io.BytesIO(img_bytes)) as img:
                        if img.mode in ("RGBA", "P", "LA"):
                            bg = Image.new("RGB", img.size, (255, 255, 255))
                            if img.mode == "P":
                                img = img.convert("RGBA")
                            if img.mode in ("RGBA", "LA"):
                                bg.paste(img, mask=img.split()[-1])
                            else:
                                bg.paste(img)
                            img = bg
                        elif img.mode != "RGB":
                            img = img.convert("RGB")
                        
                        out_buf = io.BytesIO()
                        img.save(out_buf, format="JPEG", quality=90, optimize=True)
                        final_bytes = out_buf.getvalue()
                        
                        new_key = f"{cat_clean}_{name}_{int(time.time()*1000)}.jpeg"
                        new_key = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', new_key)
                        all_images[new_key] = (final_bytes, "image/jpeg")
                        return new_key
                except Exception as e:
                    logger.error(f"Error processing base64 image: {e}")
            return None

        k1 = process_b64(img1_b64)
        k2 = process_b64(img2_b64)

        if k1 and k2:
            thumb_val = [k1, k2]
            thumb_variant = "compareSlider"
        elif k1:
            thumb_val = k1
            thumb_variant = ""
        else:
            thumb_val = style_data.get("thumbnail") or ""
            thumb_variant = style_data.get("thumbnail_variant") or ""

        tag_val = style_data.get("tag")
        if not tag_val:
            tag_val = "@" + ExcelStyleManager._slugify(name)
        elif not tag_val.startswith("@"):
            tag_val = "@" + ExcelStyleManager._slugify(tag_val)

        new_style_obj = {
            "id": name,
            "name": name,
            "tag": tag_val,
            "tags": [tag_val],
            "positive": style_data.get("positive") or style_data.get("prompt") or "",
            "negative": style_data.get("negative") or style_data.get("negative_prompt") or "",
            "thumbnail": thumb_val,
            "thumbnail_variant": thumb_variant,
            "categoryKey": cat_clean,
            "category": cat_clean,
            "favorite": bool(style_data.get("favorite", False))
        }

        existing_cat_styles = [s for s in all_styles if (s.get("categoryKey") == cat_clean or s.get("category") == cat_clean) and s.get("name") != name]
        existing_cat_styles.insert(0, new_style_obj)

        StyleManager._write_category_to_disk(cat_clean, existing_cat_styles, all_images)
        ExcelStyleManager.clear_cache()
        return StyleManager.load_styles()

    @staticmethod
    def move_styles_category(style_ids: List[str], target_category: str) -> List[Dict[str, Any]]:
        all_styles, all_images = ExcelStyleManager.load_master_data()
        target_clean = ExcelStyleManager._sanitize_name(target_category)

        target_set = set(str(sid) for sid in style_ids)
        affected_cats = {target_clean}

        moved_styles = []
        for s in all_styles:
            sid = str(s.get("id") or s.get("name"))
            if sid in target_set:
                old_cat = ExcelStyleManager._sanitize_name(s.get("categoryKey") or s.get("category") or "custom")
                affected_cats.add(old_cat)
                s["categoryKey"] = target_clean
                s["category"] = target_clean
                moved_styles.append(s)

        by_cat = {}
        for s in all_styles:
            cat = ExcelStyleManager._sanitize_name(s.get("categoryKey") or s.get("category") or "custom")
            if cat in affected_cats:
                by_cat.setdefault(cat, []).append(s)

        for cat in affected_cats:
            c_styles = by_cat.get(cat, [])
            StyleManager._write_category_to_disk(cat, c_styles, all_images)

        ExcelStyleManager.clear_cache()
        return StyleManager.load_styles()

    @staticmethod
    def delete_style(style_id: str) -> List[Dict[str, Any]]:
        all_styles, all_images = ExcelStyleManager.load_master_data()
        target_str = str(style_id)

        target_style = None
        for s in all_styles:
            if str(s.get("id") or s.get("name")) == target_str or str(s.get("name")) == target_str:
                target_style = s
                break

        if not target_style:
            return all_styles

        cat_clean = ExcelStyleManager._sanitize_name(target_style.get("categoryKey") or target_style.get("category") or "custom")
        cat_styles = [s for s in all_styles if (s.get("categoryKey") == cat_clean or s.get("category") == cat_clean) and str(s.get("id") or s.get("name")) != target_str and str(s.get("name")) != target_str]

        StyleManager._write_category_to_disk(cat_clean, cat_styles, all_images)
        ExcelStyleManager.clear_cache()
        return StyleManager.load_styles()

    @staticmethod
    def delete_category(category_key: str, delete_styles: bool = False) -> List[Dict[str, Any]]:
        cat_clean = ExcelStyleManager._sanitize_name(category_key)
        cat_path = os.path.join(ExcelStyleManager.get_styles_dir(), f"{cat_clean}.xlsx")

        if os.path.exists(cat_path):
            if delete_styles:
                os.remove(cat_path)
            else:
                all_styles = StyleManager.load_styles()
                cat_styles = [s.get("id") or s.get("name") for s in all_styles if (s.get("categoryKey") == cat_clean or s.get("category") == cat_clean) and (s.get("id") or s.get("name"))]
                if cat_styles:
                    StyleManager.move_styles_category(cat_styles, "custom")
                if os.path.exists(cat_path):
                    os.remove(cat_path)

        ExcelStyleManager.clear_cache()
        return StyleManager.load_styles()

    @staticmethod
    def reorder_styles(category_key: str, ordered_ids: List[str]) -> List[Dict[str, Any]]:
        cat_clean = ExcelStyleManager._sanitize_name(category_key)
        all_styles, all_images = ExcelStyleManager.load_master_data()
        
        cat_styles = [s for s in all_styles if s.get("categoryKey") == cat_clean or s.get("category") == cat_clean]
        if not cat_styles:
            return all_styles

        style_map = {}
        for s in cat_styles:
            search_id = s.get("id") or s.get("name")
            if search_id:
                style_map[str(search_id)] = s
            if s.get("name"):
                style_map[str(s.get("name"))] = s

        reordered_cat_styles = []
        added_ids = set()
        for s_id in ordered_ids:
            s_str = str(s_id)
            if s_str in style_map and s_str not in added_ids:
                reordered_cat_styles.append(style_map[s_str])
                added_ids.add(s_str)

        for s in cat_styles:
            s_id = str(s.get("id") or s.get("name"))
            if s_id not in added_ids:
                reordered_cat_styles.append(s)
                added_ids.add(s_id)

        StyleManager._write_category_to_disk(cat_clean, reordered_cat_styles, all_images)
        ExcelStyleManager.clear_cache()
        return StyleManager.load_styles()

    @staticmethod
    def expand_tags(text: str, seed: int = 0, group_mode: str = "increment", group_seed: int = 1, node_id: str = "default") -> str:
        if not text or ("@" not in text and "*" not in text):
            return text
        styles = StyleManager.load_styles()
        tag_map = {}
        category_map = {}

        StyleManager.LAST_EXPANDED_DETAILS[node_id] = []

        for s in styles:
            name = s.get("name", "")
            explicit_tag = s.get("tag")
            cat = s.get("categoryKey") or s.get("category") or "Custom"
            norm_cat = "*" + re.sub(r'[^a-z0-9]+', '_', cat.strip().lower()).strip('_')
            raw_cat = "*" + cat.strip().lower()
            pos = (s.get("positive") or s.get("prompt") or "").strip()
            
            if name:
                tag = "@" + re.sub(r'[^a-z0-9]+', '_', name.strip().lower()).strip('_')
                tag_map[tag.lower()] = pos
            if explicit_tag:
                t = explicit_tag.strip()
                if not t.startswith("@"):
                    t = "@" + t
                tag_map[t.lower()] = pos
            
            for c_key in set([norm_cat, raw_cat]):
                if c_key not in category_map:
                    category_map[c_key] = []
                category_map[c_key].append({"name": name, "positive": pos})

        effective_seed = max(1, int(group_seed))

        def replacer(match):
            m = match.group(0)
            if m.startswith("@"):
                return tag_map.get(m.lower(), m)
            elif m.startswith("*"):
                norm_cat = "*" + re.sub(r'[^a-z0-9]+', '_', m[1:].strip().lower()).strip('_')
                options = category_map.get(m) or category_map.get(norm_cat) or category_map.get(m.lower())
                if options:
                    key = f"{node_id}_{norm_cat}"
                    N = len(options)
                    idx = (effective_seed - 1) % N

                    StyleManager.LAST_CHOSEN_INDEX[key] = idx
                    selected_item = options[idx]

                    details = StyleManager.LAST_EXPANDED_DETAILS.setdefault(node_id, [])
                    if not any(d.get("tag") == m for d in details):
                        details.append({
                            "tag": m,
                            "name": selected_item.get("name") or "Style",
                            "index": idx,
                            "total": N
                        })

                    return selected_item["positive"]
                return m
            return m

        current_text = text
        for _ in range(3):
            next_text = re.sub(r'[@\*][a-zA-Z0-9_-]+', replacer, current_text)
            if next_text == current_text:
                break
            current_text = next_text

        return current_text


# ============================================================================
# 2. TRANSLATION & MODEL MANAGEMENT — delegates to translation_engine.py
# ============================================================================

from py.translation_engine import (
    TranslationRouter,
    reload_and_diagnose_model,
    unload_all_models,
    get_all_models_load_status,
    get_model_status,
)
from py.model_downloader import (
    MODEL_REPOS,
    check_model_exists,
    download_model_async,
    repair_model_async,
    get_all_model_status,
    scan_custom_models,
)

# Keep backward compat alias
Translator = TranslationRouter

class KeepSyncManager:
    """Manages two-way sync with Google Keep."""
    def __init__(self):
        self.enabled: bool = False
        self.auth_token: str = ""
        self.email: str = ""
        self.label_name: str = "ComfyUI-Styles"
        self.sync_interval: int = 300
        self._timer: Optional[threading.Timer] = None
        self._keep_client = None

    def configure(self, email: str, auth_token: str, label_name: str = "ComfyUI-Styles", sync_interval: int = 300):
        self.stop_background_sync()
        self.email = email
        self.auth_token = auth_token
        self.label_name = label_name
        self.sync_interval = sync_interval
        self.enabled = bool(email and auth_token)
        self._keep_client = None

    def stop_background_sync(self):
        if self._timer:
            try: self._timer.cancel()
            except Exception: pass
            self._timer = None

    def sync() -> Dict[str, Any]:
        return {"status": "disabled", "message": "Google Keep credentials not configured."}

    def start_background_sync(self):
        if not self.enabled: return
        self.stop_background_sync()

KEEP_SYNC = KeepSyncManager()


# ============================================================================
# 3. MAIN COMFYUI NODE CLASS
# ============================================================================

class TrixPromptAIO:
    """Trix Prompt AIO — Complete Prompt Engineering, Styling, Translation & Wildcard Solution."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "optional": {
                "text_in": ("STRING", {"forceInput": True, "multiline": True}),
            },
            "hidden": {
                "prompt_stack": ("STRING", {"default": ""}),
                "negative_prompt": ("STRING", {"default": ""}),
                "translation_enabled": ("STRING", {"default": "false"}),
                "translation_engine": ("STRING", {"default": "online_google"}),
                "translation_mode": ("STRING", {"default": "on_demand"}),
                "offline_model": ("STRING", {"default": "nllb_200_distilled"}),
                "source_lang": ("STRING", {"default": "auto"}),
                "target_lang": ("STRING", {"default": "en"}),
                "accent_color": ("STRING", {"default": "#5881AF"}),
                "group_mode": ("STRING", {"default": "increment"}),
                "group_seed": ("INT", {"default": 1, "min": 1}),
                "sep_comma": ("STRING", {"default": "true"}),
                "sep_period": ("STRING", {"default": "false"}),
                "sep_space": ("STRING", {"default": "true"}),
                "sep_newline": ("STRING", {"default": "false"}),
                "unique_id": "UNIQUE_ID",
                "extra_pnginfo": "EXTRA_PNGINFO",
            }
        }

    RETURN_TYPES = ("STRING", "STRING")
    RETURN_NAMES = ("positive", "negative")
    FUNCTION = "process_prompt"
    CATEGORY = "Trix/Prompting"


    @classmethod
    def _build_separator_prompt(cls, lines, kwargs):
        sep_comma = str(kwargs.get("sep_comma", "true")).lower() in ["true", "1"]
        sep_period = str(kwargs.get("sep_period", "false")).lower() in ["true", "1"]
        sep_space = str(kwargs.get("sep_space", "true")).lower() in ["true", "1"]
        sep_newline = str(kwargs.get("sep_newline", "false")).lower() in ["true", "1"]

        delims = []
        if sep_comma: delims.append(",")
        if sep_period: delims.append(".")
        
        delim_str = "".join(delims)
        if sep_space: delim_str += " "
        if sep_newline: delim_str += "\n"
        if not delim_str: delim_str = ", "

        valid = [l.strip() for l in lines if l and l.strip()]
        return delim_str.join(valid)

    def process_prompt(self, seed=0, group_mode="increment", group_seed=1, text_in=None, prompt_stack="", negative_prompt="", translation_engine="online_google", translation_mode="live", source_lang="auto", target_lang="en", accent_color="#5881AF", **kwargs):
        seed = kwargs.get("seed", seed)
        group_mode = kwargs.get("group_mode", group_mode)
        group_seed = max(1, int(kwargs.get("group_seed", 1)))
        text_in = kwargs.get("text_in", text_in)

        node_id = kwargs.get("unique_id", "default_node")
        node_key = str(node_id)

        if group_mode == "increment":
            last_start = StyleManager.LAST_START_SEED.get(node_key)
            if last_start is None or group_seed != last_start:
                effective_group_seed = group_seed
                StyleManager.LAST_START_SEED[node_key] = group_seed
            else:
                effective_group_seed = StyleManager.NODE_INCREMENT_SEEDS.get(node_key, group_seed)
        else:
            effective_group_seed = group_seed
            StyleManager.LAST_START_SEED[node_key] = group_seed
            StyleManager.NODE_INCREMENT_SEEDS[node_key] = group_seed

        lines = []
        if text_in and str(text_in).strip():
            lines.append(str(text_in).strip())

        try:
            data = json.loads(prompt_stack)
            if isinstance(data, dict) and "rows" in data:
                for row in data["rows"]:
                    if row.get("enabled", True) and row.get("text", "").strip():
                        lines.append(row["text"].strip())
                full_prompt = self._build_separator_prompt(lines, kwargs)
            else:
                if str(prompt_stack).strip():
                    lines.append(str(prompt_stack).strip())
                full_prompt = self._build_separator_prompt(lines, kwargs)
        except Exception:
            if str(prompt_stack).strip():
                lines.append(str(prompt_stack).strip())
            full_prompt = self._build_separator_prompt(lines, kwargs)

        full_prompt = StyleManager.expand_tags(full_prompt, seed=seed, group_mode=group_mode, group_seed=effective_group_seed, node_id=f"{node_id}_pos")
        full_negative = StyleManager.expand_tags(negative_prompt, seed=seed, group_mode=group_mode, group_seed=effective_group_seed, node_id=f"{node_id}_neg")

        pos_details = StyleManager.LAST_EXPANDED_DETAILS.get(f"{node_id}_pos", [])
        neg_details = StyleManager.LAST_EXPANDED_DETAILS.get(f"{node_id}_neg", [])
        combined_details = pos_details + neg_details

        if group_mode == "increment" and combined_details:
            next_seed = effective_group_seed + 1
            StyleManager.NODE_INCREMENT_SEEDS[node_key] = next_seed
            updated_seed = next_seed
        else:
            updated_seed = effective_group_seed


        try:
            if hasattr(PromptServer, "instance") and PromptServer.instance:
                PromptServer.instance.send_sync("trix_prompt_group_seed_update", {
                    "node_id": str(node_id),
                    "group_seed": updated_seed,
                    "group_mode": group_mode,
                    "details": combined_details
                })
        except Exception as e:
            logger.error(f"Error sending WS event: {e}")

        translation_engine = kwargs.get("translation_engine", translation_engine)
        translation_mode = kwargs.get("translation_mode", translation_mode)
        source_lang = kwargs.get("source_lang", source_lang)
        target_lang = kwargs.get("target_lang", target_lang)
        offline_model = kwargs.get("offline_model", "nllb_200_distilled")
        translation_enabled = kwargs.get("translation_enabled", "false")

        is_trans_on = str(translation_enabled).lower() in ["true", "1"]
        if is_trans_on and translation_mode in ("on_run", "output"):
            full_prompt = TranslationRouter.translate(full_prompt, engine=translation_engine, src_lang=source_lang, tgt_lang=target_lang, offline_model=offline_model)
            if full_negative.strip():
                full_negative = TranslationRouter.translate(full_negative, engine=translation_engine, src_lang=source_lang, tgt_lang=target_lang, offline_model=offline_model)

        return (full_prompt, full_negative)


# ============================================================================
# 4. API ROUTES REGISTRATION
# ============================================================================

_ROUTES_REGISTERED = False

def register_routes():
    global _ROUTES_REGISTERED
    if _ROUTES_REGISTERED:
        return True
    if not hasattr(PromptServer, "instance") or PromptServer.instance is None:
        return False

    routes = PromptServer.instance.routes

    @routes.get("/trix_prompt/styles")
    async def get_styles_route(request):
        try:
            ExcelStyleManager.clear_cache()
            styles = StyleManager.load_styles()
            cats = ExcelStyleManager.get_categories()
            return web.json_response({"status": "success", "styles": styles, "categories": cats})
        except Exception as e:
            return web.json_response({"status": "error", "message": str(e)}, status=500)

    @routes.post("/trix_prompt/styles/reload")
    async def reload_styles_route(request):
        try:
            ExcelStyleManager.clear_cache()
            styles = StyleManager.load_styles()
            cats = ExcelStyleManager.get_categories()
            return web.json_response({"status": "success", "styles": styles, "categories": cats})
        except Exception as e:
            return web.json_response({"status": "error", "message": str(e)}, status=500)

    @routes.get("/trix_prompt/styles/categories")
    async def get_categories_route(request):
        try:
            ExcelStyleManager.clear_cache()
            cats = ExcelStyleManager.get_categories()
            return web.json_response({"status": "success", "categories": cats})
        except Exception as e:
            return web.json_response({"status": "error", "message": str(e)}, status=500)

    @routes.get("/trix_prompt/image")
    async def get_image_route(request):
        try:
            img_name = request.query.get("img", "")
            res = ExcelStyleManager.get_image_bytes(img_name)
            nocache_headers = {
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            }
            if not res:
                return web.Response(status=404, text="Image not found", headers=nocache_headers)
            img_bytes, mime = res
            headers = dict(nocache_headers)
            headers["Content-Type"] = mime
            return web.Response(body=img_bytes, headers=headers)
        except Exception as e:
            return web.Response(status=500, text=str(e))

    @routes.post("/trix_prompt/styles/reorder")
    async def reorder_styles_route(request):
        try:
            data = await request.json()
            cat = data.get("category", "")
            ordered_ids = data.get("ordered_ids", [])
            updated = StyleManager.reorder_styles(cat, ordered_ids)
            cats = ExcelStyleManager.get_categories()
            return web.json_response({"status": "success", "styles": updated, "categories": cats})
        except Exception as e:
            return web.json_response({"status": "error", "message": str(e)}, status=500)

    @routes.post("/trix_prompt/styles/move_category")
    async def move_category_route(request):
        try:
            data = await request.json()
            style_ids = data.get("style_ids", [])
            target_cat = data.get("target_category", "custom")
            updated = StyleManager.move_styles_category(style_ids, target_cat)
            cats = ExcelStyleManager.get_categories()
            return web.json_response({"status": "success", "styles": updated, "categories": cats})
        except Exception as e:
            return web.json_response({"status": "error", "message": str(e)}, status=500)

    @routes.post("/trix_prompt/styles/save_custom")
    async def save_custom_style_route(request):
        try:
            data = await request.json()
            updated = StyleManager.save_custom_style(data)
            cats = ExcelStyleManager.get_categories()
            return web.json_response({"status": "success", "styles": updated, "categories": cats})
        except Exception as e:
            return web.json_response({"status": "error", "message": str(e)}, status=500)

    @routes.post("/trix_prompt/styles/delete")
    async def delete_style_route(request):
        try:
            data = await request.json()
            sid = data.get("id") or data.get("name")
            updated = StyleManager.delete_style(sid)
            cats = ExcelStyleManager.get_categories()
            return web.json_response({"status": "success", "styles": updated, "categories": cats})
        except Exception as e:
            return web.json_response({"status": "error", "message": str(e)}, status=500)
    # ── Model Management API ────────────────────────────────────────────────

    @routes.get("/trix_prompt/models_status")
    async def handle_models_status(request):
        try:
            models = get_all_models_load_status()
            return web.json_response({"status": "success", "models": models})
        except Exception as e:
            logger.error(f"models_status error: {e}")
            return web.json_response({"status": "error", "message": str(e)}, status=500)

    @routes.post("/trix_prompt/models/reload")
    async def handle_model_reload(request):
        import asyncio
        import functools
        try:
            data = await request.json()
            model_key = data.get("model_key", "")
            if not model_key:
                return web.json_response({"status": "error", "message": "model_key required"}, status=400)
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(None, functools.partial(reload_and_diagnose_model, model_key))
            try:
                if hasattr(PromptServer, "instance") and PromptServer.instance:
                    PromptServer.instance.send_sync("trix_prompt_model_status", {
                        "model_key": model_key,
                        "status": result.get("status", "error"),
                        "error": result.get("error"),
                    })
            except Exception:
                pass
            return web.json_response(result)
        except Exception as e:
            logger.error(f"model reload error: {e}")
            return web.json_response({"status": "error", "message": str(e)}, status=500)

    @routes.post("/trix_prompt/models/unload")
    async def handle_model_unload(request):
        try:
            unload_all_models()
            return web.json_response({"status": "success", "message": "All models unloaded"})
        except Exception as e:
            logger.error(f"model unload error: {e}")
            return web.json_response({"status": "error", "message": str(e)}, status=500)

    @routes.post("/trix_prompt/models/load")
    async def handle_model_load(request):
        try:
            data = await request.json()
            model_key = data.get("model_key", "")
            if not model_key:
                return web.json_response({"status": "error", "message": "model_key required"}, status=400)

            def _bg_load():
                result = reload_and_diagnose_model(model_key)
                try:
                    if hasattr(PromptServer, "instance") and PromptServer.instance:
                        PromptServer.instance.send_sync("trix_prompt_model_status", {
                            "model_key": model_key,
                            "status": result.get("status", "error"),
                            "error": result.get("error"),
                        })
                except Exception:
                    pass

            threading.Thread(target=_bg_load, daemon=True, name=f"TrixModelLoad-{model_key}").start()
            return web.json_response({"status": "loading", "message": f"Loading {model_key} in background..."})
        except Exception as e:
            logger.error(f"model load error: {e}")
            return web.json_response({"status": "error", "message": str(e)}, status=500)

    @routes.post("/trix_prompt/models/download")
    async def handle_model_download(request):
        try:
            data = await request.json()
            model_key = data.get("model_key", "")
            if not model_key:
                return web.json_response({"status": "error", "message": "model_key required"}, status=400)

            def _progress_cb(data):
                try:
                    if hasattr(PromptServer, "instance") and PromptServer.instance:
                        PromptServer.instance.send_sync("trix_prompt_download_progress", data)
                except Exception:
                    pass

            def _bg_download():
                success = download_model_async(model_key, progress_callback=_progress_cb)
                _progress_cb({
                    "model_key": model_key,
                    "status": "completed" if success else "error",
                    "progress": 100 if success else 0,
                    "message": "Download complete" if success else "Download failed",
                })

            threading.Thread(target=_bg_download, daemon=True, name=f"TrixModelDL-{model_key}").start()
            return web.json_response({"status": "downloading", "message": f"Downloading {model_key}..."})
        except Exception as e:
            logger.error(f"model download error: {e}")
            return web.json_response({"status": "error", "message": str(e)}, status=500)

    @routes.post("/trix_prompt/models/repair")
    async def handle_model_repair(request):
        try:
            data = await request.json()
            model_key = data.get("model_key", "")
            packages = data.get("packages", [])
            if not model_key:
                return web.json_response({"status": "error", "message": "model_key required"}, status=400)

            def _progress_cb(data):
                try:
                    if hasattr(PromptServer, "instance") and PromptServer.instance:
                        PromptServer.instance.send_sync("trix_prompt_download_progress", data)
                except Exception:
                    pass

            def _bg_repair():
                success = repair_model_async(model_key, packages=packages, progress_callback=_progress_cb)
                result = reload_and_diagnose_model(model_key)
                try:
                    if hasattr(PromptServer, "instance") and PromptServer.instance:
                        PromptServer.instance.send_sync("trix_prompt_model_status", {
                            "model_key": model_key,
                            "status": result.get("status", "error"),
                            "error": result.get("error"),
                        })
                except Exception:
                    pass

            threading.Thread(target=_bg_repair, daemon=True, name=f"TrixModelRepair-{model_key}").start()
            return web.json_response({"status": "repairing", "message": f"Repairing {model_key}..."})
        except Exception as e:
            logger.error(f"model repair error: {e}")
            return web.json_response({"status": "error", "message": str(e)}, status=500)

    @routes.post("/trix_prompt/translate")
    async def handle_translate_route(request):
        import asyncio
        import functools
        try:
            data = await request.json()
            text = data.get("text", "")
            engine = data.get("engine", "online_google")
            src_lang = data.get("src_lang", "auto")
            tgt_lang = data.get("tgt_lang", "en")
            offline_model = data.get("offline_model", "nllb_200_distilled")

            if not text or not text.strip():
                return web.json_response({"status": "success", "translated_text": text})

            loop = asyncio.get_event_loop()
            fn = functools.partial(
                TranslationRouter.translate,
                text=text, engine=engine, src_lang=src_lang,
                tgt_lang=tgt_lang, offline_model=offline_model
            )
            # Run blocking translation in thread pool with a hard timeout
            # Online: 10s is plenty; offline models can take longer
            timeout_secs = 10 if engine.startswith("online") else 60
            try:
                res = await asyncio.wait_for(
                    loop.run_in_executor(None, fn),
                    timeout=timeout_secs
                )
            except asyncio.TimeoutError:
                logger.warning(f"[TrixTranslate] Translation timed out after {timeout_secs}s (engine={engine})")
                return web.json_response({"status": "error", "message": "Translation timed out"}, status=504)

            return web.json_response({"status": "success", "translated_text": res or text})
        except Exception as e:
            logger.error(f"Translation route error: {e}")
            return web.json_response({"status": "error", "message": str(e)}, status=500)

    _ROUTES_REGISTERED = True
    return True

register_routes()
