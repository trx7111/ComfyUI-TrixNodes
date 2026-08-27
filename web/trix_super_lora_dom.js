/**
 * Trix NDSuper LoRA Loader — Nodes 2.0 (Vue) & Nodes 1.0 (Legacy) Universal DOM Renderer
 * Based on Pixaroma Architecture & Nodes 2.0 Standard
 */

import { app } from "/scripts/app.js";
import { LoraNotesDrawer } from "./lora_notes_drawer.js";
import { openLoraSettingsDrawer } from "./lora_settings_drawer.js";

// =========================================================================
// 1. NODES 2.0 COMPATIBILITY HELPERS (Pixaroma Gold Standard)
// =========================================================================

export function isVueNodes() {
  return !!(
    window.LiteGraph?.vueNodesMode ||
    app.canvas?.vueNodesMode ||
    (typeof LGraphCanvas !== "undefined" && LGraphCanvas.vueNodesMode)
  );
}

export function applyAdaptiveCanvasOnly(widget) {
  if (!widget || !widget.options) return widget;
  try {
    Object.defineProperty(widget.options, "canvasOnly", {
      configurable: true,
      enumerable: true,
      get() {
        return !isVueNodes();
      },
    });
  } catch (_e) {
    widget.options.canvasOnly = !isVueNodes();
  }
  return widget;
}

export function installResizeFloor(root, measureFn, onRelease) {
  if (!root || typeof measureFn !== "function") return () => {};
  let armed = false;

  const clear = () => {
    if (!armed) return;
    armed = false;
    try { root.style.minHeight = ""; } catch (_e) {}
    if (typeof onRelease === "function") {
      try { onRelease(); } catch (_e) {}
    }
  };

  const onDown = (e) => {
    if (!isVueNodes() || !root.isConnected) return;
    if (e.target?.closest?.(".lg-node-widget")) return;

    let cur = "";
    try { cur = (e.target && window.getComputedStyle(e.target).cursor) || ""; } catch (_e) {}
    if (cur.indexOf("resize") === -1) return;

    const myNode = root.closest(".lg-node");
    const downNode = e.target.closest && e.target.closest(".lg-node");
    if (myNode && downNode && myNode !== downNode) return;

    let h = 0;
    try { h = measureFn(root); } catch (_e) { return; }
    if (!(h > 0)) return;

    try {
      root.style.minHeight = Math.round(h) + "px";
      armed = true;
    } catch (_e) {}
  };

  window.addEventListener("pointerdown", onDown, true);
  window.addEventListener("pointerup", clear, true);
  window.addEventListener("pointercancel", clear, true);

  return () => {
    window.removeEventListener("pointerdown", onDown, true);
    window.removeEventListener("pointerup", clear, true);
    window.removeEventListener("pointercancel", clear, true);
    clear();
  };
}

let _graphLoading = false;
if (app && app.loadGraphData && !app._trixLoraCompatLoadWrapped) {
  app._trixLoraCompatLoadWrapped = true;
  const _origLoadGraphData = app.loadGraphData.bind(app);
  app.loadGraphData = function (...args) {
    _graphLoading = true;
    let r;
    try {
      r = _origLoadGraphData(...args);
    } finally {
      Promise.resolve(r).finally(() => {
        setTimeout(() => { _graphLoading = false; }, 300);
      });
    }
    return r;
  };
}

export function isGraphLoading() {
  return _graphLoading;
}

export function hideJsonWidget(widgets, widgetName) {
  const w = (widgets || []).find((x) => x.name === widgetName);
  if (w) {
    w.hidden = true;
    w.computeSize = () => [0, -4];
    if (!w.options) w.options = {};
    w.options.canvasOnly = true;
    const hideEl = () => {
      const el = w.element || w.inputEl;
      if (el) el.style.display = "none";
    };
    hideEl();
    requestAnimationFrame(hideEl);
  }
  return w;
}

export function gateResizeAndDraw(nodeType, minW, minH) {
  const origOnResize = nodeType.prototype.onResize;
  nodeType.prototype.onResize = function (size) {
    if (!isVueNodes()) {
      if (size && Array.isArray(size)) {
        if (size[0] < minW) size[0] = minW;
        if (size[1] < minH) size[1] = minH;
      }
    }
    if (origOnResize) return origOnResize.apply(this, arguments);
  };

  const origDraw = nodeType.prototype.onDrawForeground;
  nodeType.prototype.onDrawForeground = function (ctx) {
    if (origDraw) origDraw.call(this, ctx);
    if (this.flags?.collapsed || isVueNodes()) return;
    if (this.size && Array.isArray(this.size)) {
      if (this.size[0] < minW) this.size[0] = minW;
    }
  };
}

export function installCanvasZoomPassthrough(root) {
  if (!root || typeof root.addEventListener !== "function") return () => {};

  const onWheel = (e) => {
    if (isVueNodes()) return; // Nodes 2.0 handles zoom forwarding natively
    if (e.ctrlKey || e.metaKey) return;

    const canvasEl = app?.canvas?.canvas;
    if (!canvasEl) return;

    e.preventDefault();
    e.stopPropagation();

    const { clientX, clientY, deltaX, deltaY, deltaMode, ctrlKey, metaKey, shiftKey } = e;
    canvasEl.dispatchEvent(new WheelEvent("wheel", {
      clientX, clientY, deltaX, deltaY, deltaMode,
      ctrlKey, metaKey, shiftKey, bubbles: true, cancelable: true,
    }));
  };

  root.addEventListener("wheel", onWheel, { passive: false });
  return () => root.removeEventListener("wheel", onWheel);
}

// Preset palette from Trix Prompt AIO
export const TRIX_PROMPT_PRESET_COLORS = [
  { name: "Blue", color: "#5881AF" },
  { name: "Mint", color: "#009B95" },
  { name: "Green", color: "#90D061" },
  { name: "Orange", color: "#F56D57" },
  { name: "Violet", color: "#8E5AF5" },
  { name: "Pink", color: "#DB5860" },
];

export const TRIX_BUTTON_PALETTE = [
  "#5881AF", "#009B95", "#90D061", "#F56D57", "#8E5AF5", "#DB5860",
  "#3482b5", "#00a896", "#65a30d", "#ea580c", "#7c3aed", "#e11d48",
  "#2ea043", "#f66744", "#8957e5", "#d29922", "#00a3bf", "#6e7681"
];

// Default node settings template
export const DEFAULT_TRIX_SETTINGS = {
  defaultStrength: 1.0,
  strengthStep: 0.05,
  showSeparateStrengths: false,
  triggerWordsSeparator: ", ",
  cacheMode: "last", // "last" (Standard), "all" (Fast), "none" (Lowest)
  hideFileExtension: true,
  showCivitaiLookup: true,
  showNotesButton: true,
  highlightColor: "#5881AF",
  enableTags: true,
  showTagChip: true,
  showMoveArrows: true,
  showTriggerWords: true,
  showStrengthControls: true,
  showRemoveButton: true,
  showOptionsMenu: true,
  autoFetchTriggerWords: false,
};

