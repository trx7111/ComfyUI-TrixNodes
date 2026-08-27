/**
 * LoRA Notes Drawer (✍︎)
 * Floating sleek side panel & modal for per-LoRA notes, prompt tips, compressed embedded images,
 * Civitai gallery auto-fetch with full generation parameters, rich metadata lightbox viewer,
 * dynamic node accent colors, and one-click JSON compression.
 */

const STYLES = `
.trix-notes-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
  z-index: 10005;
  display: flex;
  justify-content: flex-end;
  opacity: 0;
  transition: opacity 0.22s ease-out;
  --trix-acc: #387aff;
}
.trix-notes-backdrop.is-open {
  opacity: 1;
}
.trix-notes-drawer {
  width: 540px;
  max-width: 95vw;
  height: 100vh;
  background: #141418;
  border-left: 1px solid #282832;
  box-shadow: -10px 0 35px rgba(0,0,0,0.6);
  display: flex;
  flex-direction: column;
  color: #e2e2e9;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  transform: translateX(100%);
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), width 0.2s ease;
  box-sizing: border-box;
  --trix-acc: #387aff;
}
.trix-notes-backdrop.is-open .trix-notes-drawer {
  transform: translateX(0);
}
.trix-notes-drawer.is-maximized {
  width: 880px;
}

/* Header */
.trix-notes-header {
  padding: 14px 18px;
  background: #1a1a20;
  border-bottom: 1px solid #282832;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
}
.trix-notes-title-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
}
.trix-notes-icon {
  font-size: 18px;
  color: var(--trix-acc, #387aff);
  display: inline-block;
}
.trix-notes-title {
  font-size: 13.5px;
  font-weight: 600;
  color: #f0f0f5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.trix-notes-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.trix-notes-btn {
  background: #22222a;
  border: 1px solid #32323e;
  color: #ccc;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.15s ease;
  user-select: none;
}
.trix-notes-btn:hover {
  background: #2c2c38;
  color: #fff;
  border-color: #444455;
}
.trix-notes-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.trix-notes-btn-primary {
  background: var(--trix-acc, #2563eb);
  border: 1px solid var(--trix-acc, #3b82f6);
  color: #fff;
  font-weight: 600;
}
.trix-notes-btn.trix-notes-btn-primary:hover {
  background: var(--trix-acc, #2563eb);
  border-color: rgba(255, 255, 255, 0.4);
  color: #fff;
  filter: brightness(1.18);
  box-shadow: 0 0 14px color-mix(in srgb, var(--trix-acc, #2563eb) 65%, transparent);
}
.trix-notes-btn-civitai, .trix-notes-btn-add {
  background: #1f2937;
  border: 1px solid #374151;
  color: #e5e7eb;
  font-weight: 500;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.15s ease;
  user-select: none;
}
.trix-notes-btn-civitai:hover, .trix-notes-btn-add:hover {
  background: #374151;
  border-color: #4b5563;
  color: #fff;
}
.trix-notes-btn-icon {
  padding: 6px 9px;
  font-size: 14px;
}

/* Body */
.trix-notes-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-sizing: border-box;
}

.trix-notes-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.trix-notes-section-title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: #888899;
  font-weight: 600;
}

.trix-notes-gallery-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Gallery Container & Drop Zone */
.trix-notes-gallery-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  box-sizing: border-box;
}

.trix-notes-drop-zone {
  position: relative;
  width: 100%;
  border: 1.5px dashed transparent;
  border-radius: 8px;
  transition: border-color 0.18s, background-color 0.18s;
  box-sizing: border-box;
}
.trix-notes-drop-zone.is-dragover {
  border-color: var(--trix-acc, #387aff);
  background: rgba(56, 122, 255, 0.05);
}

.trix-notes-images-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 10px;
  width: 100%;
  box-sizing: border-box;
  padding: 6px 0;
  min-height: 80px;
  --trix-img-size: 140px;
}

.trix-notes-empty-gallery {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 24px 12px;
  color: #64748b;
  font-size: 11.5px;
  text-align: center;
  user-select: none;
  width: 100%;
}
.trix-notes-empty-gallery .empty-icon {
  font-size: 26px;
  opacity: 0.7;
}

.trix-notes-img-card {
  position: relative;
  width: var(--trix-img-size, 140px);
  height: var(--trix-img-size, 140px);
  aspect-ratio: 1;
  background: #18181e;
  border: 1px solid #2a2a34;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  user-select: none;
  flex: 0 0 auto;
  box-sizing: border-box;
  transition: transform 0.15s, border-color 0.15s, opacity 0.15s, box-shadow 0.15s;
}
.trix-notes-img-card:hover {
  transform: translateY(-2px);
  border-color: var(--trix-acc, #387aff);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45);
}
.trix-notes-img-card.dragging {
  opacity: 0.35;
  cursor: grabbing;
  border-style: dashed;
}
.trix-notes-img-card.drag-over {
  border-color: var(--trix-acc, #387aff);
  box-shadow: 0 0 0 2px var(--trix-acc, #387aff);
  transform: scale(1.04);
}
.trix-notes-img-card img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  pointer-events: none;
}
.trix-notes-img-del {
  position: absolute;
  top: 5px;
  right: 5px;
  background: rgba(0, 0, 0, 0.75);
  color: #ff5555;
  border: none;
  border-radius: 4px;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  font-size: 11px;
  transition: opacity 0.15s, background 0.15s;
  z-index: 2;
}
.trix-notes-img-card:hover .trix-notes-img-del {
  opacity: 1;
}
.trix-notes-img-del:hover {
  background: #dc2626;
  color: #fff;
}
.trix-notes-img-badge {
  position: absolute;
  bottom: 5px;
  left: 5px;
  background: rgba(0, 0, 0, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 3px;
  padding: 1px 4px;
  color: #93c5fd;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  pointer-events: none;
  backdrop-filter: blur(4px);
}

/* Gallery Footer (Size Slider & Count) */
.trix-notes-gallery-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 2px 6px 2px;
  font-size: 10.5px;
  color: #727584;
}
.trix-notes-size-ctrl {
  display: flex;
  align-items: center;
  gap: 6px;
}
.trix-notes-size-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 80px;
  height: 4px;
  border-radius: 2px;
  background: #2d2e3b;
  outline: none;
  cursor: pointer;
}
.trix-notes-size-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--trix-acc, #387aff);
  cursor: pointer;
  transition: transform 0.1s;
}
.trix-notes-size-slider::-webkit-slider-thumb:hover {
  transform: scale(1.25);
}

/* Text Section */
.trix-notes-text-wrap {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 200px;
}
.trix-notes-textarea {
  width: 100%;
  height: 280px;
  min-height: 180px;
  background: #101014;
  border: 1px solid #282832;
  border-radius: 8px;
  padding: 12px 14px;
  color: #f0f0f5;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.5;
  resize: vertical;
  box-sizing: border-box;
  outline: none;
  flex: 1 1 auto;
  transition: border-color 0.2s;
}
.trix-notes-textarea:focus {
  border-color: var(--trix-acc, #387aff);
}

/* Footer / Status */
.trix-notes-footer {
  padding: 12px 18px;
  background: #18181e;
  border-top: 1px solid #282832;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  color: #777;
  flex-shrink: 0;
}
.trix-notes-status {
  display: flex;
  align-items: center;
  gap: 6px;
}
.trix-notes-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10b981;
}

/* Rich Lightbox Viewer (Screenshot 3 style) */
.trix-notes-lightbox {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.92);
  backdrop-filter: blur(10px);
  z-index: 10010;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --trix-acc: #387aff;
}
.trix-lb-img-wrap {
  position: relative;
  max-width: 90vw;
  max-height: 92vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
.trix-lb-img {
  max-width: 88vw;
  max-height: 88vh;
  object-fit: contain;
  border-radius: 6px;
  box-shadow: 0 25px 70px rgba(0,0,0,0.85);
  pointer-events: auto;
}
.trix-lb-topbar {
  position: absolute;
  top: 18px;
  right: 24px;
  display: flex;
  align-items: center;
  gap: 14px;
  z-index: 20;
}
.trix-lb-counter {
  font-size: 13px;
  font-weight: 600;
  color: #e2e8f0;
  background: rgba(0, 0, 0, 0.6);
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(6px);
}
.trix-lb-close-btn {
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #fff;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  cursor: pointer;
  transition: all 0.15s;
  backdrop-filter: blur(6px);
}
.trix-lb-close-btn:hover {
  background: #dc2626;
  border-color: #ef4444;
}
.trix-lb-nav-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 44px;
  height: 44px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #fff;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
  z-index: 15;
  backdrop-filter: blur(6px);
}
.trix-lb-nav-btn:hover {
  background: var(--trix-acc, #387aff);
  border-color: var(--trix-acc, #387aff);
  transform: translateY(-50%) scale(1.08);
}
.trix-lb-nav-btn.left {
  left: 20px;
}
.trix-lb-nav-btn.right {
  right: 20px;
}

/* Floating Metadata Card (Bottom-Left overlay, Screenshot 3) */
.trix-lb-meta-card {
  position: absolute;
  bottom: 24px;
  left: 24px;
  max-width: 520px;
  width: calc(100% - 48px);
  max-height: 45vh;
  background: rgba(18, 18, 24, 0.88);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  padding: 14px 16px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  gap: 10px;
  z-index: 20;
  box-sizing: border-box;
  overflow-y: auto;
  pointer-events: auto;
}
.trix-lb-model-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 5px;
  padding: 3px 8px;
  font-size: 10.5px;
  color: #cbd5e1;
  font-family: monospace;
  align-self: flex-start;
}
.trix-lb-model-badge b {
  color: #94a3b8;
  font-weight: 600;
}
.trix-lb-meta-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  font-weight: 700;
  color: #f1f5f9;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.trix-lb-copy-icon-btn {
  background: #272730;
  border: 1px solid #3a3a46;
  border-radius: 4px;
  color: #94a3b8;
  padding: 3px 8px;
  font-size: 10px;
  cursor: pointer;
  transition: all 0.15s;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.trix-lb-copy-icon-btn:hover {
  background: var(--trix-acc, #387aff);
  color: #fff;
  border-color: var(--trix-acc, #387aff);
}
.trix-lb-prompt-box {
  background: #111116;
  border: 1px solid #282834;
  border-radius: 6px;
  padding: 9px 11px;
  font-size: 11.5px;
  line-height: 1.45;
  color: #e2e8f0;
  max-height: 120px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
  user-select: text;
}
.trix-lb-prompt-box.neg {
  color: #fca5a5;
  border-color: #451a1a;
  background: #1a0f0f;
}
.trix-lb-params-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.trix-lb-param-pill {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 4px;
  padding: 2px 7px;
  font-size: 9.5px;
  color: #94a3b8;
  font-family: monospace;
  letter-spacing: 0.3px;
  text-transform: uppercase;
}
.trix-lb-param-pill b {
  color: #38bdf8;
  font-weight: 700;
}
.trix-lb-actions-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
.trix-lb-del-btn {
  background: transparent;
  border: 1px solid #7f1d1d;
  color: #f87171;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 10px;
  cursor: pointer;
  transition: all 0.15s;
}
.trix-lb-del-btn:hover {
  background: #dc2626;
  color: #fff;
  border-color: #ef4444;
}
`;

