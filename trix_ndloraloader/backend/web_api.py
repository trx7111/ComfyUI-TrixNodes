"""
Web API endpoints for ND Super Nodes
"""

import json
from aiohttp import web
import os
try:
    import folder_paths
except Exception:
    folder_paths = None
from .lora_utils import get_available_loras, extract_trigger_words, resolve_lora_full_path
from .template_manager import get_template_manager
from .civitai_service import get_civitai_service
from .version_utils import get_update_status


async def get_loras(request):
    """Get list of available LoRA files"""
    try:
        loras = get_available_loras()
        return web.json_response({"loras": loras})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


async def get_files(request):
    """Generic file lister using ComfyUI folder_paths (e.g., folder_name=loras|vae|checkpoints)

    Uses folder_paths.get_filename_list() so the listing matches the standard
    ComfyUI widgets exactly: recursive subfolders, symlinked directories
    (followlinks=True), extra_model_paths.yaml entries and ComfyUI caching.
    """
    try:
        folder_name = request.rel_url.query.get("folder_name")
        ext_param = request.rel_url.query.get("extensions", "")
        extensions = [e.strip().lower() for e in ext_param.split(",") if e.strip()]

        if not folder_name:
            return web.json_response({"error": "folder_name is required", "files": []}, status=400)

        if folder_paths is None:
            return web.json_response({"error": "folder_paths unavailable", "files": []}, status=500)

        mapped = folder_paths.map_legacy(folder_name)

        # Resolve the file list exactly like the standard ComfyUI widgets do.
        list_key = None
        all_names = []
        for key in (mapped, folder_name):
            if not key:
                continue
            try:
                names = folder_paths.get_filename_list(key)
            except Exception:
                names = []
            if names:
                list_key = key
                all_names = list(names)
                break

        out_files = []
        for name in all_names:
            if not isinstance(name, str) or not name:
                continue
            relative = name.replace("\\", "/")
            base = relative.rsplit("/", 1)[-1]
            _, ext = os.path.splitext(base)
            if extensions and ext.lower() not in extensions:
                continue
            entry = {
                "name": base,
                "path": relative,
                "relative_path": relative,
                "extension": ext.lower(),
                "size": None,
                "modified": None
            }
            full_path = None
            try:
                get_full_path = getattr(folder_paths, "get_full_path", None)
                if callable(get_full_path) and list_key:
                    full_path = get_full_path(list_key, name)
            except Exception:
                full_path = None
            if full_path:
                try:
                    st = os.stat(full_path)
                    entry["size"] = st.st_size
                    entry["modified"] = st.st_mtime
                except (OSError, IOError):
                    pass
            out_files.append(entry)

        out_files.sort(key=lambda x: x["name"].lower())
        return web.json_response({"files": out_files, "total": len(out_files)})
    except Exception as e:
        return web.json_response({"error": str(e), "files": []}, status=500)

async def get_templates(request):
    """Get list of available templates or a specific template by query param"""
    try:
        template_manager = get_template_manager()

        # Support GET /super_lora/templates?name=Foo for compatibility
        name = request.rel_url.query.get("name")
        if name:
            template = template_manager.load_template(name)
            if template:
                return web.json_response(template)
            return web.json_response({"error": "Template not found"}, status=404)

        templates = template_manager.list_templates()
        return web.json_response({"templates": templates})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


