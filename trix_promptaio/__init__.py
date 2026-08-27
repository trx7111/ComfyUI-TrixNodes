from .py.prompt_node import TrixPromptAIO

NODE_CLASS_MAPPINGS = {
    "TrixPromptAIO": TrixPromptAIO
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "TrixPromptAIO": "🌊Trix Prompt AIO"
}

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "TrixPromptAIO"]