function injectStyles() {
  if (document.getElementById("trix-lora-notes-css")) return;
  const style = document.createElement("style");
  style.id = "trix-lora-notes-css";
  style.textContent = STYLES;
  document.head.appendChild(style);
}

// Client-side image compressor: converts File / Blob / dataURL to WebP Base64 string
async function compressImageSource(src, maxWidth = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w > maxWidth || h > maxWidth) {
        if (w > h) {
          h = Math.round((h * maxWidth) / w);
          w = maxWidth;
        } else {
          w = Math.round((w * maxWidth) / h);
          h = maxWidth;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, w);
      canvas.height = Math.max(1, h);
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, w, h);

      try {
        const webp = canvas.toDataURL("image/webp", quality);
        resolve(webp);
      } catch {
        const jpeg = canvas.toDataURL("image/jpeg", quality);
        resolve(jpeg);
      }
    };
    img.onerror = reject;

    if (typeof src === "string") {
      img.src = src;
    } else if (src instanceof Blob || src instanceof File) {
      const reader = new FileReader();
      reader.onload = (e) => { img.src = e.target.result; };
      reader.onerror = reject;
      reader.readAsDataURL(src);
    } else {
      reject(new Error("Unsupported image source"));
    }
  });
}

export class LoraNotesDrawer {
  static instance = null;

