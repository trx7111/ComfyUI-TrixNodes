/**
 * LoRA Advanced Settings Drawer for ND Super LoRA Loader
 * Provides:
 *  1. SmoothStep (Weight contrast & noise suppression)
 *  2. DARE Sparsification (Anti-overcooking & stacking conflict resolution)
 *  3. Block Target Filter (Layer specialization: All / Structure / Details / UNet Only / CLIP Only)
 * 
 * Runs 100% at load time in RAM with 0 sampler lag and full GPU execution speed.
 */

class LoraAdvSettingsDrawer {
  static instance = null;

  static getInstance() {
    if (!LoraAdvSettingsDrawer.instance) {
      LoraAdvSettingsDrawer.instance = new LoraAdvSettingsDrawer();
    }
    return LoraAdvSettingsDrawer.instance;
  }

  constructor() {
    this.currentWidget = null;
    this.currentNode = null;
    this.state = {
      // 1. SmoothStep
      smoothStepEnabled: false,
      smoothStepIntensity: 0.8,

      // 2. DARE Sparsification
      dareEnabled: false,
      dareDensity: 0.75,

      // 3. Block Target Filter
      blockFilter: "all" // 'all' | 'structure' | 'details' | 'unet_only' | 'clip_only'
    };

    this._createDOM();
  }

