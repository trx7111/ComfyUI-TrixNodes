import { app } from "/scripts/app.js";

console.log("[Trix Bypasser] Loading Nodes 2.0 universal DOM architecture v21 (NDSuperLoRA resizability standard)...");

// =========================================================
// 1. ICONS & SVG HELPERS (100% Mathematically Centered)
// =========================================================
const TRIX_CROSS_SVG = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="pointer-events:none;display:block;"><path d="M2.2 2.2L7.8 7.8M7.8 2.2L2.2 7.8"/></svg>`;
const TRIX_CROSS_SM_SVG = `<svg width="8.5" height="8.5" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="pointer-events:none;display:block;"><path d="M2.2 2.2L7.8 7.8M7.8 2.2L2.2 7.8"/></svg>`;

// =========================================================
// 2. NODES 2.0 COMPATIBILITY HELPERS
// =========================================================

export function isVueNodes() {
    return !!(
        window.LiteGraph?.vueNodesMode ||
        app.canvas?.vueNodesMode ||
        (typeof LGraphCanvas !== "undefined" && LGraphCanvas.vueNodesMode) ||
        document.querySelector(".comfy-vue-node, .vue-nodes, .vue-canvas, #vue-app")
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
            try {
                onRelease();
                requestAnimationFrame(() => {
                    try { onRelease(); } catch (_e) {}
                });
            } catch (_e) {}
        }
    };
  
    const onDown = (e) => {
        if (!isVueNodes() || !root.isConnected) return;
        if (e.target?.closest?.(".lg-node-widget")) return;

        let cur = "";
        try { cur = (e.target && window.getComputedStyle(e.target).cursor) || ""; } catch (_e) {}
        if (cur.indexOf("resize") === -1) return;

        const nodeSelector = ".comfy-vue-node, .lg-node, .vue-node, [data-node-id], .litegraph-node";
        const myNode = root.closest(nodeSelector);
        const downNode = e.target?.closest?.(nodeSelector);
        // Strictly check that this pointerdown belongs to THIS specific node
        if (!myNode || !downNode || myNode !== downNode) return;

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

export function installCanvasZoomPassthrough(root) {
    if (!root || typeof root.addEventListener !== "function") return () => {};

    const onWheel = (e) => {
        if (isVueNodes()) return;
        if (e.ctrlKey || e.metaKey) return;

        const canvasEl = app?.canvas?.canvas;
        if (!canvasEl) return;

        e.preventDefault();
        e.stopPropagation();

        const { clientX, clientY, deltaX, deltaY, deltaMode, ctrlKey, metaKey, shiftKey } = e;
        canvasEl.dispatchEvent(new WheelEvent("wheel", {
            clientX,
            clientY,
            deltaX,
            deltaY,
            deltaMode,
            ctrlKey,
            metaKey,
            shiftKey,
            bubbles: true,
            cancelable: true
        }));
    };

    root.addEventListener("wheel", onWheel, { passive: false });
    return () => {
        root.removeEventListener("wheel", onWheel);
    };
}

export function gateResizeAndDraw(nodeType, minW = 240, minH = 60) {
    const origOnResize = nodeType.prototype.onResize;
    nodeType.prototype.onResize = function (size) {
        const domH = (this._trixDomRoot && this._trixDomRoot.offsetHeight > 0)
            ? this._trixDomRoot.offsetHeight
            : (TrixBypasserDOMRenderer.calculateHeight ? TrixBypasserDOMRenderer.calculateHeight(this) : (minH || 60));
        const reqMinH = domH + 28;
        const reqMinW = minW || 240;

        let res = undefined;
        if (origOnResize) res = origOnResize.apply(this, arguments);

        if (this.size && Array.isArray(this.size)) {
            if (this.size[0] < reqMinW) this.size[0] = reqMinW;
            this.size[1] = reqMinH;
        }
        if (Array.isArray(size)) {
            if (size[0] < reqMinW) size[0] = reqMinW;
            size[1] = reqMinH;
        }
        return res;
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

// =========================================================
// 3. STYLE INJECTION (DOM UI + Modals)
// =========================================================
const TRIX_CSS = `
/* =========================================================
   DOM WIDGET OVERLAY (NODES 2.0 & CLASSIC)
   ========================================================= */
.trix-bp-root {
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
    gap: 3px;
    padding: 3px 5px 6px 5px;
    overflow: hidden;
    pointer-events: none; /* Allows mouse through empty areas to grab node resize handles */
}

.trix-bp-header,
.trix-bp-group-card,
.trix-bp-row,
.trix-bp-btn-add-target,
.trix-bp-empty {
    pointer-events: auto;
}

/* Header Tray */
.trix-bp-header {
    display: flex;
    align-items: center;
    gap: 4px;
    background: rgba(0, 0, 0, 0.28);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    padding: 3px 4px;
    border-radius: 4px;
    margin-bottom: 2px;
    box-sizing: border-box;
    pointer-events: auto;
}

/* Responsive label tiers */
.trix-bp-root:not([data-mode]) .lbl-short,
.trix-bp-root:not([data-mode]) .lbl-icon,
.trix-bp-root[data-mode="full"] .lbl-short,
.trix-bp-root[data-mode="full"] .lbl-icon {
    display: none !important;
}
.trix-bp-root[data-mode="short"] .lbl-full,
.trix-bp-root[data-mode="short"] .lbl-icon {
    display: none !important;
}
.trix-bp-root[data-mode="icon"] .lbl-full,
.trix-bp-root[data-mode="icon"] .lbl-short {
    display: none !important;
}

/* Segmented Pills (Single/Multi & Mute/Bypass) */
.trix-bp-pill {
    display: inline-flex;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    overflow: hidden;
    height: 20px;
    flex-shrink: 0;
}
.trix-bp-pill-btn {
    padding: 0 8px;
    font-size: 9px;
    font-weight: 700;
    line-height: 18px;
    color: #777;
    background: transparent;
    border: none;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
    outline: none;
    user-select: none;
    display: flex;
    align-items: center;
    justify-content: center;
}
.trix-bp-pill-btn:hover {
    color: #bbb;
}
.trix-bp-pill-btn.active {
    background: #33789A;
    color: #ffffff;
}

.trix-bp-root[data-mode="short"] .trix-bp-pill-btn {
    padding: 0 6px;
}
.trix-bp-root[data-mode="icon"] .trix-bp-pill-btn {
    padding: 0 6px;
    font-size: 11px;
}

/* Header Action Button (Add N / Add B) */
.trix-bp-btn-add {
    flex: 1;
    height: 20px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    color: #bbb;
    font-size: 9.5px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    outline: none;
    user-select: none;
    white-space: nowrap;
    overflow: hidden;
}
.trix-bp-btn-add:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
}
.trix-bp-root[data-mode="icon"] .trix-bp-btn-add {
    font-size: 12px;
    font-weight: 900;
}

/* Header Trash / Delete Mode Button */
.trix-bp-btn-trash {
    width: 22px;
    height: 20px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    color: #777;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    margin: 0;
    line-height: 0;
    transition: all 0.15s ease;
    outline: none;
    flex-shrink: 0;
    user-select: none;
    box-sizing: border-box;
}
.trix-bp-btn-trash:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #aaa;
}
.trix-bp-btn-trash.active {
    background: #b34d4d !important;
    border-color: #e66666 !important;
    color: #ffffff !important;
}

/* Groups Container */
.trix-bp-group-card {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 5px;
    padding: 3px 4px;
    margin: 0 5px 3px 5px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    box-sizing: border-box;
}
.trix-bp-group-header {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 22px;
    padding: 0;
    box-sizing: border-box;
    cursor: pointer;
    user-select: none;
}
.trix-bp-group-arrow {
    font-size: 9px;
    color: #777;
    width: 12px;
    text-align: center;
    transition: color 0.15s ease;
    flex-shrink: 0;
    pointer-events: none;
}
.trix-bp-group-header:hover .trix-bp-group-arrow {
    color: #fff;
}
.trix-bp-group-title {
    font-size: 10px;
    font-weight: 700;
    color: #ffffff;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: inline-block;
    width: auto;
    max-width: 140px;
    padding: 1px 4px;
    border-radius: 3px;
    flex-shrink: 0;
    transition: color 0.15s ease, background 0.15s ease;
}
.trix-bp-group-title:hover {
    color: #387aff;
    background: rgba(255, 255, 255, 0.08);
    text-decoration: underline;
}
.trix-bp-group-spacer {
    flex: 1;
    min-width: 0;
    height: 100%;
    cursor: pointer;
}

.trix-bp-group-rows {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

/* Target Rows */
.trix-bp-row {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 22px;
    margin-bottom: 2px;
    padding: 0;
    box-sizing: border-box;
}
.trix-bp-row-label {
    min-width: 65px;
    max-width: 85px;
    height: 18px;
    padding: 0 4px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 3px;
    color: #ffffff;
    font-size: 9px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: color 0.15s ease, background 0.15s ease;
    flex-shrink: 0;
    box-sizing: border-box;
}
.trix-bp-row-label:hover {
    color: #387aff;
    text-decoration: underline;
    background: rgba(255, 255, 255, 0.1);
}

.trix-bp-row-picker {
    flex: 1;
    min-width: 0;
    height: 18px;
    background: #0c0c0f;
    border: 1px solid rgba(255, 255, 255, 0.04);
    border-radius: 3px;
    color: #aaa;
    font-size: 9px;
    font-family: 'Segoe UI', -apple-system, sans-serif;
    display: flex;
    align-items: center;
    padding: 0 6px;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: border-color 0.15s ease, background 0.15s ease;
    box-sizing: border-box;
}
.trix-bp-row-picker:hover {
    border-color: rgba(56, 122, 255, 0.35);
    background: #111116;
}
.trix-bp-row-picker.placeholder {
    color: #444;
}

.trix-bp-row-warning {
    width: 16px;
    height: 16px;
    background: #e6a23c;
    color: #18181c;
    border-radius: 3px;
    font-size: 10px;
    font-weight: 900;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    transition: transform 0.15s ease;
}
.trix-bp-row-warning:hover {
    transform: scale(1.1);
}

/* Jump to Target Eye Icon Button */
.trix-bp-row-jump {
    width: 18px;
    height: 18px;
    color: #777;
    font-size: 11px;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border-radius: 3px;
    flex-shrink: 0;
    transition: color 0.15s ease, transform 0.15s ease;
    user-select: none;
}
.trix-bp-row-jump:hover {
    color: #387aff;
    transform: scale(1.2);
}

/* Switch (CSS Toggle) */
.trix-bp-switch {
    width: 28px;
    height: 15px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    position: relative;
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.18s ease, border-color 0.18s ease;
    box-sizing: border-box;
}
.trix-bp-switch.active {
    background: #387aff;
    border-color: #387aff;
}
.trix-bp-switch.partial {
    background: #f5a623 !important;
    border-color: #f5a623 !important;
}
.trix-bp-switch-thumb {
    width: 11px;
    height: 11px;
    border-radius: 50%;
    background: #ffffff;
    position: absolute;
    top: 1px;
    left: 1px;
    transition: transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: 0 1px 2px rgba(0,0,0,0.3);
    pointer-events: none;
}
.trix-bp-switch.active .trix-bp-switch-thumb {
    transform: translateX(13px);
}
.trix-bp-switch.partial .trix-bp-switch-thumb {
    transform: translateX(6.5px);
}

/* Delete Row/Group Button */
.trix-bp-row-delete {
    width: 18px;
    height: 18px;
    color: #ff6b6b;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border-radius: 3px;
    flex-shrink: 0;
    padding: 0;
    margin: 0;
    line-height: 0;
    transition: background 0.15s ease;
    user-select: none;
    box-sizing: border-box;
}
.trix-bp-row-delete:hover {
    background: rgba(220, 76, 76, 0.2);
}

/* +G Header & Group Action Buttons */
.trix-bp-btn-add-g {
    height: 20px;
    padding: 0 6px;
    background: rgba(127, 217, 165, 0.12);
    border: 1px solid rgba(127, 217, 165, 0.35);
    border-radius: 4px;
    color: #9fd9b5;
    font-size: 9.5px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    outline: none;
    flex-shrink: 0;
    user-select: none;
    box-sizing: border-box;
}
.trix-bp-btn-add-g:hover {
    background: rgba(127, 217, 165, 0.25);
    color: #fff;
    border-color: rgba(127, 217, 165, 0.6);
}

.trix-bp-add-row-actions {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin: 2px auto 1px auto;
}
.trix-bp-btn-add-target {
    width: 24px;
    height: 16px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 3px;
    color: #888;
    font-size: 11px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    transition: all 0.15s ease;
}
.trix-bp-btn-add-target:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
}
.trix-bp-btn-add-group-target {
    background: rgba(127, 217, 165, 0.08);
    border-color: rgba(127, 217, 165, 0.35);
    color: #9fd9b5;
    font-weight: 700;
    font-size: 9.5px;
}
.trix-bp-btn-add-group-target:hover {
    background: rgba(127, 217, 165, 0.22);
    color: #fff;
    border-color: rgba(127, 217, 165, 0.6);
}

/* Group Target Row styling */
.trix-bp-row-label.group-kind {
    background: rgba(127, 217, 165, 0.12);
    color: #9fd9b5;
    border: 1px solid rgba(127, 217, 165, 0.25);
}
.trix-bp-row-label.group-kind:hover {
    background: rgba(127, 217, 165, 0.22);
    color: #fff;
}

/* Drag Handle ⠿ */
.trix-bp-drag-handle {
    color: #636879;
    font-size: 12px;
    cursor: grab;
    flex: 0 0 auto;
    padding: 0 2px 0 0;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.12s, transform 0.12s;
    user-select: none;
    -webkit-user-drag: element;
    touch-action: none;
}
.trix-bp-drag-handle:hover {
    color: #cbd5e1;
    transform: scale(1.15);
}
.trix-bp-drag-handle:active {
    cursor: grabbing;
}
.trix-bp-drag-handle.group-handle {
    margin-right: 3px;
    cursor: grab;
}
.trix-bp-group-header[draggable="true"] {
    cursor: grab;
}
.trix-bp-group-header[draggable="true"]:active {
    cursor: grabbing;
}

[draggable="true"] {
    -webkit-user-drag: element;
}

/* Dragging & Drag-over indicators */
.trix-bp-row.dragging {
    opacity: 0.35 !important;
    background: #252835 !important;
    border-radius: 4px;
    outline: 1px dashed rgba(56, 122, 255, 0.6) !important;
}

.trix-bp-group-card.dragging {
    opacity: 0.35 !important;
    background: #252835 !important;
    outline: 1px dashed rgba(56, 122, 255, 0.6) !important;
}

.trix-bp-row.drag-over-top {
    border-top: 2px solid #387aff !important;
    box-shadow: 0 -1px 4px rgba(56, 122, 255, 0.35);
}

.trix-bp-row.drag-over-bottom {
    border-bottom: 2px solid #387aff !important;
    box-shadow: 0 1px 4px rgba(56, 122, 255, 0.35);
}

.trix-bp-group-card.drag-over-top {
    border-top: 2px solid #387aff !important;
    box-shadow: 0 -2px 6px rgba(56, 122, 255, 0.35);
}

.trix-bp-group-card.drag-over-bottom {
    border-bottom: 2px solid #387aff !important;
    box-shadow: 0 2px 6px rgba(56, 122, 255, 0.35);
}

/* =========================================================
   MODALS AND POPUPS
   ========================================================= */
