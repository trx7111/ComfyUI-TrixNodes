/**
 * SettingsDrawer — floating side panel.
 * Compact 2-column layout, no scroll.
 * Elegant model picker with live download progress.
 */

import { t, getLang, setLang } from '../utils/i18n.js';
import { api } from "/scripts/api.js";

const STORAGE_KEY = "trix_prompt_aio_v2_settings";

function loadSettings() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
  catch (_) { return {}; }
}
function saveSettings(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (_) {}
}

// Model display metadata (shown in picker)

const ALL_LANGUAGES = {
  af: "Afrikaans", sq: "Albanian", am: "Amharic", ar: "Arabic", hy: "Armenian", az: "Azerbaijani",
  eu: "Basque", be: "Belarusian", bn: "Bengali", bs: "Bosnian", bg: "Bulgarian", ca: "Catalan",
  ceb: "Cebuano", ny: "Chichewa", zh: "Chinese", co: "Corsican", hr: "Croatian", cs: "Czech",
  da: "Danish", nl: "Dutch", en: "English", eo: "Esperanto", et: "Estonian", tl: "Filipino",
  fi: "Finnish", fr: "French", fy: "Frisian", gl: "Galician", ka: "Georgian", de: "German",
  el: "Greek", gu: "Gujarati", ht: "Haitian Creole", ha: "Hausa", haw: "Hawaiian", iw: "Hebrew",
  hi: "Hindi", hmn: "Hmong", hu: "Hungarian", is: "Icelandic", ig: "Igbo", id: "Indonesian",
  ga: "Irish", it: "Italian", ja: "Japanese", jw: "Javanese", kn: "Kannada", kk: "Kazakh",
  km: "Khmer", rw: "Kinyarwanda", ko: "Korean", ku: "Kurdish", ky: "Kyrgyz", lo: "Lao",
  la: "Latin", lv: "Latvian", lt: "Lithuanian", lb: "Luxembourgish", mk: "Macedonian", mg: "Malagasy",
  ms: "Malay", ml: "Malayalam", mt: "Maltese", mi: "Maori", mr: "Marathi", mn: "Mongolian",
  my: "Myanmar", ne: "Nepali", no: "Norwegian", or: "Odia", ps: "Pashto", fa: "Persian",
  pl: "Polish", pt: "Portuguese", pa: "Punjabi", ro: "Romanian", ru: "Russian", sm: "Samoan",
  gd: "Scots Gaelic", sr: "Serbian", st: "Sesotho", sn: "Shona", sd: "Sindhi", si: "Sinhala",
  sk: "Slovak", sl: "Slovenian", so: "Somali", es: "Spanish", su: "Sundanese", sw: "Swahili",
  sv: "Swedish", tg: "Tajik", ta: "Tamil", tt: "Tatar", te: "Telugu", th: "Thai", tr: "Turkish",
  tk: "Turkmen", uk: "Ukrainian", ur: "Urdu", ug: "Uyghur", uz: "Uzbek", vi: "Vietnamese",
  cy: "Welsh", xh: "Xhosa", yi: "Yiddish", yo: "Yoruba", zu: "Zulu"
};

let ACTIVE_LANGS = [];
try {
  ACTIVE_LANGS = JSON.parse(localStorage.getItem("trix_active_langs")) || ["en", "ru", "uk", "zh", "es", "de", "hi", "fr", "it", "pt", "ms"];
} catch(_) {
  ACTIVE_LANGS = ["en", "ru", "uk", "zh", "es", "de", "hi", "fr", "it", "pt", "ms"];
}

function saveActiveLangs() {
  localStorage.setItem("trix_active_langs", JSON.stringify(ACTIVE_LANGS));
}


let MODEL_META = {
  nllb_200_1_3b:        { label: "NLLB-200 1.3B",         pairs: "multilingual", size: "1.3 GB" },
  nllb_200_distilled:   { label: "NLLB-200 600M",          pairs: "multilingual", size: "600 MB" },
  m2m100_418m:          { label: "M2M-100 418M",           pairs: "multilingual", size: "900 MB" },
  opus_mt_tc_big_ru_en: { label: "Opus-MT Big",            pairs: "ru → en",      size: "500 MB" },
  helsinki_opus_ru_en:  { label: "Opus-MT Fast",           pairs: "ru → en",      size: "300 MB" },
  opus_mt_tc_big_en_ru: { label: "Opus-MT Big",            pairs: "en → ru",      size: "900 MB" },
  opus_mt_en_ru:        { label: "Opus-MT Fast",           pairs: "en → ru",      size: "300 MB" },
};

export class SettingsDrawer {
  constructor(containerEl, nodeInstance, onSettingsChange) {
    this.container = containerEl;
    this.node = nodeInstance;
    this.onSettingsChange = onSettingsChange;
    this.panel = null;
    this._modelStatus = {};  // key → { downloaded, downloading, progress }
    this.settings = Object.assign({
      accentColor:  "#5881AF",
      transEnabled: false,
      transMode:    "on_demand",
      transEngine:  "online_google",
      srcLang:      "auto",
      tgtLang:      "en",
      groupMode:    "increment",
      groupSeed:    1,
      styleClickAction: "copy_text",
      offlineModel: "helsinki_opus_ru_en",
      uiLang:       "en",
      sepComma:     true,
      sepPeriod:    false,
      sepSpace:     true,
      sepNewline:   false,
    }, loadSettings(), nodeInstance?.properties?.trixSettings || {});
    if (this.settings.groupMode === "random") {
      this.settings.groupMode = "increment";
    }
    this._applyAccent(this.settings.accentColor);
    const gear = containerEl.querySelector(".trix-ps-gear-btn");
    if (gear) gear.addEventListener("click", () => this.toggle());
    
    document.addEventListener("trix_lang_changed", () => {
      if (this.panel) this._render();
    });

    api.addEventListener("trix_prompt_group_seed_update", (ev) => {
      const data = ev.detail;
      if (data && data.group_seed !== undefined) {
        this.settings.groupSeed = data.group_seed;
        saveSettings(this.settings);
        if (this.panel) {
          const seedInput = this.panel.querySelector(".trix-sp-group-seed");
          if (seedInput) {
            seedInput.value = data.group_seed;
          }
          const detailsContainer = this.panel.querySelector(".trix-sp-group-details");
          if (detailsContainer && Array.isArray(data.details)) {
            detailsContainer.innerHTML = data.details.map(d => `
              <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:3px; padding:2px 6px; font-size:10px;">
                <span style="color:var(--trix-prompt-accent, #ff5500); font-weight:700;">${d.tag}</span>
                <span style="color:var(--trix-text-main, #e2e8f0); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:140px;" title="${d.name}">${d.name} <small style="color:var(--trix-text-muted, #8a99ad);">(${d.index + 1}/${d.total})</small></span>
              </div>
            `).join("");
          }
        }
        this._emit();
      }
    });

    this._emit();
  }

  getSettings() { return { ...this.settings }; }
  toggle() { this.panel ? this.close() : this.open(); }