export function loadSavedDefaults() {
  try {
    const raw = localStorage.getItem("trix_super_lora_defaults");
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return { ...DEFAULT_TRIX_SETTINGS };
}

export function saveGlobalDefaults(settings) {
  try {
    localStorage.setItem("trix_super_lora_defaults", JSON.stringify(settings));
    return true;
  } catch (_) {
    return false;
  }
}

// =========================================================================
// 2. PIXEL-PERFECT ADAPTIVE CSS STYLING
// =========================================================================

const TRIX_LORA_CSS_ID = "trix-super-lora-dom-css";

function injectStyles() {
  if (document.getElementById(TRIX_LORA_CSS_ID)) return;
  const s = document.createElement("style");
  s.id = TRIX_LORA_CSS_ID;
  s.textContent = `
    .trix-nd-root {
      width: 100%;
      min-width: 100%;
      box-sizing: border-box;
      background: transparent;
      color: #ddd;
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
      font-size: 11px;
      user-select: none;
      display: flex;
      flex-direction: column;
      gap: 5px;
      padding: 0 4px 6px 4px;
      overflow: hidden;
      pointer-events: none; /* Allows canvas panning through empty space */
      --trix-acc: #5881AF;
    }

    /* Top Header Bar — Fluid & Fully Responsive */
    .trix-nd-header {
      display: flex;
      align-items: center;
      gap: 4px;
      width: 100%;
      box-sizing: border-box;
      overflow: hidden;
      pointer-events: auto;
    }

    .trix-nd-btn {
      height: 24px;
      padding: 0 6px;
      border-radius: 4px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(255, 255, 255, 0.07);
      color: #d8dade;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 3px;
      white-space: nowrap;
      transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease, filter 0.12s ease;
      outline: none;
      min-width: 22px;
      overflow: hidden;
      box-sizing: border-box;
      flex: 1 1 0px;
      pointer-events: auto;
    }

    /* Standard Button Hover: Accent border & Accent text/icon, NO outer box-shadow glow */
    .trix-nd-btn:hover {
      background: rgba(255, 255, 255, 0.12);
      border-color: var(--trix-acc, #5881AF);
      color: var(--trix-acc, #5881AF);
      box-shadow: none;
    }

    /* Add LoRA Primary Button */
    .trix-nd-btn-primary {
      background: var(--trix-acc, #5881AF);
      border-color: var(--trix-acc, #5881AF);
      color: #ffffff !important;
      font-weight: 600;
      flex: 1.4 1 0px;
      opacity: 0.92;
      box-shadow: none;
    }

    /* Add LoRA Hover: Becomes brighter, NO outer box-shadow glow */
    .trix-nd-btn-primary:hover {
      background: var(--trix-acc, #5881AF) !important;
      border-color: var(--trix-acc, #5881AF) !important;
      color: #ffffff !important;
      opacity: 1;
      filter: brightness(1.25);
      box-shadow: none;
    }

    .trix-nd-btn-icon-only {
      flex: 0 0 24px !important;
      min-width: 24px !important;
      width: 24px !important;
      height: 24px !important;
      padding: 0 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-size: 12px;
    }

    /* Responsive Header Label Modes */
    .trix-nd-root[data-mode="full"] .trix-nd-lbl-short,
    .trix-nd-root[data-mode="full"] .trix-nd-lbl-icon { display: none !important; }
    .trix-nd-root[data-mode="full"] .trix-nd-lbl-full { display: inline-block !important; }

    .trix-nd-root[data-mode="short"] .trix-nd-lbl-full,
    .trix-nd-root[data-mode="short"] .trix-nd-lbl-icon { display: none !important; }
    .trix-nd-root[data-mode="short"] .trix-nd-lbl-short { display: inline-block !important; }

    .trix-nd-root[data-mode="icon"] .trix-nd-lbl-full,
    .trix-nd-root[data-mode="icon"] .trix-nd-lbl-short { display: none !important; }
    .trix-nd-root[data-mode="icon"] .trix-nd-lbl-icon { display: inline-block !important; }

    .trix-nd-btn[data-act="settings"] span,
    .trix-nd-btn[data-act="refreshFiles"] span {
      display: inline-block;
      transition: color 0.15s ease;
    }
    .trix-nd-btn[data-act="settings"]:hover span,
    .trix-nd-btn[data-act="refreshFiles"]:hover span {
      color: var(--trix-acc, #5881AF);
    }

    .trix-nd-trigger-fetch {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 14px !important;
      min-width: 14px !important;
      max-width: 14px !important;
      height: 14px !important;
      min-height: 14px !important;
      flex: 0 0 14px !important;
      flex-shrink: 0 !important;
      line-height: 1 !important;
      text-align: center !important;
      font-size: 12px !important;
      margin-left: 2px;
      cursor: pointer;
      color: var(--trix-acc, #5881AF) !important;
      opacity: 0.9;
      transform-origin: 50% 50% !important;
      box-sizing: border-box !important;
      transition: opacity 0.15s ease, filter 0.15s ease;
      vertical-align: middle;
      overflow: visible !important;
      text-overflow: clip !important;
    }
    .trix-nd-trigger-fetch:hover {
      opacity: 1;
      filter: brightness(1.3);
    }
    .trix-nd-trigger-fetch.fetching {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      transform-origin: 50% 50% !important;
      animation: trix-spin-360 0.65s linear infinite !important;
    }

    .trix-nd-notes-btn {
      transition: background 0.12s, border-color 0.12s, color 0.12s;
    }
    .trix-nd-notes-btn:hover {
      background: rgba(255, 255, 255, 0.12);
      color: #60a5fa;
      border-color: #3b82f6;
    }

    .trix-adv-sparkle {
      display: inline-block;
      animation: trix-sparkle-glow 2.2s ease-in-out infinite;
    }
    @keyframes trix-sparkle-glow {
      0%, 100% { filter: drop-shadow(0 0 2px rgba(250, 204, 21, 0.4)); transform: scale(1); }
      50% { filter: drop-shadow(0 0 7px rgba(250, 204, 21, 0.9)); transform: scale(1.15); }
    }

    .trix-nd-spin-360 {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      transform-origin: 50% 50% !important;
      animation: trix-spin-360 0.65s cubic-bezier(0.4, 0, 0.2, 1) !important;
    }

    @keyframes trix-spin-360 {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    /* Tag Group Accordion */
    .trix-nd-tag-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
      width: 100%;
      box-sizing: border-box;
      pointer-events: auto;
    }

    .trix-nd-tag-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 24px;
      padding: 0 4px 0 2px;
      cursor: pointer;
      color: #c8cbd6;
      font-weight: 600;
      font-size: 11.5px;
      border-radius: 4px;
      transition: background 0.12s, opacity 0.15s;
      pointer-events: auto;
    }

    .trix-nd-tag-header:hover {
      background: rgba(255, 255, 255, 0.04);
      color: #ffffff;
    }

    .trix-nd-tag-header.bypassed {
      opacity: 0.55;
    }

    .trix-nd-tag-left {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
      overflow: hidden;
    }

    .trix-nd-tag-arrow {
      font-size: 9px;
      color: #888;
      width: 12px;
      text-align: center;
      transition: transform 0.18s ease;
      flex: 0 0 12px;
    }

    .trix-nd-tag-header.collapsed .trix-nd-tag-arrow {
      transform: rotate(-90deg);
    }

    .trix-nd-tag-title {
      letter-spacing: 0.2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .trix-nd-tag-count {
      color: #727582;
      font-size: 11px;
      font-weight: 400;
      flex: 0 0 auto;
    }

    .trix-nd-tag-content {
      display: flex;
      flex-direction: column;
      gap: 4px;
      width: 100%;
      box-sizing: border-box;
      pointer-events: auto;
    }

    .trix-nd-tag-content.collapsed {
      display: none;
    }

    /* LoRA Row — Fluid and Constrained */
    .trix-nd-row {
      display: flex;
      align-items: center;
      gap: 5px;
      height: 32px;
      background: #191a20;
      border: 1px solid #272832;
      border-radius: 5px;
      padding: 0 5px;
      box-sizing: border-box;
      width: 100%;
      overflow: hidden;
      pointer-events: auto;
      transition: background 0.12s, border-color 0.12s, opacity 0.15s;
    }

    .trix-nd-row:hover {
      background: #1d1e26;
      border-color: #353744;
    }

    .trix-nd-row.disabled {
      opacity: 0.45;
    }

    .trix-nd-row.bypassed {
      opacity: 0.45;
    }

    .trix-nd-row.dragging {
      opacity: 0.35;
      background: #252835;
      border-style: dashed;
    }

    .trix-nd-row.drag-over-top {
      border-top: 2px solid var(--trix-acc, #5881AF);
    }

    .trix-nd-row.drag-over-bottom {
      border-bottom: 2px solid var(--trix-acc, #5881AF);
    }

    /* Drag Handle ⠿ */
    .trix-nd-drag-handle {
      color: #585b6a;
      font-size: 11px;
      cursor: grab;
      flex: 0 0 auto;
      padding: 0 1px;
      line-height: 1;
      display: flex;
      align-items: center;
      transition: color 0.12s;
    }

    .trix-nd-drag-handle:hover {
      color: #a0a4b6;
    }

    /* Toggle Switch (Pill) */
    .trix-nd-switch {
      width: 26px;
      height: 15px;
      background: #2b2c36;
      border-radius: 10px;
      position: relative;
      cursor: pointer;
      flex: 0 0 26px;
      transition: background 0.15s ease;
    }

    .trix-nd-switch.active {
      background: var(--trix-acc, #5881AF);
    }

    .trix-nd-switch-thumb {
      width: 11px;
      height: 11px;
      background: #ffffff;
      border-radius: 50%;
      position: absolute;
      top: 2px;
      left: 2px;
      transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
    }

    .trix-nd-switch.active .trix-nd-switch-thumb {
      transform: translateX(11px);
    }

    /* Tag Chip Badge */
    .trix-nd-tag-chip {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 3px;
      color: #9296a6;
      font-size: 9.5px;
      padding: 1px 4px;
      white-space: nowrap;
      flex: 0 0 auto;
      cursor: pointer;
      max-width: 65px;
      overflow: hidden;
      text-overflow: ellipsis;
      transition: border-color 0.12s, color 0.12s;
    }

    .trix-nd-tag-chip:hover {
      border-color: var(--trix-acc, #5881AF);
      color: var(--trix-acc, #5881AF);
    }

    /* File Name Box — Click to Replace LoRA */
    .trix-nd-name-box {
      flex: 1 1 50px;
      min-width: 30px;
      height: 22px;
      display: flex;
      align-items: center;
      cursor: pointer;
      overflow: hidden;
    }

    .trix-nd-file-name {
      color: #d8dade;
      font-size: 11px;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1 1 auto;
      min-width: 0;
      transition: color 0.15s, text-shadow 0.15s;
    }

    .trix-nd-file-name.has-schedule {
      color: #facc15 !important;
      font-weight: 600;
      text-shadow: 0 0 8px rgba(250, 204, 21, 0.4);
    }

    .trix-nd-name-box:hover .trix-nd-file-name {
      color: #ffffff;
      text-decoration: underline;
    }

    .trix-nd-name-box:hover .trix-nd-file-name.has-schedule {
      color: #fde047 !important;
      text-decoration: underline;
      text-shadow: 0 0 12px rgba(250, 204, 21, 0.65);
    }

    /* Trigger Words Button */
    .trix-nd-trigger-btn {
      height: 22px;
      padding: 0 6px;
      background: #141419;
      border: 1px solid #282834;
      border-radius: 4px;
      color: #7d8090;
      font-size: 10px;
      display: flex;
      align-items: center;
      gap: 3px;
      cursor: pointer;
      white-space: nowrap;
      max-width: 125px;
      min-width: 0;
      overflow: hidden;
      flex: 0 1 auto;
      transition: border-color 0.12s, color 0.12s;
    }

    .trix-nd-trigger-btn .trix-nd-trigger-text,
    .trix-nd-trigger-btn span:not(.trix-nd-trigger-fetch) {
      flex: 1 1 auto;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
    }

    .trix-nd-trigger-btn:hover {
      border-color: var(--trix-acc, #5881AF);
      color: var(--trix-acc, #5881AF);
    }

    .trix-nd-trigger-btn.has-trigger {
      color: #c4c7d6;
      border-color: #384252;
    }

    /* Stepper & Weight Input */
    .trix-nd-weight-wrap {
      display: flex;
      align-items: center;
      height: 22px;
      background: #141419;
      border: 1px solid #282834;
      border-radius: 4px;
      overflow: hidden;
      flex: 0 0 auto;
    }

    .trix-nd-weight-label {
      font-size: 9px;
      font-weight: 700;
      color: #727584;
      padding: 0 3px;
      background: rgba(255, 255, 255, 0.04);
      height: 100%;
      display: flex;
      align-items: center;
      border-right: 1px solid #242430;
    }

    .trix-nd-step-btn {
      width: 17px;
      height: 100%;
      background: transparent;
      border: none;
      color: #8c8f9f;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.1s, color 0.1s;
      outline: none;
      padding: 0;
    }

    .trix-nd-step-btn:hover {
      background: rgba(255, 255, 255, 0.08);
      color: var(--trix-acc, #5881AF);
    }

    .trix-nd-weight-input {
      width: 40px;
      height: 100%;
      background: transparent;
      border: none;
      border-left: 1px solid #242430;
      border-right: 1px solid #242430;
      color: #ffffff;
      font-family: 'SFMono-Regular', Consolas, monospace;
      font-size: 11px;
      text-align: center;
      outline: none;
      padding: 0;
      box-sizing: border-box;
    }

    .trix-nd-weight-wrap.active-val {
      background: #20242e;
      border-color: var(--trix-acc, #5881AF);
    }

    .trix-nd-weight-wrap.active-val .trix-nd-weight-input {
      border-color: #2b3240;
      color: #ffffff;
    }

    /* Notes Button ✍︎ */
    .trix-nd-notes-btn {
      width: 22px;
      height: 22px;
      border-radius: 4px;
      border: 1px solid #282834;
      background: #141419;
      color: #727584;
      font-size: 11px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 22px;
      transition: background 0.12s, border-color 0.12s, color 0.12s;
      padding: 0;
    }

    .trix-nd-notes-btn:hover {
      background: rgba(255, 255, 255, 0.08);
      color: var(--trix-acc, #5881AF);
      border-color: var(--trix-acc, #5881AF);
    }

    .trix-nd-notes-btn.has-notes {
      background: #141419;
      border: 1px solid #282834;
      color: #9da0b2;
      box-shadow: 0 0 6px var(--trix-acc, #5881AF);
    }

    .trix-nd-notes-btn.has-notes:hover {
      background: rgba(255, 255, 255, 0.08);
      color: var(--trix-acc, #5881AF);
      border-color: var(--trix-acc, #5881AF);
      box-shadow: 0 0 8px var(--trix-acc, #5881AF);
    }

    /* Direct Remove Button ✕ */
    .trix-nd-remove-btn {
      width: 18px;
      height: 22px;
      border-radius: 3px;
      border: none;
      background: transparent;
      color: #5c5f6e;
      font-size: 11px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 18px;
      transition: background 0.12s, color 0.12s;
      padding: 0;
    }

    .trix-nd-remove-btn:hover {
      background: rgba(220, 60, 60, 0.25);
      color: #ff6b6b;
    }

    /* Row Context Menu ⋮ */
    .trix-nd-opts-btn {
      width: 16px;
      height: 22px;
      color: #636676;
      font-size: 13px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 16px;
      transition: color 0.12s;
    }

    .trix-nd-opts-btn:hover {
      color: #ffffff;
    }

    /* Floating Context Menu */
    .trix-nd-menu {
      position: fixed;
      z-index: 10050;
      width: 180px;
      background: #18181e;
      border: 1px solid #2e2e3a;
      border-radius: 7px;
      box-shadow: 0 12px 35px rgba(0, 0, 0, 0.7);
      overflow: hidden;
      font-family: 'Segoe UI', system-ui, sans-serif;
      font-size: 11.5px;
      color: #d4d7e2;
      padding: 4px 0;
      pointer-events: auto;
    }

    .trix-nd-menu-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      cursor: pointer;
      transition: background 0.12s, color 0.12s;
    }

    .trix-nd-menu-item:hover {
      background: var(--trix-acc, #5881AF);
      color: #ffffff;
    }

    .trix-nd-menu-item.danger:hover {
      background: #d94848;
      color: #ffffff;
    }

    .trix-nd-menu-item.disabled {
      opacity: 0.35;
      pointer-events: none;
    }

    .trix-nd-menu-icon {
      width: 14px;
      text-align: center;
      color: #838798;
    }

    .trix-nd-menu-item:hover .trix-nd-menu-icon {
      color: #ffffff;
    }

    .trix-nd-menu-sep {
      height: 1px;
      background: #242430;
      margin: 3px 0;
    }

    /* =========================================================================
       PIXAROMA-STYLE SETTINGS MODAL PANEL
       ========================================================================= */
    .trix-llp {
      position: fixed;
      z-index: 10050;
      width: 360px;
      max-width: 95vw;
      max-height: 82vh;
      background: #18191e;
      border: 1px solid #3c3e4c;
      border-radius: 10px;
      box-shadow: 0 18px 50px rgba(0, 0, 0, 0.75);
      color: #d8d8d8;
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      font-size: 12px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .trix-llp-t {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      background: #202128;
      border-bottom: 1px solid #2d2e38;
      cursor: grab;
      user-select: none;
      color: var(--trix-acc, #5881AF);
      font-weight: 600;
      font-size: 12.5px;
      flex: 0 0 auto;
    }

    .trix-llp-t:active {
      cursor: grabbing;
    }

    .trix-llp-t .x {
      margin-left: auto;
      color: #8a8a8a;
      cursor: pointer;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 13px;
      line-height: 1;
      transition: color 0.12s, background 0.12s;
    }

    .trix-llp-t .x:hover {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.1);
    }

    .trix-llp-b {
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      flex: 1 1 auto;
      overflow-y: auto !important;
      overflow-x: hidden !important;
      min-height: 0;
      max-height: calc(82vh - 95px);
      scrollbar-width: thin;
      scrollbar-color: #4a4d60 #1e2028;
      box-sizing: border-box;
    }

    .trix-llp-b::-webkit-scrollbar {
      width: 6px;
    }

    .trix-llp-b::-webkit-scrollbar-track {
      background: #1e2028;
      border-radius: 3px;
    }

    .trix-llp-b::-webkit-scrollbar-thumb {
      background: #4a4d60;
      border-radius: 3px;
    }

    .trix-llp-b::-webkit-scrollbar-thumb:hover {
      background: var(--trix-acc, #5881AF);
    }

    .trix-llp-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex: 0 0 auto;
    }

    .trix-llp-row .lab {
      flex: 1 1 auto;
      color: #c8cbd6;
      font-size: 12px;
      font-weight: 500;
    }

    .trix-llp-row .hint {
      display: block;
      font-size: 10px;
      color: #7a7e8e;
      margin-top: 2px;
      font-weight: 400;
      line-height: 1.25;
    }

    .trix-llp-num {
      width: 72px;
      box-sizing: border-box;
      background: #121317;
      border: 1px solid #3c3e4c;
      border-radius: 6px;
      color: #ffffff;
      text-align: center;
      font-family: 'SFMono-Regular', Consolas, monospace;
      font-size: 12px;
      padding: 5px 6px;
      outline: none;
      transition: border-color 0.12s;
    }

    .trix-llp-num:focus {
      border-color: var(--trix-acc, #5881AF);
    }

    .trix-llp-txt {
      width: 72px;
      box-sizing: border-box;
      background: #121317;
      border: 1px solid #3c3e4c;
      border-radius: 6px;
      color: #ffffff;
      text-align: center;
      font-family: 'SFMono-Regular', Consolas, monospace;
      font-size: 12px;
      padding: 5px 6px;
      outline: none;
      transition: border-color 0.12s;
    }

    .trix-llp-txt:focus {
      border-color: var(--trix-acc, #5881AF);
    }

    .trix-llp-sw {
      flex: 0 0 36px;
      width: 36px;
      height: 19px;
      border-radius: 99px;
      background: #2b2c36;
      position: relative;
      cursor: pointer;
      border: 1px solid rgba(0, 0, 0, 0.4);
      transition: background 0.15s ease;
    }

    .trix-llp-sw::after {
      content: "";
      position: absolute;
      top: 1.5px;
      left: 2px;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #8e92a2;
      transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), background 0.15s;
      box-shadow: 0 1px 3px rgba(0,0,0,0.4);
    }

    .trix-llp-sw.on {
      background: var(--trix-acc, #5881AF);
    }

    .trix-llp-sw.on::after {
      transform: translateX(16px);
      background: #ffffff;
    }

    .trix-llp-seg {
      flex: 0 0 auto;
      display: flex;
      background: #121317;
      border: 1px solid #383a48;
      border-radius: 6px;
      overflow: hidden;
    }

    .trix-llp-segb {
      padding: 4px 9px;
      font-size: 11px;
      font-weight: 500;
      color: #8c8f9f;
      cursor: pointer;
      user-select: none;
      transition: background 0.12s, color 0.12s;
    }

    .trix-llp-segb:hover {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.08);
    }

    .trix-llp-segb.on {
      background: var(--trix-acc, #5881AF);
      color: #ffffff;
      font-weight: 600;
    }

    /* Accent Color Row with Pills from Trix Prompt AIO (Single Row) */
    .trix-llp-acc-block {
      display: flex;
      flex-direction: column;
      gap: 5px;
      padding: 2px 0 4px 0;
      width: 100%;
      box-sizing: border-box;
      overflow: hidden;
      flex: 0 0 auto;
    }

    .trix-llp-acc-title {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
      color: var(--trix-acc, #5881AF);
      display: flex;
      align-items: center;
      gap: 4px;
      text-transform: uppercase;
    }

    .trix-llp-acc-row {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-wrap: nowrap;
      width: 100%;
      box-sizing: border-box;
      overflow: hidden;
    }

    .trix-llp-acc-swatch {
      width: 22px;
      height: 20px;
      border-radius: 4px;
      border: 1px solid rgba(255, 255, 255, 0.4);
      cursor: pointer;
      flex: 0 0 22px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.5);
      transition: transform 0.1s, border-color 0.12s;
      box-sizing: border-box;
      position: relative;
    }

    .trix-llp-acc-swatch:hover {
      transform: scale(1.06);
      border-color: #ffffff;
    }

    .trix-llp-acc-pill {
      height: 20px;
      padding: 0 3px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      color: #ffffff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      user-select: none;
      flex: 1 1 0px;
      min-width: 0;
      white-space: nowrap;
      transition: transform 0.1s, filter 0.12s, box-shadow 0.12s;
      border: 1px solid rgba(0,0,0,0.25);
      box-sizing: border-box;
    }

    .trix-llp-acc-pill:hover {
      transform: scale(1.04);
      filter: brightness(1.15);
    }

    .trix-llp-acc-pill.active {
      box-shadow: 0 0 0 2px #ffffff;
      outline: 1px solid rgba(0,0,0,0.4);
      z-index: 1;
    }

    .trix-llp-section-hdr {
      font-size: 10.5px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #727584;
      font-weight: 700;
      padding-top: 6px;
      border-top: 1px solid #282934;
      margin-top: 2px;
      flex: 0 0 auto;
    }

    .trix-llp-f {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      border-top: 1px solid #2d2e38;
      background: #202128;
      flex: 0 0 auto;
    }

    .trix-llp-btn {
      border: 1px solid #3e4152;
      background: rgba(255, 255, 255, 0.05);
      color: #d8dade;
      border-radius: 5px;
      padding: 5px 12px;
      font-size: 11.5px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.12s, border-color 0.12s, color 0.12s;
    }

    .trix-llp-btn:hover {
      border-color: var(--trix-acc, #5881AF);
      color: var(--trix-acc, #5881AF);
      background: rgba(255, 255, 255, 0.1);
    }

    .trix-llp-push {
      margin-left: auto;
      background: var(--trix-acc, #5881AF);
      border-color: var(--trix-acc, #5881AF);
      color: #ffffff !important;
      font-weight: 600;
    }

    .trix-llp-push:hover {
      filter: brightness(1.15);
    }
  `;
  document.head.appendChild(s);
}

// =========================================================================
// 3. PIXAROMA-STYLE COLOR PICKER & SETTINGS MODAL CONTROLLER
// =========================================================================

let _activeSettingsPanel = null;

export function closeSuperLoraSettingsPanel() {
  if (_activeSettingsPanel) {
    try { _activeSettingsPanel.remove(); } catch (_) {}
    _activeSettingsPanel = null;
  }
}

export function openSuperLoraSettingsPanel(node, refreshCallback) {
  closeSuperLoraSettingsPanel();
  injectStyles();

  if (!node.properties) node.properties = {};
  const defaults = loadSavedDefaults();
  for (const [k, v] of Object.entries(defaults)) {
    if (node.properties[k] === undefined) {
      node.properties[k] = v;
    }
  }

  const panel = document.createElement("div");
  panel.className = "trix-llp";
  const accColor = node.properties.highlightColor || "#5881AF";
  panel.style.setProperty("--trix-acc", accColor);

  // Stop propagation on wheel events so ComfyUI canvas does not intercept scroll
  panel.addEventListener("wheel", (e) => {
    e.stopPropagation();
  }, { passive: true });

  // 1. Title Bar (Draggable)
  const titleBar = document.createElement("div");
  titleBar.className = "trix-llp-t";
  titleBar.innerHTML = `
    <span>⚙</span>
    <span>LoRA Loader settings</span>
    <span class="x" title="Close">✕</span>
  `;
  titleBar.querySelector(".x").onclick = closeSuperLoraSettingsPanel;
  panel.appendChild(titleBar);

  // 2. Body
  const body = document.createElement("div");
  body.className = "trix-llp-b";

  body.addEventListener("wheel", (e) => {
    e.stopPropagation();
  }, { passive: true });

  const fireChange = () => {
    const col = node.properties.highlightColor || "#5881AF";
    panel.style.setProperty("--trix-acc", col);
    if (node._trixDomRoot) {
      node._trixDomRoot.style.setProperty("--trix-acc", col);
    }
    refreshCallback?.(false);
  };

  // Helper: Number input row
  const createNumRow = (label, key, { min = 0, step = 0.01, hint = "" } = {}) => {
    const row = document.createElement("div");
    row.className = "trix-llp-row";
    row.innerHTML = `
      <div class="lab">
        <span>${label}</span>
        ${hint ? `<span class="hint">${hint}</span>` : ""}
      </div>
      <input type="text" class="trix-llp-num" value="${node.properties[key] ?? 1.0}" />
    `;
    const input = row.querySelector("input");
    input.onkeydown = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "Enter" || e.keyCode === 13)) {
        input.blur();
        return;
      }
      e.stopPropagation();
    };
    input.onchange = () => {
      let val = parseFloat(input.value);
      if (isNaN(val)) val = defaults[key] ?? 1.0;
      if (val < min) val = min;
      node.properties[key] = val;
      input.value = String(val);
      fireChange();
    };
    return row;
  };

  // Helper: Text input row
  const createTxtRow = (label, key, { hint = "", placeholder = "" } = {}) => {
    const row = document.createElement("div");
    row.className = "trix-llp-row";
    row.innerHTML = `
      <div class="lab">
        <span>${label}</span>
        ${hint ? `<span class="hint">${hint}</span>` : ""}
      </div>
      <input type="text" class="trix-llp-txt" placeholder="${placeholder}" value="${node.properties[key] ?? ""}" />
    `;
    const input = row.querySelector("input");
    input.onkeydown = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "Enter" || e.keyCode === 13)) {
        input.blur();
        return;
      }
      e.stopPropagation();
    };
    input.onchange = () => {
      node.properties[key] = input.value;
      fireChange();
    };
    return row;
  };

  // Helper: Toggle switch row
  const createToggleRow = (label, key, { hint = "", onToggle = null } = {}) => {
    const row = document.createElement("div");
    row.className = "trix-llp-row";
    const isChecked = node.properties[key] !== false;
    row.innerHTML = `
      <div class="lab">
        <span>${label}</span>
        ${hint ? `<span class="hint">${hint}</span>` : ""}
      </div>
      <div class="trix-llp-sw ${isChecked ? "on" : ""}" title="Toggle"></div>
    `;
    const sw = row.querySelector(".trix-llp-sw");
    sw.onclick = (e) => {
      e.stopPropagation();
      const next = !sw.classList.contains("on");
      sw.classList.toggle("on", next);
      node.properties[key] = next;
      if (onToggle) onToggle(next);
      fireChange();
    };
    return row;
  };

  // Helper: Segmented Buttons Row
  const createSegRow = (label, key, options) => {
    const row = document.createElement("div");
    row.className = "trix-llp-row";
    const curVal = node.properties[key] || options[0].v;
    const curOpt = options.find((x) => x.v === curVal) || options[0];

    row.innerHTML = `
      <div class="lab">
        <span>${label}</span>
        <span class="hint">${curOpt.hint || ""}</span>
      </div>
      <div class="trix-llp-seg"></div>
    `;

    const hintEl = row.querySelector(".hint");
    const segWrap = row.querySelector(".trix-llp-seg");

    for (const opt of options) {
      const btn = document.createElement("div");
      btn.className = `trix-llp-segb ${opt.v === curVal ? "on" : ""}`;
      btn.textContent = opt.label;
      btn.title = opt.title || "";
      btn.onclick = (e) => {
        e.stopPropagation();
        node.properties[key] = opt.v;
        hintEl.textContent = opt.hint || "";
        segWrap.querySelectorAll(".trix-llp-segb").forEach((b) => b.classList.remove("on"));
        btn.classList.add("on");
        fireChange();
      };
      segWrap.appendChild(btn);
    }
    return row;
  };

  // --- 1. ACCENT COLOR (Top of settings body) ---
  const accBlock = document.createElement("div");
  accBlock.className = "trix-llp-acc-block";
  accBlock.innerHTML = `
    <div class="trix-llp-acc-title">✿ ACCENT COLOR</div>
    <div class="trix-llp-acc-row">
      <div class="trix-llp-acc-swatch" style="background: ${node.properties.highlightColor || '#5881AF'}" title="Pick custom color / spectrum palette"></div>
    </div>
  `;

  const accRowEl = accBlock.querySelector(".trix-llp-acc-row");
  const swatchEl = accBlock.querySelector(".trix-llp-acc-swatch");

  // Invisible Native HTML5 Spectrum Color Picker Input
  const nativeColorInput = document.createElement("input");
  nativeColorInput.type = "color";
  nativeColorInput.style.position = "absolute";
  nativeColorInput.style.opacity = "0";
  nativeColorInput.style.pointerEvents = "none";
  nativeColorInput.style.width = "0";
  nativeColorInput.style.height = "0";
  swatchEl.appendChild(nativeColorInput);

  const normalizeHex = (hex) => {
    if (!hex) return "#5881af";
    let h = hex.trim();
    if (!h.startsWith("#")) h = "#" + h;
    if (h.length === 4) {
      h = "#" + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
    }
    return h.slice(0, 7);
  };

  nativeColorInput.value = normalizeHex(node.properties.highlightColor || "#5881af");

  const updateActivePills = (color) => {
    swatchEl.style.background = color;
    nativeColorInput.value = normalizeHex(color);
    accBlock.querySelectorAll(".trix-llp-acc-pill").forEach((pill) => {
      pill.classList.toggle("active", pill.dataset.color.toLowerCase() === color.toLowerCase());
    });
  };

  const handleColorPicked = (newCol) => {
    node.properties.highlightColor = newCol;
    updateActivePills(newCol);
    fireChange();
  };

  nativeColorInput.addEventListener("input", (e) => {
    handleColorPicked(e.target.value);
  });

  nativeColorInput.addEventListener("change", (e) => {
    handleColorPicked(e.target.value);
  });

  swatchEl.onclick = (e) => {
    e.stopPropagation();
    nativeColorInput.value = normalizeHex(node.properties.highlightColor || "#5881af");
    if (typeof nativeColorInput.showPicker === "function") {
      try {
        nativeColorInput.showPicker();
      } catch (_) {
        nativeColorInput.click();
      }
    } else {
      nativeColorInput.click();
    }
  };

  for (const preset of TRIX_PROMPT_PRESET_COLORS) {
    const pill = document.createElement("div");
    const isAct = (node.properties.highlightColor || "").toLowerCase() === preset.color.toLowerCase();
    pill.className = `trix-llp-acc-pill ${isAct ? "active" : ""}`;
    pill.style.setProperty("background-color", preset.color, "important");
    pill.style.color = "#ffffff";
    pill.textContent = preset.name;
    pill.dataset.color = preset.color;
    pill.onclick = (e) => {
      e.stopPropagation();
      handleColorPicked(preset.color);
    };
    accRowEl.appendChild(pill);
  }
  body.appendChild(accBlock);

  // --- 2. Default strength ---
  body.appendChild(createNumRow("Default strength (new LoRAs) (⛃)", "defaultStrength", {
    min: -10,
    hint: "Initial strength applied when adding a new LoRA",
  }));

  // --- 3. Strength step ---
  body.appendChild(createNumRow("Strength step (arrows) (⇆)", "strengthStep", {
    min: 0.001,
    hint: "Increment/decrement step for + / - stepper buttons",
  }));

  // --- 4. Separate Model / CLIP strength ---
  body.appendChild(createToggleRow("Separate model / clip strength (M / C)", "showSeparateStrengths", {
    hint: "Show two strengths per row (Model / CLIP)",
    onToggle: (enabling) => {
      const widgets = (node.customWidgets || []).filter((w) => w.constructor?.name === "SuperLoraWidget");
      widgets.forEach((w) => {
        const m = parseFloat(w.value?.strength ?? 1) || 1;
        if (enabling) {
          w.value.strengthClip = typeof w.value?.strengthClip === "number" ? w.value.strengthClip : m;
        } else {
          w.value.strength = m;
          w.value.strengthClip = m;
        }
      });
    }
  }));

  // --- 5. Trigger words separator ---
  body.appendChild(createTxtRow("Trigger words separator ( ⎵ )", "triggerWordsSeparator", {
    placeholder: ", ",
    hint: "String used when joining trigger words in outputs",
  }));

  // --- 6. LoRA memory use (Standard / Fast / Lowest) ---
  body.appendChild(createSegRow("LoRA memory use (⬡)", "cacheMode", [
    { v: "last", label: "Standard", hint: "Keeps the last used LoRA in memory, like ComfyUI", title: "Balanced: 1 LoRA stays loaded" },
    { v: "all", label: "Fast", hint: "Keeps the whole stack in memory for quick re-runs", title: "Fastest re-runs; holds memory" },
    { v: "none", label: "Lowest", hint: "Re-reads the files on every run", title: "Smallest memory footprint" },
  ]));

  // --- 7. Hide file extension ---
  body.appendChild(createToggleRow("Hide file extension ( .safetensors )", "hideFileExtension", {
    hint: "Show the LoRA name without .safetensors",
  }));

  // --- 8. Civitai lookup button ---
  body.appendChild(createToggleRow("Civitai lookup button (ꔮ)", "showCivitaiLookup", {
    hint: "Show the optional online lookup in the info panel / trigger button",
  }));

  // --- 9. Show note button ---
  body.appendChild(createToggleRow("Show note button (✍︎)", "showNotesButton", {
    hint: "Notes & Reference preview images drawer (✍︎)",
  }));

  // --- 10. UI Buttons & Controls Visibility Section ---
  const sectionHdr = document.createElement("div");
  sectionHdr.className = "trix-llp-section-hdr";
  sectionHdr.textContent = "Button & Element Visibility";
  body.appendChild(sectionHdr);

  body.appendChild(createToggleRow("Enable Tag Groups (🗁)", "enableTags", {
    hint: "Group LoRAs into collapsible tag folders",
  }));
  body.appendChild(createToggleRow("Show Tag Chip (❖)", "showTagChip", {
    hint: "Show tag badge on each LoRA row",
  }));
  body.appendChild(createToggleRow("Show Drag Handles (⠿)", "showMoveArrows", {
    hint: "Display handle for Drag & Drop reordering",
  }));
  body.appendChild(createToggleRow("Show Trigger Words (ꔮ)", "showTriggerWords", {
    hint: "Display trigger words button on rows",
  }));
  body.appendChild(createToggleRow("Show Strength Controls (⇆)", "showStrengthControls", {
    hint: "Display stepper and weight input box",
  }));
  body.appendChild(createToggleRow("Show Remove Button (✖︎)", "showRemoveButton", {
    hint: "Direct single-click remove button",
  }));
  body.appendChild(createToggleRow("Show Options Menu (⫶)", "showOptionsMenu", {
    hint: "Display context menu button on each LoRA row",
  }));
  body.appendChild(createToggleRow("Auto-fetch Civitai Triggers (⏱︎)", "autoFetchTriggerWords", {
    hint: "Automatically look up trigger words for newly added LoRAs",
  }));

  panel.appendChild(body);

  // 3. Footer Bar
  const footer = document.createElement("div");
  footer.className = "trix-llp-f";

  const btnResetDefault = document.createElement("button");
  btnResetDefault.className = "trix-llp-btn";
  btnResetDefault.textContent = "Reset to default";
  btnResetDefault.title = "Reset all settings to original defaults";
  btnResetDefault.onclick = () => {
    Object.assign(node.properties, DEFAULT_TRIX_SETTINGS);
    saveGlobalDefaults(DEFAULT_TRIX_SETTINGS);
    btnResetDefault.textContent = "✓ Reset to default";
    setTimeout(() => { btnResetDefault.textContent = "Reset to default"; }, 1500);
    // Reopen settings panel with fresh default values
    openSuperLoraSettingsPanel(node, refreshCallback);
    fireChange();
  };

  const btnDone = document.createElement("button");
  btnDone.className = "trix-llp-btn trix-llp-push";
  btnDone.textContent = "Done";
  btnDone.onclick = closeSuperLoraSettingsPanel;

  footer.appendChild(btnResetDefault);
  footer.appendChild(btnDone);
  panel.appendChild(footer);

  document.body.appendChild(panel);

  // Ensure scroll is at the very top on open
  requestAnimationFrame(() => {
    body.scrollTop = 0;
  });

  // Geometry Placement Beside Node
  const placeBesideNode = () => {
    let r = null;
    if (node.id != null) {
      const e = document.querySelector(`[data-node-id="${node.id}"]`);
      if (e) r = e.getBoundingClientRect();
    }
    if (!r && app?.canvas?.canvas && node.pos && node.size) {
      const ds = app.canvas.ds || { scale: 1, offset: [0, 0] };
      const cr = app.canvas.canvas.getBoundingClientRect();
      const sc = ds.scale || 1;
      const off = ds.offset || [0, 0];
      const left = cr.left + (node.pos[0] + off[0]) * sc;
      const top = cr.top + (node.pos[1] + off[1]) * sc;
      r = { left, top, right: left + node.size[0] * sc, bottom: top + node.size[1] * sc };
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pw = panel.offsetWidth || 360;
    const ph = panel.offsetHeight || 500;

    if (!r) {
      panel.style.left = `${Math.max(10, (vw - pw) / 2)}px`;
      panel.style.top = `${Math.max(10, (vh - ph) / 2)}px`;
      return;
    }

    let left = r.right + 12;
    if (left + pw > vw - 10) left = r.left - pw - 12;
    if (left < 10) left = Math.max(10, vw - pw - 10);

    let top = Math.min(r.top, vh - ph - 10);
    panel.style.left = `${Math.max(10, left)}px`;
    panel.style.top = `${Math.max(10, top)}px`;
  };

  placeBesideNode();

  // Draggable Handler
  titleBar.onpointerdown = (e) => {
    if (e.target.closest(".x")) return;
    e.preventDefault();
    const rect = panel.getBoundingClientRect();
    const ox = e.clientX - rect.left;
    const oy = e.clientY - rect.top;

    const onMove = (ev) => {
      panel.style.left = `${Math.max(0, Math.min(window.innerWidth - panel.offsetWidth, ev.clientX - ox))}px`;
      panel.style.top = `${Math.max(0, Math.min(window.innerHeight - panel.offsetHeight, ev.clientY - oy))}px`;
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
    };
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
  };

  // Close on Outside Click or Escape
  const onOutside = (e) => {
    if (!_activeSettingsPanel) return;
    if (_activeSettingsPanel.contains(e.target)) return;
    closeSuperLoraSettingsPanel();
    document.removeEventListener("pointerdown", onOutside, true);
  };
  const onEsc = (e) => {
    if (e.key === "Escape") {
      closeSuperLoraSettingsPanel();
      document.removeEventListener("keydown", onEsc, true);
    }
  };

  setTimeout(() => {
    document.addEventListener("pointerdown", onOutside, true);
    document.addEventListener("keydown", onEsc, true);
  }, 0);

  _activeSettingsPanel = panel;
}