  _createDOM() {
    if (document.getElementById("trix-lora-adv-drawer-backdrop")) {
      this.backdrop = document.getElementById("trix-lora-adv-drawer-backdrop");
      this.drawer = document.getElementById("trix-lora-adv-drawer");
      return;
    }

    // Styles
    const style = document.createElement("style");
    style.textContent = `
      .trix-adv-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.45);
        backdrop-filter: blur(3px);
        z-index: 10005;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.22s ease;
      }
      .trix-adv-backdrop.is-open {
        opacity: 1;
        pointer-events: auto;
      }
      .trix-adv-drawer {
        --trix-acc: #5881AF;
        position: fixed;
        top: 0;
        right: -460px;
        width: 440px;
        max-width: 92vw;
        height: 100vh;
        background: #14161b;
        border-left: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: -10px 0 35px rgba(0, 0, 0, 0.65);
        z-index: 10006;
        display: flex;
        flex-direction: column;
        transition: right 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #e2e8f0;
        box-sizing: border-box;
      }
      .trix-adv-backdrop.is-open .trix-adv-drawer {
        right: 0;
      }

      /* Header */
      .trix-adv-header {
        padding: 16px 20px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: rgba(255, 255, 255, 0.02);
      }
      .trix-adv-title-wrap {
        display: flex;
        flex-direction: column;
        gap: 3px;
        overflow: hidden;
      }
      .trix-adv-badge {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.8px;
        color: var(--trix-acc, #5881AF);
        text-transform: uppercase;
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .trix-adv-sparkle {
        display: inline-block;
        color: var(--trix-acc, #5881AF);
      }
      .trix-adv-title {
        font-size: 14px;
        font-weight: 600;
        color: #fff;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 310px;
      }
      .trix-adv-header-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .trix-adv-btn-icon {
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #cbd5e1;
        width: 30px;
        height: 30px;
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        transition: all 0.15s ease;
      }
      .trix-adv-btn-icon:hover {
        background: rgba(255, 255, 255, 0.12);
        border-color: var(--trix-acc, #5881AF);
        color: #fff;
      }

      /* Body */
      .trix-adv-body {
        flex: 1;
        overflow-y: auto;
        padding: 18px 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .trix-adv-body::-webkit-scrollbar {
        width: 5px;
      }
      .trix-adv-body::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.15);
        border-radius: 3px;
      }

      /* Cards */
      .trix-adv-card {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.07);
        border-radius: 10px;
        padding: 14px 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        transition: border-color 0.2s ease, background 0.2s ease;
      }
      .trix-adv-card.is-active {
        border-color: var(--trix-acc, #5881AF);
        background: rgba(255, 255, 255, 0.04);
        box-shadow: none;
      }
      .trix-adv-card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .trix-adv-card-title {
        font-size: 13px;
        font-weight: 600;
        color: #f1f5f9;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .trix-adv-card-desc {
        font-size: 11.5px;
        color: #94a3b8;
        line-height: 1.5;
      }

      /* Switch */
      .trix-adv-switch {
        position: relative;
        width: 36px;
        height: 20px;
        background: rgba(255, 255, 255, 0.12);
        border-radius: 10px;
        cursor: pointer;
        transition: background 0.2s ease;
      }
      .trix-adv-switch.active {
        background: var(--trix-acc, #5881AF);
      }
      .trix-adv-switch-thumb {
        position: absolute;
        top: 2px;
        left: 2px;
        width: 16px;
        height: 16px;
        background: #fff;
        border-radius: 50%;
        transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
      }
      .trix-adv-switch.active .trix-adv-switch-thumb {
        transform: translateX(16px);
        background: #ffffff;
      }

      /* Slider Rows */
      .trix-adv-slider-row {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .trix-adv-slider-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .trix-adv-slider-title {
        font-size: 11.5px;
        color: #cbd5e1;
      }
      .trix-adv-slider-val {
        font-size: 12px;
        font-weight: 600;
        color: var(--trix-acc, #5881AF);
        font-family: monospace;
      }
      .trix-adv-slider {
        -webkit-appearance: none;
        appearance: none;
        width: 100%;
        height: 6px;
        border-radius: 3px;
        background: rgba(255, 255, 255, 0.1);
        outline: none;
        cursor: pointer;
      }
      .trix-adv-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: var(--trix-acc, #5881AF);
        cursor: pointer;
        box-shadow: none;
        transition: transform 0.1s ease;
      }
      .trix-adv-slider::-webkit-slider-thumb:hover {
        transform: scale(1.15);
      }

      /* Presets Row */
      .trix-adv-presets {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        margin-top: 2px;
      }
      .trix-adv-preset-btn {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.09);
        color: #cbd5e1;
        font-size: 11px;
        padding: 4px 10px;
        border-radius: 5px;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .trix-adv-preset-btn:hover {
        background: rgba(255, 255, 255, 0.12);
        border-color: var(--trix-acc, #5881AF);
        color: #ffffff;
      }

      /* Filter Options (Pills) */
      .trix-adv-pills {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .trix-adv-pill {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .trix-adv-pill:hover {
        background: rgba(255, 255, 255, 0.08);
      }
      .trix-adv-pill.active {
        background: rgba(255, 255, 255, 0.07);
        border-color: var(--trix-acc, #5881AF);
        color: #ffffff;
      }
      .trix-adv-pill-left {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        font-weight: 500;
      }
      .trix-adv-pill.active .trix-adv-pill-left {
        color: var(--trix-acc, #5881AF);
      }
      .trix-adv-pill-sub {
        font-size: 10.5px;
        color: #94a3b8;
      }

      /* Footer */
      .trix-adv-footer {
        padding: 14px 20px;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: rgba(255, 255, 255, 0.02);
      }
      .trix-adv-btn-reset {
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: #94a3b8;
        font-size: 12px;
        padding: 7px 16px;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .trix-adv-btn-reset:hover {
        border-color: #ef4444;
        color: #ef4444;
        background: rgba(239, 68, 68, 0.08);
      }
      .trix-adv-btn-save {
        background: var(--trix-acc, #5881AF);
        border: 1px solid var(--trix-acc, #5881AF);
        color: #ffffff;
        font-size: 12.5px;
        font-weight: 600;
        padding: 7px 24px;
        border-radius: 6px;
        cursor: pointer;
        box-shadow: none !important;
        filter: none !important;
        transition: all 0.15s ease;
      }
      .trix-adv-btn-save:hover {
        background: var(--trix-acc, #5881AF);
        border-color: var(--trix-acc, #5881AF);
        color: #ffffff;
        filter: brightness(1.2) !important;
        box-shadow: none !important;
      }
    `;
    document.head.appendChild(style);

    // Backdrop
    this.backdrop = document.createElement("div");
    this.backdrop.id = "trix-lora-adv-drawer-backdrop";
    this.backdrop.className = "trix-adv-backdrop";

    // Drawer
    this.drawer = document.createElement("div");
    this.drawer.id = "trix-lora-adv-drawer";
    this.drawer.className = "trix-adv-drawer";
    this.backdrop.appendChild(this.drawer);

    // Header
    this.header = document.createElement("div");
    this.header.className = "trix-adv-header";
    this.header.innerHTML = `
      <div class="trix-adv-title-wrap">
        <div class="trix-adv-badge"><span class="trix-adv-sparkle">⚡︎</span> LORA ADVANCED OPTIMIZER</div>
        <div class="trix-adv-title" id="trix-adv-header-title">LoRA Name</div>
      </div>
      <div class="trix-adv-header-actions">
        <button class="trix-adv-btn-icon" id="trix-adv-btn-copy" title="Copy LoRA Name">⎘</button>
        <button class="trix-adv-btn-icon" id="trix-adv-btn-close" title="Close">✕</button>
      </div>
    `;
    this.drawer.appendChild(this.header);

    // Body
    this.body = document.createElement("div");
    this.body.className = "trix-adv-body";
    this.drawer.appendChild(this.body);

    // Card 1: SmoothStep
    this.smoothCard = document.createElement("div");
    this.smoothCard.className = "trix-adv-card";
    this.smoothCard.innerHTML = `
      <div class="trix-adv-card-header">
        <div class="trix-adv-card-title">
          <span>⌾ SmoothStep Normalization</span>
        </div>
        <div class="trix-adv-switch" id="trix-adv-smooth-switch" title="Toggle SmoothStep Normalization">
          <div class="trix-adv-switch-thumb"></div>
        </div>
      </div>
      <div class="trix-adv-card-desc">
        Hermite polynomial contrast normalization (3x² - 2x³). Re-weights parameter deltas along a smooth S-curve, suppressing near-zero background noise & weight drift while amplifying high-magnitude salient concept vectors. Produces crisper details, richer micro-contrast, and reduced muddiness in multi-LoRA mixtures without increasing rank.
      </div>
      <div class="trix-adv-slider-row" id="trix-adv-smooth-controls" style="display:none;">
        <div class="trix-adv-slider-header">
          <span class="trix-adv-slider-title">SmoothStep Factor</span>
          <span class="trix-adv-slider-val" id="trix-adv-smooth-val">0.80</span>
        </div>
        <input type="range" class="trix-adv-slider" id="trix-adv-smooth-slider" min="0" max="100" step="5" value="80" />
        <div class="trix-adv-presets">
          <button class="trix-adv-preset-btn" data-val="30">Subtle (0.3)</button>
          <button class="trix-adv-preset-btn" data-val="60">Balanced (0.6)</button>
          <button class="trix-adv-preset-btn" data-val="80">Standard (0.8)</button>
          <button class="trix-adv-preset-btn" data-val="100">Full (1.0)</button>
        </div>
      </div>
    `;
    this.body.appendChild(this.smoothCard);

    // Card 2: DARE Sparsification
    this.dareCard = document.createElement("div");
    this.dareCard.className = "trix-adv-card";
    this.dareCard.innerHTML = `
      <div class="trix-adv-card-header">
        <div class="trix-adv-card-title">
          <span>✄ DARE Sparsification</span>
        </div>
        <div class="trix-adv-switch" id="trix-adv-dare-switch" title="Toggle DARE Sparsification">
          <div class="trix-adv-switch-thumb"></div>
        </div>
      </div>
      <div class="trix-adv-card-desc">
        Drop And REscale weight pruning via randomized Bernoulli masking with unbiased 1/p magnitude compensation. Selectively discards non-critical parameter deltas to eliminate parameter interference and tensor saturation when combining multiple LoRAs. Prevents burned highlights, harsh contrast artifacts, and model overcooking.
      </div>
      <div class="trix-adv-slider-row" id="trix-adv-dare-controls" style="display:none;">
        <div class="trix-adv-slider-header">
          <span class="trix-adv-slider-title">Density (Retained Weights)</span>
          <span class="trix-adv-slider-val" id="trix-adv-dare-val">75%</span>
        </div>
        <input type="range" class="trix-adv-slider" id="trix-adv-dare-slider" min="40" max="100" step="5" value="75" />
        <div class="trix-adv-presets">
          <button class="trix-adv-preset-btn" data-val="90">Gentle (90%)</button>
          <button class="trix-adv-preset-btn" data-val="75">Balanced (75%)</button>
          <button class="trix-adv-preset-btn" data-val="60">Aggressive (60%)</button>
        </div>
      </div>
    `;
    this.body.appendChild(this.dareCard);

    // Card 3: Block Target Filter
    this.filterCard = document.createElement("div");
    this.filterCard.className = "trix-adv-card";
    this.filterCard.innerHTML = `
      <div class="trix-adv-card-header">
        <div class="trix-adv-card-title">
          <span>⬡ Block Target Filter</span>
        </div>
      </div>
      <div class="trix-adv-card-desc">
        Architectural layer routing. Applies LoRA weight updates exclusively to targeted network stages (U-Net / MMDiT / Text Encoders) while preserving base model weights in remaining layers.
      </div>
      <div class="trix-adv-pills" id="trix-adv-filter-pills">
        <div class="trix-adv-pill active" data-filter="all">
          <div class="trix-adv-pill-left">❖ Full Model</div>
          <div class="trix-adv-pill-sub">All UNet / DiT + CLIP (Standard application)</div>
        </div>
        <div class="trix-adv-pill" data-filter="structure">
          <div class="trix-adv-pill-left">⛘ Structure & Anatomy</div>
          <div class="trix-adv-pill-sub">Mid / Down blocks (SD) · Early Double blocks (Flux) — Pose & layout</div>
        </div>
        <div class="trix-adv-pill" data-filter="details">
          <div class="trix-adv-pill-left">✧ Details & Textures</div>
          <div class="trix-adv-pill-sub">Up blocks (SD) · Late Double & Single blocks (Flux) — Faces & textures</div>
        </div>
        <div class="trix-adv-pill" data-filter="unet_only">
          <div class="trix-adv-pill-left">⎚ UNet / DiT Only</div>
          <div class="trix-adv-pill-sub">Visual layers only — Zero CLIP text encoder drift</div>
        </div>
        <div class="trix-adv-pill" data-filter="clip_only">
          <div class="trix-adv-pill-left">✎ CLIP / Text Only</div>
          <div class="trix-adv-pill-sub">Text encoders only (CLIP / T5) — Prompt keywords only</div>
        </div>
      </div>
    `;
    this.body.appendChild(this.filterCard);

    // Footer
    this.footer = document.createElement("div");
    this.footer.className = "trix-adv-footer";
    this.footer.innerHTML = `
      <button class="trix-adv-btn-reset" id="trix-adv-btn-reset">Reset</button>
      <button class="trix-adv-btn-save" id="trix-adv-btn-save">Save</button>
    `;
    this.drawer.appendChild(this.footer);

    this._bindEvents();
  }

