import { app as app$1 } from "/scripts/app.js";
import { LoraNotesDrawer } from "./lora_notes_drawer.js";
import { openLoraSettingsDrawer } from "./lora_settings_drawer.js";
import {
  SuperLoraDOMRenderer,
  openSuperLoraSettingsPanel,
  isVueNodes,
  gateResizeAndDraw,
  hideJsonWidget,
  isGraphLoading
} from "./trix_super_lora_dom.js";
class LoraService {
  constructor() {
    this.availableLoras = [];
    this.loraCache = /* @__PURE__ */ new Map();
  }
  static getInstance() {
    if (!LoraService.instance) {
      LoraService.instance = new LoraService();
    }
    return LoraService.instance;
  }
  /**
   * Initialize the service and load available LoRAs
   */
  async initialize() {
    try {
      await this.refreshLoraList();
    } catch (error) {
      console.error("Super LoRA Loader: Failed to initialize LoRA service:", error);
    }
  }
  /**
   * Get list of available LoRA files
   */
  async getAvailableLoras() {
    if (this.availableLoras.length === 0) {
      await this.refreshLoraList();
    }
    return this.availableLoras;
  }
  /**
   * Refresh the list of available LoRAs from the backend
   */
  async refreshLoraList() {
    try {
      const resp = await fetch("/super_lora/loras");
      if (resp.ok) {
        const json = await resp.json();
        if (Array.isArray(json.loras) && json.loras.length > 0) {
          this.availableLoras = json.loras;
          console.log(`Super LoRA Loader: Found ${this.availableLoras.length} LoRAs via super_lora/loras`);
          return this.availableLoras;
        }
      }
    } catch (_) {}

    try {
      const response = await fetch("/object_info");
      const data = await response.json();
      const loraLoader = data.LoraLoader;
      if (loraLoader && loraLoader.input && loraLoader.input.required && loraLoader.input.required.lora_name) {
        this.availableLoras = loraLoader.input.required.lora_name[0] || [];
      } else {
        const folderResponse = await fetch("/api/v1/folder_paths");
        if (folderResponse.ok) {
          const folderData = await folderResponse.json();
          this.availableLoras = folderData.loras || [];
        }
      }
      console.log(`Super LoRA Loader: Found ${this.availableLoras.length} LoRAs`);
      return this.availableLoras;
    } catch (error) {
      console.error("Super LoRA Loader: Failed to refresh LoRA list:", error);
      this.availableLoras = [];
      return [];
    }
  }
  /**
   * Create a new LoRA configuration with defaults
   */
  createLoraConfig(loraName = "None") {
    return {
      lora: loraName,
      enabled: true,
      strength_model: 1,
      strength_clip: 1,
      trigger_word: "",
      tag: "General",
      auto_populated: false
    };
  }
  /**
   * Validate a LoRA configuration
   */
  validateLoraConfig(config) {
    if (!config || typeof config !== "object") {
      return false;
    }
    if (typeof config.lora !== "string" || typeof config.enabled !== "boolean") {
      return false;
    }
    const strengthModel = Number(config.strength_model);
    const strengthClip = Number(config.strength_clip);
    if (isNaN(strengthModel) || isNaN(strengthClip)) {
      return false;
    }
    if (strengthModel < 0 || strengthModel > 2 || strengthClip < 0 || strengthClip > 2) {
      return false;
    }
    return true;
  }
  /**
   * Check if a LoRA is already in the configuration list
   */
  isDuplicateLora(configs, loraName) {
    return configs.some((config) => config.lora === loraName && loraName !== "None");
  }
  /**
   * Sort LoRA configurations by tag and name
   */
  sortLoraConfigs(configs) {
    return [...configs].sort((a, b) => {
      if (a.tag !== b.tag) {
        if (a.tag === "General") return -1;
        if (b.tag === "General") return 1;
        return a.tag.localeCompare(b.tag);
      }
      return a.lora.localeCompare(b.lora);
    });
  }
  /**
   * Group LoRA configurations by tag
   */
  groupLorasByTag(configs) {
    const groups = /* @__PURE__ */ new Map();
    for (const config of configs) {
      const tag = config.tag || "General";
      if (!groups.has(tag)) {
        groups.set(tag, []);
      }
      groups.get(tag).push(config);
    }
    return groups;
  }
  /**
   * Get available tags from a list of LoRA configurations
   */
  getAvailableTags(configs) {
    const tags = /* @__PURE__ */ new Set();
    for (const config of configs) {
      tags.add(config.tag || "General");
    }
    return Array.from(tags).sort((a, b) => {
      if (a === "General") return -1;
      if (b === "General") return 1;
      return a.localeCompare(b);
    });
  }
  /**
   * Get common tag suggestions
   */
  getCommonTags() {
    return [
      "General",
      "Character",
      "Style",
      "Quality",
      "Effect",
      "Background",
      "Clothing",
      "Pose",
      "Lighting"
    ];
  }
  /**
   * Convert LoRA configs to backend format
   */
  convertToBackendFormat(configs) {
    const result = {};
    configs.forEach((config, index) => {
      if (config.lora && config.lora !== "None") {
        const key = `lora_${index + 1}`;
        result[key] = {
          lora: config.lora,
          enabled: config.enabled,
          strength_model: config.strength_model,
          strength_clip: config.strength_clip,
          trigger_word: config.trigger_word || "",
          tag: config.tag || "General"
        };
      }
    });
    return result;
  }
  /**
   * Extract trigger words from all enabled LoRAs
   */
  extractTriggerWords(configs) {
    const triggerWords = [];
    for (const config of configs) {
      if (config.enabled && config.trigger_word && config.trigger_word.trim()) {
        triggerWords.push(config.trigger_word.trim());
      }
    }
    return triggerWords.join(", ");
  }
}
class TemplateService {
  constructor() {
    this.templates = [];
    this.isLoaded = false;
  }
  static getInstance() {
    if (!TemplateService.instance) {
      TemplateService.instance = new TemplateService();
    }
    return TemplateService.instance;
  }
  /**
   * Initialize the template service
   */
  async initialize() {
    if (!this.isLoaded) {
      await this.loadTemplates();
    }
  }
  /**
   * Load templates from backend
   */
  async loadTemplates() {
    try {
      const response = await fetch("/super_lora/templates", {
        method: "GET"
      });
      if (response.ok) {
        const data = await response.json();
        const templates = data.templates ?? data ?? [];
        this.templates = Array.isArray(templates) ? templates : [];
        this.isLoaded = true;
        console.log(`Super LoRA Loader: Loaded ${this.templates.length} templates`);
      } else {
        console.warn("Super LoRA Loader: Failed to load templates:", response.statusText);
        this.templates = [];
        this.isLoaded = true;
      }
    } catch (error) {
      console.error("Super LoRA Loader: Error loading templates:", error);
      this.templates = [];
      this.isLoaded = true;
    }
  }
  /**
   * Get all available templates
   */
  async getTemplates() {
    if (!this.isLoaded) {
      await this.loadTemplates();
    }
    return [...this.templates];
  }
  /**
   * Save a new template
   */
  async saveTemplate(name, loraConfigs) {
    try {
      const validConfigs = loraConfigs.filter(
        (config) => config.lora && config.lora !== "None"
      );
      if (validConfigs.length === 0) {
        throw new Error("No valid LoRA configurations to save");
      }
      const normalized = validConfigs.map((cfg) => ({
        lora: cfg.lora,
        enabled: !!cfg.enabled,
        strength_model: Number(cfg.strength_model ?? 1),
        strength_clip: Number(cfg.strength_clip ?? cfg.strength_model ?? 1),
        trigger_word: cfg.trigger_word ?? "",
        tag: cfg.tag ?? "General",
        auto_populated: !!cfg.auto_populated
      }));
      const template = {
        name,
        version: "1.0",
        lora_configs: normalized
      };
      const response = await fetch("/super_lora/templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(template)
      });
      if (response.ok) {
        await this.loadTemplates();
        console.log(`Super LoRA Loader: Template "${name}" saved successfully`);
        return true;
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error(`Super LoRA Loader: Failed to save template "${name}":`, error);
      return false;
    }
  }
  /**
   * Load a template by name
   */
  async loadTemplate(name) {
    try {
      const templates = await this.getTemplates();
      const template = templates.find((t) => t && (t.name === name || t.id === name || t.title === name || t === name));
      const extractList = (tpl) => {
        if (!tpl) return null;
        if (Array.isArray(tpl.loras)) return tpl.loras;
        if (Array.isArray(tpl.items)) return tpl.items;
        if (tpl.template) return extractList(tpl.template);
        if (typeof tpl === "string") {
          try {
            const parsed = JSON.parse(tpl);
            return extractList(parsed);
          } catch {
          }
        }
        return null;
      };
      const fetchByName = async () => {
        const tryParse = (data) => {
          const list2 = extractList(data);
          if (!list2) return null;
          const valid = list2.filter((cfg) => this.validateLoraConfig(cfg));
          return valid;
        };
        try {
          let resp = await fetch(`/super_lora/templates?name=${encodeURIComponent(name)}`);
          if (resp.ok) {
            const data = await resp.json();
            const out = tryParse(data);
            if (out) return out;
          }
        } catch {
        }
        try {
          const resp2 = await fetch(`/super_lora/templates/${encodeURIComponent(name)}`);
          if (resp2.ok) {
            const data2 = await resp2.json();
            const out2 = tryParse(data2);
            if (out2) return out2;
          }
        } catch {
        }
        return null;
      };
      if (!template) {
        console.warn(`Super LoRA Loader: Template "${name}" not found in cache, trying GET by name`);
        return await fetchByName();
      }
      let list = extractList(template);
      if (!list) {
        const fetched = await fetchByName();
        if (!fetched) {
          console.warn(`Super LoRA Loader: Template "${name}" has no loras/items array`);
        }
        return fetched;
      }
      const normalize = (cfg) => ({
        lora: cfg.lora ?? cfg.file ?? cfg.name ?? "",
        enabled: cfg.enabled !== void 0 ? !!cfg.enabled : cfg.on === void 0 ? true : !!cfg.on,
        strength_model: cfg.strength_model !== void 0 ? Number(cfg.strength_model) : Number(cfg.strength ?? cfg.value ?? 1),
        strength_clip: cfg.strength_clip !== void 0 ? Number(cfg.strength_clip) : Number(cfg.strengthTwo ?? cfg.clip_strength ?? cfg.strength_model ?? cfg.strength ?? 1),
        trigger_word: cfg.trigger_word ?? cfg.triggerWord ?? cfg.trigger ?? "",
        tag: cfg.tag ?? "General",
        auto_populated: cfg.auto_populated ?? cfg._autoPopulatedTriggerWord ?? false
      });
      const normalized = list.map(normalize);
      const validConfigs = normalized.filter((config) => this.validateLoraConfig(config));
      if (validConfigs.length !== list.length) {
        console.warn(`Super LoRA Loader: Some LoRA configs in template "${name}" are invalid`);
      }
      console.log(`Super LoRA Loader: Loaded template "${name}" with ${validConfigs.length} LoRAs`);
      return validConfigs;
    } catch (error) {
      console.error(`Super LoRA Loader: Failed to load template "${name}":`, error);
      return null;
    }
  }
  /**
   * Delete a template
   */
  async deleteTemplate(name) {
    try {
      let response = await fetch(`/super_lora/templates/${encodeURIComponent(name)}`, {
        method: "DELETE"
      });
      if (!response.ok) {
        response = await fetch("/super_lora/templates", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name })
        });
      }
      if (!response.ok && response.status === 405) {
        response = await fetch("/super_lora/templates/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name })
        });
      }
      if (!response.ok) {
        response = await fetch("/super_lora/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete", name })
        });
      }
      if (response.ok) {
        await this.loadTemplates();
        const stillExists = (this.templates || []).some((t) => t && t.name ? t.name === name : t === name);
        if (stillExists) {
          console.warn(`Super LoRA Loader: Server responded OK but template still present: ${name}`);
          return false;
        }
        console.log(`Super LoRA Loader: Template "${name}" deleted successfully`);
        return true;
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error(`Super LoRA Loader: Failed to delete template "${name}":`, error);
      return false;
    }
  }
  /**
   * Check if a template name already exists
   */
  async templateExists(name) {
    const templates = await this.getTemplates();
    return templates.some((t) => t.name === name);
  }
  /**
   * Get template names for UI selection
   */
  async getTemplateNames() {
    const templates = await this.getTemplates();
    return templates.map((t) => t && t.name ? t.name : String(t)).sort();
  }
  /**
   * Validate a LoRA configuration
   */
  validateLoraConfig(config) {
    if (!config || typeof config !== "object") {
      return false;
    }
    if (!config.lora || typeof config.enabled !== "boolean") {
      return false;
    }
    const strengthModel = Number(config.strength_model);
    const strengthClip = Number(config.strength_clip);
    if (isNaN(strengthModel) || isNaN(strengthClip)) {
      return false;
    }
    return true;
  }
  /**
   * Export template to JSON string
   */
  async exportTemplate(name) {
    try {
      const templates = await this.getTemplates();
      const template = templates.find((t) => t.name === name);
      if (!template) {
        return null;
      }
      return JSON.stringify(template, null, 2);
    } catch (error) {
      console.error(`Super LoRA Loader: Failed to export template "${name}":`, error);
      return null;
    }
  }
  /**
   * Import template from JSON string
   */
  async importTemplate(jsonString) {
    try {
      const template = JSON.parse(jsonString);
      if (!template.name || !template.loras || !Array.isArray(template.loras)) {
        throw new Error("Invalid template format");
      }
      if (await this.templateExists(template.name)) {
        throw new Error(`Template "${template.name}" already exists`);
      }
      return await this.saveTemplate(template.name, template.loras);
    } catch (error) {
      console.error("Super LoRA Loader: Failed to import template:", error);
      return false;
    }
  }
  /**
   * Rename an existing template
   */
  async renameTemplate(oldName, newName) {
    try {
      const src = (oldName || "").trim();
      const dst = (newName || "").trim();
      if (!src || !dst) return false;
      if (src === dst) return true;
      if (await this.templateExists(dst)) {
        throw new Error(`Template "${dst}" already exists`);
      }
      const configs = await this.loadTemplate(src);
      if (!configs || configs.length === 0) {
        throw new Error(`Template "${src}" not found or empty`);
      }
      const saved = await this.saveTemplate(dst, configs);
      if (!saved) return false;
      await this.deleteTemplate(src);
      await this.loadTemplates();
      return true;
    } catch (error) {
      console.error("Super LoRA Loader: Failed to rename template:", error);
      return false;
    }
  }
}
class CivitAiService {
  constructor() {
    this.cache = /* @__PURE__ */ new Map();
    this.pendingRequests = /* @__PURE__ */ new Map();
  }
  static getInstance() {
    if (!CivitAiService.instance) {
      CivitAiService.instance = new CivitAiService();
    }
    return CivitAiService.instance;
  }
  /**
   * Get trigger words for a LoRA file
   */
  async getTriggerWords(loraFileName) {
    try {
      const modelInfo = await this.getModelInfo(loraFileName);
      if (!modelInfo) {
        return [];
      }
      return this.extractTriggerWordsFromModelInfo(modelInfo);
    } catch (error) {
      console.warn(`Super LoRA Loader: Failed to get trigger words for ${loraFileName}:`, error);
      return [];
    }
  }
  /**
   * Get CivitAI full model and trigger info
   */
  async getCivitAiInfo(loraFileName) {
    return await this.getModelInfo(loraFileName);
  }
  /**
   * Get model information from CivitAI
   */
  async getModelInfo(loraFileName) {
    if (this.cache.has(loraFileName)) {
      return this.cache.get(loraFileName);
    }
    if (this.pendingRequests.has(loraFileName)) {
      return await this.pendingRequests.get(loraFileName);
    }
    const requestPromise = this.fetchModelInfo(loraFileName);
    this.pendingRequests.set(loraFileName, requestPromise);
    try {
      const result = await requestPromise;
      this.pendingRequests.delete(loraFileName);
      if (result) {
        this.cache.set(loraFileName, result);
      }
      return result;
    } catch (error) {
      this.pendingRequests.delete(loraFileName);
      throw error;
    }
  }
  /**
   * Fetch model info from backend API
   */
  async fetchModelInfo(loraFileName) {
    try {
      const response = await fetch("/super_lora/civitai_info", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          lora_filename: loraFileName
        })
      });
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      if (data.error) {
        console.warn(`Super LoRA Loader: CivitAI API error for ${loraFileName}:`, data.error);
        return null;
      }
      return data;
    } catch (error) {
      console.warn(`Super LoRA Loader: Failed to fetch model info for ${loraFileName}:`, error);
      return null;
    }
  }
  /**
   * Extract trigger words from CivitAI model info
   */
  extractTriggerWordsFromModelInfo(modelInfo) {
    const triggerWords = [];
    if (modelInfo.trainedWords && Array.isArray(modelInfo.trainedWords)) {
      for (const item of modelInfo.trainedWords) {
        if (typeof item === "string") {
          triggerWords.push(item);
        } else if (item && typeof item === "object" && "word" in item) {
          triggerWords.push(item.word);
        }
      }
    }
    return triggerWords.slice(0, 3);
  }
  /**
   * Clear the cache
   */
  clearCache() {
    this.cache.clear();
  }
  /**
   * Get cache size for debugging
   */
  getCacheSize() {
    return this.cache.size;
  }
  /**
   * Check if auto-fetch is enabled in settings
   */
  isAutoFetchEnabled() {
    try {
      const app2 = window.app;
      if (app2 && app2.ui && app2.ui.settings) {
        return app2.ui.settings.getSettingValue("superLora.autoFetchTriggerWords", true);
      }
    } catch (error) {
      console.warn("Super LoRA Loader: Failed to check auto-fetch setting:", error);
    }
    return true;
  }
  /**
   * Auto-populate trigger words for a LoRA if enabled
   */
  async autoPopulateTriggerWords(loraFileName) {
    if (!this.isAutoFetchEnabled() || !loraFileName || loraFileName === "None") {
      return "";
    }
    try {
      const triggerWords = await this.getTriggerWords(loraFileName);
      return triggerWords.length > 0 ? triggerWords[0] : "";
    } catch (error) {
      console.warn(`Super LoRA Loader: Auto-populate failed for ${loraFileName}:`, error);
      return "";
    }
  }
}
const _TagSetService = class _TagSetService {
  static getInstance() {
    if (!_TagSetService.instance) {
      _TagSetService.instance = new _TagSetService();
    }
    return _TagSetService.instance;
  }
  read() {
    try {
      const raw = localStorage.getItem(_TagSetService.STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return this.normalize(arr);
      }
    } catch {
    }
    this.write(_TagSetService.DEFAULT_TAGS);
    return [..._TagSetService.DEFAULT_TAGS];
  }
  write(tags) {
    try {
      const unique = this.normalize(tags);
      localStorage.setItem(_TagSetService.STORAGE_KEY, JSON.stringify(unique));
    } catch {
    }
  }
  normalize(tags) {
    const set = /* @__PURE__ */ new Set();
    for (const t of tags) {
      const name = String(t || "").trim();
      if (!name) continue;
      set.add(name);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }
  getAll() {
    return this.read();
  }
  addTag(name) {
    const n = String(name || "").trim();
    if (!n) return false;
    const tags = this.read();
    if (tags.includes(n)) return false;
    tags.push(n);
    this.write(tags);
    return true;
  }
  renameTag(oldName, newName) {
    const src = String(oldName || "").trim();
    const dst = String(newName || "").trim();
    if (!src || !dst || src === dst) return false;
    const tags = this.read();
    const idx = tags.indexOf(src);
    if (idx === -1) return false;
    if (!tags.includes(dst)) {
      tags[idx] = dst;
    } else {
      tags.splice(idx, 1);
    }
    this.write(tags);
    return true;
  }
  deleteTag(name) {
    const n = String(name || "").trim();
    if (!n) return false;
    const tags = this.read();
    const idx = tags.indexOf(n);
    if (idx !== -1) {
      tags.splice(idx, 1);
      this.write(tags);
    }
    return true;
  }
};
_TagSetService.instance = null;
_TagSetService.STORAGE_KEY = "superlora_tagset_v1";
_TagSetService.DEFAULT_TAGS = ["General", "Character", "Style", "Quality", "Effect"];
let TagSetService = _TagSetService;
class OverlayService {
  constructor() {
    this.stylesInjected = false;
  }
  static getInstance() {
    if (!OverlayService.instance) {
      OverlayService.instance = new OverlayService();
    }
    return OverlayService.instance;
  }
  showSearchOverlay(options) {
    this.ensureOverlayStyles();
    const baseFolderKey = options.baseFolderName || "files";
    const restoredState = this.restoreOverlayState(baseFolderKey);
    this.removeExistingOverlays();
    const items = options.items ?? [];
    const overlay = document.createElement("div");
    overlay.setAttribute("data-super-lora-overlay", "1");
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.55);
      z-index: 2147483600;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(2px);
    `;
    const panel = document.createElement("div");
    panel.style.cssText = `
      width: 560px;
      max-height: 70vh;
      background: #222;
      border: 1px solid #444;
      border-radius: 8px;
      box-shadow: 0 12px 30px rgba(0,0,0,0.4);
      color: #fff;
      font-family: 'Segoe UI', Arial, sans-serif;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    `;
    const header = document.createElement("div");
    header.textContent = options.title;
    header.style.cssText = `
      padding: 12px 14px;
      font-weight: 600;
      border-bottom: 1px solid #444;
      background: #2a2a2a;
    `;
    const search = document.createElement("input");
    search.type = "text";
    search.placeholder = options.placeholder;
    search.style.cssText = `
      margin: 10px 12px;
      padding: 10px 12px;
      border-radius: 6px;
      border: 1px solid #555;
      background: #1a1a1a;
      color: #fff;
      outline: none;
    `;
    const multiEnabled = !!options.enableMultiToggle;
    let multiMode = false;
    const selectedIds = /* @__PURE__ */ new Set();
    const ROOT_KEY = "__ROOT__";
    let lastClickedIndex = null;
    let shiftSessionAnchor = null;
    let lastShiftRangeStart = null;
    let lastShiftRangeEnd = null;
    const controls = document.createElement("div");
    controls.style.cssText = `
      display: ${multiEnabled ? "flex" : "none"};
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 0 12px 6px 12px;
      color: #ddd;
      font-size: 12px;
    `;
    const selectionBtnsWrap = document.createElement("div");
    selectionBtnsWrap.style.cssText = `
      display: none;
      gap: 8px;
    `;
    const selectAllBtn = document.createElement("button");
    selectAllBtn.type = "button";
    selectAllBtn.textContent = "Select All";
    selectAllBtn.className = "nd-overlay-select-btn";
    selectAllBtn.addEventListener("click", () => {
      const filtered = getFilteredItems();
      filtered.forEach((item) => {
        if (!item.disabled) {
          selectedIds.add(item.id);
        }
      });
      render(search.value);
    });
    const unselectAllBtn = document.createElement("button");
    unselectAllBtn.type = "button";
    unselectAllBtn.textContent = "Unselect All";
    unselectAllBtn.className = "nd-overlay-select-btn";
    unselectAllBtn.addEventListener("click", () => {
      selectedIds.clear();
      render(search.value);
    });
    selectionBtnsWrap.appendChild(selectAllBtn);
    selectionBtnsWrap.appendChild(unselectAllBtn);
    const rightControls = document.createElement("div");
    rightControls.style.cssText = "display: flex; align-items: center; gap: 10px;";
    const multiLabel = document.createElement("label");
    multiLabel.className = "nd-overlay-multi-toggle";
    const multiToggle = document.createElement("input");
    multiToggle.type = "checkbox";
    multiToggle.className = "nd-overlay-multi-toggle-checkbox";
    multiToggle.addEventListener("change", () => {
      multiMode = !!multiToggle.checked;
      selectionBtnsWrap.style.display = multiMode ? "flex" : "none";
      render(search.value);
      renderFooter();
    });
    const multiText = document.createElement("span");
    multiText.textContent = "Multi-select";
    multiText.className = "nd-overlay-multi-toggle-label";
    multiLabel.appendChild(multiToggle);
    multiLabel.appendChild(multiText);
    rightControls.appendChild(multiLabel);
    controls.appendChild(selectionBtnsWrap);
    controls.appendChild(rightControls);
    const chipWrap = document.createElement("div");
    chipWrap.className = "nd-overlay-chips-container";
    const subChipWrap = document.createElement("div");
    subChipWrap.className = "nd-overlay-subchips-container";
    subChipWrap.style.display = "none";
    let folderFeatureEnabled = false;
    const activeFolders = new Set(restoredState.activeFolders);
    const activeSubfolders = new Set(restoredState.activeSubfolders);
    const listWrap = document.createElement("div");
    listWrap.style.cssText = "overflow: auto; padding: 6px 4px 10px 4px;";
    const list = document.createElement("div");
    list.style.cssText = "display: flex; flex-direction: column; gap: 4px; padding: 0 8px 8px 8px;";
    const empty = document.createElement("div");
    empty.textContent = "No results";
    empty.style.cssText = "padding: 12px; color: #aaa; display: none;";
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        closeOverlay();
      }
    };
    const closeOverlay = () => {
      try {
        overlay.remove();
      } catch {
      }
      document.removeEventListener("keydown", handleKeyDown);
      this.persistOverlayState(baseFolderKey, activeFolders, activeSubfolders);
    };
    document.addEventListener("keydown", handleKeyDown);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closeOverlay();
    });
    const splitSearchTokens = (raw) => (raw || "").trim().toLowerCase().split(/\s+/).filter(Boolean);
    const itemMatchesQuery = (item, tokens) => {
      if (!tokens.length) return true;
      const label = (item.label || "").toLowerCase();
      const path = (item.id || "").toLowerCase();
      const pathAlt = path.replace(/\\/g, "/");
      return tokens.every((token) => label.includes(token) || path.includes(token) || pathAlt.includes(token));
    };
    const getFilteredItems = () => {
      const query = (search.value || "").trim().toLowerCase();
      const tokens = splitSearchTokens(search.value);
      const termFiltered = query ? items.filter((item) => itemMatchesQuery(item, tokens)) : items;
      let filtered = termFiltered;
      if (folderFeatureEnabled && activeFolders.size > 0) {
        filtered = termFiltered.filter((item) => {
          const parts = item.id.split(/[\\/]/);
          const top = parts.length > 1 ? parts[0] : ROOT_KEY;
          return activeFolders.has(top);
        });
        if (activeSubfolders.size > 0) {
          filtered = filtered.filter((item) => {
            const parts = item.id.split(/[\\/]/);
            const top = parts.length > 1 ? parts[0] : "";
            if (!top) return false;
            const sub = parts.length > 2 ? parts[1] : ROOT_KEY;
            const key = `${top}/${sub}`;
            return activeSubfolders.has(key);
          });
        }
      }
      if (options.allowCreate && query) {
        const exact = items.some((item) => item.label.toLowerCase() === query);
        if (!exact) {
          filtered = [{ id: (search.value || "").trim(), label: `Create "${(search.value || "").trim()}"` }, ...filtered];
        }
      }
      return filtered;
    };
    const renderChips = (folderCounts) => {
      chipWrap.innerHTML = "";
      const header2 = document.createElement("div");
      header2.className = "nd-overlay-chip-header";
      header2.textContent = "Folders";
      chipWrap.appendChild(header2);
      const chipList = document.createElement("div");
      chipList.className = "nd-overlay-chip-list";
      chipWrap.appendChild(chipList);
      const allFolderNames = Object.keys(folderCounts).sort((a, b) => {
        if (a === ROOT_KEY) return -1;
        if (b === ROOT_KEY) return 1;
        return a.localeCompare(b);
      });
      const baseFolderName = options.baseFolderName || "files";
      allFolderNames.forEach((name) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "nd-overlay-chip";
        const isActive = activeFolders.has(name);
        if (isActive) chip.classList.add("is-active");
        const icon = document.createElement("span");
        icon.className = "nd-overlay-chip-icon";
        icon.textContent = name === ROOT_KEY ? "𖠿" : "🗁";
        const label = document.createElement("span");
        label.className = "nd-overlay-chip-label";
        label.textContent = name === ROOT_KEY ? `${baseFolderName} (root)` : name;
        const count = document.createElement("span");
        count.className = "nd-overlay-chip-count";
        count.textContent = String(folderCounts[name] ?? 0);
        chip.appendChild(icon);
        chip.appendChild(label);
        chip.appendChild(count);
        chip.title = name === ROOT_KEY ? `${baseFolderName} root` : name;
        chip.addEventListener("click", () => {
          if (activeFolders.has(name)) {
            activeFolders.delete(name);
          } else {
            activeFolders.add(name);
          }
          this.persistOverlayState(baseFolderKey, activeFolders, activeSubfolders);
          render(search.value);
          renderSubChips();
        });
        chipList.appendChild(chip);
      });
    };
    const renderSubChips = () => {
      subChipWrap.innerHTML = "";
      const show = activeFolders.size > 0;
      subChipWrap.style.display = show ? "flex" : "none";
      if (!show) return;
      const subCountsByKey = {};
      const subToTops = {};
      items.forEach((item) => {
        const parts = item.id.split(/[\\/]/);
        const top = parts.length > 1 ? parts[0] : ROOT_KEY;
        if (top === ROOT_KEY) return;
        if (!activeFolders.has(top)) return;
        const sub = parts.length > 2 ? parts[1] : ROOT_KEY;
        if (sub === ROOT_KEY) {
          const key2 = `${top}/${ROOT_KEY}`;
          subCountsByKey[key2] = (subCountsByKey[key2] || 0) + 1;
          if (!subToTops["(root)"]) subToTops["(root)"] = /* @__PURE__ */ new Set();
          subToTops["(root)"].add(top);
          return;
        }
        const key = `${top}/${sub}`;
        subCountsByKey[key] = (subCountsByKey[key] || 0) + 1;
        if (!subToTops[sub]) subToTops[sub] = /* @__PURE__ */ new Set();
        subToTops[sub].add(top);
      });
      const header2 = document.createElement("div");
      header2.className = "nd-overlay-chip-header";
      header2.textContent = activeFolders.size === 1 ? "Subfolders" : "Subfolders (selected)";
      subChipWrap.appendChild(header2);
      const chipList = document.createElement("div");
      chipList.className = "nd-overlay-chip-list";
      subChipWrap.appendChild(chipList);
      Object.keys(subCountsByKey).sort().forEach((key) => {
        const [top, sub] = key.split("/");
        const isRootSub = sub === ROOT_KEY;
        const duplicate = subToTops[sub]?.size && subToTops[sub].size > 1;
        const labelText = isRootSub ? `${top} (root)` : duplicate ? `${top} / ${sub}` : sub;
        const countVal = subCountsByKey[key] ?? 0;
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "nd-overlay-chip nd-overlay-chip--sub";
        const isActive = activeSubfolders.has(key);
        if (isActive) chip.classList.add("is-active");
        const icon = document.createElement("span");
        icon.className = "nd-overlay-chip-icon";
        icon.textContent = isRootSub ? "🗐" : "↳";
        const label = document.createElement("span");
        label.className = "nd-overlay-chip-label";
        label.textContent = labelText;
        const count = document.createElement("span");
        count.className = "nd-overlay-chip-count";
        count.textContent = String(countVal);
        chip.appendChild(icon);
        chip.appendChild(label);
        chip.appendChild(count);
        chip.title = `${top}/${isRootSub ? "(root)" : sub}`;
        chip.addEventListener("click", () => {
          if (activeSubfolders.has(key)) {
            activeSubfolders.delete(key);
          } else {
            activeSubfolders.add(key);
          }
          this.persistOverlayState(baseFolderKey, activeFolders, activeSubfolders);
          render(search.value);
          renderSubChips();
        });
        chipList.appendChild(chip);
      });
    };
    const render = (term) => {
      list.innerHTML = "";
      const query = (term || "").trim().toLowerCase();
      const tokens = splitSearchTokens(term);
      const termFiltered = query ? items.filter((item) => itemMatchesQuery(item, tokens)) : items;
      if (folderFeatureEnabled) {
        const folderCounts = {};
        termFiltered.forEach((item) => {
          const parts = item.id.split(/[\\/]/);
          const top = parts.length > 1 ? parts[0] : ROOT_KEY;
          folderCounts[top] = (folderCounts[top] || 0) + 1;
        });
        renderChips(folderCounts);
      }
      const filtered = getFilteredItems();
      empty.style.display = filtered.length ? "none" : "block";
      try {
        header.textContent = `${options.title} (${filtered.length}/${items.length})`;
      } catch {
      }
      const maxToShow = Math.min(2e3, filtered.length);
      filtered.slice(0, maxToShow).forEach((item, index) => {
        const row = document.createElement("div");
        row.style.cssText = "display: flex; align-items: center; gap: 8px; padding: 0;";
        const leftBtn = document.createElement("button");
        leftBtn.type = "button";
        leftBtn.className = "nd-overlay-item-button";
        leftBtn.disabled = !!item.disabled;
        const rawParts = item.id.split(/[\\/]/);
        const parts = rawParts.filter(Boolean);
        const folderPath = parts.slice(0, -1);
        const lastSegment = parts[parts.length - 1] || item.label;
        const pathDisplay = folderPath.length ? folderPath.join(" / ") : "(root)";
        const isFolder = !/\.[^./\\]{2,}$/i.test(lastSegment);
        const iconGlyph = isFolder ? "🗁" : "🗒";
        leftBtn.title = item.id;
        const checkboxSpan = document.createElement("span");
        checkboxSpan.className = "nd-overlay-item-checkbox";
        checkboxSpan.dataset.state = "hidden";
        const iconSpan = document.createElement("span");
        iconSpan.className = "nd-overlay-item-icon";
        iconSpan.textContent = iconGlyph;
        iconSpan.setAttribute("aria-hidden", "true");
        const textWrap = document.createElement("div");
        textWrap.className = "nd-overlay-item-text";
        const primaryLine = document.createElement("div");
        primaryLine.className = "nd-overlay-item-title";
        primaryLine.textContent = item.label;
        if (item.disabled) {
          const badge = document.createElement("span");
          badge.className = "nd-overlay-item-badge";
          badge.textContent = "added";
          primaryLine.appendChild(badge);
        }
        const secondaryLine = document.createElement("div");
        secondaryLine.className = "nd-overlay-item-path";
        secondaryLine.textContent = pathDisplay;
        secondaryLine.style.display = folderPath.length ? "block" : "none";
        textWrap.appendChild(primaryLine);
        textWrap.appendChild(secondaryLine);
        leftBtn.appendChild(checkboxSpan);
        leftBtn.appendChild(iconSpan);
        leftBtn.appendChild(textWrap);
        const applyState = () => {
          const isSelected = selectedIds.has(item.id);
          if (!multiMode) {
            checkboxSpan.dataset.state = "hidden";
          } else {
            checkboxSpan.dataset.state = isSelected ? "checked" : "unchecked";
          }
          leftBtn.classList.toggle("is-disabled", !!item.disabled);
          leftBtn.classList.toggle("is-selected", multiMode && isSelected);
        };
        applyState();
        leftBtn.addEventListener("click", (event) => {
          if (item.disabled) return;
          if (!multiMode) {
            options.onChoose(item.id);
            closeOverlay();
            return;
          }
          if (event.shiftKey && lastClickedIndex !== null && lastClickedIndex !== index) {
            const displayedItems = filtered.slice(0, maxToShow);
            if (shiftSessionAnchor !== null && lastShiftRangeStart !== null && lastShiftRangeEnd !== null) {
              for (let i = lastShiftRangeStart; i <= lastShiftRangeEnd; i++) {
                if (displayedItems[i] && !displayedItems[i].disabled) {
                  selectedIds.delete(displayedItems[i].id);
                }
              }
            }
            if (shiftSessionAnchor === null) {
              shiftSessionAnchor = lastClickedIndex;
            }
            const start = Math.min(shiftSessionAnchor, index);
            const end = Math.max(shiftSessionAnchor, index);
            for (let i = start; i <= end; i++) {
              if (displayedItems[i] && !displayedItems[i].disabled) {
                selectedIds.add(displayedItems[i].id);
              }
            }
            lastShiftRangeStart = start;
            lastShiftRangeEnd = end;
            render(search.value);
          } else {
            shiftSessionAnchor = null;
            lastShiftRangeStart = null;
            lastShiftRangeEnd = null;
            if (selectedIds.has(item.id)) {
              selectedIds.delete(item.id);
            } else {
              selectedIds.add(item.id);
            }
            applyState();
            renderFooter();
          }
          lastClickedIndex = index;
        });
        row.appendChild(leftBtn);
        const actions = [];
        if (options.rightActions && options.rightActions.length) {
          actions.push(...options.rightActions);
        } else if (options.onRightAction) {
          actions.push({ icon: options.rightActionIcon || "✖︎", title: options.rightActionTitle, onClick: options.onRightAction });
        }
        if (actions.length && !item.disabled) {
          actions.forEach((action) => {
            const rightBtn = document.createElement("button");
            rightBtn.type = "button";
            rightBtn.textContent = action.icon;
            if (action.title) rightBtn.title = action.title;
            rightBtn.style.cssText = `
              margin-left: 8px;
              padding: 10px 12px;
              background: #3a2a2a;
              color: #fff;
              border: 1px solid #5a3a3a;
              border-radius: 6px;
              cursor: pointer;
            `;
            rightBtn.addEventListener("click", (event) => {
              event.stopPropagation();
              event.preventDefault();
              action.onClick(item.id);
            });
            row.appendChild(rightBtn);
          });
        }
        list.appendChild(row);
      });
      renderFooter();
    };
    const footer = document.createElement("div");
    footer.style.cssText = `
      display: none;
      padding: 10px 12px;
      border-top: 1px solid #444;
      background: #1e1e1e;
      gap: 8px;
      justify-content: flex-end;
    `;
    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.textContent = "Clear";
    clearBtn.style.cssText = "padding: 8px 12px; border-radius: 6px; background: #333; color: #fff; border: 1px solid #555; cursor: pointer;";
    clearBtn.addEventListener("click", () => {
      selectedIds.clear();
      render(search.value);
    });
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.cssText = "padding: 8px 12px; border-radius: 6px; background: #444; color: #fff; border: 1px solid #555; cursor: pointer;";
    cancelBtn.addEventListener("click", () => closeOverlay());
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.textContent = "Add Selected (0)";
    addBtn.style.cssText = "padding: 8px 12px; border-radius: 6px; background: #1976d2; color: #fff; border: 1px solid #0d47a1; cursor: pointer; opacity: 0.6;";
    addBtn.disabled = true;
    addBtn.addEventListener("click", () => {
      if (!multiMode) return;
      const ids = Array.from(selectedIds);
      if (!ids.length) return;
      if (typeof options.onChooseMany === "function") {
        options.onChooseMany(ids);
      } else {
        ids.forEach((id) => options.onChoose(id));
      }
      closeOverlay();
    });
    footer.appendChild(clearBtn);
    footer.appendChild(cancelBtn);
    footer.appendChild(addBtn);
    const renderFooter = () => {
      const count = selectedIds.size;
      addBtn.textContent = `Add Selected (${count})`;
      addBtn.disabled = count === 0;
      addBtn.style.opacity = count === 0 ? "0.6" : "1";
      footer.style.display = multiEnabled && multiMode ? "flex" : "none";
    };
    listWrap.appendChild(empty);
    listWrap.appendChild(list);
    panel.appendChild(header);
    panel.appendChild(search);
    panel.appendChild(controls);
    const allowFolderChips = Array.isArray(options.folderChips) && options.folderChips.length > 0 || items.some((item) => /[\\/]/.test(item.id));
    if (allowFolderChips) {
      const initialCounts = {};
      items.forEach((item) => {
        const parts = item.id.split(/[\\/]/);
        const top = parts.length > 1 ? parts[0] : ROOT_KEY;
        initialCounts[top] = (initialCounts[top] || 0) + 1;
      });
      if (Object.keys(initialCounts).length) {
        folderFeatureEnabled = true;
        renderChips(initialCounts);
        panel.appendChild(chipWrap);
        panel.appendChild(subChipWrap);
        renderSubChips();
      }
    }
    panel.appendChild(listWrap);
    panel.appendChild(footer);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    search.addEventListener("input", () => render(search.value));
    setTimeout(() => {
      try {
        search.focus();
      } catch {
      }
      render("");
      renderFooter();
    }, 0);
  }
  showToast(message, type = "info") {
    console.log(`Super LoRA Loader [${type}]: ${message}`);
    const colors = {
      success: "#28a745",
      warning: "#ffc107",
      error: "#dc3545",
      info: "#17a2b8"
    };
    const toast = document.createElement("div");
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${colors[type]};
      color: white;
      padding: 14px 20px;
      border-radius: 6px;
      z-index: 10000;
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      opacity: 0;
      transition: all 0.3s ease;
      max-width: 400px;
      word-wrap: break-word;
      border-left: 4px solid rgba(255,255,255,0.3);
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => {
      toast.style.opacity = "1";
      toast.style.transform = "translateY(0)";
    });
    const timeout = type === "error" ? 5e3 : 3e3;
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-10px)";
      setTimeout(() => {
        try {
          toast.remove();
        } catch {
        }
      }, 300);
    }, timeout);
  }
  ensureOverlayStyles() {
    if (this.stylesInjected) return;
    try {
      if (typeof document === "undefined") return;
      const existing = document.querySelector('style[data-super-lora-overlay-style="1"]');
      if (existing) {
        this.stylesInjected = true;
        return;
      }
      const style = document.createElement("style");
      style.setAttribute("data-super-lora-overlay-style", "1");
      style.textContent = `
        [data-super-lora-overlay="1"] .nd-overlay-item-button {
          position: relative;
          width: 100%;
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 8px 10px;
          background: #252525;
          border: 1px solid #3a3a3a;
          border-radius: 6px;
          color: #fff;
          cursor: pointer;
          text-align: left;
          transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
        }
        [data-super-lora-overlay="1"] .nd-overlay-item-button:hover:not(.is-disabled) {
          background: #2c2c2c;
          border-color: #4a4a4a;
        }
        [data-super-lora-overlay="1"] .nd-overlay-item-button.is-disabled {
          background: #2a2a2a;
          color: #888;
          cursor: not-allowed;
          border-color: #343434;
        }
        [data-super-lora-overlay="1"] .nd-overlay-item-button.is-selected {
          background: #263238;
          border-color: #4a90e2;
          box-shadow: inset 0 0 0 1px rgba(74, 144, 226, 0.35);
        }
        [data-super-lora-overlay="1"] .nd-overlay-item-checkbox {
          width: 16px;
          height: 16px;
          min-width: 16px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #4a4a4a;
          border-radius: 4px;
          background: #1d1d1d;
          color: #8ab4f8;
          font-size: 12px;
          line-height: 1;
          transition: border-color 0.15s ease, background 0.15s ease;
        }
        [data-super-lora-overlay="1"] .nd-overlay-item-checkbox[data-state="hidden"] {
          opacity: 0;
          visibility: hidden;
        }
        [data-super-lora-overlay="1"] .nd-overlay-item-checkbox[data-state="unchecked"]::after {
          content: '';
        }
        [data-super-lora-overlay="1"] .nd-overlay-item-checkbox[data-state="checked"] {
          border-color: #4a90e2;
          background: rgba(74, 144, 226, 0.18);
        }
        [data-super-lora-overlay="1"] .nd-overlay-item-checkbox[data-state="checked"]::after {
          content: '✔';
        }
        [data-super-lora-overlay="1"] .nd-overlay-item-checkbox::after {
          font-size: 10px;
          color: #8ab4f8;
        }
        [data-super-lora-overlay="1"] .nd-overlay-item-icon {
          font-size: 16px;
          line-height: 1.5;
          opacity: 0.85;
          min-width: 18px;
        }
        [data-super-lora-overlay="1"] .nd-overlay-item-text {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
          overflow: hidden;
        }
        [data-super-lora-overlay="1"] .nd-overlay-item-title {
          font-size: 14px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        [data-super-lora-overlay="1"] .nd-overlay-item-path {
          font-size: 12px;
          color: #9aa4b4;
          opacity: 0.85;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        [data-super-lora-overlay="1"] .nd-overlay-item-badge {
          font-size: 11px;
          color: #9aa4b4;
          border: 1px solid #4a4f55;
          border-radius: 999px;
          padding: 1px 6px;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }
        [data-super-lora-overlay="1"] .nd-overlay-chips-container,
        [data-super-lora-overlay="1"] .nd-overlay-subchips-container {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 0 12px 6px 12px;
        }
        [data-super-lora-overlay="1"] .nd-overlay-chip-header {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #9aa4b4;
        }
        [data-super-lora-overlay="1"] .nd-overlay-chip-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        [data-super-lora-overlay="1"] .nd-overlay-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid #3a3a3a;
          background: #252525;
          color: #fff;
          cursor: pointer;
          font-size: 12px;
          transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
        }
        [data-super-lora-overlay="1"] .nd-overlay-chip.is-active {
          border-color: #4a90e2;
          background: rgba(74, 144, 226, 0.18);
          box-shadow: inset 0 0 0 1px rgba(74, 144, 226, 0.35);
        }
        [data-super-lora-overlay="1"] .nd-overlay-chip-icon {
          font-size: 14px;
          opacity: 0.85;
        }
        [data-super-lora-overlay="1"] .nd-overlay-chip-label {
          font-weight: 500;
        }
        [data-super-lora-overlay="1"] .nd-overlay-chip-count {
          font-size: 11px;
          background: rgba(255, 255, 255, 0.08);
          padding: 0 6px;
          border-radius: 999px;
        }
        [data-super-lora-overlay="1"] .nd-overlay-chip--sub {
          font-size: 11px;
          padding: 5px 9px;
          background: #1f1f1f;
        }
        [data-super-lora-overlay="1"] .nd-overlay-chip--sub.is-active {
          background: rgba(255, 255, 255, 0.06);
          border-color: #66aaff;
        }
        [data-super-lora-overlay="1"] .nd-overlay-multi-toggle {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 4px 8px;
          border-radius: 999px;
          border: 1px solid #3a3a3a;
          background: #1f1f1f;
          color: #fff;
          font-size: 12px;
          cursor: pointer;
          user-select: none;
        }
        [data-super-lora-overlay="1"] .nd-overlay-multi-toggle-checkbox {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 4px;
          border: 1px solid #4a4a4a;
          background: #111;
          position: relative;
          cursor: pointer;
          transition: border-color 0.15s ease, background 0.15s ease;
        }
        [data-super-lora-overlay="1"] .nd-overlay-multi-toggle-checkbox:checked {
          border-color: #4a90e2;
          background: rgba(74, 144, 226, 0.2);
        }
        [data-super-lora-overlay="1"] .nd-overlay-multi-toggle-checkbox:checked::after {
          content: '✔';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -55%);
          font-size: 10px;
          color: #8ab4f8;
        }
        [data-super-lora-overlay="1"] .nd-overlay-multi-toggle-label {
          font-weight: 500;
          letter-spacing: 0.01em;
        }
        [data-super-lora-overlay="1"] .nd-overlay-select-btn {
          padding: 4px 10px;
          border-radius: 6px;
          border: 1px solid #4a4a4a;
          background: #2a2a2a;
          color: #fff;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.15s ease, border-color 0.15s ease;
        }
        [data-super-lora-overlay="1"] .nd-overlay-select-btn:hover {
          background: #333;
          border-color: #5a5a5a;
        }
      `;
      document.head.appendChild(style);
      this.stylesInjected = true;
    } catch {
    }
  }
  removeExistingOverlays() {
    try {
      document.querySelectorAll('[data-super-lora-overlay="1"]').forEach((el) => el.remove());
    } catch {
    }
  }
  restoreOverlayState(baseFolderKey) {
    try {
      const folderRaw = sessionStorage.getItem(this.getFolderStorageKey(baseFolderKey));
      const subRaw = sessionStorage.getItem(this.getSubfolderStorageKey(baseFolderKey));
      const activeFolders = folderRaw ? JSON.parse(folderRaw) : [];
      const activeSubfolders = subRaw ? JSON.parse(subRaw) : [];
      return {
        activeFolders: Array.isArray(activeFolders) ? activeFolders : [],
        activeSubfolders: Array.isArray(activeSubfolders) ? activeSubfolders : []
      };
    } catch {
      return { activeFolders: [], activeSubfolders: [] };
    }
  }
  persistOverlayState(baseFolderKey, folders, subfolders) {
    try {
      sessionStorage.setItem(this.getFolderStorageKey(baseFolderKey), JSON.stringify(Array.from(folders)));
      sessionStorage.setItem(this.getSubfolderStorageKey(baseFolderKey), JSON.stringify(Array.from(subfolders)));
    } catch {
    }
  }
  getFolderStorageKey(baseFolderKey) {
    const suffix = baseFolderKey ? `_${baseFolderKey}` : "";
    return `superlora_folder_filters${suffix}`;
  }
  getSubfolderStorageKey(baseFolderKey) {
    const suffix = baseFolderKey ? `_${baseFolderKey}` : "";
    return `superlora_subfolder_filters${suffix}`;
  }
}
class UpdateService {
  constructor() {
    this.status = null;
    this.checkingPromise = null;
    this.lastNotifiedVersion = null;
  }
  static getInstance() {
    if (!UpdateService.instance) {
      UpdateService.instance = new UpdateService();
    }
    return UpdateService.instance;
  }
  getStatus() {
    return this.status;
  }
  async initialize() {
    try {
      const status = await this.checkForUpdates({ silent: true });
      this.maybeNotify(status);
    } catch (error) {
      console.warn("ND Super Nodes: update check failed to initialize", error);
    }
  }
  async checkForUpdates(options = {}) {
    const { force = false, silent = false } = options;
    if (this.checkingPromise) {
      return this.checkingPromise;
    }
    if (!force && this.status) {
      if (!silent) {
        this.maybeNotify(this.status, { showUpToDate: true });
      }
      return this.status;
    }
    this.checkingPromise = this.fetchStatus(force).then((status) => {
      this.status = status;
      if (!silent) {
        this.maybeNotify(status, { showUpToDate: true });
      } else {
        this.maybeNotify(status);
      }
      return status;
    }).catch((error) => {
      console.warn("ND Super Nodes: update check failed", error);
      if (!silent) {
        OverlayService.getInstance().showToast("ND Super Nodes update check failed. See console for details.", "warning");
      }
      throw error;
    }).finally(() => {
      this.checkingPromise = null;
    });
    return this.checkingPromise;
  }
  openReleasePage() {
    const url = this.status?.releaseUrl || "https://github.com/HenkDz/nd-super-nodes/releases/latest";
    try {
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      OverlayService.getInstance().showToast("Unable to open release page. Copy URL from console.", "warning");
      console.warn("ND Super Nodes release URL:", url, error);
    }
  }
  async fetchStatus(force) {
    const url = force ? "/super_lora/version?force=1" : "/super_lora/version";
    const response = await fetch(url, { cache: force ? "reload" : "no-store" });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }
    const payload = await response.json();
    return payload;
  }
  maybeNotify(status, options = {}) {
    if (!status) {
      return;
    }
    const latestVersion = status.latestVersion || status.localVersion?.version;
    const alreadyNotified = latestVersion && latestVersion === this.lastNotifiedVersion;
    if (status.hasUpdate) {
      if (alreadyNotified) {
        return;
      }
      this.lastNotifiedVersion = latestVersion || null;
      const messageParts = [
        `⚡︎ ND Super Nodes v${latestVersion} available`,
        "Run update.ps1 / update.sh in your node folder to upgrade."
      ];
      OverlayService.getInstance().showToast(messageParts.join("\n"), "info");
      console.info("ND Super Nodes: Update available", status);
      return;
    }
    if (options.showUpToDate && !alreadyNotified) {
      this.lastNotifiedVersion = latestVersion || null;
      OverlayService.getInstance().showToast("ND Super Nodes is up to date.", "success");
    }
  }
}
const _FilePickerService = class _FilePickerService {
  constructor() {
    this.fileCache = /* @__PURE__ */ new Map();
    this.cacheTimestamps = /* @__PURE__ */ new Map();
    this.lastRefreshTimestamp = 0;
    this.pendingLoraRefresh = null;
    this.handleGlobalKeyDown = (event) => {
      if (!this.isRefreshHotkey(event)) {
        return;
      }
      this.onExternalRefresh("hotkey:R");
    };
    this.handleManualRefreshEvent = () => {
      this.onExternalRefresh("event:nd-super-nodes:refresh-files");
    };
    if (typeof window === "undefined") {
      return;
    }
    this.setupGlobalRefreshListeners();
  }
  static getInstance() {
    if (!_FilePickerService.instance) {
      _FilePickerService.instance = new _FilePickerService();
    }
    return _FilePickerService.instance;
  }
  setupGlobalRefreshListeners() {
    try {
      if (typeof document !== "undefined" && document.addEventListener) {
        document.addEventListener("keydown", this.handleGlobalKeyDown, true);
      }
      window.addEventListener("nd-super-nodes:refresh-files", this.handleManualRefreshEvent);
    } catch (error) {
      console.warn("ND Super Nodes: failed to attach refresh listeners", error);
    }
    this.tryHookComfyRefreshFunctions();
  }
  tryHookComfyRefreshFunctions(attempt = 0) {
    const hooked = this.patchRefreshFunctions(window?.app, "app") || this.patchRefreshFunctions(window?.api, "api") || this.patchRefreshFunctions(window?.ui, "ui");
    if (hooked || attempt >= 20) {
      return;
    }
    setTimeout(() => this.tryHookComfyRefreshFunctions(attempt + 1), 250 * Math.max(1, attempt + 1));
  }
  patchRefreshFunctions(source, sourceName) {
    if (!source || typeof source !== "object") {
      return false;
    }
    const marker = "__ndSuperNodesRefreshWrapped";
    const service = this;
    const seen = /* @__PURE__ */ new Set();
    let hookedAny = false;
    let cursor = source;
    while (cursor && cursor !== Object.prototype && cursor !== Function.prototype) {
      const keys = Object.getOwnPropertyNames(cursor);
      for (const key of keys) {
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        if (!/refresh/i.test(key) || key === marker) {
          continue;
        }
        const original = source[key];
        if (typeof original !== "function" || original[marker]) {
          continue;
        }
        const wrapped = function(...args) {
          try {
            service.onExternalRefresh(`${sourceName}.${key}`);
          } catch (error) {
            console.warn("ND Super Nodes: refresh hook error", error);
          }
          return original.apply(this, args);
        };
        wrapped[marker] = true;
        const descriptor = Object.getOwnPropertyDescriptor(source, key);
        if (descriptor && "value" in descriptor) {
          Object.defineProperty(source, key, {
            ...descriptor,
            value: wrapped
          });
        } else {
          source[key] = wrapped;
        }
        hookedAny = true;
      }
      cursor = Object.getPrototypeOf(cursor);
    }
    return hookedAny;
  }
  isRefreshHotkey(event) {
    if (!event || event.repeat) {
      return false;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return false;
    }
    const key = event.key?.toLowerCase();
    if (key !== "r") {
      return false;
    }
    const target = event.target;
    if (this.isInteractiveElement(target)) {
      return false;
    }
    return true;
  }
  isInteractiveElement(target) {
    if (!target || typeof window === "undefined") {
      return false;
    }
    if (target instanceof HTMLElement) {
      if (target.isContentEditable) {
        return true;
      }
      const interactiveTags = ["INPUT", "TEXTAREA", "SELECT"];
      if (interactiveTags.includes(target.tagName)) {
        return true;
      }
      const role = target.getAttribute?.("role");
      if (role && ["textbox", "combobox", "searchbox"].includes(role)) {
        return true;
      }
    }
    return false;
  }
  onExternalRefresh(trigger) {
    const now = Date.now();
    if (now - this.lastRefreshTimestamp < _FilePickerService.REFRESH_DEBOUNCE_MS) {
      return;
    }
    this.lastRefreshTimestamp = now;
    this.clearCache();
    this.triggerLinkedServiceRefresh();
    try {
      window.dispatchEvent(new CustomEvent("nd-super-nodes:files-refreshed", { detail: { trigger } }));
    } catch (error) {
    }
  }
  triggerLinkedServiceRefresh() {
    try {
      const loraService = LoraService.getInstance();
      if (!loraService || typeof loraService.refreshLoraList !== "function") {
        return;
      }
      if (this.pendingLoraRefresh) {
        return;
      }
      this.pendingLoraRefresh = Promise.resolve(loraService.refreshLoraList()).catch((error) => {
        console.warn("ND Super Nodes: Failed to refresh LoRA list after global refresh", error);
      }).finally(() => {
        this.pendingLoraRefresh = null;
      });
    } catch (error) {
      console.warn("ND Super Nodes: LoRA refresh hook failed", error);
    }
  }
  static getSupportedFileTypes() {
    return this.FILE_TYPES;
  }
  /**
   * Get files for a specific file type
   */
  async getFilesForType(fileType) {
    const config = _FilePickerService.FILE_TYPES[fileType];
    if (!config) {
      throw new Error(`Unknown file type: ${fileType}`);
    }
    const cacheKey = `files_${fileType}`;
    const cached = this.getCachedFiles(cacheKey);
    if (cached) {
      return cached;
    }
    try {
      const params = new URLSearchParams();
      params.set("folder_name", config.folderName);
      params.set("extensions", config.fileExtensions.join(","));
      let response = await fetch(`/super_lora/files?${params.toString()}`, { method: "GET" });
      if (!response.ok) {
        response = await fetch(`/superlora/files?${params.toString()}`, { method: "GET" });
      }
      if (!response.ok) {
        throw new Error(`Failed to fetch files: ${response.statusText}`);
      }
      const data = await response.json();
      const files = data.files?.map((file) => {
        const relativePath = file.relative_path || file.path;
        const rawValue = typeof file.value === "string" && file.value ? file.value : relativePath;
        return {
          id: rawValue,
          label: file.name.replace(/\.(ckpt|pt|pt2|bin|pth|safetensors|pkl|sft|gguf)$/i, ""),
          path: relativePath,
          fullPath: file.path,
          filename: file.name,
          extension: file.extension || "",
          size: file.size,
          modified: file.modified
        };
      }) || [];
      this.setCachedFiles(cacheKey, files);
      return files;
    } catch (error) {
      console.error(`Error fetching ${fileType} files:`, error);
      return [];
    }
  }
  /**
   * Show enhanced file picker overlay
   */
  showFilePicker(fileType, onSelect, options = {}) {
    const config = _FilePickerService.FILE_TYPES[fileType];
    if (!config) {
      throw new Error(`Unknown file type: ${fileType}`);
    }
    const {
      title = `Select ${config.displayName}`,
      multiSelect = false,
      onMultiSelect,
      currentValue
    } = options;
    this.getFilesForType(fileType).then((files) => {
      const items = files.map((file) => ({
        id: file.id,
        label: file.label,
        disabled: currentValue === file.id
      }));
      const overlay = OverlayService.getInstance();
      const topFolders = Array.from(new Set(
        files.map((file) => {
          const rel = file.path || "";
          const parts = rel.split(/[\\/]/);
          return parts.length > 1 ? parts[0] : "__ROOT__";
        })
      ));
      overlay.showSearchOverlay({
        title,
        placeholder: config.placeholder || `Search ${config.displayName.toLowerCase()}...`,
        items,
        allowCreate: false,
        enableMultiToggle: multiSelect,
        onChoose: (id) => {
          const file = files.find((f) => f.id === id);
          if (file) {
            onSelect(file);
          }
        },
        onChooseMany: onMultiSelect ? (ids) => {
          const selectedFiles = ids.map((id) => files.find((f) => f.id === id)).filter(Boolean);
          if (onMultiSelect && selectedFiles.length > 0) {
            onMultiSelect(selectedFiles);
          }
        } : void 0,
        folderChips: topFolders,
        baseFolderName: config.folderName,
        currentValue,
        rightActions: []
      });
    }).catch((error) => {
      console.error("Failed to load file picker:", error);
      OverlayService.getInstance().showToast(`Failed to load ${config.displayName.toLowerCase()}`, "error");
    });
  }
  /**
   * Cache management
   */
  getCachedFiles(key) {
    const cacheTime = this.cacheTimestamps.get(key);
    if (!cacheTime) return null;
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1e3;
    if (cacheTime < fiveMinutesAgo) {
      this.fileCache.delete(key);
      this.cacheTimestamps.delete(key);
      return null;
    }
    return this.fileCache.get(key) || null;
  }
  setCachedFiles(key, files) {
    this.fileCache.set(key, files);
    this.cacheTimestamps.set(key, Date.now());
  }
  /**
   * Clear all caches
   */
  clearCache() {
    this.fileCache.clear();
    this.cacheTimestamps.clear();
  }
  /**
   * Refresh cache for specific file type
   */
  async refreshFileType(fileType) {
    const cacheKey = `files_${fileType}`;
    this.fileCache.delete(cacheKey);
    this.cacheTimestamps.delete(cacheKey);
    await this.getFilesForType(fileType);
  }
};
_FilePickerService.REFRESH_DEBOUNCE_MS = 400;
_FilePickerService.FILE_TYPES = {
  models: {
    folderName: "checkpoints",
    displayName: "Models",
    fileExtensions: [".ckpt", ".pt", ".pt2", ".bin", ".pth", ".safetensors", ".pkl", ".sft"],
    icon: "⛘",
    placeholder: "Search models..."
  },
  vae: {
    folderName: "vae",
    displayName: "VAEs",
    fileExtensions: [".ckpt", ".pt", ".pt2", ".bin", ".pth", ".safetensors", ".pkl", ".sft"],
    icon: "⎚",
    placeholder: "Search VAEs..."
  },
  loras: {
    folderName: "loras",
    displayName: "LoRAs",
    fileExtensions: [".ckpt", ".pt", ".pt2", ".bin", ".pth", ".safetensors", ".pkl", ".sft"],
    icon: "❖",
    placeholder: "Search LoRAs..."
  },
  text_encoders: {
    folderName: "text_encoders",
    displayName: "Text Encoders",
    fileExtensions: [".ckpt", ".pt", ".pt2", ".bin", ".pth", ".safetensors", ".pkl", ".sft"],
    icon: "✍︎",
    placeholder: "Search text encoders..."
  },
  diffusion_models: {
    folderName: "diffusion_models",
    displayName: "Diffusion Models",
    fileExtensions: [".ckpt", ".pt", ".pt2", ".bin", ".pth", ".safetensors", ".pkl", ".sft"],
    icon: "⬡",
    placeholder: "Search diffusion models..."
  },
  gguf_unet_models: {
    folderName: "unet",
    displayName: "UNET GGUF Models",
    fileExtensions: [".gguf"],
    icon: "⬡",
    placeholder: "Search GGUF UNET models..."
  },
  controlnet: {
    folderName: "controlnet",
    displayName: "ControlNets",
    fileExtensions: [".ckpt", ".pt", ".pt2", ".bin", ".pth", ".safetensors", ".pkl", ".sft"],
    icon: "⚙︎",
    placeholder: "Search ControlNets..."
  },
  upscale_models: {
    folderName: "upscale_models",
    displayName: "Upscale Models",
    fileExtensions: [".ckpt", ".pt", ".pt2", ".bin", ".pth", ".safetensors", ".pkl", ".sft"],
    icon: "🔍︎",
    placeholder: "Search upscale models..."
  }
};
let FilePickerService = _FilePickerService;
class SuperLoraBaseWidget {
  constructor(name) {
    this.name = name;
    this.type = "custom";
    this.value = {};
    this.hitAreas = {};
  }
  draw(_ctx, _node, _w, _posY, _height) {
  }
  onMouseDown(event, pos, node) {
    return this.handleHitAreas(event, pos, node, "onDown");
  }
  onClick(event, pos, node) {
    return this.handleHitAreas(event, pos, node, "onClick");
  }
  handleHitAreas(event, pos, node, handler) {
    const entries = Object.entries(this.hitAreas);
    entries.sort((a, b) => {
      const pa = a[1]?.priority || 0;
      const pb = b[1]?.priority || 0;
      return pb - pa;
    });
    for (const [key, area] of entries) {
      const bounds = area.bounds;
      if (bounds && bounds.length >= 4 && this.isInBounds(pos, bounds)) {
        const fn = handler === "onDown" ? area.onDown : area.onClick;
        if (fn) {
          return fn.call(this, event, pos, node);
        }
      }
    }
    return false;
  }
  isInBounds(pos, bounds) {
    if (bounds.length < 4) return false;
    const [x, y, width, height] = bounds;
    return pos[0] >= x && pos[0] <= x + width && pos[1] >= y && pos[1] <= y + height;
  }
  computeSize() {
    return [200, 25];
  }
}
const WidgetAPI$1 = {
  showLoraSelector: () => {
    throw new Error("WidgetAPI.showLoraSelector not initialized");
  },
  showTagSelector: () => {
    throw new Error("WidgetAPI.showTagSelector not initialized");
  },
  showSettingsDialog: () => {
    throw new Error("WidgetAPI.showSettingsDialog not initialized");
  },
  showLoadTemplateDialog: () => {
    throw new Error("WidgetAPI.showLoadTemplateDialog not initialized");
  },
  showNameOverlay: () => {
    throw new Error("WidgetAPI.showNameOverlay not initialized");
  },
  showInlineText: () => {
    throw new Error("WidgetAPI.showInlineText not initialized");
  },
  showToast: () => {
    throw new Error("WidgetAPI.showToast not initialized");
  },
  calculateNodeSize: () => {
    throw new Error("WidgetAPI.calculateNodeSize not initialized");
  },
  organizeByTags: () => {
    throw new Error("WidgetAPI.organizeByTags not initialized");
  },
  addLoraWidget: () => {
    throw new Error("WidgetAPI.addLoraWidget not initialized");
  },
  removeLoraWidget: () => {
    throw new Error("WidgetAPI.removeLoraWidget not initialized");
  },
  getLoraConfigs: () => {
    throw new Error("WidgetAPI.getLoraConfigs not initialized");
  },
  syncExecutionWidgets: () => {
    throw new Error("WidgetAPI.syncExecutionWidgets not initialized");
  },
  templateService: null,
  civitaiService: null
};
function setWidgetAPI(api) {
  Object.assign(WidgetAPI$1, api);
}
const STORAGE_KEY = "super_lora_manual_triggers_v1";
function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}
function writeStore(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
  }
}
const TriggerWordStore = {
  get(loraFileName) {
    if (!loraFileName) return null;
    const map = readStore();
    const val = map[loraFileName];
    return typeof val === "string" && val.trim().length ? val : null;
  },
  set(loraFileName, triggerWords) {
    if (!loraFileName) return;
    const map = readStore();
    if (typeof triggerWords === "string" && triggerWords.trim().length) {
      map[loraFileName] = triggerWords.trim();
    } else {
      delete map[loraFileName];
    }
    writeStore(map);
  },
  remove(loraFileName) {
    if (!loraFileName) return;
    const map = readStore();
    if (map[loraFileName] !== void 0) {
      delete map[loraFileName];
      writeStore(map);
    }
  }
};
class SuperLoraTagWidget extends SuperLoraBaseWidget {
  constructor(tag) {
    super(`tag_${tag}`);
    this.tag = tag;
    this.onCollapseDown = (_event, _pos, node) => {
      this.value.collapsed = !this.value.collapsed;
      WidgetAPI$1.calculateNodeSize(node);
      node.setDirtyCanvas(true, false);
      return true;
    };
    this.onToggleDown = (_event, _pos, node) => {
      this.value.bypassed = !this.value.bypassed;
      node.setDirtyCanvas(true, true);
      try {
        WidgetAPI$1.syncExecutionWidgets(node);
      } catch {
      }
      return true;
    };
    this.value = { type: "SuperLoraTagWidget", tag, collapsed: false, bypassed: false };
    this.hitAreas = {
      toggle: { bounds: [0, 0], onDown: this.onToggleDown, priority: 10 },
      collapse: { bounds: [0, 0], onDown: this.onCollapseDown, priority: 0 }
    };
  }
  draw(ctx, node, w, posY, height) {
    const margin = 10;
    let posX = margin;
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
    ctx.fillRect(0, posY, w, height);
    ctx.beginPath();
    ctx.moveTo(0, posY + 0.5);
    ctx.lineTo(w, posY + 0.5);
    ctx.moveTo(0, posY + height - 0.5);
    ctx.lineTo(w, posY + height - 0.5);
    const midY = height / 2;
    const lorasInTag = this.getLorasInTag(node);
    const allEnabled = !this.value.bypassed;
    ctx.save();
    if (!allEnabled) {
      ctx.globalAlpha *= 0.4;
    }
    ctx.fillStyle = "#fff";
    ctx.font = "12px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(this.value.collapsed ? "▶" : "▼", posX, posY + midY);
    posX += 20;
    ctx.fillStyle = "#fff";
    ctx.fillText(`${this.tag} (${lorasInTag.length})`, posX, posY + midY);
    ctx.restore();
    const switchW = 28;
    const switchH = 14;
    const switchX = w - margin - switchW;
    const switchY = posY + (height - switchH) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(switchX, switchY, switchW, switchH, switchH / 2);
    ctx.fillStyle = allEnabled ? "#33789A" : "rgba(255,255,255,0.06)";
    ctx.fill();
    ctx.strokeStyle = allEnabled ? "#33789A" : "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    const knobR = switchH / 2 - 1.5;
    const knobX = allEnabled ? switchX + switchW - switchH / 2 : switchX + switchH / 2;
    const knobY = switchY + switchH / 2;
    ctx.arc(knobX, knobY, knobR, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.restore();
    this.hitAreas.toggle.bounds = [switchX - 4, 0, switchW + 8, height];
    this.hitAreas.collapse.bounds = [0, 0, switchX - 8, height];
    ctx.restore();
  }
  getLorasInTag(node) {
    if (!node.customWidgets) return [];
    return node.customWidgets.filter(
      (w) => w instanceof SuperLoraWidget && w.value.tag === this.tag
    );
  }
  computeSize() {
    return [400, 25];
  }
  isCollapsed() {
    return this.value.collapsed;
  }
}
class SuperLoraWidget extends SuperLoraBaseWidget {
  constructor(name) {
    super(name);
    this.onEnabledDown = (_event, _pos, node) => {
      this.value.enabled = !this.value.enabled;
      node.setDirtyCanvas(true, false);
      try {
        WidgetAPI$1.syncExecutionWidgets(node);
      } catch {
      }
      return true;
    };
    this.onLoraClick = (event, _pos, node) => {
      if (!this.value?.lora || this.value.lora === "None") {
        WidgetAPI$1.showLoraSelector(node, this, event);
      } else {
        openLoraSettingsDrawer(this, node);
      }
      return true;
    };
    this.onStrengthClick = (event, _pos, node) => {
      try {
        const app2 = window?.app;
        const canvas = app2?.canvas;
        if (canvas?.prompt) {
          canvas.prompt("Model Strength", this.value.strength ?? 1, (v) => {
            const val = parseFloat(v);
            if (!Number.isNaN(val)) {
              this.value.strength = Math.max(-10, Math.min(10, val));
              node.setDirtyCanvas(true, true);
            }
          }, event);
          return true;
        }
      } catch {
      }
      return false;
    };
    this.onStrengthDownClick = (_event, _pos, node) => {
      this.value.strength = Math.max(-10, this.value.strength - 0.1);
      node.setDirtyCanvas(true, false);
      try {
        WidgetAPI$1.syncExecutionWidgets(node);
      } catch {
      }
      return true;
    };
    this.onStrengthUpClick = (_event, _pos, node) => {
      this.value.strength = Math.min(10, this.value.strength + 0.1);
      node.setDirtyCanvas(true, false);
      try {
        WidgetAPI$1.syncExecutionWidgets(node);
      } catch {
      }
      return true;
    };
    this.onStrengthClipClick = (event, _pos, node) => {
      try {
        const app2 = window?.app;
        const canvas = app2?.canvas;
        if (canvas?.prompt) {
          canvas.prompt("CLIP Strength", this.value.strengthClip ?? this.value.strength ?? 1, (v) => {
            const val = parseFloat(v);
            if (!Number.isNaN(val)) {
              this.value.strengthClip = Math.max(-10, Math.min(10, val));
              node.setDirtyCanvas(true, true);
              try {
                WidgetAPI$1.syncExecutionWidgets(node);
              } catch {
              }
            }
          }, event);
          return true;
        }
      } catch {
      }
      return false;
    };
    this.onStrengthClipDownClick = (_event, _pos, node) => {
      this.value.strengthClip = Math.max(-10, (this.value.strengthClip ?? this.value.strength ?? 1) - 0.1);
      node.setDirtyCanvas(true, false);
      try {
        WidgetAPI$1.syncExecutionWidgets(node);
      } catch {
      }
      return true;
    };
    this.onStrengthClipUpClick = (_event, _pos, node) => {
      this.value.strengthClip = Math.min(10, (this.value.strengthClip ?? this.value.strength ?? 1) + 0.1);
      node.setDirtyCanvas(true, false);
      try {
        WidgetAPI$1.syncExecutionWidgets(node);
      } catch {
      }
      return true;
    };
    this.onMoveUpClick = (_event, _pos, node) => {
      const idx = node.customWidgets.indexOf(this);
      if (idx <= 1) return true;
      if (node?.properties?.enableTags) {
        for (let j = idx - 1; j >= 0; j--) {
          const w = node.customWidgets[j];
          if (w instanceof SuperLoraWidget) {
            if (w.value?.tag === this.value?.tag) {
              const tmp = node.customWidgets[idx];
              node.customWidgets[idx] = node.customWidgets[j];
              node.customWidgets[j] = tmp;
              break;
            } else if (!(w instanceof SuperLoraWidget)) {
              break;
            }
          }
          if (w instanceof SuperLoraTagWidget) break;
        }
      } else {
        const temp = node.customWidgets[idx];
        node.customWidgets[idx] = node.customWidgets[idx - 1];
        node.customWidgets[idx - 1] = temp;
      }
      WidgetAPI$1.calculateNodeSize(node);
      node.setDirtyCanvas(true, false);
      return true;
    };
    this.onMoveDownClick = (_event, _pos, node) => {
      const idx = node.customWidgets.indexOf(this);
      if (idx >= node.customWidgets.length - 1) return true;
      if (node?.properties?.enableTags) {
        for (let j = idx + 1; j < node.customWidgets.length; j++) {
          const w = node.customWidgets[j];
          if (w instanceof SuperLoraWidget) {
            if (w.value?.tag === this.value?.tag) {
              const tmp = node.customWidgets[idx];
              node.customWidgets[idx] = node.customWidgets[j];
              node.customWidgets[j] = tmp;
              break;
            } else if (!(w instanceof SuperLoraWidget)) {
              break;
            }
          }
          if (w instanceof SuperLoraTagWidget) break;
        }
      } else {
        const temp = node.customWidgets[idx];
        node.customWidgets[idx] = node.customWidgets[idx + 1];
        node.customWidgets[idx + 1] = temp;
      }
      WidgetAPI$1.calculateNodeSize(node);
      node.setDirtyCanvas(true, false);
      return true;
    };
    this.onTriggerWordsClick = (event, _pos, node) => {
      try {
        try {
          event?.stopPropagation?.();
          event?.preventDefault?.();
        } catch {
        }
        if (WidgetAPI$1 && typeof WidgetAPI$1.showInlineText === "function") {
          const rect = this._triggerRect;
          const place = rect ? { rect, node, widget: this } : void 0;
          WidgetAPI$1.showInlineText(event, this.value.triggerWords || "", async (v) => {
            const newVal = String(v ?? "");
            this.value.triggerWords = newVal;
            this.value.autoFetched = false;
            this.value = { ...this.value, fetchAttempted: false };
            try {
              TriggerWordStore.set(this.value.lora, newVal);
            } catch {
            }
            this.value = { ...this.value };
            node.setDirtyCanvas(true, true);
            try {
              WidgetAPI$1.syncExecutionWidgets(node);
            } catch {
            }
          }, place);
          return true;
        }
      } catch {
      }
      try {
        const app2 = window?.app;
        const canvas = app2?.canvas;
        if (canvas?.prompt) {
          canvas.prompt("Trigger Words", this.value.triggerWords || "", async (v) => {
            const newVal = String(v ?? "");
            this.value.triggerWords = newVal;
            this.value.autoFetched = false;
            this.value = { ...this.value, fetchAttempted: false };
            try {
              TriggerWordStore.set(this.value.lora, newVal);
            } catch {
            }
            node.setDirtyCanvas(true, true);
            try {
              WidgetAPI$1.syncExecutionWidgets(node);
            } catch {
            }
          }, event);
          return true;
        }
      } catch {
      }
      return false;
    };
    this.onRefreshClick = async (_event, _pos, node) => {
      try {
        const now = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
        this._refreshSpinActive = true;
        this._refreshSpinStarted = now;
        this._refreshSpinEnd = now + 650;
        this._refreshSpinPeriod = 800;
        try {
          node.setDirtyCanvas(true, false);
        } catch {
        }
      } catch {
      }
      try {
        try {
          TriggerWordStore.remove(this.value.lora);
        } catch {
        }
        this.value.triggerWords = "";
        this.value.autoFetched = false;
        this.value = { ...this.value, fetchAttempted: false };
        await this.fetchTriggerWords();
        node.setDirtyCanvas(true, true);
        try {
          WidgetAPI$1.syncExecutionWidgets(node);
        } catch {
        }
        return true;
      } catch {
        return false;
      } finally {
        try {
          const now2 = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
          const end = Math.max(this._refreshSpinEnd || now2, now2 + 200);
          this._refreshSpinEnd = end;
          const timeoutMs = Math.max(0, end - now2);
          setTimeout(() => {
            this._refreshSpinActive = false;
            try {
              node.setDirtyCanvas(true, false);
            } catch {
            }
            ;
          }, timeoutMs);
        } catch {
        }
      }
    };
    this.onTagClick = (_event, _pos, node) => {
      WidgetAPI$1.showTagSelector(node, this);
      return true;
    };
    this.onNotesClick = (event, _pos, node) => {
      if (this.value.lora && this.value.lora !== "None") {
        LoraNotesDrawer.open(this.value.lora, node);
      } else {
        WidgetAPI$1.showLoraSelector(node, this, event);
      }
      return true;
    };
    this.onRemoveClick = (_event, _pos, node) => {
      WidgetAPI$1.removeLoraWidget(node, this);
      return true;
    };
    this.onDragStart = (event, pos, node) => {
      if (node._draggedWidget) return false;
      const self = this;
      if (event?.preventDefault) event.preventDefault();
      if (event?.stopPropagation) event.stopPropagation();
      node._dragStartWidgetCandidate = self;
      node._dragStartLocalY = pos[1];
      node._draggedWidget = null;
      node._dragMouseY = pos[1];
      node._dropTargetWidget = null;
      node._dropTargetAbove = false;
      node._dropTargetY = null;
      node.setDirtyCanvas(true, false);
      return true;
    };
    this.value = {
      lora: "None",
      enabled: true,
      strength: 1,
      strengthClip: 1,
      triggerWords: "",
      tag: "General",
      autoFetched: false,
      fetchAttempted: false
    };
    this.hitAreas = {
      enabled: { bounds: [0, 0], onDown: this.onEnabledDown, priority: 60 },
      lora: { bounds: [0, 0], onDown: this.onLoraClick, priority: 10 },
      tag: { bounds: [0, 0], onDown: this.onTagClick, priority: 20 },
      strength: { bounds: [0, 0], onDown: this.onStrengthClick, priority: 80 },
      strengthDown: { bounds: [0, 0], onDown: this.onStrengthDownClick, priority: 90 },
      strengthUp: { bounds: [0, 0], onDown: this.onStrengthUpClick, priority: 90 },
      strengthClip: { bounds: [0, 0], onDown: this.onStrengthClipClick, priority: 80 },
      strengthClipDown: { bounds: [0, 0], onDown: this.onStrengthClipDownClick, priority: 90 },
      strengthClipUp: { bounds: [0, 0], onDown: this.onStrengthClipUpClick, priority: 90 },
      triggerWords: { bounds: [0, 0], onDown: this.onTriggerWordsClick, priority: 85 },
      refresh: { bounds: [0, 0], onDown: this.onRefreshClick, priority: 95 },
      notes: { bounds: [0, 0], onDown: this.onNotesClick, priority: 98 },
      remove: { bounds: [0, 0], onDown: this.onRemoveClick, priority: 100 },
      moveUp: { bounds: [0, 0], onDown: this.onMoveUpClick, priority: 70 },
      moveDown: { bounds: [0, 0], onDown: this.onMoveDownClick, priority: 70 },
      drag: { bounds: [0, 0], onDown: this.onDragStart, priority: 110 }
    };
  }
  draw(ctx, node, w, posY, height) {
    try {
      const margin = 8;
      const rowHeight = 28;
      ctx.save();
      if (this.isBypassedByTag(node)) {
        ctx.globalAlpha *= 0.4;
      }
      const innerWidth = Math.max(0, w - margin * 2);
      const clampedHeight = Math.max(0, height);
      const bodyHeight = Math.max(4, height - 4);
      const bodyY = posY + (height >= bodyHeight ? Math.floor((height - bodyHeight) / 2) : 0);
      const cornerRadius = Math.min(6, bodyHeight / 2);
      ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
      ctx.beginPath();
      ctx.roundRect(margin, bodyY, innerWidth, bodyHeight, cornerRadius || 0);
      ctx.fill();
      if (!this.value.enabled) {
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.fill();
      }
      ctx.font = "11px 'Segoe UI', Arial, sans-serif";
      ctx.textBaseline = "middle";
      const topPad = node.properties?.showTriggerWords ? 4 : Math.max(4, Math.floor((height - rowHeight) / 2));
      let currentY = posY + topPad;
      this.drawFirstRow(ctx, node, w, currentY, rowHeight, height);
      ctx.restore();
    } catch (err) {
      console.error("Error drawing SuperLoraWidget:", err);
      try {
        ctx.restore();
      } catch (_) {
      }
    }
  }
  drawFirstRow(ctx, node, w, posY, rowHeight, fullHeight) {
    const margin = 8;
    let posX = margin + 6;
    const midY = rowHeight / 2;
    const toggleW = 28;
    const toggleH = 14;
    const toggleY = (rowHeight - toggleH) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(posX, posY + toggleY, toggleW, toggleH, toggleH / 2);
    ctx.fillStyle = this.value.enabled ? "#33789A" : "rgba(255,255,255,0.06)";
    ctx.fill();
    ctx.strokeStyle = this.value.enabled ? "#33789A" : "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    const knobR = toggleH / 2 - 1.5;
    const knobX = this.value.enabled ? posX + toggleW - toggleH / 2 : posX + toggleH / 2;
    const knobY = posY + toggleY + toggleH / 2;
    ctx.arc(knobX, knobY, knobR, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.restore();
    this.hitAreas.enabled.bounds = [posX - 2, toggleY - 2, toggleW + 4, toggleH + 4];
    posX += toggleW + 10;
    const loraWidgets = node.customWidgets?.filter((w2) => w2 instanceof SuperLoraWidget) || [];
    const showDrag = loraWidgets.length > 1 && node?.properties?.showMoveArrows !== false;
    const showStrength = node?.properties?.showStrengthControls !== false;
    const showRemove = node?.properties?.showRemoveButton !== false;
    const showNotes = node?.properties?.showNotesButton !== false;
    const dragW = 12;
    const strengthWidth = 50;
    const btnSize = 20;
    const removeSize = 20;
    const notesSize = 20;
    const gapSmall = 2;
    const gap = 8;
    const rightEdge = node.size[0] - margin - 6;
    let cursorX = rightEdge;
    let dragX = -9999;
    let removeX = -9999;
    let notesX = -9999;
    let plusX = -9999;
    let minusX = -9999;
    let strengthX = -9999;
    let plusClipX = -9999;
    let minusClipX = -9999;
    let strengthClipX = -9999;
    if (showDrag) {
      cursorX -= dragW;
      dragX = cursorX;
      cursorX -= gap;
    }
    if (showRemove) {
      cursorX -= removeSize;
      removeX = cursorX;
      cursorX -= gap;
    }
    if (showNotes) {
      cursorX -= notesSize;
      notesX = cursorX;
      cursorX -= gap;
    }
    if (showStrength) {
      cursorX -= btnSize;
      plusX = cursorX;
      cursorX -= gapSmall;
      cursorX -= strengthWidth;
      strengthX = cursorX;
      cursorX -= gapSmall;
      cursorX -= btnSize;
      minusX = cursorX;
      cursorX -= gap;
      if (node?.properties?.showSeparateStrengths) {
        cursorX -= btnSize;
        plusClipX = cursorX;
        cursorX -= gapSmall;
        cursorX -= strengthWidth;
        strengthClipX = cursorX;
        cursorX -= gapSmall;
        cursorX -= btnSize;
        minusClipX = cursorX;
        cursorX -= gap;
      }
    }
    if (node?.properties?.enableTags && node?.properties?.showTagChip !== false) {
      const iconSize = 20;
      const iconY = posY + Math.floor((rowHeight - iconSize) / 2);
      const isTagHovered = node._hoveredTagWidget === this;
      ctx.fillStyle = isTagHovered ? "rgba(51, 120, 154, 0.25)" : "rgba(255, 255, 255, 0.06)";
      ctx.beginPath();
      ctx.roundRect(posX, iconY, iconSize, iconSize, 3);
      ctx.fill();
      ctx.fillStyle = isTagHovered ? "#33789A" : "rgba(255, 255, 255, 0.55)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "12px Arial";
      ctx.save();
      if (!this.value.enabled) {
        ctx.globalAlpha *= 0.55;
      }
      ctx.fillText("🗁", posX + iconSize / 2, posY + midY);
      ctx.restore();
      this.hitAreas.tag.bounds = [posX, Math.floor((rowHeight - iconSize) / 2), iconSize, iconSize];
      posX += iconSize + 6;
      ctx.font = "12px 'Segoe UI', Arial, sans-serif";
    } else {
      this.hitAreas.tag.bounds = [0, 0, 0, 0];
    }
    const loraLeft = posX;
    const rightMost = [
      showStrength ? minusX : null,
      showStrength && node?.properties?.showSeparateStrengths ? minusClipX : null,
      showNotes ? notesX : null,
      showRemove ? removeX : null
    ].filter((v) => typeof v === "number");
    const loraMaxRight = (rightMost.length ? Math.min(...rightMost) : rightEdge) - gap;
    const loraWidth = Math.max(100, loraMaxRight - loraLeft);
    const showTriggers = !!(node.properties && node.properties.showTriggerWords);
    const nameWidth = showTriggers ? Math.max(80, Math.floor(loraWidth * 0.6)) : loraWidth;
    const trigWidth = showTriggers ? loraWidth - nameWidth : 0;
    ctx.textAlign = "left";
    ctx.font = "12px 'Segoe UI', Arial, sans-serif";
    const adv = this.value?.adv_settings || this.value?.advSettings || {};
    const hasAdv = Boolean(adv.smoothStep?.enabled || adv.dare?.enabled || (adv.blockFilter && adv.blockFilter !== "all"));
    ctx.fillStyle = !this.value.enabled ? "#888" : (hasAdv ? "#facc15" : "#fff");
    const loraText = this.value.lora === "None" ? "Click to select LoRA..." : this.value.lora;
    const loraDisplay = this.truncateText(ctx, loraText, nameWidth);
    ctx.fillText(loraDisplay, loraLeft, posY + midY);
    this.hitAreas.lora.bounds = [loraLeft, 0, nameWidth, fullHeight];
    const controlsAlpha = this.value.enabled ? 1 : 0.55;
    ctx.save();
    ctx.globalAlpha *= controlsAlpha;
    const triggerLeft = loraLeft + nameWidth;
    if (showTriggers && trigWidth > 0) {
      const hasTrigger = !!(this.value.triggerWords && String(this.value.triggerWords).trim());
      const pillH = 20;
      const pillY = posY + Math.floor((rowHeight - pillH) / 2);
      this._triggerRect = { x: triggerLeft, y: pillY, w: trigWidth, h: pillH };
      ctx.fillStyle = "#2f2f2f";
      ctx.beginPath();
      ctx.roundRect(triggerLeft, pillY, trigWidth, pillH, 3);
      ctx.fill();
      const padX = 6;
      ctx.textAlign = "left";
      ctx.font = "10px 'Segoe UI', Arial, sans-serif";
      if (hasTrigger) {
        ctx.fillStyle = this.value.enabled ? "#fff" : "#aaa";
        const trigDisplay = this.truncateText(ctx, String(this.value.triggerWords), trigWidth - padX * 2);
        ctx.fillText(trigDisplay, triggerLeft + padX, posY + midY);
      } else {
        ctx.fillStyle = "#888";
        const placeholder = "Click to add trigger words...";
        const phDisplay = this.truncateText(ctx, placeholder, trigWidth - padX * 2);
        ctx.fillText(phDisplay, triggerLeft + padX, posY + midY);
      }
      this.hitAreas.triggerWords.bounds = [triggerLeft, Math.floor((rowHeight - pillH) / 2), trigWidth, pillH];
      try {
        const dotRadius = 7;
        const dotCx = triggerLeft + trigWidth - 10;
        const dotCy = posY + midY;
        let showDot = true;
        let color = "rgba(74, 158, 255, 0.85)";
        const has = hasTrigger;
        const auto = !!this.value.autoFetched;
        const attempted = !!this.value?.fetchAttempted;
        if (has && auto) {
          color = "rgba(40, 167, 69, 0.85)";
        } else if (has && !auto) {
          color = "rgba(74, 158, 255, 0.85)";
        } else if (!has && attempted) {
          color = "rgba(253, 126, 20, 0.9)";
        } else {
          color = "rgba(160, 160, 160, 0.7)";
        }
        if (showDot) {
          ctx.save();
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(dotCx, dotCy, dotRadius, 0, Math.PI * 2);
          ctx.fill();
          const now = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
          const spinActive = !!this._refreshSpinActive;
          const spinEnd = this._refreshSpinEnd || 0;
          const spinStart = this._refreshSpinStarted || 0;
          const isSpinning = spinActive && now < spinEnd;
          if (isSpinning) {
            try {
              if (!this._spinRafScheduled) {
                this._spinRafScheduled = true;
                (window.requestAnimationFrame || ((cb) => setTimeout(cb, 16)))(() => {
                  this._spinRafScheduled = false;
                  try {
                    node.setDirtyCanvas(true, false);
                  } catch {
                  }
                });
              }
            } catch {
            }
          }
          ctx.fillStyle = "#111";
          ctx.font = "10px Arial";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          if (isSpinning) {
            const period = Math.max(500, this._refreshSpinPeriod || 800);
            const progress = (now - spinStart) % period / period;
            const angle = progress * Math.PI * 2;
            ctx.save();
            ctx.translate(dotCx, dotCy);
            ctx.rotate(angle);
            ctx.fillText("↻", 0, 0);
            ctx.restore();
          } else {
            ctx.fillText("↻", dotCx, dotCy);
          }
          ctx.restore();
          const size = dotRadius * 2 + 2;
          this.hitAreas.refresh.bounds = [dotCx - dotRadius, 0, size, fullHeight];
        }
      } catch {
      }
    } else {
      this.hitAreas.triggerWords.bounds = [0, 0, 0, 0];
    }
    if (showDrag) {
      ctx.save();
      const dotX = dragX + dragW / 2;
      const dotRadius = 1.5;
      ctx.fillStyle = this.value.enabled ? node._draggedWidget === this ? "#33789A" : "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.15)";
      ctx.beginPath();
      ctx.arc(dotX, posY + midY - 5, dotRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(dotX, posY + midY, dotRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(dotX, posY + midY + 5, dotRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      if (this.hitAreas.drag) this.hitAreas.drag.bounds = [dragX - 2, 0, dragW + 4, fullHeight];
      if (this.hitAreas.moveUp) this.hitAreas.moveUp.bounds = [0, 0, 0, 0];
      if (this.hitAreas.moveDown) this.hitAreas.moveDown.bounds = [0, 0, 0, 0];
    } else {
      if (this.hitAreas.drag) this.hitAreas.drag.bounds = [0, 0, 0, 0];
      if (this.hitAreas.moveUp) this.hitAreas.moveUp.bounds = [0, 0, 0, 0];
      if (this.hitAreas.moveDown) this.hitAreas.moveDown.bounds = [0, 0, 0, 0];
    }
    const btnY = (rowHeight - btnSize) / 2;
    if (showStrength) {
      ctx.fillStyle = "#666";
      ctx.beginPath();
      ctx.roundRect(minusX, posY + btnY, btnSize, btnSize, 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.font = "12px Arial";
      ctx.fillText("-", minusX + btnSize / 2, posY + midY);
      this.hitAreas.strengthDown.bounds = [minusX, btnY, btnSize, btnSize];
    } else {
      this.hitAreas.strengthDown.bounds = [0, 0, 0, 0];
    }
    if (node?.properties?.showStrengthControls !== false) {
      const strengthY = (rowHeight - 20) / 2;
      ctx.fillStyle = this.value.enabled ? "#3b2a4a" : "#2a2a35";
      ctx.beginPath();
      ctx.roundRect(strengthX, posY + strengthY, strengthWidth, 20, 3);
      ctx.fill();
      ctx.strokeStyle = "#4a4a4a";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = this.value.enabled ? "#e5e5e5" : "#bdbdbd";
      ctx.textAlign = "center";
      ctx.font = "12px Arial";
      ctx.fillText(this.value.strength.toFixed(2), strengthX + strengthWidth / 2, posY + midY);
      this.hitAreas.strength.bounds = [strengthX, strengthY, strengthWidth, 20];
    } else {
      this.hitAreas.strength.bounds = [0, 0, 0, 0];
    }
    if (node?.properties?.showStrengthControls !== false) {
      ctx.fillStyle = "#666";
      ctx.beginPath();
      ctx.roundRect(plusX, posY + btnY, btnSize, btnSize, 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.font = "12px Arial";
      ctx.fillText("+", plusX + btnSize / 2, posY + midY);
      this.hitAreas.strengthUp.bounds = [plusX, btnY, btnSize, btnSize];
    } else {
      this.hitAreas.strengthUp.bounds = [0, 0, 0, 0];
    }
    if (showStrength && node?.properties?.showSeparateStrengths) {
      ctx.fillStyle = "#666";
      ctx.beginPath();
      ctx.roundRect(minusClipX, posY + btnY, btnSize, btnSize, 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.font = "12px Arial";
      ctx.fillText("-", minusClipX + btnSize / 2, posY + midY);
      this.hitAreas.strengthClipDown.bounds = [minusClipX, btnY, btnSize, btnSize];
      const strengthY2 = (rowHeight - 20) / 2;
      ctx.fillStyle = this.value.enabled ? "#4a3f1f" : "#2a2a35";
      ctx.beginPath();
      ctx.roundRect(strengthClipX, posY + strengthY2, strengthWidth, 20, 3);
      ctx.fill();
      ctx.strokeStyle = "#4a4a4a";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = this.value.enabled ? "#e5e5e5" : "#bdbdbd";
      ctx.textAlign = "center";
      ctx.font = "12px Arial";
      ctx.fillText(this.value.strengthClip.toFixed(2), strengthClipX + strengthWidth / 2, posY + midY);
      this.hitAreas.strengthClip.bounds = [strengthClipX, strengthY2, strengthWidth, 20];
      ctx.fillStyle = "#666";
      ctx.beginPath();
      ctx.roundRect(plusClipX, posY + btnY, btnSize, btnSize, 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.font = "12px Arial";
      ctx.fillText("+", plusClipX + btnSize / 2, posY + midY);
      this.hitAreas.strengthClipUp.bounds = [plusClipX, btnY, btnSize, btnSize];
    } else {
      this.hitAreas.strengthClipDown.bounds = [0, 0, 0, 0];
      this.hitAreas.strengthClip.bounds = [0, 0, 0, 0];
      this.hitAreas.strengthClipUp.bounds = [0, 0, 0, 0];
    }
    ctx.restore();
    if (node?.properties?.showRemoveButton !== false) {
      ctx.save();
      const removeY = (rowHeight - removeSize) / 2;
      const isHovered = node._hoveredRemoveWidget === this;
      ctx.fillStyle = isHovered ? "rgba(200,50,50,0.2)" : "rgba(255,255,255,0.06)";
      ctx.beginPath();
      ctx.roundRect(removeX, posY + removeY, removeSize, removeSize, 3);
      ctx.fill();
      ctx.fillStyle = isHovered ? "#ff5555" : "rgba(255,255,255,0.45)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "bold 12px Arial";
      ctx.fillText("✕", removeX + removeSize / 2, posY + midY + 1);
      ctx.restore();
      this.hitAreas.remove.bounds = [removeX, removeY, removeSize, removeSize];
    } else {
      this.hitAreas.remove.bounds = [0, 0, 0, 0];
    }
    if (showNotes) {
      ctx.save();
      const notesY = (rowHeight - notesSize) / 2;
      const isHovered = node._hoveredNotesWidget === this;
      const hasNotes = LoraNotesDrawer.getInstance().hasNotes(this.value.lora);
      if (hasNotes) {
        ctx.fillStyle = isHovered ? "rgba(56, 122, 255, 0.35)" : "rgba(56, 122, 255, 0.18)";
      } else {
        ctx.fillStyle = isHovered ? "rgba(255, 255, 255, 0.15)" : "rgba(255, 255, 255, 0.05)";
      }
      ctx.beginPath();
      ctx.roundRect(notesX, posY + notesY, notesSize, notesSize, 3);
      ctx.fill();
      if (hasNotes) {
        ctx.strokeStyle = "rgba(56, 122, 255, 0.6)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.fillStyle = hasNotes ? "#60a5fa" : (isHovered ? "#ffffff" : "rgba(255, 255, 255, 0.45)");
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "12px 'Segoe UI', Arial, sans-serif";
      ctx.fillText("✍︎", notesX + notesSize / 2, posY + midY);
      ctx.restore();
      this.hitAreas.notes.bounds = [notesX, notesY, notesSize, notesSize];
    } else {
      this.hitAreas.notes.bounds = [0, 0, 0, 0];
    }
  }
  isCollapsedByTag(node) {
    if (!node.customWidgets) return false;
    const tagWidget = node.customWidgets.find((w) => w instanceof SuperLoraTagWidget && w.tag === this.value.tag);
    return tagWidget?.isCollapsed?.() || false;
  }
  isBypassedByTag(node) {
    if (!node.customWidgets) return false;
    const tagWidget = node.customWidgets.find((w) => w instanceof SuperLoraTagWidget && w.tag === this.value.tag);
    return tagWidget?.value?.bypassed || false;
  }
  truncateText(ctx, text, maxWidth) {
    this._textCache = this._textCache || {};
    const cacheKey = text + "_" + Math.floor(maxWidth);
    if (this._textCache[cacheKey]) return this._textCache[cacheKey];
    const metrics = ctx.measureText(text);
    if (metrics.width <= maxWidth) {
      this._textCache[cacheKey] = text;
      return text;
    }
    let truncated = text;
    while (ctx.measureText(truncated + "...").width > maxWidth && truncated.length > 0) {
      truncated = truncated.slice(0, -1);
    }
    const result = truncated + "...";
    this._textCache[cacheKey] = result;
    return result;
  }
  computeSize() {
    return [450, 50];
  }
  setLora(lora, node) {
    this.value.lora = lora;
    this.value.triggerWords = "";
    this.value.autoFetched = false;
    this.value = { ...this.value, fetchAttempted: false };
    if (lora !== "None") {
      try {
        const manual = TriggerWordStore.get(lora);
        if (manual) {
          this.value.triggerWords = manual;
          this.value.autoFetched = false;
          return;
        }
      } catch {
      }
      if (node && node?.properties?.autoFetchTriggerWords !== false) {
        this.fetchTriggerWords();
      }
    }
  }
  async fetchTriggerWords() {
    try {
      this.value.fetchAttempted = true;
      try {
        const manual = TriggerWordStore.get(this.value.lora);
        if (manual) {
          this.value.triggerWords = manual;
          this.value.autoFetched = false;
          return;
        }
      } catch {
      }
      const words = await WidgetAPI$1.civitaiService.getTriggerWords(this.value.lora);
      if (words.length > 0) {
        this.value.triggerWords = words.join(", ");
        this.value.autoFetched = true;
        try {
          TriggerWordStore.set(this.value.lora, this.value.triggerWords);
        } catch {
        }
      } else {
        this.value = { ...this.value, fetchAttempted: true };
      }
    } catch (error) {
      console.warn("Failed to fetch trigger words:", error);
    }
  }
}
class SuperLoraHeaderWidget extends SuperLoraBaseWidget {
  constructor() {
    super("SuperLoraHeaderWidget");
    this.onToggleAllDown = (_event, _pos, node) => {
      const allState = this.getAllLorasState(node);
      if (!node.customWidgets) return true;
      const loraWidgets = node.customWidgets.filter((w) => w instanceof SuperLoraWidget);
      loraWidgets.forEach((w) => w.value.enabled = !allState);
      node.setDirtyCanvas(true, true);
      return true;
    };
    this.onAddLoraDown = (event, _pos, node) => {
      WidgetAPI$1.showLoraSelector(node, void 0, event);
      return true;
    };
    this.onSaveTemplateDown = (_event, _pos, node) => {
      WidgetAPI$1.showNameOverlay({
        title: "Save Template",
        placeholder: "Template name...",
        initial: "My LoRA Set",
        submitLabel: "Save",
        onCommit: async (templateName) => {
          const name = (templateName || "").trim();
          if (!name) {
            WidgetAPI$1.showToast("Please enter a template name", "warning");
            return;
          }
          const configs = WidgetAPI$1.getLoraConfigs(node);
          const validConfigs = configs.filter((config) => config.lora && config.lora !== "None");
          if (validConfigs.length === 0) {
            WidgetAPI$1.showToast("⚠️ No valid LoRAs to save in template", "warning");
            return;
          }
          try {
            const exists = await WidgetAPI$1.templateService.templateExists(name);
            if (exists) {
              WidgetAPI$1.showToast(`⚠️ Template "${name}" already exists. Choose a different name.`, "warning");
              return;
            }
            const success = await WidgetAPI$1.templateService.saveTemplate(name, validConfigs);
            WidgetAPI$1.showToast(success ? `✅ Template "${name}" saved successfully!` : "❌ Failed to save template. Please try again.", success ? "success" : "error");
          } catch (error) {
            console.error("Template save error:", error);
            WidgetAPI$1.showToast("❌ Error saving template. Check console for details.", "error");
          }
        }
      });
      return true;
    };
    this.onLoadTemplateDown = (event, _pos, node) => {
      WidgetAPI$1.showLoadTemplateDialog(node, event);
      return true;
    };
    this.onSettingsDown = (event, _pos, node) => {
      WidgetAPI$1.showSettingsDialog(node, event);
      return true;
    };
    this.onRefreshFilesDown = async (_event, _pos, node) => {
      try {
        const now = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
        this._spinActive = true;
        this._spinStart = now;
        this._spinEnd = now + 650;
        node.setDirtyCanvas(true, false);
        setTimeout(() => {
          this._spinActive = false;
          node.setDirtyCanvas(true, false);
        }, 700);

        const loraService = LoraService.getInstance();
        const freshLoras = await loraService.refreshLoraList();

        try {
          LoraNotesDrawer.getInstance()._loadNotesMap();
        } catch (_) {}

        if (!Array.isArray(freshLoras) || freshLoras.length === 0) {
          WidgetAPI$1.showToast("⚠️ Could not scan LoRA files or folder is empty", "warning");
          return true;
        }

        const norm = (s) => (s || "").replace(/\\/g, "/").toLowerCase().trim();
        const getDir = (s) => {
          const parts = norm(s).split("/");
          parts.pop();
          return parts.join("/");
        };
        const getBase = (s) => norm(s).split("/").pop().replace(/\.[^/.]+$/, "");

        const calcSimilarity = (s1, s2) => {
          if (!s1 || !s2) return 0;
          const a = s1.toLowerCase();
          const b = s2.toLowerCase();
          if (a === b) return 1.0;
          if (a.includes(b) || b.includes(a)) {
            return 0.85 * (Math.min(a.length, b.length) / Math.max(a.length, b.length));
          }
          const bg1 = new Set();
          for (let i = 0; i < a.length - 1; i++) bg1.add(a.slice(i, i + 2));
          const bg2 = new Set();
          for (let i = 0; i < b.length - 1; i++) bg2.add(b.slice(i, i + 2));
          let inter = 0;
          for (const x of bg1) if (bg2.has(x)) inter++;
          const tot = bg1.size + bg2.size;
          return tot > 0 ? (2.0 * inter) / tot : 0;
        };

        const freshMap = new Map();
        freshLoras.forEach((l) => freshMap.set(norm(l), l));

        const loraWidgets = (node.customWidgets || []).filter((w) => w instanceof SuperLoraWidget);
        const presentNorms = new Set();
        const missingWidgets = [];

        // 1. Identify which widgets are already present vs missing
        for (const w of loraWidgets) {
          const currentLora = w.value?.lora;
          if (!currentLora || currentLora === "None") continue;
          const currentNorm = norm(currentLora);
          if (freshMap.has(currentNorm)) {
            presentNorms.add(currentNorm);
            const diskName = freshMap.get(currentNorm);
            if (diskName && diskName !== currentLora) {
              w.value.lora = diskName;
              w.value.name = diskName;
            }
          } else {
            missingWidgets.push({ widget: w, currentLora });
          }
        }

        // 2. Unassigned fresh files on disk (candidates for renamed files)
        const unassignedList = freshLoras.filter((l) => !presentNorms.has(norm(l)));

        let removedCount = 0;
        let renamedCount = 0;

        // 3. Match missing LoRAs to renamed files
        for (const { widget: w, currentLora } of missingWidgets) {
          let bestMatch = null;
          let bestScore = 0;
          let bestIdx = -1;

          const oldBase = getBase(currentLora);
          const oldDir = getDir(currentLora);

          for (let i = 0; i < unassignedList.length; i++) {
            const cand = unassignedList[i];
            const candBase = getBase(cand);
            const candDir = getDir(cand);

            const sim = calcSimilarity(oldBase, candBase);
            const dirBonus = (oldDir && candDir && oldDir === candDir) ? 0.25 : 0;
            const score = sim + dirBonus;

            if (score > bestScore) {
              bestScore = score;
              bestMatch = cand;
              bestIdx = i;
            }
          }

          const threshold = unassignedList.length === 1 ? 0.30 : 0.45;
          if (bestMatch && bestScore >= threshold) {
            // Renamed file detected!
            const newLora = bestMatch;
            unassignedList.splice(bestIdx, 1);
            presentNorms.add(norm(newLora));

            w.value.lora = newLora;
            w.value.name = newLora;

            // Migrate attached note seamlessly
            try {
              if (LoraNotesDrawer.renameNote) {
                LoraNotesDrawer.renameNote(currentLora, newLora);
              }
            } catch (_) {}

            renamedCount++;
          } else {
            // File was deleted from disk
            WidgetAPI$1.removeLoraWidget(node, w);
            removedCount++;
          }
        }

        node.setDirtyCanvas(true, true);
        WidgetAPI$1.syncExecutionWidgets(node, false);

        if (removedCount > 0 || renamedCount > 0) {
          const parts = [];
          if (removedCount > 0) parts.push(`removed ${removedCount} missing`);
          if (renamedCount > 0) parts.push(`updated ${renamedCount} renamed`);
          WidgetAPI$1.showToast(`🗘 Synced files: ${parts.join(", ")}`, "success");
        } else {
          WidgetAPI$1.showToast("🗘 LoRA list refreshed — all files up to date!", "success");
        }
      } catch (err) {
        console.error("Refresh LoRA files error:", err);
        WidgetAPI$1.showToast("❌ Error refreshing LoRAs", "error");
      }
      return true;
    };
    this.value = { type: "SuperLoraHeaderWidget" };
    this.hitAreas = {
      toggleAll: { bounds: [0, 0], onDown: this.onToggleAllDown },
      addLora: { bounds: [0, 0], onDown: this.onAddLoraDown },
      saveTemplate: { bounds: [0, 0], onDown: this.onSaveTemplateDown },
      loadTemplate: { bounds: [0, 0], onDown: this.onLoadTemplateDown },
      settings: { bounds: [0, 0], onDown: this.onSettingsDown },
      refreshFiles: { bounds: [0, 0], onDown: this.onRefreshFilesDown }
    };
  }
  draw(ctx, node, w, posY, height) {
    const margin = 8;
    const buttonHeight = 24;
    const buttonSpacing = 8;
    let posX = margin;
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
    ctx.fillRect(0, posY, w, height);
    const midY = posY + height / 2;
    ctx.font = "500 11px 'Segoe UI', Arial, sans-serif";
    ctx.textBaseline = "middle";
    const buttonStyles = {
      primary: {
        fill: "rgba(51, 120, 154, 0.35)",
        text: "#ffffff",
        font: "600 11px 'Segoe UI', Arial, sans-serif"
      },
      secondary: {
        fill: "rgba(255, 255, 255, 0.12)",
        text: "#ffffff",
        font: "500 11px 'Segoe UI', Arial, sans-serif"
      }
    };
    const modeWidths = {
      addLora: { full: 120, short: 86, icon: 40 },
      refreshFiles: { full: 26, short: 26, icon: 26 },
      default: { full: 72, short: 52, icon: 32 }
    };
    const drawButton = (x, width, style, label, _mode, btnId) => {
      const buttonY = posY + (height - buttonHeight) / 2;
      const isHovered = node._hoveredHeaderBtn === btnId;
      ctx.save();
      ctx.beginPath();
      if (isHovered) {
        ctx.fillStyle = btnId === "addLora" ? "rgba(51, 120, 154, 0.55)" : "rgba(255, 255, 255, 0.22)";
      } else {
        ctx.fillStyle = style.fill;
      }
      ctx.roundRect(x, buttonY, width, buttonHeight, 4);
      ctx.fill();
      ctx.fillStyle = isHovered ? "#ffffff" : style.text;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = style.font ?? "500 11px 'Segoe UI', Arial, sans-serif";

      if (btnId === "refreshFiles") {
        const now = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
        const isSpinning = !!this._spinActive && now < (this._spinEnd || 0);
        if (isSpinning) {
          try {
            if (!this._spinRaf) {
              this._spinRaf = true;
              (window.requestAnimationFrame || ((cb) => setTimeout(cb, 16)))(() => {
                this._spinRaf = false;
                node.setDirtyCanvas(true, false);
              });
            }
          } catch (_) {}
          const period = Math.max(300, (this._spinEnd - (this._spinStart || now)) || 650);
          const progress = Math.min(1, Math.max(0, (now - (this._spinStart || now)) / period));
          const angle = progress * Math.PI * 2;
          ctx.save();
          ctx.translate(x + width / 2, midY);
          ctx.rotate(angle);
          ctx.fillText("🗘", 0, 0);
          ctx.restore();
          ctx.restore();
          return;
        }
      }

      ctx.fillText(label, x + width / 2, midY);
      ctx.restore();
    };
    const availableWidth = w - margin * 2;
    const allEnabled = this.getAllLorasState(node);
    const toggleText = allEnabled ? "Disable All" : "Enable All";
    const toggleShort = allEnabled ? "Disable" : "Enable";
    const buttons = [
      { id: "addLora", text: "+ Add LoRA", shortText: "+ Add", icon: "+", style: buttonStyles.primary, initialMode: "full", combineIcon: false },
      { id: "toggleAll", text: toggleText, shortText: toggleShort, icon: "▶", style: buttonStyles.secondary, initialMode: "full", combineIcon: false },
      { id: "saveTemplate", text: "Save", shortText: "Save", icon: "↑", style: buttonStyles.secondary, initialMode: "full", combineIcon: false },
      { id: "loadTemplate", text: "Load", shortText: "Load", icon: "↓", style: buttonStyles.secondary, initialMode: "full", combineIcon: false },
      { id: "settings", text: "Settings", shortText: "Set", icon: "⚙︎", style: buttonStyles.secondary, initialMode: "full", combineIcon: false },
      { id: "refreshFiles", text: "🗘", shortText: "🗘", icon: "🗘", style: buttonStyles.secondary, initialMode: "icon", combineIcon: false }
    ];
    const totalSpacing = buttonSpacing * (buttons.length - 1);
    const getModeWidth = (id, mode) => {
      const preset = modeWidths[id] || modeWidths.default;
      return preset[mode];
    };
    const computeTotalWidth = (modes2) => {
      return modes2.reduce((sum, mode, idx) => {
        const btn = buttons[idx];
        return sum + getModeWidth(btn.id, mode);
      }, 0);
    };
    const modes = buttons.map((btn) => btn.initialMode);
    const degradeSteps = [
      { indices: [1, 2, 3], from: "full", to: "short" },
      { indices: [4], from: "full", to: "short" },
      { indices: [0], from: "full", to: "short" },
      { indices: [1, 2, 3], from: "short", to: "icon" },
      { indices: [4], from: "short", to: "icon" },
      { indices: [0], from: "short", to: "icon" }
    ];
    let totalWidth = computeTotalWidth(modes);
    const availableForButtons = Math.max(60, availableWidth - totalSpacing);
    let stepIndex = 0;
    while (totalWidth > availableForButtons && stepIndex < degradeSteps.length) {
      const step = degradeSteps[stepIndex];
      let changed = false;
      for (const index of step.indices) {
        if (modes[index] === step.from) {
          modes[index] = step.to;
          changed = true;
        }
      }
      if (changed) {
        totalWidth = computeTotalWidth(modes);
      } else {
        stepIndex++;
      }
    }
    const scale = (availableWidth - totalSpacing) / totalWidth;
    let totalAllocated = 0;
    const scaledWidths = buttons.map((btn, idx) => {
      const mode = modes[idx];
      const naturalW = getModeWidth(btn.id, mode);
      const minW = getModeWidth(btn.id, "icon");
      let scaledW = Math.floor(naturalW * scale);
      scaledW = Math.max(minW, scaledW);
      totalAllocated += scaledW;
      return scaledW;
    });
    const remainder = availableWidth - totalSpacing - totalAllocated;
    if (remainder !== 0 && scaledWidths.length > 0) {
      scaledWidths[scaledWidths.length - 1] += remainder;
    }
    buttons.forEach((btn, idx) => {
      const btnWidth = scaledWidths[idx];
      const mode = modes[idx];
      let label;
      if (mode === "icon") {
        label = btn.icon;
      } else if (mode === "short") {
        label = btn.combineIcon && btn.icon ? `${btn.icon} ${btn.shortText}` : btn.shortText;
      } else {
        label = btn.combineIcon && btn.icon ? `${btn.icon} ${btn.text}` : btn.text;
      }
      drawButton(posX, btnWidth, btn.style, label, mode, btn.id);
      this.hitAreas[btn.id].bounds = [posX, 0, btnWidth, height];
      posX += btnWidth + buttonSpacing;
    });
    ctx.restore();
  }
  getAllLorasState(node) {
    if (!node.customWidgets) return false;
    const loraWidgets = node.customWidgets.filter((w) => w instanceof SuperLoraWidget);
    return loraWidgets.length > 0 && loraWidgets.every((w) => w.value.enabled);
  }
  computeSize() {
    return [450, 35];
  }
}
const app = window.app;
const LiteGraph = window.LiteGraph;
const _SuperLoraNode = class _SuperLoraNode {
  static async initialize() {
    if (this.initialized) {
      return;
    }
    if (this.initializationPromise) {
      return this.initializationPromise;
    }
    this.initializationPromise = (async () => {
      this.loraService = LoraService.getInstance();
      this.templateService = TemplateService.getInstance();
      this.civitaiService = CivitAiService.getInstance();
      this.updateService = UpdateService.getInstance();
      FilePickerService.getInstance();
      setWidgetAPI({
        showLoraSelector: (node, widget, e) => _SuperLoraNode.showLoraSelector(node, widget, e),
        showTagSelector: (node, widget) => _SuperLoraNode.showTagSelector(node, widget),
        showSettingsDialog: (node, e) => _SuperLoraNode.showSettingsDialog(node, e),
        showLoadTemplateDialog: (node, e) => _SuperLoraNode.showLoadTemplateDialog(node, e),
        showNameOverlay: (opts) => _SuperLoraNode.showNameOverlay(opts),
        showInlineText: (e, initial, onCommit, place) => _SuperLoraNode.showInlineText(e, initial, onCommit, place),
        showToast: (m, t) => _SuperLoraNode.showToast(m, t),
        calculateNodeSize: (node) => _SuperLoraNode.calculateNodeSize(node),
        organizeByTags: (node) => _SuperLoraNode.organizeByTags(node),
        addLoraWidget: (node, config) => _SuperLoraNode.addLoraWidget(node, config),
        removeLoraWidget: (node, widget) => _SuperLoraNode.removeLoraWidget(node, widget),
        getLoraConfigs: (node) => _SuperLoraNode.getLoraConfigs(node),
        templateService: _SuperLoraNode.templateService,
        civitaiService: _SuperLoraNode.civitaiService,
        syncExecutionWidgets: (node, reRenderDom = true) => _SuperLoraNode.syncExecutionWidgets(node, reRenderDom)
      });
      await Promise.all([
        this.loraService.initialize(),
        this.templateService.initialize(),
        this.updateService.initialize()
      ]);
      try {
        window.NDSuperNodesUpdateStatus = this.updateService.getStatus();
      } catch {
      }
      this.initialized = true;
    })();
    try {
      await this.initializationPromise;
    } finally {
      this.initializationPromise = null;
    }
  }
  static isNodeBypassed(node) {
    if (!node) {
      return false;
    }
    const flags = node.flags || {};
    if (flags.bypass || flags.bypassed || flags.skip_processing || flags.skipProcessing) {
      return true;
    }
    if (node.properties && (node.properties.bypass === true || node.properties.skip === true)) {
      return true;
    }
    try {
      if (typeof LiteGraph !== "undefined" && LiteGraph && typeof LiteGraph.NEVER === "number") {
        if (node.mode === LiteGraph.NEVER) {
          return true;
        }
      }
    } catch {
    }
    return false;
  }
  /**
   * Set up the node type with custom widgets
   */
  static setup(nodeType, _nodeData) {
    gateResizeAndDraw(nodeType, 320, 100);

    const originalNodeCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function() {
      if (originalNodeCreated) {
        originalNodeCreated.apply(this, arguments);
      }
      _SuperLoraNode.setupAdvancedNode(this);
      hideJsonWidget(this.widgets, "lora_bundle");
      SuperLoraDOMRenderer.mount(this, WidgetAPI$1);
    };

    const originalOnSerialize = nodeType.prototype.onSerialize;
    nodeType.prototype.onSerialize = function(data) {
      if (originalOnSerialize) {
        originalOnSerialize.apply(this, arguments);
      }
      try {
        const payload = _SuperLoraNode.serializeCustomWidgets(this);
        if (payload) {
          data.customWidgets = payload;
        }
      } catch {
      }
    };
    const originalOnConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function(info) {
      if (originalOnConfigure) {
        originalOnConfigure.apply(this, arguments);
      }
      try {
        if (info && info.customWidgets) {
          _SuperLoraNode.deserializeCustomWidgets(this, info.customWidgets);
        }
      } catch {
      }
    };
    const originalOnDrawForeground = nodeType.prototype.onDrawForeground;
    nodeType.prototype.onDrawForeground = function(ctx) {
      if (originalOnDrawForeground) {
        originalOnDrawForeground.call(this, ctx);
      }
      if (isVueNodes() || this._trixDomRoot?.isConnected) {
        return;
      }
      _SuperLoraNode.drawCustomWidgets(this, ctx);
    };

    const originalOnMouseDown = nodeType.prototype.onMouseDown;
    nodeType.prototype.onMouseDown = function(event, pos) {
      if (isVueNodes() || this._trixDomRoot?.isConnected) {
        return false;
      }
      if (_SuperLoraNode.handleMouseDown(this, event, pos)) {
        return true;
      }
      return originalOnMouseDown ? originalOnMouseDown.call(this, event, pos) : false;
    };

    const originalOnMouseUp = nodeType.prototype.onMouseUp;
    nodeType.prototype.onMouseUp = function(event, pos) {
      if (isVueNodes() || this._trixDomRoot?.isConnected) {
        return false;
      }
      const hadCandidate = !!this._dragStartWidgetCandidate;
      const hadDrag = !!this._draggedWidget;
      if (hadDrag || hadCandidate) {
        const dragged = this._draggedWidget;
        const targetWidget = this._dropTargetWidget;
        const above = this._dropTargetAbove;
        this._draggedWidget = null;
        this._dragStartWidgetCandidate = null;
        this._dragStartLocalY = null;
        this._dragMouseY = null;
        this._dropTargetWidget = null;
        this._dropTargetAbove = null;
        this._dropTargetY = null;
        try {
          const canvasEl = window.app?.canvas?.canvas;
          if (canvasEl) canvasEl.style.cursor = "default";
        } catch (_) {
        }
        if (hadDrag && dragged && targetWidget) {
          const widgets = this.customWidgets || [];
          const oldIdx = widgets.indexOf(dragged);
          const targetIdx = widgets.indexOf(targetWidget);
          if (oldIdx !== -1 && targetIdx !== -1) {
            widgets.splice(oldIdx, 1);
            let insertIdx = above ? targetIdx : targetIdx + 1;
            if (oldIdx < insertIdx) insertIdx--;
            widgets.splice(insertIdx, 0, dragged);
            if (targetWidget instanceof SuperLoraWidget) {
              dragged.value.tag = targetWidget.value.tag;
            } else if (targetWidget instanceof SuperLoraTagWidget) {
              if (above) {
                let newTag = "General";
                for (let i = insertIdx - 1; i >= 0; i--) {
                  if (widgets[i] instanceof SuperLoraTagWidget) {
                    newTag = widgets[i].tag;
                    break;
                  }
                }
                dragged.value.tag = newTag;
              } else {
                dragged.value.tag = targetWidget.tag;
              }
            }
            try {
              WidgetAPI$1.organizeByTags(this);
              WidgetAPI$1.calculateNodeSize(this);
              WidgetAPI$1.syncExecutionWidgets(this);
            } catch (err) {
              console.error("Drag reorder finalize error:", err);
            }
          }
        }
        try {
          this.setDirtyCanvas(true, true);
        } catch (_) {
        }
        if (window.app && window.app.canvas) {
          window.app.canvas.node_capturing_input = null;
        }
        return false;
      }
      if (_SuperLoraNode.handleMouseUp(this, event, pos)) return true;
      return originalOnMouseUp ? originalOnMouseUp.call(this, event, pos) : false;
    };

    const originalOnMouseMove = nodeType.prototype.onMouseMove;
    nodeType.prototype.onMouseMove = function(event, pos) {
      if (isVueNodes() || this._trixDomRoot?.isConnected) {
        return false;
      }
      if (this._dragStartWidgetCandidate || this._draggedWidget) {
        if (event && event.buttons === 0) {
          this._draggedWidget = null;
          this._dragStartWidgetCandidate = null;
          this._dragStartLocalY = null;
          this._dragMouseY = null;
          this._dropTargetWidget = null;
          this._dropTargetAbove = null;
          this._dropTargetY = null;
          try {
            const canvasEl = window.app?.canvas?.canvas;
            if (canvasEl) canvasEl.style.cursor = "default";
          } catch (_) {
          }
          this.setDirtyCanvas(true, false);
          return false;
        }
        const localY = pos[1];
        if (!this._draggedWidget && this._dragStartWidgetCandidate) {
          const dist = Math.abs(localY - (this._dragStartLocalY || 0));
          if (dist > 4) {
            this._draggedWidget = this._dragStartWidgetCandidate;
            try {
              const canvasEl = window.app?.canvas?.canvas;
              if (canvasEl) canvasEl.style.cursor = "grabbing";
            } catch (_) {
            }
          }
        }
        if (this._draggedWidget) {
          this._dragMouseY = localY;
          this.setDirtyCanvas(true, false);
        }
        return true;
      }
      if (this.customWidgets) {
        const marginDefault = _SuperLoraNode.MARGIN_SMALL;
        let curY = _SuperLoraNode.NODE_WIDGET_TOP_OFFSET;
        let newHover = null;
        let newTagHover = null;
        let newNotesHover = null;
        let newHeaderHoverBtn = null;
        let newTagToggleHover = null;
        for (const w of this.customWidgets) {
          if (w instanceof SuperLoraWidget && w.isCollapsedByTag(this)) continue;
          const h = w instanceof SuperLoraWidget ? 34 : w.computeSize?.()[1] ?? 0;
          if (h === 0) continue;
          if (pos[1] >= curY && pos[1] <= curY + h) {
            if (w instanceof SuperLoraHeaderWidget) {
              const localY = pos[1] - curY;
              for (const btnId in w.hitAreas) {
                const bounds = w.hitAreas[btnId]?.bounds;
                if (bounds && bounds[2] > 0 && bounds[3] > 0 && pos[0] >= bounds[0] && pos[0] <= bounds[0] + bounds[2] && localY >= bounds[1] && localY <= bounds[1] + bounds[3]) {
                  newHeaderHoverBtn = btnId;
                  break;
                }
              }
            } else if (w instanceof SuperLoraTagWidget) {
              const localY = pos[1] - curY;
              const tb = w.hitAreas?.toggle?.bounds;
              if (tb && tb[2] > 0 && tb[3] > 0 && pos[0] >= tb[0] && pos[0] <= tb[0] + tb[2] && localY >= tb[1] && localY <= tb[1] + tb[3]) {
                newTagToggleHover = w;
              }
            } else {
              const localY = pos[1] - curY;
              const rb = w.hitAreas?.remove?.bounds;
              if (rb && rb[2] > 0 && rb[3] > 0 && pos[0] >= rb[0] && pos[0] <= rb[0] + rb[2] && localY >= rb[1] && localY <= rb[1] + rb[3]) {
                newHover = w;
              }
              const nb = w.hitAreas?.notes?.bounds;
              if (nb && nb[2] > 0 && nb[3] > 0 && pos[0] >= nb[0] && pos[0] <= nb[0] + nb[2] && localY >= nb[1] && localY <= nb[1] + nb[3]) {
                newNotesHover = w;
              }
              const tb = w.hitAreas?.tag?.bounds;
              if (tb && tb[2] > 0 && tb[3] > 0 && pos[0] >= tb[0] && pos[0] <= tb[0] + tb[2] && localY >= tb[1] && localY <= tb[1] + tb[3]) {
                newTagHover = w;
              }
            }
            break;
          }
          const marginAfter = w instanceof SuperLoraTagWidget && w.isCollapsed?.() ? 0 : marginDefault;
          curY += h + marginAfter;
        }
        let needsRedraw = false;
        if (newHover !== this._hoveredRemoveWidget) {
          this._hoveredRemoveWidget = newHover;
          needsRedraw = true;
        }
        if (newNotesHover !== this._hoveredNotesWidget) {
          this._hoveredNotesWidget = newNotesHover;
          needsRedraw = true;
        }
        if (newTagHover !== this._hoveredTagWidget) {
          this._hoveredTagWidget = newTagHover;
          needsRedraw = true;
        }
        if (newTagToggleHover !== this._hoveredTagToggleWidget) {
          this._hoveredTagToggleWidget = newTagToggleHover;
          this._hoveredTagToggleTime = Date.now();
          needsRedraw = true;
          if (newTagToggleHover) {
             setTimeout(() => {
                if (this._hoveredTagToggleWidget === newTagToggleHover) {
                   this.setDirtyCanvas(true, false);
                }
             }, 1000);
          }
        }
        if (newHeaderHoverBtn !== this._hoveredHeaderBtn) {
          this._hoveredHeaderBtn = newHeaderHoverBtn;
          needsRedraw = true;
        }
        if (needsRedraw) {
          this.setDirtyCanvas(true, false);
        }
      }
      return originalOnMouseMove ? originalOnMouseMove.call(this, event, pos) : false;
    };

    const originalOnResize = nodeType.prototype.onResize;
    nodeType.prototype.onResize = function(size, ...rest) {
      if (isVueNodes()) {
        if (originalOnResize) return originalOnResize.apply(this, [size, ...rest]);
        return;
      }
      const minHeight = SuperLoraDOMRenderer.calculateRequiredNodeHeight(this);
      const minWidth = 320;
      if (Array.isArray(size)) {
        size[0] = Math.max(size[0] || 0, minWidth);
        size[1] = Math.max(size[1] || 0, minHeight);
      } else if (size && typeof size === "object") {
        if (typeof size[0] === "number") size[0] = Math.max(size[0], minWidth);
        if (typeof size[1] === "number") size[1] = Math.max(size[1], minHeight);
        if (typeof size.x === "number") size.x = Math.max(size.x, minWidth);
        if (typeof size.y === "number") size.y = Math.max(size.y, minHeight);
      }
      if (this.size && Array.isArray(this.size)) {
        this.size[0] = Math.max(this.size[0] || 0, minWidth);
        this.size[1] = Math.max(this.size[1] || 0, minHeight);
      }
      if (originalOnResize) {
        return originalOnResize.apply(this, [size, ...rest]);
      }
      return void 0;
    };

    const originalSerialize = nodeType.prototype.serialize;
    nodeType.prototype.serialize = function() {
      const data = originalSerialize.apply(this, arguments);
      try {
        const freshBundle = _SuperLoraNode.buildBundle(this);
        let bridge = (this.widgets || []).find((w) => w?.name === "lora_bundle");
        if (!bridge) {
          bridge = this.addWidget("text", "lora_bundle", freshBundle, () => {}, {});
        }
        bridge.type = "text";
        bridge.hidden = true;
        bridge.draw = () => {};
        bridge.computeSize = () => [0, 0];
        bridge.value = freshBundle;
        bridge.serializeValue = () => freshBundle;
        data.inputs = data.inputs || {};
        data.inputs.lora_bundle = freshBundle;
      } catch {
      }
      data.customWidgets = _SuperLoraNode.serializeCustomWidgets(this);
      return data;
    };

    const originalConfigure = nodeType.prototype.configure;
    nodeType.prototype.configure = function(data) {
      if (originalConfigure) {
        originalConfigure.call(this, data);
      }
      const restoredCustomWidgets = data.customWidgets || data?.extensions?.customWidgets;
      if (restoredCustomWidgets) {
        _SuperLoraNode.deserializeCustomWidgets(this, restoredCustomWidgets);
      } else {
        _SuperLoraNode.setupAdvancedNode(this);
      }
      hideJsonWidget(this.widgets, "lora_bundle");
      SuperLoraDOMRenderer.mount(this, WidgetAPI$1);
      _SuperLoraNode.syncExecutionWidgets(this);
    };

    const originalOnRemoved = nodeType.prototype.onRemoved;
    nodeType.prototype.onRemoved = function() {
      this._trixFloorOff?.();
      if (originalOnRemoved) {
        return originalOnRemoved.apply(this, arguments);
      }
    };
    const originalGetExtraMenuOptions = nodeType.prototype.getExtraMenuOptions;
    nodeType.prototype.getExtraMenuOptions = function(_canvas, optionsArr) {
      try {
        let options = Array.isArray(optionsArr) ? optionsArr : [];
        if (originalGetExtraMenuOptions) {
          const maybe = originalGetExtraMenuOptions.call(this, _canvas, options);
          if (Array.isArray(maybe)) options = maybe;
        }
        const hasAddLoRA = options.some((opt) => opt && opt.content === "❖ Add LoRA");
        const hasSettings = options.some((opt) => opt && opt.content === "⚙︎ Settings");
        if (!hasAddLoRA || !hasSettings) {
          if (options.length === 0 || options[options.length - 1] !== null) {
            options.push(null);
          }
          if (!hasAddLoRA) {
            options.push({ content: "❖ Add LoRA", callback: (_event) => _SuperLoraNode.showLoraSelector(this, void 0, void 0) });
          }
          if (!hasSettings) {
            options.push({ content: "⚙︎ Settings", callback: (_event) => _SuperLoraNode.showSettingsDialog(this) });
          }
        }
        return options;
      } catch {
        const safe = optionsArr && Array.isArray(optionsArr) ? optionsArr : [];
        const ensureSeparator = () => {
          if (safe.length === 0 || safe[safe.length - 1] !== null) {
            safe.push(null);
          }
        };
        if (!safe.some((opt) => opt && opt.content === "❖ Add LoRA")) {
          ensureSeparator();
          safe.push({ content: "❖ Add LoRA", callback: (_event) => _SuperLoraNode.showLoraSelector(this, void 0, void 0) });
        }
        if (!safe.some((opt) => opt && opt.content === "⚙︎ Settings")) {
          ensureSeparator();
          safe.push({ content: "⚙︎ Settings", callback: (_event) => _SuperLoraNode.showSettingsDialog(this) });
        }
        return safe;
      }
    };
  }
  /**
   * Initialize advanced node with custom widgets
   */
  static setupAdvancedNode(node) {
    node.properties = node.properties || {};
    node.properties.enableTags = node.properties.enableTags !== false;
    node.properties.showTriggerWords = node.properties.showTriggerWords !== false;
    node.properties.showSeparateStrengths = node.properties.showSeparateStrengths || false;
    node.properties.autoFetchTriggerWords = node.properties.autoFetchTriggerWords !== false;
    if (!node.customWidgets || node.customWidgets.length === 0) {
      node.customWidgets = [new SuperLoraHeaderWidget()];
    }
    SuperLoraDOMRenderer.mount(node, WidgetAPI$1);
    console.log("Super LoRA Loader: Advanced node setup complete");
  }
  static computeContentHeight(node) {
    const marginDefault = _SuperLoraNode.MARGIN_SMALL;
    let currentY = this.NODE_WIDGET_TOP_OFFSET;
    if (!node?.customWidgets) {
      return Math.max(currentY, 100);
    }
    const renderable = [];
    for (const widget of node.customWidgets) {
      const isCollapsed = widget instanceof SuperLoraWidget && widget.isCollapsedByTag(node);
      if (isCollapsed) continue;
      const size = widget.computeSize();
      const height = widget instanceof SuperLoraWidget ? 34 : size[1];
      if (height === 0) continue;
      renderable.push(widget);
    }
    renderable.forEach((widget, index) => {
      const size = widget.computeSize();
      const height = widget instanceof SuperLoraWidget ? 34 : size[1];
      let marginAfter = widget instanceof SuperLoraTagWidget && widget.isCollapsed() ? 0 : marginDefault;
      const isLast = index === renderable.length - 1;
      if (isLast && widget instanceof SuperLoraTagWidget && widget.isCollapsed()) {
        marginAfter = Math.max(marginDefault, 8);
      }
      currentY += height + marginAfter;
    });
    return Math.max(currentY, 100);
  }
  /**
   * Calculate required node size based on widgets
   */
  static calculateNodeSize(node) {
    if (isGraphLoading() || !node) return;
    SuperLoraDOMRenderer.fitNode(node, true);
  }
  /**
   * Custom drawing for all widgets
   */
  static drawCustomWidgets(node, ctx) {
    if (!node.customWidgets) return;
    const isBypassed = _SuperLoraNode.isNodeBypassed(node);
    const marginDefault = _SuperLoraNode.MARGIN_SMALL;
    let currentY = this.NODE_WIDGET_TOP_OFFSET;
    if (!isBypassed) {
      const renderable = [];
      for (const widget of node.customWidgets) {
        const size = widget.computeSize();
        const isCollapsed = widget instanceof SuperLoraWidget && widget.isCollapsedByTag(node);
        const height = widget instanceof SuperLoraWidget ? 34 : size[1];
        if (height === 0 || isCollapsed) continue;
        renderable.push(widget);
      }
      node._dropTargetWidget = null;
      node._dropTargetAbove = false;
      node._dropTargetY = null;
      renderable.forEach((widget, index) => {
        const size = widget.computeSize();
        const height = widget instanceof SuperLoraWidget ? 34 : size[1];
        if (node._draggedWidget && typeof node._dragMouseY === "number") {
          const widgetsIndex = node.customWidgets.indexOf(widget);
          if (widgetsIndex > 0) {
            const startY = currentY;
            const endY = currentY + height;
            if (node._dragMouseY >= startY && node._dragMouseY <= endY) {
              const isAbove = node._dragMouseY - startY < height / 2;
              node._dropTargetWidget = widget;
              node._dropTargetAbove = isAbove;
              node._dropTargetY = isAbove ? startY : endY;
            }
          }
        }
        ctx.save();
        if (widget === node._draggedWidget) {
          ctx.globalAlpha *= 0.4;
        }
        widget.draw(ctx, node, node.size[0], currentY, height);
        ctx.restore();
        let marginAfter = widget instanceof SuperLoraTagWidget && widget.isCollapsed() ? 0 : marginDefault;
        const isLast = index === renderable.length - 1;
        if (isLast && widget instanceof SuperLoraTagWidget && widget.isCollapsed()) {
          marginAfter = Math.max(marginDefault, 8);
        }
        currentY += height + marginAfter;
      });
      if (node._draggedWidget && typeof node._dragMouseY === "number" && !node._dropTargetWidget) {
        if (node._dragMouseY > currentY - marginDefault) {
          const lastWidget = renderable[renderable.length - 1];
          if (lastWidget) {
            node._dropTargetWidget = lastWidget;
            node._dropTargetAbove = false;
            node._dropTargetY = currentY - marginDefault;
          }
        }
      }
      if (node._draggedWidget && typeof node._dropTargetY === "number") {
        const margin = 8;
        ctx.save();
        ctx.strokeStyle = "#387aff";
        ctx.lineWidth = 3;
        ctx.shadowColor = "rgba(56, 122, 255, 0.4)";
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.moveTo(margin, node._dropTargetY);
        ctx.lineTo(node.size[0] - margin, node._dropTargetY);
        ctx.stroke();
        ctx.restore();
      }
    }
    if (isBypassed) {
      try {
        ctx.save();
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "rgba(142, 88, 255, 0.42)";
        const radius = 6;
        if (typeof ctx.roundRect === "function") {
          ctx.beginPath();
          ctx.roundRect(4, 4, Math.max(0, node.size[0] - 8), Math.max(0, node.size[1] - 8), radius);
          ctx.fill();
        } else {
          ctx.fillRect(4, 4, Math.max(0, node.size[0] - 8), Math.max(0, node.size[1] - 8));
        }
        ctx.restore();
      } catch {
      }
    }
    if (node._hoveredTagToggleWidget && node._hoveredTagToggleTime && Date.now() - node._hoveredTagToggleTime > 1000) {
      const w = node._hoveredTagToggleWidget;
      const marginDefault = _SuperLoraNode.MARGIN_SMALL;
      let currentY = this.NODE_WIDGET_TOP_OFFSET;
      for (const widget of node.customWidgets) {
        if (widget === w) {
          const bounds = w.hitAreas?.toggle?.bounds;
          if (bounds) {
            ctx.save();
            const text = "Bypass this group of LoRAs.";
            ctx.font = "12px Arial";
            const textWidth = ctx.measureText(text).width;
            const px = bounds[0] - textWidth - 10;
            const py = currentY + bounds[1] + bounds[3] / 2;
            
            ctx.fillStyle = "rgba(0,0,0,0.85)";
            ctx.beginPath();
            if (typeof ctx.roundRect === "function") {
              ctx.roundRect(px - 6, py - 12, textWidth + 12, 24, 4);
            } else {
              ctx.rect(px - 6, py - 12, textWidth + 12, 24);
            }
            ctx.fill();
            
            ctx.fillStyle = "#fff";
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText(text, px, py);
            ctx.restore();
          }
          break;
        }
        const size = widget.computeSize();
        const isCollapsed = widget instanceof SuperLoraWidget && widget.isCollapsedByTag(node);
        const height = widget instanceof SuperLoraWidget ? 34 : size[1];
        if (height !== 0 && !isCollapsed) {
          const marginAfter = widget instanceof SuperLoraTagWidget && widget.isCollapsed() ? 0 : marginDefault;
          currentY += height + marginAfter;
        }
      }
    }
  }
  /**
   * Handle mouse interactions
   */
  static handleMouseDown(node, event, pos) {
    return this.handleMouseEvent(node, event, pos, "onMouseDown");
  }
  static handleMouseUp(node, event, pos) {
    return this.handleMouseEvent(node, event, pos, "onClick");
  }
  static handleMouseEvent(node, event, pos, handler) {
    if (!node.customWidgets) return false;
    if (node.size && pos[0] > node.size[0] - 20 && pos[1] > node.size[1] - 20) {
      return false;
    }
    if (_SuperLoraNode.isNodeBypassed(node)) {
      return true;
    }
    try {
      const rect = app?.canvas?.canvas?.getBoundingClientRect?.();
      const ds = app?.canvas?.ds;
      let sx = event && (event.clientX ?? event.pageX) || null;
      let sy = event && (event.clientY ?? event.pageY) || null;
      if ((sx == null || sy == null) && rect && ds) {
        sx = rect.left + (pos[0] + (ds.offset?.[0] || 0)) * (ds.scale || 1);
        sy = rect.top + (pos[1] + (ds.offset?.[1] || 0)) * (ds.scale || 1);
      }
      if (sx != null && sy != null) {
        _SuperLoraNode._lastPointerScreen = { x: sx, y: sy };
      }
    } catch {
    }
    const marginDefault = _SuperLoraNode.MARGIN_SMALL;
    let currentY = this.NODE_WIDGET_TOP_OFFSET;
    for (const widget of node.customWidgets) {
      const size = widget.computeSize();
      const isCollapsed = widget instanceof SuperLoraWidget && widget.isCollapsedByTag(node);
      if (size[1] === 0 || isCollapsed) {
        continue;
      }
      const height = widget instanceof SuperLoraWidget ? 34 : size[1];
      const widgetStartY = currentY;
      const widgetEndY = currentY + height;
      if (pos[1] >= widgetStartY && pos[1] <= widgetEndY) {
        const localPos = [pos[0], pos[1] - widgetStartY];
        if (widget[handler]) {
          if (widget[handler](event, localPos, node)) {
            return true;
          }
        }
      }
      const marginAfter = widget instanceof SuperLoraTagWidget && widget.isCollapsed() ? 0 : marginDefault;
      currentY += height + marginAfter;
    }
    return false;
  }
  /**
   * Compute the top Y offset (in node-local coordinates) for a given widget
   */
  static computeWidgetTop(node, targetWidget) {
    if (!node?.customWidgets) return this.NODE_WIDGET_TOP_OFFSET;
    const marginDefault = _SuperLoraNode.MARGIN_SMALL;
    let currentY = this.NODE_WIDGET_TOP_OFFSET;
    for (const widget of node.customWidgets) {
      const size = widget.computeSize?.() || [0, 0];
      const isCollapsed = widget instanceof SuperLoraWidget && widget.isCollapsedByTag?.(node);
      const height = widget instanceof SuperLoraWidget ? 34 : size[1];
      if (height === 0 || isCollapsed) {
        continue;
      }
      if (widget === targetWidget) {
        return currentY;
      }
      const marginAfter = widget instanceof SuperLoraTagWidget && widget.isCollapsed?.() ? 0 : marginDefault;
      currentY += height + marginAfter;
    }
    return currentY;
  }
  /**
   * Show LoRA selector dialog with enhanced search functionality
   */
  static async showLoraSelector(node, widget, _event) {
    try {
      const availableLoras = await _SuperLoraNode.loraService.getAvailableLoras();
      const usedLoras = this.getUsedLoras(node);
      const items = availableLoras.map((name) => ({
        id: name,
        label: name.replace(/\.(safetensors|ckpt|pt)$/i, ""),
        disabled: usedLoras.has(name) && (!widget || widget.value.lora !== name)
      }));
      OverlayService.getInstance().showSearchOverlay({
        title: widget ? "Replace LoRA" : "Add LoRA",
        placeholder: "Search LoRAs...",
        items,
        onChoose: (id) => {
          if (this.isDuplicateLora(node, id) && (!widget || widget.value.lora !== id)) {
            this.showToast("⚠️ Already added to the list", "warning");
            return;
          }
          if (widget) {
            widget.setLora(id, node);
            this.showToast("✅ LoRA replaced", "success");
          } else {
            this.addLoraWidget(node, { lora: id });
            this.showToast("✅ LoRA added", "success");
          }
          this.syncExecutionWidgets(node);
          node.setDirtyCanvas(true, true);
        },
        enableMultiToggle: true,
        onChooseMany: (ids) => {
          const added = [];
          const skipped = [];
          if (widget && ids.length > 0) {
            widget.setLora(ids[0], node);
            added.push(ids[0]);
            for (let i = 1; i < ids.length; i++) {
              const id = ids[i];
              if (this.isDuplicateLora(node, id)) {
                skipped.push(id);
                continue;
              }
              this.addLoraWidget(node, { lora: id });
              added.push(id);
            }
          } else {
            ids.forEach((id) => {
              if (this.isDuplicateLora(node, id)) {
                skipped.push(id);
                return;
              }
              this.addLoraWidget(node, { lora: id });
              added.push(id);
            });
          }
          if (added.length) this.showToast(`✅ ${widget ? "Replaced & Added" : "Added"} ${added.length} LoRA${added.length > 1 ? "s" : ""}`, "success");
          if (skipped.length) this.showToast(`⚠️ Skipped ${skipped.length} duplicate${skipped.length > 1 ? "s" : ""}`, "warning");
          this.syncExecutionWidgets(node);
          node.setDirtyCanvas(true, true);
        },
        // Provide folder chips explicitly (top-level folders)
        folderChips: Array.from(new Set(
          availableLoras.map((p) => p.split(/[\\/]/)[0]).filter(Boolean)
        )).sort(),
        // Fix the root chip label for LoRAs
        baseFolderName: "loras"
      });
    } catch (error) {
      console.error("Failed to show LoRA selector:", error);
      this.showToast("Failed to load LoRAs", "error");
    }
  }
  /**
   * Show tag selector dialog
   */
  static showTagSelector(node, widget) {
    const svc = TagSetService.getInstance();
    const existingTags = this.getExistingTags(node);
    const fromStore = svc.getAll();
    const allTags = Array.from(/* @__PURE__ */ new Set([
      ...fromStore,
      ...existingTags
    ]));
    const items = allTags.map((tag) => ({ id: tag, label: tag }));
    OverlayService.getInstance().showSearchOverlay({
      title: "Select Tag",
      placeholder: "Search or create tag...",
      items,
      allowCreate: true,
      onChoose: (tag) => {
        try {
          svc.addTag(tag);
        } catch {
        }
        widget.value.tag = tag;
        this.organizeByTags(node);
        this.calculateNodeSize(node);
        this.syncExecutionWidgets(node);
        node.setDirtyCanvas(true, false);
      },
      rightActions: [
        {
          icon: "✎",
          title: "Rename tag",
          onClick: (name) => {
            this.showNameOverlay({
              title: "Rename Tag",
              placeholder: "New tag name...",
              initial: name,
              submitLabel: "Rename",
              onCommit: (newName) => {
                const cleanNew = (newName || "").trim();
                if (!cleanNew) return;
                const ok = svc.renameTag(name, cleanNew);
                if (node && node.customWidgets) {
                  node.customWidgets.forEach((w) => {
                    if (w.constructor?.name === "SuperLoraTagWidget" && w.tag === name) {
                      w.tag = cleanNew;
                      if (w.value) w.value.tag = cleanNew;
                    }
                    if (w.constructor?.name === "SuperLoraWidget" && (w.value?.tag || "General") === name) {
                      if (w.value) w.value.tag = cleanNew;
                    }
                  });
                }
                this.organizeByTags(node);
                this.calculateNodeSize(node);
                this.syncExecutionWidgets(node);
                if (node._trixDomRoot) {
                  SuperLoraDOMRenderer.render(node, this, true);
                }
                node.setDirtyCanvas(true, true);
                this.showToast(ok ? "☑ Tag renamed" : "☑ Group renamed", "success");
                this.showTagSelector(node, widget);
              }
            });
          }
        },
        {
          icon: "✖︎",
          title: "Delete group and all its LoRAs",
          onClick: (name) => {
            const okConfirm = confirm(`Delete group "${name}" and all LoRAs inside it?`);
            if (!okConfirm) return;

            // 1. Delete all widgets in this group from the node
            if (node && node.customWidgets) {
              node.customWidgets = node.customWidgets.filter((w) => {
                if (w.constructor?.name === "SuperLoraTagWidget" && w.tag === name) return false;
                if (w.constructor?.name === "SuperLoraWidget" && (w.value?.tag || "General") === name) return false;
                return true;
              });
            }

            // 2. Remove tag from tag set service
            svc.deleteTag(name);

            // 3. Reorganize & Sync node state
            this.organizeByTags(node);
            this.calculateNodeSize(node);
            this.syncExecutionWidgets(node);
            if (node._trixDomRoot) {
              SuperLoraDOMRenderer.render(node, this, true);
            }
            node.setDirtyCanvas(true, true);

            this.showToast(`☑ Group "${name}" and its LoRAs deleted`, "success");

            // 4. Refresh tag selector or close if target widget was deleted
            const remainingWidgets = (node.customWidgets || []).filter((w) => w.constructor?.name === "SuperLoraWidget");
            if (widget && remainingWidgets.includes(widget)) {
              this.showTagSelector(node, widget);
            } else {
              OverlayService.getInstance().removeExistingOverlays();
            }
          }
        }
      ]
    });
  }
  /**
   * Show settings dialog
   */
  static showSettingsDialog(node, _event) {
    openSuperLoraSettingsPanel(node, (structural) => {
      SuperLoraDOMRenderer.render(node, WidgetAPI$1, structural);
      this.syncExecutionWidgets(node);
    });
  }
  /**
   * Show save template dialog
   */
  static showSaveTemplateDialog(node) {
    const templateName = prompt("Enter template name:", "My LoRA Set");
    if (templateName && templateName.trim()) {
      const configs = this.getLoraConfigs(node);
      this.templateService.saveTemplate(templateName.trim(), configs).then((success) => {
        if (success) {
          this.showToast(`Template "${templateName.trim()}" saved successfully!`, "success");
        } else {
          this.showToast("Failed to save template", "error");
        }
      });
    }
  }
  /**
   * Show load template dialog with enhanced UI
   */
  static async showLoadTemplateDialog(node, event) {
    try {
      const templateNames = await this.templateService.getTemplateNames();
      if (templateNames.length === 0) {
        this.showToast("🗁 No templates available. Create one first!", "info");
        return;
      }
      const items = templateNames.map((name) => ({ id: name, label: name }));
      this.showSearchOverlay({
        title: "Load Template",
        placeholder: "Search templates...",
        items,
        onChoose: async (name) => {
          try {
            const template = await this.templateService.loadTemplate(name);
            if (template) {
              this.loadTemplate(node, template);
              this.showToast(`☑ Template "${name}" loaded successfully!`, "success");
            } else {
              this.showToast(`✖︎ Failed to load template "${name}". It may be corrupted.`, "error");
            }
          } catch (error) {
            console.error(`Template load error for "${name}":`, error);
            this.showToast(`✖︎ Error loading template. Check console for details.`, "error");
          }
        },
        rightActions: [
          {
            icon: "✎",
            title: "Rename template",
            onClick: async (name) => {
              this.showNameOverlay({
                title: "Rename Template",
                placeholder: "New template name...",
                initial: name,
                submitLabel: "Rename",
                onCommit: async (newName) => {
                  const src = (name || "").trim();
                  const dst = (newName || "").trim();
                  if (!dst || dst === src) return;
                  const ok = await this.templateService.renameTemplate(src, dst);
                  this.showToast(ok ? "☑ Template renamed" : "✖︎ Failed to rename", ok ? "success" : "error");
                  if (ok) this.showLoadTemplateDialog(node, event);
                }
              });
            }
          },
          {
            icon: "✖︎",
            title: "Delete template",
            onClick: async (name) => {
              const ok = confirm(`Delete template "${name}"? This cannot be undone.`);
              if (!ok) return;
              const deleted = await this.templateService.deleteTemplate(name);
              this.showToast(deleted ? "☑ Template deleted" : "✖︎ Failed to delete template", deleted ? "success" : "error");
              if (deleted) this.showLoadTemplateDialog(node, event);
            }
          }
        ]
      });
    } catch (error) {
      console.error("Failed to show template selector:", error);
      this.showToast("✖︎ Error loading templates. Check console for details.", "error");
    }
  }
  /**
   * Add a new LoRA widget
   */
  static addLoraWidget(node, config) {
    const uniqueId = `lora_${Date.now()}_${Math.random().toString(36).slice(2, 9)}_${Math.floor(Math.random() * 10000)}`;
    const widget = new SuperLoraWidget(uniqueId);
    widget._uid = uniqueId;
    const defStr = Number(node?.properties?.defaultStrength ?? 1.0) || 1.0;
    widget.value.strength = defStr;
    widget.value.strengthClip = defStr;
    if (config) {
      const { lora: cfgLora, ...rest } = config;
      if (Object.keys(rest).length) {
        Object.assign(widget.value, rest);
      }
      if (cfgLora && cfgLora !== "None") {
        widget.setLora(cfgLora, node);
      }
    }
    if (node?.properties?.enableTags) {
      widget.value.tag = widget.value.tag || "General";
    }
    node.customWidgets = node.customWidgets || [];
    node.customWidgets.push(widget);
    if (node?.properties?.enableTags) {
      this.organizeByTags(node);
    }
    this.calculateNodeSize(node);
    node.setDirtyCanvas(true, false);
    this.syncExecutionWidgets(node);
    return widget;
  }
  /**
   * Remove a LoRA widget
   */
  static removeLoraWidget(node, widget) {
    const index = node.customWidgets.indexOf(widget);
    if (index >= 0) {
      node.customWidgets.splice(index, 1);
      this.organizeByTags(node);
      this.calculateNodeSize(node);
      node.setDirtyCanvas(true, false);
      this.syncExecutionWidgets(node);
    }
  }
  /**
   * Organize widgets by tags
   */
  static organizeByTags(node) {
    if (!node.properties.enableTags) {
      node.customWidgets = node.customWidgets.filter((w) => !(w instanceof SuperLoraTagWidget));
      return;
    }
    const loraWidgets = node.customWidgets.filter((w) => w instanceof SuperLoraWidget);
    const headerWidget = node.customWidgets.find((w) => w instanceof SuperLoraHeaderWidget);
    const existingTagWidgets = node.customWidgets.filter((w) => w instanceof SuperLoraTagWidget);
    const tagGroups = {};
    for (const widget of loraWidgets) {
      const tag = widget.value.tag || "General";
      if (!tagGroups[tag]) tagGroups[tag] = [];
      tagGroups[tag].push(widget);
    }
    node.customWidgets = [headerWidget].filter(Boolean);
    const sortedTags = Object.keys(tagGroups).sort(
      (a, b) => a === "General" ? -1 : b === "General" ? 1 : a.localeCompare(b)
    );
    for (const tag of sortedTags) {
      let tagWidget = existingTagWidgets.find((w) => w.tag === tag);
      if (!tagWidget) {
        tagWidget = new SuperLoraTagWidget(tag);
      }
      node.customWidgets.push(tagWidget);
      node.customWidgets.push(...tagGroups[tag]);
    }
  }
  /**
   * Get used LoRA names
   */
  static getUsedLoras(node) {
    return new Set(
      node.customWidgets.filter((w) => w instanceof SuperLoraWidget).map((w) => w.value.lora).filter((lora) => lora && lora !== "None")
    );
  }
  /**
   * Check if a LoRA is already used in the node
   */
  static isDuplicateLora(node, loraName) {
    const usedLoras = this.getUsedLoras(node);
    return usedLoras.has(loraName);
  }
  /**
   * Get existing tags
   */
  static getExistingTags(node) {
    return Array.from(new Set(
      node.customWidgets.filter((w) => w instanceof SuperLoraWidget).map((w) => w.value.tag).filter((tag) => tag)
    ));
  }
  /**
   * Get LoRA configurations
   */
  static getLoraConfigs(node) {
    return node.customWidgets.filter((w) => w instanceof SuperLoraWidget).map((w) => ({
      lora: w.value.lora,
      enabled: w.value.enabled,
      strength_model: w.value.strength,
      strength_clip: w.value.strengthClip,
      trigger_word: w.value.triggerWords,
      tag: w.value.tag,
      auto_populated: w.value.autoFetched
    })).filter((config) => config.lora && config.lora !== "None");
  }
  /**
   * Load template configurations
   */
  static loadTemplate(node, configs) {
    node.customWidgets = node.customWidgets.filter(
      (w) => !(w instanceof SuperLoraWidget) && !(w instanceof SuperLoraTagWidget)
    );
    for (const config of configs) {
      const widget = new SuperLoraWidget(`lora_${Date.now()}_${Math.random()}`);
      widget.value = {
        lora: config.lora,
        enabled: config.enabled !== false,
        strength: config.strength_model || 1,
        strengthClip: config.strength_clip || config.strength_model || 1,
        triggerWords: config.trigger_word || "",
        tag: config.tag || "General",
        autoFetched: config.auto_populated || false
      };
      node.customWidgets.push(widget);
    }
    this.organizeByTags(node);
    this.calculateNodeSize(node);
    node.setDirtyCanvas(true, false);
    this.syncExecutionWidgets(node);
  }
  static syncExecutionWidgets(node, reRenderDom = true) {
    if (!node) return;
    try {
      const freshBundle = _SuperLoraNode.buildBundle(node);
      let bridge = (node.widgets || []).find((w) => w?.name === "lora_bundle");
      if (!bridge) {
        bridge = node.addWidget("text", "lora_bundle", freshBundle, () => {}, {});
      }
      bridge.type = "text";
      bridge.hidden = true;
      bridge.value = freshBundle;
      bridge.serializeValue = () => freshBundle;
      hideJsonWidget(node.widgets, "lora_bundle");
    } catch (_) {}

    if (reRenderDom && node._trixDomRoot) {
      SuperLoraDOMRenderer.render(node, WidgetAPI$1);
    }
    node.setDirtyCanvas(true, true);
  }
  // Build the JSON bundle the backend expects from current custom widgets
  static buildBundle(node) {
    const loraWidgets = node.customWidgets?.filter((w) => w instanceof SuperLoraWidget) || [];
    const loras = loraWidgets.filter((w) => w?.value?.lora && w.value.lora !== "None").map((w) => {
      const sm = typeof w.value.strength === "number" ? w.value.strength : 1.0;
      const sc = typeof w.value.strengthClip === "number" ? w.value.strengthClip : sm;
      return {
        lora: w.value.lora,
        name: w.value.lora,
        enabled: Boolean(w.value.enabled && !w.isBypassedByTag(node)),
        on: Boolean(w.value.enabled && !w.isBypassedByTag(node)),
        strength: sm,
        sm: sm,
        strengthClip: sc,
        sc: sc,
        triggerWords: w.value.triggerWords || "",
        tag: w.value.tag || "",
        autoFetched: Boolean(w.value.autoFetched),
        adv_settings: w.value.adv_settings || w.value.advSettings || {}
      };
    });
    const payload = {
      loras: loras,
      cacheMode: node.properties?.cacheMode || "last",
      separator: node.properties?.triggerWordsSeparator || ", "
    };
    try {
      return JSON.stringify(payload);
    } catch {
      return JSON.stringify(loras);
    }
  }
  /**
   * Serialize custom widgets for saving
   */
  static serializeCustomWidgets(node) {
    if (!node.customWidgets) return null;
    const cloneProperties = JSON.parse(JSON.stringify(node.properties || {}));
    return {
      properties: cloneProperties,
      widgets: node.customWidgets.map((widget) => ({
        name: widget.name,
        type: widget.constructor.name,
        value: JSON.parse(JSON.stringify(widget.value))
      }))
    };
  }
  /**
   * Deserialize custom widgets when loading
   */
  static deserializeCustomWidgets(node, data) {
    if (!data) return;
    try {
      node.properties = node.properties || {};
      if (data.properties) {
        Object.assign(node.properties, JSON.parse(JSON.stringify(data.properties)));
      }
      const restoredWidgets = [];
      if (Array.isArray(data.widgets)) {
        for (const widgetData of data.widgets) {
          let widget;
          switch (widgetData.type) {
            case "SuperLoraHeaderWidget":
              widget = new SuperLoraHeaderWidget();
              break;
            case "SuperLoraTagWidget":
              widget = new SuperLoraTagWidget(widgetData.value?.tag);
              break;
            case "SuperLoraWidget":
              widget = new SuperLoraWidget(widgetData.name);
              break;
            default:
              continue;
          }
          widget.value = { ...widget.value, ...JSON.parse(JSON.stringify(widgetData.value || {})) };
          restoredWidgets.push(widget);
        }
      }
      node.customWidgets = restoredWidgets.length ? restoredWidgets : [new SuperLoraHeaderWidget()];
    } catch (error) {
      console.warn("SuperLoRA: Failed to restore custom widgets, resetting defaults", error);
      node.customWidgets = [new SuperLoraHeaderWidget()];
    }
    node.setDirtyCanvas(true, true);
  }
  /**
   * Get execution data for backend
   */
  static getExecutionData(node) {
    const loraWidgets = node.customWidgets?.filter((w) => w instanceof SuperLoraWidget) || [];
    const executionData = {};
    loraWidgets.forEach((widget, index) => {
      if (widget.value.lora && widget.value.lora !== "None") {
        executionData[`lora_${index}`] = {
          lora: widget.value.lora,
          enabled: widget.value.enabled,
          strength: widget.value.strength,
          strengthClip: widget.value.strengthClip,
          triggerWords: widget.value.triggerWords,
          tag: widget.value.tag,
          autoFetched: widget.value.autoFetched
        };
      }
    });
    return executionData;
  }
  /**
   * Show toast notification with enhanced styling
   */
  static showToast(message, type = "info") {
    OverlayService.getInstance().showToast(message, type);
  }
  // Inline editors for better UX
  static showInlineNumber(event, initial, onCommit) {
    const input = document.createElement("input");
    input.type = "number";
    input.step = "0.05";
    input.value = String(initial ?? 0);
    let leftPx, topPx;
    try {
      if (event && typeof event.clientX === "number" && typeof event.clientY === "number") {
        leftPx = event.clientX + 8;
        topPx = event.clientY - 10;
        console.log(`[showInlineNumber] Using event coordinates: ${leftPx}, ${topPx}`);
      } else {
        const lastPointer = _SuperLoraNode._lastPointerScreen;
        leftPx = (lastPointer?.x ?? 100) + 8;
        topPx = (lastPointer?.y ?? 100) - 10;
        console.log(`[showInlineNumber] Using fallback coordinates: ${leftPx}, ${topPx}`);
      }
    } catch (error) {
      console.warn("[showInlineNumber] Coordinate calculation failed, using fallback:", error);
      const lastPointer = _SuperLoraNode._lastPointerScreen;
      leftPx = (lastPointer?.x ?? 100) + 8;
      topPx = (lastPointer?.y ?? 100) - 10;
    }
    input.style.cssText = `
      position: fixed;
      left: ${leftPx}px;
      top: ${topPx}px;
      width: 80px;
      padding: 4px 6px;
      font-size: 12px;
      z-index: 2147483647;
      pointer-events: auto;
      border: 1px solid #444;
      border-radius: 3px;
      background: #2f2f2f;
      color: #fff;
      box-shadow: 0 0 0 1px rgba(0,0,0,0.2) inset;
    `;
    let removedNum = false;
    const cleanup = () => {
      if (removedNum) return;
      removedNum = true;
      try {
        input.remove();
      } catch {
      }
    };
    const commit = () => {
      const v = parseFloat(input.value);
      if (!Number.isNaN(v)) onCommit(v);
      cleanup();
    };
    input.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "Enter" || e.keyCode === 13)) {
        commit();
        return;
      }
      if (e.key === "Enter") commit();
      if (e.key === "Escape") cleanup();
    });
    input.addEventListener("blur", cleanup);
    document.body.appendChild(input);
    input.focus();
    input.select();
  }
  static showInlineText(event, initial, onCommit, place) {
    const input = document.createElement("input");
    input.type = "text";
    input.value = initial ?? "";
    let leftPx, topPx, widthPx, heightPx;
    try {
      if (event && typeof event.clientX === "number" && typeof event.clientY === "number") {
        leftPx = event.clientX + 8;
        topPx = event.clientY - 10;
        widthPx = 260;
        heightPx = 20;
        console.log(`[showInlineText] Using event coordinates: ${leftPx}, ${topPx}`);
      } else if (place?.rect && place?.node) {
        const rect = place.rect;
        const node = place.node;
        const canvasEl = app?.canvas?.canvas;
        const cRect = canvasEl?.getBoundingClientRect?.();
        const ds = app?.canvas?.ds;
        const scale = ds?.scale || 1;
        const offset = ds?.offset || [0, 0];
        if (cRect) {
          const nodePos = node.pos || [0, 0];
          const worldX = nodePos[0] + rect.x;
          const worldY = nodePos[1] + rect.y;
          leftPx = cRect.left + (worldX + offset[0]) * scale;
          topPx = cRect.top + (worldY + offset[1]) * scale;
          widthPx = Math.max(100, rect.w * scale);
          heightPx = Math.max(16, rect.h * scale);
          console.log(`[showInlineText] Using place rect: ${leftPx}, ${topPx}, rect:`, rect);
        } else {
          throw new Error("Canvas rect not available");
        }
      } else {
        const lastPointer = _SuperLoraNode._lastPointerScreen;
        leftPx = (lastPointer?.x ?? 100) + 8;
        topPx = (lastPointer?.y ?? 100) - 10;
        widthPx = 260;
        heightPx = 20;
        console.log(`[showInlineText] Using fallback coordinates: ${leftPx}, ${topPx}`);
      }
    } catch (error) {
      console.warn("[showInlineText] Coordinate calculation failed, using fallback:", error);
      const lastPointer = _SuperLoraNode._lastPointerScreen;
      leftPx = (lastPointer?.x ?? 100) + 8;
      topPx = (lastPointer?.y ?? 100) - 10;
      widthPx = 260;
      heightPx = 20;
    }
    input.style.cssText = `
      position: fixed;
      left: ${leftPx}px;
      top: ${topPx}px;
      width: ${widthPx}px;
      height: ${heightPx}px;
      padding: 2px 6px;
      font-size: 12px;
      z-index: 2147483647;
      pointer-events: auto;
      border: 1px solid #444;
      border-radius: 3px;
      background: #2f2f2f;
      color: #fff;
      box-shadow: 0 0 0 1px rgba(0,0,0,0.2) inset;
    `;
    let removedTxt = false;
    const cleanup = () => {
      if (removedTxt) return;
      removedTxt = true;
      try {
        input.remove();
      } catch {
      }
    };
    const commit = () => {
      onCommit(input.value ?? "");
      cleanup();
    };
    input.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "Enter" || e.keyCode === 13)) {
        commit();
        return;
      }
      if (e.key === "Enter") commit();
      if (e.key === "Escape") cleanup();
    });
    input.addEventListener("blur", cleanup);
    document.body.appendChild(input);
    input.focus();
    input.select();
  }
  // Overlay utilities
  static showSearchOverlay(opts) {
    OverlayService.getInstance().showSearchOverlay(opts);
  }
  static showNameOverlay(opts) {
    const overlay = document.createElement("div");
    overlay.style.cssText = `position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 2147483600; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(2px);`;
    const panel = document.createElement("div");
    panel.style.cssText = `width: 420px; background: #222; border: 1px solid #444; border-radius: 8px; color: #fff; font-family: 'Segoe UI', Arial, sans-serif; box-shadow: 0 12px 30px rgba(0,0,0,0.4); overflow: hidden;`;
    const header = document.createElement("div");
    header.textContent = opts.title;
    header.style.cssText = `padding: 12px 14px; font-weight: 600; border-bottom: 1px solid #444; background: #2a2a2a;`;
    const form = document.createElement("form");
    form.style.cssText = `display: flex; gap: 8px; padding: 14px;`;
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = opts.placeholder;
    input.value = opts.initial || "";
    input.style.cssText = `flex: 1; padding: 10px 12px; border-radius: 6px; border: 1px solid #555; background: #1a1a1a; color: #fff; outline: none;`;
    const submit = document.createElement("button");
    submit.type = "submit";
    submit.textContent = opts.submitLabel || "Save";
    submit.style.cssText = `padding: 10px 14px; background: #1976d2; color: #fff; border: 1px solid #0d47a1; border-radius: 6px; cursor: pointer;`;
    const close = () => overlay.remove();
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      opts.onCommit(input.value);
      close();
    });
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
    document.addEventListener("keydown", function onKey(e) {
      if (e.key === "Escape") {
        close();
        document.removeEventListener("keydown", onKey);
      }
    });
    form.appendChild(input);
    form.appendChild(submit);
    panel.appendChild(header);
    panel.appendChild(form);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    setTimeout(() => input.focus(), 0);
  }
};
_SuperLoraNode.NODE_WIDGET_TOP_OFFSET = 68;
_SuperLoraNode.MARGIN_SMALL = 2;
_SuperLoraNode.loraService = LoraService.getInstance();
_SuperLoraNode.templateService = TemplateService.getInstance();
_SuperLoraNode.initialized = false;
_SuperLoraNode.initializationPromise = null;
let SuperLoraNode = _SuperLoraNode;
const GGUF_CLIP_WIDGET_MAP = {
  DualCLIPLoaderGGUF: ["clip_name1", "clip_name2"],
  TripleCLIPLoaderGGUF: ["clip_name1", "clip_name2", "clip_name3"],
  QuadrupleCLIPLoaderGGUF: ["clip_name1", "clip_name2", "clip_name3", "clip_name4"]
};
const _NodeEnhancerExtension = class _NodeEnhancerExtension {
  static debugLog(...args) {
    if (this.DEBUG) {
      console.debug("[NodeEnhancer]", ...args);
    }
  }
  static isExtensionEnabled() {
    try {
      return app$1?.ui?.settings?.getSettingValue?.(this.SETTINGS.enabled, true) !== false;
    } catch {
      return true;
    }
  }
  static isAutoEnhanceEnabled() {
    try {
      if (!this.isExtensionEnabled()) {
        return false;
      }
      return app$1?.ui?.settings?.getSettingValue?.(this.SETTINGS.autoEnhanceAll, false) === true;
    } catch {
      return false;
    }
  }
  static getComboValueList(widget) {
    const opts = widget?.options?.values;
    try {
      if (Array.isArray(opts)) {
        return opts.filter((entry) => typeof entry === "string");
      }
      if (opts && typeof opts === "object") {
        return Object.keys(opts).filter((key) => typeof key === "string");
      }
      if (typeof opts === "function") {
        const resolved = opts();
        if (Array.isArray(resolved)) {
          return resolved.filter((entry) => typeof entry === "string");
        }
      }
    } catch {
    }
    return null;
  }
  static normalizeValueForWidget(widget, value) {
    if (!widget || typeof value !== "string") {
      return value;
    }
    const candidates = this.getComboValueList(widget);
    if (!candidates || !candidates.length) {
      return value;
    }
    if (candidates.includes(value)) {
      return value;
    }
    const listHasBackslash = candidates.some((entry) => entry.includes("\\"));
    const listHasSlash = candidates.some((entry) => entry.includes("/"));
    const valueHasBackslash = value.includes("\\");
    const valueHasSlash = value.includes("/");
    if (valueHasSlash && !valueHasBackslash && listHasBackslash && !listHasSlash) {
      return value.replace(/\//g, "\\");
    }
    if (valueHasBackslash && !valueHasSlash && listHasSlash && !listHasBackslash) {
      return value.replace(/\\/g, "/");
    }
    return value;
  }
  static healComboValueFromList(widget) {
    try {
      if (!widget || typeof widget.value !== "string" || !widget.value) {
        return false;
      }
      const candidates = this.getComboValueList(widget);
      if (!candidates || !candidates.length) {
        return false;
      }
      if (candidates.includes(widget.value)) {
        return false;
      }
      const normKey = (s) => String(s).replace(/\\/g, "/").toLowerCase();
      const wanted = normKey(widget.value);
      const match = candidates.find((entry) => normKey(entry) === wanted);
      if (match && match !== widget.value) {
        widget.value = match;
        return true;
      }
    } catch {
    }
    return false;
  }
  static isGloballyEnabled() {
    try {
      if (!this.isExtensionEnabled()) {
        return false;
      }
      return app$1?.ui?.settings?.getSettingValue?.(this.SETTINGS.contextToggle, true) !== false;
    } catch {
      return true;
    }
  }
  static setNodeFlag(node, enabled) {
    try {
      node.properties = node.properties || {};
      if (enabled) {
        node.properties[_NodeEnhancerExtension.NODE_FLAG_KEY] = true;
        node.properties[_NodeEnhancerExtension.LEGACY_NODE_FLAG_KEY] = true;
      } else if (node.properties) {
        delete node.properties[_NodeEnhancerExtension.NODE_FLAG_KEY];
        delete node.properties[_NodeEnhancerExtension.LEGACY_NODE_FLAG_KEY];
      }
    } catch {
    }
  }
  static shouldRestoreEnabled(node, data) {
    if (data) {
      if (typeof data.ndSuperSelectorEnabled !== "undefined") {
        return !!data.ndSuperSelectorEnabled;
      }
      if (typeof data.ndPowerEnabled !== "undefined") {
        return !!data.ndPowerEnabled;
      }
    }
    try {
      const props = node?.properties;
      if (props?.[_NodeEnhancerExtension.NODE_FLAG_KEY] === true) {
        return true;
      }
      if (props?.[_NodeEnhancerExtension.LEGACY_NODE_FLAG_KEY] === true) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
  static createOverlayWidget(node, targetWidget, config) {
    const overlayWidget = {
      name: `${config.widgetName}__ndOverlay`,
      type: _NodeEnhancerExtension.OVERLAY_WIDGET_TYPE,
      value: targetWidget.value ?? "",
      _ndDisplayValue: targetWidget.value ?? "",
      _ndWidgetLabel: targetWidget.label || targetWidget.name || config.widgetName,
      _ndPlaceholder: _NodeEnhancerExtension.buildPlaceholder(config, targetWidget),
      __ndOverlay: true,
      __ndTargetWidgetName: config.widgetName,
      serialize: false,
      parent: node,
      computeSize(width) {
        const H = window.LiteGraph?.NODE_WIDGET_HEIGHT || 20;
        return [width, H];
      },
      draw(ctx, nodeRef, widgetWidth, widgetY) {
        const H = window.LiteGraph?.NODE_WIDGET_HEIGHT || 20;
        const margin = 6;
        const gutter = 10;
        const inset = 8;
        const x = margin + gutter;
        const y = widgetY;
        const availableWidth = Math.max(60, widgetWidth - margin * 2 - gutter * 2);
        const w = Math.max(120, Math.min(availableWidth, (nodeRef?.size?.[0] || widgetWidth) - 24));
        const caretX = x + w - inset - 12;
        const iconX = caretX + 10;
        const valueEnd = caretX - 10;
        const labelText = this._ndWidgetLabel || config.widgetName;
        const rawValue = this._ndDisplayValue && String(this._ndDisplayValue) || this._ndPlaceholder;
        const isPlaceholder = rawValue === this._ndPlaceholder;
        ctx.save();
        ctx.lineWidth = 1;
        ctx.strokeStyle = "#FFD700";
        ctx.fillStyle = "#1f1f1f";
        if (typeof ctx.roundRect === "function") {
          ctx.beginPath();
          ctx.roundRect(x, y, w, H, 8);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.fillRect(x, y, w, H);
          ctx.strokeRect(x, y, w, H);
        }
        ctx.font = "12px Arial";
        ctx.textBaseline = "middle";
        const labelFullWidth = ctx.measureText(labelText).width;
        const valueFullWidth = ctx.measureText(rawValue).width;
        const labelSpacing = 8;
        const totalSpace = valueEnd - (x + inset);
        const neededValueWidth = Math.min(valueFullWidth, totalSpace);
        const availableForLabel = totalSpace - neededValueWidth;
        let showLabel = labelFullWidth > 0;
        let labelWidth = 0;
        if (showLabel && availableForLabel > labelSpacing) {
          labelWidth = Math.min(labelFullWidth, availableForLabel - labelSpacing);
          showLabel = labelWidth > 0;
        } else {
          showLabel = false;
        }
        const valueStart = showLabel ? x + inset + labelWidth + labelSpacing : x + inset;
        const valueMaxWidth = Math.max(12, valueEnd - valueStart);
        const displayLabel = showLabel ? _NodeEnhancerExtension.truncateText(ctx, labelText, labelWidth, false) : "";
        const displayValue = valueFullWidth <= valueMaxWidth ? rawValue : _NodeEnhancerExtension.truncateText(ctx, rawValue, valueMaxWidth, false);
        if (showLabel) {
          ctx.textAlign = "left";
          ctx.fillStyle = "#888888";
          ctx.fillText(displayLabel, x + inset, y + H / 2);
        }
        ctx.textAlign = "right";
        ctx.fillStyle = isPlaceholder ? "#7a7a7a" : "#ffffff";
        ctx.fillText(displayValue, valueEnd, y + H / 2);
        ctx.textAlign = "center";
        ctx.fillStyle = "#ffd54f";
        ctx.fillText("⚡", iconX, y + H / 2 + 0.5);
        ctx.fillStyle = "#888";
        ctx.fillText("▾", caretX, y + H / 2 + 1);
        ctx.restore();
        this.last_y = widgetY;
        this.last_height = H;
      },
      mouse(event, pos, nodeRef) {
        const evtType = event?.type;
        const isLeft = event?.button === 0 || event?.which === 1 || event?.button === void 0;
        if (evtType === "pointerdown" && isLeft) {
          _NodeEnhancerExtension.showEnhancedPicker(nodeRef ?? node, config);
          return true;
        }
        if (evtType === "pointerup" && isLeft) {
          return true;
        }
        return false;
      },
      serializeValue() {
        if (typeof targetWidget.serializeValue === "function") {
          try {
            return targetWidget.serializeValue();
          } catch {
          }
        }
        return targetWidget.value;
      }
    };
    overlayWidget.callback = () => {
      _NodeEnhancerExtension.showEnhancedPicker(node, config);
    };
    overlayWidget.updateDisplay = (value, displayValue) => {
      const normalizedValue = typeof value === "string" ? value : "";
      const normalizedDisplay = typeof displayValue === "string" ? displayValue : normalizedValue;
      overlayWidget.value = normalizedValue;
      overlayWidget._ndDisplayValue = normalizedDisplay || "";
    };
    return overlayWidget;
  }
  static formatDisplayValue(value) {
    if (!value) {
      return "";
    }
    try {
      return String(value);
    } catch {
      return "";
    }
  }
  static buildPlaceholder(config, widget) {
    const base = widget?.label || widget?.name || config.label || config.widgetName || "file";
    return `Select ${base}`;
  }
  static ensureWidgetValueSelectable(widget, value) {
    if (!widget || typeof value !== "string") {
      return;
    }
    try {
      const before = widget.options?.values;
      if (!widget.options) {
        widget.options = { values: [value] };
        _NodeEnhancerExtension.debugLog("Initialized widget options for value", value, { widgetName: widget.name });
        return;
      }
      const options = widget.options;
      const { values } = options;
      if (Array.isArray(values)) {
        if (!values.includes(value)) {
          options.values = [...values, value];
          _NodeEnhancerExtension.debugLog("Appended value to array options", value, { widgetName: widget.name, before, after: options.values });
        }
        return;
      }
      if (values && typeof values === "object") {
        if (!(value in values)) {
          options.values = { ...values, [value]: value };
          _NodeEnhancerExtension.debugLog("Added value to object options", value, { widgetName: widget.name, before, after: options.values });
        }
        return;
      }
      options.values = [value];
      _NodeEnhancerExtension.debugLog("Reset options.values to single entry", value, { widgetName: widget.name, before });
    } catch (error) {
      console.warn("Node Enhancer: failed to sync widget values", error);
    }
  }
  static enhanceWidget(node, widget, config) {
    node.__ndEnhancedWidgets = node.__ndEnhancedWidgets || {};
    const meta = node.__ndEnhancedWidgets[config.widgetName] || { original: {} };
    const original = meta.original;
    if (!("callback" in original)) original.callback = widget.callback;
    if (!("mouse" in original)) original.mouse = widget.mouse;
    if (!("draw" in original)) original.draw = widget.draw;
    if (!("computeSize" in original)) original.computeSize = widget.computeSize;
    if (!("hidden" in original)) original.hidden = widget.hidden;
    if (!("options" in original)) original.options = widget.options ? { ...widget.options } : void 0;
    if (!("values" in original)) original.values = widget.options?.values ? [...widget.options.values] : void 0;
    if (!("serialize" in original)) original.serialize = widget.serialize;
    if (!("skipSerialize" in original)) original.skipSerialize = widget.skipSerialize;
    widget._ndPlaceholder = _NodeEnhancerExtension.buildPlaceholder(config, widget);
    widget.hidden = true;
    widget.computeSize = _NodeEnhancerExtension.HIDDEN_WIDGET_SIZE;
    if (!meta.overlay) {
      const overlay = _NodeEnhancerExtension.createOverlayWidget(node, widget, config);
      meta.overlay = overlay;
      if (!node.widgets) node.widgets = [];
      const idx = node.widgets.indexOf(widget);
      if (idx >= 0) node.widgets.splice(idx + 1, 0, overlay);
      else node.widgets.push(overlay);
    }
    widget.callback = function() {
      _NodeEnhancerExtension.showEnhancedPicker(node, config);
      return true;
    };
    widget.mouse = function(event, pos, nodeRef) {
      const evtType = event?.type;
      const isLeft = evtType === "pointerdown" && (event?.button === 0 || event?.which === 1 || event?.button === void 0);
      if (isLeft) {
        _NodeEnhancerExtension.showEnhancedPicker(nodeRef ?? node, config);
        return true;
      }
      if (typeof meta.original.mouse === "function") {
        return meta.original.mouse.call(this, event, pos, nodeRef ?? node);
      }
      return false;
    };
    node.__ndEnhancedWidgets[config.widgetName] = meta;
  }
  static restoreWidget(node, widget, config) {
    const meta = node.__ndEnhancedWidgets?.[config.widgetName];
    if (!meta) return;
    const original = meta.original || {};
    if (widget) {
      if ("callback" in original) {
        widget.callback = original.callback;
      } else {
        delete widget.callback;
      }
      if ("mouse" in original) {
        widget.mouse = original.mouse;
      } else {
        delete widget.mouse;
      }
      if ("draw" in original) {
        widget.draw = original.draw;
      } else {
        delete widget.draw;
      }
      if ("computeSize" in original) {
        if (original.computeSize) {
          widget.computeSize = original.computeSize;
        } else {
          delete widget.computeSize;
        }
      }
      if ("serialize" in original) {
        widget.serialize = original.serialize;
      } else {
        delete widget.serialize;
      }
      if ("skipSerialize" in original) {
        widget.skipSerialize = original.skipSerialize;
      } else {
        delete widget.skipSerialize;
      }
      if ("options" in original) {
        if (original.options === void 0) {
          delete widget.options;
        } else {
          widget.options = { ...original.options };
          if (original.values !== void 0) {
            widget.options.values = [...original.values];
          }
        }
      } else if (widget.options && "values" in widget.options) {
        delete widget.options.values;
      }
      // New frontend (>= 1.5x): widget.hidden is a store-backed accessor on
      // BaseWidget.prototype, so `delete widget.hidden` is a no-op and the
      // widget stays hidden forever after disabling ND Super Selector.
      // Assign explicitly instead (works for class widgets and plain objects).
      widget.hidden = original.hidden === true;
      delete widget._ndPlaceholder;
      delete widget.last_y;
      delete widget.last_height;
      delete widget._ndDisplayValue;
    }
    if (meta.overlay) {
      const idx = node.widgets?.indexOf(meta.overlay) ?? -1;
      if (idx >= 0) node.widgets.splice(idx, 1);
      delete meta.overlay;
    }
    delete node.__ndEnhancedWidgets[config.widgetName];
    if (node.__ndEnhancedWidgets && Object.keys(node.__ndEnhancedWidgets).length === 0) {
      delete node.__ndEnhancedWidgets;
    }
    _NodeEnhancerExtension.restoreTitle(node);
  }
  /**
   * Initialize the node enhancer extension
   */
  static async initialize() {
    console.log("Node Enhancer Extension: Initializing...");
    this.loadUserPreferences();
    await this.filePickerService;
    this.setupSettingsSync();
    this.refreshSettingState();
    console.log("Node Enhancer Extension: Initialized successfully");
  }
  /**
   * Set up enhancement for a specific node type
   */
  static setup(nodeType, nodeData) {
    const baseConfigs = this.getBaseConfigsForType(nodeData?.name);
    const originalCreate = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function() {
      originalCreate?.apply(this, arguments);
      const configs = _NodeEnhancerExtension.buildConfigsForNode(this, baseConfigs);
      if (!configs.length) {
        this.__ndPowerEnabled = false;
        _NodeEnhancerExtension.restoreTitle(this);
        _NodeEnhancerExtension.setNodeFlag(this, false);
        return;
      }
      if (typeof this.__ndPowerEnabled === "undefined") {
        this.__ndPowerEnabled = false;
      }
      if (typeof this.__ndOriginalTitle === "undefined") {
        this.__ndOriginalTitle = this.title || this.constructor?.title || "";
      }
      if (this.__ndPowerEnabled) {
        _NodeEnhancerExtension.enableConfigsForNode(this, configs);
        _NodeEnhancerExtension.applyTitleBadge(this);
      } else {
        _NodeEnhancerExtension.restoreTitle(this);
      }
    };
    const originalMenu = nodeType.prototype.getExtraMenuOptions;
    nodeType.prototype.getExtraMenuOptions = function(canvas, optionsArr) {
      if (!_NodeEnhancerExtension.isGloballyEnabled()) {
        return originalMenu ? originalMenu.call(this, canvas, optionsArr) : optionsArr;
      }
      const configs = _NodeEnhancerExtension.buildConfigsForNode(this, baseConfigs);
      if (!configs.length) {
        return originalMenu ? originalMenu.call(this, canvas, optionsArr) : optionsArr;
      }
      const providedOptions = Array.isArray(optionsArr) ? optionsArr : [];
      const originalResult = originalMenu ? originalMenu.call(this, canvas, providedOptions) : providedOptions;
      const targetOptions = Array.isArray(originalResult) ? originalResult : Array.isArray(optionsArr) ? optionsArr : providedOptions;
      const options = Array.isArray(targetOptions) ? targetOptions : [];
      for (let i = options.length - 1; i >= 0; i--) {
        if (options[i]?.__ndSuperSelectorToggle) {
          options.splice(i, 1);
        }
      }
      const toggleOption = {
        content: this.__ndPowerEnabled ? "➖ Disable ND Super Selector" : "⚡ Enable ND Super Selector",
        callback: () => {
          try {
            if (this.__ndPowerEnabled) {
              _NodeEnhancerExtension.disableAllForNodeInstance(this, baseConfigs);
              this.__ndPowerEnabled = false;
              _NodeEnhancerExtension.restoreTitle(this);
              _NodeEnhancerExtension.setNodeFlag(this, false);
              this.setDirtyCanvas?.(true, true);
            } else {
              _NodeEnhancerExtension.enableAllForNodeInstance(this, baseConfigs);
            }
          } catch (error) {
            console.warn("Node Enhancer: toggle failed", error);
          }
        }
      };
      toggleOption.__ndSuperSelectorToggle = true;
      if (options.length && options[0] !== null) {
        options.unshift(null);
      }
      options.unshift(toggleOption);
      if (Array.isArray(optionsArr) && optionsArr !== options) {
        optionsArr.length = 0;
        optionsArr.push(...options);
      }
      return options;
    };
    const originalSerialize = nodeType.prototype.serialize;
    nodeType.prototype.serialize = function() {
      const data = originalSerialize ? originalSerialize.apply(this, arguments) : {};
      try {
        const configs = _NodeEnhancerExtension.buildConfigsForNode(this, baseConfigs);
        const hasEnhancements = configs.length > 0 || this.__ndEnhancedWidgets && Object.keys(this.__ndEnhancedWidgets).length > 0;
        if (!hasEnhancements) {
          return data;
        }
        const enabled = !!this.__ndPowerEnabled;
        data.ndSuperSelectorEnabled = enabled;
        data.ndPowerEnabled = enabled;
        data.properties = data.properties || {};
        if (enabled) {
          data.properties[_NodeEnhancerExtension.NODE_FLAG_KEY] = true;
          data.properties[_NodeEnhancerExtension.LEGACY_NODE_FLAG_KEY] = true;
        } else if (data.properties) {
          delete data.properties[_NodeEnhancerExtension.NODE_FLAG_KEY];
          delete data.properties[_NodeEnhancerExtension.LEGACY_NODE_FLAG_KEY];
        }
        if (this.__ndEnhancedWidgets && Array.isArray(this.widgets)) {
          const hasOverlayWidgets = this.widgets.some((w) => w?.__ndOverlay);
          if (hasOverlayWidgets) {
            const serializedValues = [];
            for (const widget of this.widgets) {
              if (!widget || widget.__ndOverlay || widget.serialize === false) {
                continue;
              }
              if (typeof widget.serializeValue === "function") {
                try {
                  serializedValues.push(widget.serializeValue());
                  continue;
                } catch {
                }
              }
              serializedValues.push(widget.value ?? null);
            }
            data.widgets_values = serializedValues;
          }
        }
      } catch {
      }
      return data;
    };
    const originalConfigure = nodeType.prototype.configure;
    nodeType.prototype.configure = function(data) {
      if (originalConfigure) {
        originalConfigure.call(this, data);
      }
      try {
        if (typeof this.__ndPowerEnabled === "undefined") this.__ndPowerEnabled = false;
        const configs = _NodeEnhancerExtension.buildConfigsForNode(this, baseConfigs);
        if (!configs.length) {
          this.__ndPowerEnabled = false;
          _NodeEnhancerExtension.restoreTitle(this);
          _NodeEnhancerExtension.setNodeFlag(this, false);
          return;
        }
        const shouldEnable = _NodeEnhancerExtension.shouldRestoreEnabled(this, data);
        if (shouldEnable) {
          if (!this.__ndPowerEnabled) {
            this.__ndPowerEnabled = true;
            _NodeEnhancerExtension.enableConfigsForNode(this, configs);
          }
          _NodeEnhancerExtension.applyTitleBadge(this);
        } else if (this.__ndPowerEnabled) {
          _NodeEnhancerExtension.disableConfigsForNode(this, configs);
          this.__ndPowerEnabled = false;
          _NodeEnhancerExtension.restoreTitle(this);
        } else {
          _NodeEnhancerExtension.disableConfigsForNode(this, configs);
          _NodeEnhancerExtension.restoreTitle(this);
        }
        for (const healCfg of configs) {
          const healWidget = this.widgets?.find((w) => w.name === healCfg.widgetName);
          if (!healWidget) continue;
          if (_NodeEnhancerExtension.healComboValueFromList(healWidget)) {
            const healedMeta = this.__ndEnhancedWidgets?.[healCfg.widgetName];
            if (healedMeta?.overlay) {
              healedMeta.overlay.updateDisplay(healWidget.value, healWidget.value);
            }
            this.setDirtyCanvas?.(true, true);
          }
        }
        _NodeEnhancerExtension.setNodeFlag(this, !!this.__ndPowerEnabled);
      } catch {
      }
    };
    const originalOnMouseDown = nodeType.prototype.onMouseDown;
    nodeType.prototype.onMouseDown = function(event, pos) {
      const activeConfigs = _NodeEnhancerExtension.buildConfigsForNode(this, baseConfigs);
      const fallbackConfigs = activeConfigs.length ? activeConfigs : Object.keys(this.__ndEnhancedWidgets || {}).map((widgetName) => _NodeEnhancerExtension.createConfigFromWidget(this, widgetName)).filter((cfg) => !!cfg);
      const handled = fallbackConfigs.some(
        (cfg) => _NodeEnhancerExtension.handleEnhancedMouseDown(this, event, pos, cfg)
      );
      if (handled) {
        return true;
      }
      return originalOnMouseDown ? originalOnMouseDown.call(this, event, pos) : false;
    };
    if (Array.isArray(baseConfigs) && baseConfigs.length) {
      console.log(`Node Enhancer: Registered ND Super Selector support for ${nodeData?.name}`);
    }
  }
  /**
   * Set up enhanced node with custom widgets
   */
  static setupEnhancedNode(node, config) {
    if (node.__ndEnhancedWidgets?.[config.widgetName]) {
      return;
    }
    const widget = node.widgets?.find((w) => w.name === config.widgetName);
    if (!widget) {
      console.warn(`Node Enhancer: Could not find widget "${config.widgetName}" in ${config.nodeType}`);
      return;
    }
    node.__ndPowerEnabled = true;
    node.__ndEnhancedWidgets = node.__ndEnhancedWidgets || {};
    node.__ndEnhancedWidgets[config.widgetName] = node.__ndEnhancedWidgets[config.widgetName] || { original: {} };
    const metaEntry = node.__ndEnhancedWidgets[config.widgetName];
    metaEntry.fileType = config.fileType;
    if (config.label) {
      metaEntry.label = config.label;
    }
    _NodeEnhancerExtension.debugLog("Enhancing widget", {
      nodeType: node?.type,
      widgetName: widget?.name,
      initialValue: widget?.value,
      options: widget?.options?.values
    });
    this.enhanceWidget(node, widget, config);
    this.applyTitleBadge(node);
    this.setNodeFlag(node, true);
  }
  /** Enable enhancement for a specific node instance */
  static enableForNode(node, config) {
    this.setupEnhancedNode(node, config);
    this.setNodeFlag(node, true);
  }
  static enableConfigsForNode(node, configs) {
    if (!node || !Array.isArray(configs) || !configs.length) {
      return;
    }
    let anyEnabled = false;
    for (const config of configs) {
      try {
        this.enableForNode(node, config);
        anyEnabled = true;
      } catch (error) {
        console.warn("Node Enhancer: failed to enable config", config, error);
      }
    }
    if (anyEnabled) {
      node.__ndPowerEnabled = true;
      this.applyTitleBadge(node);
      this.setNodeFlag(node, true);
      node.setDirtyCanvas?.(true, true);
    }
  }
  static enableAllForNodeInstance(node, baseConfigs) {
    if (!node) {
      return false;
    }
    const configs = this.buildConfigsForNode(node, baseConfigs);
    if (!configs.length) {
      return false;
    }
    this.enableConfigsForNode(node, configs);
    return true;
  }
  static disableAllForNodeInstance(node, baseConfigs) {
    if (!node) {
      return;
    }
    let configs = this.buildConfigsForNode(node, baseConfigs);
    if ((!configs || !configs.length) && node.__ndEnhancedWidgets) {
      configs = Object.keys(node.__ndEnhancedWidgets).map((widgetName) => this.createConfigFromWidget(node, widgetName)).filter((cfg) => !!cfg);
    }
    if (!configs || !configs.length) {
      node.__ndPowerEnabled = false;
      _NodeEnhancerExtension.restoreTitle(node);
      this.setNodeFlag(node, false);
      return;
    }
    this.disableConfigsForNode(node, configs);
  }
  static enableEnhancementsForNode(node) {
    if (!this.isExtensionEnabled()) {
      return false;
    }
    if (!node?.type) {
      return false;
    }
    return this.enableAllForNodeInstance(node);
  }
  /** Disable enhancement for a specific node instance */
  static disableForNode(node, config) {
    if (!node.__ndEnhancedWidgets || !node.__ndEnhancedWidgets[config.widgetName]) {
      return;
    }
    const widget = node.widgets?.find((w) => w.name === config.widgetName);
    _NodeEnhancerExtension.restoreWidget(node, widget, config);
    if (!node.__ndEnhancedWidgets) {
      node.__ndPowerEnabled = false;
    }
    _NodeEnhancerExtension.restoreTitle(node);
    this.setNodeFlag(node, !!node.__ndPowerEnabled);
  }
  static showEnhancedPicker(node, config) {
    const widget = node.widgets?.find((w) => w.name === config.widgetName);
    if (!widget) return;
    const currentValue = widget.value;
    this.filePickerService.showFilePicker(
      config.fileType,
      (file) => {
        let newValue;
        if (file && typeof file.id === "string") {
          newValue = file.id;
        } else if (file && typeof file.path === "string") {
          newValue = file.path;
        } else if (file && typeof file.filename === "string") {
          newValue = file.filename;
        }
        _NodeEnhancerExtension.debugLog("File picker selection", {
          nodeType: node?.type,
          widgetName: config.widgetName,
          file,
          proposedValue: newValue,
          existingValues: widget.options?.values
        });
        if (typeof newValue === "string") {
          try {
            const normalizedValue = _NodeEnhancerExtension.normalizeValueForWidget(widget, newValue);
            widget.value = normalizedValue;
            _NodeEnhancerExtension.ensureWidgetValueSelectable(widget, normalizedValue);
            _NodeEnhancerExtension.debugLog("Applied widget value", {
              nodeType: node?.type,
              widgetName: config.widgetName,
              newValue: normalizedValue,
              updatedValues: widget.options?.values
            });
          } catch (error) {
            console.warn("Node Enhancer: failed to assign widget value", error);
          }
        }
        const meta = node.__ndEnhancedWidgets?.[config.widgetName];
        if (meta?.overlay) {
          const displayValue = _NodeEnhancerExtension.formatDisplayValue(
            file && typeof file.label === "string" && file.label || file && typeof file.path === "string" && file.path || file && typeof file.filename === "string" && file.filename || widget.value
          );
          meta.overlay.updateDisplay(widget.value, displayValue);
          _NodeEnhancerExtension.debugLog("Updated overlay display", {
            nodeType: node?.type,
            widgetName: config.widgetName,
            displayValue,
            widgetValue: widget.value
          });
        }
        node.setDirtyCanvas?.(true, true);
      },
      {
        title: `Select ${config.fileType}`,
        multiSelect: false,
        currentValue
      }
    );
  }
  /**
   * Handle mouse events for enhanced widgets
   */
  static handleEnhancedMouseDown(node, event, pos, config) {
    if (!node.__ndPowerEnabled || !node.__ndEnhancedWidgets || !node.__ndEnhancedWidgets[config.widgetName]) return false;
    const widget = node.widgets?.find((w) => w.name === config.widgetName);
    if (!widget) return false;
    try {
      const isLeft = event?.button === 0 || event?.which === 1 || !("button" in (event || {}));
      if (!isLeft) return false;
      const y = widget?.last_y ?? null;
      const H = window.LiteGraph?.NODE_WIDGET_HEIGHT || 20;
      if (y == null) return false;
      const withinX = pos[0] >= 0 && pos[0] <= (node.size?.[0] || 200);
      const withinY = pos[1] >= y && pos[1] <= y + H;
      if (withinX && withinY) {
        this.showEnhancedPicker(node, config);
        return true;
      }
    } catch {
    }
    return false;
  }
  /**
   * Draw enhanced widgets (visual indicators)
   */
  static drawEnhancedWidgets(node, ctx) {
    if (!node.__ndPowerEnabled) return;
  }
  static applyTitleBadge(node) {
    try {
      if (typeof node.__ndOriginalTitle === "undefined") {
        node.__ndOriginalTitle = node.title || node.constructor?.title || "";
      } else {
        node.title = node.__ndOriginalTitle;
      }
    } catch {
    }
  }
  static restoreTitle(node) {
    try {
      if (typeof node.__ndOriginalTitle !== "undefined") {
        node.title = node.__ndOriginalTitle;
      }
    } catch {
    }
  }
  // Preference helpers retained for future global defaults (no-op currently)
  static loadUserPreferences() {
  }
  static saveUserPreferences() {
  }
  static getAvailableEnhancements() {
    return this.ENHANCED_NODES;
  }
  static enableEnhancement(nodeTypeName) {
    if (!this.isExtensionEnabled()) {
      return;
    }
    const graph = window.app?.graph;
    if (!graph) {
      return;
    }
    (graph._nodes || []).forEach((node) => {
      if (node?.type === nodeTypeName) {
        try {
          this.enableAllForNodeInstance(node);
        } catch (error) {
          console.warn("Node Enhancer: failed to enable node", node, error);
        }
      }
    });
  }
  static setupSettingsSync(attempt = 0) {
    if (this.settingsHookInitialized) {
      return;
    }
    const settings = app$1?.ui?.settings;
    if (!settings) {
      if (attempt > 20) {
        return;
      }
      const delay = Math.min(1e3, 100 * Math.max(1, attempt + 1));
      setTimeout(() => this.setupSettingsSync(attempt + 1), delay);
      return;
    }
    this.settingsHookInitialized = true;
    try {
      const originalSet = settings.setSettingValue?.bind(settings);
      if (typeof originalSet === "function") {
        const self = this;
        settings.setSettingValue = function(key, value) {
          const result = originalSet(key, value);
          self.handleSettingChanged(key, value);
          return result;
        };
      }
    } catch (error) {
      console.warn("Node Enhancer: failed to hook settings.setSettingValue", error);
    }
    try {
      const originalLoad = settings.loadSettings?.bind(settings);
      if (typeof originalLoad === "function") {
        const self = this;
        settings.loadSettings = async function(...args) {
          const result = await originalLoad(...args);
          self.refreshSettingState();
          return result;
        };
      }
    } catch (error) {
      console.warn("Node Enhancer: failed to hook settings.loadSettings", error);
    }
    this.refreshSettingState();
  }
  static handleSettingChanged(key, value) {
    if (this.suppressSettingSideEffects) {
      return;
    }
    if (key === this.SETTINGS.enabled) {
      this.handleGlobalEnabledChange(value !== false);
    }
    if (key === this.SETTINGS.autoEnhanceAll) {
      if (value) {
        this.applyAutoEnhanceAll();
      }
    }
    if (key === this.SETTINGS.contextToggle || key === this.SETTINGS.autoEnhanceAll || key === this.SETTINGS.enabled) {
      this.updateSettingVisibility();
    }
  }
  static refreshSettingState() {
    this.updateSettingVisibility();
    if (!this.isExtensionEnabled()) {
      this.disableAllEnhancements();
      return;
    }
    if (this.isAutoEnhanceEnabled()) {
      this.applyAutoEnhanceAll();
    }
  }
  static handleGlobalEnabledChange(enabled) {
    if (!enabled) {
      this.disableAllEnhancements();
    } else if (this.isAutoEnhanceEnabled()) {
      this.applyAutoEnhanceAll();
    }
  }
  static updateSettingVisibility() {
    if (typeof document === "undefined") {
      return;
    }
    this.ensureSettingsStyles();
    const enabled = this.isExtensionEnabled();
    const targets = [this.SETTINGS.autoEnhanceAll, this.SETTINGS.contextToggle];
    for (const id of targets) {
      const element = this.findSettingElement(id);
      this.setSettingDisabled(element, !enabled);
    }
  }
  static ensureSettingsStyles() {
    if (this.settingsStyleInjected || typeof document === "undefined") {
      return;
    }
    try {
      const style = document.createElement("style");
      style.id = "nd-super-nodes-settings-styles";
      style.textContent = `
        .nd-super-nodes-setting-disabled {
          opacity: 0.5;
          pointer-events: none;
        }
        .nd-super-nodes-setting-disabled input,
        .nd-super-nodes-setting-disabled button,
        .nd-super-nodes-setting-disabled select {
          pointer-events: none;
        }
      `;
      document.head?.appendChild(style);
      this.settingsStyleInjected = true;
    } catch (error) {
      console.warn("Node Enhancer: failed to inject settings styles", error);
    }
  }
  static findSettingElement(id) {
    if (typeof document === "undefined") {
      return null;
    }
    const settings = app$1?.ui?.settings;
    const candidates = [];
    try {
      const stored = settings?.settings?.get?.(id)?.element ?? settings?.settings?.[id]?.element;
      if (stored instanceof HTMLElement) {
        candidates.push(stored);
      }
    } catch {
    }
    const selectorCandidates = [
      `[data-setting-id="${id}"]`,
      `[data-id="${id}"]`,
      `[data-setting="${id}"]`,
      `[data-settingname="${id}"]`,
      (() => {
        try {
          if (typeof window.CSS?.escape === "function") {
            return `#${window.CSS.escape(id)}`;
          }
        } catch {
        }
        return null;
      })()
    ].filter(Boolean);
    for (const selector of selectorCandidates) {
      try {
        const el = document.querySelector(selector);
        if (el instanceof HTMLElement) {
          candidates.push(el);
        }
      } catch {
      }
    }
    for (const candidate of candidates) {
      if (candidate instanceof HTMLElement) {
        return candidate;
      }
    }
    try {
      const label = Array.from(document.querySelectorAll("label")).find((node) => node.textContent?.includes(id));
      if (label && label instanceof HTMLElement) {
        return label.closest(".setting-item");
      }
    } catch {
    }
    return null;
  }
  static setSettingDisabled(element, disabled) {
    if (!element) {
      return;
    }
    const className = "nd-super-nodes-setting-disabled";
    if (disabled) {
      element.classList.add(className);
      element.setAttribute("aria-disabled", "true");
    } else {
      element.classList.remove(className);
      element.removeAttribute("aria-disabled");
    }
    const inputs = element.querySelectorAll("input, button, select");
    inputs.forEach((input) => {
      if (input instanceof HTMLInputElement || input instanceof HTMLButtonElement || input instanceof HTMLSelectElement) {
        input.disabled = disabled;
      }
    });
  }
  static applyAutoEnhanceAll() {
    if (!this.isAutoEnhanceEnabled()) {
      return;
    }
    const graph = window.app?.graph;
    if (!graph) {
      return;
    }
    const nodes = Array.isArray(graph._nodes) ? graph._nodes : [];
    nodes.forEach((node) => {
      if (!node?.type) {
        return;
      }
      this.enableAllForNodeInstance(node);
    });
  }
  static disableAllEnhancements() {
    const graph = window.app?.graph;
    if (!graph) {
      return;
    }
    const nodes = Array.isArray(graph._nodes) ? graph._nodes : [];
    nodes.forEach((node) => {
      if (!node?.type) {
        return;
      }
      this.disableAllForNodeInstance(node);
    });
  }
  static disableConfigsForNode(node, configs) {
    if (!node) {
      return;
    }
    let targets = Array.isArray(configs) ? configs : [];
    if ((!targets || !targets.length) && node.__ndEnhancedWidgets) {
      targets = Object.keys(node.__ndEnhancedWidgets).map((widgetName) => this.createConfigFromWidget(node, widgetName)).filter((cfg) => !!cfg);
    }
    if (!targets || !targets.length) {
      return;
    }
    let changed = false;
    for (const config of targets) {
      if (node.__ndEnhancedWidgets?.[config.widgetName]) {
        try {
          this.disableForNode(node, config);
          changed = true;
        } catch (error) {
          console.warn("Node Enhancer: failed to disable config", config, error);
        }
      }
    }
    if (changed) {
      node.__ndPowerEnabled = false;
      this.setNodeFlag(node, false);
      node.setDirtyCanvas?.(true, true);
    }
  }
  static onGraphConfigured() {
    if (!this.isExtensionEnabled()) {
      this.disableAllEnhancements();
      return;
    }
    if (this.isAutoEnhanceEnabled()) {
      this.applyAutoEnhanceAll();
    }
  }
  static getBaseConfigsForType(nodeTypeName) {
    if (typeof nodeTypeName !== "string" || !nodeTypeName) {
      return [];
    }
    return this.ENHANCED_NODES.filter((cfg) => cfg.nodeType === nodeTypeName).map((cfg) => ({ ...cfg }));
  }
  static buildConfigsForNode(node, baseConfigs) {
    if (!node) {
      return [];
    }
    const base = Array.isArray(baseConfigs) ? baseConfigs.map((cfg) => ({ ...cfg })) : this.getBaseConfigsForType(node.type);
    const dynamic = this.detectFileWidgets(node);
    return this.mergeConfigLists(base, dynamic);
  }
  static mergeConfigLists(base, extras) {
    const map = /* @__PURE__ */ new Map();
    (base || []).forEach((cfg) => {
      if (cfg?.widgetName) {
        map.set(cfg.widgetName, { ...cfg });
      }
    });
    (extras || []).forEach((cfg) => {
      if (cfg?.widgetName && !map.has(cfg.widgetName)) {
        map.set(cfg.widgetName, { ...cfg });
      }
    });
    return Array.from(map.values());
  }
  static createConfigFromWidget(node, widgetName) {
    if (!node || typeof widgetName !== "string" || !widgetName) {
      return null;
    }
    const meta = node.__ndEnhancedWidgets?.[widgetName];
    const widget = Array.isArray(node.widgets) ? node.widgets.find((w) => w && w.name === widgetName) : null;
    let fileType = null;
    if (meta && typeof meta.fileType === "string" && meta.fileType) {
      fileType = meta.fileType;
    } else if (widget) {
      const guessed = this.guessFileType(node, widget);
      if (guessed) {
        fileType = guessed;
      }
    }
    if (!fileType) {
      return null;
    }
    const label = meta && typeof meta.label === "string" && meta.label || this.buildAutoLabel(widgetName, fileType);
    return {
      nodeType: node.type,
      fileType,
      widgetName,
      label
    };
  }
  static detectFileWidgets(node) {
    if (!node || !Array.isArray(node.widgets) || !node.widgets.length) {
      return [];
    }
    const results = [];
    for (const widget of node.widgets) {
      if (!this.isWidgetEligibleForAutoDetection(node, widget)) {
        continue;
      }
      const widgetName = typeof widget?.name === "string" ? widget.name : typeof widget?.label === "string" ? widget.label : null;
      if (!widgetName) {
        continue;
      }
      const fileType = this.guessFileType(node, widget);
      if (!fileType) {
        continue;
      }
      results.push({
        nodeType: node.type,
        fileType,
        widgetName,
        label: this.buildAutoLabel(widgetName, fileType)
      });
    }
    return results;
  }
  static isWidgetEligibleForAutoDetection(node, widget) {
    if (!widget || typeof widget !== "object") {
      return false;
    }
    if (widget.__ndOverlay) {
      return false;
    }
    if (widget.type && typeof widget.type === "string") {
      const typeLower = widget.type.toLowerCase();
      if (typeLower !== "combo" && typeLower !== "text" && typeLower !== "string") {
        return false;
      }
    }
    const stringValues = this.extractStringValues(widget);
    if (!stringValues.length) {
      return false;
    }
    const hasFileLikeValue = stringValues.some((value) => this.isFileishValue(value));
    if (!hasFileLikeValue) {
      return false;
    }
    const widgetName = typeof widget?.name === "string" ? widget.name : "";
    if (node?.__ndEnhancedWidgets && widgetName && node.__ndEnhancedWidgets[widgetName]) {
      return true;
    }
    return true;
  }
  static extractStringValues(widget) {
    const result = [];
    if (!widget) {
      return result;
    }
    const values = widget.options?.values;
    if (Array.isArray(values)) {
      for (const entry of values) {
        if (typeof entry === "string") {
          result.push(entry);
        } else if (entry && typeof entry === "object") {
          if (typeof entry.value === "string") {
            result.push(entry.value);
          }
          if (typeof entry.name === "string") {
            result.push(entry.name);
          }
          if (typeof entry.label === "string") {
            result.push(entry.label);
          }
        }
      }
    } else if (values && typeof values === "object") {
      for (const [key, value] of Object.entries(values)) {
        if (typeof key === "string") {
          result.push(key);
        }
        if (typeof value === "string") {
          result.push(value);
        }
      }
    }
    if (typeof widget.value === "string") {
      result.push(widget.value);
    }
    return result.filter((entry) => typeof entry === "string" && !!entry).filter((entry, index, arr) => arr.indexOf(entry) === index);
  }
  static isFileishValue(value) {
    if (typeof value !== "string" || !value.trim()) {
      return false;
    }
    const trimmed = value.trim();
    if (trimmed.toLowerCase() === "none") {
      return false;
    }
    if (/[\\/]/.test(trimmed)) {
      return true;
    }
    return /\.[a-z0-9]{2,5}(?:\s|$)/i.test(trimmed);
  }
  static guessFileType(node, widget) {
    const widgetName = typeof widget?.name === "string" ? widget.name : "";
    const nodeType = typeof node?.type === "string" ? node.type : "";
    const values = this.extractStringValues(widget);
    const byValues = this.guessFileTypeFromValues(values, widgetName, nodeType);
    if (byValues) {
      return byValues;
    }
    return this.guessFileTypeFromHints(widgetName, nodeType);
  }
  static guessFileTypeFromValues(values, widgetName, nodeType) {
    if (!Array.isArray(values) || !values.length) {
      return null;
    }
    const lowered = values.map((value) => typeof value === "string" ? value.toLowerCase() : "").filter(Boolean);
    if (!lowered.length) {
      return null;
    }
    const includes = (keyword) => lowered.some((val) => val.includes(keyword));
    if (includes("loras/") || includes("loras\\") || includes("/lora/") || includes("\\lora\\")) {
      return "loras";
    }
    if (includes("/vae") || includes("\\vae") || includes("/autoencoder") || includes("vae/")) {
      return "vae";
    }
    if (includes("/clip") || includes("text_encoder") || includes("text-encoder")) {
      return "text_encoders";
    }
    if (includes("controlnet") || includes("control_net")) {
      return "controlnet";
    }
    if (includes("/unet") || includes("\\unet") || includes("diffusion")) {
      return lowered.some((val) => val.endsWith(".gguf")) ? "gguf_unet_models" : "diffusion_models";
    }
    if (includes("upscale")) {
      return "upscale_models";
    }
    const lookup = this.getExtensionLookup();
    for (const entry of lowered) {
      const ext = this.extractExtension(entry);
      if (!ext) {
        continue;
      }
      const candidates = lookup.get(ext);
      if (!candidates || !candidates.length) {
        continue;
      }
      if (candidates.length === 1) {
        return candidates[0];
      }
      const hint = this.guessFileTypeFromHints(widgetName, nodeType);
      if (hint && candidates.includes(hint)) {
        return hint;
      }
      if (ext === ".gguf") {
        if (candidates.includes("text_encoders") && (entry.includes("clip") || entry.includes("text") || widgetName.toLowerCase().includes("clip"))) {
          return "text_encoders";
        }
        if (candidates.includes("gguf_unet_models")) {
          return "gguf_unet_models";
        }
      }
      if (candidates.includes("models")) {
        return "models";
      }
    }
    return null;
  }
  static guessFileTypeFromHints(widgetName, nodeType) {
    const hints = [widgetName, nodeType].filter((value) => typeof value === "string" && !!value).map((value) => value.toLowerCase());
    if (!hints.length) {
      return null;
    }
    const includes = (keyword) => hints.some((hint) => hint.includes(keyword));
    if (includes("lora")) {
      return "loras";
    }
    if (includes("controlnet")) {
      return "controlnet";
    }
    if (includes("vae")) {
      return "vae";
    }
    if (includes("clip") || includes("text_encoder")) {
      return "text_encoders";
    }
    if (includes("gguf")) {
      if (includes("clip")) {
        return "text_encoders";
      }
      return "gguf_unet_models";
    }
    if (includes("unet") || includes("diffusion")) {
      return "diffusion_models";
    }
    if (includes("upscale")) {
      return "upscale_models";
    }
    if (includes("checkpoint") || includes("ckpt") || includes("model")) {
      return "models";
    }
    return null;
  }
  static getExtensionLookup() {
    if (this.extensionLookup) {
      return this.extensionLookup;
    }
    const lookup = /* @__PURE__ */ new Map();
    try {
      const fileTypes = FilePickerService.getSupportedFileTypes();
      Object.entries(fileTypes).forEach(([fileType, config]) => {
        (config?.fileExtensions || []).forEach((ext) => {
          if (typeof ext !== "string") {
            return;
          }
          const normalized = ext.toLowerCase();
          const existing = lookup.get(normalized) || [];
          if (!existing.includes(fileType)) {
            existing.push(fileType);
          }
          lookup.set(normalized, existing);
        });
      });
    } catch (error) {
      console.warn("Node Enhancer: failed to build extension lookup", error);
    }
    this.extensionLookup = lookup;
    return lookup;
  }
  static extractExtension(value) {
    if (typeof value !== "string") {
      return null;
    }
    const match = value.match(/\.([a-z0-9]{2,5})(?:\?|$)/i);
    if (!match) {
      return null;
    }
    return `.${match[1].toLowerCase()}`;
  }
  static buildAutoLabel(_widgetName, _fileType) {
    return this.DEFAULT_LABEL;
  }
  static loadSet(key, sessionFirst = false) {
    try {
      if (sessionFirst) {
        const fromSession = sessionStorage.getItem(key);
        if (fromSession) return new Set(JSON.parse(fromSession));
      }
      const fromLocal = localStorage.getItem(key);
      if (fromLocal) return new Set(JSON.parse(fromLocal));
      if (!sessionFirst) {
        const fromSession = sessionStorage.getItem(key);
        if (fromSession) return new Set(JSON.parse(fromSession));
      }
    } catch {
    }
    return /* @__PURE__ */ new Set();
  }
  static persistSet(key, value) {
    try {
      const data = JSON.stringify(Array.from(value));
      sessionStorage.setItem(key, data);
      localStorage.setItem(key, data);
    } catch {
    }
  }
  static truncateText(ctx, text, maxWidth, keepEnd = false) {
    if (!text) return "";
    if (ctx.measureText(text).width <= maxWidth) {
      return text;
    }
    const ellipsis = "…";
    if (keepEnd) {
      let length2 = text.length;
      while (length2 > 0) {
        const candidate = ellipsis + text.slice(Math.max(0, text.length - length2));
        if (ctx.measureText(candidate).width <= maxWidth) {
          return candidate;
        }
        length2--;
      }
      return text.slice(-1);
    }
    let length = text.length;
    while (length > 0) {
      const candidate = text.slice(0, length) + ellipsis;
      if (ctx.measureText(candidate).width <= maxWidth) {
        return candidate;
      }
      length--;
    }
    return ellipsis;
  }
};
_NodeEnhancerExtension.ENHANCED_NODES = [
  {
    nodeType: "CheckpointLoader",
    fileType: "models",
    widgetName: "ckpt_name",
    label: "ND Super Selector"
  },
  {
    nodeType: "CheckpointLoaderSimple",
    fileType: "models",
    widgetName: "ckpt_name",
    label: "ND Super Selector"
  },
  {
    nodeType: "VAELoader",
    fileType: "vae",
    widgetName: "vae_name",
    label: "ND Super Selector"
  },
  {
    nodeType: "LoraLoader",
    fileType: "loras",
    widgetName: "lora_name",
    label: "ND Super Selector"
  },
  {
    nodeType: "UNETLoader",
    fileType: "diffusion_models",
    widgetName: "unet_name",
    label: "ND Super Selector"
  },
  {
    nodeType: "UnetLoaderGGUF",
    fileType: "gguf_unet_models",
    widgetName: "unet_name",
    label: "ND Super Selector"
  },
  {
    nodeType: "UnetLoaderGGUFAdvanced",
    fileType: "gguf_unet_models",
    widgetName: "unet_name",
    label: "ND Super Selector"
  },
  {
    nodeType: "CLIPLoader",
    fileType: "text_encoders",
    widgetName: "clip_name",
    label: "ND Super Selector"
  },
  {
    nodeType: "CLIPLoaderGGUF",
    fileType: "text_encoders",
    widgetName: "clip_name",
    label: "ND Super Selector"
  },
  ...Object.entries(GGUF_CLIP_WIDGET_MAP).flatMap(
    ([nodeType, widgetNames]) => widgetNames.map((widgetName, index) => ({
      nodeType,
      fileType: "text_encoders",
      widgetName,
      label: `ND Super Selector (${index + 1})`
    }))
  ),
  {
    nodeType: "ControlNetLoader",
    fileType: "controlnet",
    widgetName: "control_net_name",
    label: "ND Super Selector"
  },
  {
    nodeType: "UpscaleModelLoader",
    fileType: "upscale_models",
    widgetName: "model_name",
    label: "ND Super Selector"
  }
];
_NodeEnhancerExtension.filePickerService = FilePickerService.getInstance();
_NodeEnhancerExtension.HIDDEN_WIDGET_SIZE = (_width) => [0, -4];
_NodeEnhancerExtension.DEBUG = true;
_NodeEnhancerExtension.NODE_FLAG_KEY = "ndSuperSelectorEnabled";
_NodeEnhancerExtension.LEGACY_NODE_FLAG_KEY = "ndPowerEnabled";
_NodeEnhancerExtension.OVERLAY_WIDGET_TYPE = "ndSuperSelectorOverlay";
_NodeEnhancerExtension.SETTINGS = {
  enabled: "nodeEnhancer.enabled",
  autoEnhanceAll: "nodeEnhancer.autoEnhanceAll",
  contextToggle: "nodeEnhancer.enableContextToggle"
};
_NodeEnhancerExtension.settingsHookInitialized = false;
_NodeEnhancerExtension.suppressSettingSideEffects = false;
_NodeEnhancerExtension.settingsStyleInjected = false;
_NodeEnhancerExtension.extensionLookup = null;
_NodeEnhancerExtension.DEFAULT_LABEL = "ND Super Selector";
let NodeEnhancerExtension = _NodeEnhancerExtension;
const EXTENSION_NAME$1 = "NodeEnhancer";
const EXTENSION_VERSION = "1.0.0";
const nodeEnhancerExtension = {
  name: EXTENSION_NAME$1,
  version: EXTENSION_VERSION,
  // Extension settings
  settings: [
    {
      id: "nodeEnhancer.enabled",
      name: "Enable Node Enhancement",
      type: "boolean",
      defaultValue: true
    },
    {
      id: "nodeEnhancer.autoEnhanceAll",
      name: "Auto-enhance All Nodes",
      type: "boolean",
      defaultValue: false
    },
    {
      id: "nodeEnhancer.enableContextToggle",
      name: "Show ND Super Selector Toggle in Node Menu",
      type: "boolean",
      defaultValue: true
    }
  ],
  // Extension commands (minimal; per-node toggle lives in right-click menu)
  commands: [
    {
      id: "nodeEnhancer.clearCache",
      label: "ND Super Selector: Clear File Cache",
      function: () => {
        try {
          NodeEnhancerExtension["filePickerService"]?.clearCache?.();
          console.log("ND Super Selector: File cache cleared");
        } catch {
        }
      }
    }
  ],
  /**
   * Called when the extension is loaded
   */
  async init() {
    console.log(`${EXTENSION_NAME$1} v${EXTENSION_VERSION}: Initializing...`);
    try {
      await NodeEnhancerExtension.initialize();
      console.log(`${EXTENSION_NAME$1}: Initialization successful`);
    } catch (error) {
      console.error(`${EXTENSION_NAME$1}: Initialization failed:`, error);
    }
  },
  /**
   * Called before a node type is registered
   * This is where we inject our enhancements
   */
  async beforeRegisterNodeDef(nodeType, nodeData) {
    try {
      NodeEnhancerExtension.setup(nodeType, nodeData);
    } catch (error) {
      console.error("Node Enhancer: Error in beforeRegisterNodeDef:", error);
    }
  },
  /**
   * Called when a node is created
   */
  nodeCreated(node) {
    const enabled = app$1.ui.settings.getSettingValue("nodeEnhancer.enabled", true);
    const autoEnhanceAll = enabled && app$1.ui.settings.getSettingValue("nodeEnhancer.autoEnhanceAll", false);
    if (autoEnhanceAll && node?.type) {
      const applied = NodeEnhancerExtension.enableEnhancementsForNode(node);
      if (applied) {
        console.log(`Node Enhancer: Auto-enhanced ${node.type}`);
      }
    }
  },
  /**
   * Called before the graph is configured
   */
  beforeConfigureGraph(_graphData) {
    console.log("Node Enhancer: Configuring graph");
  },
  /**
   * Called after the graph is configured
   */
  afterConfigureGraph(_graphData) {
    console.log("Node Enhancer: Graph configured");
    NodeEnhancerExtension.onGraphConfigured();
  }
};
console.log(`${EXTENSION_NAME$1}: Registering extension with ComfyUI`);
app$1.registerExtension(nodeEnhancerExtension);
console.log(`${EXTENSION_NAME$1}: Extension registered successfully`);
const EXTENSION_NAME = "SuperLoraLoader";
const NODE_TYPE = "NdSuperLoraLoader";
const superLoraExtension = {
  name: EXTENSION_NAME,
  // Extension settings
  settings: [
    {
      id: "superLora.autoFetchTriggerWords",
      name: "Auto-fetch Trigger Words",
      type: "boolean",
      defaultValue: true
    },
    {
      id: "superLora.enableTags",
      name: "Enable Tag System",
      type: "boolean",
      defaultValue: false
    },
    {
      id: "superLora.showSeparateStrengths",
      name: "Show Separate Model/CLIP Strengths",
      type: "boolean",
      defaultValue: false
    },
    {
      id: "superLora.enableTemplates",
      name: "Enable Template System",
      type: "boolean",
      defaultValue: true
    },
    {
      id: "superLora.enableDeletion",
      name: "Enable LoRA Deletion",
      type: "boolean",
      defaultValue: true
    },
    {
      id: "superLora.enableSorting",
      name: "Enable LoRA Sorting",
      type: "boolean",
      defaultValue: true
    }
  ],
  // Extension commands
  commands: [
    {
      id: "superLora.addLora",
      label: "Add LoRA to Super LoRA Loader",
      function: () => {
        console.log("Super LoRA Loader: Add LoRA command triggered");
      }
    },
    {
      id: "superLora.showTriggerWords",
      label: "Show All Trigger Words",
      function: () => {
        console.log("Super LoRA Loader: Show trigger words command triggered");
      }
    },
    {
      id: "superLora.checkUpdates",
      label: "Check ND Super Nodes Updates",
      function: () => {
        UpdateService.getInstance().checkForUpdates({ force: true, silent: false }).catch(() => {
        });
      }
    }
  ],
  /**
   * Called before a node type is registered
   */
  beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name === NODE_TYPE) {
      console.log("Super LoRA Loader: Registering node type");
      SuperLoraNode.initialize().then(() => {
        console.log("Super LoRA Loader: Services initialized");
      }).catch((err) => {
        console.error("Super LoRA Loader: Initialization error", err);
      });
      try {
        SuperLoraNode.setup(nodeType, nodeData);
        console.log("Super LoRA Loader: Node type registered successfully");
      } catch (err) {
        console.error("Super LoRA Loader: Error during node setup; continuing with default registration", err);
      }
    }
  },
  /**
   * Called when a node is created
   */
  nodeCreated(node) {
    if (node.type === NODE_TYPE || node.comfyClass === NODE_TYPE) {
      console.log("Super LoRA Loader: Node created", node.id);
      this.setupNodeEventHandlers?.(node);
      SuperLoraDOMRenderer.mount(node, WidgetAPI$1);
    }
  },
  /**
   * Called before the graph is configured
   */
  beforeConfigureGraph(_graphData) {
    console.log("Super LoRA Loader: Configuring graph");
  },
  /**
   * Set up additional event handlers for the node
   */
  setupNodeEventHandlers(node) {
    const originalOnRemoved = node.onRemoved;
    node.onRemoved = function() {
      console.log("Super LoRA Loader: Node removed", this.id);
      if (originalOnRemoved) {
        originalOnRemoved.apply(this, arguments);
      }
    };
    const originalClone = node.clone;
    node.clone = function() {
      const clonedNode = originalClone ? originalClone.apply(this, arguments) : this;
      console.log("Super LoRA Loader: Node cloned", this.id, "->", clonedNode.id);
      return clonedNode;
    };
    const originalOnPropertyChanged = node.onPropertyChanged;
    node.onPropertyChanged = function(name, value) {
      console.log("Super LoRA Loader: Property changed", name, value);
      if (name.startsWith("@")) {
        const settingName = name.substring(1);
        this.onSettingChanged?.(settingName, value);
      }
      if (originalOnPropertyChanged) {
        originalOnPropertyChanged.apply(this, arguments);
      }
    };
  }
};
console.log("Super LoRA Loader: Registering extension with ComfyUI");
app$1.registerExtension(superLoraExtension);
console.log("Super LoRA Loader: Extension registered successfully");

// ── graphToPrompt Hook: Inject fresh lora_bundle directly into prompt graph on EVERY generation ──
function buildSuperLoraNodeIndex() {
  const index = new Map();
  const visit = (graph, prefix) => {
    if (!graph) return;
    for (const n of (graph._nodes || graph.nodes || [])) {
      if (!n) continue;
      const cid = String(prefix) + n.id;
      const t = n.type || n.comfyClass;
      if (t === NODE_TYPE || t === "NdSuperLoraLoader" || t === "SuperLoraLoader") {
        index.set(cid, n);
        if (!index.has(String(n.id))) index.set(String(n.id), n);
      }
      const inner = n.subgraph || n.graph || n._graph;
      if (inner && inner !== graph) visit(inner, cid + ":");
    }
  };
  visit(app$1.graph, "");
  return index;
}

function findSuperLoraNode(index, id) {
  const s = String(id);
  if (index.has(s)) return index.get(s);
  const tail = s.includes(":") ? s.slice(s.lastIndexOf(":") + 1) : null;
  return tail && index.has(tail) ? index.get(tail) : null;
}

const _origSuperLoraGraphToPrompt = app$1.graphToPrompt ? app$1.graphToPrompt.bind(app$1) : null;
if (_origSuperLoraGraphToPrompt) {
  app$1.graphToPrompt = async function (...args) {
    const result = await _origSuperLoraGraphToPrompt(...args);
    try {
      const out = result?.output;
      if (out) {
        let index = null;
        for (const id in out) {
          const entry = out[id];
          if (!entry) continue;
          const cls = entry.class_type;
          if (cls === NODE_TYPE || cls === "NdSuperLoraLoader" || cls === "SuperLoraLoader") {
            if (!index) index = buildSuperLoraNodeIndex();
            entry.inputs = entry.inputs || {};
            const node = findSuperLoraNode(index, id);
            if (node) {
              const freshBundle = _SuperLoraNode.buildBundle(node);
              entry.inputs["lora_bundle"] = freshBundle;
              let bridge = (node.widgets || []).find((w) => w?.name === "lora_bundle");
              if (bridge) {
                bridge.value = freshBundle;
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn("[Super LoRA Loader] graphToPrompt injection warning:", e);
    }
    return result;
  };
}

try {
  window.SuperLoraNode = SuperLoraNode;
  window.addEventListener("trix_lora_notes_updated", () => {
    if (app$1?.graph) {
      app$1.graph.setDirtyCanvas(true, false);
      const nodes = app$1.graph._nodes || [];
      for (const n of nodes) {
        if (n._trixDomRoot && n._trixWidgetApi) {
          SuperLoraDOMRenderer.render(n, n._trixWidgetApi, false);
        }
      }
    }
  });
  window.addEventListener("trix_lora_notes_map_loaded", () => {
    if (app$1?.graph) {
      app$1.graph.setDirtyCanvas(true, false);
      const nodes = app$1.graph._nodes || [];
      for (const n of nodes) {
        if (n._trixDomRoot && n._trixWidgetApi) {
          SuperLoraDOMRenderer.render(n, n._trixWidgetApi, false);
        }
      }
    }
  });
} catch {
}
//# sourceMappingURL=extension.js.map