async def save_template(request):
    """Save a LoRA template or handle action-based operations (e.g., delete)"""
    try:
        data = await request.json()
        action = data.get("action")

        # Backward-compatible action handler: POST with { action: 'delete', name }
        if action == "delete":
            name = data.get("name")
            if not name:
                return web.json_response({"error": "Template name is required"}, status=400)
            template_manager = get_template_manager()
            deleted = template_manager.delete_template(name)
            if deleted:
                return web.json_response({"success": True, "message": f"Template '{name}' deleted"})
            return web.json_response({"error": "Template not found or could not be deleted"}, status=404)

        name = data.get("name")
        # Accept both 'lora_configs' (preferred) and 'loras' (compat)
        lora_configs = data.get("lora_configs")
        if lora_configs is None:
            lora_configs = data.get("loras", [])

        if not name:
            return web.json_response({"error": "Template name is required"}, status=400)

        template_manager = get_template_manager()
        success = template_manager.save_template(name, lora_configs)

        if success:
            return web.json_response({"success": True, "message": f"Template '{name}' saved"})
        else:
            return web.json_response({"error": "Failed to save template"}, status=500)

    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


async def load_template(request):
    """Load a LoRA template"""
    try:
        template_name = request.match_info.get("name")
        
        if not template_name:
            return web.json_response({"error": "Template name is required"}, status=400)
        
        template_manager = get_template_manager()
        template_data = template_manager.load_template(template_name)
        
        if template_data:
            return web.json_response(template_data)
        else:
            return web.json_response({"error": "Template not found"}, status=404)
            
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


async def get_civitai_info(request):
    """Get CivitAI info for a LoRA"""
    try:
        data = await request.json()
        lora_filename = data.get("lora_filename")
        
        if not lora_filename:
            return web.json_response({"error": "LoRA filename is required"}, status=400)
        
        civitai_service = get_civitai_service()
        trigger_words = await civitai_service.get_trigger_words(lora_filename)
        
        model_id = None
        version_id = None
        civitai_url = None

        full_path = resolve_lora_full_path(lora_filename)
        if full_path:
            file_hash = civitai_service._calculate_file_hash(full_path)
            if file_hash:
                model_info = await civitai_service.get_model_info_by_hash(file_hash)
                if model_info:
                    model_id = model_info.get("modelId") or model_info.get("model", {}).get("id")
                    version_id = model_info.get("id")
                    if model_id:
                        civitai_url = f"https://civitai.red/models/{model_id}?modelVersionId={version_id}" if version_id else f"https://civitai.red/models/{model_id}"

        payload = {
            "lora_filename": lora_filename,
            "trigger_words": trigger_words,
            "trainedWords": trigger_words,
            "modelId": model_id,
            "modelVersionId": version_id,
            "civitai_url": civitai_url,
            "success": True
        }

        return web.json_response(payload)
        
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


async def delete_template(request):
    """Delete a template via JSON body: { name }"""
    try:
        data = await request.json()
        name = data.get("name")
        if not name:
            return web.json_response({"error": "Template name is required"}, status=400)
        template_manager = get_template_manager()
        deleted = template_manager.delete_template(name)
        if deleted:
            return web.json_response({"success": True, "message": f"Template '{name}' deleted"})
        return web.json_response({"error": "Template not found"}, status=404)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


async def delete_template_by_name(request):
    """Delete a template by path parameter"""
    try:
        name = request.match_info.get("name")
        if not name:
            return web.json_response({"error": "Template name is required"}, status=400)
        template_manager = get_template_manager()
        deleted = template_manager.delete_template(name)
        if deleted:
            return web.json_response({"success": True, "message": f"Template '{name}' deleted"})
        return web.json_response({"error": "Template not found"}, status=404)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


async def get_version_info(request):
    """Return local version info plus cached update availability."""
    try:
        force = request.rel_url.query.get("force") in {"1", "true", "yes"}
        status = await get_update_status(force=force)
        return web.json_response(status)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


# --- LoRA Notes Storage Endpoints ---
USER_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "user"))
os.makedirs(USER_DIR, exist_ok=True)


def sanitize_filename(name: str) -> str:
    clean = name.replace("\\", "_").replace("/", "_").replace(":", "_").replace("*", "_").replace("?", "_").replace('"', "_").replace("<", "_").replace(">", "_").replace("|", "_")
    return clean


