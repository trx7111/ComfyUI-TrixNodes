import os
import json
import logging
from aiohttp import web
from server import PromptServer

from .translation_engine import TranslationRouter, unload_idle_models, unload_all_models
from .model_downloader import download_model_async, check_model_exists, MODEL_REPOS
from .style_manager import StyleManager
from .excel_manager import ExcelStyleManager
from .keep_sync import KEEP_SYNC

logger = logging.getLogger("TrixPromptAIO.Node")


class TrixPromptAIO:
    """All-in-One ComfyUI Prompting Node with Translator, Style Gallery, and Prompt Stacking."""

    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "optional": {
                "text_in": ("STRING", {"forceInput": True, "multiline": True})
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

        punc = ""
        if sep_comma and sep_period:
            punc = ";"
        elif sep_comma:
            punc = ","
        elif sep_period:
            punc = "."

        result = ""
        for text in lines:
            t = text.strip()
            if not t:
                continue
            if result != "":
                add_punc = punc
                stripped = result.rstrip(" \t\r\n")
                if stripped.endswith(",") or stripped.endswith(".") or stripped.endswith(";"):
                    add_punc = ""
                result += add_punc
                if sep_newline:
                    result += "\n"
                if sep_space:
                    result += " "
                result += t
            else:
                result = t
        return result

    def process_prompt(
        self,
        prompt_stack: str = "",
        negative_prompt: str = "",
        translation_engine: str = "online_google",
        translation_mode: str = "live",
        source_lang: str = "auto",
        target_lang: str = "en",
        accent_color: str = "#ff5500",
        group_mode: str = "increment",
        text_in: str = None,
        **kwargs
    ):
        seed = 0
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

        # 1. Parse prompt stack JSON or raw string and prepend text_in
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

        # Notify UI of the updated group_seed and expanded style details after execution
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
            from server import PromptServer
            if PromptServer.instance:
                PromptServer.instance.send_sync("trix_prompt_group_seed_update", {
                    "node_id": str(node_id),
                    "group_seed": updated_seed,
                    "group_mode": group_mode,
                    "details": combined_details
                })
        except Exception as e:
            logger.error(f"Error sending group_seed update WS event: {e}")

        # 2. Translate if translation_mode is set to 'output' or 'on_run'
        translation_engine = kwargs.get("translation_engine", translation_engine)
        translation_mode = kwargs.get("translation_mode", translation_mode)
        source_lang = kwargs.get("source_lang", source_lang)
        target_lang = kwargs.get("target_lang", target_lang)
        offline_model = kwargs.get("offline_model", "nllb_200_distilled")
        translation_enabled = kwargs.get("translation_enabled", "false")

        translated_positive = full_prompt
        translated_negative = full_negative
        is_trans_on = str(translation_enabled).lower() in ["true", "1"]
        if is_trans_on and translation_mode in ["output", "on_run"]:
            if full_prompt:
                print(f"[TrixPrompt] Translating positive on run via '{translation_engine}' (model: '{offline_model}', {source_lang} -> {target_lang})...")
                translated_positive = TranslationRouter.translate(
                    text=full_prompt,
                    engine=translation_engine,
                    src_lang=source_lang,
                    tgt_lang=target_lang,
                    offline_model=offline_model,
                )
            if full_negative:
                print(f"[TrixPrompt] Translating negative on run via '{translation_engine}' (model: '{offline_model}', {source_lang} -> {target_lang})...")
                translated_negative = TranslationRouter.translate(
                    text=full_negative,
                    engine=translation_engine,
                    src_lang=source_lang,
                    tgt_lang=target_lang,
                    offline_model=offline_model,
                )

        unload_idle_models()

        return (translated_positive, translated_negative)

# ============================================================================
# API Routes Registration Handler
# ============================================================================
def register_routes():
    if not hasattr(PromptServer, "instance") or PromptServer.instance is None:
        return

    routes = PromptServer.instance.routes

    @routes.post("/trix_prompt/models/unload")
    async def unload_models_route(request):
        try:
            unload_all_models()
            return web.json_response({"status": "success", "message": "All offline models unloaded"})
        except Exception as e:
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
                return web.json_response({
                    "status": "success",
                    "original_text": text,
                    "translated_text": text,
                    "engine": engine
                })

            loop = asyncio.get_event_loop()
            fn = functools.partial(
                TranslationRouter.translate,
                text=text,
                engine=engine,
                src_lang=src_lang,
                tgt_lang=tgt_lang,
                offline_model=offline_model,
            )

            timeout_secs = 10 if str(engine).startswith("online") else 60
            try:
                translated_text = await asyncio.wait_for(
                    loop.run_in_executor(None, fn),
                    timeout=timeout_secs
                )
            except asyncio.TimeoutError:
                logger.warning(f"[TrixTranslate] Translation timed out after {timeout_secs}s (engine={engine})")
                return web.json_response({"status": "error", "message": "Translation timed out"}, status=504)

            return web.json_response({
                "status": "success",
                "original_text": text,
                "translated_text": translated_text or text,
                "engine": engine
            })
        except Exception as e:
            logger.error(f"Translation HTTP endpoint error: {e}")
            return web.json_response({"status": "error", "message": str(e)}, status=500)

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
            cats = ExcelStyleManager.get_categories()
            return web.json_response({"status": "success", "categories": cats})
        except Exception as e:
            return web.json_response({"status": "error", "message": str(e)}, status=500)

    @routes.get("/trix_prompt/styles/export_excel")
    async def export_excel_route(request):
        try:
            cat_param = request.query.get("category", "").strip()
            file_bytes, filename, content_type = ExcelStyleManager.export_category(cat_param)
            from urllib.parse import quote
            safe_filename = quote(filename)
            headers = {
                "Content-Type": content_type,
                "Content-Disposition": f'attachment; filename="{filename}"; filename*=UTF-8\'\'{safe_filename}'
            }
            return web.Response(
                body=file_bytes,
                headers=headers
            )
        except Exception as e:
            logger.error(f"Excel export error: {e}")
            return web.json_response({"status": "error", "message": str(e)}, status=500)

    @routes.post("/trix_prompt/styles/import_excel")
    async def import_excel_route(request):
        try:
            reader = await request.multipart()
            file_bytes = None
            filename = "imported_styles.xlsx"
            while True:
                part = await reader.next()
                if part is None:
                    break
                if part.name == "file":
                    filename = part.filename or "imported_styles.xlsx"
                    file_bytes = await part.read()
                    break
            if not file_bytes:
                return web.json_response({"status": "error", "message": "No file uploaded"}, status=400)

            res = ExcelStyleManager.import_excel_file(file_bytes, filename)
            return web.json_response({"status": "success", "result": res})
        except Exception as e:
            logger.error(f"Excel import error: {e}")
            return web.json_response({"status": "error", "message": str(e)}, status=500)

    @routes.post("/trix_prompt/styles/reorder")
    async def reorder_styles_route(request):
        try:
            data = await request.json()
            category = data.get("category")
            ordered_ids = data.get("ordered_ids") or data.get("style_ids") or []
            if not category:
                return web.json_response({"status": "error", "message": "Category is required"}, status=400)
            
            updated_styles = StyleManager.reorder_styles(category, ordered_ids)
            cats = ExcelStyleManager.get_categories()
            return web.json_response({"status": "success", "styles": updated_styles, "categories": cats})
        except Exception as e:
            logger.error(f"Error reordering styles: {e}")
            return web.json_response({"status": "error", "message": str(e)}, status=500)

    @routes.get("/trix_prompt/image")
    async def get_image_route(request):
        try:
            img_name = request.query.get("img", "")
            if not img_name:
                return web.Response(status=400, text="Missing img parameter")
            
            nocache_headers = {
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            }
            img_name = os.path.basename(img_name)
            img_data = ExcelStyleManager.get_image_bytes(img_name)
            if img_data:
                img_bytes, mime_type = img_data
                headers = dict(nocache_headers)
                headers["Content-Type"] = mime_type
                return web.Response(body=img_bytes, headers=headers)

            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            img_path = os.path.join(base_dir, "styles", "thumbnails", img_name)
            if os.path.exists(img_path):
                return web.FileResponse(img_path, headers=nocache_headers)
                
            return web.Response(status=404, text="Image not found", headers=nocache_headers)
        except Exception as e:
            return web.json_response({"status": "error", "message": str(e)}, status=500)

    @routes.post("/trix_prompt/styles/favorite")
    async def toggle_favorite_route(request):
        try:
            data = await request.json()
            style_id = data.get("id")
            if not style_id:
                return web.json_response({"status": "error", "message": "Missing style ID"}, status=400)
            styles = StyleManager.toggle_favorite(style_id)
            cats = ExcelStyleManager.get_categories()
            return web.json_response({"status": "success", "styles": styles, "categories": cats})
        except Exception as e:
            return web.json_response({"status": "error", "message": str(e)}, status=500)

    @routes.post("/trix_prompt/styles/save_custom")
    async def save_custom_style_route(request):
        try:
            data = await request.json()
            styles = StyleManager.save_custom_style(data)
            cats = ExcelStyleManager.get_categories()
            return web.json_response({"status": "success", "styles": styles, "categories": cats})
        except Exception as e:
            logger.error(f"Error in save_custom_style_route: {e}")
            return web.json_response({"status": "error", "message": str(e)}, status=500)

    @routes.post("/trix_prompt/styles/delete")
    async def delete_style_route(request):
        try:
            data = await request.json()
            style_id = data.get("id")
            if not style_id:
                return web.json_response({"status": "error", "message": "Missing style ID"}, status=400)
            styles = StyleManager.delete_style(style_id)
            cats = ExcelStyleManager.get_categories()
            return web.json_response({"status": "success", "styles": styles, "categories": cats})
        except Exception as e:
            return web.json_response({"status": "error", "message": str(e)}, status=500)

    @routes.post("/trix_prompt/styles/move_category")
    async def move_category_route(request):
        try:
            data = await request.json()
            style_ids = data.get("style_ids", [])
            target_category = data.get("target_category", "custom")
            styles = StyleManager.move_styles_category(style_ids, target_category)
            cats = ExcelStyleManager.get_categories()
            return web.json_response({"status": "success", "styles": styles, "categories": cats})
        except Exception as e:
            return web.json_response({"status": "error", "message": str(e)}, status=500)

    @routes.post("/trix_prompt/styles/delete_category")
    async def delete_category_route(request):
        try:
            data = await request.json()
            category_key = data.get("category_key")
            delete_styles = data.get("delete_styles", False)
            if not category_key:
                return web.json_response({"status": "error", "message": "Missing category key"}, status=400)
            styles = StyleManager.delete_category(category_key, delete_styles=delete_styles)
            cats = ExcelStyleManager.get_categories()
            return web.json_response({"status": "success", "styles": styles, "categories": cats})
        except Exception as e:
            return web.json_response({"status": "error", "message": str(e)}, status=500)

    @routes.post("/trix_prompt/styles/create_category")
    async def create_category_route(request):
        try:
            data = await request.json()
            category_key = data.get("category_key")
            if not category_key:
                return web.json_response({"status": "error", "message": "Missing category key"}, status=400)
            styles = StyleManager.create_category(category_key)
            cats = ExcelStyleManager.get_categories()
            return web.json_response({"status": "success", "styles": styles, "categories": cats})
        except Exception as e:
            return web.json_response({"status": "error", "message": str(e)}, status=500)

    @routes.get("/trix_prompt/models_status")
    async def get_models_status_route(request):
        try:
            from .model_downloader import get_all_model_status
            return web.json_response({"status": "success", "models": get_all_model_status()})
        except Exception as e:
            return web.json_response({"status": "error", "message": str(e)}, status=500)

    @routes.get("/trix_prompt/model_status")
    async def model_status_route(request):
        try:
            from .model_downloader import get_all_model_status
            return web.json_response({"status": "success", "models": get_all_model_status()})
        except Exception as e:
            return web.json_response({"status": "error", "message": str(e)}, status=500)

    @routes.post("/trix_prompt/models/reload")
    async def reload_model_route(request):
        try:
            data = await request.json()
            model_key = data.get("model_key")
            if not model_key:
                return web.json_response({"status": "error", "message": "Missing model_key"}, status=400)

            from .translation_engine import reload_and_diagnose_model
            result = reload_and_diagnose_model(model_key)
            return web.json_response(result)
        except Exception as e:
            return web.json_response({"status": "error", "message": str(e)}, status=500)

    @routes.post("/trix_prompt/models/repair")
    async def repair_model_route(request):
        try:
            data = await request.json()
            model_key = data.get("model_key")
            packages = data.get("packages", [])
            if not model_key:
                return web.json_response({"status": "error", "message": "Missing model_key"}, status=400)

            def progress_cb(data_dict):
                try:
                    PromptServer.instance.send_sync("trix_prompt_download_progress", data_dict)
                except Exception:
                    pass

            from .model_downloader import repair_model_async
            repair_model_async(model_key, packages=packages, progress_callback=progress_cb)
            return web.json_response({"status": "started", "model_key": model_key})
        except Exception as e:
            return web.json_response({"status": "error", "message": str(e)}, status=500)

    @routes.post("/trix_prompt/download_model")
    async def trigger_download_route(request):
        try:
            data = await request.json()
            model_key = data.get("model_key", "helsinki_opus_ru_en")

            def _on_progress(msg: dict):
                PromptServer.instance.send_sync("trix_prompt_download_progress", msg)

            started = download_model_async(model_key, progress_callback=_on_progress)
            if started:
                return web.json_response({"status": "started", "model_key": model_key})
            else:
                return web.json_response({"status": "error", "message": f"Could not start download for {model_key}"}, status=400)
        except Exception as e:
            return web.json_response({"status": "error", "message": str(e)}, status=500)

    @routes.post("/trix_prompt/sync_keep")
    async def sync_keep_route(request):
        try:
            data = await request.json()
            email = data.get("email", "")
            auth_token = data.get("auth_token", "")
            label_name = data.get("label", "ComfyUI-Styles")

            if email and auth_token:
                KEEP_SYNC.configure(email=email, auth_token=auth_token, label_name=label_name)

            res = KEEP_SYNC.sync()
            return web.json_response(res)
        except Exception as e:
            return web.json_response({"status": "error", "message": str(e)}, status=500)


    @routes.post("/trix_prompt/models/load")
    async def load_model_route(request):
        """Pre-load a downloaded model into RAM in a background thread."""
        try:
            data = await request.json()
            model_key = data.get("model_key")
            if not model_key:
                return web.json_response({"status": "error", "message": "Missing model_key"}, status=400)

            from .model_downloader import check_model_exists
            if not check_model_exists(model_key):
                return web.json_response({"status": "not_downloaded", "model_key": model_key})

            def _load_in_thread():
                try:
                    from .translation_engine import reload_and_diagnose_model, MODEL_STATUSES
                    MODEL_STATUSES[model_key] = {"status": "loading", "error": None}
                    try:
                        PromptServer.instance.send_sync("trix_prompt_model_status", {
                            "model_key": model_key, "status": "loading"
                        })
                    except Exception:
                        pass
                    result = reload_and_diagnose_model(model_key)
                    try:
                        PromptServer.instance.send_sync("trix_prompt_model_status", {
                            "model_key": model_key,
                            "status": result.get("status", "error"),
                            "error": result.get("error")
                        })
                    except Exception:
                        pass
                except Exception as e:
                    logger.error(f"Background model load failed for '{model_key}': {e}")

            import threading
            threading.Thread(target=_load_in_thread, daemon=True).start()
            return web.json_response({"status": "loading", "model_key": model_key})
        except Exception as e:
            return web.json_response({"status": "error", "message": str(e)}, status=500)


register_routes()