  async open() {
    if (this.panel) return;

    this.panel = document.createElement("div");
    this.panel.className = "trix-side-panel";
    this.panel.addEventListener("pointerdown", (e) => e.stopPropagation());
    this.panel.addEventListener("mousedown", (e) => e.stopPropagation());

    this._render();
    document.body.appendChild(this.panel);
    this._wireEvents();

    // Position panel beside node, aligned with the node's top edge (like LoRA Loader)
    const placeBesideNode = () => {
      let r = null;
      if (this.node?.id != null) {
        const e = document.querySelector(`[data-node-id="${this.node.id}"]`);
        if (e) r = e.getBoundingClientRect();
      }
      if (!r) {
        const nodeEl = this.container?.closest(".litegraph.node") ||
                       this.container?.closest(".graph-canvas-node") ||
                       this.container?.closest(".lgraphnode") ||
                       this.container?.closest(".comfy-vue-node");
        if (nodeEl) r = nodeEl.getBoundingClientRect();
      }
      if (!r && typeof app !== "undefined" && app.canvas?.canvas && this.node?.pos && this.node?.size) {
        const ds = app.canvas.ds || { scale: 1, offset: [0, 0] };
        const cr = app.canvas.canvas.getBoundingClientRect();
        const sc = ds.scale || 1;
        const off = ds.offset || [0, 0];
        const left = cr.left + (this.node.pos[0] + off[0]) * sc;
        const top = cr.top + (this.node.pos[1] + off[1]) * sc;
        r = { left, top, right: left + this.node.size[0] * sc, bottom: top + this.node.size[1] * sc };
      }

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const pw = this.panel.offsetWidth || 300;
      const ph = this.panel.offsetHeight || 480;

      if (!r) {
        const rect = this.container.getBoundingClientRect();
        r = { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
      }

      let left = r.right + 10;
      if (left + pw > vw - 10) left = r.left - pw - 10;
      if (left < 10) left = Math.max(10, vw - pw - 10);

      let top = Math.min(r.top, vh - ph - 10);
      this.panel.style.left = `${Math.max(10, left)}px`;
      this.panel.style.top = `${Math.max(10, top)}px`;
    };

    placeBesideNode();

    // Make panel header draggable
    const header = this.panel.querySelector(".trix-sp-header");
    if (header) {
      header.style.cursor = "move";
      header.onpointerdown = (e) => {
        if (e.target.closest(".trix-sp-close") || e.target.closest(".trix-ps-delete")) return;
        e.preventDefault();
        const rect = this.panel.getBoundingClientRect();
        const ox = e.clientX - rect.left;
        const oy = e.clientY - rect.top;

        const onMove = (ev) => {
          this.panel.style.left = `${Math.max(0, Math.min(window.innerWidth - this.panel.offsetWidth, ev.clientX - ox))}px`;
          this.panel.style.top = `${Math.max(0, Math.min(window.innerHeight - this.panel.offsetHeight, ev.clientY - oy))}px`;
        };
        const onUp = () => {
          window.removeEventListener("pointermove", onMove, true);
          window.removeEventListener("pointerup", onUp, true);
        };
        window.addEventListener("pointermove", onMove, true);
        window.addEventListener("pointerup", onUp, true);
      };
    }

    // Fetch model status asynchronously (no blocking)
    this._loadModelStatus();

    // Listen to WS download progress
    this._wsHandler = (ev) => this.updateDownloadProgress(ev.detail);
    api.addEventListener("trix_prompt_download_progress", this._wsHandler);

    // Listen to WS model load status (loading → loaded / error)
    this._msHandler = (ev) => this._onModelStatusEvent(ev.detail);
    api.addEventListener("trix_prompt_model_status", this._msHandler);

    setTimeout(() => {
      this._onOutsideClick = (e) => {
        if (!this.panel) return;
        const gear = this.container.querySelector(".trix-ps-gear-btn");
        const path = e.composedPath ? e.composedPath() : [];
        if (this.panel.contains(e.target) || path.includes(this.panel)) return;
        if (gear && (gear.contains(e.target) || path.includes(gear))) return;
        this.close();
      };
      window.addEventListener("pointerdown", this._onOutsideClick, true);
    }, 10);
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  _getSepLabel(s = this.settings) {
    const list = [];
    if (s.sepComma) list.push("Comma (,)");
    if (s.sepPeriod) list.push("Period (.)");
    if (s.sepSpace) list.push("Space ( )");
    if (s.sepNewline) list.push("Newline (\\n)");
    return list.length > 0 ? list.join(", ") : "None";
  }

  _render() {
    if (!this.panel) return;
    const s = this.settings;
    const isOffline = s.transEngine === "offline";

    this.panel.innerHTML = `
      <div class="trix-sp-header">
        <span class="trix-sp-header-icon">⚙</span>
        <span class="trix-sp-header-title">Prompt AIO settings</span>
        <span class="trix-sp-close" title="Close">✕</span>
      </div>

      <!-- 1) ✿ ACCENT COLOR -->
      <div class="trix-sp-section">✿ ACCENT COLOR</div>
      <div class="trix-sp-field">
        <div style="display:flex;flex-wrap:wrap;gap:3px;align-items:center;">
          <input type="color" class="trix-sp-input trix-sp-color" value="${s.accentColor}"
            style="width:24px;height:20px;padding:1px 2px;cursor:pointer;border-radius:4px;border:none;flex-shrink:0;"/>
          <button class="trix-ps-btn trix-sp-preset" data-c="#5881AF" style="background:#5881AF;color:#fff;border:none;padding:2px 5px;font-size:9px;border-radius:3px;">Blue</button>
          <button class="trix-ps-btn trix-sp-preset" data-c="#009B95" style="background:#009B95;color:#fff;border:none;padding:2px 5px;font-size:9px;border-radius:3px;">Mint</button>
          <button class="trix-ps-btn trix-sp-preset" data-c="#90D061" style="background:#90D061;color:#fff;border:none;padding:2px 5px;font-size:9px;border-radius:3px;">Green</button>
          <button class="trix-ps-btn trix-sp-preset" data-c="#F56D57" style="background:#F56D57;color:#fff;border:none;padding:2px 5px;font-size:9px;border-radius:3px;">Orange</button>
          <button class="trix-ps-btn trix-sp-preset" data-c="#7939E2" style="background:#7939E2;color:#fff;border:none;padding:2px 5px;font-size:9px;border-radius:3px;">Violet</button>
          <button class="trix-ps-btn trix-sp-preset" data-c="#EE7E74" style="background:#EE7E74;color:#fff;border:none;padding:2px 5px;font-size:9px;border-radius:3px;">Pink</button>
        </div>
      </div>

      <!-- 2) 🌏︎ TRANSLATION -->
      <div class="trix-sp-section">🌏︎ TRANSLATION</div>
      <div class="trix-sp-field" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
        <div>
          <div style="font-size:10px;color:#8a99ad;margin-bottom:2px;">Mode</div>
          <select class="trix-sp-select trix-sp-mode" style="width:100%;">
            <option value="live"   ${s.transMode==="live"   ?"selected":""}>⚡︎ Live</option>
            <option value="button" ${s.transMode==="button" ?"selected":""}>➣ Selection</option>
            <option value="output" ${s.transMode==="output" ?"selected":""}>⏱︎ On Run</option>
          </select>
        </div>
        <div>
          <div style="font-size:10px;color:#8a99ad;margin-bottom:2px;">Engine</div>
          <select class="trix-sp-select trix-sp-engine" style="width:100%;">
            <option value="online_google" ${s.transEngine==="online_google"?"selected":""}>🌏︎ Google</option>
            <option value="online_bing"   ${s.transEngine==="online_bing"  ?"selected":""}>🌏︎ Bing</option>
            <option value="offline"       ${isOffline?"selected":""}>⚇ Offline</option>
          </select>
        </div>
      </div>

      <div class="trix-sp-field" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
        <div>
          <div style="font-size:10px;color:#8a99ad;margin-bottom:2px;">Source</div>
          <select class="trix-sp-select trix-sp-src" style="width:100%;">
            <option value="choose">Choose another...</option>
            <option value="auto" ${s.srcLang==="auto"?"selected":""}>🌏︎ Auto</option>
            ${ACTIVE_LANGS.map(l => `<option value="${l}" ${s.srcLang===l?"selected":""}>${ALL_LANGUAGES[l] || l}</option>`).join('')}
          </select>
        </div>
        <div>
          <div style="font-size:10px;color:#8a99ad;margin-bottom:2px;">Target</div>
          <select class="trix-sp-select trix-sp-tgt" style="width:100%;">
            <option value="choose">Choose another...</option>
            ${ACTIVE_LANGS.map(l => `<option value="${l}" ${s.tgtLang===l?"selected":""}>${ALL_LANGUAGES[l] || l}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="trix-sp-offline-wrap" style="${isOffline ? "" : "display:none"}">
        <div class="trix-sp-section" style="margin-top:2px;">◌ Offline Model</div>
        <div class="trix-model-picker" id="trix-model-picker">
          ${this._renderModelPicker()}
        </div>
      </div>

      <!-- 3) ❖ BEHAVIOR OF GROUP STYLES TAGS * -->
      <div class="trix-sp-section">❖ BEHAVIOR OF GROUP STYLES TAGS *</div>
      <div class="trix-sp-field" style="display:flex; flex-direction:column; gap:6px;">
        <select class="trix-sp-select trix-sp-group-mode" style="width:100%;">
          <option value="increment" ${s.groupMode==="increment" || s.groupMode==="random" ?"selected":""}>» Increment</option>
          <option value="fixed"     ${s.groupMode==="fixed"     ?"selected":""}>🖈 Fixed</option>
        </select>
        <div style="display:flex; align-items:center; justify-content:space-between; gap:6px; background:var(--trix-bg-darker, #161822); border:1px solid var(--trix-border, #2e3245); border-radius:4px; padding:3px 8px;">
          <span style="font-size:11px; color:#8a99ad; font-weight:600;">Seed</span>
          <div style="display:flex; align-items:center; gap:2px; background:rgba(0,0,0,0.25); border:1px solid var(--trix-border, #2e3245); border-radius:3px; overflow:hidden;">
            <button type="button" class="trix-sp-seed-btn trix-sp-seed-dec" title="Previous seed (-1)" style="background:transparent; border:none; color:var(--trix-text-muted, #8a99ad); cursor:pointer; width:22px; height:20px; font-size:9px; display:flex; align-items:center; justify-content:center; transition:all 0.15s ease; user-select:none;">◀</button>
            <input type="number" class="trix-sp-input trix-sp-group-seed" value="${s.groupSeed ?? 1}" min="1" step="1" style="width:44px; text-align:center; background:transparent; border:none; color:var(--trix-text-main, #e2e8f0); font-size:11px; font-weight:700; padding:1px 0; outline:none; -moz-appearance:textfield;" />
            <button type="button" class="trix-sp-seed-btn trix-sp-seed-inc" title="Next seed (+1)" style="background:transparent; border:none; color:var(--trix-text-muted, #8a99ad); cursor:pointer; width:22px; height:20px; font-size:9px; display:flex; align-items:center; justify-content:center; transition:all 0.15s ease; user-select:none;">▶</button>
          </div>
        </div>
        <div class="trix-sp-group-details" style="display:flex; flex-direction:column; gap:3px; margin-top:2px;"></div>
      </div>

      <!-- 4) 🖱 ACTION ON STYLE CLICK -->
      <div class="trix-sp-section">🖱 ACTION ON STYLE CLICK</div>
      <div class="trix-sp-field">
        <select class="trix-sp-select trix-sp-click-action">
          <option value="copy_text"     ${s.styleClickAction==="copy_text"     ?"selected":""}>🗐 Copy style text</option>
          <option value="copy_tag"      ${s.styleClickAction==="copy_tag"      ?"selected":""}>𖤘 Copy style tag</option>
          <option value="copy_neg"      ${s.styleClickAction==="copy_neg"      ?"selected":""}>㊀ Copy negative</option>
          <option value="add_to_prompt" ${s.styleClickAction==="add_to_prompt" ?"selected":""}>✚ Add to new prompt window</option>
        </select>
      </div>

      <!-- 5) ▪︎▫︎ ROW SEPARATORS -->
      <div class="trix-sp-section">▪︎▫︎ ROW SEPARATORS</div>
      <div class="trix-sp-field">
        <details class="trix-sp-sep-details" style="width:100%;">
          <summary class="trix-sp-select trix-sp-sep-summary" style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; user-select:none; padding:4px 7px; font-size:11px; list-style:none;">
            <span class="trix-sp-sep-label">${this._getSepLabel(s)}</span>
            <span style="font-size:8px; opacity:0.6; margin-left:6px;">▼</span>
          </summary>
          <div style="background:var(--trix-bg-darker, #161822); border:1px solid var(--trix-border, #2e3245); border-top:none; border-radius:0 0 4px 4px; padding:6px 8px; margin-top:-1px; display:flex; flex-direction:column; gap:6px;">
            <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:11px; color:var(--trix-text-main, #c9d1d9); margin:0;">
              <input type="checkbox" class="trix-sp-sep trix-sp-sep-comma" ${s.sepComma ? "checked" : ""}> Comma (,)
            </label>
            <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:11px; color:var(--trix-text-main, #c9d1d9); margin:0;">
              <input type="checkbox" class="trix-sp-sep trix-sp-sep-period" ${s.sepPeriod ? "checked" : ""}> Period (.)
            </label>
            <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:11px; color:var(--trix-text-main, #c9d1d9); margin:0;">
              <input type="checkbox" class="trix-sp-sep trix-sp-sep-space" ${s.sepSpace ? "checked" : ""}> Space ( )
            </label>
            <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:11px; color:var(--trix-text-main, #c9d1d9); margin:0;">
              <input type="checkbox" class="trix-sp-sep trix-sp-sep-newline" ${s.sepNewline ? "checked" : ""}> Newline (\\n)
            </label>
          </div>
        </details>
      </div>

      <!-- 6) 🅴 EXCEL SYNC -->
      <div class="trix-sp-section">🅴 EXCEL SYNC</div>
      <div class="trix-sp-field" style="display:flex !important; flex-direction:row !important; gap:6px; align-items:center;">
        <button class="trix-ps-btn trix-sp-excel-import-btn" style="flex:1; font-weight:600; background:transparent; border:1px solid var(--trix-prompt-accent, #ff5500); color:var(--trix-text-main, #e2e8f0); cursor:pointer; padding:4px 6px; font-size:11px; border-radius:4px; height:26px; display:flex; align-items:center; justify-content:center; gap:4px; white-space:nowrap;">
          ⍗ Import xlsx
        </button>
        <button class="trix-ps-btn trix-sp-excel-export" style="flex:1; font-weight:600; background:transparent; border:1px solid var(--trix-prompt-accent, #ff5500); color:var(--trix-text-main, #e2e8f0); cursor:pointer; padding:4px 6px; font-size:11px; border-radius:4px; height:26px; display:flex; align-items:center; justify-content:center; gap:4px; white-space:nowrap;">
          ⍈ Export xlsx
        </button>
        <button class="trix-ps-btn trix-sp-reload-styles" title="Refresh all styles & packs" style="font-weight:600; background:transparent; border:1px solid var(--trix-prompt-accent, #ff5500); color:var(--trix-text-main, #e2e8f0); cursor:pointer; padding:0; width:26px; height:26px; font-size:14px; border-radius:4px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
          <span class="trix-sp-reload-icon" style="display:inline-block; transition:transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);">߷</span>
        </button>
        <input type="file" class="trix-sp-excel-file" accept=".xlsx" style="display:none;" />
      </div>

      <!-- Reset -->
      <div style="margin-top:8px;">
        <button class="trix-ps-btn trix-sp-reset" style="width:100%;">🗘 Reset to Defaults</button>
      </div>
    `;
  }


  _showLangPicker(targetSelectId, currentVal) {
    const overlay = document.createElement("div");
    overlay.className = "trix-modal-overlay trix-fade-in";
    overlay.style.zIndex = "10000";
    overlay.innerHTML = `
      <div class="trix-dialog-box trix-slide-up" style="width:300px; height:auto; padding:16px; background:#1e212b; border-radius:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <h3 style="margin:0;color:#fff;font-size:14px;">Choose Language</h3>
          <button class="trix-ps-delete trix-lp-close">✕</button>
        </div>
        <input type="text" class="trix-input-v2 trix-lp-search" placeholder="Search language..." style="width:100%;margin-bottom:12px;background:rgba(0,0,0,0.3);border:1px solid #2e3245;color:#fff;padding:6px;border-radius:4px;" />
        <div class="trix-lp-list" style="max-height:300px;overflow-y:auto;display:grid;grid-template-columns:1fr 1fr;gap:6px;">
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const list = overlay.querySelector(".trix-lp-list");
    const renderList = (q) => {
      list.innerHTML = Object.entries(ALL_LANGUAGES)
        .filter(([c, n]) => !ACTIVE_LANGS.includes(c) && n.toLowerCase().includes(q))
        .map(([c, n]) => `<button class="trix-ps-btn trix-lp-item" data-c="${c}" style="text-align:left;padding:6px;font-size:12px;cursor:pointer;background:#2e3245;border:none;border-radius:4px;color:#fff;">${n}</button>`)
        .join("");
    };
    renderList("");

    overlay.querySelector(".trix-lp-search").addEventListener("input", (e) => renderList(e.target.value.toLowerCase().trim()));
    overlay.querySelector(".trix-lp-close").addEventListener("click", () => {
      this._render(); // reset dropdown to previous state
      overlay.remove();
    });
    
    list.addEventListener("click", (e) => {
      if (e.target.classList.contains("trix-lp-item")) {
        const c = e.target.dataset.c;
        if (!ACTIVE_LANGS.includes(c)) {
          ACTIVE_LANGS.push(c);
          saveActiveLangs();
        }
        if (targetSelectId === "src") this.settings.srcLang = c;
        if (targetSelectId === "tgt") this.settings.tgtLang = c;
        saveSettings(this.settings);
        overlay.remove();
        this._render();
        this._syncAndSave();
      }
    });

    const updateSepLabel = () => {
      const label = this.panel.querySelector(".trix-sp-sep-label");
      if (label) label.textContent = this._getSepLabel(this.settings);
    };

    const sepEls = this.panel.querySelectorAll(".trix-sp-sep");
    sepEls.forEach(el => el.addEventListener("change", () => {
      this._syncAndSave();
      updateSepLabel();
    }));
  }

  _renderModelPicker() {
    const activeModel = this.settings.offlineModel || "helsinki_opus_ru_en";
    return Object.entries(MODEL_META).map(([key, meta]) => {
      const st = this._modelStatus[key] || {};
      const isActive = key === activeModel;
      const isDownloaded = st.downloaded;
      const isDownloading = st.downloading;
      const isLoaded = st.is_loaded || st.status === "loaded";
      const isLoading = st.status === "loading";
      const isError = st.status === "error";
      const progress = st.progress || 0;

      let dotClass = "not_loaded";
      let dotTitle = "Not loaded in memory";
      if (isLoading) {
        dotClass = "loading";
        dotTitle = "Loading model into memory...";
      } else if (isError) {
        dotClass = "error";
        dotTitle = st.error || "Model load error";
      } else if (isLoaded) {
        dotClass = "loaded";
        dotTitle = "Loaded in memory (Ready)";
      }

      let statusLabel = "";
      let statusClass = "";
      let btnIcon = "↓";
      let btnTitle = "Download model";

      if (isDownloading) {
        statusLabel = `${Math.round(progress)}%`;
        statusClass = "downloading";
        btnIcon = "⌛︎";
        btnTitle = "Downloading...";
      } else if (isDownloaded) {
        statusLabel = "✓";
        statusClass = "downloaded";
        btnIcon = "🗘";
        btnTitle = "Smart Reload / Repair model";
      } else {
        statusLabel = "⇲";
        statusClass = "not-downloaded";
        btnIcon = "⇲";
        btnTitle = "Download model";
      }

      return `
        <div class="trix-model-row ${isActive ? "active" : ""} ${isDownloaded ? "has-model" : ""} ${isDownloading ? "downloading" : ""}"
             data-key="${key}" title="${meta.pairs} · ${meta.size}">
          <!-- Progress fill bar (behind content) -->
          <div class="trix-model-progress-fill" style="width:${isDownloading ? progress : 0}%; background:var(--trix-prompt-accent, #ff5500); opacity:0.25;"></div>
          <!-- Content -->
          <div class="trix-model-row-content">
            <div class="trix-model-active-dot ${dotClass}" title="${dotTitle}"></div>
            <div class="trix-model-info">
              <span class="trix-model-name">${meta.label}</span>
              <span class="trix-model-pairs">${st.message || meta.pairs}</span>
            </div>
            <span class="trix-model-size">${meta.size}</span>
            <button class="trix-model-dl-btn" data-key="${key}" title="${btnTitle}">
              ${btnIcon}
            </button>
          </div>
          <div class="trix-model-status-badge ${statusClass}">${isDownloading ? statusLabel : ""}</div>
        </div>
      `;
    }).join("");
  }

  _refreshModelPicker() {
    if (!this.panel) return;
    const picker = this.panel.querySelector("#trix-model-picker");
    if (picker) {
      picker.innerHTML = this._renderModelPicker();
      this._wirePickerEvents();
    }
  }

  async _loadModelStatus() {
    try {
      const r = await fetch("/trix_prompt/models_status");
      if (!r.ok) return;
      const d = await r.json();
      if (d.status === "success") {
        for (const [key, info] of Object.entries(d.models)) {
          this._modelStatus[key] = {
            ...this._modelStatus[key],
            downloaded: info.downloaded,
            status: info.status || (info.is_loaded ? "loaded" : "not_loaded"),
            is_loaded: info.is_loaded,
            error: info.error
          };
          if (!MODEL_META[key]) {
            MODEL_META[key] = { label: info.description || "Custom", pairs: info.lang_pairs || "custom", size: info.size || "Local" };
          }
        }
        this._refreshModelPicker();
      }
    } catch (_) {}
  }

  _showRepairConsentModal(key, diagData) {
    const meta = MODEL_META[key] || { label: key };
    const missing = diagData.missing_packages || [];
    const overlay = document.createElement("div");
    overlay.className = "trix-modal-overlay trix-fade-in";
    overlay.style.zIndex = "10000";
    overlay.innerHTML = `
      <div class="trix-dialog-box trix-slide-up" style="width:400px; height:auto; padding:20px; background:#191b24; border-radius:10px; border:1px solid #2e3245;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h3 style="margin:0; color:var(--trix-prompt-accent, #ff5500); font-size:14px; display:flex; align-items:center; gap:6px;">⚠︎ Smart Model Repair</h3>
          <button class="trix-ps-delete trix-cm-close">✕</button>
        </div>
        <div style="font-size:12px; color:#e2e8f0; line-height:1.5; margin-bottom:12px;">
          Model <b>${meta.label}</b> could not be loaded because required components are missing.
        </div>
        <div style="background:#101217; padding:8px 10px; border-radius:6px; border:1px solid #2e3245; font-size:11px; color:#ef4444; font-family:monospace; margin-bottom:14px; word-break:break-word;">
          ${diagData.error || diagData.message}
        </div>
        ${missing.length > 0 ? `
          <div style="font-size:11px; color:#8a99ad; margin-bottom:14px;">
            Missing Python libraries: <b style="color:#fff;">${missing.join(", ")}</b>
          </div>
        ` : ''}
        <div style="font-size:11px; color:#8a99ad; margin-bottom:16px;">
          Would you like TrixPromptAIO to automatically download and install the required dependencies?
        </div>
        <div style="display:flex; justify-content:flex-end; gap:8px;">
          <button class="trix-btn-secondary trix-cm-cancel" style="padding:6px 12px; font-size:12px;">Cancel</button>
          <button class="trix-btn-primary trix-cm-confirm" style="padding:6px 14px; font-size:12px;">Install & Repair</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector(".trix-cm-close").addEventListener("click", () => overlay.remove());
    overlay.querySelector(".trix-cm-cancel").addEventListener("click", () => overlay.remove());
    overlay.querySelector(".trix-cm-confirm").addEventListener("click", async () => {
      overlay.remove();
      this._modelStatus[key] = { downloaded: true, downloading: true, progress: 10, status: "loading", message: "Downloading components..." };
      this._refreshModelPicker();

      try {
        await fetch("/trix_prompt/models/repair", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model_key: key, packages: missing }),
        });
      } catch (err) {
        alert("Failed to start repair process: " + err);
      }
    });
  }

  _showMissingFilesModal(key, diagData) {
    const meta = MODEL_META[key] || { label: key };
    const overlay = document.createElement("div");
    overlay.className = "trix-modal-overlay trix-fade-in";
    overlay.style.zIndex = "10000";
    overlay.innerHTML = `
      <div class="trix-dialog-box trix-slide-up" style="width:400px; height:auto; padding:20px; background:#191b24; border-radius:10px; border:1px solid #2e3245;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h3 style="margin:0; color:var(--trix-prompt-accent, #ff5500); font-size:14px; display:flex; align-items:center; gap:6px;">⚠︎ Smart Model Repair</h3>
          <button class="trix-ps-delete trix-cm-close">✕</button>
        </div>
        <div style="font-size:12px; color:#e2e8f0; line-height:1.5; margin-bottom:12px;">
          Model <b>${meta.label}</b> could not be loaded due to missing or corrupted files.
        </div>
        <div style="background:#101217; padding:8px 10px; border-radius:6px; border:1px solid #2e3245; font-size:11px; color:#ef4444; font-family:monospace; margin-bottom:14px; word-break:break-word;">
          ${diagData.error || diagData.message}
        </div>
        <div style="font-size:11px; color:#8a99ad; margin-bottom:16px;">
          Would you like TrixPromptAIO to automatically fix this by re-downloading the required files?
        </div>
        <div style="display:flex; justify-content:flex-end; gap:8px;">
          <button class="trix-btn-secondary trix-cm-cancel" style="padding:6px 12px; font-size:12px;">Cancel</button>
          <button class="trix-btn-primary trix-cm-confirm" style="padding:6px 14px; font-size:12px;">Fix & Download</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector(".trix-cm-close").addEventListener("click", () => overlay.remove());
    overlay.querySelector(".trix-cm-cancel").addEventListener("click", () => overlay.remove());
    overlay.querySelector(".trix-cm-confirm").addEventListener("click", () => {
      overlay.remove();
      this._startDownload(key);
    });
  }

  async _startDownload(key) {
    const st = this._modelStatus[key] || {};
    if (st.downloading) return;

    this._modelStatus[key] = { ...st, downloading: true, progress: 5, message: "Starting download..." };
    this._refreshModelPicker();

    try {
      const r = await fetch("/trix_prompt/download_model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model_key: key }),
      });
      const d = await r.json();
      if (d.status !== "started") {
        this._modelStatus[key] = { ...this._modelStatus[key], downloading: false, message: "Failed to start" };
        this._refreshModelPicker();
      }
    } catch (err) {
      this._modelStatus[key] = { ...this._modelStatus[key], downloading: false, message: "Network error" };
      this._refreshModelPicker();
    }
  }

  // ─── Wire Events ─────────────────────────────────────────────────────────────

  _wireEvents() {
    if (!this.panel) return;

    this.panel.querySelector(".trix-sp-close").addEventListener("click", () => this.close());

    // Accent color
    const colorPicker = this.panel.querySelector(".trix-sp-color");
    this.panel.querySelectorAll(".trix-sp-preset").forEach(b => {
      b.addEventListener("click", () => {
        colorPicker.value = b.dataset.c;
        this._applyAccent(b.dataset.c);
        this._syncAndSave();
      });
    });

    // All selects + color input
    this.panel.querySelectorAll("select, input").forEach(el => {
      if (el.classList.contains("trix-sp-src") || el.classList.contains("trix-sp-tgt")) return;
      el.addEventListener("change", () => this._syncAndSave());
      if (el.type === "color") {
        el.addEventListener("input", (e) => {
          this._applyAccent(e.target.value);
          this._syncAndSave();
        });
      }
    });

    // Seed stepper buttons & input
    const seedInput = this.panel.querySelector(".trix-sp-group-seed");
    const seedDecBtn = this.panel.querySelector(".trix-sp-seed-dec");
    const seedIncBtn = this.panel.querySelector(".trix-sp-seed-inc");

    if (seedInput) {
      if (seedDecBtn) {
        seedDecBtn.addEventListener("click", () => {
          let cur = parseInt(seedInput.value, 10) || 1;
          if (cur > 1) {
            seedInput.value = cur - 1;
            this._syncAndSave();
          }
        });
      }
      if (seedIncBtn) {
        seedIncBtn.addEventListener("click", () => {
          let cur = parseInt(seedInput.value, 10) || 1;
          seedInput.value = cur + 1;
          this._syncAndSave();
        });
      }
      seedInput.addEventListener("input", () => {
        let cur = parseInt(seedInput.value, 10);
        if (isNaN(cur) || cur < 1) {
          if (seedInput.value !== "") seedInput.value = 1;
        }
        this._syncAndSave();
      });
      seedInput.addEventListener("change", () => {
        let cur = parseInt(seedInput.value, 10);
        if (isNaN(cur) || cur < 1) seedInput.value = 1;
        this._syncAndSave();
      });
    }

    // Listen for "Choose another..."
    const srcSel = this.panel.querySelector(".trix-sp-src");
    if (srcSel) {
      srcSel.addEventListener("change", (e) => {
        if (e.target.value === "choose") this._showLangPicker("src", this.settings.srcLang);
        else this._syncAndSave();
      });
    }
    const tgtSel = this.panel.querySelector(".trix-sp-tgt");
    if (tgtSel) {
      tgtSel.addEventListener("change", (e) => {
        if (e.target.value === "choose") this._showLangPicker("tgt", this.settings.tgtLang);
        else this._syncAndSave();
      });
    }

    // Engine toggle → show/hide offline section
    const engineSel = this.panel.querySelector(".trix-sp-engine");
    if (engineSel) {
      engineSel.addEventListener("change", () => {
        const wrap = this.panel.querySelector(".trix-sp-offline-wrap");
        if (wrap) wrap.style.display = engineSel.value === "offline" ? "" : "none";
      });
    }

    // Refresh Styles & Packs button (߷)
    const btnReload = this.panel.querySelector(".trix-sp-reload-styles");
    if (btnReload) {
      btnReload.addEventListener("click", async () => {
        const icon = btnReload.querySelector(".trix-sp-reload-icon");
        if (icon) {
          icon.style.transform = "rotate(360deg)";
          setTimeout(() => {
            icon.style.transition = "none";
            icon.style.transform = "rotate(0deg)";
            setTimeout(() => { icon.style.transition = "transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)"; }, 50);
          }, 650);
        }

        try {
          this.showToast("Reloading styles, packs & previews...");
          const res = await fetch("/trix_prompt/styles/reload", { method: "POST" });
          const data = await res.json();
          if (data.status === "success") {
            const now = Date.now();
            // Update all Trix nodes on canvas
            if (typeof app !== "undefined" && app.graph?._nodes) {
              for (const n of app.graph._nodes) {
                if (n && n._trixGallery) {
                  n._trixGallery._cacheBuster = now;
                  if (n._trixGallery.modal) {
                    n._trixGallery.modal.setStyles(data.styles, data.categories);
                    if (n._trixGallery.modal.modalEl) n._trixGallery.modal.render();
                  }
                  await n._trixGallery.loadStyles(data.styles, data.categories);
                  n._trixGallery.renderCategories();
                  n._trixGallery.filterStyles(n._trixGallery.searchQuery, n._trixGallery.selectedCategory);
                  if (n._trixStack) {
                    n._trixStack._notify();
                  }
                }
              }
            } else if (this.node?._trixGallery) {
              this.node._trixGallery._cacheBuster = now;
              if (this.node._trixGallery.modal) {
                this.node._trixGallery.modal.setStyles(data.styles, data.categories);
              }
              await this.node._trixGallery.loadStyles(data.styles, data.categories);
              this.node._trixGallery.renderCategories();
              this.node._trixGallery.filterStyles(this.node._trixGallery.searchQuery, this.node._trixGallery.selectedCategory);
              if (this.node._trixStack) {
                this.node._trixStack._notify();
              }
            }
            this.showToast("Styles & packs reloaded successfully!");
          } else {
            alert("Reload failed: " + (data.message || "Unknown error"));
          }
        } catch (err) {
          alert("Reload failed: " + err.message);
        }
      });
    }

    // Excel Export & Import
    const btnExport = this.panel.querySelector(".trix-sp-excel-export");
    if (btnExport) {
      btnExport.addEventListener("click", async () => {
        let activeCat = "All";
        if (this.node?._trixGallery?.selectedCategory) {
          activeCat = this.node._trixGallery.selectedCategory;
        }
        if (activeCat && activeCat !== "All" && activeCat !== "favorite" && activeCat !== "favourites") {
          this.downloadExcelCategory(activeCat);
        } else {
          this.showExportCategoryModal();
        }
      });
    }

    const btnImportBtn = this.panel.querySelector(".trix-sp-excel-import-btn");
    const fileInput = this.panel.querySelector(".trix-sp-excel-file");
    if (btnImportBtn && fileInput) {
      btnImportBtn.addEventListener("click", () => fileInput.click());
      fileInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          this.showToast(`Importing ${file.name}...`);
          const formData = new FormData();
          formData.append("file", file);
          const res = await fetch("/trix_prompt/styles/import_excel", {
            method: "POST",
            body: formData
          });
          const data = await res.json();
          if (data.status === "success") {
            const r = data.result;
            this.showToast(`Imported ${r.imported_styles} styles for category "${r.category}"!`);
            if (this.node?._trixGallery) {
              await this.node._trixGallery.loadStyles();
              this.node._trixGallery.renderCategories();
              this.node._trixGallery.filterStyles(this.node._trixGallery.searchQuery, r.category);
            }
          } else {
            alert("Excel import failed: " + (data.message || "Unknown error"));
          }
        } catch (err) {
          alert("Excel import failed: " + err.message);
        } finally {
          fileInput.value = "";
        }
      });
    }