async def get_lora_notes(request):
    """Get notes for a specific LoRA or a map of all LoRAs that have notes."""
    try:
        lora = request.rel_url.query.get("lora", "")
        if not lora:
            has_notes = {}
            if os.path.exists(USER_DIR):
                for fname in os.listdir(USER_DIR):
                    if fname.endswith(".json"):
                        fpath = os.path.join(USER_DIR, fname)
                        try:
                            with open(fpath, "r", encoding="utf-8") as f:
                                data = json.load(f)
                                lora_name = data.get("lora") or os.path.splitext(fname)[0]
                                has_notes[lora_name] = bool(data.get("notes") or data.get("images"))
                        except Exception:
                            pass
            return web.json_response({"notes_map": has_notes})

        clean_name = sanitize_filename(lora)
        fpath = os.path.join(USER_DIR, f"{clean_name}.json")
        if not os.path.exists(fpath):
            return web.json_response({"lora": lora, "notes": "", "images": [], "updatedAt": 0, "exists": False})

        with open(fpath, "r", encoding="utf-8") as f:
            data = json.load(f)
        data["exists"] = True
        return web.json_response(data)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


async def save_lora_notes(request):
    """Save notes and embedded compressed images for a specific LoRA."""
    try:
        import time
        data = await request.json()
        lora = data.get("lora")
        if not lora:
            return web.json_response({"error": "LoRA name is required"}, status=400)

        clean_name = sanitize_filename(lora)
        fpath = os.path.join(USER_DIR, f"{clean_name}.json")

        payload = {
            "lora": lora,
            "notes": data.get("notes", ""),
            "images": data.get("images", []),
            "imageSize": data.get("imageSize", 140),
            "textareaHeight": data.get("textareaHeight", 280),
            "updatedAt": int(time.time())
        }

        with open(fpath, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)

        return web.json_response({"success": True, "message": "Notes saved", "data": payload})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


async def delete_lora_notes(request):
    """Delete note file for a specific LoRA."""
    try:
        lora = request.rel_url.query.get("lora")
        if not lora:
            try:
                data = await request.json()
                lora = data.get("lora")
            except Exception:
                pass
        if not lora:
            return web.json_response({"error": "LoRA name is required"}, status=400)

        clean_name = sanitize_filename(lora)
        fpath = os.path.join(USER_DIR, f"{clean_name}.json")
        if os.path.exists(fpath):
            os.remove(fpath)
            return web.json_response({"success": True, "message": f"Notes for '{lora}' deleted"})
        return web.json_response({"error": "Note file not found"}, status=404)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


async def rename_lora_notes(request):
    """Rename note file when a LoRA is renamed on disk."""
    try:
        data = await request.json()
        old_lora = data.get("oldLora")
        new_lora = data.get("newLora")
        if not old_lora or not new_lora:
            return web.json_response({"error": "oldLora and newLora are required"}, status=400)

        old_clean = sanitize_filename(old_lora)
        new_clean = sanitize_filename(new_lora)

        old_fpath = os.path.join(USER_DIR, f"{old_clean}.json")
        new_fpath = os.path.join(USER_DIR, f"{new_clean}.json")

        if os.path.exists(old_fpath):
            try:
                with open(old_fpath, "r", encoding="utf-8") as f:
                    note_data = json.load(f)
                note_data["lora"] = new_lora
                with open(new_fpath, "w", encoding="utf-8") as f:
                    json.dump(note_data, f, ensure_ascii=False, indent=2)
                os.remove(old_fpath)
                return web.json_response({"success": True, "message": f"Renamed notes from '{old_lora}' to '{new_lora}'"})
            except Exception as ex:
                return web.json_response({"error": f"Failed to rename note file: {ex}"}, status=500)

        return web.json_response({"success": False, "message": "No existing note file found to rename"})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