.trix-picker-overlay {
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(10,10,12,0.75); z-index: 10000;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
    backdrop-filter: blur(4px);
}
.trix-picker-modal {
    background: #18181c; border: 1px solid #2e2e38; box-shadow: 0 20px 50px rgba(0,0,0,0.6);
    width: 480px; max-height: 75vh; display: flex; flex-direction: column;
    border-radius: 8px; overflow: hidden;
}
.trix-picker-header {
    padding: 14px 16px; border-bottom: 1px solid #282830; background: #1b1b22;
    display: flex; flex-direction: column; gap: 10px;
}
.trix-picker-title {
    color: #e2e2e9; font-size: 13px; font-weight: 600; text-align: center;
    margin: 0; letter-spacing: 0.5px; text-transform: uppercase; opacity: 0.8;
}
.trix-picker-manual-container {
    display: flex; flex-direction: column; gap: 4px;
}
.trix-picker-manual-label {
    color: #777; font-size: 10px; font-weight: 600; text-transform: uppercase;
}
.trix-picker-manual-row {
    display: flex; gap: 6px; align-items: center; width: 100%;
}
.trix-picker-manual-input {
    flex: 1; min-width: 0; background: #101014; border: 1px solid #282832; color: #e2e2e9;
    padding: 6px 10px; border-radius: 4px; font-size: 12px; outline: none;
    box-sizing: border-box; transition: border-color 0.2s, background-color 0.2s;
    font-family: monospace;
}
.trix-picker-manual-input:focus {
    border-color: #387aff; background: #0c0c0f;
}
.trix-picker-search {
    width: 100%; background: #101014; border: 1px solid #282832; color: #e2e2e9;
    padding: 6px 10px; border-radius: 4px; font-size: 12px; outline: none;
    box-sizing: border-box; transition: border-color 0.2s, background-color 0.2s;
}
.trix-picker-search:focus {
    border-color: #387aff; background: #0c0c0f;
}
.trix-picker-list {
    flex: 1; overflow-y: auto; padding: 10px; margin: 0; list-style: none;
    background: #141418;
}
.trix-group-header {
    padding: 8px 12px; background: #1d1d24; border: 1px solid #2c2c36;
    color: #a0a0b0; font-weight: 600; font-size: 12px; cursor: pointer;
    display: flex; justify-content: space-between; align-items: center;
    border-radius: 6px; margin-bottom: 4px; user-select: none;
    transition: background 0.15s, color 0.15s;
}
.trix-group-header:hover {
    background: #25252e; color: #e2e2e9;
}
.trix-group-header .arrow {
    font-size: 10px; color: #666; transition: transform 0.2s;
}
.trix-group-header.active .arrow {
    transform: rotate(90deg); color: #387aff;
}
.trix-group-content {
    display: none; padding: 4px 0 8px 0;
}
.trix-group-content.open {
    display: block;
}
.trix-picker-item {
    padding: 6px 12px; border-radius: 4px; cursor: pointer;
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 2px; transition: background 0.15s, border-color 0.15s;
    border: 1px solid transparent;
}
.trix-picker-item:hover {
    background: #1b1b22;
}
.trix-picker-item.selected {
    background: #1c2536; border-color: #273b54;
}
.trix-item-title {
    color: #d1d1db; font-size: 12px; font-weight: 500;
    display: flex; align-items: center;
}
.trix-item-indicator {
    display: inline-block; width: 6px; height: 6px;
    background-color: #387aff; border-radius: 50%;
    margin-right: 6px; vertical-align: middle;
}
.trix-item-meta {
    font-size: 10px; color: #626270; font-family: monospace;
}
.trix-picker-footer {
    padding: 10px 16px; border-top: 1px solid #282830; background: #1b1b22;
    display: flex; justify-content: flex-end; gap: 6px;
}
.trix-btn {
    padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: 500;
    cursor: pointer; outline: none; border: none; transition: background 0.15s;
}
.trix-btn-primary {
    background: #387aff; color: #fff;
}
.trix-btn-primary:hover {
    background: #5c93ff;
}
.trix-btn-secondary {
    background: #25252e; color: #a0a0b0;
}
.trix-btn-secondary:hover {
    background: #2d2d38; color: #ccc;
}
.trix-picker-list::-webkit-scrollbar {
    width: 4px;
}
.trix-picker-list::-webkit-scrollbar-track {
    background: transparent;
}
.trix-picker-list::-webkit-scrollbar-thumb {
    background: #282830; border-radius: 2px;
}
.trix-picker-warning {
    background: rgba(220, 76, 76, 0.08);
    border: 1px solid rgba(220, 76, 76, 0.18);
    padding: 10px 12px;
    margin: 10px 10px 0 10px;
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    box-sizing: border-box;
}
.trix-picker-warning-text {
    color: #ff6b6b;
    font-size: 11px;
    font-weight: 600;
    line-height: 1.4;
}
.trix-picker-warning-actions {
    display: flex;
    gap: 8px;
}
.trix-btn-warning-action {
    padding: 5px 10px;
    font-size: 10px;
    border-radius: 4px;
    cursor: pointer;
    border: none;
    font-weight: 600;
    transition: background 0.15s, color 0.15s;
    outline: none;
}
.trix-btn-clear-missing {
    background: rgba(220, 76, 76, 0.15);
    color: #ff8888;
}
.trix-btn-clear-missing:hover {
    background: rgba(220, 76, 76, 0.28);
    color: #ffaaaa;
}
.trix-btn-smart-search {
    background: #387aff;
    color: #fff;
}
.trix-btn-smart-search:hover {
    background: #5c93ff;
}
`;

let _stylesInjected = false;
function injectBypasserStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    const styleEl = document.createElement("style");
    styleEl.innerHTML = TRIX_CSS;
    document.head.appendChild(styleEl);
}

// =========================================================
// 4. WORKSPACE NODE UTILITIES & GRAPH NAVIGATION
// =========================================================
function _trixGetInnerGraph(n) {
    if (!n) return null;
    return n.getInnerGraph ? n.getInnerGraph() : (n.innerGraph || n.subgraph || null);
}

function findNodeById(id) {
    id = String(id).trim();
    if (!id) return null;

    if (id.includes(":")) {
        const parts = id.split(":");
        let currentGraph = app.graph;
        let node = null;
        for (const pid of parts) {
            if (!currentGraph) return null;
            node = currentGraph.getNodeById ? currentGraph.getNodeById(parseInt(pid)) : null;
            if (!node) {
                const nodes = currentGraph._nodes || currentGraph.nodes || [];
                node = nodes.find(n => n.id == pid);
            }
            if (!node) return null;
            currentGraph = _trixGetInnerGraph(node);
        }
        return node;
    } else {
        const numericId = parseInt(id);
        if (!isNaN(numericId)) {
            if (app.graph && app.graph.getNodeById) {
                const n = app.graph.getNodeById(numericId);
                if (n) return n;
            }
        }
        return findNodeRecursively(app.graph, id);
    }
}

function findNodeRecursively(graph, id) {
    if (!graph) return null;
    const nodes = graph._nodes || graph.nodes || [];
    for (const n of nodes) {
        if (String(n.id) === String(id)) return n;
        const inner = _trixGetInnerGraph(n);
        if (inner) {
            const found = findNodeRecursively(inner, id);
            if (found) return found;
        }
    }
    return null;
}

// =========================================================
// 4b. GROUP TARGET HELPERS
// =========================================================
function _trixFindGroupByToken(token) {
    if (!token || typeof token !== "string") return null;
    const parts = token.split(":").map(s => s.trim()).filter(Boolean);
    if (parts.length === 0) return null;

    let currentGraph = app.graph;
    for (let i = 0; i < parts.length - 1; i++) {
        if (!currentGraph) return null;
        const pid = parts[i];
        const nodeId = parseInt(pid);
        const subgraphNode = currentGraph.getNodeById
            ? currentGraph.getNodeById(nodeId)
            : (currentGraph._nodes || currentGraph.nodes || []).find(n => n.id == pid);
        if (!subgraphNode) return null;
        currentGraph = _trixGetInnerGraph(subgraphNode);
    }
    if (!currentGraph) return null;

    const groupId = parseInt(parts[parts.length - 1]);
    const groups = currentGraph._groups || currentGraph.groups || [];
    return groups.find(g => g.id == groupId) || null;
}

function _trixGetGroupMembers(token) {
    const group = _trixFindGroupByToken(token);
    if (!group) return [];
    try { if (group.recomputeInsideNodes) group.recomputeInsideNodes(); } catch (e) {}
    return Array.from(group._nodes || group.nodes || []);
}

function _trixFindAllGroups(graph, chain = [], currentPath = "Root") {
    let list = [];
    if (!graph) return list;
    const groups = graph._groups || graph.groups || [];
    for (const g of groups) {
        if (g.id == null) continue;
        const myChain = [...chain, g.id];
        const token = myChain.join(":");
        const title = g.title || `Group ${g.id}`;
        list.push({ token, title, path: currentPath, graph });
    }
    const nodes = graph._nodes || graph.nodes || [];
    for (const n of nodes) {
        const inner = _trixGetInnerGraph(n);
        if (inner) {
            const subPath = currentPath === "Root" ? (n.title || n.type || `Node ${n.id}`) : `${currentPath} > ${n.title || n.type || n.id}`;
            list = list.concat(_trixFindAllGroups(inner, [...chain, n.id], subPath));
        }
    }
    return list;
}

function _trixIsGroupTarget(target) {
    return !!(target && target.kind === "group");
}

function _trixValueIsGroupToken(token) {
    return !!_trixFindGroupByToken(token);
}

function _trixFindAllNodesRecursively(graph, currentPath = "Root", chain = []) {
    let list = [];
    if (!graph) return list;
    const nodes = graph._nodes || graph.nodes || [];
    for (const n of nodes) {
        if (!n.id) continue;
        const comfyClass = n.comfyClass || n.type || "";
        const lowerClass = comfyClass.toLowerCase();
        
        if (lowerClass === "trixbypasser" || lowerClass === "trixbypassersimple" || lowerClass === "primitive" || lowerClass === "reroute" || lowerClass.includes("note") || lowerClass.includes("remotecontrol") || lowerClass.includes("remotestate") || lowerClass.includes("mutebypass")) {
            continue;
        }
        
        const title = n.title || n.type || `Node ${n.id}`;
        const myChain = [...chain, n.id];
        const key = myChain.join(":");
        
        list.push({
            id: String(n.id),
            key: key,
            title: title,
            type: comfyClass,
            path: currentPath
        });
        
        const inner = _trixGetInnerGraph(n);
        if (inner) {
            const nextPath = currentPath === "Root" ? title : `${currentPath} > ${title}`;
            list = list.concat(_trixFindAllNodesRecursively(inner, nextPath, myChain));
        }
    }
    return list;
}

function _trixGetAllGraphNodes(graph) {
    let list = [];
    if (!graph) return list;
    const nodes = graph._nodes || graph.nodes || [];
    for (const n of nodes) {
        if (!n.id) continue;
        list.push(n);
        const inner = _trixGetInnerGraph(n);
        if (inner) {
            list = list.concat(_trixGetAllGraphNodes(inner));
        }
    }
    return list;
}

function _trixResolveNodeTitles(val, node, target) {
    if (!val || !val.trim()) return "";
    const ids = val.split(",").map(s => s.trim()).filter(Boolean);
    if (ids.length === 0) return "";
    
    if (node && node.properties) {
        if (!node.properties.trixNodeCache) {
            node.properties.trixNodeCache = {};
        }
    }
    
    const activeTitles = [];
    const activeIds = [];
    
    ids.forEach((id) => {
        if (_trixIsGroupTarget(target) || _trixValueIsGroupToken(id)) {
            const group = _trixFindGroupByToken(id);
            if (group) {
                try { if (group.recomputeInsideNodes) group.recomputeInsideNodes(); } catch (e) {}
                const members = Array.from(group._nodes || group.nodes || []);
                const title = (group.title || `Group ${id}`) + ` (${members.length})`;
                activeIds.push(id);
                activeTitles.push(title);
            }
            return;
        }

        const targetNode = findNodeById(id);
        if (targetNode) {
            const title = targetNode.title || targetNode.type || `Node ${id}`;
            if (node && node.properties && node.properties.trixNodeCache) {
                const upstream = [];
                if (targetNode.inputs) {
                    targetNode.inputs.forEach((slot, slotIdx) => {
                        if (slot.link !== undefined && slot.link !== null) {
                            const link = app.graph.links ? app.graph.links[slot.link] : null;
                            if (link) {
                                upstream.push({
                                    nodeId: String(link.origin_id),
                                    slot: slotIdx,
                                    type: slot.type
                                });
                            }
                        }
                    });
                }
                
                const downstream = [];
                if (targetNode.outputs) {
                    targetNode.outputs.forEach((slot, slotIdx) => {
                        if (slot.links && slot.links.length > 0) {
                            slot.links.forEach(linkId => {
                                const link = app.graph.links ? app.graph.links[linkId] : null;
                                if (link) {
                                    downstream.push({
                                        nodeId: String(link.target_id),
                                        slot: slotIdx,
                                        type: slot.type
                                    });
                                }
                            });
                        }
                    });
                }

                node.properties.trixNodeCache[id] = {
                    type: targetNode.type || targetNode.comfyClass || "",
                    title: title,
                    inputs: targetNode.inputs?.map(i => i.type) || [],
                    outputs: targetNode.outputs?.map(o => o.type) || [],
                    pos: targetNode.pos ? [targetNode.pos[0], targetNode.pos[1]] : [0, 0],
                    upstream: upstream,
                    downstream: downstream
                };
            }
            activeIds.push(id);
            activeTitles.push(title);
        }
    });
    
    if (activeIds.length === 0) {
        return "";
    }
    
    return `${activeIds.join(", ")} | ${activeTitles.join(", ")}`;
}

function _trixGetGlobalUsedNodeIds() {
    const usedNodeIds = new Set();
    const allNodes = _trixGetAllGraphNodes(app.graph);
    allNodes.forEach((n) => {
        if (n.type === "TrixBypasser" && n.properties && n.properties.trixBypasserState) {
            n.properties.trixBypasserState.groups.forEach((g) => {
                g.targets.forEach((t) => {
                    if (t.value) {
                        t.value.split(",").map(s => s.trim()).filter(Boolean).forEach(id => usedNodeIds.add(id));
                    }
                });
            });
        } else if (n.type === "TrixBypasserSimple" && n.properties && n.properties.trixBypasserState) {
            n.properties.trixBypasserState.targets.forEach((t) => {
                if (t.value) {
                    t.value.split(",").map(s => s.trim()).filter(Boolean).forEach(id => usedNodeIds.add(id));
                }
            });
        }
    });
    return usedNodeIds;
}

function _trixScoreCandidate(cachedInfo, candidate, missingId) {
    let score = 0;
    
    const candType = (candidate.type || candidate.comfyClass || "").toLowerCase();
    const cachedType = (cachedInfo.type || "").toLowerCase();
    if (candType && cachedType) {
        if (candType === cachedType) {
            score += 30;
        } else {
            const cleanCand = candType.replace(/[^a-z0-9]/g, "");
            const cleanCached = cachedType.replace(/[^a-z0-9]/g, "");
            if (cleanCand.includes(cleanCached) || cleanCached.includes(cleanCand)) {
                score += 15;
            } else {
                const keywords = ["cfg", "sampler", "vae", "loader", "model", "latent", "image", "upscale", "noise"];
                for (const kw of keywords) {
                    if (candType.includes(kw) && cachedType.includes(kw)) {
                        score += 15;
                        break;
                    }
                }
            }
        }
    }
    
    const candTitle = (candidate.title || candType).toLowerCase();
    const cachedTitle = (cachedInfo.title || "").toLowerCase();
    if (candTitle && cachedTitle) {
        if (candTitle === cachedTitle) {
            score += 15;
        } else if (candTitle.includes(cachedTitle) || cachedTitle.includes(candTitle)) {
            score += 8;
        }
    }
    
    const candInputs = candidate.inputs?.map(i => i.type) || [];
    const candOutputs = candidate.outputs?.map(o => o.type) || [];
    
    let inputMatches = 0;
    if (cachedInfo.inputs && cachedInfo.inputs.length > 0) {
        cachedInfo.inputs.forEach(inType => {
            if (candInputs.includes(inType)) inputMatches++;
        });
        score += (inputMatches / cachedInfo.inputs.length) * 15;
    }
    
    let outputMatches = 0;
    if (cachedInfo.outputs && cachedInfo.outputs.length > 0) {
        cachedInfo.outputs.forEach(outType => {
            if (candOutputs.includes(outType)) outputMatches++;
        });
        score += (outputMatches / cachedInfo.outputs.length) * 15;
    }
    
    if (cachedInfo.pos && candidate.pos) {
        const dx = candidate.pos[0] - cachedInfo.pos[0];
        const dy = candidate.pos[1] - cachedInfo.pos[1];
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 40) {
            score += 30;
        } else if (dist < 150) {
            score += 15;
        } else if (dist < 400) {
            score += 5;
        }
    }
    
    if (missingId && candidate.id) {
        const idDiff = Math.abs(parseInt(candidate.id) - parseInt(missingId));
        if (!isNaN(idDiff)) {
            if (idDiff === 1) {
                score += 25;
            } else if (idDiff <= 3) {
                score += 12;
            } else if (idDiff <= 10) {
                score += 6;
            }
        }
    }
    
    let topologyScore = 0;
    if (cachedInfo.upstream && cachedInfo.upstream.length > 0) {
        const candUpstreamNodeIds = [];
        if (candidate.inputs) {
            candidate.inputs.forEach(slot => {
                if (slot.link !== undefined && slot.link !== null) {
                    const link = app.graph.links ? app.graph.links[slot.link] : null;
                    if (link) {
                        candUpstreamNodeIds.push(String(link.origin_id));
                    }
                }
            });
        }
        
        cachedInfo.upstream.forEach(up => {
            if (candUpstreamNodeIds.includes(String(up.nodeId))) {
                topologyScore += 15;
            }
        });
    }
    
    if (cachedInfo.downstream && cachedInfo.downstream.length > 0) {
        const candDownstreamNodeIds = [];
        if (candidate.outputs) {
            candidate.outputs.forEach(slot => {
                if (slot.links && slot.links.length > 0) {
                    slot.links.forEach(linkId => {
                        const link = app.graph.links ? app.graph.links[linkId] : null;
                        if (link) {
                            candDownstreamNodeIds.push(String(link.target_id));
                        }
                    });
                }
            });
        }
        
        cachedInfo.downstream.forEach(down => {
            if (candDownstreamNodeIds.includes(String(down.nodeId))) {
                topologyScore += 15;
            }
        });
    }
    score += Math.min(30, topologyScore);
    
    return Math.min(100, Math.round(score));
}

function _trixGetSmartSearchCandidates(bypasserNode, missingId) {
    const cache = bypasserNode.properties?.trixNodeCache || {};
    const cachedInfo = cache[missingId];
    if (!cachedInfo) return [];
    
    const allNodes = _trixGetAllGraphNodes(app.graph);
    const usedIds = _trixGetGlobalUsedNodeIds();
    
    const candidates = [];
    allNodes.forEach((node) => {
        if (node.type === "TrixBypasser" || node.type === "TrixBypasserSimple" || String(node.id) === String(missingId)) {
            return;
        }
        
        const score = _trixScoreCandidate(cachedInfo, node, missingId);
        if (score >= 20) {
            candidates.push({
                node: node,
                score: score,
                isAlreadyTargeted: usedIds.has(String(node.id))
            });
        }
    });
    
    candidates.sort((a, b) => b.score - a.score);
    return candidates;
}

function _trixJumpToNodes(idsString, e, isGroupKind = false) {
    if (!idsString || !idsString.trim()) return;
    const ids = idsString.split(",").map(s => s.trim()).filter(Boolean);
    if (ids.length === 0) return;

    const allEntries = _trixFindAllNodesRecursively(app.graph);
    const targetEntries = [];
    ids.forEach(id => {
        if (isGroupKind || _trixValueIsGroupToken(id)) {
            const members = _trixGetGroupMembers(id);
            members.forEach(m => {
                const entry = allEntries.find(ent => ent.id === String(m.id));
                if (entry) targetEntries.push(entry);
            });
            return;
        }
        const entry = allEntries.find(ent => ent.key === id || ent.id === id);
        if (entry) targetEntries.push(entry);
    });

    if (targetEntries.length === 0) return;

    const groups = {};
    targetEntries.forEach(ent => {
        if (!groups[ent.path]) groups[ent.path] = [];
        groups[ent.path].push(ent);
    });

    const paths = Object.keys(groups);

    const performJump = (path) => {
        const ents = groups[path];
        const firstNodeId = ents[0].key || ents[0].id;
        const targetNode = findNodeById(firstNodeId);
        if (!targetNode) return;
        
        const targetGraph = targetNode.graph || targetNode._graph;
        if (!targetGraph) return;

        const canvas = app.canvas;

        if (canvas.graph !== targetGraph) {
            if (targetGraph === app.graph) {
                if (canvas.closeSubgraph) {
                    while (canvas.graph !== app.graph && canvas.graph._subgraph_node) {
                        canvas.closeSubgraph();
                    }
                }
                canvas.setGraph(app.graph);
            } else {
                if (canvas.openSubgraph) {
                    canvas.openSubgraph(targetGraph);
                } else {
                    canvas.setGraph(targetGraph);
                }
            }
        }

        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        let validNodes = 0;

        const nodesList = targetGraph._nodes || targetGraph.nodes || [];

        ents.forEach(ent => {
            const n = targetGraph.getNodeById ? targetGraph.getNodeById(ent.id) : nodesList.find(x => String(x.id) === String(ent.id));
            if (n && n.pos) {
                validNodes++;
                minX = Math.min(minX, n.pos[0]);
                minY = Math.min(minY, n.pos[1]);
                maxX = Math.max(maxX, n.pos[0] + (n.size ? n.size[0] : 100));
                maxY = Math.max(maxY, n.pos[1] + (n.size ? n.size[1] : 100));
            }
        });

        if (validNodes === 0) return;

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const bboxWidth = maxX - minX;
        const bboxHeight = maxY - minY;

        if (validNodes === 1 || (bboxWidth < 200 && bboxHeight < 200)) {
            canvas.ds.scale = 1.0;
        } else {
            const padding = 150;
            const viewW = canvas.canvas.width - padding;
            const viewH = canvas.canvas.height - padding;
            let targetScale = Math.min(viewW / (bboxWidth || 1), viewH / (bboxHeight || 1));
            targetScale = Math.max(0.2, Math.min(targetScale, 1.0));
            canvas.ds.scale = targetScale;
        }

        canvas.ds.offset[0] = (canvas.canvas.width / 2) / canvas.ds.scale - centerX;
        canvas.ds.offset[1] = (canvas.canvas.height / 2) / canvas.ds.scale - centerY;
        canvas.setDirty(true, true);
    };

    if (paths.length === 1) {
        performJump(paths[0]);
    } else {
        const menuOptions = paths.map(path => {
            return {
                content: `𖠿 Location: ${path} (${groups[path].length} nodes)`,
                callback: () => performJump(path)
            };
        });
        
        new LiteGraph.ContextMenu(menuOptions, {
            event: e || app.canvas.graph_mouse,
            title: "Select graph to jump",
        });
    }
}

// =========================================================
// 5. MODAL DIALOGS (Node Picker, Warning Recovery, Rename)
// =========================================================
function _trixShowPickerModal(node, currentVal, onSelect, mode = "nodes") {
    const isGroupsMode = (mode === "groups");
    const entries = isGroupsMode ? [] : _trixFindAllNodesRecursively(app.graph);
    const usedNodeIds = _trixGetGlobalUsedNodeIds();
    const groupEntries = _trixFindAllGroups(app.graph);

    const groups = {};
    for (const e of entries) {
        if (!groups[e.path]) groups[e.path] = [];
        groups[e.path].push(e);
    }
    const paths = Object.keys(groups).sort((a, b) => a === "Root" ? -1 : a.localeCompare(b));

    const overlay = document.createElement("div");
    overlay.className = "trix-picker-overlay";
    
    const cleanup = () => {
        document.removeEventListener("keydown", handleKeyDown);
        overlay.remove();
    };

    const handleKeyDown = (e) => {
        if (e.key === "Escape" || e.keyCode === 27) {
            const overlays = document.querySelectorAll(".trix-picker-overlay");
            if (overlays.length > 0 && overlays[overlays.length - 1] === overlay) {
                cleanup();
            }
        }
    };
    document.addEventListener("keydown", handleKeyDown);
    
    const modal = document.createElement("div");
    modal.className = "trix-picker-modal";
    
    const header = document.createElement("div");
    header.className = "trix-picker-header";
    
    const title = document.createElement("h3");
    title.className = "trix-picker-title";
    title.textContent = isGroupsMode ? "Select Target Groups" : "Select Target Nodes";
    
    const manualContainer = document.createElement("div");
    manualContainer.className = "trix-picker-manual-container";
    
    const manualLabel = document.createElement("span");
    manualLabel.className = "trix-picker-manual-label";
    manualLabel.textContent = isGroupsMode ? "Selected Groups (ID tokens):" : "Selected Node IDs (Comma separated):";
    
    const manualRow = document.createElement("div");
    manualRow.className = "trix-picker-manual-row";
    
    const manualInput = document.createElement("input");
    manualInput.className = "trix-picker-manual-input";
    manualInput.type = "text";
    manualInput.placeholder = isGroupsMode ? "Enter group ID or click groups below..." : "Enter ID or click nodes below...";
    manualInput.value = currentVal || "";
    
    const btnPaste = document.createElement("button");
    btnPaste.className = "trix-btn trix-btn-secondary";
    btnPaste.style.padding = "5px 10px";
    btnPaste.style.fontSize = "11px";
    btnPaste.style.height = "100%";
    btnPaste.style.whiteSpace = "nowrap";
    btnPaste.textContent = "Paste";
    btnPaste.onclick = async (e) => {
        e.preventDefault();
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                const pastedIds = text.split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
                let currentIds = manualInput.value.split(",").map(s => s.trim()).filter(Boolean);
                const merged = Array.from(new Set([...currentIds, ...pastedIds]));
                manualInput.value = merged.join(", ");
                updateWarningAndRender();
            }
        } catch (err) {
            console.error("Failed to read clipboard:", err);
        }
    };
    
    manualRow.appendChild(manualInput);
    manualRow.appendChild(btnPaste);
    manualContainer.appendChild(manualLabel);
    manualContainer.appendChild(manualRow);
    
    const search = document.createElement("input");
    search.className = "trix-picker-search";
    search.placeholder = isGroupsMode ? "Search groups by title..." : "Search nodes by title or type...";
    
    header.appendChild(title);
    header.appendChild(manualContainer);
    header.appendChild(search);
    
    const warningBox = document.createElement("div");
    warningBox.className = "trix-picker-warning";
    warningBox.style.display = "none";
    
    const list = document.createElement("ul");
    list.className = "trix-picker-list";
    
    const footer = document.createElement("div");
    footer.className = "trix-picker-footer";
    
    const btnCancel = document.createElement("button");
    btnCancel.className = "trix-btn trix-btn-secondary";
    btnCancel.textContent = "Cancel";
    btnCancel.onclick = () => { cleanup(); };
    
    const btnClear = document.createElement("button");
    btnClear.className = "trix-btn trix-btn-secondary";
    btnClear.textContent = "Clear All";
    btnClear.onclick = () => {
        manualInput.value = "";
        updateWarningAndRender();
    };
    
    const btnApply = document.createElement("button");
    btnApply.className = "trix-btn trix-btn-primary";
    btnApply.textContent = "Apply";
    btnApply.onclick = () => {
        const val = manualInput.value.trim();
        onSelect(val);
        cleanup();
    };
    
    footer.appendChild(btnClear);
    footer.appendChild(btnCancel);
    footer.appendChild(btnApply);
    
    modal.appendChild(header);
    modal.appendChild(warningBox);
    modal.appendChild(list);
    modal.appendChild(footer);
    overlay.appendChild(modal);
    
    const getSelectedIds = () => {
        return manualInput.value.split(",").map(s => s.trim()).filter(Boolean);
    };
    
    const setSelectedIds = (ids) => {
        manualInput.value = ids.join(", ");
        updateWarningAndRender();
    };
    
    const render = (missingIds = [], activeIds = []) => {
        list.innerHTML = "";
        const query = search.value.toLowerCase().trim();
        const selected = getSelectedIds();

        if (isGroupsMode) {
            const byPath = {};
            groupEntries.forEach(g => {
                if (!byPath[g.path]) byPath[g.path] = [];
                byPath[g.path].push(g);
            });
            const gPaths = Object.keys(byPath).sort((a, b) => a === "Root" ? -1 : a.localeCompare(b));

            gPaths.forEach(path => {
                const rawGroups = byPath[path];
                const filteredGroups = rawGroups.filter(g => {
                    return g.title.toLowerCase().includes(query) || g.token.toLowerCase().includes(query);
                });
                if (filteredGroups.length === 0) return;

                const groupHeader = document.createElement("div");
                groupHeader.className = "trix-group-header active";
                groupHeader.style.border = "1px solid rgba(127, 217, 165, 0.25)";
                groupHeader.innerHTML = `
                    <span style="color:#7fd9a5;">▦ ${path} (${filteredGroups.length})</span>
                    <span class="arrow">▶</span>
                `;

                const groupContent = document.createElement("div");
                groupContent.className = "trix-group-content open";

                groupHeader.onclick = () => {
                    const active = groupHeader.classList.toggle("active");
                    groupContent.classList.toggle("open", active);
                };

                filteredGroups.forEach(g => {
                    const isSelected = selected.includes(g.token);
                    const members = _trixGetGroupMembers(g.token);
                    const li = document.createElement("li");
                    li.className = "trix-picker-item" + (isSelected ? " selected" : "");
                    li.innerHTML = `
                        <span class="trix-item-title"><span style="color:#7fd9a5;margin-right:6px;">▦</span>${g.title}</span>
                        <span class="trix-item-meta">ID: ${g.token} | ${members.length} node${members.length === 1 ? '' : 's'}</span>
                    `;
                    li.onclick = (ev) => {
                        ev.stopPropagation();
                        let current = getSelectedIds();
                        if (current.includes(g.token)) {
                            current = current.filter(id => id !== g.token);
                        } else {
                            current.push(g.token);
                        }
                        setSelectedIds(current);
                    };
                    groupContent.appendChild(li);
                });

                list.appendChild(groupHeader);
                list.appendChild(groupContent);
            });

            if (list.children.length === 0) {
                list.innerHTML = `<div style="padding:20px;text-align:center;color:#666;font-size:12px;">No matching groups found</div>`;
            }
            return;
        }

        // Nodes mode
        paths.forEach(path => {
            const rawItems = groups[path];
            const filteredItems = rawItems.filter(item => {
                return item.title.toLowerCase().includes(query) || 
                       item.type.toLowerCase().includes(query) ||
                       item.id.includes(query) ||
                       item.key.includes(query);
            });
            
            if (filteredItems.length === 0) return;
            
            const groupHeader = document.createElement("div");
            groupHeader.className = "trix-group-header";
            const isRoot = path === "Root";
            const isMatch = query.length > 0;
            const isOpen = isRoot || isMatch;
            
            if (isOpen) groupHeader.classList.add("active");
            
            groupHeader.innerHTML = `
                <span>𖠿 ${path} (${filteredItems.length})</span>
                <span class="arrow">▶</span>
            `;
            
            const groupContent = document.createElement("div");
            groupContent.className = "trix-group-content";
            if (isOpen) groupContent.classList.add("open");
            
            groupHeader.onclick = () => {
                const active = groupHeader.classList.toggle("active");
                groupContent.classList.toggle("open", active);
            };
            
            filteredItems.forEach(item => {
                const li = document.createElement("li");
                li.className = "trix-picker-item";
                
                const targetKey = item.key || item.id;
                const isSelected = selected.includes(targetKey) || selected.includes(item.id);
                if (isSelected) li.classList.add("selected");
                
                const isUsedGlobally = usedNodeIds.has(item.id) || usedNodeIds.has(targetKey);
                const indicatorHtml = isUsedGlobally ? `<span class="trix-item-indicator" title="Already targeted in a Bypasser"></span>` : "";
                
                li.innerHTML = `
                    <span class="trix-item-title">${indicatorHtml}${item.title}</span>
                    <span class="trix-item-meta">ID: ${item.id} | ${item.type}</span>
                `;
                
                li.onclick = (ev) => {
                    ev.stopPropagation();
                    let current = getSelectedIds();
                    const useKey = targetKey;
                    
                    if (current.includes(useKey)) {
                        current = current.filter(id => id !== useKey);
                    } else if (current.includes(item.id)) {
                        current = current.filter(id => id !== item.id);
                    } else {
                        current.push(useKey);
                    }
                    setSelectedIds(current);
                };
                
                groupContent.appendChild(li);
            });
            
            list.appendChild(groupHeader);
            list.appendChild(groupContent);
        });

        if (list.children.length === 0) {
            list.innerHTML = `<div style="padding:20px;text-align:center;color:#666;font-size:12px;">No matching nodes found</div>`;
        }
    };
    
    const updateWarningAndRender = () => {
        const selected = getSelectedIds();
        const existsCheck = (id) => isGroupsMode ? !!_trixFindGroupByToken(id) : !!findNodeById(id);
        const missing = selected.filter(id => !existsCheck(id));
        const active = selected.filter(id => existsCheck(id));
        
        if (missing.length > 0) {
            warningBox.style.display = "flex";
            warningBox.innerHTML = `
                <div class="trix-picker-warning-text">
                    ⚠️ Warning: ${missing.length} targeted ${isGroupsMode ? 'group(s)' : 'node(s)'} no longer exist (IDs: ${missing.join(", ")}).
                </div>
                <div class="trix-picker-warning-actions">
                    <button class="trix-btn-warning-action trix-btn-clear-missing" id="trix-clear-missing-btn">Remove Missing IDs</button>
                </div>
            `;
            
            const btnClearMissing = warningBox.querySelector("#trix-clear-missing-btn");
            if (btnClearMissing) {
                btnClearMissing.onclick = () => {
                    setSelectedIds(active);
                };
            }
        } else {
            warningBox.style.display = "none";
        }
        
        render(missing, active);
    };

    search.oninput = () => {
        const selected = getSelectedIds();
        const existsCheck = (id) => isGroupsMode ? !!_trixFindGroupByToken(id) : !!findNodeById(id);
        render(selected.filter(id => !existsCheck(id)), selected.filter(id => existsCheck(id)));
    };
    manualInput.oninput = updateWarningAndRender;
    
    document.body.appendChild(overlay);
    
    updateWarningAndRender();
    setTimeout(() => search.focus(), 50);
}

function _trixShowWarningRecoveryModal(node, groupIndex, targetIndex) {
    const isSimple = (node.type === "TrixBypasserSimple");
    const state = node.properties.trixBypasserState;
    let target;
    if (isSimple) {
        target = state.targets[targetIndex];
    } else {
        const group = state.groups[groupIndex];
        if (!group) return;
        target = group.targets[targetIndex];
    }
    if (!target || !target.value) return;

    const ids = target.value.split(",").map(s => s.trim()).filter(Boolean);
    const missingIds = ids.filter(id => !findNodeById(id));
    const existingIds = ids.filter(id => !!findNodeById(id));
    if (missingIds.length === 0) return;

    const overlay = document.createElement("div");
    overlay.className = "trix-picker-overlay";
    
    const cleanup = () => {
        document.removeEventListener("keydown", handleKeyDown);
        overlay.remove();
    };

    const handleKeyDown = (e) => {
        if (e.key === "Escape" || e.keyCode === 27) {
            cleanup();
        }
    };
    document.addEventListener("keydown", handleKeyDown);

    const modal = document.createElement("div");
    modal.className = "trix-picker-modal";
    modal.style.width = "520px";

    const header = document.createElement("div");
    header.className = "trix-picker-header";
    header.innerHTML = `
        <h3 class="trix-picker-title" style="color:#ff6b6b;">⚠️ Target Node Recovery</h3>
        <div style="font-size:11px; color:#a0a0b0; text-align:center;">
            Missing node ID(s): <b style="color:#fff;">${missingIds.join(", ")}</b>
        </div>
    `;

    const body = document.createElement("div");
    body.className = "trix-picker-list";
    body.style.padding = "14px";

    missingIds.forEach((mId) => {
        const candidates = _trixGetSmartSearchCandidates(node, mId);
        const section = document.createElement("div");
        section.style.marginBottom = "16px";
        section.innerHTML = `
            <div style="font-weight:600; font-size:12px; color:#e2e2e9; margin-bottom:8px;">
                Replacement suggestions for missing ID [${mId}]:
            </div>
        `;

        if (candidates.length === 0) {
            section.innerHTML += `
                <div style="font-size:11px; color:#777; font-style:italic; padding:6px 0;">
                    No confident node matches found on the canvas.
                </div>
            `;
        } else {
            const candList = document.createElement("div");
            candList.style.display = "flex";
            candList.style.flexDirection = "column";
            candList.style.gap = "4px";

            candidates.slice(0, 5).forEach((cand) => {
                const item = document.createElement("div");
                item.className = "trix-picker-item";
                item.style.background = "#1d1d24";
                item.style.border = "1px solid #2e2e38";

                const isTargetedBadge = cand.isAlreadyTargeted ? `<span style="font-size:9px; background:#2e2e38; color:#888; padding:2px 5px; border-radius:3px; margin-left:6px;">Already in Bypasser</span>` : "";

                item.innerHTML = `
                    <div style="display:flex; flex-direction:column; gap:2px;">
                        <span class="trix-item-title">
                            ${cand.node.title || cand.node.type || `Node ${cand.node.id}`} ${isTargetedBadge}
                        </span>
                        <span class="trix-item-meta">ID: ${cand.node.id} | Type: ${cand.node.type || cand.node.comfyClass}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:11px; font-weight:700; color:#387aff;">${cand.score}% match</span>
                        <button class="trix-btn trix-btn-primary" style="padding:4px 8px; font-size:10px;">Select</button>
                    </div>
                `;

                const btnSelect = item.querySelector("button");
                btnSelect.onclick = () => {
                    const newTargetVal = ids.map(id => (id === mId ? String(cand.node.id) : id)).join(", ");
                    target.value = newTargetVal;
                    _trixEnforceLogic(node);
                    TrixBypasserDOMRenderer.render(node, false);
                    cleanup();
                };

                candList.appendChild(item);
            });
            section.appendChild(candList);
        }
        body.appendChild(section);
    });

    const footer = document.createElement("div");
    footer.className = "trix-picker-footer";

    const btnClearMissing = document.createElement("button");
    btnClearMissing.className = "trix-btn trix-btn-secondary";
    btnClearMissing.textContent = "Remove Missing IDs";
    btnClearMissing.onclick = () => {
        target.value = existingIds.join(", ");
        _trixEnforceLogic(node);
        TrixBypasserDOMRenderer.render(node, false);
        cleanup();
    };

    const btnClose = document.createElement("button");
    btnClose.className = "trix-btn trix-btn-primary";
    btnClose.textContent = "Close";
    btnClose.onclick = () => cleanup();

    footer.appendChild(btnClearMissing);
    footer.appendChild(btnClose);

    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

function _trixShowRenameModal(titleText, currentValue, onApply) {
    const overlay = document.createElement("div");
    overlay.className = "trix-picker-overlay";
    
    const cleanup = () => {
        document.removeEventListener("keydown", handleKeyDown);
        overlay.remove();
    };
    
    const handleKeyDown = (e) => {
        if (e.key === "Escape" || e.keyCode === 27) {
            const overlays = document.querySelectorAll(".trix-picker-overlay");
            if (overlays.length > 0 && overlays[overlays.length - 1] === overlay) {
                cleanup();
            }
        }
    };
    document.addEventListener("keydown", handleKeyDown);
    
    const modal = document.createElement("div");
    modal.className = "trix-picker-modal";
    modal.style.width = "340px";
    modal.style.maxHeight = "220px";
    
    const header = document.createElement("div");
    header.className = "trix-picker-header";
    
    const title = document.createElement("h3");
    title.className = "trix-picker-title";
    title.textContent = titleText;
    header.appendChild(title);
    
    const body = document.createElement("div");
    body.style.padding = "18px 16px";
    body.style.background = "#141418";
    body.style.display = "flex";
    body.style.flexDirection = "column";
    body.style.gap = "8px";
    
    const label = document.createElement("span");
    label.className = "trix-picker-manual-label";
    label.textContent = "Enter new name:";
    body.appendChild(label);
    
    const input = document.createElement("input");
    input.className = "trix-picker-manual-input";
    input.type = "text";
    input.value = currentValue;
    input.style.width = "100%";
    input.style.boxSizing = "border-box";
    input.style.fontFamily = "'Segoe UI', -apple-system, sans-serif";
    body.appendChild(input);
    
    const footer = document.createElement("div");
    footer.className = "trix-picker-footer";
    
    const btnCancel = document.createElement("button");
    btnCancel.className = "trix-btn trix-btn-secondary";
    btnCancel.textContent = "Cancel";
    btnCancel.onclick = () => { cleanup(); };
    
    const btnApply = document.createElement("button");
    btnApply.className = "trix-btn trix-btn-primary";
    btnApply.textContent = "Apply";
    const applyValue = () => {
        const val = input.value.trim();
        if (val) {
            onApply(val);
        }
        cleanup();
    };
    btnApply.onclick = applyValue;
    
    footer.appendChild(btnCancel);
    footer.appendChild(btnApply);
    
    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    overlay.appendChild(modal);
    
    input.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
            applyValue();
        }
    });
    
    document.body.appendChild(overlay);
    
    setTimeout(() => {
        input.focus();
        input.select();
    }, 50);
}

function _trixRenameGroup(node, groupIndex) {
    if (node.flags?.collapsed || node.collapsed || node.flags?.hidden) return;
    const state = node.properties.trixBypasserState;
    const group = state.groups[groupIndex];
    if (!group) return;

    _trixShowRenameModal(`Rename Group [${group.id}]`, group.name, (newName) => {
        group.name = newName;
        _trixEnforceLogic(node);
        TrixBypasserDOMRenderer.render(node, false);
    });
}

function _trixRenameTarget(node, groupIndex, targetIndex) {
    if (node.flags?.collapsed || node.collapsed || node.flags?.hidden) return;
    const state = node.properties.trixBypasserState;
    let target;
    if (groupIndex === null || groupIndex === undefined) {
        target = state.targets[targetIndex];
    } else {
        const group = state.groups[groupIndex];
        if (!group) return;
        target = group.targets[targetIndex];
    }
    if (!target) return;

    const currentName = target.name || `Target ${targetIndex + 1}`;
    _trixShowRenameModal(`Rename Target ${targetIndex + 1}`, currentName, (newName) => {
        target.name = newName;
        TrixBypasserDOMRenderer.render(node, false);
    });
}

// =========================================================
// 5b. TOGGLE SYNC (reflect manual mode changes on canvas)
// =========================================================
function _trixSyncTogglesFromNodes(node) {
    if (!node.properties || !node.properties.trixBypasserState) return false;
    const state = node.properties.trixBypasserState;
    const isSimple = (node.type === "TrixBypasserSimple");
    const offMode = state.muteMode === "mute" ? 2 : 4;
    let anyChanged = false;

    // Walks a node and all its subgraph descendants.
    // Returns { anyOff, anyNotOff } so callers can detect partial state.
    const analyzeNodes = (idList) => {
        let anyOff = false;
        let anyNotOff = false;
        for (const id of idList) {
            const targetNode = findNodeById(id);
            if (!targetNode) continue;
            const stack = [targetNode];
            while (stack.length > 0) {
                const n = stack.pop();
                if (n.mode === offMode) anyOff = true;
                else anyNotOff = true;
                const inner = _trixGetInnerGraph(n);
                if (inner) {
                    const innerNodes = inner._nodes || inner.nodes || [];
                    for (let i = innerNodes.length - 1; i >= 0; i--) stack.push(innerNodes[i]);
                }
            }
        }
        return { anyOff, anyNotOff };
    };

    const computeTargetPartial = (target, expectedActive) => {
        if (!target.value || !target.value.trim()) return false;
        let ids;
        if (_trixIsGroupTarget(target)) {
            const tokens = target.value.split(",").map(s => s.trim()).filter(Boolean);
            ids = [];
            tokens.forEach(tok => {
                _trixGetGroupMembers(tok).forEach(m => ids.push(String(m.id)));
            });
        } else {
            ids = target.value.split(",").map(s => s.trim()).filter(Boolean);
        }
        if (ids.length === 0) return false;
        const { anyOff, anyNotOff } = analyzeNodes(ids);
        return expectedActive ? anyOff : anyNotOff;
    };

    if (isSimple) {
        if (!state.targets) return false;
        state.targets.forEach((t) => {
            const expectedActive = (state.selectMode === "single") 
                ? (state.targets.find(x => x.active) === t)
                : t.active;
            const newPartial = computeTargetPartial(t, expectedActive);
            if (t.partial !== newPartial) { t.partial = newPartial; anyChanged = true; }
        });
    } else {
        if (!state.groups) return false;
        state.groups.forEach((g) => {
            let isGroupActive = g.active;
            if (state.selectMode === "single") {
                const activeGroup = state.groups.find(x => x.active);
                isGroupActive = activeGroup ? (g.id === activeGroup.id) : false;
            }

            if (!g.targets) {
                if (g.partial) { g.partial = false; anyChanged = true; }
                return;
            }
            let groupPartial = false;
            g.targets.forEach((t) => {
                const expectedActive = isGroupActive && t.active;
                const newPartial = computeTargetPartial(t, expectedActive);
                if (t.partial !== newPartial) { t.partial = newPartial; anyChanged = true; }
                if (newPartial) groupPartial = true;
            });
            if (g.partial !== groupPartial) { g.partial = groupPartial; anyChanged = true; }
        });
    }

    return anyChanged;
}

// =========================================================
// 6. CORE LOGIC ENGINE (Mute / Bypass Mode Enforcement)
// =========================================================
function _trixEnforceLogic(node) {
    if (!node.properties || !node.properties.trixBypasserState) return;
    const state = node.properties.trixBypasserState;
    const currentTargets = new Map();
    
    const isSimple = (node.type === "TrixBypasserSimple");

    // Expand group targets into their current member node IDs
    const _expandTargetValue = (target) => {
        const val = target.value || "";
        if (!val.trim()) return [];
        if (_trixIsGroupTarget(target)) {
            const tokens = val.split(",").map(s => s.trim()).filter(Boolean);
            const out = [];
            tokens.forEach(tok => {
                const members = _trixGetGroupMembers(tok);
                members.forEach(m => out.push(String(m.id)));
            });
            return out;
        }
        return val.split(",").map(s => s.trim()).filter(Boolean);
    };

    if (isSimple) {
        if (state.targets) {
            state.targets.forEach((target) => {
                const ids = _expandTargetValue(target);
                if (ids.length === 0) return;
                
                let isTargetActive = target.active;
                if (state.selectMode === "single") {
                    const activeTarget = state.targets.find(t => t.active);
                    isTargetActive = activeTarget ? (target === activeTarget) : false;
                }
                
                const requiredMode = isTargetActive ? 0 : (state.muteMode === "mute" ? 2 : 4);
                
                ids.forEach((id) => {
                    if (currentTargets.has(id)) {
                        const existing = currentTargets.get(id);
                        if (existing !== 0 && requiredMode === 0) {
                            currentTargets.set(id, 0);
                        }
                    } else {
                        currentTargets.set(id, requiredMode);
                    }
                });
            });
        }
    } else {
        if (state.groups) {
            state.groups.forEach((group) => {
                let isGroupActive = group.active;
                if (state.selectMode === "single") {
                    const activeGroup = state.groups.find(g => g.active);
                    isGroupActive = activeGroup ? (group.id === activeGroup.id) : false;
                }

                group.targets.forEach((target) => {
                    const ids = _expandTargetValue(target);
                    if (ids.length === 0) return;
                    
                    const isTargetActive = isGroupActive && target.active;
                    const requiredMode = isTargetActive ? 0 : (state.muteMode === "mute" ? 2 : 4);
                    
                    ids.forEach((id) => {
                        if (currentTargets.has(id)) {
                            const existing = currentTargets.get(id);
                            if (existing !== 0 && requiredMode === 0) {
                                currentTargets.set(id, 0);
                            }
                        } else {
                            currentTargets.set(id, requiredMode);
                        }
                    });
                });
            });
        }
    }

    // =====================================================================
    // SUBGRAPH EXPANSION
    // ---------------------------------------------------------------------
    // When a target node is a subgraph (has an inner graph), the parent's
    // required mode is propagated to ALL descendant nodes inside it, so
    // bypassing or muting a subgraph actually skips its inner work instead
    // of leaving the inner nodes running.
    //
    // Descendants are keyed by hierarchical id ("subgraphId:innerId:...")
    // so they don't collide with direct target ids stored in
    // trixBypasserOriginalModes.
    // =====================================================================
    const effectiveTargets = new Map(); // hierId -> { node, mode }
    const directTargetNodes = new Set();

    for (const [id, reqMode] of currentTargets.entries()) {
        const targetNode = findNodeById(id);
        if (targetNode) {
            effectiveTargets.set(id, { node: targetNode, mode: reqMode });
            directTargetNodes.add(targetNode);
        }
    }

    // BFS into every subgraph node. If a descendant is itself an explicit
    // direct target, its own required mode wins (we skip inheriting).
    const _bfsQueue = [];
    for (const [id, entry] of effectiveTargets.entries()) {
        _bfsQueue.push({ node: entry.node, mode: entry.mode, hierId: id });
    }
    while (_bfsQueue.length > 0) {
        const { node: currentNode, mode: inheritedMode, hierId: currentHierId } = _bfsQueue.shift();
        const inner = _trixGetInnerGraph(currentNode);
        if (!inner) continue;
        const innerNodes = inner._nodes || inner.nodes || [];
        for (const child of innerNodes) {
            // Child is itself a direct target -> its own mode wins, don't inherit.
            if (directTargetNodes.has(child)) continue;
            const childHierId = `${currentHierId}:${child.id}`;
            if (effectiveTargets.has(childHierId)) continue; // multi-parent guard
            effectiveTargets.set(childHierId, { node: child, mode: inheritedMode });
            _bfsQueue.push({ node: child, mode: inheritedMode, hierId: childHierId });
        }
    }

    const lastTargeted = node._trixLastTargeted || new Map(); // hierId -> { node, mode }

    // 1. Restore nodes that are no longer targeted (direct + descendants)
    for (const [hierId, prevEntry] of lastTargeted.entries()) {
        if (!effectiveTargets.has(hierId)) {
            const targetNode = (prevEntry && prevEntry.node && prevEntry.node.mode !== undefined)
                ? prevEntry.node
                : findNodeById(hierId);
            if (targetNode) {
                const orig = node.properties.trixBypasserOriginalModes[hierId] ?? 0;
                if (targetNode.mode !== orig) {
                    targetNode.mode = orig;
                    if (targetNode.setDirtyCanvas) targetNode.setDirtyCanvas(true, true);
                }
            }
            delete node.properties.trixBypasserOriginalModes[hierId];
        }
    }

    // 2. Apply modes to current targets (direct + subgraph descendants)
    let changed = false;
    for (const [hierId, entry] of effectiveTargets.entries()) {
        const targetNode = entry.node;
        const reqMode = entry.mode;
        if (node.properties.trixBypasserOriginalModes[hierId] === undefined) {
            node.properties.trixBypasserOriginalModes[hierId] = targetNode.mode;
        }
        if (targetNode.mode !== reqMode) {
            targetNode.mode = reqMode;
            if (targetNode.setDirtyCanvas) targetNode.setDirtyCanvas(true, true);
            changed = true;
        }
    }

    node._trixLastTargeted = effectiveTargets;
    if (changed && app.canvas) {
        app.canvas.setDirty(true, true);
    }
}

// =========================================================
// 7. TRIX BYPASSER DOM RENDERER CLASS (NODES 2.0 STANDARD)
// =========================================================
export class TrixBypasserDOMRenderer {
    /**
     * Mounts the DOM widget onto the node
     */
    static mount(node) {
        injectBypasserStyles();

        if (node._trixDomRoot) {
            this.render(node, false);
            return node._trixDomWidget;
        }

        const root = document.createElement("div");
        root.className = "trix-bp-root";
        root.dataset.mode = "full";
        node._trixDomRoot = root;

        installCanvasZoomPassthrough(root);

        // Responsive width observer for smart header labels
        const updateMode = (w) => {
            const newMode = w >= 340 ? "full" : (w >= 260 ? "short" : "icon");
            if (root.dataset.mode !== newMode) {
                root.dataset.mode = newMode;
            }
        };

        // Auto-fit node height to exact DOM content via ResizeObserver (TrixPromptAIO Architecture)
        const ro = new ResizeObserver((entries) => {
            for (const entry of entries) {
                updateMode(entry.contentRect.width);
                const domH = root.offsetHeight > 0 ? root.offsetHeight : (root.scrollHeight > 0 ? root.scrollHeight : entry.contentRect.height);
                if (domH > 0 && !node.flags?.collapsed) {
                    const targetH = Math.ceil(domH + 28);
                    if (node.size && node.size[1] !== targetH) {
                        const curW = Math.max(node.size[0] || 240, 240);
                        if (node.setSize) {
                            node.setSize([curW, targetH]);
                        } else if (node.size) {
                            node.size[1] = targetH;
                        }
                        if (node.setDirtyCanvas) node.setDirtyCanvas(true, true);
                    }
                }
            }
        });
        ro.observe(root);
        node._trixResizeObs = ro;

        // Click / Action event delegation
        root.addEventListener("click", (e) => {
            const actEl = e.target.closest("[data-act]");
            if (!actEl) return;
            e.stopPropagation();
            const act = actEl.dataset.act;
            this.handleAction(node, act, actEl, e);
        });

        // Attach native Drag & Drop for reordering
        this._attachDragAndDrop(node, root);

        // Register DOM Widget
        const widget = node.addDOMWidget("bypasser_dom_ui", "trix_bypasser_dom_widget", root, {
            getValue: () => node.properties?.trixBypasserState || null,
            setValue: () => {},
            getMinHeight: () => this.calculateHeight(node),
            margin: 4,
            serialize: false,
        });

        // Pixaroma Standard: computeLayoutSize and computeSize preserve current node width
        widget.computeSize = (w) => [Math.max(w || node.size?.[0] || 240, node.size?.[0] || 240), this.calculateHeight(node)];
        widget.computeLayoutSize = () => ({
            minHeight: this.calculateHeight(node),
            minWidth: Math.max(node.size?.[0] || 240, 240),
        });

        // Nodes 1.0 (LiteGraph classic) canvas positioning hook
        const origDraw = widget.draw;
        widget.draw = function(ctx, n, widget_width, y, H) {
            if (origDraw) origDraw.apply(this, arguments);
            if (this.element && !n.flags?.collapsed) {
                if (!isVueNodes()) {
                    const marginLeft = 4;
                    const marginRight = 4;
                    const topOffset = Math.max(y || 0, 28);
                    const curW = (n.size && n.size[0] > 0) ? n.size[0] : (widget_width || 240);
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

        applyAdaptiveCanvasOnly(widget);

        // Resize floor to lock height and prevent voids on user drag
        node._trixFloorOff = installResizeFloor(root, () => this.calculateRequiredNodeHeight(node));

        node._trixDomWidget = widget;
        this.render(node, true);
        return widget;
    }

    /**
     * Drag and drop reordering for targets, groups, and targets inside groups
     */
    static _attachDragAndDrop(node, root) {
        let draggedType = null; // "group" | "target"
        let draggedEl = null;
        let draggedGroupIdx = null;
        let draggedTargetIdx = null;

        root.ondragstart = (e) => {
            const state = node.properties?.trixBypasserState;
            if (!state || !state.deleteMode) {
                e.preventDefault();
                return;
            }

            // Do not drag when interacting with buttons/inputs/switches/pickers/delete/warning/jump
            if (e.target.closest("button, input, .trix-bp-switch, .trix-bp-row-delete, .trix-bp-row-jump, .trix-bp-row-warning, .trix-bp-row-picker")) {
                e.preventDefault();
                return;
            }

            const groupHandle = e.target.closest(".trix-bp-drag-handle.group-handle");
            const groupHeader = e.target.closest(".trix-bp-group-header");
            const groupCard = e.target.closest(".trix-bp-group-card");
            const rowEl = e.target.closest(".trix-bp-row");

            // 1. Group Dragging (grabbing groupHandle or groupHeader or groupCard without rowEl)
            if (groupHandle || (groupHeader && !rowEl) || (groupCard && !rowEl && e.target.closest(".trix-bp-group-header"))) {
                const card = groupCard || (groupHeader ? groupHeader.closest(".trix-bp-group-card") : null);
                if (!card || card.dataset.groupIdx === undefined) {
                    e.preventDefault();
                    return;
                }
                draggedType = "group";
                draggedEl = card;
                draggedGroupIdx = parseInt(card.dataset.groupIdx);
                draggedTargetIdx = null;
                setTimeout(() => {
                    if (card && draggedType === "group") card.classList.add("dragging");
                }, 0);
                if (e.dataTransfer) {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", `group:${draggedGroupIdx}`);
                }
                return;
            }

            // 2. Target Row Dragging
            if (rowEl) {
                draggedType = "target";
                draggedEl = rowEl;
                draggedGroupIdx = rowEl.dataset.groupIdx !== undefined ? parseInt(rowEl.dataset.groupIdx) : null;
                draggedTargetIdx = parseInt(rowEl.dataset.targetIdx);
                setTimeout(() => {
                    if (rowEl && draggedType === "target") rowEl.classList.add("dragging");
                }, 0);
                if (e.dataTransfer) {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", `target:${draggedGroupIdx}:${draggedTargetIdx}`);
                }
                return;
            }

            e.preventDefault();
        };

        root.ondragend = () => {
            root.querySelectorAll(".trix-bp-row, .trix-bp-group-card, .trix-bp-group-header").forEach(el => {
                el.classList.remove("dragging", "drag-over-top", "drag-over-bottom");
            });
            draggedType = null;
            draggedEl = null;
            draggedGroupIdx = null;
            draggedTargetIdx = null;
        };

        root.ondragover = (e) => {
            if (!draggedType || !draggedEl) return;
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = "move";

            if (draggedType === "group") {
                let targetCard = e.target.closest(".trix-bp-group-card");
                if (!targetCard) {
                    const cards = Array.from(root.querySelectorAll(".trix-bp-group-card"));
                    if (cards.length > 0) {
                        const lastCard = cards[cards.length - 1];
                        const lastRect = lastCard.getBoundingClientRect();
                        if (e.clientY >= lastRect.bottom - 10) {
                            targetCard = lastCard;
                        }
                    }
                }
                if (!targetCard || targetCard === draggedEl) {
                    root.querySelectorAll(".trix-bp-group-card").forEach(el => el.classList.remove("drag-over-top", "drag-over-bottom"));
                    return;
                }
                const rect = targetCard.getBoundingClientRect();
                const mid = rect.top + rect.height / 2;
                const isAbove = e.clientY < mid;

                root.querySelectorAll(".trix-bp-group-card").forEach(el => {
                    if (el === targetCard) {
                        el.classList.toggle("drag-over-top", isAbove);
                        el.classList.toggle("drag-over-bottom", !isAbove);
                    } else {
                        el.classList.remove("drag-over-top", "drag-over-bottom");
                    }
                });
            } else if (draggedType === "target") {
                const targetRow = e.target.closest(".trix-bp-row");
                const targetGroupCard = e.target.closest(".trix-bp-group-card");

                root.querySelectorAll(".trix-bp-row, .trix-bp-group-card").forEach(el => el.classList.remove("drag-over-top", "drag-over-bottom"));

                if (targetRow && targetRow !== draggedEl) {
                    const rect = targetRow.getBoundingClientRect();
                    const mid = rect.top + rect.height / 2;
                    const isAbove = e.clientY < mid;
                    targetRow.classList.toggle("drag-over-top", isAbove);
                    targetRow.classList.toggle("drag-over-bottom", !isAbove);
                } else if (!targetRow && targetGroupCard) {
                    targetGroupCard.classList.add("drag-over-bottom");
                }
            }
        };

        root.ondragleave = (e) => {
            if (!root.contains(e.relatedTarget)) {
                root.querySelectorAll(".trix-bp-row, .trix-bp-group-card").forEach(el => {
                    el.classList.remove("drag-over-top", "drag-over-bottom");
                });
            }
        };

        root.ondrop = (e) => {
            e.preventDefault();
            if (!draggedType || !draggedEl) return;
            const state = node.properties?.trixBypasserState;
            if (!state) return;
            const isSimple = (node.type === "TrixBypasserSimple");

            if (draggedType === "group") {
                const targetCard = e.target.closest(".trix-bp-group-card");
                if (!targetCard || targetCard === draggedEl) return;

                const destGroupIdx = parseInt(targetCard.dataset.groupIdx);
                if (isNaN(destGroupIdx) || isNaN(draggedGroupIdx) || destGroupIdx === draggedGroupIdx) return;

                const rect = targetCard.getBoundingClientRect();
                const isAbove = e.clientY < (rect.top + rect.height / 2);

                const groups = state.groups;
                const [movedGroup] = groups.splice(draggedGroupIdx, 1);
                let insertIdx = isAbove ? destGroupIdx : destGroupIdx + 1;
                if (draggedGroupIdx < insertIdx) insertIdx--;
                groups.splice(insertIdx, 0, movedGroup);

                // Re-index group letters (A, B, C...)
                const alphabet = "ABCDEFGHIJ";
                groups.forEach((g, idx) => {
                    const correctId = alphabet[idx] || String.fromCharCode(65 + idx);
                    if (g.name === `Group ${g.id}`) g.name = `Group ${correctId}`;
                    g.id = correctId;
                });

                _trixEnforceLogic(node);
                this.render(node, true);
                return;
            }

            if (draggedType === "target") {
                const targetRow = e.target.closest(".trix-bp-row");
                const targetGroupCard = e.target.closest(".trix-bp-group-card");

                if (isSimple) {
                    if (!targetRow || targetRow === draggedEl) return;
                    const destTargetIdx = parseInt(targetRow.dataset.targetIdx);
                    if (isNaN(destTargetIdx) || isNaN(draggedTargetIdx) || destTargetIdx === draggedTargetIdx) return;

                    const rect = targetRow.getBoundingClientRect();
                    const isAbove = e.clientY < (rect.top + rect.height / 2);

                    const targets = state.targets;
                    const [movedTarget] = targets.splice(draggedTargetIdx, 1);
                    let insertIdx = isAbove ? destTargetIdx : destTargetIdx + 1;
                    if (draggedTargetIdx < insertIdx) insertIdx--;
                    targets.splice(insertIdx, 0, movedTarget);

                    targets.forEach((t, idx) => {
                        if (!t.name || /^Target \d+$/.test(t.name) || /^Group \d+$/.test(t.name)) {
                            t.name = _trixIsGroupTarget(t) ? `Group ${idx + 1}` : `Target ${idx + 1}`;
                        }
                    });

                    _trixEnforceLogic(node);
                    this.render(node, false);
                    return;
                } else {
                    const srcGIdx = draggedGroupIdx;
                    const srcTIdx = draggedTargetIdx;
                    if (srcGIdx === null || isNaN(srcGIdx) || isNaN(srcTIdx)) return;

                    const srcGroup = state.groups[srcGIdx];
                    if (!srcGroup || !srcGroup.targets[srcTIdx]) return;

                    if (targetRow && targetRow !== draggedEl) {
                        const destGIdx = parseInt(targetRow.dataset.groupIdx);
                        const destTIdx = parseInt(targetRow.dataset.targetIdx);
                        if (isNaN(destGIdx) || isNaN(destTIdx)) return;

                        const destGroup = state.groups[destGIdx];
                        if (!destGroup) return;

                        if (srcGIdx === destGIdx) {
                            // Reorder inside same group
                            const rect = targetRow.getBoundingClientRect();
                            const isAbove = e.clientY < (rect.top + rect.height / 2);
                            const [movedTarget] = srcGroup.targets.splice(srcTIdx, 1);
                            let insertIdx = isAbove ? destTIdx : destTIdx + 1;
                            if (srcTIdx < insertIdx) insertIdx--;
                            srcGroup.targets.splice(insertIdx, 0, movedTarget);
                        } else {
                            // Move across groups
                            if (destGroup.targets.length >= 10) return;
                            const rect = targetRow.getBoundingClientRect();
                            const isAbove = e.clientY < (rect.top + rect.height / 2);
                            const [movedTarget] = srcGroup.targets.splice(srcTIdx, 1);
                            if (srcGroup.targets.length === 0) {
                                srcGroup.targets.push({ value: "", active: true, kind: "nodes" });
                            }
                            let insertIdx = isAbove ? destTIdx : destTIdx + 1;
                            destGroup.targets.splice(insertIdx, 0, movedTarget);
                        }

                        _trixEnforceLogic(node);
                        this.render(node, true);
                        return;
                    } else if (targetGroupCard && !targetRow) {
                        const destGIdx = parseInt(targetGroupCard.dataset.groupIdx);
                        if (isNaN(destGIdx) || destGIdx === srcGIdx) return;
                        const destGroup = state.groups[destGIdx];
                        if (!destGroup || destGroup.targets.length >= 10) return;

                        const [movedTarget] = srcGroup.targets.splice(srcTIdx, 1);
                        if (srcGroup.targets.length === 0) {
                            srcGroup.targets.push({ value: "", active: true, kind: "nodes" });
                        }
                        destGroup.targets.push(movedTarget);

                        _trixEnforceLogic(node);
                        this.render(node, true);
                        return;
                    }
                }
            }
        };
    }

    /**
     * Calculates height of the DOM content mathematically and deterministically.
     * Values derived from exact CSS geometry:
     *   Root: 3px pad-top + header(27px) + 2px hdr-margin + 3px flex-gap + 6px pad-bottom = 41px base
     *   Simple row: 22px height + 2px margin-bottom = 24px
     *   Group collapsed: card(30px) + margin(3px) = 33px
     *   Group expanded: card(30) + gap(2) + rows(26N-2) + btn(23) + margin(3) = 56 + 26N
     */
    static calculateHeight(node) {
        if (!node || !node.properties || !node.properties.trixBypasserState) return 40;
        const state = node.properties.trixBypasserState;
        const isSimple = (node.type === "TrixBypasserSimple");

        const hideSettings = !!state.hideSettings;
        // base: root-top(3) + header(27) + header-margin+gap(5) + root-bottom(6)
        const BASE_H = hideSettings ? 10 : 41;

        if (isSimple) {
            const targets = state.targets || [];
            const N = targets.length;
            // N rows (each 22px + 2px margin-bottom = 24px)
            return BASE_H + (N * 24);
        } else {
            const groups = state.groups || [];
            let totalH = BASE_H;
            for (const group of groups) {
                if (group.collapsed) {
                    totalH += 33; // collapsed card
                } else {
                    const N = (group.targets || []).length;
                    // rows contribute 26N-2 (flex gap+margin between rows, last row margin)
                    // button contributes 23px (gap+margin+16px+1px margin-bottom)
                    totalH += N < 10 ? (56 + 26 * N) : (53 + 26 * N);
                }
            }
            return Math.max(30, totalH);
        }
    }

    /**
     * Calculates total required node canvas height (dom widget + 28px header).
     */
    static calculateRequiredNodeHeight(node) {
        const domH = (node && node._trixDomRoot && node._trixDomRoot.offsetHeight > 0)
            ? node._trixDomRoot.offsetHeight
            : this.calculateHeight(node);
        return domH + 28;
    }

    /**
     * Fits node canvas size dynamically when items are added/removed/collapsed.
     */
    static fitNode(node, isStructural = false) {
        if (!node || node.flags?.collapsed) return;
        const reqH = this.calculateRequiredNodeHeight(node);
        const curW = Math.max(node.size?.[0] || 240, 240);

        if (node.setSize) {
            node.setSize([curW, reqH]);
        } else if (node.size) {
            node.size[0] = curW;
            node.size[1] = reqH;
        }
        if (node.setDirtyCanvas) node.setDirtyCanvas(true, true);
    }

    /**
     * Handles UI actions from DOM elements
     */
    static handleAction(node, act, actEl, e) {
        if (!node.properties || !node.properties.trixBypasserState) return;
        const state = node.properties.trixBypasserState;
        const isSimple = (node.type === "TrixBypasserSimple");

        const targetEl = actEl.closest("[data-target-idx]");
        const groupEl = actEl.closest("[data-group-idx]");
        const targetIdx = actEl.dataset.targetIdx !== undefined 
            ? parseInt(actEl.dataset.targetIdx) 
            : (targetEl ? parseInt(targetEl.dataset.targetIdx) : null);
        const groupIdx = actEl.dataset.groupIdx !== undefined 
            ? parseInt(actEl.dataset.groupIdx) 
            : (groupEl ? parseInt(groupEl.dataset.groupIdx) : null);

        // 1. Single / Multi Mode Switch
        if (act === "selectMode") {
            const mode = actEl.dataset.mode;
            if (mode && state.selectMode !== mode) {
                state.selectMode = mode;
                if (mode === "single") {
                    if (isSimple) {
                        let found = false;
                        state.targets.forEach(t => {
                            if (t.active && !found) found = true;
                            else t.active = false;
                        });
                    } else {
                        let found = false;
                        state.groups.forEach(g => {
                            if (g.active && !found) found = true;
                            else g.active = false;
                        });
                    }
                }
                _trixEnforceLogic(node);
                this.render(node, false);
            }
            return;
        }

        // 2. Mute / Bypass Mode Switch
        if (act === "muteMode") {
            const mode = actEl.dataset.mode;
            if (mode && state.muteMode !== mode) {
                state.muteMode = mode;
                _trixEnforceLogic(node);
                this.render(node, false);
            }
            return;
        }

        // 3. Add Simple Target
        if (act === "addSimpleTarget") {
            if (state.targets.length < 10) {
                const newTarget = {
                    name: `Target ${state.targets.length + 1}`,
                    value: "",
                    active: state.selectMode === "single" ? false : true,
                    kind: "nodes"
                };
                state.targets.push(newTarget);
                _trixEnforceLogic(node);
                this.render(node, true);
                _trixShowPickerModal(node, newTarget.value, (newVal) => {
                    newTarget.value = newVal;
                    _trixEnforceLogic(node);
                    this.render(node, false);
                }, "nodes");
            }
            return;
        }

        // 3b. Add Simple Group Target (+G)
        if (act === "addSimpleGroupTarget") {
            if (state.targets.length < 10) {
                const groupCount = state.targets.filter(t => t.kind === "group").length;
                const newTarget = {
                    name: `Group ${groupCount + 1}`,
                    value: "",
                    active: state.selectMode === "single" ? false : true,
                    kind: "group"
                };
                state.targets.push(newTarget);
                _trixEnforceLogic(node);
                this.render(node, true);
                _trixShowPickerModal(node, newTarget.value, (newVal) => {
                    newTarget.value = newVal;
                    _trixEnforceLogic(node);
                    this.render(node, false);
                }, "groups");
            }
            return;
        }

        // 4. Add Group
        if (act === "addGroup") {
            const alphabet = "ABCDEFGHIJ";
            const nextLetter = alphabet[state.groups.length] || String.fromCharCode(65 + state.groups.length);
            state.groups.push({
                id: nextLetter,
                name: `Group ${nextLetter}`,
                active: state.selectMode === "single" ? false : true,
                collapsed: false,
                targets: [
                    { value: "", active: true, kind: "nodes" }
                ]
            });
            _trixEnforceLogic(node);
            this.render(node, true);
            return;
        }

        // 5. Toggle Delete Mode
        if (act === "toggleDeleteMode") {
            state.deleteMode = !state.deleteMode;
            this.render(node, false);
            return;
        }

        // 6. Toggle Group Collapse
        if (act === "toggleGroupCollapse") {
            if (e.target.closest(".trix-bp-drag-handle") || actEl.closest(".trix-bp-drag-handle")) return;
            if (groupIdx !== null && state.groups[groupIdx]) {
                state.groups[groupIdx].collapsed = !state.groups[groupIdx].collapsed;
                this.render(node, true);
            }
            return;
        }

        // 7. Rename Group
        if (act === "renameGroup") {
            if (groupIdx !== null) _trixRenameGroup(node, groupIdx);
            return;
        }

        // 8. Rename Target
        if (act === "renameTarget") {
            if (targetIdx !== null) _trixRenameTarget(node, groupIdx, targetIdx);
            return;
        }

        // 9. Delete Group
        if (act === "deleteGroup") {
            if (groupIdx !== null && state.groups[groupIdx]) {
                state.groups.splice(groupIdx, 1);
                state.groups.forEach((g, idx) => {
                    const alphabet = "ABCDEFGHIJ";
                    const correctId = alphabet[idx] || String.fromCharCode(65 + idx);
                    if (g.name === `Group ${g.id}`) g.name = `Group ${correctId}`;
                    g.id = correctId;
                });
                _trixEnforceLogic(node);
                this.render(node, true);
            }
            return;
        }

        // 10. Toggle Group Active Switch
        if (act === "toggleGroupActive") {
            if (groupIdx !== null && state.groups[groupIdx]) {
                const group = state.groups[groupIdx];
                group.active = !group.active;
                if (group.active && state.selectMode === "single") {
                    state.groups.forEach((g, idx) => {
                        if (idx !== groupIdx) g.active = false;
                    });
                }
                _trixEnforceLogic(node);
                _trixSyncTogglesFromNodes(node);
                this.render(node, false);
            }
            return;
        }

        // 11. Toggle Target Switch
        if (act === "toggleTargetActive") {
            let target;
            if (isSimple) {
                target = state.targets[targetIdx];
            } else if (groupIdx !== null && state.groups[groupIdx]) {
                target = state.groups[groupIdx].targets[targetIdx];
            }
            if (target) {
                target.active = !target.active;
                if (target.active && state.selectMode === "single") {
                    if (isSimple) {
                        state.targets.forEach((t, idx) => {
                            if (idx !== targetIdx) t.active = false;
                        });
                    }
                }
                _trixEnforceLogic(node);
                _trixSyncTogglesFromNodes(node);
                this.render(node, false);
            }
            return;
        }

        // 12. Click Target Box (Open Picker Modal)
        if (act === "clickTargetBox") {
            let target;
            if (isSimple) {
                target = state.targets[targetIdx];
            } else if (groupIdx !== null && state.groups[groupIdx]) {
                target = state.groups[groupIdx].targets[targetIdx];
            }
            if (target) {
                const pickerMode = _trixIsGroupTarget(target) ? "groups" : "nodes";
                _trixShowPickerModal(node, target.value, (newVal) => {
                    target.value = newVal;
                    _trixEnforceLogic(node);
                    this.render(node, false);
                }, pickerMode);
            }
            return;
        }

        // 13. Delete Target Row
        if (act === "deleteTarget") {
            if (isSimple) {
                if (targetIdx !== null) {
                    state.targets.splice(targetIdx, 1);
                    if (state.targets.length === 0) {
                        state.targets.push({ name: "Target 1", value: "", active: true, kind: "nodes" });
                    }
                    state.targets.forEach((t, idx) => {
                        if (!t.name || /^Target \d+$/.test(t.name) || /^Group \d+$/.test(t.name)) {
                            t.name = _trixIsGroupTarget(t) ? `Group ${idx + 1}` : `Target ${idx + 1}`;
                        }
                    });
                    _trixEnforceLogic(node);
                    this.render(node, true);
                }
            } else if (groupIdx !== null && state.groups[groupIdx]) {
                const group = state.groups[groupIdx];
                if (targetIdx !== null) {
                    group.targets.splice(targetIdx, 1);
                    if (group.targets.length === 0) {
                        group.targets.push({ value: "", active: true, kind: "nodes" });
                    }
                    _trixEnforceLogic(node);
                    this.render(node, true);
                }
            }
            return;
        }

        // 14. Add Target Row Inside Group (+)
        if (act === "addTargetRow") {
            if (groupIdx !== null && state.groups[groupIdx]) {
                const group = state.groups[groupIdx];
                if (group.targets.length < 10) {
                    const newTarget = { value: "", active: true, kind: "nodes" };
                    group.targets.push(newTarget);
                    _trixEnforceLogic(node);
                    this.render(node, true);
                    _trixShowPickerModal(node, newTarget.value, (newVal) => {
                        newTarget.value = newVal;
                        _trixEnforceLogic(node);
                        this.render(node, false);
                    }, "nodes");
                }
            }
            return;
        }

        // 14b. Add Target Group Row Inside Group (+G)
        if (act === "addGroupTargetRow") {
            if (groupIdx !== null && state.groups[groupIdx]) {
                const group = state.groups[groupIdx];
                if (group.targets.length < 10) {
                    const newTarget = { value: "", active: true, kind: "group" };
                    group.targets.push(newTarget);
                    _trixEnforceLogic(node);
                    this.render(node, true);
                    _trixShowPickerModal(node, newTarget.value, (newVal) => {
                        newTarget.value = newVal;
                        _trixEnforceLogic(node);
                        this.render(node, false);
                    }, "groups");
                }
            }
            return;
        }

        // 15. Click Warning Indicator (!)
        if (act === "clickTargetWarning") {
            _trixShowWarningRecoveryModal(node, groupIdx, targetIdx);
            return;
        }

        // 16. Jump to Target (👁)
        if (act === "jumpToTarget") {
            let target;
            if (isSimple) {
                target = state.targets[targetIdx];
            } else if (groupIdx !== null && state.groups[groupIdx]) {
                target = state.groups[groupIdx].targets[targetIdx];
            }
            if (target && target.value) {
                _trixJumpToNodes(target.value, e, _trixIsGroupTarget(target));
            }
            return;
        }

        // 17. Jump to ALL Targets in Group (👁)
        if (act === "jumpToGroupTargets") {
            if (groupIdx !== null && state.groups[groupIdx]) {
                const group = state.groups[groupIdx];
                if (group.targets) {
                    group.targets.forEach(t => {
                        if (t.value) {
                            _trixJumpToNodes(t.value, e, _trixIsGroupTarget(t));
                        }
                    });
                }
            }
            return;
        }
    }

    /**
     * Renders reactive HTML representation of the node
     */
    static render(node, isStructural = false) {
        const root = node._trixDomRoot;
        if (!root) return;
        if (!node.properties || !node.properties.trixBypasserState) return;

        const state = node.properties.trixBypasserState;
        const isSimple = (node.type === "TrixBypasserSimple");

        const isSingle = (state.selectMode === "single");
        const isMute = (state.muteMode === "mute");
        const isDeleteMode = !!state.deleteMode;

        // Perform read-only sync of partial states
        _trixSyncTogglesFromNodes(node);

        let html = "";

        // --- Header Tray ---
        const hideSettings = !!state.hideSettings;
        if (!hideSettings) {
            const alphabet = "ABCDEFGHIJ";
            const letter = alphabet[state.groups?.length || 0] || String.fromCharCode(65 + (state.groups?.length || 0));
            const canAdd = isSimple ? (state.targets.length < 10) : (state.groups.length < 10);

            html += `
                <div class="trix-bp-header">
                    <div class="trix-bp-pill">
                        <button class="trix-bp-pill-btn ${isSingle ? 'active' : ''}" data-act="selectMode" data-mode="single" title="Single Mode">
                            <span class="lbl-full">Single</span>
                            <span class="lbl-short">Sngl</span>
                            <span class="lbl-icon">⛂</span>
                        </button>
                        <button class="trix-bp-pill-btn ${!isSingle ? 'active' : ''}" data-act="selectMode" data-mode="multi" title="Multi Mode">
                            <span class="lbl-full">Multi</span>
                            <span class="lbl-short">Mult</span>
                            <span class="lbl-icon">⛃</span>
                        </button>
                    </div>
                    ${isSimple ? `
                        <button class="trix-bp-btn-add" data-act="addSimpleTarget" title="Add Target (Nodes)" ${!canAdd ? 'style="opacity:0.4;cursor:default;"' : ''}>
                            <span class="lbl-full">Add ${state.targets.length + 1}</span>
                            <span class="lbl-short">+ ${state.targets.length + 1}</span>
                            <span class="lbl-icon">+</span>
                        </button>
                        <button class="trix-bp-btn-add-g" data-act="addSimpleGroupTarget" title="Add Group Target (+G)" ${!canAdd ? 'style="opacity:0.4;cursor:default;"' : ''}>
                            +G
                        </button>
                    ` : `
                        <button class="trix-bp-btn-add" data-act="addGroup" title="Add Group" ${!canAdd ? 'style="opacity:0.4;cursor:default;"' : ''}>
                            <span class="lbl-full">Add ${letter}</span>
                            <span class="lbl-short">+ ${letter}</span>
                            <span class="lbl-icon">+</span>
                        </button>
                    `}
                    <button class="trix-bp-btn-trash ${isDeleteMode ? 'active' : ''}" data-act="toggleDeleteMode" title="Toggle Edit Mode (Reorder & Delete)">
                        ${TRIX_CROSS_SVG}
                    </button>
                    <div class="trix-bp-pill">
                        <button class="trix-bp-pill-btn ${isMute ? 'active' : ''}" data-act="muteMode" data-mode="mute" title="Mute Mode">
                            <span class="lbl-full">Mute</span>
                            <span class="lbl-short">Mut</span>
                            <span class="lbl-icon">▣</span>
                        </button>
                        <button class="trix-bp-pill-btn ${!isMute ? 'active' : ''}" data-act="muteMode" data-mode="bypass" title="Bypass Mode">
                            <span class="lbl-full">Bypass</span>
                            <span class="lbl-short">Byp</span>
                            <span class="lbl-icon">◼︎</span>
                        </button>
                    </div>
                </div>
            `;
        }

        // --- Body Content ---
        if (isSimple) {
            const targets = state.targets || [];
            html += `<div class="trix-bp-body">`;
            targets.forEach((target, tIdx) => {
                const isGroupRow = _trixIsGroupTarget(target);
                let hasMissing = false;
                if (target.value) {
                    const ids = target.value.split(",").map(s => s.trim()).filter(Boolean);
                    const exists = (id) => isGroupRow ? !!_trixFindGroupByToken(id) : !!findNodeById(id);
                    hasMissing = ids.some(id => !exists(id));
                }

                const resolved = _trixResolveNodeTitles(target.value, node, target);
                let isTargetActive = target.active;
                if (isSingle) {
                    const activeTarget = targets.find(t => t.active);
                    isTargetActive = activeTarget ? (target === activeTarget) : false;
                }
                const isPartial = !!target.partial;
                const defaultLabel = isGroupRow ? `Group ${tIdx + 1}` : `Target ${tIdx + 1}`;
                const displayLabel = (isGroupRow ? "▦ " : "") + (target.name || defaultLabel);

                html += `
                    <div class="trix-bp-row" data-target-idx="${tIdx}" ${isDeleteMode ? 'draggable="true"' : ''}>
                        ${isDeleteMode ? `<span class="trix-bp-drag-handle" data-target-idx="${tIdx}" draggable="true" title="Drag to reorder">⠿</span>` : ''}
                        <div class="trix-bp-row-label ${isGroupRow ? 'group-kind' : ''}" data-act="renameTarget" data-target-idx="${tIdx}" title="Click to rename">
                            ${displayLabel}
                        </div>
                        ${hasMissing ? `<div class="trix-bp-row-warning" data-act="clickTargetWarning" data-target-idx="${tIdx}" title="${isGroupRow ? 'Group' : 'Node'} not found. Click to recover.">!</div>` : ''}
                        <div class="trix-bp-row-picker ${resolved ? '' : 'placeholder'}" data-act="clickTargetBox" data-target-idx="${tIdx}" title="${resolved || (isGroupRow ? 'Select target groups...' : 'Select target nodes...')}">
                            ${resolved || (isGroupRow ? 'Select target groups...' : 'Select target nodes...')}
                        </div>
                        <div class="trix-bp-row-jump" data-act="jumpToTarget" data-target-idx="${tIdx}" title="Jump to ${isGroupRow ? 'group nodes' : 'target nodes'}">
                            👁
                        </div>
                        <div class="trix-bp-switch ${isTargetActive ? 'active' : ''} ${isPartial ? 'partial' : ''}" data-act="toggleTargetActive" data-target-idx="${tIdx}" title="${isPartial ? (isTargetActive ? 'Partially Active (Mismatch)' : 'Partially Inactive (Mismatch)') : (isTargetActive ? 'Active' : (isMute ? 'Muted' : 'Bypassed'))}">
                            <div class="trix-bp-switch-thumb"></div>
                        </div>
                        ${isDeleteMode ? `<div class="trix-bp-row-delete" data-act="deleteTarget" data-target-idx="${tIdx}" title="Delete target">${TRIX_CROSS_SM_SVG}</div>` : ''}
                    </div>
                `;
            });
            html += `</div>`;
        } else {
            const groups = state.groups || [];
            html += `<div class="trix-bp-body">`;
            groups.forEach((group, gIdx) => {
                let isGroupActive = group.active;
                if (isSingle) {
                    const activeGroup = groups.find(g => g.active);
                    isGroupActive = activeGroup ? (group.id === activeGroup.id) : false;
                }
                const isGroupPartial = !!group.partial;

                html += `
                    <div class="trix-bp-group-card" data-group-idx="${gIdx}" ${isDeleteMode ? 'draggable="true"' : ''}>
                        <div class="trix-bp-group-header" data-act="toggleGroupCollapse" data-group-idx="${gIdx}" ${isDeleteMode ? 'draggable="true"' : ''} title="Click to expand/collapse group">
                            ${isDeleteMode ? `<span class="trix-bp-drag-handle group-handle" data-group-idx="${gIdx}" draggable="true" title="Drag to reorder group">⠿</span>` : ''}
                            <div class="trix-bp-group-arrow">
                                ${group.collapsed ? '▶' : '▼'}
                            </div>
                            <div class="trix-bp-group-title" data-act="renameGroup" data-group-idx="${gIdx}" title="Click to rename">
                                [${group.id}] ${group.name}
                            </div>
                            <div class="trix-bp-group-spacer"></div>
                            <div class="trix-bp-row-jump" data-act="jumpToGroupTargets" data-group-idx="${gIdx}" title="Jump to all nodes in group">
                                👁
                            </div>
                            <div class="trix-bp-switch ${isGroupActive ? 'active' : ''} ${isGroupPartial ? 'partial' : ''}" data-act="toggleGroupActive" data-group-idx="${gIdx}" title="${isGroupPartial ? (isGroupActive ? 'Partially Active (Mismatch)' : 'Partially Inactive (Mismatch)') : (isGroupActive ? 'Group Active' : 'Group Inactive')}">
                                <div class="trix-bp-switch-thumb"></div>
                            </div>
                            ${isDeleteMode ? `<div class="trix-bp-row-delete" data-act="deleteGroup" data-group-idx="${gIdx}" title="Delete group">${TRIX_CROSS_SM_SVG}</div>` : ''}
                        </div>
                        ${!group.collapsed ? `
                            <div class="trix-bp-group-rows" data-group-idx="${gIdx}">
                                ${(group.targets || []).map((target, tIdx) => {
                                    const isGroupRow = _trixIsGroupTarget(target);
                                    let hasMissing = false;
                                    if (target.value) {
                                        const ids = target.value.split(",").map(s => s.trim()).filter(Boolean);
                                        const exists = (id) => isGroupRow ? !!_trixFindGroupByToken(id) : !!findNodeById(id);
                                        hasMissing = ids.some(id => !exists(id));
                                    }
                                    const resolved = _trixResolveNodeTitles(target.value, node, target);
                                    const isTargetActive = isGroupActive && target.active;
                                    const isPartial = !!target.partial;
                                    const defaultLabel = isGroupRow ? `Group ${tIdx + 1}` : `Target ${tIdx + 1}`;
                                    const displayLabel = (isGroupRow ? "▦ " : "") + (target.name || defaultLabel);

                                    return `
                                        <div class="trix-bp-row" data-group-idx="${gIdx}" data-target-idx="${tIdx}" ${isDeleteMode ? 'draggable="true"' : ''}>
                                            ${isDeleteMode ? `<span class="trix-bp-drag-handle" data-group-idx="${gIdx}" data-target-idx="${tIdx}" draggable="true" title="Drag to reorder target">⠿</span>` : ''}
                                            <div class="trix-bp-row-label ${isGroupRow ? 'group-kind' : ''}" data-act="renameTarget" data-group-idx="${gIdx}" data-target-idx="${tIdx}" title="Click to rename">
                                                ${displayLabel}
                                            </div>
                                            ${hasMissing ? `<div class="trix-bp-row-warning" data-act="clickTargetWarning" data-group-idx="${gIdx}" data-target-idx="${tIdx}" title="${isGroupRow ? 'Group' : 'Node'} not found. Click to recover.">!</div>` : ''}
                                            <div class="trix-bp-row-picker ${resolved ? '' : 'placeholder'}" data-act="clickTargetBox" data-group-idx="${gIdx}" data-target-idx="${tIdx}" title="${resolved || (isGroupRow ? 'Select target groups...' : 'Select target nodes...')}">
                                                ${resolved || (isGroupRow ? 'Select target groups...' : 'Select target nodes...')}
                                            </div>
                                            <div class="trix-bp-row-jump" data-act="jumpToTarget" data-group-idx="${gIdx}" data-target-idx="${tIdx}" title="Jump to ${isGroupRow ? 'group nodes' : 'target nodes'}">
                                                👁
                                            </div>
                                            <div class="trix-bp-switch ${isTargetActive ? 'active' : ''} ${isPartial ? 'partial' : ''}" data-act="toggleTargetActive" data-group-idx="${gIdx}" data-target-idx="${tIdx}" title="${isPartial ? (isTargetActive ? 'Partially Active (Mismatch)' : 'Partially Inactive (Mismatch)') : (isTargetActive ? 'Active' : (isMute ? 'Muted' : 'Bypassed'))}">
                                                <div class="trix-bp-switch-thumb"></div>
                                            </div>
                                            ${isDeleteMode ? `<div class="trix-bp-row-delete" data-act="deleteTarget" data-group-idx="${gIdx}" data-target-idx="${tIdx}" title="Delete target">${TRIX_CROSS_SM_SVG}</div>` : ''}
                                        </div>
                                    `;
                                }).join('')}
                                ${group.targets.length < 10 ? `
                                    <div class="trix-bp-add-row-actions">
                                        <button class="trix-bp-btn-add-target" data-act="addTargetRow" data-group-idx="${gIdx}" title="Add target nodes to group">+</button>
                                        <button class="trix-bp-btn-add-target trix-bp-btn-add-group-target" data-act="addGroupTargetRow" data-group-idx="${gIdx}" title="Add target group (+G)">+G</button>
                                    </div>
                                ` : ''}
                            </div>
                        ` : ''}
                    </div>
                `;
            });
            html += `</div>`;
        }

        root.innerHTML = html;
        if (isStructural) {
            this.fitNode(node, true);
        }
    }
}

// =========================================================
// 8. COMPONENT SETUP AND INITIALIZATION
// =========================================================
function _trixInitNode(node) {
    if (node._trixInitDone) return;
    node._trixInitDone = true;

    node.properties = node.properties || {};
    const isSimple = (node.type === "TrixBypasserSimple");
    if (isSimple) {
        if (!node.properties.trixBypasserState) {
            node.properties.trixBypasserState = {
                version: 1,
                selectMode: "multi",
                muteMode: "bypass",
                deleteMode: false,
                targets: [
                    { name: "Target 1", value: "", active: true, kind: "nodes" }
                ]
            };
        }
    } else {
        if (!node.properties.trixBypasserState) {
            node.properties.trixBypasserState = {
                version: 1,
                selectMode: "multi",
                muteMode: "bypass",
                deleteMode: false,
                groups: [
                    {
                        id: "A",
                        name: "Group A",
                        active: true,
                        collapsed: false,
                        targets: [
                            { value: "", active: true, kind: "nodes" }
                        ]
                    }
                ]
            };
        }
    }
    if (!node.properties.trixBypasserOriginalModes) {
        node.properties.trixBypasserOriginalModes = {};
    }

    const initialW = Math.max(node.size?.[0] || 320, 240);
    const initialH = TrixBypasserDOMRenderer.calculateRequiredNodeHeight(node);
    if (node.setSize) {
        node.setSize([initialW, initialH]);
    } else if (node.size) {
        node.size[0] = initialW;
        node.size[1] = initialH;
    }

    // Mount universal DOM widget
    TrixBypasserDOMRenderer.mount(node);

    // Periodic toggle sync to reflect manual canvas changes (partial indicator)
    if (!node._trixSyncInterval) {
        node._trixSyncInterval = setInterval(() => {
            if (!node._trixDomRoot || !node._trixDomRoot.isConnected) return;
            if (_trixSyncTogglesFromNodes(node)) {
                TrixBypasserDOMRenderer.render(node, false);
            }
        }, 750);
    }

    const origOnRemoved = node.onRemoved;
    node.onRemoved = function() {
        if (node._trixSyncInterval) {
            clearInterval(node._trixSyncInterval);
            node._trixSyncInterval = null;
        }
        try {
            if (node._trixResizeObs) {
                node._trixResizeObs.disconnect();
                node._trixResizeObs = null;
            }
        } catch (e) {}
        if (node._trixFloorOff) {
            try { node._trixFloorOff(); } catch (e) {}
            node._trixFloorOff = null;
        }
        try {
            const lastTargeted = node._trixLastTargeted || new Map();
            for (const [hierId, entry] of lastTargeted.entries()) {
                const targetNode = (entry && entry.node && entry.node.mode !== undefined) ? entry.node : findNodeById(hierId);
                if (targetNode) {
                    const orig = node.properties.trixBypasserOriginalModes[hierId] ?? 0;
                    if (targetNode.mode !== orig) {
                        targetNode.mode = orig;
                        if (targetNode.setDirtyCanvas) targetNode.setDirtyCanvas(true, true);
                    }
                }
            }
        } catch (e) {
            console.error("TrixBypasser restore on remove error:", e);
        }
        if (origOnRemoved) origOnRemoved.apply(this, arguments);
    };

    setTimeout(() => {
        try {
            _trixEnforceLogic(node);
            _trixSyncTogglesFromNodes(node);
            TrixBypasserDOMRenderer.render(node, false);
        } catch(e) {}
    }, 50);
}

// =========================================================
// 9. CONTEXT MENU HOOKS & CLIPBOARD UTILITIES
// =========================================================
function _trixCopyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(err => {
            console.error("Failed to copy using clipboard API:", err);
            _trixFallbackCopyToClipboard(text);
        });
    } else {
        _trixFallbackCopyToClipboard(text);
    }
}

function _trixFallbackCopyToClipboard(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
    } catch (err) {
        console.error("Fallback copy failed:", err);
    }
    document.body.removeChild(textArea);
}

function _trixGetSelectedNodeIds() {
    const selectedNodes = [];
    const raw = app.canvas?.selected_nodes;
    if (raw && typeof raw === "object") {
        if (Array.isArray(raw)) {
            for (const item of raw) {
                const node = typeof item === "object" ? item : app.graph.getNodeById(item);
                if (node) selectedNodes.push(node);
            }
        } else {
            for (const [key, value] of Object.entries(raw)) {
                const node = value && typeof value === "object" ? value : app.graph.getNodeById(key);
                if (node) selectedNodes.push(node);
            }
        }
    }
    return selectedNodes.map(n => n.id);
}

function _trixHookContextMenus() {
    if (typeof LGraphCanvas === "undefined") return;

    // 1. Canvas Context Menu
    const origGetCanvasMenuOptions = LGraphCanvas.prototype.getCanvasMenuOptions;
    LGraphCanvas.prototype.getCanvasMenuOptions = function(event) {
        const options = origGetCanvasMenuOptions.apply(this, arguments) || [];
        
        const graphMouse = this.graph_mouse;
        let group = null;
        if (graphMouse && this.graph && this.graph._groups) {
            const x = graphMouse[0];
            const y = graphMouse[1];
            group = this.graph._groups.find(g => {
                return x >= g.pos[0] && x <= g.pos[0] + g.size[0] &&
                       y >= g.pos[1] && y <= g.pos[1] + g.size[1];
            });
        }
        
        const selectedIds = _trixGetSelectedNodeIds();
        
        let addedSeparator = false;
        const addSeparatorIfNeeded = () => {
            if (!addedSeparator) {
                options.push(null);
                addedSeparator = true;
            }
        };
        
        if (group) {
            group.recomputeInsideNodes();
            const nodesInGroup = group._nodes || [];
            if (nodesInGroup.length > 0) {
                addSeparatorIfNeeded();
                options.push({
                    content: `Copy Group Node IDs (${nodesInGroup.length})`,
                    callback: () => {
                        const ids = nodesInGroup.map(n => n.id).join(", ");
                        _trixCopyToClipboard(ids);
                    }
                });
            }
        }
        
        if (selectedIds.length > 1) {
            addSeparatorIfNeeded();
            options.push({
                content: `Copy Selected Node IDs (${selectedIds.length})`,
                callback: () => {
                    _trixCopyToClipboard(selectedIds.join(", "));
                }
            });
        }
        
        return options;
    };

    // 2. Node Context Menu
    const origGetNodeMenuOptions = LGraphCanvas.prototype.getNodeMenuOptions;
    LGraphCanvas.prototype.getNodeMenuOptions = function(node) {
        const options = origGetNodeMenuOptions.apply(this, arguments) || [];
        if (!node) return options;

        if (node.type === "TrixBypasser" || node.type === "TrixBypasserSimple") {
            const hideSettings = !!node.properties?.trixBypasserState?.hideSettings;
            const hasOption = options.some(opt => opt && (opt.content === "Hide settings" || opt.content === "Show settings"));
            if (!hasOption) {
                options.unshift({
                    content: hideSettings ? "Show settings" : "Hide settings",
                    callback: () => {
                        if (!node.properties || !node.properties.trixBypasserState) return;
                        node.properties.trixBypasserState.hideSettings = !hideSettings;
                        TrixBypasserDOMRenderer.render(node, true);
                        if (node.setDirtyCanvas) node.setDirtyCanvas(true, true);
                        if (app.graph) app.graph.setDirtyCanvas(true, true);
                    }
                });
            }
        }

        const selectedIds = _trixGetSelectedNodeIds();
        const showCopyId = app.ui?.settings?.getSettingValue?.("Trix.ContextMenu.CopyNodeId") !== false;
        const showCopySelected = app.ui?.settings?.getSettingValue?.("Trix.ContextMenu.CopySelectedNodeIds") !== false;
        
        if (showCopyId || (showCopySelected && selectedIds.length > 1)) {
            options.push(null);
        }
        
        if (showCopyId) {
            options.push({
                content: `Copy Node ID (${node.id})`,
                callback: () => {
                    _trixCopyToClipboard(String(node.id));
                }
            });
        }
        
        if (showCopySelected && selectedIds.length > 1) {
            options.push({
                content: `Copy Selected Node IDs (${selectedIds.length})`,
                callback: () => {
                    _trixCopyToClipboard(selectedIds.join(", "));
                }
            });
        }
        
        return options;
    };
}

let _trixSubgraphHookDepth = 0;

function _trixHookSubgraphMethod(obj, methodName, hookLogic) {
    if (!obj || !obj[methodName]) return;
    if (obj[methodName]._trixHooked) return;

    const orig = obj[methodName];
    const newFn = function() {
        if (_trixSubgraphHookDepth > 0) {
            return orig.apply(this, arguments);
        }
        _trixSubgraphHookDepth++;
        try {
            return hookLogic.call(this, orig, arguments);
        } finally {
            _trixSubgraphHookDepth--;
        }
    };
    newFn._trixHooked = true;
    obj[methodName] = newFn;
}

function _trixHookConvertToSubgraph(orig, args) {
    const nodesSet = args[0];
    const originalIds = Array.from(nodesSet || []).map(n => String(n.id));

    const result = orig.apply(this, args);

    let subgraphNode = null;
    if (result) {
        if (result.node) {
            subgraphNode = result.node;
        } else if (result.type === "SubgraphNode" || result.subgraph) {
            subgraphNode = result;
        }
    }
    if (!subgraphNode) {
        const allNodes = this._nodes || this.nodes || [];
        subgraphNode = allNodes.find(n => n.subgraph && originalIds.some(oid => {
            const innerNodes = n.subgraph.nodes || n.subgraph._nodes || [];
            return innerNodes.some(inNode => String(inNode.id) === oid);
        }));
    }

    if (subgraphNode) {
        const subgraphNodeId = subgraphNode.id;
        const mapping = {};
        originalIds.forEach(oid => {
            mapping[oid] = `${subgraphNodeId}:${oid}`;
        });

        const allBypassers = _trixGetAllGraphNodes(this).filter(n => n.properties && n.properties.trixBypasserState);
        
        allBypassers.forEach(bypasser => {
            if (bypasser.graph !== this) return;
            if (!bypasser.properties || !bypasser.properties.trixBypasserState) return;
            const state = bypasser.properties.trixBypasserState;
            let changedAny = false;
            
            const updateValue = (val) => {
                if (!val || !val.trim()) return val;
                let ids = val.split(",").map(s => s.trim()).filter(Boolean);
                let changed = false;
                const newIds = ids.map(id => {
                    if (mapping[id]) {
                        changed = true;
                        return mapping[id];
                    }
                    return id;
                });
                if (changed) {
                    changedAny = true;
                    return newIds.join(", ");
                }
                return val;
            };

            if (state.targets) {
                state.targets.forEach(t => {
                    t.value = updateValue(t.value);
                });
            }
            if (state.groups) {
                state.groups.forEach(g => {
                    g.targets.forEach(t => {
                        t.value = updateValue(t.value);
                    });
                });
            }
            
            if (changedAny) {
                _trixEnforceLogic(bypasser);
                TrixBypasserDOMRenderer.render(bypasser, false);
            }
        });
    }

    return result;
}

function _trixHookUnpackSubgraph(orig, args) {
    const subgraphNode = args[0];
    const oldSubgraphId = subgraphNode.id;
    const innerNodes = subgraphNode.subgraph ? (subgraphNode.subgraph.nodes || subgraphNode.subgraph._nodes || []) : [];
    innerNodes.forEach(n => {
        n.properties = n.properties || {};
        n.properties._trixOldInnerId = String(n.id);
    });
    const oldNodeIdsAndTypes = innerNodes.map(n => ({
        innerId: String(n.id),
        type: n.type,
        title: n.title
    }));
    
    const mainNodeIdsBefore = new Set((this._nodes || this.nodes || []).map(n => n.id));
    const result = orig.apply(this, args);
    const mainNodesAfter = this._nodes || this.nodes || [];
    const newNodes = mainNodesAfter.filter(n => !mainNodeIdsBefore.has(n.id));

    const mapping = {};
    const matchedNewNodes = new Set();

    newNodes.forEach(candidate => {
        const oldInnerId = candidate.properties?._trixOldInnerId;
        if (oldInnerId) {
            mapping[`${oldSubgraphId}:${oldInnerId}`] = String(candidate.id);
            matchedNewNodes.add(candidate);
            if (candidate.properties && candidate.properties.trixBypasserState) {
                candidate._trixIsUnpackedInner = true;
                candidate._trixUnpackedOldInnerId = oldInnerId;
            }
            delete candidate.properties._trixOldInnerId;
        }
    });

    let newIdx = 0;
    for (let i = 0; i < oldNodeIdsAndTypes.length; i++) {
        const oldInfo = oldNodeIdsAndTypes[i];
        const alreadyMatched = Array.from(matchedNewNodes).some(n => n._trixUnpackedOldInnerId === oldInfo.innerId);
        if (alreadyMatched) continue;

        while (newIdx < newNodes.length) {
            const candidate = newNodes[newIdx];
            newIdx++;
            if (matchedNewNodes.has(candidate)) continue;
            if (candidate.type === oldInfo.type) {
                mapping[`${oldSubgraphId}:${oldInfo.innerId}`] = String(candidate.id);
                matchedNewNodes.add(candidate);
                if (candidate.properties && candidate.properties.trixBypasserState) {
                    candidate._trixIsUnpackedInner = true;
                    candidate._trixUnpackedOldInnerId = oldInfo.innerId;
                }
                break;
            }
        }
    }

    const allBypassers = _trixGetAllGraphNodes(this).filter(n => n.properties && n.properties.trixBypasserState);
    
    allBypassers.forEach(bypasser => {
        if (!bypasser.properties || !bypasser.properties.trixBypasserState) return;
        const state = bypasser.properties.trixBypasserState;
        let changedAny = false;
        
        const isUnpackedBypasser = !!bypasser._trixIsUnpackedInner;
        delete bypasser._trixIsUnpackedInner;
        delete bypasser._trixUnpackedOldInnerId;

        const updateValue = (val) => {
            if (!val || !val.trim()) return val;
            let ids = val.split(",").map(s => s.trim()).filter(Boolean);
            let changed = false;
            const newIds = ids.map(id => {
                if (mapping[id]) {
                    changed = true;
                    return mapping[id];
                }
                if (isUnpackedBypasser) {
                    const localHierarchicalId = `${oldSubgraphId}:${id}`;
                    if (mapping[localHierarchicalId]) {
                        changed = true;
                        return mapping[localHierarchicalId];
                    }
                }
                return id;
            });
            if (changed) {
                changedAny = true;
                return newIds.join(", ");
            }
            return val;
        };

        if (state.targets) {
            state.targets.forEach(t => {
                t.value = updateValue(t.value);
            });
        }
        if (state.groups) {
            state.groups.forEach(g => {
                g.targets.forEach(t => {
                    t.value = updateValue(t.value);
                });
            });
        }
        
        if (changedAny) {
            _trixEnforceLogic(bypasser);
            TrixBypasserDOMRenderer.render(bypasser, false);
        }
    });

    return result;
}

function _trixApplySubgraphHooks() {
    if (typeof LGraph !== "undefined" && LGraph.prototype) {
        _trixHookSubgraphMethod(LGraph.prototype, "unpackSubgraph", _trixHookUnpackSubgraph);
        _trixHookSubgraphMethod(LGraph.prototype, "convertToSubgraph", _trixHookConvertToSubgraph);
    }
    if (typeof app !== "undefined" && app.graph) {
        _trixHookSubgraphMethod(app.graph, "unpackSubgraph", _trixHookUnpackSubgraph);
        _trixHookSubgraphMethod(app.graph, "convertToSubgraph", _trixHookConvertToSubgraph);
    }
}

// =========================================================
// 10. EXTENSION REGISTRATION
// =========================================================
app.registerExtension({
    name: "Trix.Bypasser",
    
    setup(app) {
        _trixHookContextMenus();
        _trixApplySubgraphHooks();
    },
    
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name === "TrixBypasser" || nodeData.name === "TrixBypasserSimple") {
            gateResizeAndDraw(nodeType, 240, 60);

            const origCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function() {
                const r = origCreated ? origCreated.apply(this, arguments) : undefined;
                _trixInitNode(this);
                return r;
            };

            const origGetExtraMenuOptions = nodeType.prototype.getExtraMenuOptions;
            nodeType.prototype.getExtraMenuOptions = function(canvas, optionsArr) {
                let options = Array.isArray(optionsArr) ? optionsArr : [];
                if (origGetExtraMenuOptions) {
                    const maybe = origGetExtraMenuOptions.call(this, canvas, options);
                    if (Array.isArray(maybe)) options = maybe;
                }
                const hideSettings = !!this.properties?.trixBypasserState?.hideSettings;
                const hasOption = options.some(opt => opt && (opt.content === "Hide settings" || opt.content === "Show settings"));
                if (!hasOption) {
                    options.unshift({
                        content: hideSettings ? "Show settings" : "Hide settings",
                        callback: () => {
                            if (!this.properties || !this.properties.trixBypasserState) return;
                            this.properties.trixBypasserState.hideSettings = !hideSettings;
                            TrixBypasserDOMRenderer.render(this, true);
                            if (this.setDirtyCanvas) this.setDirtyCanvas(true, true);
                            if (app.graph) app.graph.setDirtyCanvas(true, true);
                        }
                    });
                }
                return options;
            };
        }
    },

    async afterConfigureGraph() {
        _trixApplySubgraphHooks();
        if (app.graph && app.graph._nodes) {
            for (const node of app.graph._nodes) {
                if (node.type === "TrixBypasser" || node.type === "TrixBypasserSimple") {
                    _trixInitNode(node);
                    try {
                        _trixEnforceLogic(node);
                        TrixBypasserDOMRenderer.render(node, true);
                    } catch(e) {}
                }
            }
        }
    }
});
