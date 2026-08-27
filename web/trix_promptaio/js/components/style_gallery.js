const OPTION_LEVELS = [
  { level: 1, icon: "⠈", title: "Show favorite button" },
  { level: 2, icon: "⠘", title: "Show favorite + edit button" },
  { level: 3, icon: "⠸", title: "Show favorite + edit + delete button" }
];

const VIEW_MODES = [
  { key: "grid", icon: "⊞" },
  { key: "compact", icon: "𝄜" },
  { key: "list", icon: "☰" },
  { key: "compact_list", icon: "▤" }
];

import { StyleManagerModal, DEFAULT_PACK_ORDER } from "./style_manager_modal.js";

/**
 * StyleGallery component — loads styles from backend endpoints matching categories.
 * Supports OreX Compare Slider (Before/After split image with draggable divider).
 * Clicking a style card copies its prompt to the clipboard with toast feedback.
 */
export class StyleGallery {
  constructor(containerEl, onStyleSelectCallback, nodeInstance) {
    this.container = containerEl;
    this.onStyleSelect = onStyleSelectCallback;
    this.node = nodeInstance || null;
    this.styles = [];
    this.categories = [];
    this._cacheBuster = Date.now();
    this.selectedCategory = "All";
    this.searchQuery = "";
    this.sortOrder = "name_asc";
    this.viewMode = this.node?.properties?.viewMode || "grid";
    this.optionLevel = this.node?.properties?.cardActionsLevel || 1; // 1: ⠈ (fav), 2: ⠘ (fav+edit), 3: ⠸ (fav+edit+del)
    this.modal = new StyleManagerModal({
      onSave: async (updatedStyles, updatedCats) => {
        this._cacheBuster = Date.now();
        if (Array.isArray(updatedCats)) this.categories = updatedCats;
        await this.loadStyles();
        this.renderCategories();
        this.filterStyles(this.searchQuery, this.selectedCategory);
      }
    });
    this._initHoverPanel();
    this.init();
  }

  _initHoverPanel() {
    this.hoverPanel = document.querySelector(".trix-hover-preview-panel");
    if (!this.hoverPanel) {
      this.hoverPanel = document.createElement("div");
      this.hoverPanel.className = "trix-hover-preview-panel";
      document.body.appendChild(this.hoverPanel);
    }
  }

  showHoverPanel(style, cardElement) {
    if (!this.hoverPanel) return;
    const thumbUrl = this.getThumbUrl(style.primaryThumb) || "";
    const tagStr = style.tag || this.getStyleTag(style.name);
    
    let html = ``;
    if (thumbUrl) {
      html += `<img src="${thumbUrl}" alt="${style.name}" />`;
    }
    html += `<div class="trix-hover-preview-title">${style.name}</div>`;
    
    const pos = style.positive || style.prompt || "";
    if (pos) {
      html += `<div class="trix-hover-preview-pos"><b>Positive:</b> ${pos}</div>`;
    }
    const neg = style.negative || "";
    if (neg) {
      html += `<div class="trix-hover-preview-neg"><b>Negative:</b> ${neg}</div>`;
    }
    html += `<div class="trix-hover-preview-tag">${tagStr}</div>`;
    
    this.hoverPanel.innerHTML = html;
    
    // Position it
    const nodeEl = this.container.closest(".litegraph.node") || this.container;
    const rect = nodeEl.getBoundingClientRect();
    
    // Check if there is space on the right, else put on the left
    const panelWidth = 280;
    const padding = 16;
    let left = rect.right + padding;
    if (left + panelWidth > window.innerWidth) {
      left = rect.left - panelWidth - padding;
    }
    
    // Align top with the node, but keep within viewport
    let top = rect.top;
    this.hoverPanel.style.display = "flex"; // Briefly show to get height
    const pRect = this.hoverPanel.getBoundingClientRect();
    if (top + pRect.height > window.innerHeight) {
      top = window.innerHeight - pRect.height - 16;
    }
    if (top < 16) top = 16;
    
    this.hoverPanel.style.left = left + "px";
    this.hoverPanel.style.top = top + "px";
    
    // Show
    this.hoverPanel.classList.add("show");
  }

  hideHoverPanel() {
    if (!this.hoverPanel) return;
    this.hoverPanel.classList.remove("show");
  }

