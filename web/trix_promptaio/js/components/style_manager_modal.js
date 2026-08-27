export const DEFAULT_PACK_ORDER = [
  "krea2_styles",
  "krea2_pose",
  "klein_edit",
  "optic_art",
  "emotions",
  "fooocus_styles",
  "z-image",
  "no8d_3d",
  "no8d_anime",
  "no8d_cartoon",
  "no8d_comics",
  "no8d_digital_painting",
  "no8d_drawing",
  "no8d_fine_art",
  "no8d_photography",
  "custom"
];

export class StyleManagerModal {
  constructor(options = {}) {
    this.onSave = options.onSave || (() => {});
    this.styles = options.styles || [];
    this.categories = options.categories || [];
    this._cacheBuster = Date.now();
    this.modalEl = null;
    this.activeTab = "add"; // "add" or "packs"
    this.editingStyle = options.editingStyle || null;
    
    // Image state
    this.img1Base64 = null;
    this.img2Base64 = null;
    
    // Selection state for pack management
    this.selectedCategory = "All";
    this.selectedStyleIds = new Set();
    this.smSearchQuery = "";
  }

  setStyles(styles, categories) {
    this.styles = styles || [];
    if (Array.isArray(categories)) {
      this.categories = categories;
    }
    this._cacheBuster = Date.now();
  }

  open(editingStyle = null) {
    this.editingStyle = editingStyle;
    this.img1Base64 = null;
    this.img2Base64 = null;
    this.selectedStyleIds.clear();
    this.smSearchQuery = "";
    this._cacheBuster = Date.now();
    
    if (this.modalEl) this.modalEl.remove();

    this.modalEl = document.createElement("div");
    this.modalEl.className = "trix-modal-overlay trix-fade-in";
    
    this.modalEl.addEventListener("pointerdown", (e) => e.stopPropagation());
    this.modalEl.addEventListener("mousedown", (e) => e.stopPropagation());
    
    const wrapper = document.createElement("div");
    wrapper.className = "trix-modal-wrapper trix-slide-up";
    this.modalEl.appendChild(wrapper);
    
    document.body.appendChild(this.modalEl);

    // Close on outside click
    this.modalEl.addEventListener("mousedown", (e) => {
      if (e.target === this.modalEl) this.close();
    });
    
    this.render();
  }

  close() {
    if (this.modalEl) {
      this.modalEl.classList.remove("trix-fade-in");
      this.modalEl.classList.add("trix-fade-out");
      setTimeout(() => {
        if (this.modalEl) this.modalEl.remove();
        this.modalEl = null;
      }, 200);
    }
  }

  getCategories() {
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
    const sorted = Array.from(cats).sort();
    
    // Sort by custom pack order
    const defaultOrderMap = DEFAULT_PACK_ORDER.reduce((acc, c, i) => ({ ...acc, [c]: i }), {});
    try {
      const orderStr = localStorage.getItem("trix_pack_order");
      const orderMap = orderStr ? JSON.parse(orderStr) : defaultOrderMap;
      sorted.sort((a, b) => {
        const idxA = orderMap[a] !== undefined ? orderMap[a] : (defaultOrderMap[a] !== undefined ? defaultOrderMap[a] : 999999);
        const idxB = orderMap[b] !== undefined ? orderMap[b] : (defaultOrderMap[b] !== undefined ? defaultOrderMap[b] : 999999);
        return idxA - idxB;
      });
    } catch (_) {}
    
    return sorted;
  }