async def get_civitai_gallery(request):
    """Fetch gallery previews and full prompt metadata from CivitAI"""
    try:
        lora_filename = request.rel_url.query.get("lora")
        if not lora_filename:
            try:
                data = await request.json()
                lora_filename = data.get("lora_filename") or data.get("lora")
            except Exception:
                pass

        if not lora_filename:
            return web.json_response({"error": "LoRA filename is required", "success": False, "images": []}, status=400)

        civitai_service = get_civitai_service()
        gallery_data = await civitai_service.get_model_gallery(lora_filename)
        return web.json_response(gallery_data)
    except Exception as e:
        return web.json_response({"error": str(e), "success": False, "images": []}, status=500)


async def proxy_image(request):
    """Proxy external image to prevent CORS issues when embedding into canvas/dataURL"""
    try:
        img_url = request.rel_url.query.get("url")
        if not img_url:
            return web.Response(status=400, text="Missing url parameter")

        civitai_service = get_civitai_service()
        session = await civitai_service._get_session()
        async with session.get(img_url) as resp:
            if resp.status == 200:
                body = await resp.read()
                content_type = resp.headers.get("Content-Type", "image/jpeg")
                return web.Response(
                    body=body,
                    content_type=content_type,
                    headers={"Access-Control-Allow-Origin": "*"}
                )
            else:
                return web.Response(status=resp.status, text=f"Failed to fetch image: {resp.status}")
    except Exception as e:
        return web.Response(status=500, text=str(e))


# Route registration function
def register_routes(app):
    """Register all Super LoRA Loader routes"""
    app.router.add_get("/super_lora/loras", get_loras)
    app.router.add_get("/super_lora/files", get_files)
    app.router.add_get("/super_lora/templates", get_templates)
    app.router.add_post("/super_lora/templates", save_template)
    app.router.add_get("/super_lora/templates/{name}", load_template)
    # Deletion endpoints (compatibility and RESTful)
    app.router.add_delete("/super_lora/templates", delete_template)  # expects JSON body { name }
    app.router.add_post("/super_lora/templates/delete", delete_template)  # expects JSON body { name }
    app.router.add_delete("/super_lora/templates/{name}", delete_template_by_name)
    app.router.add_post("/super_lora/civitai_info", get_civitai_info)
    app.router.add_get("/super_lora/civitai_gallery", get_civitai_gallery)
    app.router.add_post("/super_lora/civitai_gallery", get_civitai_gallery)
    app.router.add_get("/super_lora/proxy_image", proxy_image)
    app.router.add_get("/super_lora/version", get_version_info)
    app.router.add_get("/super_lora/notes", get_lora_notes)
    app.router.add_post("/super_lora/notes", save_lora_notes)
    app.router.add_post("/super_lora/notes/rename", rename_lora_notes)
    app.router.add_delete("/super_lora/notes", delete_lora_notes)

    # Legacy aliases without underscore for older frontends / workflows
    app.router.add_get("/superlora/loras", get_loras)
    app.router.add_get("/superlora/files", get_files)
    app.router.add_get("/superlora/templates", get_templates)
    app.router.add_post("/superlora/templates", save_template)
    app.router.add_get("/superlora/templates/{name}", load_template)
    app.router.add_delete("/superlora/templates", delete_template)
    app.router.add_post("/superlora/templates/delete", delete_template)
    app.router.add_delete("/superlora/templates/{name}", delete_template_by_name)
    app.router.add_post("/superlora/civitai_info", get_civitai_info)
    app.router.add_get("/superlora/civitai_gallery", get_civitai_gallery)
    app.router.add_post("/superlora/civitai_gallery", get_civitai_gallery)
    app.router.add_get("/superlora/proxy_image", proxy_image)
    app.router.add_get("/superlora/version", get_version_info)
    app.router.add_get("/superlora/notes", get_lora_notes)
    app.router.add_post("/superlora/notes", save_lora_notes)
    app.router.add_post("/superlora/notes/rename", rename_lora_notes)
    app.router.add_delete("/superlora/notes", delete_lora_notes)