  async init() {
    this.grid = this.container.querySelector(".trix-ps-styles-grid");
    this.searchInput = this.container.querySelector(".trix-ps-search-input");
    this.catContainer = this.container.querySelector(".trix-ps-categories");

    if (this.searchInput) {
      this.searchInput.addEventListener("input", (e) => {
        this.filterStyles(e.target.value, this.selectedCategory);
      });
    }

    this.updateViewModeButton();

    // Wire + button to open StyleManagerModal
    const addBtn = this.container.querySelector(".trix-ps-add-custom-btn");
    if (addBtn) {
      addBtn.addEventListener("click", () => {
        this.modal.setStyles(this.styles, this.categories);
        this.modal.activeTab = "add";
        this.modal.open();
      });
    }

    await this.loadStyles();
    if (this.node?.properties?.styleCategory) {
      this.selectedCategory = this.node.properties.styleCategory;
    }
    if (this.node?.properties?.viewMode) {
      this.viewMode = this.node.properties.viewMode;
    }
    if (this.node?.properties?.cardActionsLevel) {
      this.optionLevel = this.node.properties.cardActionsLevel;
    }
    this.modal.setStyles(this.styles, this.categories);
    this.renderCategories();
    this.setViewMode(this.viewMode);
  }

  // ---- @tag helpers ----
  getStyleTag(name) {
    if (!name) return "@style";
    return "@" + name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/_+$/, "");
  }

  getAllStyleTags() {
    const m = new Map();
    for (const s of this.styles) {
      const tag = s.tag || this.getStyleTag(s.name);
      m.set(tag, s);
      if (Array.isArray(s.tags)) {
        for (const t of s.tags) {
          const ft = t.startsWith("@") ? t : "@" + t;
          if (!m.has(ft)) m.set(ft, s);
        }
      }
    }
    return m;
  }

  getThumbUrl(imgName) {
    if (!imgName) return "";
    if (/^(https?:)?\/\/|^\//.test(imgName)) return imgName;
    const base = "/trix_prompt/image?img=" + encodeURIComponent(imgName);
    return this._cacheBuster ? `${base}&t=${this._cacheBuster}` : base;
  }

  // ---- data loading ----
  async loadStyles(directStyles, directCategories) {
    const merged = [];
    const seen = new Set();

    // Clean up legacy localStorage custom styles to prevent phantom packs
    try {
      localStorage.removeItem("trix_custom_styles");
    } catch (_) {}

    if (Array.isArray(directStyles) && directStyles.length > 0) {
      if (Array.isArray(directCategories)) {
        this.categories = directCategories;
      }
      for (const raw of directStyles) {
        let catKey = raw.categoryKey || raw.category || "custom";
        if (catKey.toLowerCase() === "custom") catKey = "custom";
        const s = this._normalize(raw, catKey, raw.favorite);
        const dedupeKey = s.id ? `${s.categoryKey}_${s.id}` : `${s.categoryKey}_${s.name}`;
        if (s && !seen.has(dedupeKey)) {
          seen.add(dedupeKey);
          merged.push(s);
        }
      }
      this.styles = merged;
      return;
    }

    // 1. Fetch unified styles and categories from our backend
    try {
      const url = "/trix_prompt/styles" + (this._cacheBuster ? `?t=${this._cacheBuster}` : `?t=${Date.now()}`);
      const r = await fetch(url);
      if (r.ok) {
        const data = await r.json();
        const list = Array.isArray(data) ? data : (data.styles || []);
        if (data && Array.isArray(data.categories)) {
          this.categories = data.categories;
        }
        for (const raw of list) {
          let catKey = raw.categoryKey || raw.category || "custom";
          if (catKey.toLowerCase() === "custom") catKey = "custom";
          const s = this._normalize(raw, catKey, raw.favorite);
          const dedupeKey = s.id ? `${s.categoryKey}_${s.id}` : `${s.categoryKey}_${s.name}`;
          if (s && !seen.has(dedupeKey)) {
            seen.add(dedupeKey);
            merged.push(s);
          }
        }
      }
    } catch (e) {
      console.error("Failed to load styles", e);
    }

    // Remove any stale trix_style_order from localStorage so .xlsx row order is always strictly preserved
    try {
      localStorage.removeItem("trix_style_order");
    } catch (_) {}

    this.styles = merged;
  }

  _normalize(raw, categoryKey, isFav) {
    if (!raw || typeof raw !== "object") return null;
    const name = raw.name || raw.title || "Untitled";
    const tag = raw.tag || this.getStyleTag(name);
    const positive = raw.positive || raw.prompt || raw.positive_prompt || "";
    const negative = raw.negative || raw.negative_prompt || "";

    const thumbnailVariant = raw.thumbnail_variant || "";
    const rawThumb = raw.thumbnail || raw.preview || raw.image || "";

    const hasCompareSlider = thumbnailVariant === "compareSlider" && Array.isArray(rawThumb) && rawThumb.length >= 2;
    const primaryThumb = Array.isArray(rawThumb) ? rawThumb[0] : rawThumb;
    const compareThumb = Array.isArray(rawThumb) && rawThumb.length >= 2 ? rawThumb[1] : null;

    let tags = Array.isArray(raw.tags) ? [...raw.tags] : (raw.tags ? raw.tags.split(",").map(x => x.trim()) : []);
    if (!tags.includes(tag)) tags.unshift(tag);

    const catKey = (categoryKey || "custom").toLowerCase() === "custom" ? "custom" : categoryKey;

    return {
      id: raw.id || name,
      name,
      tag,
      tags,
      positive,
      negative,
      thumbnail: rawThumb,
      primaryThumb,
      compareThumb,
      thumbnailVariant,
      hasCompareSlider,
      categoryKey: catKey,
      category: catKey,
      favorite: !!isFav || !!raw.favorite,
      custom: catKey === "custom",
    };
  }

  selectCategory(catKey) {
    const key = catKey || "All";
    this.selectedCategory = key;
    if (this.node?.properties) {
      this.node.properties.styleCategory = key;
    }
    this.renderCategories();
    this.filterStyles(this.searchQuery, key);
  }

  // ---- rendering categories pills ----
  renderCategories() {
    if (!this.catContainer) return;
    this.catContainer.innerHTML = "";

    const cats = new Set();
    if (Array.isArray(this.categories)) {
      for (const c of this.categories) {
        if (c && c !== "favorite" && c !== "All") cats.add(c.toLowerCase() === "custom" ? "custom" : c);
      }
    }
    for (const s of this.styles) {
      let c = (s.categoryKey || s.category || "").trim();
      if (c.toLowerCase() === "custom") c = "custom";
      if (c && c !== "favorite" && c !== "All") cats.add(c);
    }
    cats.delete("Custom");
    cats.add("custom");

    // If active category was renamed or deleted on disk, fallback safely to All
    if (this.selectedCategory !== "All" && this.selectedCategory !== "favorite" && !cats.has(this.selectedCategory)) {
      this.selectedCategory = "All";
      if (this.node?.properties) {
        this.node.properties.styleCategory = "All";
      }
    }
    
    // Sort and build array
    const sortedCats = Array.from(cats).sort();

    const defaultOrderMap = DEFAULT_PACK_ORDER.reduce((acc, c, i) => ({ ...acc, [c]: i }), {});
    try {
      const orderStr = localStorage.getItem("trix_pack_order");
      const orderMap = orderStr ? JSON.parse(orderStr) : defaultOrderMap;
      sortedCats.sort((a, b) => {
        const idxA = orderMap[a] !== undefined ? orderMap[a] : (defaultOrderMap[a] !== undefined ? defaultOrderMap[a] : 999999);
        const idxB = orderMap[b] !== undefined ? orderMap[b] : (defaultOrderMap[b] !== undefined ? defaultOrderMap[b] : 999999);
        return idxA - idxB;
      });
    } catch (_) {}

    const categories = [
      { key: "All", label: "All" },
      { key: "favorite", label: "❤︎ favorite" },
      ...sortedCats.map(c => ({ key: c, label: c }))
    ];

    for (const cat of categories) {
      const pill = document.createElement("button");
      pill.className = "trix-ps-cat-pill" + (this.selectedCategory === cat.key ? " active" : "");
      pill.textContent = cat.label;
      pill.addEventListener("click", () => {
        this.selectCategory(cat.key);
      });
      this.catContainer.appendChild(pill);
    }
  }

  showToast(msg) {
    let toast = document.querySelector(".trix-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "trix-toast";
      toast.style.cssText = "position:fixed; bottom:24px; left:50%; transform:translateX(-50%); background:var(--trix-prompt-accent,#ff5500); color:#fff; padding:6px 16px; border-radius:20px; font-size:11px; font-weight:700; z-index:99999; box-shadow:0 4px 12px rgba(0,0,0,0.4); opacity:0; transition:opacity 0.2s ease; pointer-events:none;";
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = "1";
    setTimeout(() => { toast.style.opacity = "0"; }, 1600);
  }

  showCardToast(card, icon = "🗐", text = "Copied!") {
    let overlay = card.querySelector(".trix-card-toast");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "trix-card-toast";
      card.appendChild(overlay);
    }
    overlay.innerHTML = `<span style="font-size:16px; margin-bottom:4px;">${icon}</span><span style="font-size:10px;text-align:center;">${text}</span>`;
    
    // reset animation if clicked multiple times
    overlay.classList.remove("show");
    void overlay.offsetWidth; // trigger reflow
    overlay.classList.add("show");
    
    if (card._toastTimer) clearTimeout(card._toastTimer);
    card._toastTimer = setTimeout(() => {
      overlay.classList.remove("show");
    }, 1500);
  }

  cycleOptionLevel() {
    this.optionLevel = (this.optionLevel % 3) + 1;
    if (this.node?.properties) {
      this.node.properties.cardActionsLevel = this.optionLevel;
    }
    this.renderGrid(this.styles);
    this.filterStyles(this.searchQuery, this.selectedCategory);
    return OPTION_LEVELS.find(l => l.level === this.optionLevel) || OPTION_LEVELS[0];
  }

  async _deleteStyle(style) {
    try {
      await fetch("/trix_prompt/styles/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: style.id, name: style.name })
      });
    } catch (err) {
      console.error("Failed to delete style from backend", err);
    }
    try {
      const raw = localStorage.getItem("trix_custom_styles");
      if (raw) {
        const list = JSON.parse(raw).filter(cs => cs.name !== style.name && cs.id !== style.id);
        localStorage.setItem("trix_custom_styles", JSON.stringify(list));
      }
    } catch (_) {}
    await this.loadStyles();
    this.modal.setStyles(this.styles);
    this.renderCategories();
    this.filterStyles(this.searchQuery, this.selectedCategory);
    this.showToast(`Deleted "${style.name}"`);
  }

  cycleViewMode() {
    const currentIdx = VIEW_MODES.findIndex(m => m.key === this.viewMode);
    const nextIdx = (currentIdx + 1) % VIEW_MODES.length;
    const nextMode = VIEW_MODES[nextIdx].key;
    this.setViewMode(nextMode);
    return VIEW_MODES[nextIdx];
  }

  updateViewModeButton() {
    const btn = this.container.querySelector(".trix-ps-view-mode-btn");
    if (btn) {
      const m = VIEW_MODES.find(x => x.key === this.viewMode) || VIEW_MODES[0];
      btn.textContent = m.icon;
      btn.title = `View Mode: ${m.key.replace("_", " ")}`;
    }
  }

  setViewMode(mode) {
    this.viewMode = mode || "grid";
    if (this.node?.properties) {
      this.node.properties.viewMode = this.viewMode;
    }
    this.renderGrid(this.styles);
    this.filterStyles(this.searchQuery, this.selectedCategory);
    this.updateViewModeButton();
  }

  renderGrid(styles) {
    if (!this.grid) return;
    this.grid.innerHTML = "";
    
    this.grid.className = "trix-ps-styles-grid";
    if (this.viewMode === "compact")      this.grid.classList.add("trix-view-compact");
    if (this.viewMode === "list")         this.grid.classList.add("trix-view-list");
    if (this.viewMode === "compact_list") this.grid.classList.add("trix-view-compact-list");

    if (!styles || styles.length === 0) {
      const el = document.createElement("div");
      el.style.cssText = "grid-column:1/-1; text-align:center; color:#888; padding:16px; font-size:11px;";
      el.textContent = "No styles found.";
      this.grid.appendChild(el);
      return;
    }

    for (const style of styles) {
      const card = document.createElement("div");
      card.className = "trix-ps-style-card";
      const tagStr = style.tag || this.getStyleTag(style.name);
      
      card.addEventListener("mouseenter", () => this.showHoverPanel(style, card));
      card.addEventListener("mouseleave", () => this.hideHoverPanel());

      if (style.hasCompareSlider) {
        // OreX Compare Slider
        const imgAfterUrl  = this.getThumbUrl(style.thumbnail[0]);
        const imgBeforeUrl = this.getThumbUrl(style.thumbnail[1]);

        const showEdit = this.optionLevel >= 2;
        const showDel = this.optionLevel >= 3;

        card.innerHTML = `
          <div class="trix-ps-card-actions">
            <button class="trix-ps-heart-btn${style.favorite ? " fav" : ""}" title="Favorite">${style.favorite ? "❤" : "♡"}</button>
            ${showEdit ? `<button class="trix-ps-edit-btn" title="Edit style">✎</button>` : ""}
            ${showDel ? `<button class="trix-ps-delete-btn" title="Delete style">🗙</button>` : ""}
          </div>
          <div class="trix-slider-container">
            <img class="img-after" src="${imgAfterUrl}" alt="${style.name}" onerror="this.style.display='none';" />
            <img class="img-before" src="${imgBeforeUrl}" alt="${style.name}" style="clip-path: polygon(0 0, 50% 0, 50% 100%, 0 100%);" onerror="this.style.display='none';" />
            <div class="trix-slider-line" style="left: 50%;"></div>
            <input type="range" class="trix-slider-range" min="0" max="100" value="50" />
          </div>
          <div class="trix-ps-style-name">${style.name}</div>
          <div class="trix-ps-style-prompt" style="display:none;">${style.positive || style.prompt || ''}</div>
          <div class="trix-ps-style-tag">${tagStr}</div>
        `;

        const rangeInput = card.querySelector(".trix-slider-range");
        const imgBefore  = card.querySelector(".img-before");
        const line       = card.querySelector(".trix-slider-line");

        rangeInput.addEventListener("input", (e) => {
          const val = e.target.value;
          imgBefore.style.clipPath = `polygon(0 0, ${val}% 0, ${val}% 100%, 0 100%)`;
          line.style.left = `${val}%`;
        });

        let startX = 0;
        rangeInput.addEventListener("pointerdown", (e) => { startX = e.clientX; });
        rangeInput.addEventListener("click", (e) => {
          if (Math.abs(e.clientX - startX) > 5) e.stopPropagation();
        });
      } else {
        // Standard single thumbnail
        const thumbUrl = this.getThumbUrl(style.primaryThumb);

        const showEdit = this.optionLevel >= 2;
        const showDel = this.optionLevel >= 3;

        card.innerHTML = `
          <div class="trix-ps-card-actions">
            <button class="trix-ps-heart-btn${style.favorite ? " fav" : ""}" title="Favorite">${style.favorite ? "❤" : "♡"}</button>
            ${showEdit ? `<button class="trix-ps-edit-btn" title="Edit style">✎</button>` : ""}
            ${showDel ? `<button class="trix-ps-delete-btn" title="Delete style">🗙</button>` : ""}
          </div>
          <div class="trix-ps-style-thumb">
            ${thumbUrl
              ? `<img src="${thumbUrl}" alt="${style.name}" loading="lazy"
                  onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />`
              : ""}
            <span class="trix-ps-placeholder-icon" style="${thumbUrl ? "display:none" : ""}">🖻</span>
          </div>
          <div class="trix-ps-style-name">${style.name}</div>
          <div class="trix-ps-style-prompt" style="display:none;">${style.positive || style.prompt || ''}</div>
          <div class="trix-ps-style-tag">${tagStr}</div>
        `;
      }

      // Heart button
      const heartBtn = card.querySelector(".trix-ps-heart-btn");
      if (heartBtn) {
        heartBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this._toggleFav(style, heartBtn);
        });
      }

      // Edit button
      const editBtn = card.querySelector(".trix-ps-edit-btn");
      if (editBtn) {
        editBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.modal.setStyles(this.styles);
          this.modal.editingStyle = style;
          this.modal.activeTab = "edit";
          this.modal.open(style);
        });
      }

      // Delete button
      const delBtn = card.querySelector(".trix-ps-delete-btn");
      if (delBtn) {
        delBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (confirm(`Are you sure you want to delete style "${style.name}"?`)) {
            this._deleteStyle(style);
          }
        });
      }

      // Card click handling based on styleClickAction setting
      card.addEventListener("click", () => {
        const action = this.node?._trixSettings?.styleClickAction || "copy_text";
        let textToCopy = "";
        let toastIcon = "🗐";
        let toastText = "Copied!";

        if (action === "copy_tag") {
          textToCopy = style.tag || (this.getStyleTag ? this.getStyleTag(style.name) : "");
          toastIcon = "𖤘";
          toastText = "Tag Copied!";
        } else if (action === "copy_neg") {
          textToCopy = style.negative;
          toastIcon = "㊀";
          toastText = "Neg Copied!";
        } else if (action === "add_to_prompt") {
          const styleText = style.positive || style.prompt || style.tag || style.name;
          if (styleText && this.promptStack) {
            const state = this.promptStack.getState();
            const rows = state.rows || [];
            let emptyRowId = null;
            for (let i = 0; i < rows.length; i++) {
              if (!rows[i].text || rows[i].text.trim() === "") {
                emptyRowId = rows[i].id;
                break;
              }
            }
            if (emptyRowId !== null) {
              const rowEl = this.promptStack.stackEl.querySelector(`.trix-ps-row[data-id="${emptyRowId}"]`);
              if (rowEl) {
                const ta = rowEl.querySelector(".trix-ps-textarea");
                if (ta) {
                  ta.value = styleText;
                  ta.dispatchEvent(new Event("input"));
                }
              }
            } else {
              this.promptStack.addRow(styleText);
            }
            this.showCardToast(card, "✚", "Added!");
            if (this.activateTab) this.activateTab("prompts");
          }
          return;
        } else {
          textToCopy = style.positive || style.prompt || style.tag || style.name;
          toastIcon = "🗐";
          toastText = "Text Copied!";
        }

        if (textToCopy) {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(textToCopy);
          } else {
            try {
              const ta = document.createElement("textarea");
              ta.value = textToCopy;
              document.body.appendChild(ta);
              ta.select();
              document.execCommand("copy");
              ta.remove();
            } catch (_) {}
          }
          this.showCardToast(card, toastIcon, toastText);
        }
      });

      this.grid.appendChild(card);
    }
  }

  filterStyles(query, category) {
    this.searchQuery = (query || "").toLowerCase().trim();
    this.selectedCategory = category || "All";

    const filtered = this.styles.filter((s) => {
      if (s.is_pack_marker) return false;
      if (this.selectedCategory === "favorite" && !s.favorite) return false;
      if (this.selectedCategory !== "All" && this.selectedCategory !== "favorite") {
        const sCat = (s.categoryKey || s.category || "custom").toLowerCase() === "custom" ? "custom" : (s.categoryKey || s.category);
        const selCat = this.selectedCategory.toLowerCase() === "custom" ? "custom" : this.selectedCategory;
        if (sCat !== selCat) return false;
      }

      if (this.searchQuery) {
        const blob = [s.name, s.positive, s.negative, s.tag, s.categoryKey].join(" ").toLowerCase();
        if (!blob.includes(this.searchQuery)) return false;
      }
      return true;
    });

    this.renderGrid(filtered);
  }

  async _toggleFav(style, btn) {
    style.favorite = !style.favorite;
    if (btn) {
      btn.textContent = style.favorite ? "❤" : "♡";
      btn.classList.toggle("fav", style.favorite);
    }
    try {
      await fetch("/trix_prompt/styles/favorite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: style.id || style.name })
      });
    } catch (_) {}

    if (this.selectedCategory === "favorite") this.filterStyles(this.searchQuery, "favorite");
  }

  async _saveCustomStyle(formEl) {
    const name = formEl.querySelector(".trix-ps-cs-name")?.value.trim();
    if (!name) return;
    const positive = formEl.querySelector(".trix-ps-cs-pos")?.value.trim() || "";
    const negative = formEl.querySelector(".trix-ps-cs-neg")?.value.trim() || "";
    const tagsRaw = formEl.querySelector(".trix-ps-cs-tags")?.value.trim() || "";
    const derivedTag = "@" + name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    const tag = tagsRaw ? (tagsRaw.startsWith("@") ? tagsRaw : "@" + tagsRaw) : derivedTag;

    const payload = {
      name,
      tag,
      categoryKey: "custom",
      category: "custom",
      positive,
      negative
    };

    try {
      const r = await fetch("/trix_prompt/styles/save_custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const res = await r.json();
      if (res.status === "success") {
        this._cacheBuster = Date.now();
        if (Array.isArray(res.categories)) this.categories = res.categories;
        await this.loadStyles();
      }
    } catch (_) {}

    formEl.style.display = "none";
    formEl.querySelectorAll("input,textarea").forEach(el => { el.value = ""; });
    this.renderCategories();
    this.filterStyles(this.searchQuery, this.selectedCategory);
  }
}