    // Reset
    this.panel.querySelector(".trix-sp-reset").addEventListener("click", () => {
      this.settings = {
        accentColor: "#5881AF", transEnabled: false, transMode: "on_demand",
        transEngine: "online_google", srcLang: "auto", tgtLang: "en",
        groupMode: "increment", groupSeed: 1, styleClickAction: "copy_text", offlineModel: "helsinki_opus_ru_en",
        uiLang: "en", sepComma: true, sepPeriod: false, sepSpace: true, sepNewline: false
      };
      saveSettings(this.settings);
      this._applyAccent("#5881AF");
      this.close();
      this.open();
      this._emit();
    });

    this._wirePickerEvents();
  }

  _wirePickerEvents() {
    if (!this.panel) return;
    const picker = this.panel.querySelector("#trix-model-picker");
    if (!picker) return;

    // ── Click row → select model ──────────────────────────────────────────────
    picker.querySelectorAll(".trix-model-row").forEach(row => {
      row.addEventListener("click", async (e) => {
        if (e.target.classList.contains("trix-model-dl-btn")) return;
        const key = row.dataset.key;
        const st = this._modelStatus[key] || {};

        // Block ALL switching while any model is downloading
        const anyDownloading = Object.values(this._modelStatus).some(s => s.downloading);
        if (anyDownloading) {
          this._showToast("⏳ Please wait for the current download to finish.");
          return;
        }

        // Not downloaded → offer to download, then revert on cancel
        if (!st.downloaded) {
          this._showDownloadConsentModal(key, () => {
            // on confirm: switch selection to this key and start download
            this._switchModelSelection(key);
            this._startDownload(key);
          });
          return;
        }

        // Downloaded → switch selection and trigger async RAM load
        this._switchModelSelection(key);
        this._triggerAsyncLoad(key);
      });
    });

    // ── Action button: Download / Smart-Reload-Repair ─────────────────────────
    picker.querySelectorAll(".trix-model-dl-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const key = btn.dataset.key;
        const st = this._modelStatus[key] || {};
        if (st.downloading) return;

        // Not downloaded → start download
        if (!st.downloaded) {
          this._startDownload(key);
          return;
        }

        // Downloaded → Smart Reload & Repair (synchronous, shows result)
        this._modelStatus[key] = { ...st, status: "loading" };
        this._refreshModelPicker();

        try {
          const r = await fetch("/trix_prompt/models/reload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model_key: key }),
          });
          const d = await r.json();

          if (d.status === "loaded") {
            this._modelStatus[key] = { ...st, downloaded: true, status: "loaded", error: null };
            this._switchModelSelection(key);
          } else if (d.status === "missing_deps") {
            this._modelStatus[key] = { ...st, status: "error", error: d.error };
            this._refreshModelPicker();
            this._showRepairConsentModal(key, d);
          } else {
            this._modelStatus[key] = { ...st, status: "error", error: d.error || d.message };
            this._refreshModelPicker();
            this._showMissingFilesModal(key, d);
          }
        } catch (err) {
          this._modelStatus[key] = { ...st, status: "error", error: String(err) };
          this._refreshModelPicker();
          this._showToast(`❌ Reload failed: ${err.message || err}`);
        }
      });
    });
  }

  /** Switch the active model selection, unload previous from RAM, emit settings. */
  _switchModelSelection(key) {
    const prevModel = this.settings.offlineModel;
    if (prevModel && prevModel !== key && this._modelStatus[prevModel]) {
      this._modelStatus[prevModel].status = "not_loaded";
      this._modelStatus[prevModel].is_loaded = false;
      this._modelStatus[prevModel].downloading = false;
    }
    this.settings.offlineModel = key;
    saveSettings(this.settings);
    fetch("/trix_prompt/models/unload", { method: "POST" }).catch(() => {});
    this._emit();
    this._refreshModelPicker();
  }

  /** Trigger async background load of a downloaded model. */
  async _triggerAsyncLoad(key) {
    const st = this._modelStatus[key] || {};
    if (st.status === "loaded" || st.status === "loading") return;
    this._modelStatus[key] = { ...st, status: "loading" };
    this._refreshModelPicker();
    try {
      const r = await fetch("/trix_prompt/models/load", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model_key: key }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    } catch (_) {
      this._modelStatus[key] = { ...st, status: "not_loaded" };
      this._refreshModelPicker();
    }
  }

  /** Handle model_status WS events (loading → loaded / error). */
  _onModelStatusEvent(data) {
    const key = data.model_key;
    if (!key) return;
    const st = this._modelStatus[key] || {};
    this._modelStatus[key] = {
      ...st,
      status: data.status,
      error: data.error || null,
      is_loaded: data.status === "loaded",
    };
    this._refreshModelPicker();
  }

  showToast(msg) {
    this._showToast(msg);
  }

  /** Show a simple toast message at the bottom of the panel. */
  _showToast(msg) {
    let toast = this.panel && this.panel.querySelector(".trix-toast");
    if (!toast && this.panel) {
      toast = document.createElement("div");
      toast.className = "trix-toast";
      toast.style.cssText = "position:absolute;bottom:10px;left:8px;right:8px;background:#1e2130;border:1px solid #f66744;color:#fff;border-radius:6px;padding:7px 10px;font-size:12px;z-index:9999;text-align:center;";
      this.panel.appendChild(toast);
    }
    if (toast) {
      toast.textContent = msg;
      toast.style.display = "block";
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => { if (toast) toast.style.display = "none"; }, 3000);
    }
  }

  /** Consent modal when clicking a NOT-downloaded model. */
  _showDownloadConsentModal(key, onConfirm) {
    const meta = MODEL_META[key] || {};
    const overlay = document.createElement("div");
    overlay.className = "trix-modal-overlay trix-fade-in";
    overlay.style.zIndex = "10001";
    overlay.innerHTML = `
      <div class="trix-dialog-box trix-slide-up" style="width:320px;padding:20px;background:#1e212b;border-radius:10px;">
        <h3 style="margin:0 0 8px;color:#fff;font-size:14px;">⬇ Download ${meta.label || key}?</h3>
        <p style="color:#8a99ad;font-size:12px;margin:0 0 16px;">This model is not downloaded yet. Download now (~${meta.size || '?'})? Once downloaded it will be selected automatically.</p>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button class="trix-ps-btn trix-cm-cancel" style="padding:5px 14px;">Cancel</button>
          <button class="trix-ps-btn trix-cm-confirm" style="padding:5px 14px;background:var(--trix-prompt-accent,#ff5500);color:#fff;border:none;border-radius:4px;">Download</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector(".trix-cm-cancel").addEventListener("click", () => overlay.remove());
    overlay.querySelector(".trix-cm-confirm").addEventListener("click", () => {
      overlay.remove();
      onConfirm();
      fetch("/trix_prompt/models/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model_key: key }),
      }).catch(() => {});
    });
  }

  // ─── Progress from WebSocket ─────────────────────────────────────────────────

  updateDownloadProgress(data) {
    const key = data.model_key;
    if (!key) return;

    // Clear stale downloading flags on all other models
    Object.keys(this._modelStatus).forEach(k => {
      if (k !== key && this._modelStatus[k].downloading) {
        this._modelStatus[k].downloading = false;
      }
    });

    if (data.status === "completed") {
      this._modelStatus[key] = { downloaded: true, downloading: false, progress: 100, message: null, status: "not_loaded" };
      // Auto-select this model and trigger RAM load
      this._switchModelSelection(key);
      this._triggerAsyncLoad(key);
    } else if (data.status === "error") {
      this._modelStatus[key] = { ...this._modelStatus[key], downloading: false, progress: 0, message: data.message || "Error", status: "error" };
    } else {
      this._modelStatus[key] = {
        ...this._modelStatus[key],
        downloading: true,
        progress: data.progress || 0,
        message: data.message || "",
      };
    }

    this._refreshModelPicker();
  }

  // ─── Sync & Save ─────────────────────────────────────────────────────────────

  _syncAndSave() {
    if (!this.panel) return;
    const g = (sel) => this.panel.querySelector(sel);
    const v = (sel) => g(sel)?.value;

    if (g(".trix-sp-color"))      this.settings.accentColor  = v(".trix-sp-color");
    if (g(".trix-sp-group-mode")) this.settings.groupMode    = v(".trix-sp-group-mode");
    if (g(".trix-sp-group-seed")) {
      const parsedSeed = parseInt(v(".trix-sp-group-seed"), 10);
      this.settings.groupSeed = isNaN(parsedSeed) ? 1 : Math.max(1, parsedSeed);
    }
    if (g(".trix-sp-click-action")) this.settings.styleClickAction = v(".trix-sp-click-action");
    if (g(".trix-sp-mode"))       this.settings.transMode    = v(".trix-sp-mode");
    if (g(".trix-sp-engine"))     this.settings.transEngine  = v(".trix-sp-engine");
    if (g(".trix-sp-src"))        this.settings.srcLang      = v(".trix-sp-src");
    if (g(".trix-sp-tgt"))        this.settings.tgtLang      = v(".trix-sp-tgt");
    
    if (g(".trix-sp-sep-comma"))  this.settings.sepComma     = g(".trix-sp-sep-comma").checked;
    if (g(".trix-sp-sep-period")) this.settings.sepPeriod    = g(".trix-sp-sep-period").checked;
    if (g(".trix-sp-sep-space"))  this.settings.sepSpace     = g(".trix-sp-sep-space").checked;
    if (g(".trix-sp-sep-newline")) this.settings.sepNewline  = g(".trix-sp-sep-newline").checked;

    saveSettings(this.settings);
    this._emit();
  }

  _applyAccent(c) {
    this.container.style.setProperty("--trix-acc", c);
    document.documentElement.style.setProperty("--trix-prompt-accent", c);
    if (this.panel) this.panel.style.setProperty("--trix-acc", c);
  }

  _emit() {
    if (this.onSettingsChange) this.onSettingsChange(this.settings);
  }

  async downloadExcelCategory(catName) {
    try {
      const isAll = !catName || catName === "All" || catName === "all";
      const filename = isAll ? "all_trix_styles.zip" : `${catName}.xlsx`;
      const toastMsg = isAll ? "Exporting all_trix_styles.zip..." : `Exporting ${filename}...`;
      this.showToast(toastMsg);

      const query = isAll ? "category=all" : `category=${encodeURIComponent(catName)}`;
      const res = await fetch(`/trix_prompt/styles/export_excel?${query}`);
      if (!res.ok) throw new Error("Export failed");

      const mimeType = isAll
        ? "application/zip"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      const rawBlob = await res.blob();
      const blob = new Blob([rawBlob], { type: mimeType });

      if (window.showSaveFilePicker) {
        try {
          const fileHandle = await window.showSaveFilePicker({
            suggestedName: filename,
            types: [{
              description: isAll ? "ZIP Archive (*.zip)" : "Excel Workbook (*.xlsx)",
              accept: { [mimeType]: [isAll ? ".zip" : ".xlsx"] }
            }]
          });
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();
          this.showToast(`Exported ${filename} successfully!`);
          return;
        } catch (err) {
          if (err.name === "AbortError") return;
        }
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      this.showToast(`Exported ${filename} successfully!`);
    } catch (err) {
      alert("Excel export failed: " + err.message);
    }
  }

  async showExportCategoryModal() {
    let categories = [];
    try {
      const r = await fetch("/trix_prompt/styles/categories");
      const d = await r.json();
      if (d.status === "success") categories = d.categories || [];
    } catch (_) {}

    const overlay = document.createElement("div");
    overlay.className = "trix-modal-overlay trix-fade-in";
    overlay.style.zIndex = "10000";
    overlay.innerHTML = `
      <div class="trix-dialog-box trix-slide-up" style="width:340px; height:auto; padding:18px; background:#191b24; border-radius:10px; border:1px solid #2e3245;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h3 style="margin:0; color:#fff; font-size:14px; display:flex; align-items:center; gap:6px;">📊 Select Excel Group to Export</h3>
          <button class="trix-ps-delete trix-ex-close">✕</button>
        </div>
        <div style="font-size:12px; color:#8a99ad; margin-bottom:12px;">
          Choose a specific style group to export, or export all groups as a ZIP bundle:
        </div>
        <div style="margin-bottom:16px;">
          <select class="trix-sp-select trix-ex-cat-select" style="width:100%; padding:8px; font-size:12px; border-radius:6px; background:#252936; color:#fff; border:1px solid #3b4259;">
            <option value="all">📦 All Categories (ZIP Archive)</option>
            ${categories.map(c => `<option value="${c}">📄 ${c}.xlsx</option>`).join('')}
          </select>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:8px;">
          <button class="trix-btn-secondary trix-ex-cancel" style="padding:6px 12px; font-size:12px;">Cancel</button>
          <button class="trix-btn-primary trix-ex-confirm" style="padding:6px 14px; font-size:12px; background:var(--trix-prompt-accent, #ff5500); color:#fff; border:none; border-radius:6px; font-weight:600; cursor:pointer;">Export Excel</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector(".trix-ex-close").addEventListener("click", () => overlay.remove());
    overlay.querySelector(".trix-ex-cancel").addEventListener("click", () => overlay.remove());
    overlay.querySelector(".trix-ex-confirm").addEventListener("click", () => {
      const selected = overlay.querySelector(".trix-ex-cat-select").value;
      overlay.remove();
      this.downloadExcelCategory(selected);
    });
  }

  close() {
    if (this._onOutsideClick) {
      window.removeEventListener("pointerdown", this._onOutsideClick, true);
      this._onOutsideClick = null;
    }
    if (this._wsHandler) {
      api.removeEventListener("trix_prompt_download_progress", this._wsHandler);
      this._wsHandler = null;
    }
    if (this._msHandler) {
      api.removeEventListener("trix_prompt_model_status", this._msHandler);
      this._msHandler = null;
    }
    if (this.panel) { this.panel.remove(); this.panel = null; }
  }
}
