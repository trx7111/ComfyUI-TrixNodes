// 🌊Trix Color Match - Live Preview (Universal Nodes 1.0 & Nodes 2.0).
// Resolves 100% color accuracy by requesting live preview processing directly from the Python backend.

import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
const EXT_NAME = "Trix_Color_Match.Preview";

const getExtensionFolder = () => {
  try {
    const parts = new URL(import.meta.url).pathname.split('/');
    return parts[parts.length - 2];
  } catch (e) {
    return "comfyui-trixnodes";
  }
};
const folder = getExtensionFolder();

// Height (px) of the preview area
const PREVIEW_H = 256;

const STYLE_ID = "trix-color-match-styles";
function injectStyles() {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .trix-cm-preview-root {
      width: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
      background: #111114;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 6px;
      overflow: hidden;
      margin-top: 4px;
      min-height: 200px;
      height: 256px;
      user-select: none;
      pointer-events: auto !important;
    }
    .trix-cm-preview-wrap {
      width: 100%;
      height: 100%;
      position: relative;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0d0d10;
      cursor: crosshair;
    }
    .trix-cm-img {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
      pointer-events: none;
    }
    .trix-cm-left-wrap {
      position: absolute;
      top: 0;
      left: 0;
      width: 50%;
      height: 100%;
      overflow: hidden;
      border-right: 1.5px solid rgba(255, 255, 255, 0.85);
      box-sizing: border-box;
      z-index: 2;
      pointer-events: none;
      background: #0d0d10;
    }
    .trix-cm-left-wrap .trix-cm-img-left {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
      pointer-events: none;
    }
    .trix-cm-badge {
      position: absolute;
      top: 8px;
      padding: 2px 6px;
      background: rgba(0, 0, 0, 0.65);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 4px;
      color: #ffffff;
      font-size: 8.5px;
      font-weight: 700;
      letter-spacing: 0.3px;
      pointer-events: none;
      z-index: 5;
      text-transform: uppercase;
      backdrop-filter: blur(4px);
    }
    .trix-cm-badge.left {
      left: 8px;
    }
    .trix-cm-badge.right {
      right: 8px;
    }
    .trix-cm-empty {
      color: #777;
      font-size: 11px;
      font-family: sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }
  `;
  document.head.appendChild(style);
}

function isVueNodes() {
  return !!(
    window.LiteGraph?.vueNodesMode ||
    app.canvas?.vueNodesMode ||
    (typeof LGraphCanvas !== "undefined" && LGraphCanvas.vueNodesMode)
  );
}

function applyAdaptiveCanvasOnly(widget) {
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

(function(){
  // One-time node resize when the first preview becomes available (Nodes 1.0 LiteGraph only).
  function seedPreviewSize(node){
    if (isVueNodes()) return; // Vue handles its own DOM widget layout
    const previewMode = String(getVal(node, 'preview_mode') || 'show').toLowerCase();
    if(previewMode === 'hide') return;
    if(node._previewAutoSized) return;
    node._previewAutoSized = true;
    if(node._loadedFromWorkflow) return;
    try{
      const min = node.computeSize();
      const w = Math.max(node.size[0], min[0] || 0, 260);
      const bottom = widgetsBottomY(node);
      const h = Math.max(node.size[1], bottom + PREVIEW_H + 18);
      node.setSize([w, h]);
      app.graph.setDirtyCanvas(true, true);
    }catch(_){ }
  }

  // Helper to fetch value of a widget by name
  function getWidget(node, name){
    if(!node.widgets) return null;
    return node.widgets.find(w => (
      w && (w.name===name || w.label===name || w.name===name.replace(' ', '_') || w.label===name.replace(' ', '_'))
    ));
  }

  function getVal(node, name){
    const w = getWidget(node, name);
    return w ? w.value : null;
  }

  function widgetHeight(wg, w){
    let wh = 0;
    try{
      if(typeof wg.computeSize === 'function'){
        const sz = wg.computeSize(w || 220);
        if(Array.isArray(sz)) wh = sz[1] || 0; else if(typeof sz === 'number') wh = sz;
      } else if(typeof wg.height === 'number'){ wh = wg.height; }
      else { wh = 20; }
    }catch(_){ wh = 20; }
    return wh > 0 ? wh : 0;
  }
  
  function widgetsBottomY(n){
    let maxBottom = 0;
    const w = n.size ? n.size[0] : 220;
    if(Array.isArray(n.widgets)){
      for(const wg of n.widgets){
        if(!wg || wg.hidden) continue;
        if(typeof wg.last_y !== 'number' || wg.last_y <= 0) continue;
        const b = wg.last_y + widgetHeight(wg, w);
        if(b > maxBottom) maxBottom = b;
      }
    }
    if(maxBottom > 0) return maxBottom;
    const LG = (typeof window !== 'undefined') ? window.LiteGraph : null;
    const titleH = (LG && LG.NODE_TITLE_HEIGHT) || 30;
    const slotH = (LG && LG.NODE_SLOT_HEIGHT) || 20;
    const nIn = (n.inputs && n.inputs.length) || 0;
    const nOut = (n.outputs && n.outputs.length) || 0;
    let y = titleH + Math.max(nIn, nOut) * slotH + 4;
    if(Array.isArray(n.widgets)){
      for(const wg of n.widgets){
        if(!wg || wg.hidden) continue;
        y += widgetHeight(wg, w) + 4;
      }
    }
    return y;
  }

  function getUpstreamNode(node, inputIndex) {
    if (!node.inputs || !node.inputs[inputIndex]) return null;
    const linkId = node.inputs[inputIndex].link;
    if (linkId === null || linkId === undefined) return null;
    const link = app.graph?.links?.[linkId];
    if (!link) return null;
    return app.graph?.getNodeById(link.origin_id);
  }

  function getUpstreamNodeByInputName(node, inputName, defaultIndex = 0) {
    if (!node.inputs) return null;
    const input = node.inputs.find(inp => inp && inp.name && inp.name.toLowerCase() === inputName.toLowerCase());
    if (input && input.link !== null && input.link !== undefined) {
      const link = app.graph?.links?.[input.link];
      if (link) return app.graph?.getNodeById(link.origin_id);
    }
    return getUpstreamNode(node, defaultIndex);
  }

  function detectSource(n) {
    if (!n) return null;
    const preferred = ["image", "video", "path", "filepath", "file", "filename", "input_video", "input_image"];
    for (const name of preferred) {
      const w = n.widgets?.find(x => x && x.name && x.name.toLowerCase() === name);
      if (w) {
        if (typeof w.value === "string" && w.value.trim() && /\.(png|jpg|jpeg|webp|gif|mp4|webm|avi|mov)$/i.test(w.value)) {
          return w.value;
        }
        if (typeof w.value === "object" && w.value && typeof w.value.image === "string") {
          return w.value.image;
        }
      }
    }
    for (const w of n.widgets ?? []) {
      if (w) {
        if (typeof w.value === "string" && w.value.trim() && /\.(png|jpg|jpeg|webp|gif|mp4|webm|avi|mov)$/i.test(w.value)) {
          return w.value;
        }
        if (typeof w.value === "object" && w.value && typeof w.value.image === "string") {
          return w.value.image;
        }
      }
    }
    if (n.imgs && n.imgs.length > 0 && n.imgs[0]?.src) {
      return n.imgs[0].src;
    }
    if (n.images && n.images.length > 0) {
      const img = n.images[0];
      if (typeof img === "string") return img;
      if (img && img.filename) return `${img.filename} [${img.type || 'output'}]`;
    }
    return null;
  }

  function detectSourceUpstream(node, visited = new Set()) {
    if (!node || visited.has(node.id)) return null;
    visited.add(node.id);
    
    const src = detectSource(node);
    if (src) return src;

    if (node.inputs) {
      for (let i = 0; i < node.inputs.length; i++) {
        const upstream = getUpstreamNode(node, i);
        const res = detectSourceUpstream(upstream, visited);
        if (res) return res;
      }
    }
    return null;
  }

  function getAllUpstreamNodes(startNode, visited = new Set()) {
    if (!startNode || visited.has(startNode.id)) return [];
    visited.add(startNode.id);
    const result = [];
    if (Array.isArray(startNode.inputs)) {
      for (const input of startNode.inputs) {
        if (!input || input.link === null || input.link === undefined) continue;
        const link = app.graph?.links?.[input.link];
        if (!link) continue;
        const originNode = app.graph?.getNodeById(link.origin_id);
        if (originNode && !visited.has(originNode.id)) {
          result.push(originNode);
          result.push(...getAllUpstreamNodes(originNode, visited));
        }
      }
    }
    return result;
  }

  function cleanUpstreamHooks(nodeId) {
    (app.graph?._nodes || []).forEach(n => {
      if (n && n._trixHookedBy && n._trixHookedBy.has(nodeId)) {
        n._trixHookedBy.delete(nodeId);
      }
    });
  }

  function _triggerDownstreams(upstreamNode) {
    if (!upstreamNode || !upstreamNode._trixHookedBy) return;
    for (const downstreamId of upstreamNode._trixHookedBy) {
      const dn = app.graph?.getNodeById(downstreamId);
      if (dn && dn._colorMatchLiveUpdate) {
        dn._colorMatchLiveUpdate(true);
      }
    }
  }

  function hookUpstreamNode(downstreamNode, upstreamNode) {
    if (!upstreamNode) return;
    if (!upstreamNode._trixHookedBy) {
      upstreamNode._trixHookedBy = new Set();
    }
    upstreamNode._trixHookedBy.add(downstreamNode.id);

    // 1. Hook widgets with callback/onChange AND value setter interceptor for Vue Nodes 2.0
    if (Array.isArray(upstreamNode.widgets)) {
      upstreamNode.widgets.forEach(w => {
        if (!w || w._trixHooked) return;
        w._trixHooked = true;

        const origCb = w.callback;
        w.callback = function() {
          const r = origCb ? origCb.apply(this, arguments) : undefined;
          _triggerDownstreams(upstreamNode);
          return r;
        };

        const origOnChange = w.onChange;
        w.onChange = function() {
          const r = origOnChange ? origOnChange.apply(this, arguments) : undefined;
          _triggerDownstreams(upstreamNode);
          return r;
        };

        // Reactive setter interceptor for Vue 2.0 widget updates
        let val = w.value;
        try {
          Object.defineProperty(w, "value", {
            configurable: true,
            enumerable: true,
            get() { return val; },
            set(newV) {
              const changed = (val !== newV);
              val = newV;
              if (changed) {
                _triggerDownstreams(upstreamNode);
              }
            }
          });
        } catch(_) {}
      });
    }

    // 2. Hook onExecuted on upstream node
    if (!upstreamNode._trixExecHooked) {
      upstreamNode._trixExecHooked = true;
      const origExec = upstreamNode.onExecuted;
      upstreamNode.onExecuted = function() {
        const r = origExec ? origExec.apply(this, arguments) : undefined;
        _triggerDownstreams(upstreamNode);
        return r;
      };
    }

    // 3. Hook onConnectionsChange on upstream node
    if (!upstreamNode._trixConnHooked) {
      upstreamNode._trixConnHooked = true;
      const origConn = upstreamNode.onConnectionsChange;
      upstreamNode.onConnectionsChange = function() {
        const r = origConn ? origConn.apply(this, arguments) : undefined;
        setTimeout(() => _triggerDownstreams(upstreamNode), 40);
        return r;
      };
    }
  }

  function updateUpstreamHooks(node) {
    cleanUpstreamHooks(node.id);
    const upstreamNodes = getAllUpstreamNodes(node);
    for (const upNode of upstreamNodes) {
      hookUpstreamNode(node, upNode);
    }
  }

  // Classic LiteGraph Canvas Drawing (Nodes 1.0 only)
  function drawPreview(node, ctx){
    if (isVueNodes()) return; // In Vue Nodes 2.0, DOM widget handles drawing
    const state = node._colorMatchState;
    if(!state || !state.outReady || !state.outCanvas) return;

    const previewMode = String(getVal(node, 'preview_mode') || 'show').toLowerCase();
    if(previewMode === 'hide') return;

    const w = node.size[0];
    const h = node.size[1];
    const pad = 11;
    const safeTop = widgetsBottomY(node) + 18;
    
    const availableH = h - safeTop - pad;
    if (availableH < 10) return;

    const dh = availableH;
    const dw = Math.max(0, w - pad*2);
    const x = pad;
    const y = safeTop;

    ctx.save();
    ctx.fillStyle = "#111";
    ctx.fillRect(x, y, dw, dh);
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.strokeRect(x, y, dw, dh);

    const iw = state.matchedImg.naturalWidth || state.outCanvas.width;
    const ih = state.matchedImg.naturalHeight || state.outCanvas.height;
    if (iw > 0 && ih > 0) {
      const scale = Math.min(dw/iw, dh/ih);
      const rw = Math.max(1, Math.floor(iw*scale));
      const rh = Math.max(1, Math.floor(ih*scale));
      const ox = x + Math.floor((dw - rw)/2);
      const oy = y + Math.floor((dh - rh)/2);

      const isCompare = (previewMode === 'show before-after' || previewMode === 'show compare reference');
      const isBeforeAfter = (previewMode === 'show before-after');
      const leftImg = isBeforeAfter ? state.srcImg : state.refImg;
      const leftReady = isCompare && leftImg && leftImg.complete && leftImg.naturalWidth > 0;

      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';

      if (leftReady) {
        const splitRatio = typeof state.splitRatio === 'number' ? state.splitRatio : 0.5;
        const splitX = x + dw * splitRatio;

        // 1. Draw Left Image
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, dw * splitRatio, dh);
        ctx.clip();
        ctx.drawImage(leftImg, 0, 0, leftImg.naturalWidth, leftImg.naturalHeight, ox, oy, rw, rh);
        ctx.restore();

        // 2. Draw Right Image
        ctx.save();
        ctx.beginPath();
        ctx.rect(splitX, y, dw * (1 - splitRatio), dh);
        ctx.clip();
        ctx.drawImage(state.matchedImg, 0, 0, iw, ih, ox, oy, rw, rh);
        ctx.restore();

        // 3. Draw Divider Line if Hovering
        if (state.isHovering) {
          ctx.save();
          ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(splitX, oy);
          ctx.lineTo(splitX, oy + rh);
          ctx.stroke();
          ctx.restore();
        }

        // 4. Draw Badges
        const leftLabel = isBeforeAfter ? "before" : "reference";
        const rightLabel = isBeforeAfter ? "after" : "target (matched)";
        
        const drawPill = (text, px, py, isLeft) => {
          ctx.save();
          ctx.font = "bold 8px sans-serif";
          ctx.textBaseline = "middle";
          const textWidth = ctx.measureText(text).width;
          const paddingX = 5;
          const wPill = textWidth + paddingX * 2;
          const hPill = 12;
          const rx = isLeft ? px : px - wPill;
          const ry = py;
          
          ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(rx, ry, wPill, hPill, 3);
          } else {
            ctx.rect(rx, ry, wPill, hPill);
          }
          ctx.fill();
          
          ctx.fillStyle = "#ffffff";
          ctx.fillText(text, rx + paddingX, ry + hPill / 2 + 0.5);
          ctx.restore();
        };

        drawPill(leftLabel, ox + 8, oy + 8, true);
        drawPill(rightLabel, ox + rw - 8, oy + 8, false);

      } else {
        // Fallback or Standard Mode
        ctx.drawImage(state.matchedImg, 0, 0, iw, ih, ox, oy, rw, rh);
      }
    }
    ctx.restore();
  }

  function ensureBehavior(node){
    if(node._colorMatchPreviewAdded) return;
    node._colorMatchPreviewAdded = true;

    injectStyles();

    // Clean up any legacy preview_id widget
    if (Array.isArray(node.widgets)) {
      const wPid = node.widgets.find(x => x && (x.name === 'preview_id' || x.label === 'preview_id'));
      if (wPid) {
        wPid.hidden = true;
        wPid.type = "hidden";
        wPid.computeSize = () => [0, 0];
        wPid.draw = () => {};
      }
    }

    const state = node._colorMatchState = {
      matchedImg: new Image(),
      matchedUrl: null,
      srcImg: new Image(),
      srcUrl: null,
      refImg: new Image(),
      refUrl: null,
      loadToken: 0,
      outCanvas: document.createElement('canvas'),
      outCtx: null,
      outReady: false,
      apiTimeout: null,
      isHovering: false,
      splitRatio: 0.5
    };
    state.outCtx = state.outCanvas.getContext('2d');

    // DOM Preview Setup (for Nodes 2.0 Vue mode only)
    if (isVueNodes()) {
      const domRoot = document.createElement("div");
      domRoot.className = "trix-cm-preview-root";
      node._colorMatchDomRoot = domRoot;

      domRoot.innerHTML = `
        <div class="trix-cm-preview-wrap">
          <div class="trix-cm-empty">No preview available</div>
          <img class="trix-cm-img trix-cm-img-right" style="display:none;" />
          <div class="trix-cm-left-wrap" style="display:none;">
            <img class="trix-cm-img-left" style="display:none;" />
          </div>
          <div class="trix-cm-badge left" style="display:none;"></div>
          <div class="trix-cm-badge right" style="display:none;"></div>
        </div>
      `;

      const wrap = domRoot.querySelector(".trix-cm-preview-wrap");
      const leftWrap = domRoot.querySelector(".trix-cm-left-wrap");
      const leftImg = domRoot.querySelector(".trix-cm-img-left");

      const updateLeftImgSize = () => {
        if (!wrap || !leftImg) return;
        const w = wrap.offsetWidth;
        const h = wrap.offsetHeight;
        if (w > 0 && h > 0) {
          leftImg.style.width = w + "px";
          leftImg.style.height = h + "px";
        }
      };

      wrap.addEventListener("pointermove", (e) => {
        const previewMode = String(getVal(node, 'preview_mode') || 'show').toLowerCase();
        if (previewMode !== 'show before-after' && previewMode !== 'show compare reference') return;
        const rect = wrap.getBoundingClientRect();
        if (rect.width > 0) {
          const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          leftWrap.style.width = (ratio * 100) + "%";
          updateLeftImgSize();
        }
      });

      wrap.addEventListener("pointerleave", () => {
        leftWrap.style.width = "50%";
        updateLeftImgSize();
      });

      const domWidget = node.addDOMWidget("color_match_preview", "trix_cm_preview", domRoot, {
        getValue: () => null,
        setValue: () => {},
        getMinHeight: () => {
          const mode = String(getVal(node, 'preview_mode') || 'show').toLowerCase();
          return mode === 'hide' ? 0 : PREVIEW_H;
        },
        margin: 4,
        serialize: false,
      });
      applyAdaptiveCanvasOnly(domWidget);

      domWidget.computeSize = (w) => {
        const mode = String(getVal(node, 'preview_mode') || 'show').toLowerCase();
        return [w || 260, mode === 'hide' ? 0 : PREVIEW_H];
      };
      domWidget.computeLayoutSize = () => {
        const mode = String(getVal(node, 'preview_mode') || 'show').toLowerCase();
        return {
          minHeight: mode === 'hide' ? 0 : PREVIEW_H,
          minWidth: 240,
        };
      };

      node._colorMatchDomWidget = domWidget;
    }

    function updateDOMPreview(){
      if (!node._colorMatchDomRoot) return;
      const previewMode = String(getVal(node, 'preview_mode') || 'show').toLowerCase();
      const domRoot = node._colorMatchDomRoot;
      if (previewMode === 'hide') {
        domRoot.style.display = 'none';
        return;
      }
      domRoot.style.display = 'flex';

      const rightImg = domRoot.querySelector(".trix-cm-img-right");
      const leftWrap = domRoot.querySelector(".trix-cm-left-wrap");
      const leftImg = domRoot.querySelector(".trix-cm-img-left");
      const badgeLeft = domRoot.querySelector(".trix-cm-badge.left");
      const badgeRight = domRoot.querySelector(".trix-cm-badge.right");
      const emptyEl = domRoot.querySelector(".trix-cm-empty");

      const hasMatched = Boolean(state.matchedUrl || (state.matchedImg && state.matchedImg.src && (state.matchedImg.complete || state.outReady)));

      if (!hasMatched) {
        if (emptyEl) emptyEl.style.display = 'flex';
        if (rightImg) rightImg.style.display = 'none';
        if (leftWrap) leftWrap.style.display = 'none';
        if (badgeLeft) badgeLeft.style.display = 'none';
        if (badgeRight) badgeRight.style.display = 'none';
        return;
      }

      if (emptyEl) emptyEl.style.display = 'none';
      if (rightImg) {
        rightImg.style.display = 'block';
        const targetSrc = state.matchedUrl || state.matchedImg.src;
        if (targetSrc && rightImg.src !== targetSrc) {
          rightImg.src = targetSrc;
        }
      }

      const isCompare = (previewMode === 'show before-after' || previewMode === 'show compare reference');
      const isBeforeAfter = (previewMode === 'show before-after');

      if (isCompare) {
        if (leftWrap) leftWrap.style.display = 'block';
        if (leftImg) {
          leftImg.style.display = 'block';
          const targetSrc = isBeforeAfter ? (state.srcUrl || state.srcImg.src) : (state.refUrl || state.refImg.src);
          if (targetSrc && leftImg.src !== targetSrc) {
            leftImg.src = targetSrc;
          }
        }
        if (badgeLeft) {
          badgeLeft.style.display = 'block';
          badgeLeft.textContent = isBeforeAfter ? 'before' : 'reference';
        }
        if (badgeRight) {
          badgeRight.style.display = 'block';
          badgeRight.textContent = isBeforeAfter ? 'after' : 'target (matched)';
        }
      } else {
        if (leftWrap) leftWrap.style.display = 'none';
        if (badgeLeft) badgeLeft.style.display = 'none';
        if (badgeRight) badgeRight.style.display = 'none';
      }
    }

    function drawImageToCanvas() {
        if (!state.matchedImg.complete || state.matchedImg.naturalWidth === 0) return;
        state.outCanvas.width = state.matchedImg.naturalWidth;
        state.outCanvas.height = state.matchedImg.naturalHeight;
        state.outCtx.drawImage(state.matchedImg, 0, 0);
        state.outReady = true;
        seedPreviewSize(node);
        updateDOMPreview();
        app.graph?.setDirtyCanvas(true, true);
    }

    function loadPreviewImage(url, token) {
        if (state.matchedUrl && state.matchedUrl.startsWith("blob:")) {
            try { URL.revokeObjectURL(state.matchedUrl); } catch(e) {}
        }
        state.matchedUrl = url;
        state.outReady = false;

        const pid = String(node.id || 'A').replace(/[^a-zA-Z0-9_-]/g, "_");
        let q = "";
        try {
          const uObj = new URL(url, window.location.href || "http://localhost");
          q = uObj.search || `?ts=${Date.now()}`;
        } catch(_) {
          q = `?ts=${Date.now()}`;
        }

        const srcUrl = `/extensions/${folder}/trix_color_match_src_${pid}.png${q}`;
        const refUrl = `/extensions/${folder}/trix_color_match_ref_${pid}.png${q}`;
        state.srcUrl = srcUrl;
        state.refUrl = refUrl;

        state.matchedImg.onload = () => {
            if (token !== state.loadToken) return;
            drawImageToCanvas();
        };
        state.matchedImg.onerror = () => {
            if (token !== state.loadToken) return;
            state.outReady = false;
            updateDOMPreview();
            app.graph?.setDirtyCanvas(true, true);
        };

        state.srcImg.onload = () => {
            if (token !== state.loadToken) return;
            updateDOMPreview();
            app.graph?.setDirtyCanvas(true, false);
        };
        state.refImg.onload = () => {
            if (token !== state.loadToken) return;
            updateDOMPreview();
            app.graph?.setDirtyCanvas(true, false);
        };

        state.matchedImg.src = url;
        state.srcImg.src = srcUrl;
        state.refImg.src = refUrl;

        updateDOMPreview();
    }

    // Called when the python node completes execution
    function loadExecuted(tsOverride){
      const previewMode = String(getVal(node, 'preview_mode') || 'show').toLowerCase();
      if(previewMode === 'hide') {
        state.outReady = false;
        updateDOMPreview();
        app.graph?.setDirtyCanvas(true, true);
        return;
      }

      const pid = String(node.id || 'A').replace(/[^a-zA-Z0-9_-]/g, "_");
      const ts = (typeof tsOverride==='number' && isFinite(tsOverride)) ? tsOverride : Date.now();
      const token = ++state.loadToken;
      
      const q = `?ts=${ts}`;
      const url = `/extensions/${folder}/trix_color_match_matched_${pid}.png${q}`;
      loadPreviewImage(url, token);
    }

    // Performs the actual network request for live preview
    async function _doFetchLivePreview() {
      const previewMode = String(getVal(node, 'preview_mode') || 'show').toLowerCase();
      if(previewMode === 'hide') {
        updateDOMPreview();
        return;
      }

      const imgNode = getUpstreamNodeByInputName(node, "image", 0);
      const refNode = getUpstreamNodeByInputName(node, "reference", 1);
      if (!imgNode || !refNode) return;

      const image_upload = detectSourceUpstream(imgNode);
      const reference_upload = detectSourceUpstream(refNode);

      let mask_connected = false;
      if (node.inputs) {
        const maskInput = node.inputs.find(input => input && input.name && input.name.toLowerCase().includes("mask"));
        if (maskInput && maskInput.link !== null && maskInput.link !== undefined) {
          mask_connected = true;
        }
      }

      const method = getVal(node, 'method');
      const target = getVal(node, 'target');
      const strength = getVal(node, 'strength');
      const device = getVal(node, 'device');
      const preview_id = String(node.id || 'A');

      try {
        const resp = await api.fetchApi("/trix_color_match/live_preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_upload: image_upload || null,
            reference_upload: reference_upload || null,
            method,
            target,
            strength,
            device,
            preview_id,
            mask_connected
          })
        });
        
        if (resp.ok) {
          const data = await resp.json();
          if (data.url) {
            const token = ++state.loadToken;
            loadPreviewImage(data.url, token);
          }
        }
      } catch(e) {
          console.warn("[TrixColorMatch] live preview error", e);
      }
    }

    // Called on widget or connection change for immediate or debounced preview
    function fetchLivePreview(immediate = false) {
      if (immediate) {
        if (state.apiTimeout) {
          clearTimeout(state.apiTimeout);
          state.apiTimeout = null;
        }
        _doFetchLivePreview();
      } else {
        if (state.apiTimeout) clearTimeout(state.apiTimeout);
        state.apiTimeout = setTimeout(_doFetchLivePreview, 120);
      }
    }

    function applyTooltips(){
      const wMethod = getWidget(node, 'method');
      if(wMethod){ wMethod.tooltip = wMethod.description = [
        'Color-matching method:',
        'LAB — mean/std transfer in perceptual Oklab space (recommended).',
        'RGB — mean/std transfer directly in RGB.',
        'Histogram — per-channel cumulative-distribution matching.',
        'wavelet — frequency-based details preservation.',
        'adain — Adaptive Instance Normalization.',
        'mkl — Monge-Kantorovich Linear transfer.',
        'reinhard — Reinhard transfer in l-alpha-beta color space.',
        'mvgd — Multivariate Gaussian Distribution transfer.',
        'hm — Classic histogram matching (color-matcher).',
      ].join('\n'); }
      const wTarget = getWidget(node, 'target');
      if(wTarget){ wTarget.tooltip = wTarget.description = [
        'Which part of the match to keep (rest stays from the original, split in Oklab):',
        'All — full color match.',
        'Lightness — match the reference tonality, keep original colors.',
        'Color — match the reference grade, keep original tonality.',
      ].join('\n'); }
    }

    function bindChanges(){
      if(!node.widgets) return;
      node.widgets.forEach(w => {
        const orig = w.callback || w.onChange;
        const cb = function(){
          if(orig) try{ orig.apply(this, arguments); }catch(_e){}
          
          const previewMode = String(getVal(node, 'preview_mode') || 'show').toLowerCase();
          const prevMode = node._trixLastPreviewMode || 'show';
          node._trixLastPreviewMode = previewMode;

          updateDOMPreview();

          if (w.name === 'preview_mode' || w.label === 'preview_mode' || w.name === 'preview mode' || w.label === 'preview mode') {
            if (previewMode === 'hide') {
              if (prevMode !== 'hide') {
                node._trixSavedPreviewH = node.size ? node.size[1] : null;
              }
              node._previewAutoSized = false;
              if (!isVueNodes()) {
                try {
                  const bottom = widgetsBottomY(node);
                  node.setSize([node.size[0], bottom + 10]);
                  app.graph?.setDirtyCanvas(true, true);
                } catch(_) {}
              }
            } else {
              if (prevMode === 'hide') {
                if (!isVueNodes()) {
                  try {
                    const bottom = widgetsBottomY(node);
                    const targetH = node._trixSavedPreviewH || (bottom + PREVIEW_H + 18);
                    node.setSize([node.size[0], targetH]);
                    app.graph?.setDirtyCanvas(true, true);
                  } catch(_) {}
                }
              }
              fetchLivePreview(true);
            }
          } else {
             fetchLivePreview(false);
          }
        };
        w.callback = cb; w.onChange = cb;
      });
    }

    applyTooltips();
    bindChanges();

    node._colorMatchLoad = loadExecuted;
    node._colorMatchLiveUpdate = fetchLivePreview;

    const prevExec = node.onExecuted;
    node.onExecuted = function(){ if(prevExec) try{ prevExec.apply(this, arguments); }catch(_e){} try{ loadExecuted(); }catch(_e){} };

    const origConnectionsChange = node.onConnectionsChange;
    node.onConnectionsChange = function(type, slotIndex, isConnect, link_info, input_info) {
      const r = origConnectionsChange ? origConnectionsChange.apply(this, arguments) : undefined;
      setTimeout(() => {
        updateUpstreamHooks(node);
        fetchLivePreview(true);
      }, 40);
      setTimeout(() => {
        updateUpstreamHooks(node);
        fetchLivePreview(true);
      }, 180);
      return r;
    };

    const origMouseMove = node.onMouseMove;
    node.onMouseMove = function(e, local_pos) {
      if (origMouseMove) try { origMouseMove.apply(this, arguments); } catch(_) {}
      if (isVueNodes()) return;
      const state = node._colorMatchState;
      if (!state) return;

      const previewMode = String(getVal(node, 'preview_mode') || 'show').toLowerCase();
      if (previewMode !== 'show before-after' && previewMode !== 'show compare reference') {
        state.isHovering = false;
        return;
      }

      const w = node.size[0];
      const h = node.size[1];
      const pad = 11;
      const safeTop = widgetsBottomY(node) + 18;
      const x = pad;
      const y = safeTop;
      const dw = w - pad*2;
      const dh = h - safeTop - pad;

      if (local_pos[0] >= x && local_pos[0] <= x + dw && local_pos[1] >= y && local_pos[1] <= y + dh) {
        state.isHovering = true;
        state.splitRatio = Math.max(0, Math.min(1, (local_pos[0] - x) / dw));
        node.graph?.setDirtyCanvas(true, false);
      } else {
        if (state.isHovering) {
          state.isHovering = false;
          state.splitRatio = 0.5;
          node.graph?.setDirtyCanvas(true, false);
        }
      }
    };

    const origMouseLeave = node.onMouseLeave;
    node.onMouseLeave = function(e) {
      if (origMouseLeave) try { origMouseLeave.apply(this, arguments); } catch(_) {}
      if (isVueNodes()) return;
      const state = node._colorMatchState;
      if (state && state.isHovering) {
        state.isHovering = false;
        state.splitRatio = 0.5;
        node.graph?.setDirtyCanvas(true, false);
      }
    };

    const origComputeSize = node.computeSize;
    node.computeSize = function() {
      const sz = origComputeSize ? origComputeSize.apply(this, arguments) : [360, 200];
      if (!isVueNodes()) {
        const previewMode = String(getVal(node, 'preview_mode') || 'show').toLowerCase();
        if (previewMode !== 'hide') {
          const bottom = widgetsBottomY(node);
          sz[1] = Math.max(sz[1], bottom + 60);
        }
      }
      return sz;
    };

    // Initial check on load
    setTimeout(() => {
      updateUpstreamHooks(node);
      fetchLivePreview(true);
    }, 100);
    setTimeout(() => {
      updateUpstreamHooks(node);
      fetchLivePreview(true);
    }, 400);
  }

  app.registerExtension({
    name: EXT_NAME,
    async setup(){
      try{
        api.addEventListener('trix_color_match_preview', (ev)=>{
          const detail = ev?.detail ?? ev;
          const pid = String(detail?.preview_id || '');
          const ts = (typeof detail?.ts === 'number') ? Math.floor(detail.ts*1000) : Date.now();
          if(!pid) return;
          const nodes = (app?.graph?._nodes || []).filter(n => (n.comfyClass || n.type || '').toString().includes('TrixColorMatchNode'));
          for(const n of nodes){
            try{
              if(!n._colorMatchPreviewAdded) ensureBehavior(n);
              const nodeIdOk = (typeof n.id === 'number' || typeof n.id === 'string') ? String(n.id) : '';
              if(nodeIdOk && nodeIdOk === pid && n._colorMatchLoad) {
                n._colorMatchLoad(ts);
              }
            }catch(_e){}
          }
        });
      }catch(_e){}
    },
    async beforeRegisterNodeDef(nodeType, nodeData){
      const nm = (nodeData?.name || nodeType?.name || '').toString();
      if(nm.includes('TrixColorMatchNode')){
        const origCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function(){ if(origCreated) try{ origCreated.apply(this, arguments); }catch(_e){} try{ ensureBehavior(this); }catch(_e){} };
        const origConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function(info) {
          this._loadedFromWorkflow = true;
          const r = origConfigure ? origConfigure.apply(this, arguments) : undefined;
          setTimeout(() => {
            updateUpstreamHooks(this);
            if (this._colorMatchLiveUpdate) this._colorMatchLiveUpdate(true);
          }, 100);
          setTimeout(() => {
            updateUpstreamHooks(this);
            if (this._colorMatchLiveUpdate) this._colorMatchLiveUpdate(true);
          }, 500);
          return r;
        };
        const origDraw = nodeType.prototype.onDrawForeground;
        nodeType.prototype.onDrawForeground = function(ctx){ if(origDraw) try{ origDraw.apply(this, arguments); }catch(_e){} try{ if(this._colorMatchPreviewAdded) drawPreview(this, ctx); }catch(_e){} };
      }
    },
    async afterConfigureGraph() {
      const nodes = (app?.graph?._nodes || []).filter(n => (n.comfyClass || n.type || '').toString().includes('TrixColorMatchNode'));
      for (const n of nodes) {
        try {
          if (!n._colorMatchPreviewAdded) ensureBehavior(n);
          updateUpstreamHooks(n);
          if (n._colorMatchLiveUpdate) n._colorMatchLiveUpdate(true);
        } catch(_) {}
      }
    }
  });
})();
