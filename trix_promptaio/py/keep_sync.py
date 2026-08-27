import os
import time
import json
import logging
import threading
from typing import Dict, Any, List, Optional

logger = logging.getLogger("TrixPromptAIO.KeepSync")


class KeepSyncManager:
    """Manages two-way sync between local style database and Google Keep or WebDAV/Local file."""

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

    def sync(self) -> Dict[str, Any]:
        """Executes a two-way synchronization run."""
        if not self.enabled:
            return {"status": "disabled", "message": "Google Keep credentials not configured."}

        try:
            import gkeepapi
        except ImportError:
            return {"status": "error", "message": "gkeepapi Python package is not installed."}

        try:
            if not self._keep_client:
                client = gkeepapi.Keep()
                client.authenticate(self.email, self.auth_token)
                self._keep_client = client

            keep = self._keep_client
            keep.sync()

            # Find or create label
            target_label = keep.findLabel(self.label_name)
            if not target_label:
                target_label = keep.createLabel(self.label_name)

            # Load local styles
            from py.style_manager import StyleManager
            local_styles = StyleManager.load_styles()
            local_map = {s.get("id") or s.get("name"): s for s in local_styles if s.get("id") or s.get("name")}

            # Fetch keep notes with target label
            notes = list(keep.find(labels=[target_label]))
            updated_count = 0

            for note in notes:
                # Parse title & body: Title: [Style] Cyberpunk Neon
                title = note.title
                if not title.startswith("[Style]"):
                    continue

                style_id = title.replace("[Style]", "").strip().lower().replace(" ", "_")
                body = note.text or ""

                # Extract positive / negative text from note
                positive = body
                negative = ""
                if "--\nNegative:" in body:
                    parts = body.split("--\nNegative:")
                    positive = parts[0].strip()
                    negative = parts[1].strip()

                if style_id not in local_map:
                    # New style pull from Keep
                    new_style = {
                        "id": style_id,
                        "name": title.replace("[Style]", "").strip(),
                        "category": "Google Keep",
                        "positive": positive,
                        "negative": negative,
                        "template": "{prompt}, " + positive,
                        "tags": ["@keep"],
                        "preview_color": "#ffbb00"
                    }
                    local_styles.append(new_style)
                    updated_count += 1

            # Save updated styles back to local storage
            if updated_count > 0:
                StyleManager.save_styles(local_styles)

            return {
                "status": "success",
                "synced_notes": len(notes),
                "pulled_new_styles": updated_count,
                "message": f"Successfully synced with Google Keep ({len(notes)} notes processed)."
            }

        except Exception as e:
            logger.error(f"Google Keep sync error: {e}")
            return {"status": "error", "message": f"Sync failed: {str(e)}"}

    def start_background_sync(self):
        """Starts periodic background sync."""
        if not self.enabled:
            return

        self.stop_background_sync()

        def _run():
            self.sync()
            self._timer = threading.Timer(self.sync_interval, _run)
            self._timer.daemon = True
            self._timer.start()

        self._timer = threading.Timer(0.1, _run)
        self._timer.daemon = True
        self._timer.start()


# Global KeepSync instance
KEEP_SYNC = KeepSyncManager()