  getThumbUrl(imgName) {
    if (!imgName) return "";
    if (/^(https?:)?\/\/|^\//.test(imgName)) return imgName;
    const base = "/trix_prompt/image?img=" + encodeURIComponent(imgName);
    return this._cacheBuster ? `${base}&t=${this._cacheBuster}` : base;
  }

  render() {
    if (!this.modalEl) return;
    const wrapper = this.modalEl.querySelector(".trix-modal-wrapper");
    if (!wrapper) return;
    
    const categories = this.getCategories();
    const isEdit = !!this.editingStyle;
    const styleData = (this.activeTab === 'edit' && this.editingStyle) ? this.editingStyle : {
      name: "",
      categoryKey: "custom",
      positive: "",
      negative: "",
    };

    const derivedTag = styleData.name ? "@" + styleData.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") : "@your_tag_name";

    wrapper.innerHTML = `
        <!-- Header -->
        <div class="trix-modal-header-v2">
          <div class="trix-modal-header-title">
            <span class="trix-modal-icon">❖</span>
            <h2>Style Manager</h2>
          </div>
          <button class="trix-modal-close-btn" title="Close">✕</button>
        </div>

        <!-- Navigation Tabs -->
        <div class="trix-modal-tabs-v2">
          <button class="trix-modal-tab-v2 ${this.activeTab === 'add' ? 'active' : ''}" data-tab="add">
            <span class="trix-tab-icon">✚</span> Add New Style
          </button>
          <button class="trix-modal-tab-v2 ${this.activeTab === 'packs' ? 'active' : ''}" data-tab="packs">
            <span class="trix-tab-icon">❖</span> Pack & Styles Manager <span class="trix-tab-badge">${this.styles.length}</span>
          </button>
          ${isEdit ? `
          <button class="trix-modal-tab-v2 ${this.activeTab === 'edit' ? 'active' : ''}" data-tab="edit">
            <span class="trix-tab-icon">✎</span> Edit Style
          </button>
          ` : ''}
        </div>

        <!-- Body -->
        <div class="trix-modal-body-v2">
          ${(this.activeTab === 'add' || this.activeTab === 'edit') ? this.renderAddTab(styleData, derivedTag, categories) : this.renderPacksTab(categories)}
        </div>
    `;

    this.wireEvents();
  }

  renderAddTab(s, tagPreview, categories) {
    return `
      <div class="trix-sm-form-v2" style="height: 100%; display: flex; flex-direction: column;">
        <div class="trix-form-row" style="flex: 1; overflow: hidden;">
          <div class="trix-form-col" style="flex: 2; display: flex; flex-direction: column;">
            <div class="trix-sm-field-v2">
              <label>Style Name</label>
              <input type="text" class="trix-input-v2 trix-sm-name" placeholder="Style name..." value="${s.name || ''}" />
            </div>

            <div class="trix-sm-field-v2">
              <label style="display:flex; justify-content:space-between; align-items:center;">
                <span>Tags <span class="trix-text-muted">(auto-generated or custom)</span></span>
                <span class="trix-tag-status-msg" style="font-size:11px; font-weight:600;"></span>
              </label>
              <input type="text" class="trix-input-v2 trix-sm-tag-input" placeholder="Tags (e.g. @my_tag)..." value="${s.tag || tagPreview || ''}" />
            </div>

            <div class="trix-sm-field-v2">
              <label>Pack / Category</label>
              <div class="trix-input-group">
                <select class="trix-input-v2 trix-sm-cat">
                  ${categories.map(c => `<option value="${c}" ${s.categoryKey === c ? 'selected' : ''}>${c}</option>`).join('')}
                </select>
                <button class="trix-btn-secondary trix-sm-new-pack-btn" title="Create New Pack">✚ New</button>
              </div>
            </div>

            <!-- Prompts -->
            <div class="trix-sm-field-v2" style="flex: 1;">
              <label>Positive Prompt</label>
              <textarea class="trix-input-v2 trix-textarea trix-sm-pos" style="flex: 1; min-height: 200px;" placeholder="Positive prompt...">${s.positive || s.prompt || ''}</textarea>
            </div>

            <div class="trix-sm-field-v2">
              <label>Negative Prompt <span class="trix-text-muted">(optional)</span></label>
              <textarea class="trix-input-v2 trix-textarea trix-sm-neg" rows="5" placeholder="Negative prompt...">${s.negative || ''}</textarea>
            </div>
          </div>

          <div class="trix-form-col" style="flex: 1.2; display: flex; flex-direction: column;">
            <!-- Image Upload Section -->
            <div class="trix-sm-field-v2">
              <label>Thumbnails <span class="trix-text-muted">(optional)</span></label>
              <div class="trix-dropzone-layout">
                <!-- Box 1 -->
                <div class="trix-dropzone-v2 ${(this.img1Base64 !== null ? this.img1Base64 : (this.activeTab === 'edit' && s.primaryThumb)) ? 'has-img' : ''}" id="trix-dropzone-1">
                  <input type="file" accept="image/*" class="trix-sm-file-input" id="trix-file-1" hidden />
                  ${(this.img1Base64 !== null ? this.img1Base64 : (this.activeTab === 'edit' && s.primaryThumb ? this.getThumbUrl(s.primaryThumb) : null)) 
                    ? `<div class="trix-dropzone-preview"><img src="${this.img1Base64 !== null ? this.img1Base64 : this.getThumbUrl(s.primaryThumb)}" /></div><button class="trix-dropzone-remove" data-box="1">✕</button>` 
                    : `<div class="trix-dropzone-placeholder"><span class="trix-icon">ᨒ</span><span>Primary</span><small>Drop image</small></div>`}
                </div>

                <!-- Box 2 (Compare Slider) -->
                <div class="trix-dropzone-v2 ${(this.img2Base64 !== null ? this.img2Base64 : (this.activeTab === 'edit' && s.compareThumb)) ? 'has-img' : ''}" id="trix-dropzone-2">
                  <input type="file" accept="image/*" class="trix-sm-file-input" id="trix-file-2" hidden />
                  ${(this.img2Base64 !== null ? this.img2Base64 : (this.activeTab === 'edit' && s.compareThumb ? this.getThumbUrl(s.compareThumb) : null)) 
                    ? `<div class="trix-dropzone-preview"><img src="${this.img2Base64 !== null ? this.img2Base64 : this.getThumbUrl(s.compareThumb)}" /></div><button class="trix-dropzone-remove" data-box="2">✕</button>` 
                    : `<div class="trix-dropzone-placeholder"><span class="trix-icon">🗘</span><span>Compare</span><small>Drop image</small></div>`}
                </div>
              </div>
              <div class="trix-dropzone-hint">
                ${(this.img1Base64 !== null ? this.img1Base64 : (this.activeTab === 'edit' && s.primaryThumb)) && (this.img2Base64 !== null ? this.img2Base64 : (this.activeTab === 'edit' && s.compareThumb))
                  ? '<span style="color:var(--trix-prompt-accent, #ff5500);">㊉ Dual Compare Mode</span>' 
                  : 'Upload 2 images for Before/After comparison.'}
              </div>
              <button class="trix-btn-save trix-sm-save-btn">
                <span class="trix-icon">🖫</span> Save Style
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderPacksTab(categories) {
    let filteredStyles = this.styles.filter(s => {
      if (this.selectedCategory === "All") return true;
      return (s.categoryKey || s.category) === this.selectedCategory;
    });

    if (this.smSearchQuery) {
      const q = this.smSearchQuery.toLowerCase();
      filteredStyles = filteredStyles.filter(s => (s.name || '').toLowerCase().includes(q) || (s.tag || '').toLowerCase().includes(q));
    }

    return `
      <div class="trix-sm-packs-layout-v2">
        <!-- Sidebar Packs List -->
        <div class="trix-sm-sidebar-v2">
          <div class="trix-sm-sidebar-header-v2">
            <h3>Packs</h3>
            <button class="trix-icon-btn-small trix-sm-add-pack-icon" title="Add Pack">✚</button>
          </div>
          <div class="trix-sm-sidebar-scroll">
            <div class="trix-pack-item-v2 ${this.selectedCategory === 'All' ? 'active' : ''}" data-cat="All">
              <span class="trix-pack-icon">🌏︎</span>
              <span class="trix-pack-name">All Styles</span>
              <span class="trix-pack-count">${this.styles.length}</span>
            </div>
            ${categories.map((c, i) => {
              const cnt = this.styles.filter(s => (s.categoryKey || s.category) === c).length;
              return `
                <div class="trix-pack-item-v2 trix-draggable-pack ${this.selectedCategory === c ? 'active' : ''} trix-sm-drop-target" data-cat="${c}" draggable="true">
                  <span class="trix-text-muted" style="font-size:10px; width:14px; text-align:right;">${i + 1}.</span>
                  <span class="trix-pack-icon">❖</span>
                  <span class="trix-pack-name">${c}</span>
                  <span class="trix-pack-count">${cnt}</span>
                  ${c !== 'custom' ? `<button class="trix-pack-del-btn" data-cat="${c}" title="Delete Pack">✕</button>` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Styles Management Main Panel -->
        <div class="trix-sm-main-panel-v2">
          <div class="trix-sm-toolbar-v2">
            <div class="trix-checkbox-wrap">
              <input type="checkbox" class="trix-checkbox trix-sm-select-all" id="trix-sel-all" ${filteredStyles.length > 0 && this.selectedStyleIds.size === filteredStyles.length ? 'checked' : ''}/>
              <label for="trix-sel-all"></label>
            </div>
            
            <!-- SEARCH BOX -->
            <div class="trix-sm-search-wrap" style="flex: 1; margin-left: 16px; margin-right: 16px;">
              <input type="text" class="trix-input-v2 trix-sm-search-input" placeholder="Search styles..." value="${this.smSearchQuery || ''}" style="width: 100%; height: 28px; font-size: 12px; border-radius: 4px; border: 1px solid #2e3245; background: rgba(0,0,0,0.2); padding: 0 8px; color: #fff;">
            </div>

            <div class="trix-toolbar-actions">
              <span class="trix-text-muted" style="font-size:12px;">Selected:</span>
              <select class="trix-input-v2 trix-input-sm trix-sm-target-cat">
                ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
              </select>
              <button class="trix-btn-secondary trix-btn-sm trix-sm-move-btn">Move</button>
              <div class="trix-divider-v"></div>
              <button class="trix-btn-danger trix-btn-sm trix-sm-batch-del-btn">Delete</button>
            </div>
          </div>

          <!-- Styles List Grid -->
          <div class="trix-sm-list-v2 trix-sm-sortable-list">
            ${filteredStyles.length === 0 ? '<div class="trix-empty-state">No styles found.</div>' : ''}
            ${filteredStyles.map((s, i) => {
              const checked = this.selectedStyleIds.has(s.id);
              const tag = s.tag || ("@" + s.name.toLowerCase().replace(/[^a-z0-9]+/g, "_"));
              const thumbUrl = this.getThumbUrl(s.primaryThumb);
              const thumbHtml = thumbUrl ? `
                <div class="trix-sm-thumb-wrap">
                  <img src="${thumbUrl}" class="trix-sm-thumb-img" />
                  <img src="${thumbUrl}" class="trix-sm-thumb-popover" />
                </div>
              ` : '';
              return `
                <div class="trix-style-row-v2 trix-draggable-row ${checked ? 'selected' : ''}" data-id="${s.id}" data-index="${i}" draggable="true">
                  <span class="trix-text-muted" style="font-size:10px; width:20px; text-align:right;">${i + 1}.</span>
                  <input type="checkbox" class="trix-checkbox trix-sm-item-check" data-id="${s.id}" ${checked ? 'checked' : ''} />
                  <div class="trix-style-row-content">
                    <span class="trix-style-row-name">${s.name}</span>
                    <span class="trix-style-row-tag">${tag}</span>
                  </div>
                  <span class="trix-badge">${s.categoryKey || s.category || 'custom'}</span>
                  ${thumbHtml}
                  <div class="trix-style-row-actions">
                    <button class="trix-icon-btn-small trix-sm-edit-style-btn" data-id="${s.id}" title="Edit Style">✎</button>
                    <button class="trix-icon-btn-small danger trix-sm-del-style-btn" data-id="${s.id}" title="Delete Style">✕</button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }

  wireEvents() {
    if (!this.modalEl) return;

    // Close buttons
    const closeBtn = this.modalEl.querySelector(".trix-modal-close-btn");
    if (closeBtn) closeBtn.addEventListener("click", () => this.close());
    const cancelBtn = this.modalEl.querySelector(".trix-modal-cancel");
    if (cancelBtn) cancelBtn.addEventListener("click", () => this.close());

    // ESC to close
    document.removeEventListener("keydown", this._handleKeydown);
    document.addEventListener("keydown", this._handleKeydown);

    // Tabs
    this.modalEl.querySelectorAll(".trix-modal-tab-v2").forEach(btn => {
      btn.addEventListener("click", () => {
        this.activeTab = btn.dataset.tab;
        this.render();
      });
    });

    if (this.activeTab === "add" || this.activeTab === "edit") {
      this.wireAddTabEvents();
    } else {
      this.wirePacksTabEvents();
    }
  }

  _handleKeydown = (e) => {
    if (e.key === "Escape") {
      this.close();
    }
  };

  close() {
    document.removeEventListener("keydown", this._handleKeydown);
    if (this.modalEl && this.modalEl.parentNode) {
      this.modalEl.parentNode.removeChild(this.modalEl);
      this.modalEl = null;
    }
  }

  wireAddTabEvents() {
    const nameInput = this.modalEl.querySelector(".trix-sm-name");
    const tagInput = this.modalEl.querySelector(".trix-sm-tag-input");

    const tagStatusEl = this.modalEl.querySelector(".trix-tag-status-msg");

    const checkTagExists = (val) => {
      if (!tagInput || !tagStatusEl) return;
      const cleanVal = (val || "").trim().toLowerCase();
      if (!cleanVal) {
        tagStatusEl.textContent = "";
        tagInput.style.borderColor = "";
        return;
      }
      
      const formatted = cleanVal.startsWith("@") ? cleanVal : "@" + cleanVal;
      
      const existing = this.styles.find(s => {
        if (this.activeTab === 'edit' && this.editingStyle && (s.id === this.editingStyle.id || s.name === this.editingStyle.name)) {
          return false;
        }
        const sTag = (s.tag || ("@" + (s.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "_"))).toLowerCase();
        return sTag === formatted;
      });

      if (existing) {
        tagStatusEl.textContent = `⚠️ Tag "${formatted}" already exists! (${existing.categoryKey || existing.category || 'pack'})`;
        tagStatusEl.style.color = "#f59e0b";
        tagInput.style.borderColor = "#f59e0b";
      } else {
        tagStatusEl.textContent = `✓ Available`;
        tagStatusEl.style.color = "#10b981";
        tagInput.style.borderColor = "";
      }
    };

    if (nameInput && tagInput) {
      nameInput.addEventListener("input", (e) => {
        if (!tagInput.dataset.manuallyEdited) {
          const val = e.target.value.trim();
          tagInput.value = val ? "@" + val.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") : "";
        }
        checkTagExists(tagInput.value);
      });
      tagInput.addEventListener("input", () => {
        tagInput.dataset.manuallyEdited = "true";
        checkTagExists(tagInput.value);
      });
      
      // Initial check
      checkTagExists(tagInput.value);
    }

    // New Pack Button
    const newPackBtn = this.modalEl.querySelector(".trix-sm-new-pack-btn");
    if (newPackBtn) {
      newPackBtn.addEventListener("click", async () => {
        const packName = prompt("Enter new style pack name:");
        if (packName && packName.trim()) {
          const clean = packName.trim();
          const catSelect = this.modalEl.querySelector(".trix-sm-cat");
          const opt = document.createElement("option");
          opt.value = clean;
          opt.textContent = clean;
          opt.selected = true;
          catSelect.appendChild(opt);
          await this._createCategoryBackend(clean);
        }
      });
    }

    // Dropzones Image Upload
    this.setupDropzone(1);
    this.setupDropzone(2);

    // 
    const saveBtn = this.modalEl.querySelector(".trix-sm-save-btn");
    if (saveBtn) {
      saveBtn.addEventListener("click", async () => {
        const name = this.modalEl.querySelector(".trix-sm-name").value.trim();
        if (!name) {
          alert("Please enter a style name.");
          return;
        }
        const categoryKey = this.modalEl.querySelector(".trix-sm-cat").value;
        const positive = this.modalEl.querySelector(".trix-sm-pos").value.trim();
        const negative = this.modalEl.querySelector(".trix-sm-neg").value.trim();

        const tagVal = this.modalEl.querySelector(".trix-sm-tag-input").value.trim();
        const derivedTag = "@" + name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
        const finalTag = tagVal || derivedTag;

        const isActuallyEditing = (this.activeTab === 'edit' && this.editingStyle);
        const payload = {
          id: isActuallyEditing ? this.editingStyle.id : null,
          name: name,
          tag: finalTag,
          categoryKey: categoryKey,
          category: categoryKey,
          positive,
          negative,
          image1_base64: this.img1Base64,
          image2_base64: this.img2Base64,
          thumbnail: isActuallyEditing ? this.editingStyle.thumbnail : "",
        };

        saveBtn.disabled = true;
        saveBtn.innerHTML = `<span class="trix-icon">⌛︎</span> Saving...`;

        try {
          const r = await fetch("/trix_prompt/styles/save_custom", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
          const res = await r.json();
          if (res.status === "success") {
            this.styles = res.styles || [];
            if (Array.isArray(res.categories)) {
              this.categories = res.categories;
            }
            this._cacheBuster = Date.now();
            this.close();
            if (this.onSave) this.onSave(this.styles, this.categories);
          } else {
            alert("Error saving style: " + res.message);
          }
        } catch (err) {
          alert("Error: " + err.message);
        } finally {
          saveBtn.disabled = false;
        }
      });
    }
  }

  setupDropzone(boxNum) {
    const dz = this.modalEl.querySelector(`#trix-dropzone-${boxNum}`);
    const input = this.modalEl.querySelector(`#trix-file-${boxNum}`);
    if (!dz || !input) return;

    const updateUI = (base64) => {
      dz.querySelectorAll('.trix-dropzone-preview, .trix-dropzone-placeholder, .trix-dropzone-remove').forEach(el => el.remove());
      if (!base64) {
        dz.classList.remove("has-img");
        dz.insertAdjacentHTML('beforeend', `
          <div class="trix-dropzone-placeholder">
            <span class="trix-icon">${boxNum === 1 ? 'ᨒ' : '🗘'}</span>
            <span>Photo ${boxNum} ${boxNum === 1 ? '(Main)' : '(Compare)'}</span>
            <small>${boxNum === 1 ? 'Drag & Drop' : 'Optional'}</small>
          </div>
        `);
      } else {
        dz.classList.add("has-img");
        dz.insertAdjacentHTML('beforeend', `
          <div class="trix-dropzone-preview"><img src="${base64}" /></div>
          <button class="trix-dropzone-remove" data-box="${boxNum}">✕</button>
        `);
      }
      
      const hint = this.modalEl.querySelector(".trix-dropzone-hint");
      if (hint) {
        const has1 = this.img1Base64 !== null ? !!this.img1Base64 : (this.activeTab === 'edit' && this.editingStyle?.primaryThumb);
        const has2 = this.img2Base64 !== null ? !!this.img2Base64 : (this.activeTab === 'edit' && this.editingStyle?.compareThumb);
        hint.innerHTML = (has1 && has2) 
          ? '<span style="color:var(--trix-prompt-accent, #ff5500);">㊉ Dual Compare Mode</span>' 
          : 'Upload 2 images for Before/After comparison.';
      }
    };

    dz.addEventListener("click", (e) => {
      if (e.target.classList.contains("trix-dropzone-remove")) {
        e.stopPropagation();
        if (boxNum === 1) this.img1Base64 = "";
        if (boxNum === 2) this.img2Base64 = "";
        updateUI("");
        return;
      }
      input.click();
    });

    input.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          if (boxNum === 1) this.img1Base64 = ev.target.result;
          if (boxNum === 2) this.img2Base64 = ev.target.result;
          updateUI(ev.target.result);
        };
        reader.readAsDataURL(file);
      }
    });

    dz.addEventListener("dragover", (e) => { e.preventDefault(); dz.classList.add("drag-over"); });
    dz.addEventListener("dragleave", () => dz.classList.remove("drag-over"));
    dz.addEventListener("drop", (e) => {
      e.preventDefault();
      dz.classList.remove("drag-over");
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          if (boxNum === 1) this.img1Base64 = ev.target.result;
          if (boxNum === 2) this.img2Base64 = ev.target.result;
          updateUI(ev.target.result);
        };
        reader.readAsDataURL(file);
      }
    });
  }

  async _createCategoryBackend(catName) {
    try {
      const clean = catName.trim().toLowerCase().replace(/[^a-z0-9_\-]/g, '_').replace(/^_+|_+$/g, '');
      if (!clean) return;
      const r = await fetch("/trix_prompt/styles/create_category", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category_key: clean })
      });
      const res = await r.json();
      if (res.status === "success") {
        this.styles = res.styles || [];
        if (Array.isArray(res.categories)) {
          this.categories = res.categories;
        } else if (!this.categories.includes(clean)) {
          this.categories.push(clean);
        }
        this._cacheBuster = Date.now();
        if (this.onSave) this.onSave(this.styles, this.categories);
      }
    } catch (e) {
      console.error("Error creating category:", e);
    }
  }

  _showPackDeleteDialog(catName, onAction) {
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:absolute; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.8); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(2px);";
    overlay.innerHTML = `
      <div style="background:#14161e; border:1px solid #2e3245; border-radius:8px; padding:20px; width:340px; text-align:center; box-shadow:0 10px 30px rgba(0,0,0,0.5);">
        <h3 style="margin:0 0 10px 0; color:#fff; font-size:14px;">Delete Pack: ${catName}</h3>
        <p style="color:#8a99ad; font-size:12px; margin-bottom:20px; line-height:1.4;">
          What would you like to do with the styles inside this pack?
        </p>
        <div style="display:flex; flex-direction:column; gap:8px;">
          <button class="trix-btn-secondary" id="btn-move" style="background:#1c1e26; justify-content:flex-start; padding:8px 12px; height:auto; text-align:left;">
            <div><span style="font-size:14px; margin-right:6px;">❖</span> <b style="color:#fff;">Move styles to custom</b></div>
            <small style="font-weight:normal; color:#6a7689; display:block; margin-top:2px;">Pack deleted, styles preserved.</small>
          </button>
          <button class="trix-btn-secondary" id="btn-delete" style="background:rgba(239,68,68,0.1); justify-content:flex-start; border-color:rgba(239,68,68,0.2); padding:8px 12px; height:auto; text-align:left;">
            <div><span style="font-size:14px; margin-right:6px;">✖︎</span> <b style="color:#ef4444;">Delete ALL styles</b></div>
            <small style="font-weight:normal; color:#ef4444; opacity:0.8; display:block; margin-top:2px;">Irreversible action.</small>
          </button>
          <button class="trix-btn" id="btn-cancel" style="margin-top:8px;">Cancel</button>
        </div>
      </div>
    `;
    this.modalEl.appendChild(overlay);

    overlay.querySelector("#btn-move").onclick = () => { overlay.remove(); onAction("move"); };
    overlay.querySelector("#btn-delete").onclick = () => { overlay.remove(); onAction("delete"); };
    overlay.querySelector("#btn-cancel").onclick = () => { overlay.remove(); onAction("cancel"); };
  }

  _createDragGhost(text, icon = "❖") {
    const ghost = document.createElement("div");
    ghost.className = "trix-drag-ghost-badge";
    ghost.style.cssText = `
      position: absolute;
      top: -1000px;
      left: -1000px;
      z-index: 999999;
      padding: 6px 14px;
      background: #1e212b;
      border: 1px solid var(--trix-prompt-accent, #ff5500);
      color: #ffffff;
      font-size: 12px;
      font-weight: 600;
      font-family: sans-serif;
      border-radius: 6px;
      box-shadow: 0 8px 20px rgba(0,0,0,0.6);
      display: flex;
      align-items: center;
      gap: 8px;
      pointer-events: none;
      white-space: nowrap;
    `;
    ghost.innerHTML = `<span style="color:var(--trix-prompt-accent, #ff5500); font-weight:700;">${icon}</span> <span>${text}</span>`;
    document.body.appendChild(ghost);
    return ghost;
  }

  wirePacksTabEvents() {
    // --- Drag and Drop Logic ---
    let draggedRow = null;
    let draggedPack = null;

    this.modalEl.querySelectorAll(".trix-draggable-pack").forEach(packRow => {
      packRow.addEventListener("dragstart", (e) => {
        draggedPack = packRow;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("type", "pack");
        e.dataTransfer.setData("text/plain", packRow.dataset.cat);

        const ghost = this._createDragGhost(packRow.dataset.cat, "❖");
        if (e.dataTransfer.setDragImage) {
          e.dataTransfer.setDragImage(ghost, 20, 15);
        }
        setTimeout(() => {
          if (ghost.parentNode) ghost.remove();
          packRow.style.opacity = "0.5";
        }, 0);
      });
      packRow.addEventListener("dragend", () => {
        draggedPack = null;
        packRow.style.opacity = "1";
      });
    });

    this.modalEl.querySelectorAll(".trix-draggable-row").forEach(row => {
      row.addEventListener("dragstart", (e) => {
        draggedRow = row;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("type", "style");
        e.dataTransfer.setData("text/plain", row.dataset.id);

        const nameEl = row.querySelector(".trix-style-row-name");
        const styleName = nameEl ? nameEl.textContent.trim() : "Style";
        const ghost = this._createDragGhost(styleName, "✎");
        if (e.dataTransfer.setDragImage) {
          e.dataTransfer.setDragImage(ghost, 20, 15);
        }
        setTimeout(() => {
          if (ghost.parentNode) ghost.remove();
          row.style.opacity = "0.5";
        }, 0);
      });
      row.addEventListener("dragend", () => {
        draggedRow = null;
        row.style.opacity = "1";
      });
      row.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        row.style.borderTop = "2px solid var(--trix-prompt-accent, #ff5500)";
      });
      row.addEventListener("dragleave", () => {
        row.style.borderTop = "";
      });
      row.addEventListener("drop", async (e) => {
        e.preventDefault();
        row.style.borderTop = "";
        const dragType = e.dataTransfer.getData("type");
        if (dragType !== "style" || !draggedRow || draggedRow === row) return;
        
        // Reordering & category move logic
        const fromId = draggedRow.dataset.id;
        const toId = row.dataset.id;

        const fromStyle = this.styles.find(s => s.id === fromId || s.name === fromId);
        const toStyle = this.styles.find(s => s.id === toId || s.name === toId);

        if (!fromStyle || !toStyle) return;

        const fromCat = fromStyle.categoryKey || fromStyle.category || "custom";
        const toCat = toStyle.categoryKey || toStyle.category || "custom";

        try { localStorage.removeItem("trix_style_order"); } catch (_) {}

        if (fromCat === toCat) {
          const catStyles = this.styles.filter(s => (s.categoryKey || s.category) === fromCat);
          const fromIndex = catStyles.findIndex(s => s.id === fromId || s.name === fromId);
          const toIndex = catStyles.findIndex(s => s.id === toId || s.name === toId);

          if (fromIndex > -1 && toIndex > -1 && fromIndex !== toIndex) {
            const [movedItem] = catStyles.splice(fromIndex, 1);
            catStyles.splice(toIndex, 0, movedItem);

            const orderedIds = catStyles.map(s => s.id || s.name);

            try {
              const r = await fetch("/trix_prompt/styles/reorder", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ category: fromCat, ordered_ids: orderedIds })
              });
              const res = await r.json();
              if (res.status === "success") {
                this.styles = res.styles || [];
                if (Array.isArray(res.categories)) this.categories = res.categories;
                this._cacheBuster = Date.now();
                this.render();
                if (this.onSave) this.onSave(this.styles, this.categories);
              }
            } catch (err) {
              console.error("Error reordering styles on server:", err);
            }
          }
        } else {
          try {
            const r = await fetch("/trix_prompt/styles/move_category", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ style_ids: [fromId], target_category: toCat })
            });
            const res = await r.json();
            if (res.status === "success") {
              this.styles = res.styles || [];
              if (Array.isArray(res.categories)) this.categories = res.categories;
              this._cacheBuster = Date.now();
              this.render();
              if (this.onSave) this.onSave(this.styles, this.categories);
            }
          } catch (err) {
            console.error("Error moving style category on server:", err);
          }
        }
      });
    });

    this.modalEl.querySelectorAll(".trix-sm-drop-target").forEach(pack => {
      pack.addEventListener("dragover", (e) => {
        e.preventDefault();
        pack.classList.add("drag-over");
        pack.style.background = "rgba(255,85,0,0.2)";
      });
      pack.addEventListener("dragleave", () => {
        pack.classList.remove("drag-over");
        pack.style.background = "";
      });
      pack.addEventListener("drop", async (e) => {
        e.preventDefault();
        pack.classList.remove("drag-over");
        pack.style.background = "";
        
        const dragType = e.dataTransfer.getData("type");
        const targetCat = pack.dataset.cat;
        
        if (dragType === "pack") {
          const fromCat = e.dataTransfer.getData("text/plain");
          if (!fromCat || fromCat === targetCat) return;
          
          let cats = this.getCategories();
          const fromIndex = cats.indexOf(fromCat);
          const toIndex = cats.indexOf(targetCat);
          if (fromIndex > -1 && toIndex > -1) {
            cats.splice(fromIndex, 1);
            cats.splice(toIndex, 0, fromCat);
            
            const orderMap = {};
            cats.forEach((c, idx) => { orderMap[c] = idx; });
            localStorage.setItem("trix_pack_order", JSON.stringify(orderMap));
            this.render();
          }
          return;
        }

        const styleId = e.dataTransfer.getData("text/plain");
        if (targetCat === "All" || !styleId) return;
        
        try {
          const r = await fetch("/trix_prompt/styles/move_category", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ style_ids: [styleId], target_category: targetCat })
          });
          const res = await r.json();
          if (res.status === "success") {
            this.styles = res.styles;
            if (Array.isArray(res.categories)) this.categories = res.categories;
            this._cacheBuster = Date.now();
            this.render();
            if (this.onSave) this.onSave(this.styles, this.categories);
          }
        } catch (err) { alert(err.message); }
      });
    });
    // --- End Drag and Drop ---

    // Pack selection
    this.modalEl.querySelectorAll(".trix-pack-item-v2").forEach(item => {
      item.addEventListener("click", (e) => {
        if (e.target.classList.contains("trix-pack-del-btn")) return;
        this.selectedCategory = item.dataset.cat;
        this.selectedStyleIds.clear();
        this.render();
      });
    });

    // Delete pack
    this.modalEl.querySelectorAll(".trix-pack-del-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const cat = btn.dataset.cat;
        
        this._showPackDeleteDialog(cat, async (action) => {
          if (action === "move" || action === "delete") {
            try {
              const r = await fetch("/trix_prompt/styles/delete_category", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ category_key: cat, delete_styles: (action === "delete") })
              });
              const res = await r.json();
              if (res.status === "success") {
                this.styles = res.styles;
                this.selectedCategory = "All";
                this.render();
                if (this.onSave) this.onSave(res.styles);
              }
            } catch (err) { alert(err.message); }
          }
        });
      });
    });

    // Add new pack
    const addPackIcon = this.modalEl.querySelector(".trix-sm-add-pack-icon");
    if (addPackIcon) {
      addPackIcon.addEventListener("click", async () => {
        const pName = prompt("Enter new pack name:");
        if (pName && pName.trim()) {
          const clean = pName.trim();
          this.selectedCategory = clean;
          await this._createCategoryBackend(clean);
          this.render();
        }
      });
    }

    // Select All
    const selectAll = this.modalEl.querySelector(".trix-sm-select-all");
    if (selectAll) {
      selectAll.addEventListener("change", (e) => {
        let filtered = this.styles.filter(s => this.selectedCategory === "All" || (s.categoryKey || s.category) === this.selectedCategory);
        if (this.smSearchQuery) {
          const q = this.smSearchQuery.toLowerCase();
          filtered = filtered.filter(s => (s.name || '').toLowerCase().includes(q) || (s.tag || '').toLowerCase().includes(q));
        }
        if (e.target.checked) {
          filtered.forEach(s => this.selectedStyleIds.add(s.id));
        } else {
          this.selectedStyleIds.clear();
        }
        this.render();
      });
    }

    const searchInput = this.modalEl.querySelector(".trix-sm-search-input");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.smSearchQuery = e.target.value;
        const q = this.smSearchQuery.toLowerCase().trim();
        const rows = this.modalEl.querySelectorAll(".trix-style-row-v2");
        rows.forEach(row => {
          const name = (row.querySelector(".trix-style-row-name")?.textContent || "").toLowerCase();
          const tag = (row.querySelector(".trix-style-row-tag")?.textContent || "").toLowerCase();
          const match = !q || name.includes(q) || tag.includes(q);
          row.style.display = match ? "" : "none";
        });
      });
    }

    // Item checkbox
    this.modalEl.querySelectorAll(".trix-sm-item-check").forEach(chk => {
      chk.addEventListener("change", (e) => {
        const id = chk.dataset.id;
        if (chk.checked) this.selectedStyleIds.add(id);
        else this.selectedStyleIds.delete(id);
        this.render();
      });
    });

    // Move button
    const moveBtn = this.modalEl.querySelector(".trix-sm-move-btn");
    if (moveBtn) {
      moveBtn.addEventListener("click", async () => {
        if (this.selectedStyleIds.size === 0) {
          alert("Please select styles to move.");
          return;
        }
        const targetCat = this.modalEl.querySelector(".trix-sm-target-cat").value;
        try {
          const r = await fetch("/trix_prompt/styles/move_category", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ style_ids: Array.from(this.selectedStyleIds), target_category: targetCat })
          });
          const res = await r.json();
          if (res.status === "success") {
            this.styles = res.styles;
            this.selectedStyleIds.clear();
            this.render();
            if (this.onSave) this.onSave(res.styles);
          }
        } catch (err) { alert(err.message); }
      });
    }

    // Batch Delete button
    const batchDelBtn = this.modalEl.querySelector(".trix-sm-batch-del-btn");
    if (batchDelBtn) {
      batchDelBtn.addEventListener("click", async () => {
        if (this.selectedStyleIds.size === 0) {
          alert("Please select styles to delete.");
          return;
        }
        if (confirm(`Delete ${this.selectedStyleIds.size} selected style(s)?`)) {
          try {
            for (const id of this.selectedStyleIds) {
              await fetch("/trix_prompt/styles/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id })
              });
            }
            const r = await fetch("/trix_prompt/styles");
            const res = await r.json();
            const list = Array.isArray(res) ? res : (res.styles || []);
            this.styles = list;
            this.selectedStyleIds.clear();
            this.render();
            if (this.onSave) this.onSave(list);
          } catch (err) { alert(err.message); }
        }
      });
    }

    // Edit individual style
    this.modalEl.querySelectorAll(".trix-sm-edit-style-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const style = this.styles.find(s => s.id === id);
        if (style) {
          this.editingStyle = style;
          this.img1Base64 = null;
          this.img2Base64 = null;
          this.activeTab = "edit";
          this.render();
        }
      });
    });

    // Delete individual style
    this.modalEl.querySelectorAll(".trix-sm-del-style-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        if (confirm("Delete this style?")) {
          try {
            const r = await fetch("/trix_prompt/styles/delete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id })
            });
            const res = await r.json();
            const list = Array.isArray(res) ? res : (res.styles || []);
            this.styles = list;
            this.render();
            if (this.onSave) this.onSave(list);
          } catch (err) { alert(err.message); }
        }
      });
    });
  }
}
