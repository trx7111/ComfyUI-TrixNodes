from .trix_bypasser import TrixBypasser, TrixBypasserSimple
from .trix_ndloraloader.backend.nd_super_lora_node import NdSuperLoraLoader
from .trix_colormatch.color_matching import TrixColorMatchNode
from .trix_promptaio.py.prompt_node import TrixPromptAIO

NODE_CLASS_MAPPINGS = {
    "TrixBypasser": TrixBypasser,
    "TrixBypasserSimple": TrixBypasserSimple,
    "NdSuperLoraLoader": NdSuperLoraLoader,
    "TrixColorMatchNode": TrixColorMatchNode,
    "TrixPromptAIO": TrixPromptAIO,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "TrixBypasser": "🌊Bypass Nodes w Groups by ID",
    "TrixBypasserSimple": "🌊Bypass Nodes by ID",
    "NdSuperLoraLoader": "🌊Trix NDSuper LoRA Loader (VIP)",
    "TrixColorMatchNode": "🌊Trix Color Match",
    "TrixPromptAIO": "🌊Trix Prompt AIO",
}

WEB_DIRECTORY = "./web"

__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS', 'WEB_DIRECTORY']

# --- ND Super LoRA Loader API route registration ---
try:
    from .trix_ndloraloader.backend.web_api import register_routes as _register_super_lora_routes
    from .trix_ndloraloader.backend.file_api import register_file_api_routes as _register_file_api_routes
    try:
        from server import PromptServer  # ComfyUI's server
        _app = getattr(PromptServer.instance, "app", None) or PromptServer.instance
        if _app:
            _register_super_lora_routes(_app)
            _register_file_api_routes(_app)
            print("ND Super Nodes: API routes registered")
    except Exception as _e:
        print(f"ND Super Nodes: Failed to register API routes: {_e}")
except Exception:
    pass

# --- Trix Color Match preview cleanup ---
def _cleanup_web_folder():
    try:
        import os
        this_dir = os.path.dirname(os.path.abspath(__file__))
        web_dir = os.path.join(this_dir, "web")
        if not os.path.isdir(web_dir):
            return
        for name in os.listdir(web_dir):
            # Only delete image files to avoid removing JS or other assets
            if name.lower().endswith((".png", ".jpg", ".jpeg")):
                try:
                    os.remove(os.path.join(web_dir, name))
                except Exception:
                    pass
    except Exception:
        pass

_cleanup_web_folder()