  static getInstance() {
    if (!LoraNotesDrawer.instance) {
      LoraNotesDrawer.instance = new LoraNotesDrawer();
    }
    return LoraNotesDrawer.instance;
  }

  static open(loraName, node) {
    if (!loraName || loraName === "None") {
      alert("Please select a LoRA first before opening notes.");
      return;
    }
    const drawer = LoraNotesDrawer.getInstance();
    drawer.show(loraName, node);
  }

  static async renameNote(oldLora, newLora) {
    if (!oldLora || !newLora || oldLora === newLora) return;
    const drawer = LoraNotesDrawer.getInstance();
    
    const hadNote = Boolean(drawer.notesMap?.[oldLora] || drawer.notesCache?.has(oldLora));
    if (hadNote) {
      if (drawer.notesMap) {
        drawer.notesMap[newLora] = drawer.notesMap[oldLora];
        delete drawer.notesMap[oldLora];
      }
      if (drawer.notesCache?.has(oldLora)) {
        const cached = drawer.notesCache.get(oldLora);
        if (cached) {
          cached.lora = newLora;
          drawer.notesCache.set(newLora, cached);
        }
        drawer.notesCache.delete(oldLora);
      }
    }

    try {
      await fetch("/super_lora/notes/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldLora, newLora })
      });
    } catch (_) {}
  }

  constructor() {
    injectStyles();
    this.currentLora = null;
    this.currentNode = null;
    this.notesText = "";
    this.images = []; // Array of { url, civitaiUrl, meta: { prompt, negativePrompt, model, ... } } or string
    this.imageSize = 140;
    this.textareaHeight = 280;
    this.isMaximized = false;
    this.autoSaveTimer = null;
    this.notesCache = new Map();
    this.notesMap = {};
    this.lightboxCurrentIndex = 0;
    this.activeLightboxEl = null;
    this._buildDOM();
    this._bindEvents();
    this._loadNotesMap();
  }

  _buildDOM() {
    this.backdrop = document.createElement("div");
    this.backdrop.className = "trix-notes-backdrop";

    this.drawer = document.createElement("div");
    this.drawer.className = "trix-notes-drawer";

    // Header
    this.header = document.createElement("div");
    this.header.className = "trix-notes-header";
    this.header.innerHTML = `
      <div class="trix-notes-title-wrap">
        <span class="trix-notes-icon">✍︎</span>
        <span class="trix-notes-title" id="trix-notes-lora-title">LoRA Notes</span>
      </div>
      <div class="trix-notes-actions">
        <button class="trix-notes-btn" id="trix-notes-copy-btn" title="Copy text to clipboard">⎘ Copy</button>
        <button class="trix-notes-btn trix-notes-btn-icon" id="trix-notes-max-btn" title="Toggle maximize">⛶</button>
        <button class="trix-notes-btn trix-notes-btn-icon" id="trix-notes-close-btn" title="Close (Esc)">✕</button>
      </div>
    `;

    // Body — 1. Visual Reference Gallery with Top Actions & Bottom Size Slider, 2. Notes Textarea
    this.body = document.createElement("div");
    this.body.className = "trix-notes-body";
    this.body.innerHTML = `
      <!-- TOP: Visual Reference Gallery -->
      <div class="trix-notes-gallery-wrap">
        <div class="trix-notes-section-header">
          <span class="trix-notes-section-title">Visual Reference Gallery</span>
          <div class="trix-notes-gallery-actions">
            <button class="trix-notes-btn trix-notes-btn-civitai" id="trix-notes-civitai-btn" title="Fetch previews & metadata from Civitai">
              <span>ᨒ</span> Civitai Previews
            </button>
            <button class="trix-notes-btn trix-notes-btn-add" id="trix-notes-add-img-btn" title="Add image (Drop or Click)">
              <span>+</span> Add Image
            </button>
          </div>
        </div>

        <div class="trix-notes-drop-zone" id="trix-notes-drop-zone">
          <div class="trix-notes-images-grid" id="trix-notes-gallery"></div>
        </div>

        <div class="trix-notes-gallery-footer">
          <div class="trix-notes-size-ctrl">
            <span>Size:</span>
            <input type="range" class="trix-notes-size-slider" id="trix-notes-size-slider" min="80" max="260" step="5" value="140" title="Adjust thumbnail size" />
            <span id="trix-notes-size-val">140px</span>
          </div>
          <span class="trix-notes-img-count" id="trix-notes-img-count">0 images</span>
        </div>
      </div>

      <!-- BOTTOM: Notes & Prompt Recommendations -->
      <div class="trix-notes-text-wrap">
        <div class="trix-notes-section-header">
          <span class="trix-notes-section-title">Notes & Prompt Recommendations</span>
          <span id="trix-notes-word-count" style="font-size:10px;color:#666;">0 words</span>
        </div>
        <textarea class="trix-notes-textarea" id="trix-notes-input" placeholder="Type prompt tips, trigger words, recommended CFG, weight settings, or notes for this LoRA..."></textarea>
      </div>

      <input type="file" id="trix-notes-file-input" accept="image/*" multiple style="display:none;" />
    `;

    // Footer
    this.footer = document.createElement("div");
    this.footer.className = "trix-notes-footer";
    this.footer.innerHTML = `
      <div class="trix-notes-status">
        <span class="trix-notes-status-dot"></span>
        <span id="trix-notes-status-text">Ready</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <button class="trix-notes-btn" id="trix-notes-compress-btn" title="Compress all loaded images to 512px to reduce JSON size">🗜 Compress JSON</button>
        <button class="trix-notes-btn trix-notes-btn-primary" id="trix-notes-save-btn">Save Notes</button>
      </div>
    `;

    this.drawer.appendChild(this.header);
    this.drawer.appendChild(this.body);
    this.drawer.appendChild(this.footer);
    this.backdrop.appendChild(this.drawer);
  }

  _bindEvents() {
    // Backdrop click outside
    this.backdrop.addEventListener("click", (e) => {
      if (e.target === this.backdrop) this.hide();
    });

    // Close button
    this.drawer.querySelector("#trix-notes-close-btn").addEventListener("click", () => this.hide());

    // Maximize button
    this.drawer.querySelector("#trix-notes-max-btn").addEventListener("click", () => {
      this.isMaximized = !this.isMaximized;
      this.drawer.classList.toggle("is-maximized", this.isMaximized);
    });

    // Copy button
    this.drawer.querySelector("#trix-notes-copy-btn").addEventListener("click", () => {
      const text = this.textarea.value;
      if (!text) return;
      navigator.clipboard.writeText(text).then(() => {
        this._setStatus("Copied to clipboard!");
        setTimeout(() => this._setStatus("Saved ✓"), 1500);
      });
    });

    // Civitai Previews Fetch Button
    this.drawer.querySelector("#trix-notes-civitai-btn").addEventListener("click", () => {
      this._fetchCivitaiGallery();
    });

    // Add Image Button
    const fileInput = this.drawer.querySelector("#trix-notes-file-input");
    this.drawer.querySelector("#trix-notes-add-img-btn").addEventListener("click", () => {
      fileInput.click();
    });

    fileInput.addEventListener("change", async (e) => {
      if (e.target.files) {
        await this._handleFiles(e.target.files);
        fileInput.value = "";
      }
    });

    // Drop Zone Events for Drag & Drop image files
    const dropZone = this.drawer.querySelector("#trix-notes-drop-zone");
    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (e.dataTransfer?.types?.includes("Files")) {
        dropZone.classList.add("is-dragover");
      }
    });
    dropZone.addEventListener("dragleave", (e) => {
      if (!dropZone.contains(e.relatedTarget)) {
        dropZone.classList.remove("is-dragover");
      }
    });
    dropZone.addEventListener("drop", async (e) => {
      e.preventDefault();
      dropZone.classList.remove("is-dragover");
      if (e.dataTransfer?.files?.length) {
        await this._handleFiles(e.dataTransfer.files);
      }
    });

    // Textarea input & resize tracking
    this.textarea = this.drawer.querySelector("#trix-notes-input");
    this.textarea.addEventListener("input", () => {
      this.notesText = this.textarea.value;
      this._updateWordCount();
      this._scheduleAutoSave();
    });
    this.textarea.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "Enter" || e.keyCode === 13)) {
        this.save(true);
        try {
          window.app?.queuePrompt?.(0);
        } catch (_) {}
      }
    });

    // Track textarea user resize
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.height > 50) {
          const h = Math.round(entry.contentRect.height);
          if (Math.abs(h - this.textareaHeight) > 10) {
            this.textareaHeight = h;
            this._scheduleAutoSave();
          }
        }
      }
    });
    ro.observe(this.textarea);

    // Size Slider
    const sizeSlider = this.drawer.querySelector("#trix-notes-size-slider");
    const sizeVal = this.drawer.querySelector("#trix-notes-size-val");
    sizeSlider.addEventListener("input", (e) => {
      const sz = parseInt(e.target.value, 10) || 140;
      this.imageSize = sz;
      sizeVal.textContent = `${sz}px`;
      const gallery = this.drawer.querySelector("#trix-notes-gallery");
      if (gallery) {
        gallery.style.setProperty("--trix-img-size", `${sz}px`);
      }
      this._scheduleAutoSave();
    });

    // Save button
    this.drawer.querySelector("#trix-notes-save-btn").addEventListener("click", () => {
      this.save();
    });

    // Compress JSON button
    this.drawer.querySelector("#trix-notes-compress-btn").addEventListener("click", () => {
      this._compressAllImagesTo512();
    });

    // Paste handler for Ctrl+V anywhere while drawer is open
    window.addEventListener("paste", async (e) => {
      if (!this.backdrop.classList.contains("is-open")) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            await this._handleFiles([file]);
          }
        }
      }
    });

    // ESC key listener
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.backdrop.classList.contains("is-open")) {
        if (this.activeLightboxEl) {
          this.activeLightboxEl.remove();
          this.activeLightboxEl = null;
        } else {
          this.hide();
        }
      }
    });
  }

  async _loadNotesMap() {
    try {
      const resp = await fetch("/super_lora/notes");
      if (resp.ok) {
        const json = await resp.json();
        this.notesMap = json.notes_map || {};
        window.dispatchEvent(new CustomEvent("trix_lora_notes_map_loaded", { detail: this.notesMap }));
      }
    } catch (_) {}
  }

  hasNotes(loraName) {
    if (!loraName) return false;
    return Boolean(this.notesMap && this.notesMap[loraName]);
  }

  async _handleFiles(files) {
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      this._setStatus("Compressing image...");
      try {
        const compressedBase64 = await compressImageSource(file, 1280, 0.82);
        this.images.push({
          url: compressedBase64,
          meta: {
            prompt: "",
            negativePrompt: "",
            model: "",
            size: "",
            sampler: "",
            steps: "",
            cfgScale: ""
          }
        });
        this._renderGallery();
        this._scheduleAutoSave();
        this._setStatus("Image added");
      } catch (err) {
        console.error("Image compression error:", err);
      }
    }
  }

  _updateWordCount() {
    const text = this.textarea.value.trim();
    const count = text ? text.split(/\s+/).length : 0;
    const el = this.drawer.querySelector("#trix-notes-word-count");
    if (el) el.textContent = `${count} words (${text.length} chars)`;
  }

  _setStatus(text) {
    const el = this.drawer.querySelector("#trix-notes-status-text");
    if (el) el.textContent = text;
  }

  _scheduleAutoSave() {
    if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
    this._setStatus("Unsaved changes...");
    this.autoSaveTimer = setTimeout(() => {
      this.save(true);
    }, 1200);
  }

  /**
   * Fetch previews, trigger words, description, and metadata from CivitAI
   */
  async _fetchCivitaiGallery() {
    if (!this.currentLora) return;
    const civitaiBtn = this.drawer.querySelector("#trix-notes-civitai-btn");
    const origText = civitaiBtn ? civitaiBtn.innerHTML : "";
    if (civitaiBtn) {
      civitaiBtn.disabled = true;
      civitaiBtn.innerHTML = `<span>⌛︎</span> Fetching...`;
    }
    this._setStatus("Fetching previews from Civitai...");

    try {
      const resp = await fetch(`/super_lora/civitai_gallery?lora=${encodeURIComponent(this.currentLora)}`);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      const data = await resp.json();
      if (!data.success || !data.images || data.images.length === 0) {
        this._setStatus("No Civitai previews found");
        alert(`Civitai search for '${this.currentLora}' found no preview images.`);
        return;
      }

      this._setStatus(`Downloading ${data.images.length} previews...`);
      let addedCount = 0;

      for (const item of data.images) {
        if (!item.url) continue;
        try {
          // Download and compress image through proxy to bypass CORS
          const proxyUrl = `/super_lora/proxy_image?url=${encodeURIComponent(item.url)}`;
          const imgResp = await fetch(proxyUrl);
          if (imgResp.ok) {
            const blob = await imgResp.blob();
            const base64 = await compressImageSource(blob, 1280, 0.82);
            this.images.push({
              url: base64,
              civitaiUrl: item.url,
              meta: item.meta || {}
            });
            addedCount++;
          }
        } catch (e) {
          console.warn("[LoRA Notes] failed to download civitai preview image:", e);
        }
      }

      // Auto-fill trigger words and prompt notes if textarea is currently empty
      if (!this.notesText.trim()) {
        const parts = [];
        if (data.trainedWords && data.trainedWords.length > 0) {
          parts.push(`Trigger Words: ${data.trainedWords.join(", ")}`);
        }
        if (data.modelName) {
          parts.push(`Model: ${data.modelName}`);
        }
        if (data.description) {
          const cleanDesc = data.description.replace(/<[^>]*>?/gm, "").trim();
          if (cleanDesc) {
            parts.push(`\nDescription:\n${cleanDesc.slice(0, 600)}`);
          }
        }
        if (parts.length > 0) {
          this.notesText = parts.join("\n");
          this.textarea.value = this.notesText;
          this._updateWordCount();
        }
      }

      this._renderGallery();
      this._scheduleAutoSave();
      this._setStatus(`Loaded ${addedCount} previews from Civitai ✓`);
    } catch (err) {
      console.error("[LoRA Notes] Civitai fetch error:", err);
      this._setStatus("Civitai fetch failed");
      alert(`Failed to fetch Civitai previews: ${err.message}`);
    } finally {
      if (civitaiBtn) {
        civitaiBtn.disabled = false;
        civitaiBtn.innerHTML = origText || `<span>ᨒ</span> Civitai Previews`;
      }
    }
  }

  /**
   * One-click Compress all gallery images down to max 512px to make JSON file much smaller
   */
  async _compressAllImagesTo512() {
    if (!this.images || this.images.length === 0) {
      this._setStatus("No images to compress");
      return;
    }
    const compressBtn = this.drawer.querySelector("#trix-notes-compress-btn");
    const origBtnHtml = compressBtn ? compressBtn.innerHTML : "";
    if (compressBtn) {
      compressBtn.disabled = true;
      compressBtn.innerHTML = `<span>⌛︎</span> Compressing...`;
    }
    this._setStatus("Compressing images to 512px...");

    let count = 0;
    for (let i = 0; i < this.images.length; i++) {
      const item = this.images[i];
      const norm = this._normalizeImageItem(item);
      if (!norm.url) continue;

      try {
        let compressed512 = null;
        if (norm.url.startsWith("data:")) {
          compressed512 = await compressImageSource(norm.url, 512, 0.78);
        } else {
          const blob = await fetch(norm.url).then(r => r.blob()).catch(async () => {
            if (norm.civitaiUrl) {
              const pUrl = `/super_lora/proxy_image?url=${encodeURIComponent(norm.civitaiUrl)}`;
              return await fetch(pUrl).then(r => r.blob());
            }
            return null;
          });
          if (blob) {
            compressed512 = await compressImageSource(blob, 512, 0.78);
          }
        }

        if (compressed512) {
          if (typeof item === "string") {
            this.images[i] = compressed512;
          } else {
            this.images[i] = {
              ...item,
              url: compressed512
            };
          }
          count++;
        }
      } catch (err) {
        console.warn("[LoRA Notes] error compressing image to 512px:", err);
      }
    }

    this._renderGallery();
    await this.save(false);
    this._setStatus(`Compressed ${count} images to 512px ✓`);

    if (compressBtn) {
      compressBtn.disabled = false;
      compressBtn.innerHTML = origBtnHtml || `🗜 Compress JSON`;
    }
  }

  /**
   * Helper to normalize an image item into { url, meta }
   */
  _normalizeImageItem(item) {
    if (!item) return { url: "", meta: {} };
    if (typeof item === "string") {
      return { url: item, meta: {} };
    }
    return {
      url: item.url || item.civitaiUrl || "",
      civitaiUrl: item.civitaiUrl,
      meta: item.meta || {}
    };
  }

  /**
   * Renders the Centered Gallery with Drag & Drop Reordering
   */
  _renderGallery() {
    const gallery = this.drawer.querySelector("#trix-notes-gallery");
    const countEl = this.drawer.querySelector("#trix-notes-img-count");
    gallery.innerHTML = "";
    gallery.style.setProperty("--trix-img-size", `${this.imageSize || 140}px`);

    if (countEl) {
      countEl.textContent = `${this.images.length} ${this.images.length === 1 ? 'image' : 'images'}`;
    }

    if (this.images.length === 0) {
      const empty = document.createElement("div");
      empty.className = "trix-notes-empty-gallery";
      empty.innerHTML = `
        <span class="empty-icon">🖼</span>
        <span>No reference images yet</span>
        <span style="color:#475569;font-size:10.5px;">Click "Civitai Previews" or drop images here</span>
      `;
      gallery.appendChild(empty);
      return;
    }

    let draggedIndex = null;

    this.images.forEach((item, index) => {
      const norm = this._normalizeImageItem(item);
      const card = document.createElement("div");
      card.className = "trix-notes-img-card";
      card.draggable = true;
      card.dataset.index = index;

      const img = document.createElement("img");
      img.src = norm.url;
      img.alt = `LoRA Reference ${index + 1}`;

      const delBtn = document.createElement("button");
      delBtn.className = "trix-notes-img-del";
      delBtn.innerHTML = "✖︎";
      delBtn.title = "Delete image";
      delBtn.onclick = (e) => {
        e.stopPropagation();
        this.images.splice(index, 1);
        this._renderGallery();
        this._scheduleAutoSave();
      };

      if (norm.meta?.prompt || norm.meta?.model) {
        const badge = document.createElement("div");
        badge.className = "trix-notes-img-badge";
        badge.textContent = norm.meta.model ? "prompt+" : "prompt";
        card.appendChild(badge);
      }

      card.onclick = () => this._openLightbox(index);

      // Drag & Drop Reordering Events
      card.addEventListener("dragstart", (e) => {
        draggedIndex = index;
        card.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(index));
      });

      card.addEventListener("dragend", () => {
        card.classList.remove("dragging");
        gallery.querySelectorAll(".trix-notes-img-card").forEach((c) => c.classList.remove("drag-over"));
        draggedIndex = null;
      });

      card.addEventListener("dragover", (e) => {
        e.preventDefault();
        if (draggedIndex !== null && draggedIndex !== index) {
          card.classList.add("drag-over");
        }
      });

      card.addEventListener("dragleave", () => {
        card.classList.remove("drag-over");
      });

      card.addEventListener("drop", (e) => {
        e.preventDefault();
        card.classList.remove("drag-over");
        if (draggedIndex !== null && draggedIndex !== index) {
          const moved = this.images.splice(draggedIndex, 1)[0];
          this.images.splice(index, 0, moved);
          this._renderGallery();
          this._scheduleAutoSave();
        }
      });

      card.appendChild(img);
      card.appendChild(delBtn);
      gallery.appendChild(card);
    });
  }

  /**
   * Rich Lightbox Modal with Prompt & Generation Parameters Overlay (Screenshot 3 style)
   */
  _openLightbox(initialIndex = 0) {
    if (this.images.length === 0) return;
    this.lightboxCurrentIndex = Math.max(0, Math.min(initialIndex, this.images.length - 1));

    if (this.activeLightboxEl) {
      this.activeLightboxEl.remove();
      this.activeLightboxEl = null;
    }

    const lightbox = document.createElement("div");
    lightbox.className = "trix-notes-lightbox";
    
    // Apply node accent color to lightbox
    const accent = this.currentNode?.properties?.highlightColor || this.currentNode?.color || "#387aff";
    lightbox.style.setProperty("--trix-acc", accent);
    this.activeLightboxEl = lightbox;

    const renderCurrent = () => {
      const idx = this.lightboxCurrentIndex;
      const total = this.images.length;
      const item = this.images[idx];
      const norm = this._normalizeImageItem(item);
      const meta = norm.meta || {};

      lightbox.innerHTML = `
        <!-- Top Bar -->
        <div class="trix-lb-topbar">
          <div class="trix-lb-counter">${idx + 1} / ${total}</div>
          <button class="trix-lb-close-btn" id="trix-lb-close" title="Close (Esc)">✕</button>
        </div>

        <!-- Prev / Next Navigation -->
        ${total > 1 ? `<button class="trix-lb-nav-btn left" id="trix-lb-prev" title="Previous (Left Arrow)">◀</button>` : ""}
        ${total > 1 ? `<button class="trix-lb-nav-btn right" id="trix-lb-next" title="Next (Right Arrow)">▶</button>` : ""}

        <!-- Center Big Image -->
        <div class="trix-lb-img-wrap">
          <img class="trix-lb-img" src="${norm.url}" alt="LoRA Preview ${idx + 1}" />
        </div>

        <!-- Floating Metadata Card (Bottom-Left) -->
        <div class="trix-lb-meta-card" id="trix-lb-meta-card">
          ${meta.model ? `<div class="trix-lb-model-badge"><b>model</b> ${meta.model}</div>` : ""}
          
          <div class="trix-lb-meta-header">
            <span>Positive Prompt</span>
            ${meta.prompt ? `<button class="trix-lb-copy-icon-btn" id="trix-lb-copy-prompt" title="Copy Positive Prompt">⎘ Copy</button>` : ""}
          </div>

          <div class="trix-lb-prompt-box" id="trix-lb-prompt-text" contenteditable="true" spellcheck="false">${meta.prompt || "(No prompt recorded for this image. Click to edit/type...)"}</div>

          ${meta.negativePrompt ? `
            <div class="trix-lb-meta-header" style="font-size:10px;color:#fca5a5;">Negative Prompt</div>
            <div class="trix-lb-prompt-box neg" id="trix-lb-neg-prompt" contenteditable="true" spellcheck="false">${meta.negativePrompt}</div>
          ` : ""}

          <!-- Other Generation Parameters Pills -->
          <div class="trix-lb-params-row">
            ${meta.cfgScale ? `<span class="trix-lb-param-pill"><b>CFG:</b> ${meta.cfgScale}</span>` : ""}
            ${meta.steps ? `<span class="trix-lb-param-pill"><b>STEPS:</b> ${meta.steps}</span>` : ""}
            ${meta.sampler ? `<span class="trix-lb-param-pill"><b>SAMPLER:</b> ${meta.sampler}</span>` : ""}
            ${meta.size ? `<span class="trix-lb-param-pill"><b>SIZE:</b> ${meta.size}</span>` : ""}
            ${meta.seed ? `<span class="trix-lb-param-pill"><b>SEED:</b> ${meta.seed}</span>` : ""}
          </div>

          <!-- Bottom Actions -->
          <div class="trix-lb-actions-row">
            <div style="display:flex;gap:6px;">
              <button class="trix-lb-copy-icon-btn" id="trix-lb-insert-notes" title="Append prompt into notes textarea">⬇ Add to Notes</button>
              ${norm.civitaiUrl ? `<a href="${norm.civitaiUrl}" target="_blank" class="trix-lb-copy-icon-btn" style="text-decoration:none;color:#93c5fd;">🔗 Civitai</a>` : ""}
            </div>
            <button class="trix-lb-del-btn" id="trix-lb-delete-img" title="Delete this image">🗑 Delete</button>
          </div>
        </div>
      `;

      // Event Listeners for Lightbox Controls
      lightbox.querySelector("#trix-lb-close").onclick = (e) => {
        e.stopPropagation();
        lightbox.remove();
        this.activeLightboxEl = null;
      };

      const prevBtn = lightbox.querySelector("#trix-lb-prev");
      if (prevBtn) {
        prevBtn.onclick = (e) => {
          e.stopPropagation();
          this.lightboxCurrentIndex = (this.lightboxCurrentIndex - 1 + total) % total;
          renderCurrent();
        };
      }

      const nextBtn = lightbox.querySelector("#trix-lb-next");
      if (nextBtn) {
        nextBtn.onclick = (e) => {
          e.stopPropagation();
          this.lightboxCurrentIndex = (this.lightboxCurrentIndex + 1) % total;
          renderCurrent();
        };
      }

      const copyPromptBtn = lightbox.querySelector("#trix-lb-copy-prompt");
      if (copyPromptBtn && meta.prompt) {
        copyPromptBtn.onclick = (e) => {
          e.stopPropagation();
          navigator.clipboard.writeText(meta.prompt).then(() => {
            copyPromptBtn.textContent = "✓ Copied";
            setTimeout(() => { copyPromptBtn.textContent = "⎘ Copy"; }, 1500);
          });
        };
      }

      const insertNotesBtn = lightbox.querySelector("#trix-lb-insert-notes");
      if (insertNotesBtn) {
        insertNotesBtn.onclick = (e) => {
          e.stopPropagation();
          const promptText = lightbox.querySelector("#trix-lb-prompt-text")?.innerText || meta.prompt || "";
          if (promptText && promptText !== "(No prompt recorded for this image. Click to edit/type...)") {
            this.textarea.value = (this.textarea.value ? this.textarea.value + "\n\n" : "") + promptText;
            this.notesText = this.textarea.value;
            this._updateWordCount();
            this._scheduleAutoSave();
            insertNotesBtn.textContent = "✓ Added!";
            setTimeout(() => { insertNotesBtn.textContent = "⬇ Add to Notes"; }, 1500);
          }
        };
      }

      // Live editable prompt saving
      const promptBox = lightbox.querySelector("#trix-lb-prompt-text");
      if (promptBox) {
        promptBox.onblur = () => {
          const val = promptBox.innerText.trim();
          if (val && val !== "(No prompt recorded for this image. Click to edit/type...)") {
            if (typeof this.images[idx] === "string") {
              this.images[idx] = { url: this.images[idx], meta: { prompt: val } };
            } else {
              this.images[idx].meta = this.images[idx].meta || {};
              this.images[idx].meta.prompt = val;
            }
            this._scheduleAutoSave();
          }
        };
      }

      const delBtn = lightbox.querySelector("#trix-lb-delete-img");
      if (delBtn) {
        delBtn.onclick = (e) => {
          e.stopPropagation();
          this.images.splice(idx, 1);
          this._renderGallery();
          this._scheduleAutoSave();
          if (this.images.length === 0) {
            lightbox.remove();
            this.activeLightboxEl = null;
          } else {
            this.lightboxCurrentIndex = Math.min(idx, this.images.length - 1);
            renderCurrent();
          }
        };
      }

      // Prevent backdrop click when clicking inside metadata card or image
      const metaCard = lightbox.querySelector("#trix-lb-meta-card");
      if (metaCard) metaCard.onclick = (e) => e.stopPropagation();
      const imgEl = lightbox.querySelector(".trix-lb-img");
      if (imgEl) imgEl.onclick = (e) => e.stopPropagation();
    };

    lightbox.onclick = (e) => {
      if (e.target === lightbox || e.target.classList.contains("trix-lb-img-wrap")) {
        lightbox.remove();
        this.activeLightboxEl = null;
      }
    };

    // Keyboard arrow navigation
    const keyHandler = (e) => {
      if (!this.activeLightboxEl) {
        window.removeEventListener("keydown", keyHandler);
        return;
      }
      if (e.key === "ArrowLeft") {
        this.lightboxCurrentIndex = (this.lightboxCurrentIndex - 1 + this.images.length) % this.images.length;
        renderCurrent();
      } else if (e.key === "ArrowRight") {
        this.lightboxCurrentIndex = (this.lightboxCurrentIndex + 1) % this.images.length;
        renderCurrent();
      }
    };
    window.addEventListener("keydown", keyHandler);

    renderCurrent();
    document.body.appendChild(lightbox);
  }

  async show(loraName, node) {
    this.currentLora = loraName;
    this.currentNode = node;

    // Apply node accent color dynamically
    const accent = this.currentNode?.properties?.highlightColor || this.currentNode?.color || "#387aff";
    this.drawer.style.setProperty("--trix-acc", accent);
    this.backdrop.style.setProperty("--trix-acc", accent);

    this.drawer.querySelector("#trix-notes-lora-title").textContent = loraName;
    this.textarea.value = "";
    this.images = [];
    this.imageSize = 140;
    this.textareaHeight = 280;

    const sizeSlider = this.drawer.querySelector("#trix-notes-size-slider");
    const sizeVal = this.drawer.querySelector("#trix-notes-size-val");
    if (sizeSlider) sizeSlider.value = 140;
    if (sizeVal) sizeVal.textContent = "140px";

    this._renderGallery();
    this._updateWordCount();
    this._setStatus("Loading notes...");

    if (!document.body.contains(this.backdrop)) {
      document.body.appendChild(this.backdrop);
    }

    // Trigger open animation
    requestAnimationFrame(() => {
      this.backdrop.classList.add("is-open");
    });

    // Load from backend
    try {
      const resp = await fetch(`/super_lora/notes?lora=${encodeURIComponent(loraName)}`);
      if (resp.ok) {
        const data = await resp.json();
        this.notesText = data.notes || "";
        this.images = Array.isArray(data.images) ? data.images : [];
        this.imageSize = Number(data.imageSize) || 140;
        this.textareaHeight = Number(data.textareaHeight) || 280;

        this.textarea.value = this.notesText;
        this.textarea.style.height = `${this.textareaHeight}px`;

        if (sizeSlider) sizeSlider.value = this.imageSize;
        if (sizeVal) sizeVal.textContent = `${this.imageSize}px`;

        this._updateWordCount();
        this._renderGallery();
        this._setStatus(data.updatedAt ? "Saved ✓" : "New Note");
      } else {
        this._setStatus("Ready");
      }
    } catch (err) {
      console.warn("[LoRA Notes] load error:", err);
      this._setStatus("Offline (Local)");
    }
  }

  hide() {
    this.backdrop.classList.remove("is-open");
    if (this.activeLightboxEl) {
      this.activeLightboxEl.remove();
      this.activeLightboxEl = null;
    }
    setTimeout(() => {
      if (this.backdrop.parentNode) {
        this.backdrop.parentNode.removeChild(this.backdrop);
      }
    }, 250);
  }

  async save(isAuto = false) {
    if (!this.currentLora) return;
    this._setStatus("Saving...");
    try {
      const payload = {
        lora: this.currentLora,
        notes: this.notesText,
        images: this.images,
        imageSize: this.imageSize || 140,
        textareaHeight: this.textareaHeight || 280
      };
      const resp = await fetch("/super_lora/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (resp.ok) {
        this._setStatus("Saved ✓");
        this.notesCache.set(this.currentLora, payload);
        if (this.notesMap) {
          this.notesMap[this.currentLora] = Boolean(this.notesText || this.images.length > 0);
        }
        window.dispatchEvent(new CustomEvent("trix_lora_notes_updated", { detail: { lora: this.currentLora, hasNotes: Boolean(this.notesText || this.images.length > 0) } }));
        if (this.currentNode?.setDirtyCanvas) {
          this.currentNode.setDirtyCanvas(true, false);
        }
      } else {
        const errText = await resp.text().catch(() => "");
        console.error(`[LoRA Notes] save failed HTTP ${resp.status}:`, errText);
        this._setStatus(`Error ${resp.status}`);
      }
    } catch (err) {
      console.error("[LoRA Notes] save exception:", err);
      this._setStatus("Save failed");
    }
  }
}