// =========================================================================
// 4. SUPER LORA DOM RENDERER CLASS
// =========================================================================

let _activeMenu = null;
let _activeMenuCleanup = null;

export function closeActiveMenu() {
  if (_activeMenuCleanup) {
    try { _activeMenuCleanup(); } catch (_) {}
  }
  _activeMenuCleanup = null;
  if (_activeMenu) {
    try { _activeMenu.remove(); } catch (_) {}
  }
  _activeMenu = null;
}

export class SuperLoraDOMRenderer {
  /**
   * Mounts the DOM widget onto the node
   */
  static mount(node, widgetApi) {
    injectStyles();

    if (node._trixDomRoot) {
      this.render(node, widgetApi, false);
      return node._trixDomWidget;
    }

    // Initialize node properties from saved defaults if missing
    if (!node.properties) node.properties = {};
    const defaults = loadSavedDefaults();
    for (const [k, v] of Object.entries(defaults)) {
      if (node.properties[k] === undefined) {
        node.properties[k] = v;
      }
    }

    const root = document.createElement("div");
    root.className = "trix-nd-root";
    root.dataset.mode = "full";
    root.style.setProperty("--trix-acc", node.properties.highlightColor || "#5881AF");
    node._trixDomRoot = root;
    node._trixWidgetApi = widgetApi;

    // Responsive width observer for smart header labels
    const updateMode = (w) => {
      // Degrade to short under 410px, to icon under 320px
      const newMode = w >= 410 ? "full" : (w >= 320 ? "short" : "icon");
      if (root.dataset.mode !== newMode) {
        root.dataset.mode = newMode;
      }
    };

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        updateMode(entry.contentRect.width);
      }
    });
    ro.observe(root);
    node._trixResizeObs = ro;

    installCanvasZoomPassthrough(root);

    // Register DOM Widget with UNIQUE TYPE (Rule #2)
    const widget = node.addDOMWidget("loras_dom_ui", "trix_super_lora_loader_dom_widget", root, {
      getValue: () => {
        try {
          return window.SuperLoraNode?.serializeCustomWidgets?.(node);
        } catch (_) {
          return null;
        }
      },
      setValue: () => {},
      getMinHeight: () => this.calculateHeight(node),
      margin: 4,
      serialize: false,
    });

    // Pixaroma Standard: computeLayoutSize and computeSize preserve current node width
    widget.computeSize = (w) => [Math.max(w || node.size?.[0] || 336, node.size?.[0] || 336), this.calculateHeight(node)];
    widget.computeLayoutSize = () => ({
      minHeight: this.calculateHeight(node),
      minWidth: Math.max(node.size?.[0] || 336, 320),
    });

    // Precise canvas positioning hook for LiteGraph (Nodes 1.0)
    const origDraw = widget.draw;
    widget.draw = function (ctx, n, widget_width, y, H) {
      if (origDraw) origDraw.apply(this, arguments);
      if (this.element && !n.flags?.collapsed) {
        if (!isVueNodes()) {
          const marginLeft = 4;
          const marginRight = 4;
          const topOffset = Math.max(y || 0, 76);
          const curW = (n.size && n.size[0] > 0) ? n.size[0] : (widget_width || 336);
          this.element.style.setProperty("left", (n.pos[0] + marginLeft) + "px", "important");
          this.element.style.setProperty("top", (n.pos[1] + topOffset) + "px", "important");
          this.element.style.setProperty("width", (curW - marginLeft - marginRight) + "px", "important");
          this.element.style.setProperty("height", "auto", "important");
          this.element.style.setProperty("margin", "0px", "important");
          this.element.style.setProperty("box-sizing", "border-box", "important");
        } else {
          this.element.style.removeProperty("left");
          this.element.style.removeProperty("top");
          this.element.style.setProperty("width", "100%", "important");
          this.element.style.setProperty("box-sizing", "border-box", "important");
          this.element.style.removeProperty("margin");
        }
      }
    };

    // Adaptive canvasOnly (Rule #1)
    applyAdaptiveCanvasOnly(widget);

    // Resize floor (Rule #4)
    node._trixFloorOff = installResizeFloor(root, () => this.calculateRequiredNodeHeight(node));

    node._trixDomWidget = widget;

    // Initial structural render
    this.render(node, widgetApi, true);

    return widget;
  }

  /**
   * Measures content height of inner DOM widget
   */
  static calculateHeight(node) {
    if (!node || !node.customWidgets) return 36;
    const HEADER_H = 24 + 5; // button + gap
    const TAG_H = 24 + 4;
    const ROW_H = 32 + 4;

    let total = 6 + HEADER_H; // root padding + header

    const widgets = node.customWidgets || [];
    const enableTags = node.properties?.enableTags !== false;
    let currentTag = null;
    let currentTagCollapsed = false;

    for (const w of widgets) {
      if (w.constructor?.name === "SuperLoraHeaderWidget") continue;

      if (w.constructor?.name === "SuperLoraTagWidget") {
        if (enableTags) {
          currentTag = w.tag;
          currentTagCollapsed = !!w.isCollapsed?.();
          total += TAG_H;
        }
        continue;
      }

      if (w.constructor?.name === "SuperLoraWidget") {
        if (enableTags && currentTagCollapsed) continue;
        total += ROW_H;
      }
    }

    return Math.max(36, total);
  }

  /**
   * Calculates total required node canvas height (including title and slots chrome)
   */
  static calculateRequiredNodeHeight(node) {
    const contentH = this.calculateHeight(node);
    // In Nodes 1.0 (LiteGraph Classic), topOffset is 76px + 10px bottom margin = 86px
    const chrome = isVueNodes() ? 0 : 86;
    return contentH + chrome;
  }

  /**
   * Renders full DOM node state from node.customWidgets
   * @param {Object} node
   * @param {Object} widgetApi
   * @param {Boolean} isStructural Set true ONLY when rows/tags count changes, NOT on simple clicks!
   */
  static render(node, widgetApi, isStructural = false) {
    window.trixSuperLoraDOMRenderer = SuperLoraDOMRenderer;
    if (widgetApi) window.trixSuperLoraLoaderAPI = widgetApi;
    const root = node._trixDomRoot;
    if (!root) return;

    root.innerHTML = "";
    root.style.setProperty("--trix-acc", node.properties?.highlightColor || "#5881AF");

    const widgets = node.customWidgets || [];

    // Ensure every SuperLoraWidget has a guaranteed unique instance ID
    for (let i = 0; i < widgets.length; i++) {
      const w = widgets[i];
      if (w && w.constructor?.name === "SuperLoraWidget") {
        if (!w._uid) {
          w._uid = "slw_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9) + "_" + i;
        }
      }
    }

    const loraWidgets = widgets.filter((w) => w.constructor?.name === "SuperLoraWidget");

    // 1. Header Bar with responsive label spans
    const headerEl = document.createElement("div");
    headerEl.className = "trix-nd-header";

    const allEnabled = loraWidgets.length > 0 && loraWidgets.every((w) => w.value?.enabled);
    const toggleText = allEnabled ? "Disable All" : "Enable All";
    const toggleShort = allEnabled ? "Disable" : "Enable";

    headerEl.innerHTML = `
      <button class="trix-nd-btn trix-nd-btn-primary" data-act="addLora" title="Add LoRA">
        <span class="trix-nd-lbl-full">+ Add LoRA</span>
        <span class="trix-nd-lbl-short">+ Add</span>
        <span class="trix-nd-lbl-icon">+</span>
      </button>
      <button class="trix-nd-btn" data-act="toggleAll" title="${toggleText}">
        <span class="trix-nd-lbl-full">${toggleText}</span>
        <span class="trix-nd-lbl-short">${toggleShort}</span>
        <span class="trix-nd-lbl-icon">▶</span>
      </button>
      <button class="trix-nd-btn" data-act="saveTemplate" title="Save Template">
        <span class="trix-nd-lbl-full">Save</span>
        <span class="trix-nd-lbl-short">Save</span>
        <span class="trix-nd-lbl-icon">↑</span>
      </button>
      <button class="trix-nd-btn" data-act="loadTemplate" title="Load Template">
        <span class="trix-nd-lbl-full">Load</span>
        <span class="trix-nd-lbl-short">Load</span>
        <span class="trix-nd-lbl-icon">↓</span>
      </button>
      <button class="trix-nd-btn trix-nd-btn-icon-only" data-act="settings" title="Settings">
        <span>⚙︎</span>
      </button>
      <button class="trix-nd-btn trix-nd-btn-icon-only" data-act="refreshFiles" title="Sync & Refresh Files">
        <span>🗘</span>
      </button>
    `;
    root.appendChild(headerEl);

    // 2. Group LoRAs by Tags
    const tagMap = new Map();
    let activeTag = "General";

    for (const w of widgets) {
      if (w.constructor?.name === "SuperLoraTagWidget") {
        activeTag = w.tag || "General";
        if (!tagMap.has(activeTag)) {
          tagMap.set(activeTag, { tagWidget: w, rows: [] });
        } else {
          tagMap.get(activeTag).tagWidget = w;
        }
      } else if (w.constructor?.name === "SuperLoraWidget") {
        const rowTag = w.value?.tag || activeTag;
        if (!tagMap.has(rowTag)) {
          tagMap.set(rowTag, { tagWidget: null, rows: [] });
        }
        tagMap.get(rowTag).rows.push(w);
      }
    }

    const showTags = node.properties?.enableTags !== false && tagMap.size > 0;

    for (const [tag, group] of tagMap.entries()) {
      const groupContainer = document.createElement("div");
      groupContainer.className = "trix-nd-tag-group";
      groupContainer.dataset.tag = tag;

      const isCollapsed = group.tagWidget ? group.tagWidget.isCollapsed?.() : false;
      const isBypassed = group.tagWidget ? !!group.tagWidget.value?.bypassed : false;
      const isTagActive = !isBypassed;

      if (showTags) {
        const tagHeader = document.createElement("div");
        tagHeader.className = `trix-nd-tag-header ${isCollapsed ? "collapsed" : ""} ${isBypassed ? "bypassed" : ""}`;
        tagHeader.dataset.act = "toggleTagCollapse";
        tagHeader.dataset.tag = tag;

        tagHeader.innerHTML = `
          <div class="trix-nd-tag-left">
            <span class="trix-nd-tag-arrow">▼</span>
            <span class="trix-nd-tag-title">${tag}</span>
            <span class="trix-nd-tag-count">(${group.rows.length})</span>
          </div>
          <div class="trix-nd-switch ${isTagActive ? "active" : ""}" data-act="toggleTagSwitch" data-tag="${tag}" title="${isTagActive ? `Bypass group (${tag})` : `Enable group (${tag})`}">
            <div class="trix-nd-switch-thumb"></div>
          </div>
        `;
        groupContainer.appendChild(tagHeader);
      }

      const contentContainer = document.createElement("div");
      contentContainer.className = `trix-nd-tag-content ${isCollapsed && showTags ? "collapsed" : ""}`;

      // Render Rows with isBypassed state
      for (const rowWidget of group.rows) {
        const rowEl = this._createRowElement(node, rowWidget, widgetApi, isBypassed);
        contentContainer.appendChild(rowEl);
      }

      groupContainer.appendChild(contentContainer);
      root.appendChild(groupContainer);
    }

    // Attach Delegated Event Listeners
    this._bindEvents(node, root, widgetApi);

    // Adapt node height if structural change occurred (adding/removing rows, tag collapse)
    if (isStructural) {
      this.fitNode(node, true);
    }
  }

  /**
   * Creates a single LoRA Row Element respecting ALL Settings options
   */
  static _createRowElement(node, widget, widgetApi, isGroupBypassed = false) {
    const props = node.properties || {};

    const showDrag = props.showMoveArrows !== false;
    const showTags = props.enableTags !== false;
    const showTagChip = showTags && props.showTagChip !== false;
    const showTriggers = props.showTriggerWords !== false;
    const showStrength = props.showStrengthControls !== false;
    const showSeparate = !!props.showSeparateStrengths;
    const showNotes = props.showNotesButton !== false;
    const showRemove = props.showRemoveButton !== false;
    const showOptions = props.showOptionsMenu !== false;
    const showCivitai = props.showCivitaiLookup !== false;

    if (!widget._uid) {
      widget._uid = "slw_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9);
    }

    const row = document.createElement("div");
    row._targetWidget = widget;
    const isRowEnabled = Boolean(widget.value.enabled);
    const isEffectiveActive = isRowEnabled && !isGroupBypassed;
    row.className = `trix-nd-row ${isEffectiveActive ? "" : "disabled"} ${isGroupBypassed ? "bypassed" : ""}`;
    row.dataset.widgetId = widget._uid || widget.name;
    row.draggable = true;

    const loraName = widget.value?.lora || "None";
    const baseName = (name) => {
      if (!name || name === "None") return "None";
      const clean = name.replace(/\\/g, "/");
      const parts = clean.split("/");
      let display = parts.length > 1 ? `${parts[parts.length - 2]}/${parts[parts.length - 1]}` : parts[0];
      if (props.hideFileExtension !== false) {
        display = display.replace(/\.(safetensors|ckpt|pt|bin)$/i, "");
      }
      return display;
    };

    const modelVal = Number(widget.value?.strength ?? 1).toFixed(2);
    const clipVal = Number(widget.value?.strengthClip ?? widget.value?.strength ?? 1).toFixed(2);

    const hasTrigger = Boolean(widget.value?.triggerWords);
    const triggerText = hasTrigger ? widget.value.triggerWords : "Click to add trigger";

    let hasNotes = false;
    try {
      hasNotes = LoraNotesDrawer.getInstance().hasNotes(loraName);
    } catch (_) {}

    const isModelActive = Math.abs(Number(modelVal) - 1.0) > 0.001;
    const isClipActive = Math.abs(Number(clipVal) - 1.0) > 0.001;

    let html = "";

    // 1. Drag Handle ⠿
    if (showDrag) {
      html += `<div class="trix-nd-drag-handle" title="Drag to reorder">⠿</div>`;
    }

    // 2. On/Off Toggle Switch (reflects widget.value.enabled)
    html += `
      <div class="trix-nd-switch ${widget.value.enabled ? "active" : ""}" data-act="toggleRow" title="${widget.value.enabled ? "Disable LoRA" : "Enable LoRA"}">
        <div class="trix-nd-switch-thumb"></div>
      </div>
    `;

    // 3. Tag Chip Badge
    if (showTagChip && widget.value?.tag) {
      html += `<span class="trix-nd-tag-chip" data-act="tagChipClick" title="Tag: ${widget.value.tag}">${widget.value.tag}</span>`;
    }

    // 4. File Name Box (Click for Advanced LoRA Settings & Optimization)
    const adv = widget.value?.adv_settings || widget.value?.advSettings || {};
    const hasAdv = Boolean(
      adv.smoothStep?.enabled ||
      adv.dare?.enabled ||
      (adv.blockFilter && adv.blockFilter !== "all")
    );
    const advInfo = hasAdv
      ? ` [⚡ Adv: ${[
          adv.smoothStep?.enabled ? `Smooth(${adv.smoothStep.intensity})` : null,
          adv.dare?.enabled ? `DARE(${Math.round(adv.dare.density * 100)}%)` : null,
          adv.blockFilter && adv.blockFilter !== "all" ? adv.blockFilter : null
        ].filter(Boolean).join(", ")}]`
      : "";
    const yellowStyle = hasAdv ? 'style="color: #facc15 !important; font-weight: 600; text-shadow: 0 0 8px rgba(250, 204, 21, 0.45);"' : '';
    html += `
      <div class="trix-nd-name-box ${hasAdv ? "has-schedule" : ""}" data-act="openLoraSettings" title="${hasAdv ? `LoRA Optimizer Active${advInfo} — Click to edit` : `Click to configure LoRA optimizer & filters (${loraName})`}">
        <span class="trix-nd-file-name ${hasAdv ? "has-schedule" : ""}" ${yellowStyle}>${baseName(loraName)}${hasAdv ? `<span class="trix-adv-sparkle" style="font-size:9.5px; opacity:0.95; margin-left:4px; color:#facc15;">⚡︎</span>` : ""}</span>
      </div>
    `;

    // 5. Trigger Words Button
    if (showTriggers) {
      html += `
        <div class="trix-nd-trigger-btn ${hasTrigger ? "has-trigger" : ""}" data-act="triggerClick" title="${triggerText}">
          <span class="trix-nd-trigger-text">${triggerText}</span>
          ${showCivitai ? `<span class="trix-nd-trigger-fetch" data-act="triggerFetch" title="Fetch trigger words from Civitai">ꔮ</span>` : ""}
        </div>
      `;
    }

    // 6. Strength Controls (Single vs Separate Model/CLIP)
    if (showStrength) {
      if (showSeparate) {
        html += `
          <div class="trix-nd-weight-wrap ${isModelActive ? "active-val" : ""}" title="Model Strength">
            <span class="trix-nd-weight-label">M</span>
            <button class="trix-nd-step-btn" data-act="weightModelDec">-</button>
            <input type="text" class="trix-nd-weight-input" data-act="weightModelInput" value="${modelVal}" />
            <button class="trix-nd-step-btn" data-act="weightModelInc">+</button>
          </div>
          <div class="trix-nd-weight-wrap ${isClipActive ? "active-val" : ""}" title="CLIP Strength">
            <span class="trix-nd-weight-label">C</span>
            <button class="trix-nd-step-btn" data-act="weightClipDec">-</button>
            <input type="text" class="trix-nd-weight-input" data-act="weightClipInput" value="${clipVal}" />
            <button class="trix-nd-step-btn" data-act="weightClipInc">+</button>
          </div>
        `;
      } else {
        html += `
          <div class="trix-nd-weight-wrap ${isModelActive ? "active-val" : ""}" title="LoRA Weight">
            <button class="trix-nd-step-btn" data-act="weightDec">-</button>
            <input type="text" class="trix-nd-weight-input" data-act="weightInput" value="${modelVal}" />
            <button class="trix-nd-step-btn" data-act="weightInc">+</button>
          </div>
        `;
      }
    }

    // 7. Notes Button ✍︎
    if (showNotes) {
      html += `
        <button class="trix-nd-notes-btn ${hasNotes ? "has-notes" : ""}" data-act="openNotes" title="Notes & Reference Images (✍︎)">✍︎</button>
      `;
    }

    // 8. Direct Remove Button ✖︎
    if (showRemove) {
      html += `
        <button class="trix-nd-remove-btn" data-act="removeDirect" title="Remove LoRA">✖︎</button>
      `;
    }

    // 9. Context Options Menu ⫶ (Optional)
    if (showOptions) {
      html += `<div class="trix-nd-opts-btn" data-act="rowOptions" title="Options">⫶</div>`;
    }

    row.innerHTML = html;
    return row;
  }

  /**
   * Fits node dimensions smoothly
   */
  static fitNode(node, isStructural = false) {
    if (isGraphLoading() || !node) return;
    const requiredH = this.calculateRequiredNodeHeight(node);
    const currentW = Math.max(node.size?.[0] || 336, 320);

    if (isStructural) {
      if (node.setSize) {
        node.setSize([currentW, requiredH]);
      } else {
        node.size = [currentW, requiredH];
      }
      node.setDirtyCanvas?.(true, true);
    } else if (node.size && node.size[1] < requiredH) {
      if (node.setSize) {
        node.setSize([currentW, requiredH]);
      } else {
        node.size = [currentW, requiredH];
      }
      node.setDirtyCanvas?.(true, true);
    }
  }

  /**
   * Delegated Event Bindings
   */
  static _bindEvents(node, root, widgetApi) {
    root.onclick = (e) => {
      const actEl = e.target.closest("[data-act]");
      if (!actEl) return;
      const act = actEl.dataset.act;
      if (!act) return;

      e.stopPropagation();

      const rowEl = actEl.closest(".trix-nd-row");
      const widgetId = rowEl?.dataset?.widgetId;
      const widget = rowEl?._targetWidget || (node.customWidgets || []).find((w) => (w._uid && w._uid === widgetId) || w.name === widgetId);

      // --- Header Actions ---
      if (act === "addLora") {
        widgetApi.showLoraSelector(node, void 0, e);
        return;
      }
      if (act === "toggleAll") {
        const loraWidgets = (node.customWidgets || []).filter((w) => w.constructor?.name === "SuperLoraWidget");
        const allEnabled = loraWidgets.length > 0 && loraWidgets.every((w) => w.value?.enabled);
        loraWidgets.forEach((w) => { w.value.enabled = !allEnabled; });
        this.render(node, widgetApi, false);
        widgetApi.syncExecutionWidgets(node);
        return;
      }
      if (act === "saveTemplate") {
        const headerWidget = (node.customWidgets || []).find((w) => w.constructor?.name === "SuperLoraHeaderWidget");
        headerWidget?.onSaveTemplateDown?.(e, [0, 0], node);
        return;
      }
      if (act === "loadTemplate") {
        widgetApi.showLoadTemplateDialog(node, e);
        return;
      }
      if (act === "settings") {
        openSuperLoraSettingsPanel(node, (structural) => {
          this.render(node, widgetApi, structural);
          widgetApi.syncExecutionWidgets(node);
        });
        return;
      }
      if (act === "refreshFiles") {
        const headerWidget = (node.customWidgets || []).find((w) => w.constructor?.name === "SuperLoraHeaderWidget");
        headerWidget?.onRefreshFilesDown?.(e, [0, 0], node).then(() => {
          this.render(node, widgetApi, true);
        });
        return;
      }

      // --- Tag Actions ---
      if (act === "toggleTagCollapse") {
        const tag = actEl.dataset.tag;
        const tagWidget = (node.customWidgets || []).find((w) => w.constructor?.name === "SuperLoraTagWidget" && w.tag === tag);
        if (tagWidget) {
          tagWidget.value.collapsed = !tagWidget.value.collapsed;
          this.render(node, widgetApi, true);
        }
        return;
      }
      if (act === "toggleTagSwitch") {
        const tag = actEl.dataset.tag;
        let tagWidget = (node.customWidgets || []).find((w) => w.constructor?.name === "SuperLoraTagWidget" && w.tag === tag);
        if (!tagWidget && widgetApi.organizeByTags) {
          widgetApi.organizeByTags(node);
          tagWidget = (node.customWidgets || []).find((w) => w.constructor?.name === "SuperLoraTagWidget" && w.tag === tag);
        }
        if (tagWidget) {
          if (!tagWidget.value) tagWidget.value = { tag, collapsed: false, bypassed: false };
          tagWidget.value.bypassed = !tagWidget.value.bypassed;
        }
        this.render(node, widgetApi, false);
        widgetApi.syncExecutionWidgets(node);
        return;
      }

      // --- Row Actions ---
      if (!widget) return;

      if (act === "toggleRow") {
        widget.value.enabled = !widget.value.enabled;
        this.render(node, widgetApi, false);
        widgetApi.syncExecutionWidgets(node);
        return;
      }

      if (act === "openLoraSettings" || act === "pickLora") {
        if (!widget.value?.lora || widget.value.lora === "None") {
          widgetApi.showLoraSelector(node, widget, e);
        } else {
          openLoraSettingsDrawer(widget, node);
        }
        return;
      }

      if (act === "tagChipClick") {
        widgetApi.showTagSelector(node, widget);
        return;
      }

      if (act === "triggerFetch") {
        if (e && e.stopPropagation) e.stopPropagation();
        const fetchEl = actEl;
        if (fetchEl) {
          fetchEl.classList.remove("trix-nd-spin-360");
          void fetchEl.offsetWidth;
          fetchEl.classList.add("trix-nd-spin-360", "fetching");
        }
        const loraName = widget?.value?.lora;
        const animPromise = new Promise((resolve) => setTimeout(resolve, 680));

        if (loraName && loraName !== "None") {
          const fetchPromise = (widgetApi.civitaiService?.getCivitAiInfo || widgetApi.civitaiService?.getModelInfo)?.call(widgetApi.civitaiService, loraName);
          Promise.all([fetchPromise, animPromise]).then(([info]) => {
            if (fetchEl) fetchEl.classList.remove("fetching", "trix-nd-spin-360");
            const triggers = info?.trigger_words || info?.triggerWords || info?.trained_words || info?.trainedWords;
            const hasTriggers = triggers && (Array.isArray(triggers) ? triggers.length > 0 : String(triggers).trim().length > 0);
            if (hasTriggers) {
              const words = Array.isArray(triggers) ? triggers.join(node.properties?.triggerWordsSeparator || ", ") : String(triggers).trim();
              widget.value.triggerWords = words;
              widget.value.trigger_word = words;
              this.render(node, widgetApi, false);
              widgetApi.syncExecutionWidgets(node);
              if (node.setDirtyCanvas) node.setDirtyCanvas(true, true);
              widgetApi.showToast(`Found trigger words: ${words}`, "success");
            } else {
              this.render(node, widgetApi, false);
              widgetApi.showToast("No trigger words found for this LoRA", "info");
            }
          }).catch((err) => {
            console.error("Civitai trigger fetch error:", err);
            animPromise.then(() => {
              if (fetchEl) fetchEl.classList.remove("fetching", "trix-nd-spin-360");
              this.render(node, widgetApi, false);
              widgetApi.showToast("Failed to fetch trigger words", "error");
            });
          });
        } else {
          animPromise.then(() => {
            if (fetchEl) fetchEl.classList.remove("fetching", "trix-nd-spin-360");
          });
          widgetApi.showToast("Please select a LoRA file first", "info");
        }
        return;
      }

      if (act === "triggerClick") {
        widgetApi.showInlineText(e, widget.value.triggerWords || widget.value.trigger_word || "", (newVal) => {
          widget.value.triggerWords = newVal;
          widget.value.trigger_word = newVal;
          this.render(node, widgetApi, false);
          widgetApi.syncExecutionWidgets(node);
          if (node.setDirtyCanvas) node.setDirtyCanvas(true, true);
        }, "Trigger words (comma separated)...");
        return;
      }

      const step = Number(node.properties?.strengthStep ?? 0.05) || 0.05;

      // Combined Weight Stepper
      if (act === "weightDec") {
        const cur = Number(widget.value.strength ?? 1);
        const next = Math.max(-10, Math.round((cur - step) * 1000) / 1000);
        widget.value.strength = next;
        widget.value.strengthClip = next;
        this.render(node, widgetApi, false);
        widgetApi.syncExecutionWidgets(node);
        return;
      }
      if (act === "weightInc") {
        const cur = Number(widget.value.strength ?? 1);
        const next = Math.min(10, Math.round((cur + step) * 1000) / 1000);
        widget.value.strength = next;
        widget.value.strengthClip = next;
        this.render(node, widgetApi, false);
        widgetApi.syncExecutionWidgets(node);
        return;
      }

      // Separate Model Stepper
      if (act === "weightModelDec") {
        const cur = Number(widget.value.strength ?? 1);
        widget.value.strength = Math.max(-10, Math.round((cur - step) * 1000) / 1000);
        this.render(node, widgetApi, false);
        widgetApi.syncExecutionWidgets(node);
        return;
      }
      if (act === "weightModelInc") {
        const cur = Number(widget.value.strength ?? 1);
        widget.value.strength = Math.min(10, Math.round((cur + step) * 1000) / 1000);
        this.render(node, widgetApi, false);
        widgetApi.syncExecutionWidgets(node);
        return;
      }

      // Separate CLIP Stepper
      if (act === "weightClipDec") {
        const cur = Number(widget.value.strengthClip ?? widget.value.strength ?? 1);
        widget.value.strengthClip = Math.max(-10, Math.round((cur - step) * 1000) / 1000);
        this.render(node, widgetApi, false);
        widgetApi.syncExecutionWidgets(node);
        return;
      }
      if (act === "weightClipInc") {
        const cur = Number(widget.value.strengthClip ?? widget.value.strength ?? 1);
        widget.value.strengthClip = Math.min(10, Math.round((cur + step) * 1000) / 1000);
        this.render(node, widgetApi, false);
        widgetApi.syncExecutionWidgets(node);
        return;
      }

      if (act === "openNotes") {
        const loraName = widget.value?.lora;
        if (loraName && loraName !== "None") {
          LoraNotesDrawer.open(loraName, node);
        } else {
          alert("Please select a LoRA first before opening notes.");
        }
        return;
      }

      if (act === "removeDirect") {
        widgetApi.removeLoraWidget(node, widget);
        this.render(node, widgetApi, true);
        widgetApi.syncExecutionWidgets(node);
        return;
      }

      if (act === "rowOptions") {
        this._openRowMenu(node, widget, e.clientX, e.clientY, widgetApi);
        return;
      }
    };

    // Weight direct input change handlers
    root.onchange = (e) => {
      const input = e.target;
      const act = input.dataset?.act;
      if (!act) return;

      const rowEl = input.closest(".trix-nd-row");
      const widgetId = rowEl?.dataset?.widgetId;
      const widget = rowEl?._targetWidget || (node.customWidgets || []).find((w) => (w._uid && w._uid === widgetId) || w.name === widgetId);
      if (!widget) return;

      const val = parseFloat(input.value);

      if (act === "weightInput") {
        if (!isNaN(val)) {
          const rounded = Math.round(val * 100) / 100;
          widget.value.strength = rounded;
          widget.value.strengthClip = rounded;
          this.render(node, widgetApi, false);
          widgetApi.syncExecutionWidgets(node);
        } else {
          input.value = Number(widget.value.strength ?? 1).toFixed(2);
        }
      } else if (act === "weightModelInput") {
        if (!isNaN(val)) {
          widget.value.strength = Math.round(val * 100) / 100;
          this.render(node, widgetApi, false);
          widgetApi.syncExecutionWidgets(node);
        } else {
          input.value = Number(widget.value.strength ?? 1).toFixed(2);
        }
      } else if (act === "weightClipInput") {
        if (!isNaN(val)) {
          widget.value.strengthClip = Math.round(val * 100) / 100;
          this.render(node, widgetApi, false);
          widgetApi.syncExecutionWidgets(node);
        } else {
          input.value = Number(widget.value.strengthClip ?? widget.value.strength ?? 1).toFixed(2);
        }
      }
    };

    // Native Drag & Drop for Rows
    this._attachDragAndDrop(node, root, widgetApi);
  }

  /**
   * Context menu for row actions (Duplicate, Remove, Move up/down, Direct CivitAI Link)
   */
  static _openRowMenu(node, widget, x, y, widgetApi) {
    closeActiveMenu();

    const menu = document.createElement("div");
    menu.className = "trix-nd-menu";

    const widgets = node.customWidgets || [];
    const idx = widgets.indexOf(widget);

    const addItem = (icon, label, callback, { danger = false, disabled = false } = {}) => {
      const item = document.createElement("div");
      item.className = `trix-nd-menu-item ${danger ? "danger" : ""} ${disabled ? "disabled" : ""}`;
      item.innerHTML = `
        <span class="trix-nd-menu-icon">${icon}</span>
        <span>${label}</span>
      `;
      if (!disabled) {
        item.onclick = (e) => {
          e.stopPropagation();
          closeActiveMenu();
          callback();
        };
      }
      menu.appendChild(item);
    };

    const addSep = () => {
      const sep = document.createElement("div");
      sep.className = "trix-nd-menu-sep";
      menu.appendChild(sep);
    };

    addItem("↑", "Move Up", () => {
      if (idx > 1) {
        const tmp = widgets[idx];
        widgets[idx] = widgets[idx - 1];
        widgets[idx - 1] = tmp;
        this.render(node, widgetApi, false);
        widgetApi.syncExecutionWidgets(node);
      }
    }, { disabled: idx <= 1 });

    addItem("↓", "Move Down", () => {
      if (idx < widgets.length - 1) {
        const tmp = widgets[idx];
        widgets[idx] = widgets[idx + 1];
        widgets[idx + 1] = tmp;
        this.render(node, widgetApi, false);
        widgetApi.syncExecutionWidgets(node);
      }
    }, { disabled: idx >= widgets.length - 1 });

    addItem("⧉", "Duplicate", () => {
      const cloneConfig = {
        name: widget.name + "_copy",
        lora: widget.value.lora,
        strength: widget.value.strength,
        strengthClip: widget.value.strengthClip,
        triggerWords: widget.value.triggerWords,
        tag: widget.value.tag,
        enabled: widget.value.enabled,
      };
      widgetApi.addLoraWidget(node, cloneConfig);
      this.render(node, widgetApi, true);
      widgetApi.syncExecutionWidgets(node);
    });

    addSep();

    // ⚙︎ LoRA Advanced Optimizer
    addItem("⚡︎", "LoRA Optimizer (Smooth, DARE...)", () => {
      openLoraSettingsDrawer(widget, node);
    });

    // 🗘 Change LoRA file
    addItem("🗘", "Change LoRA File", () => {
      widgetApi.showLoraSelector(node, widget);
    });

    // ❖ Tag Group Action
    addItem("❖", "Change Tag Group", () => {
      widgetApi.showTagSelector(node, widget);
    });

    // Direct Civitai Model Link
    addItem("⌾", "Civitai Info", async () => {
      const loraName = widget.value?.lora;
      if (loraName && loraName !== "None") {
        try {
          const resp = await fetch("/super_lora/civitai_info", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lora_filename: loraName })
          });
          const data = await resp.json();
          if (data && data.civitai_url) {
            window.open(data.civitai_url, "_blank");
            return;
          } else if (data && data.modelId) {
            const vParam = data.modelVersionId ? `?modelVersionId=${data.modelVersionId}` : "";
            window.open(`https://civitai.com/models/${data.modelId}${vParam}`, "_blank");
            return;
          }
        } catch (_) {}

        // Fallback search by clean filename if hash not matched
        const cleanName = loraName.replace(/\\/g, "/").split("/").pop().replace(/\.(safetensors|ckpt|pt|bin)$/i, "");
        window.open(`https://civitai.com/search/models?query=${encodeURIComponent(cleanName)}`, "_blank");
      }
    });

    addSep();

    addItem("✖︎", "Remove LoRA", () => {
      widgetApi.removeLoraWidget(node, widget);
      this.render(node, widgetApi, true);
      widgetApi.syncExecutionWidgets(node);
    }, { danger: true });

    document.body.appendChild(menu);

    const mw = menu.offsetWidth || 180;
    const mh = menu.offsetHeight || 150;
    menu.style.left = `${Math.max(6, Math.min(x, window.innerWidth - mw - 6))}px`;
    menu.style.top = `${Math.max(6, Math.min(y, window.innerHeight - mh - 6))}px`;

    const onDown = (ev) => {
      if (!menu.contains(ev.target)) closeActiveMenu();
    };
    const onKey = (ev) => {
      if (ev.key === "Escape") closeActiveMenu();
    };

    _activeMenu = menu;
    setTimeout(() => {
      if (_activeMenu !== menu) return;
      document.addEventListener("pointerdown", onDown, true);
      document.addEventListener("keydown", onKey, true);
    }, 0);

    _activeMenuCleanup = () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }

  /**
   * Drag and drop reordering
   */
  static _attachDragAndDrop(node, root, widgetApi) {
    let draggedWidget = null;
    let draggedRowEl = null;

    root.ondragstart = (e) => {
      const row = e.target.closest(".trix-nd-row");
      if (!row) return;
      const widgetId = row.dataset.widgetId;
      draggedWidget = row._targetWidget || (node.customWidgets || []).find((w) => (w._uid && w._uid === widgetId) || w.name === widgetId);
      draggedRowEl = row;
      row.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", widgetId);
    };

    root.ondragend = () => {
      if (draggedRowEl) draggedRowEl.classList.remove("dragging");
      root.querySelectorAll(".trix-nd-row").forEach((el) => {
        el.classList.remove("drag-over-top", "drag-over-bottom");
      });
      draggedWidget = null;
      draggedRowEl = null;
    };

    root.ondragover = (e) => {
      e.preventDefault();
      const targetRow = e.target.closest(".trix-nd-row");
      if (!targetRow || targetRow === draggedRowEl) return;

      const rect = targetRow.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      const isAbove = e.clientY < mid;

      targetRow.classList.toggle("drag-over-top", isAbove);
      targetRow.classList.toggle("drag-over-bottom", !isAbove);
    };

    root.ondragleave = (e) => {
      const targetRow = e.target.closest(".trix-nd-row");
      if (targetRow) {
        targetRow.classList.remove("drag-over-top", "drag-over-bottom");
      }
    };

    root.ondrop = (e) => {
      e.preventDefault();
      const targetRow = e.target.closest(".trix-nd-row");
      if (!targetRow || !draggedWidget) return;

      const targetId = targetRow.dataset.widgetId;
      const targetWidget = targetRow._targetWidget || (node.customWidgets || []).find((w) => (w._uid && w._uid === targetId) || w.name === targetId);
      if (!targetWidget || targetWidget === draggedWidget) return;

      const widgets = node.customWidgets || [];
      const oldIdx = widgets.indexOf(draggedWidget);
      const targetIdx = widgets.indexOf(targetWidget);

      if (oldIdx !== -1 && targetIdx !== -1) {
        const rect = targetRow.getBoundingClientRect();
        const isAbove = e.clientY < rect.top + rect.height / 2;

        widgets.splice(oldIdx, 1);
        let insertIdx = isAbove ? targetIdx : targetIdx + 1;
        if (oldIdx < insertIdx) insertIdx--;
        widgets.splice(insertIdx, 0, draggedWidget);

        // Update tag
        draggedWidget.value.tag = targetWidget.value.tag;

        widgetApi.organizeByTags?.(node);
        this.render(node, widgetApi, true);
        widgetApi.syncExecutionWidgets(node);
      }
    };
  }
}
