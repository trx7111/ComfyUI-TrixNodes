/**
 * TagAutocomplete — Floating autocomplete dropdown popup for @style_tags.
 */
export class TagAutocomplete {
  constructor(rootContainer) {
    this.root = rootContainer;
    this.activeTa = null;
    this.styleTagMap = new Map();
    this.filteredItems = [];
    this.selectedIndex = 0;
    this.queryStart = -1;
    this.queryEnd = -1;
    this._createPopup();
  }

  setStyleTagMap(map) {
    this.styleTagMap = map || new Map();
  }

  setCategorySet(set) {
    this.categorySet = set || new Set();
  }

  _createPopup() {
    this.popupEl = document.createElement("div");
    this.popupEl.className = "trix-tag-popup";
    this.popupEl.style.display = "none";
    this.popupEl.addEventListener("pointerdown", (e) => e.stopPropagation());
    this.popupEl.addEventListener("mousedown", (e) => e.stopPropagation());
    document.body.appendChild(this.popupEl);

    // Prevent losing focus on click inside popup
    this.popupEl.addEventListener("mousedown", (e) => e.preventDefault());
  }

  attach(textarea, onTagInserted) {
    if (!textarea) return;

    textarea.addEventListener("input", (e) => this._onInput(textarea, onTagInserted));
    textarea.addEventListener("keydown", (e) => this._onKeyDown(e, textarea, onTagInserted));
    textarea.addEventListener("blur", () => this.hide());
    textarea.addEventListener("scroll", () => {
      if (this.activeTa === textarea && this.popupEl.style.display !== "none") {
        this._updatePosition();
      }
    });
  }

  _onInput(ta, onTagInserted) {
    this.activeTa = ta;
    const caret = ta.selectionStart;
    const val = ta.value;
    const textBeforeCaret = val.slice(0, caret);

    // Look for @tag or *category pattern ending at caret
    const match = textBeforeCaret.match(/([@\*])([a-zA-Z0-9_-]*)$/);
    if (!match) {
      this.hide();
      return;
    }

    const trigger = match[1]; // '@' or '*'
    const q = match[2].toLowerCase();
    this.queryStart = caret - match[0].length;
    this.queryEnd = caret;

    const matches = [];
    
    if (trigger === '@') {
      for (const [tag, style] of this.styleTagMap.entries()) {
        const nameMatch = style.name && style.name.toLowerCase().includes(q);
        const tagMatch = tag.toLowerCase().includes("@" + q) || tag.toLowerCase().includes(q);
        if (nameMatch || tagMatch) {
          matches.push({ type: 'tag', tag, style });
        }
        if (matches.length >= 20) break;
      }
    } else if (trigger === '*') {
      if (this.categorySet) {
        for (const cat of this.categorySet) {
          const catStr = String(cat);
          if (catStr.toLowerCase().includes(q)) {
            matches.push({ type: 'category', tag: "*" + catStr, style: { name: catStr } });
          }
          if (matches.length >= 20) break;
        }
      }
    }

    if (matches.length === 0) {
      this.hide();
      return;
    }

    this.filteredItems = matches;
    this.selectedIndex = 0;
    this._renderPopup(onTagInserted);
    this._updatePosition();
    this.popupEl.style.display = "flex";
  }

  _onKeyDown(e, ta, onTagInserted) {
    if (this.popupEl.style.display === "none") return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      this.selectedIndex = (this.selectedIndex + 1) % this.filteredItems.length;
      this._highlightItem();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      this.selectedIndex = (this.selectedIndex - 1 + this.filteredItems.length) % this.filteredItems.length;
      this._highlightItem();
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      if (this.filteredItems[this.selectedIndex]) {
        this.selectItem(this.filteredItems[this.selectedIndex], onTagInserted);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      this.hide();
    }
  }

  _renderPopup(onTagInserted) {
    this.popupEl.innerHTML = "";
    this.filteredItems.forEach((item, idx) => {
      const el = document.createElement("div");
      el.className = "trix-tag-item" + (idx === this.selectedIndex ? " active" : "");
      
      if (item.type === 'category') {
        el.innerHTML = `
          <span class="trix-tag-item-icon">❖</span>
          <span class="trix-tag-item-name">${item.style.name}</span>
          <span class="trix-tag-item-tag" style="color:#DD7055;">${item.tag}</span>
        `;
      } else {
        const thumbUrl = item.style.primaryThumb ? ("/trix_prompt/image?img=" + encodeURIComponent(item.style.primaryThumb)) : "";
        el.innerHTML = `
          ${thumbUrl ? `<img class="trix-tag-item-thumb" src="${thumbUrl}" onerror="this.style.display='none';" />` : `<span class="trix-tag-item-icon">𖤘</span>`}
          <span class="trix-tag-item-name">${item.style.name}</span>
          <span class="trix-tag-item-tag">${item.tag}</span>
        `;
      }

      el.addEventListener("click", () => {
        this.selectItem(item, onTagInserted);
      });

      this.popupEl.appendChild(el);
    });
  }

  _highlightItem() {
    const items = this.popupEl.querySelectorAll(".trix-tag-item");
    items.forEach((el, idx) => {
      const isActive = idx === this.selectedIndex;
      el.classList.toggle("active", isActive);
      if (isActive) {
        el.scrollIntoView({ block: "nearest" });
      }
    });
  }

  selectItem(item, onTagInserted) {
    if (!this.activeTa) return;
    const ta = this.activeTa;
    const val = ta.value;

    const before = val.slice(0, this.queryStart);
    const after = val.slice(this.queryEnd);
    const inserted = item.tag + " ";

    ta.value = before + inserted + after;
    const newCaret = before.length + inserted.length;
    ta.selectionStart = newCaret;
    ta.selectionEnd = newCaret;

    ta.dispatchEvent(new Event("input"));
    this.hide();

    if (onTagInserted) onTagInserted(item);
  }

  _updatePosition() {
    if (!this.activeTa) return;
    const rect = this.activeTa.getBoundingClientRect();
    this.popupEl.style.left = `${rect.left}px`;
    this.popupEl.style.top = `${rect.bottom + 4}px`;
    this.popupEl.style.width = `${Math.max(rect.width, 240)}px`;
  }

  hide() {
    this.popupEl.style.display = "none";
    this.activeTa = null;
  }
}