  _bindEvents() {
    // Backdrop click dismiss
    this.backdrop.addEventListener("click", (e) => {
      if (e.target === this.backdrop) {
        this.saveAndClose();
      }
    });

    // Close button
    this.drawer.querySelector("#trix-adv-btn-close").addEventListener("click", () => {
      this.saveAndClose();
    });

    // Copy name
    this.drawer.querySelector("#trix-adv-btn-copy").addEventListener("click", () => {
      if (this.currentWidget?.value?.lora) {
        navigator.clipboard?.writeText(this.currentWidget.value.lora);
        const btn = this.drawer.querySelector("#trix-adv-btn-copy");
        btn.textContent = "☑";
        setTimeout(() => (btn.textContent = "⎘"), 1000);
      }
    });

    // 1. SmoothStep Switch
    const smoothSwitch = this.drawer.querySelector("#trix-adv-smooth-switch");
    smoothSwitch.addEventListener("click", () => {
      this.state.smoothStepEnabled = !this.state.smoothStepEnabled;
      this._updateUI();
      this._autoSave();
    });

    // SmoothStep Slider
    const smoothSlider = this.drawer.querySelector("#trix-adv-smooth-slider");
    smoothSlider.addEventListener("input", (e) => {
      this.state.smoothStepIntensity = parseFloat((parseInt(e.target.value, 10) / 100).toFixed(2));
      this._updateUI();
      this._autoSave();
    });

    // SmoothStep Presets
    this.drawer.querySelectorAll("#trix-adv-smooth-controls .trix-adv-preset-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const val = parseInt(btn.dataset.val, 10);
        smoothSlider.value = val;
        this.state.smoothStepIntensity = parseFloat((val / 100).toFixed(2));
        this._updateUI();
        this._autoSave();
      });
    });

    // 2. DARE Switch
    const dareSwitch = this.drawer.querySelector("#trix-adv-dare-switch");
    dareSwitch.addEventListener("click", () => {
      this.state.dareEnabled = !this.state.dareEnabled;
      this._updateUI();
      this._autoSave();
    });

    // DARE Slider
    const dareSlider = this.drawer.querySelector("#trix-adv-dare-slider");
    dareSlider.addEventListener("input", (e) => {
      this.state.dareDensity = parseFloat((parseInt(e.target.value, 10) / 100).toFixed(2));
      this._updateUI();
      this._autoSave();
    });

    // DARE Presets
    this.drawer.querySelectorAll("#trix-adv-dare-controls .trix-adv-preset-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const val = parseInt(btn.dataset.val, 10);
        dareSlider.value = val;
        this.state.dareDensity = parseFloat((val / 100).toFixed(2));
        this._updateUI();
        this._autoSave();
      });
    });

    // 3. Block Filter Pills
    this.drawer.querySelectorAll("#trix-adv-filter-pills .trix-adv-pill").forEach((pill) => {
      pill.addEventListener("click", () => {
        this.state.blockFilter = pill.dataset.filter || "all";
        this._updateUI();
        this._autoSave();
      });
    });

    // Reset button
    this.drawer.querySelector("#trix-adv-btn-reset").addEventListener("click", () => {
      this.state = {
        smoothStepEnabled: false,
        smoothStepIntensity: 0.8,
        dareEnabled: false,
        dareDensity: 0.75,
        blockFilter: "all"
      };
      this._updateUI();
      this._autoSave();
    });

    // Save button
    this.drawer.querySelector("#trix-adv-btn-save").addEventListener("click", () => {
      this.saveAndClose();
    });

    // Global Key Listener for Escape & Ctrl+Enter
    window.addEventListener("keydown", (e) => {
      if (this.backdrop.classList.contains("is-open")) {
        if (e.key === "Escape" || e.keyCode === 27) {
          this.saveAndClose();
        } else if ((e.ctrlKey || e.metaKey) && (e.key === "Enter" || e.keyCode === 13)) {
          this.saveAndClose();
          try {
            window.app?.queuePrompt?.(0);
          } catch (_) {}
        }
      }
    });
  }

  _updateUI() {
    // 1. SmoothStep
    const smoothSwitch = this.drawer.querySelector("#trix-adv-smooth-switch");
    const smoothControls = this.drawer.querySelector("#trix-adv-smooth-controls");
    const smoothVal = this.drawer.querySelector("#trix-adv-smooth-val");
    const smoothSlider = this.drawer.querySelector("#trix-adv-smooth-slider");

    smoothSwitch.classList.toggle("active", this.state.smoothStepEnabled);
    this.smoothCard.classList.toggle("is-active", this.state.smoothStepEnabled);
    smoothControls.style.display = this.state.smoothStepEnabled ? "flex" : "none";
    smoothVal.textContent = this.state.smoothStepIntensity.toFixed(2);
    smoothSlider.value = Math.round(this.state.smoothStepIntensity * 100);

    // 2. DARE
    const dareSwitch = this.drawer.querySelector("#trix-adv-dare-switch");
    const dareControls = this.drawer.querySelector("#trix-adv-dare-controls");
    const dareVal = this.drawer.querySelector("#trix-adv-dare-val");
    const dareSlider = this.drawer.querySelector("#trix-adv-dare-slider");

    dareSwitch.classList.toggle("active", this.state.dareEnabled);
    this.dareCard.classList.toggle("is-active", this.state.dareEnabled);
    dareControls.style.display = this.state.dareEnabled ? "flex" : "none";
    dareVal.textContent = `${Math.round(this.state.dareDensity * 100)}%`;
    dareSlider.value = Math.round(this.state.dareDensity * 100);

    // 3. Filter Pills
    this.drawer.querySelectorAll("#trix-adv-filter-pills .trix-adv-pill").forEach((pill) => {
      pill.classList.toggle("active", pill.dataset.filter === this.state.blockFilter);
    });
    this.filterCard.classList.toggle("is-active", this.state.blockFilter !== "all");
  }

  hasActiveSettings() {
    return Boolean(
      this.state.smoothStepEnabled ||
      this.state.dareEnabled ||
      (this.state.blockFilter && this.state.blockFilter !== "all")
    );
  }

  open(widget, node) {
    this.currentWidget = widget;
    this.currentNode = node;

    const accColor = node?.properties?.highlightColor || node?._trixDomRoot?.style?.getPropertyValue("--trix-acc") || "#5881AF";
    if (this.drawer) this.drawer.style.setProperty("--trix-acc", accColor);
    if (this.backdrop) this.backdrop.style.setProperty("--trix-acc", accColor);

    const loraName = widget?.value?.lora || widget?.value?.name || "LoRA";
    const headerTitle = this.drawer.querySelector("#trix-adv-header-title");
    if (headerTitle) {
      headerTitle.textContent = loraName.split("/").pop().split("\\").pop();
    }

    // Load existing adv settings
    const adv = widget?.value?.adv_settings || widget?.value?.advSettings || {};
    this.state = {
      smoothStepEnabled: Boolean(adv.smoothStep?.enabled),
      smoothStepIntensity: adv.smoothStep?.intensity ?? 0.8,
      dareEnabled: Boolean(adv.dare?.enabled),
      dareDensity: adv.dare?.density ?? 0.75,
      blockFilter: adv.blockFilter || "all"
    };

    this._updateUI();

    if (!this.backdrop.parentNode) {
      document.body.appendChild(this.backdrop);
    }
    requestAnimationFrame(() => {
      this.backdrop.classList.add("is-open");
    });
  }

  _autoSave() {
    if (!this.currentWidget) return;

    const isCustom = this.hasActiveSettings();

    this.currentWidget.value.adv_settings = {
      smoothStep: {
        enabled: this.state.smoothStepEnabled,
        intensity: parseFloat(this.state.smoothStepIntensity.toFixed(2))
      },
      dare: {
        enabled: this.state.dareEnabled,
        density: parseFloat(this.state.dareDensity.toFixed(2))
      },
      blockFilter: this.state.blockFilter
    };

    // Remove obsolete schedule if present
    delete this.currentWidget.value.schedule;

    if (this.currentNode) {
      if (this.currentNode.setDirtyCanvas) {
        this.currentNode.setDirtyCanvas(true, true);
      }
      try {
        if (window.trixSuperLoraLoaderAPI?.syncExecutionWidgets) {
          window.trixSuperLoraLoaderAPI.syncExecutionWidgets(this.currentNode);
        }
      } catch (_) {}

      // Instant DOM UI sync
      try {
        if (window.trixSuperLoraDOMRenderer && typeof window.trixSuperLoraDOMRenderer.render === "function") {
          window.trixSuperLoraDOMRenderer.render(this.currentNode, window.trixSuperLoraLoaderAPI, false);
        }
      } catch (_) {}

      // Direct element style injection for instant visual confirmation
      try {
        const root = this.currentNode._trixDomRoot;
        if (root) {
          const rowEls = root.querySelectorAll(".trix-nd-row");
          rowEls.forEach((row) => {
            if (row._targetWidget === this.currentWidget || row.dataset?.widgetId === this.currentWidget.name || row.dataset?.widgetId === this.currentWidget._uid) {
              const nameBox = row.querySelector(".trix-nd-name-box");
              const nameSpan = row.querySelector(".trix-nd-file-name");
              if (isCustom) {
                nameBox?.classList.add("has-schedule");
                nameSpan?.classList.add("has-schedule");
                if (nameSpan) {
                  nameSpan.style.setProperty("color", "#facc15", "important");
                  nameSpan.style.setProperty("font-weight", "600");
                  nameSpan.style.setProperty("text-shadow", "0 0 8px rgba(250, 204, 21, 0.45)");
                }
              } else {
                nameBox?.classList.remove("has-schedule");
                nameSpan?.classList.remove("has-schedule");
                if (nameSpan) {
                  nameSpan.style.removeProperty("color");
                  nameSpan.style.removeProperty("font-weight");
                  nameSpan.style.removeProperty("text-shadow");
                }
              }
            }
          });
        }
      } catch (_) {}
    }
  }

  saveAndClose() {
    this._autoSave();
    this.backdrop.classList.remove("is-open");
    setTimeout(() => {
      if (this.backdrop.parentNode) {
        this.backdrop.parentNode.removeChild(this.backdrop);
      }
    }, 250);
  }
}

export function openLoraSettingsDrawer(widget, node) {
  LoraAdvSettingsDrawer.getInstance().open(widget, node);
}
