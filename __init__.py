from .trix_bypasser import TrixBypasser, TrixBypasserSimple

NODE_CLASS_MAPPINGS = {
    "TrixBypasser": TrixBypasser,
    "TrixBypasserSimple": TrixBypasserSimple
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "TrixBypasser": "Trix Bypass Nodes w Groups by ID",
    "TrixBypasserSimple": "Trix Bypass Nodes by ID"
}

WEB_DIRECTORY = "./web"

__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS', 'WEB_DIRECTORY']
