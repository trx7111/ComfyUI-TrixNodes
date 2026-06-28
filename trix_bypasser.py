class TrixBypasser:
    """Trix Bypasser - Mute/Bypass nodes by ID"""
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {},
            "hidden": {
                "unique_id": "UNIQUE_ID",
            },
        }

    RETURN_TYPES = ()
    FUNCTION = "do_nothing"
    CATEGORY = "TrixNodes"

    def do_nothing(self, unique_id=None):
        return ()


class TrixBypasserSimple:
    """Trix Bypasser Simple - Mute/Bypass nodes by ID without groups"""
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {},
            "hidden": {
                "unique_id": "UNIQUE_ID",
            },
        }

    RETURN_TYPES = ()
    FUNCTION = "do_nothing"
    CATEGORY = "TrixNodes"

    def do_nothing(self, unique_id=None):
        return ()
