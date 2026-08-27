/**
 * TrixPromptAIO — main ComfyUI extension.
 * Handles state persistence natively via node.properties (Pixaroma architecture).
 */

import { app } from "/scripts/app.js";
import { api } from "/scripts/api.js";
import { PromptStack } from "./components/prompt_stack.js";
import { PreviewTab } from "./components/preview_tab.js";
import { StyleGallery } from "./components/style_gallery.js";
import { SettingsDrawer } from "./components/settings_drawer.js";
// ---- Nodes 2.0 (Vue) & Nodes 1.0 Compatibility Helpers ----
function isVueNodes() {
  return !!window.LiteGraph?.vueNodesMode;
}

function applyAdaptiveCanvasOnly(widget) {
  if (!widget || !widget.options) return widget;
  try {
    Object.defineProperty(widget.options, "canvasOnly", {
      configurable: true,
      enumerable: true,
      get() { return !window.LiteGraph?.vueNodesMode; },
    });
  } catch (_e) {
    widget.options.canvasOnly = !window.LiteGraph?.vueNodesMode;
  }
  return widget;
}

function installResizeFloor(root, measureFn, onRelease) {
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
if (app && app.loadGraphData && !app._nodes2CompatLoadWrapped) {
  app._nodes2CompatLoadWrapped = true;
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

function isGraphLoading() {
  return _graphLoading;
}

function hideJsonWidget(widgets, widgetName) {
  const w = (widgets || []).find((x) => x.name === widgetName);
  if (w) {
    w.hidden = true;
    w.serialize = false;  // prevent native graphToPrompt from including this in inputs
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


function gateResizeAndDraw(nodeType, minW, minH) {
  const origOnResize = nodeType.prototype.onResize;
  nodeType.prototype.onResize = function (size) {
    if (!isVueNodes()) {
      if (size[0] < minW) size[0] = minW;
      if (size[1] < minH) size[1] = minH;
      if (this.size[0] < minW) this.size[0] = minW;
      if (this.size[1] < minH) this.size[1] = minH;
    }
    if (origOnResize) return origOnResize.apply(this, arguments);
  };

  const origDraw = nodeType.prototype.onDrawForeground;
  nodeType.prototype.onDrawForeground = function (ctx) {
    if (origDraw) origDraw.call(this, ctx);
    if (this.flags?.collapsed || isVueNodes()) return;
    if (this.size[0] < minW) this.size[0] = minW;
    if (this.size[1] < minH) this.size[1] = minH;
  };
}

// ---- Inject CSS ----
const CSS_ID = "trix-prompt-aio-css";
function injectCSS() {
  if (document.getElementById(CSS_ID)) return;
  const link = document.createElement("link");
  link.id = CSS_ID;
  link.rel = "stylesheet";
  link.type = "text/css";
  link.href = new URL("../css/style.css?v=" + Date.now(), import.meta.url).href;
  document.head.appendChild(link);
}
injectCSS();

// ---- Dynamic Node Height Adaptation ----
const DEFAULT_W = 320;
const MIN_W = 200;
const MIN_H = 180;

function getTargetHeight(node, root) {
  const trixWidget = node?.widgets?.find(w => w.name === "trix_ui");
  const widgetY = (trixWidget && typeof trixWidget.last_y === "number" && trixWidget.last_y > 0)
    ? trixWidget.last_y
    : 30;
  
  const contentH = (root && root.offsetHeight > 0) ? root.offsetHeight : 120;
  return Math.ceil(widgetY + contentH + 12);
}

// Grow node only if content height exceeds current node height (Legacy LiteGraph mode only)
function growNodeToContent(node, root) {
  if (!node || !root || node.flags?.collapsed || isVueNodes()) return;
  const targetH = getTargetHeight(node, root);
  if (targetH > node.size[1]) {
    node.size[1] = targetH;
    if (node.setSize) node.setSize([node.size[0], targetH]);
    node.setDirtyCanvas?.(true, true);
  }
}

function fitNodeToContent(node, root) {
  if (!node || !root || node.flags?.collapsed || isVueNodes()) return;
  const targetH = Math.max(MIN_H, getTargetHeight(node, root));
  if (targetH !== node.size[1]) {
    node.size[1] = targetH;
    if (node.setSize) node.setSize([node.size[0], targetH]);
    node.setDirtyCanvas?.(true, true);
  }
}

const NATIVE_WIDGET_NAMES = [
  "prompt_stack", "negative_prompt",
  "translation_enabled", "translation_engine", "translation_mode", "offline_model",
  "source_lang", "target_lang",
  "accent_color", "group_mode", "group_seed",
  "sep_comma", "sep_period", "sep_space", "sep_newline",
];

// Widgets that must be physically removed (not just hidden) so they are
// never serialized into node["inputs"] by graphToPrompt.
// ComfyUI's cache key is built from ALL inputs values — if "seed" is present
// and control_after_generate mutates it each run, the cache is busted every time.
const REMOVE_WIDGET_NAMES = ["seed", "control_before_generate", "control_after_generate"];

function removeWidget(node, name) {
  if (!node || !node.widgets) return;
  const idx = node.widgets.findIndex(w => w.name === name);
  if (idx === -1) return;
  const w = node.widgets[idx];
  // Detach any DOM element
  const el = w.element || w.inputEl;
  if (el && el.parentNode) el.parentNode.removeChild(el);
  node.widgets.splice(idx, 1);
}

function hideNativeWidgets(node) {
  if (!node || !node.widgets) return;
  // Physically remove seed & control_after_generate so graphToPrompt never
  // serializes them and they never pollute the ComfyUI cache key.
  for (const name of REMOVE_WIDGET_NAMES) {
    removeWidget(node, name);
  }
  // Hide data-only widgets (they still need to exist for value storage,
  // but should not be visible on the canvas).
  for (const name of NATIVE_WIDGET_NAMES) {
    hideJsonWidget(node.widgets, name);
  }
}


function installCanvasZoomPassthrough(root) {
  if (!root || typeof root.addEventListener !== "function") return;

  function findScrollContainer(target) {
    let curr = target;
    while (curr && curr !== root && curr !== document.body && curr !== document.documentElement) {
      if (curr.tagName === "TEXTAREA" || curr.tagName === "SELECT") {
        return curr;
      }

      if (curr.classList) {
        if (
          curr.classList.contains("trix-ps-categories") ||
          curr.classList.contains("trix-ps-styles-grid") ||
          curr.classList.contains("trix-ps-rows") ||
          curr.classList.contains("trix-autocomplete-list") ||
          curr.classList.contains("trix-ps-preview-textarea") ||
          curr.classList.contains("trix-ps-pos-preview") ||
          curr.classList.contains("trix-modal-content") ||
          curr.classList.contains("trix-ps-add-style-form")
        ) {
          return curr;
        }
      }

      const style = window.getComputedStyle(curr);
      const overflowY = style.overflowY;
      const overflowX = style.overflowX;

      const isScrollY = (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") && curr.scrollHeight > curr.clientHeight;
      const isScrollX = (overflowX === "auto" || overflowX === "scroll" || overflowX === "overlay") && curr.scrollWidth > curr.clientWidth;

      if (isScrollY || isScrollX) {
        return curr;
      }

      curr = curr.parentElement;
    }
    return null;
  }

  root.addEventListener("wheel", (e) => {
    const isVueMode = !!window.LiteGraph?.vueNodesMode;

    // Check if wheel occurred over a scrollable container inside node
    if (!e.ctrlKey && !e.metaKey) {
      const scrollContainer = findScrollContainer(e.target);

      if (scrollContainer) {
        // ALWAYS stop propagation so canvas zoom NEVER triggers on scroll containers (in both LiteGraph and Nodes 2.0 Vue mode)!
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        // In Vue 2.0, the canvas zoom handler listens for wheel events and checks if they were prevented.
        // We MUST prevent default to tell Vue and the browser that we handled this scroll natively.
        // But doing so kills native scrolling, so we MUST manually scroll the container!
        e.preventDefault();

        // Special handling for category pills bar: translate vertical wheel (deltaY) into horizontal scrolling (scrollLeft)
        const catBar = scrollContainer.classList.contains("trix-ps-categories")
          ? scrollContainer
          : (typeof scrollContainer.closest === "function" ? scrollContainer.closest(".trix-ps-categories") : null);

        if (catBar) {
          catBar.scrollLeft += (e.deltaY !== 0 ? e.deltaY : e.deltaX);
          return;
        }

        // For other scroll containers, manually apply the scroll delta
        const isY = scrollContainer.scrollHeight > scrollContainer.clientHeight;
        const isX = scrollContainer.scrollWidth > scrollContainer.clientWidth;

        if (isY && e.deltaY !== 0) {
          scrollContainer.scrollTop += e.deltaY;
        } else if (isX && e.deltaX !== 0) {
          scrollContainer.scrollLeft += e.deltaX;
        }
        
        return;
      }
    }

    // In Nodes 2.0 Vue Mode, if not over a scroll container (or holding Ctrl/Cmd), let Vue handle canvas zoom natively
    if (isVueMode) return;

    const canvasEl = app?.canvas?.canvas;
    if (!canvasEl) return;
    e.preventDefault();
    e.stopPropagation();
    const { clientX, clientY, deltaX, deltaY, deltaMode, ctrlKey, metaKey, shiftKey } = e;
    canvasEl.dispatchEvent(new WheelEvent("wheel", {
      clientX, clientY, deltaX, deltaY, deltaMode,
      ctrlKey, metaKey, shiftKey, bubbles: true, cancelable: true,
    }));
  }, { passive: false });
}

// ---- Build Root Container ----
function buildRoot() {
  const root = document.createElement("div");
  root.className = "trix-ps-root nodrag noscroll";
  root.style.opacity = "1";

  // Prevent ALL clicks and drags from leaking to LiteGraph / Vue canvas
  // This completely stops the "Value" dialog bug when missing a button.
  const stopProp = (e) => e.stopPropagation();
  root.addEventListener("pointerdown", stopProp);
  root.addEventListener("mousedown", stopProp);
  root.addEventListener("pointerup", stopProp);
  root.addEventListener("mouseup", stopProp);
  root.addEventListener("click", stopProp);
  root.addEventListener("dblclick", stopProp);
  root.addEventListener("contextmenu", stopProp);

  installCanvasZoomPassthrough(root);

  root.innerHTML = `
    <!-- Language pair & Token count indicator (shown when Translate is active) -->
    <div class="trix-ps-lang-indicator">
      <span class="trix-ps-lang-text">auto ⇢ en</span>
      <span class="trix-ps-token-text">0 tokens</span>
    </div>

    <!-- Header Bar: Actions | Prompts Preview Styles | ⚙︎ -->
    <div class="trix-ps-header">
      <div class="trix-ps-header-actions trix-ps-actions-prompts">
        <button class="trix-ps-icon-btn trix-ps-add-btn" title="Add prompt row">✚</button>
        <button class="trix-ps-icon-btn trix-ps-xlate-btn" title="Translate now">友</button>
      </div>
      <div class="trix-ps-header-actions trix-ps-actions-styles" style="display:none;">
        <button class="trix-ps-icon-btn trix-ps-style-opts-btn" title="Card actions mode (⠈ ⠘ ⠸)">⠈</button>
        <button class="trix-ps-icon-btn trix-ps-view-mode-btn" title="Cycle view mode">⊞</button>
      </div>
      <div class="trix-ps-tabs">
        <button class="trix-ps-tab active" data-tab="prompts" title="Prompt">
          <span class="trix-tab-label-full">Prompt</span>
          <span class="trix-tab-label-short">✎</span>
        </button>
        <button class="trix-ps-tab" data-tab="preview" title="Preview">
          <span class="trix-tab-label-full">Preview</span>
          <span class="trix-tab-label-short">ᨒ</span>
        </button>
        <button class="trix-ps-tab" data-tab="styles" title="Styles">
          <span class="trix-tab-label-full">Styles</span>
          <span class="trix-tab-label-short">𒀭</span>
        </button>
      </div>
      <button class="trix-ps-icon-btn trix-ps-gear-btn" title="Node settings">⚙︎</button>
    </div>

    <!-- Prompts Panel -->
    <div class="trix-ps-panel active" data-panel="prompts">
      <div class="trix-ps-rows"></div>
    </div>

    <!-- Preview Panel -->
    <div class="trix-ps-panel" data-panel="preview">
      <div class="trix-ps-preview-box">
        <div class="trix-ps-preview-label">㊉ Positive</div>
        <div class="trix-ps-preview-textarea trix-ps-pos-preview" contenteditable="false" placeholder="Positive prompt preview…"></div>
      </div>
      <div class="trix-ps-preview-box" style="margin-top:4px;">
        <div class="trix-ps-preview-label" style="color:#e06c6c;">㊀ Negative</div>
        <textarea class="trix-ps-preview-textarea trix-ps-neg-preview" placeholder="type your negative prompt, use @ for tags, * for group tags."></textarea>
      </div>
    </div>

    <!-- Styles Panel -->
    <div class="trix-ps-panel" data-panel="styles">
      <div class="trix-ps-gallery-header">
        <button class="trix-ps-icon-btn trix-ps-pack-mgr-btn" title="Style & Pack Manager">🗁</button>
        <button class="trix-ps-icon-btn trix-ps-add-custom-btn" title="Add custom style">✚</button>
        <div class="trix-ps-search-box">
          <span>🔍︎</span>
          <input type="text" class="trix-ps-search-input" placeholder="Search styles…"/>
        </div>
      </div>
      <div class="trix-ps-categories"></div>

      <!-- Custom style form -->
      <div class="trix-ps-add-style-form" style="display:none;">
        <div style="font-size:10px;font-weight:700;color:var(--trix-prompt-accent,#ff5500);margin-bottom:2px;">Add Custom Style</div>
        <input type="text" class="trix-ps-form-input trix-ps-cs-name" placeholder="Style name…"/>
        <input type="text" class="trix-ps-form-input trix-ps-cs-tags" placeholder="Tags (comma separated)…"/>
        <textarea class="trix-ps-form-input trix-ps-cs-pos" rows="2" placeholder="Positive prompt…"></textarea>
        <textarea class="trix-ps-form-input trix-ps-cs-neg" rows="1" placeholder="Negative prompt…"></textarea>
        <div style="display:flex;gap:4px;justify-content:flex-end;">
          <button class="trix-ps-btn trix-ps-form-cancel">Cancel</button>
          <button class="trix-ps-btn accent trix-ps-form-save">Save</button>
        </div>
      </div>

      <div class="trix-ps-styles-grid"></div>
    </div>
  `;
  return root;
}

// ---- Global Hook for Workflow Run Payload ----
let _origGraphToPrompt = null;

app.registerExtension({
  name: "ComfyUI.TrixPromptAIO",

  async setup() {
    if (!_origGraphToPrompt && app.graphToPrompt) {
      _origGraphToPrompt = app.graphToPrompt;
      app.graphToPrompt = async function () {
        const prompt = await _origGraphToPrompt.apply(this, arguments);
        if (prompt && prompt.output) {
          for (const node of app.graph.nodes) {
            if (node.comfyClass === "TrixPromptAIO" && prompt.output[node.id]) {
              const inputs = prompt.output[node.id].inputs;
              if (node._trixStack) {
                const compiled = typeof node._trixStack.getCompiledPositive === "function"
                  ? node._trixStack.getCompiledPositive()
                  : (node._trixStack.getState().rows || []).filter(r => r.enabled && r.text.trim()).map(r => r.text.trim()).join(", ");
                inputs.prompt_stack = compiled;
              }
              if (node._trixNegEl) {
                inputs.negative_prompt = node._trixNegEl.value;
              }
              if (node._trixSettings) {
                inputs.group_mode = node._trixSettings.groupMode || "increment";
                inputs.group_seed = parseInt(node._trixSettings.groupSeed ?? 1, 10) || 1;
                inputs.translation_engine = node._trixSettings.transEngine || "online_google";
                inputs.translation_mode = node._trixSettings.transMode || "live";
                inputs.translation_enabled = node._trixSettings.transEnabled ? "true" : "false";
                inputs.offline_model = node._trixSettings.offlineModel || "nllb_200_distilled";
                inputs.source_lang = node._trixSettings.srcLang || "auto";
                inputs.target_lang = node._trixSettings.tgtLang || "en";
                inputs.accent_color = node._trixSettings.accentColor || "#ff5500";
                inputs.sep_comma = node._trixSettings.sepComma !== false ? "true" : "false";
                inputs.sep_period = node._trixSettings.sepPeriod ? "true" : "false";
                inputs.sep_space = node._trixSettings.sepSpace !== false ? "true" : "false";
                inputs.sep_newline = node._trixSettings.sepNewline ? "true" : "false";
              }
            }
          }
        }
        return prompt;
      };
    }

    api.addEventListener("trix_prompt_group_seed_update", (ev) => {
      const data = ev.detail;
      if (data && data.group_seed !== undefined) {
        if (app.graph && app.graph.nodes) {
          for (const node of app.graph.nodes) {
            if (node.comfyClass === "TrixPromptAIO") {
              if (!data.node_id || data.node_id.startsWith(node.id.toString())) {
                if (node._trixSettings) {
                  node._trixSettings.groupSeed = data.group_seed;
                  const w = node.widgets?.find(x => x.name === "group_seed");
                  if (w) w.value = data.group_seed;
                }
              }
            }
          }
        }
      }
    });
  },

  beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== "TrixPromptAIO") return;

    // Pixaroma Rule 3 & 9: Gate onResize & onDrawForeground for Nodes 1.0 vs 2.0
    gateResizeAndDraw(nodeType, MIN_W, MIN_H);

    const origCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      if (origCreated) origCreated.apply(this, arguments);
      const node = this;
      injectCSS();

        // Hide all standard widgets (seed, control after generate, etc.)
        hideNativeWidgets(node);

        // Ensure state fields exist in node.properties
        node.properties = node.properties || {};

        // Hidden widget helper
        const setWidget = (name, val) => {
          const w = node.widgets?.find(x => x.name === name);
          if (w) w.value = val;
        };

        const root = buildRoot();
        node._trixRoot = root;
        node._trixNegEl = root.querySelector(".trix-ps-neg-preview");

        // Negative prompt listener & persistence
        if (node._trixNegEl) {
          node._trixNegEl.addEventListener("input", () => {
            const val = node._trixNegEl.value;
            node.properties.negativePrompt = val;
            setWidget("negative_prompt", val);
          });
        }

        // Tab switching + Action Header toggle
        const tabs = root.querySelectorAll(".trix-ps-tab");
        const panels = root.querySelectorAll(".trix-ps-panel");
        const actionsPrompts = root.querySelector(".trix-ps-actions-prompts");
        const actionsStyles = root.querySelector(".trix-ps-actions-styles");

        const activateTab = (target) => {
          tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === target));
          panels.forEach(p => p.classList.toggle("active", p.dataset.panel === target));

          if (target === "styles") {
            if (actionsPrompts) actionsPrompts.style.display = "none";
            if (actionsStyles) actionsStyles.style.display = "flex";
          } else {
            if (actionsPrompts) actionsPrompts.style.display = "flex";
            if (actionsStyles) actionsStyles.style.display = "none";
          }

          node.properties = node.properties || {};
          node.properties.activeTab = target;

          if (target === "preview" && typeof previewTab !== "undefined" && typeof promptStack !== "undefined") {
            const compiled = promptStack.getCompiledPositiveHTML();
            previewTab.setPositive(compiled);
          } else if (target === "styles" && node._trixGallery) {
            node._trixGallery.renderCategories();
            node._trixGallery.filterStyles(node._trixGallery.searchQuery, node._trixGallery.selectedCategory);
          }

          requestAnimationFrame(() => {
            fitNodeToContent(node, root);
          });
        };

        tabs.forEach(tab => {
          tab.addEventListener("click", () => activateTab(tab.dataset.tab));
        });
        node._activateTab = activateTab;

        // Preview Tab
        const previewTab = new PreviewTab(
          root,
          (posText) => promptStack.syncFromPreview(posText),
          (negText) => {
            node.properties.negativePrompt = negText;
            setWidget("negative_prompt", negText);
          }
        );

        // Prompt Stack
        const promptStack = new PromptStack(
          root,
          (state) => {
            node.properties.trixState = state;
            setWidget("prompt_stack", JSON.stringify(state));
            const compiledHTML = promptStack.getCompiledPositiveHTML();
            previewTab.setPositive(compiledHTML);
            if (typeof updateLangIndicator === "function") updateLangIndicator();
            fitNodeToContent(node, root);
          },
          (action) => {
            fitNodeToContent(node, root);
          }
        );
        node._trixStack = promptStack;

        // Attach tag autocomplete & translation helpers to Negative prompt textarea
        if (node._trixNegEl) {
          if (promptStack.autocomplete) {
            promptStack.autocomplete.attach(node._trixNegEl, () => {
              node._trixNegEl.dispatchEvent(new Event("input"));
            });
          }
          if (typeof promptStack.attachTranslationToTextarea === "function") {
            promptStack.attachTranslationToTextarea(node._trixNegEl);
          }
        }

        // Sync preview deletion back to stack
        promptStack.syncFromPreview = (previewText) => {
          const rowEls = root.querySelectorAll(".trix-ps-row");
          for (const row of rowEls) {
            if (row.dataset.enabled === "true") {
              const ta = row.querySelector(".trix-ps-textarea");
              if (ta) {
                ta.value = previewText;
                ta.dispatchEvent(new Event("input"));
              }
              return;
            }
          }
        };

        // Style Gallery
        const styleGallery = new StyleGallery(root, (style) => {}, node);
        styleGallery.promptStack = promptStack;
        node._trixGallery = styleGallery;
        styleGallery.activateTab = activateTab;

        // Header Style Action Level button (⠈ ⠘ ⠸)
        const styleOptsBtn = root.querySelector(".trix-ps-style-opts-btn");
        if (styleOptsBtn) {
          if (node.properties?.cardActionsLevel) {
            styleGallery.optionLevel = node.properties.cardActionsLevel;
            const lvlObj = [
              { level: 1, icon: "⠈" },
              { level: 2, icon: "⠘" },
              { level: 3, icon: "⠸" }
            ].find(l => l.level === node.properties.cardActionsLevel);
            if (lvlObj) styleOptsBtn.textContent = lvlObj.icon;
          }
          styleOptsBtn.addEventListener("click", () => {
            const nextLvl = styleGallery.cycleOptionLevel();
            styleOptsBtn.textContent = nextLvl.icon;
            node.properties = node.properties || {};
            node.properties.cardActionsLevel = nextLvl.level;
          });
        }

        // Header Pack Manager button (𗗁) -> opens Packs tab in Manager
        const packMgrBtn = root.querySelector(".trix-ps-pack-mgr-btn");
        if (packMgrBtn) {
          packMgrBtn.addEventListener("click", () => {
            styleGallery.modal.setStyles(styleGallery.styles);
            styleGallery.modal.activeTab = "packs";
            styleGallery.modal.open();
          });
        }

        const viewModeBtn = root.querySelector(".trix-ps-view-mode-btn");
        if (viewModeBtn) {
          if (node.properties?.viewMode) {
            styleGallery.setViewMode(node.properties.viewMode);
          }
          viewModeBtn.addEventListener("click", () => {
            const nextMode = styleGallery.cycleViewMode();
            node.properties = node.properties || {};
            node.properties.viewMode = nextMode.key;
            if (node._trixSettings) {
              node._trixSettings.styleViewMode = nextMode.key;
              node.properties.trixSettings = node._trixSettings;
            }
          });
        }

        // Share @tag and *category map with stack
        const populateTags = () => {
          if (styleGallery.styles && styleGallery.styles.length > 0) {
            promptStack.setStyleTagMap(styleGallery.getAllStyleTags());
            const cats = new Set();
            for (const s of styleGallery.styles) {
              const cat = s.categoryKey || s.category;
              if (cat) {
                const norm = cat.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
                if (norm) cats.add(norm);
              }
            }
            if (Array.isArray(styleGallery.categories)) {
              for (const c of styleGallery.categories) {
                const norm = c.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
                if (norm) cats.add(norm);
              }
            }
            if (typeof promptStack.setCategorySet === "function") {
              promptStack.setCategorySet(cats);
            }
            promptStack._notify();
          }
        };

        const origLoadStyles = styleGallery.loadStyles.bind(styleGallery);
        styleGallery.loadStyles = async function (...args) {
          await origLoadStyles(...args);
          populateTags();
          // Restore saved category selection from node.properties or fallback
          const savedCat = node.properties?.styleCategory;
          if (savedCat && styleGallery.categories && styleGallery.categories.includes(savedCat)) {
            styleGallery.selectCategory(savedCat);
          } else if (savedCat && savedCat !== "All" && savedCat !== "favorite") {
            styleGallery.selectCategory("All");
          }
        };

        populateTags();
        let initAttempts = 0;
        const checkStyles = setInterval(() => {
          initAttempts++;
          if (styleGallery.styles && styleGallery.styles.length > 0) {
            populateTags();
            clearInterval(checkStyles);
          } else if (initAttempts > 20) {
            clearInterval(checkStyles);
          }
        }, 300);

        const estimateTokenCount = (text) => {
          if (!text || !text.trim()) return 0;
          const pattern = /[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu;
          const matches = text.match(pattern);
          if (!matches) return 0;
          let count = 0;
          for (const token of matches) {
            if (/^[^\s\p{L}\p{N}]$/u.test(token)) {
              count += 1;
            } else {
              const isAscii = /^[\x00-\x7F]+$/.test(token);
              if (isAscii) {
                if (token.length <= 6) {
                  count += 1;
                } else {
                  count += Math.ceil(token.length / 4);
                }
              } else {
                if (/[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/u.test(token)) {
                  count += Math.max(1, Math.ceil(token.length * 1.5));
                } else {
                  count += Math.max(1, Math.ceil(token.length / 2));
                }
              }
            }
          }
          return count;
        };

        const updateLangIndicator = () => {
          const ind = root.querySelector(".trix-ps-lang-indicator");
          const label = root.querySelector(".trix-ps-lang-text");
          const tokenEl = root.querySelector(".trix-ps-token-text");
          if (!ind || !label) return;
          const s = node._trixSettings;
          if (s && s.transEnabled) {
            const src = s.srcLang || "auto";
            const tgt = s.tgtLang || "en";
            label.textContent = `${src} ⇢ ${tgt}`;
            if (tokenEl && typeof promptStack.getCompiledPositive === "function") {
              const compiled = promptStack.getCompiledPositive();
              const count = estimateTokenCount(compiled);
              tokenEl.textContent = `${count} tokens`;
            }
            ind.style.display = "flex";
          } else {
            ind.style.display = "none";
          }
        };

        // Settings Drawer
        const settingsDrw = new SettingsDrawer(root, node, (s) => {
          node._trixSettings = s;
          node.properties.trixSettings = s;
          promptStack.setTranslationConfig(
            s.transEnabled, s.transMode, s.transEngine,
            s.srcLang, s.tgtLang, s.offlineModel
          );
          if (typeof promptStack.setSeparators === "function") {
            promptStack.setSeparators(s.sepComma, s.sepPeriod, s.sepSpace, s.sepNewline);
          }
          const xlateBtn = root.querySelector(".trix-ps-xlate-btn");
          if (xlateBtn) xlateBtn.classList.toggle("active", !!s.transEnabled);
          updateLangIndicator();

          setWidget("translation_engine",  s.transEngine);
          setWidget("translation_mode",    s.transMode);
          setWidget("translation_enabled", s.transEnabled ? "true" : "false");
          setWidget("offline_model",       s.offlineModel || "nllb_200_distilled");
          setWidget("source_lang",         s.srcLang);
          setWidget("target_lang",         s.tgtLang);
          setWidget("accent_color",       s.accentColor);
          setWidget("group_mode",         s.groupMode);
          setWidget("group_seed",         s.groupSeed ?? 1);

          if (typeof styleGallery.setViewMode === "function") {
            styleGallery.setViewMode(s.styleViewMode || "grid");
          }
          if (s.accentColor && app.graph) {
            app.graph.setDirtyCanvas(true, true);
          }
        });
        node._trixSettings = settingsDrw.getSettings();
        if (typeof promptStack.setSeparators === "function") {
          const s = node._trixSettings;
          promptStack.setSeparators(s.sepComma, s.sepPeriod, s.sepSpace, s.sepNewline);
        }
        updateLangIndicator();

        // 友 Button — per-node translation toggle
        const xlateBtn = root.querySelector(".trix-ps-xlate-btn");
        xlateBtn.classList.toggle("active", !!node._trixSettings.transEnabled);
        xlateBtn.addEventListener("click", () => {
          const s = settingsDrw.getSettings();
          s.transEnabled = !s.transEnabled;
          settingsDrw.settings.transEnabled = s.transEnabled;
          node.properties = node.properties || {};
          node.properties.trixSettings = Object.assign({}, s);
          settingsDrw._emit();
          updateLangIndicator();
        });

        // Header buttons
        root.querySelector(".trix-ps-add-btn").addEventListener("click", () => promptStack.addRow());

        // Add DOM Widget
        const widget = node.addDOMWidget("trix_ui", "trix_ps_widget", root, {
          getValue: () => null,
          setValue: () => {},
          getMinHeight: () => (root && root.offsetHeight > 0) ? root.offsetHeight : 120,
          margin: 4,
          serialize: false,
        });
        widget.name = "trix_ui";
        widget.type = "trix_ps_widget";
        node._trixWidget = widget;

        // Pixaroma Rule 1: Adaptive canvasOnly getter
        applyAdaptiveCanvasOnly(widget);

        // Pixaroma Rule 4: Dynamic resize floor for Nodes 2.0
        this._floorOff = installResizeFloor(root, () => root.scrollHeight || root.offsetHeight || MIN_H);

        widget.computeSize = (width) => [width, (root && root.offsetHeight > 0) ? root.offsetHeight : 120];

        const origWidgetDraw = widget.draw;
        widget.draw = function(ctx, n, widget_width, y, H) {
          if (origWidgetDraw) origWidgetDraw.apply(this, arguments);
          if (this.element && !n.flags?.collapsed) {
            if (!window.LiteGraph?.vueNodesMode) {
              const marginLeft = 4;
              const marginRight = 4;
              this.element.style.setProperty("left", (n.pos[0] + marginLeft) + "px", "important");
              this.element.style.setProperty("width", (n.size[0] - marginLeft - marginRight) + "px", "important");
              this.element.style.setProperty("height", "auto", "important");
              this.element.style.setProperty("margin", "0px", "important");
              this.element.style.setProperty("margin-top", "-2px", "important");
              this.element.style.setProperty("box-sizing", "border-box", "important");
            } else {
              this.element.style.removeProperty("left");
              this.element.style.setProperty("width", "100%", "important");
              this.element.style.setProperty("box-sizing", "border-box", "important");
              this.element.style.removeProperty("margin");
              this.element.style.removeProperty("margin-top");
            }
          }
        };

        // ResizeObserver: auto-fits node height to DOM content
        const _ro = new ResizeObserver(() => {
          const w = node.size[0] || root.offsetWidth || 300;
          root.classList.toggle("is-compact", w < 260);
          fitNodeToContent(node, root);
        });
        _ro.observe(root);
        node._trixRO = _ro;

        // --- RESTORE ALL STATE NATIVELY FROM node.properties ---
        const savedState = node.properties.trixState;
        if (savedState && Array.isArray(savedState.rows) && savedState.rows.length > 0) {
          promptStack.loadState(savedState);
        } else {
          // Fallback to widget if present
          const wStack = node.widgets?.find(w => w.name === "prompt_stack");
          if (wStack && wStack.value) {
            try { promptStack.loadState(JSON.parse(wStack.value)); } catch(_) { promptStack.addRow(""); }
          } else {
            promptStack.addRow("");
          }
        }

        const savedNeg = node.properties.negativePrompt;
        if (savedNeg !== undefined && node._trixNegEl) {
          node._trixNegEl.value = savedNeg;
        } else {
          const wNeg = node.widgets?.find(w => w.name === "negative_prompt");
          if (wNeg && wNeg.value !== undefined && node._trixNegEl) {
            node._trixNegEl.value = wNeg.value;
          }
        }

        if (node.properties.activeTab) {
          activateTab(node.properties.activeTab);
        }

        const isBrandNew = !savedState;
        if (isBrandNew) {
          node.size[0] = DEFAULT_W;
          const doInitialFit = () => {
            fitNodeToContent(node, root);
            root.style.opacity = "1";
          };
          requestAnimationFrame(doInitialFit);
          setTimeout(doInitialFit, 50);
          setTimeout(doInitialFit, 150);
        } else {
          // Rows have been restored with saved heights.
          // Wait two animation frames so addRow's RAF height-apply fires first,
          // then fit the node to exactly match the restored content.
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              fitNodeToContent(node, root);
              root.style.opacity = "1";
            });
          });
        }
    };

    const origConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function (info) {
      const res = origConfigure ? origConfigure.apply(this, arguments) : undefined;
      hideNativeWidgets(this);
      const applyConfigure = () => {
        if (this.properties?.trixSettings && this._trixSettings) {
          Object.assign(this._trixSettings, this.properties.trixSettings);
        }
        
        // Restore prompt rows state
        if (this.properties?.trixState && this._trixStack) {
          this._trixStack.loadState(this.properties.trixState);
        } else if (this.widgets) {
          const wStack = this.widgets.find(w => w.name === "prompt_stack");
          if (wStack && wStack.value && this._trixStack) {
             try { this._trixStack.loadState(JSON.parse(wStack.value)); } catch(_) {}
          }
        }
        
        // Restore negative prompt state
        if (this.properties?.negativePrompt !== undefined && this._trixNegEl) {
          this._trixNegEl.value = this.properties.negativePrompt;
        } else if (this.widgets) {
          const wNeg = this.widgets.find(w => w.name === "negative_prompt");
          if (wNeg && wNeg.value !== undefined && this._trixNegEl) {
            this._trixNegEl.value = wNeg.value;
          }
        }

        if (this.properties?.activeTab && typeof this._activateTab === "function") {
          this._activateTab(this.properties.activeTab);
        }
        if (this.properties?.styleCategory && this._trixGallery) {
          this._trixGallery.selectCategory(this.properties.styleCategory);
        }
        if (this.properties?.viewMode && this._trixGallery) {
          this._trixGallery.setViewMode(this.properties.viewMode);
        }
        if (this.properties?.cardActionsLevel && this._trixGallery) {
          this._trixGallery.optionLevel = this.properties.cardActionsLevel;
          const styleOptsBtn = this._trixRoot?.querySelector(".trix-ps-style-opts-btn");
          const icons = { 1: "⠈", 2: "⠘", 3: "⠸" };
          if (styleOptsBtn && icons[this.properties.cardActionsLevel]) {
            styleOptsBtn.textContent = icons[this.properties.cardActionsLevel];
          }
          this._trixGallery.renderGrid(this._trixGallery.styles);
        }
        const xlateBtn = this._trixRoot?.querySelector(".trix-ps-xlate-btn");
        if (xlateBtn && this._trixSettings) {
          xlateBtn.classList.toggle("active", !!this._trixSettings.transEnabled);
        }
        const ind = this._trixRoot?.querySelector(".trix-ps-lang-indicator");
        const label = this._trixRoot?.querySelector(".trix-ps-lang-text");
        if (ind && label && this._trixSettings) {
          if (this._trixSettings.transEnabled) {
            label.textContent = `${this._trixSettings.srcLang || "auto"} ⇢ ${this._trixSettings.tgtLang || "en"}`;
            ind.style.display = "flex";
          } else {
            ind.style.display = "none";
          }
        }
      };
      if (typeof this._activateTab === "function") {
        applyConfigure();
      } else {
        queueMicrotask(applyConfigure);
      }
      return res;
    };

    const origRemoved = nodeType.prototype.onRemoved;
    nodeType.prototype.onRemoved = function () {
      this._floorOff?.();
      this._trixRO?.disconnect();
      this._trixRO = null;
      this._trixRoot = null;
      if (origRemoved) return origRemoved.apply(this, arguments);
    };
  }
});
