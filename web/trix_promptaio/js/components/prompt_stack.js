import { TagAutocomplete } from "./tag_autocomplete.js";

/**
 * PromptStack — Prompt row stack manager.
 * Supports getCompiledPositive() for workflow execution.
 *
 * Translation Modes:
 *  - "button"  : Shows popup tooltip above selected text on click, click popup → replace selection
 *  - "live"    : Shows floating popup to the right of textarea while typing, click popup → replace all
 *  - "output"  : No frontend translation UI; backend translates on queue run
 */
export class PromptStack {
  constructor(containerEl, onStateChange, onGrowNeeded) {
    this.container = containerEl;
    this.onStateChange = onStateChange;
    this.onGrowNeeded = onGrowNeeded;
    this.stackEl = containerEl.querySelector(".trix-ps-rows");
    this.transEnabled = false;
    this.transMode = "live";
    this.transEngine = "online_google";
    this.srcLang = "auto";
    this.tgtLang = "en";
    this.offlineModel = "nllb_200_distilled";
    this.draggedRow = null;
    this._rowId = 0;
    this.styleTagMap = new Map();
    this.autocomplete = new TagAutocomplete(containerEl);
    this._clientTransCache = new Map();

    // Single shared live-popup element (one at a time)
    this._livePopup = null;
    this._livePopupTA = null;
    this._livePopupTimer = null;
    this._livePopupTranslating = false;
  }

  /** Called by prompt_engine_ui.js when settings change */
  setTranslationConfig(enabled, mode, engine, src, tgt, offlineModel) {
    this.transEnabled = !!enabled;
    this.transMode = mode || this.transMode;
    this.transEngine = engine || this.transEngine;
    this.srcLang = src || this.srcLang;
    this.tgtLang = tgt || this.tgtLang;
    this.offlineModel = offlineModel || this.offlineModel;
    if (!this.transEnabled) this._hideLivePopup();
  }

  /** Legacy compat for old callers */
  setLiveTranslate(enabled, engine, src, tgt) {
    this.transEnabled = enabled;
    this.transEngine = engine || this.transEngine;
    this.srcLang = src || this.srcLang;
    this.tgtLang = tgt || this.tgtLang;
    if (!enabled) this._hideLivePopup();
  }

  setStyleTagMap(map) {
    this.styleTagMap = map || new Map();
    if (this.autocomplete) this.autocomplete.setStyleTagMap(this.styleTagMap);
  }

  setCategorySet(set) {
    this.categorySet = set || new Set();
    if (this.autocomplete) this.autocomplete.setCategorySet(this.categorySet);
  }

  // ─── Live popup (mode: "live") ───────────────────────────────────────────────

  _ensureLivePopup() {
    if (!this._livePopup) {
      const el = document.createElement("div");
      el.className = "trix-translate-live-popup";
      el.title = "Click to insert translation";
      el.innerHTML = `<span class="trix-translate-popup-arrow">→</span><span class="trix-translate-popup-text"></span>`;
      document.body.appendChild(el);
      this._livePopup = el;
    }
    return this._livePopup;
  }

  _hideLivePopup() {
    if (this._livePopup) {
      this._livePopup.classList.remove("visible");
      this._livePopupTA = null;
    }
    clearTimeout(this._livePopupTimer);
    this._livePopupTranslating = false;
  }

  _showLivePopup(ta, translatedText) {
    const popup = this._ensureLivePopup();
    const textEl = popup.querySelector(".trix-translate-popup-text");
    textEl.textContent = translatedText;

    // Position: to the right of the textarea
    const rect = ta.getBoundingClientRect();
    popup.style.top = rect.top + "px";
    popup.style.left = (rect.right + 8) + "px";
    popup.classList.add("visible");

    // Store reference to current textarea
    this._livePopupTA = ta;

    // Click to replace all text in textarea
    popup.onclick = null;
    popup.onclick = () => {
      if (this._livePopupTA) {
        this._livePopupTA.value = translatedText;
        this._livePopupTA.dispatchEvent(new Event("input"));
        this._hideLivePopup();
      }
    };
  }

  _showSelectionPopup(ta, selectedText, promiseOrText) {
    if (this._selectionPopup && this._selectionPopupTA === ta && this._selectionPopupText === selectedText) {
      return;
    }

    this._hideSelectionPopup();

    const savedStart = ta.selectionStart;
    const savedEnd = ta.selectionEnd;
    const savedSelectedText = selectedText;

    const popup = document.createElement("div");
    popup.className = "trix-translate-sel-popup visible";
    popup.title = "Translating...";
    popup.innerHTML = `<span class="trix-translate-popup-arrow">→</span><span class="trix-translate-popup-text">...</span>`;

    const rect = ta.getBoundingClientRect();
    let top = rect.top;
    let left = rect.right + 8;
    if (left + 220 > window.innerWidth) {
      left = Math.max(10, rect.left);
      top = rect.bottom + 6;
    }
    popup.style.top = Math.max(10, Math.min(window.innerHeight - 60, top)) + "px";
    popup.style.left = Math.max(10, Math.min(window.innerWidth - 240, left)) + "px";

    document.body.appendChild(popup);
    this._selectionPopup = popup;
    this._selectionPopupTA = ta;
    this._selectionPopupText = selectedText;

    let finalTranslatedText = "";

    const preventBlur = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    popup.addEventListener("pointerdown", preventBlur, true);
    popup.addEventListener("mousedown", preventBlur, true);

    const doReplace = (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (!finalTranslatedText) return;

      const currentVal = ta.value;
      let s = savedStart;
      let eEnd = savedEnd;

      if (currentVal.substring(s, eEnd) !== savedSelectedText) {
        const idx = currentVal.indexOf(savedSelectedText);
        if (idx !== -1) {
          s = idx;
          eEnd = idx + savedSelectedText.length;
        }
      }

      const before = currentVal.substring(0, s);
      const after = currentVal.substring(eEnd);
      ta.value = before + finalTranslatedText + after;

      const newCursorPos = s + finalTranslatedText.length;
      ta.selectionStart = s;
      ta.selectionEnd = newCursorPos;

      ta.focus();
      ta.dispatchEvent(new Event("input"));
      this._hideSelectionPopup();
    };

    popup.addEventListener("click", doReplace);

    const outsideClose = (e) => {
      if (this._selectionPopup === popup && !popup.contains(e.target) && e.target !== ta) {
        this._hideSelectionPopup();
      }
    };
    setTimeout(() => document.addEventListener("pointerdown", outsideClose, true), 30);

    this._selectionPopupCleanup = () => {
      document.removeEventListener("pointerdown", outsideClose, true);
    };

    const setText = (text) => {
      finalTranslatedText = text;
      popup.title = "Click to replace selection";
      const txtSpan = popup.querySelector(".trix-translate-popup-text");
      if (txtSpan) txtSpan.textContent = text;
    };

    if (typeof promiseOrText === "string") {
      setText(promiseOrText);
    } else if (promiseOrText && typeof promiseOrText.then === "function") {
      promiseOrText.then(translated => {
        if (this._selectionPopup !== popup) return;
        if (!translated) {
          this._hideSelectionPopup();
          return;
        }
        setText(translated);
      }).catch(() => {
        if (this._selectionPopup === popup) this._hideSelectionPopup();
      });
    }
  }

  _hideSelectionPopup() {
    if (this._selectionPopupCleanup) {
      this._selectionPopupCleanup();
      this._selectionPopupCleanup = null;
    }
    if (this._selectionPopup) {
      this._selectionPopup.remove();
      this._selectionPopup = null;
    }
    this._selectionPopupTA = null;
    this._selectionPopupText = null;
  }

  attachTranslationToTextarea(ta) {
    if (!ta || ta._trixTransAttached) return;
    ta._trixTransAttached = true;

    let selTimer = null;
    const evaluateSelection = () => {
      const mode = this.transMode || "button";
      if (!this.transEnabled || (mode !== "button" && mode !== "on_demand" && mode !== "selection")) {
        this._hideSelectionPopup();
        return;
      }

      if (document.activeElement !== ta) return;

      const s = ta.selectionStart;
      const e = ta.selectionEnd;

      if (s === null || e === null || s === e || s > e) {
        this._hideSelectionPopup();
        return;
      }

      const rawSel = ta.value.substring(s, e);
      const selected = rawSel.trim();

      if (!selected) {
        this._hideSelectionPopup();
        return;
      }

      this._showSelectionPopup(ta, selected, this._callTranslate(selected));
    };

    const scheduleCheck = (delay = 20) => {
      clearTimeout(selTimer);
      selTimer = setTimeout(evaluateSelection, delay);
    };

    ta.addEventListener("mousedown", () => {
      this._hideSelectionPopup();
    });

    ta.addEventListener("dblclick", () => {
      scheduleCheck(15);
    });

    ta.addEventListener("mouseup", () => {
      scheduleCheck(15);
    });

    ta.addEventListener("keyup", (e) => {
      if (e.key.includes("Arrow") || e.key === "a" || e.key === "A") {
        scheduleCheck(20);
      }
    });

    const onWindowPointerUp = () => {
      if (document.activeElement === ta) {
        scheduleCheck(20);
      }
    };
    window.addEventListener("pointerup", onWindowPointerUp);

    const onSelectionChange = () => {
      if (document.activeElement === ta) {
        scheduleCheck(30);
      }
    };
    document.addEventListener("selectionchange", onSelectionChange);
  }

  // ─── Translation API ──────────────────────────────────────────────────────────

  async _callTranslate(text) {
    if (!this.transEnabled || !text || !text.trim()) return null;
    const trimmed = text.trim();
    const cacheKey = `${this.transEngine}:${this.srcLang}:${this.tgtLang}:${trimmed}`;
    if (this._clientTransCache.has(cacheKey)) {
      return this._clientTransCache.get(cacheKey);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    try {
      const r = await fetch("/trix_prompt/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          text: trimmed,
          engine: this.transEngine,
          src_lang: this.srcLang,
          tgt_lang: this.tgtLang,
          offline_model: this.offlineModel,
        })
      });
      clearTimeout(timeoutId);
      const d = await r.json();
      if (d.status === "success" && d.translated_text) {
        this._clientTransCache.set(cacheKey, d.translated_text);
        return d.translated_text;
      }
    } catch (err) {
      clearTimeout(timeoutId);
      return null;
    }
  }

  // ─── Row creation ─────────────────────────────────────────────────────────────

  addRow(text = "", enabled = true, shrunkH = null) {
    const id = ++this._rowId;
    const row = document.createElement("div");
    row.className = "trix-ps-row" + (enabled ? "" : " is-disabled");
    row.dataset.id = String(id);
    row.dataset.enabled = enabled ? "true" : "false";
    row.draggable = false;

    row.innerHTML = `
      <div class="trix-ps-row-sidebar">
        <span class="trix-ps-handle" draggable="true" title="Drag to reorder">⠿</span>
        <div class="trix-ps-vpill ${enabled ? 'on' : ''}" title="Toggle ON/OFF">
          ${enabled ? '<span>O</span><span>N</span>' : '<span>O</span><span>F</span><span>F</span>'}
        </div>
      </div>
      <div class="trix-ps-row-body">
        <button class="trix-ps-delete" title="Delete row">✕</button>
        <div class="trix-ps-ta-wrapper">
          <div class="trix-ps-ta-backdrop"></div>
          <textarea class="trix-ps-textarea" placeholder="type your prompt, use @ for tags, * for group tags.">${text}</textarea>
        </div>
      </div>
    `;

    const handle   = row.querySelector(".trix-ps-handle");
    const vpill    = row.querySelector(".trix-ps-vpill");
    const ta       = row.querySelector(".trix-ps-textarea");
    const backdrop = row.querySelector(".trix-ps-ta-backdrop");
    const del      = row.querySelector(".trix-ps-delete");

    // --- Toggle ON/OFF ---
    vpill.addEventListener("click", () => {
      const isOn = vpill.classList.contains("on");
      vpill.classList.toggle("on", !isOn);
      vpill.innerHTML = isOn
        ? "<span>O</span><span>F</span><span>F</span>"
        : "<span>O</span><span>N</span>";
      row.classList.toggle("is-disabled", isOn);
      row.dataset.enabled = isOn ? "false" : "true";
      this._notify();
    });

    // --- Textarea: auto-grow + backdrop highlight ---
    let _isProgrammatic = false;
    const updateRow = (reason) => {
      this._renderBackdrop(ta, backdrop);
      _isProgrammatic = true;

      // 1. Measure natural text height
      ta.style.height = "auto";
      const textH = Math.max(62, ta.scrollHeight);
      
      const shrunkH = ta.dataset.userShrunk ? parseInt(ta.dataset.userShrunk, 10) : null;

      if (shrunkH !== null) {
        if (reason === "input" && textH <= shrunkH) {
          // Text has shrunk enough to fit inside the previously shrunk window.
          // Exit shrunk mode, return to auto-fitting.
          delete ta.dataset.userShrunk;
          ta.style.height = textH + "px";
        } else {
          // Text still overflows the shrunk height. Keep it locked to shrunk height.
          ta.style.height = shrunkH + "px";
        }
      } else {
        // Normal mode: auto-fit to exactly match text height (both grow and shrink!)
        ta.style.height = textH + "px";
      }

      requestAnimationFrame(() => { _isProgrammatic = false; });
      this._notify();
      if (this.onGrowNeeded) this.onGrowNeeded("change");
    };

    // --- Manual Drag Detection ---
    let _isDragging = false;
    
    ta.addEventListener("mousedown", (e) => {
      const rect = ta.getBoundingClientRect();
      // Resize handle is usually in the bottom right corner (~16x16 px)
      if (e.clientX > rect.right - 20 && e.clientY > rect.bottom - 20) {
        _isDragging = true;
      }
    });

    const onMouseUp = () => {
      if (_isDragging) {
        _isDragging = false;
        // User finished drag. Check if they shrunk it below text height.
        if (ta.scrollHeight > ta.clientHeight + 4) {
          ta.dataset.userShrunk = Math.round(ta.clientHeight);
        } else {
          delete ta.dataset.userShrunk;
        }
        updateRow("drag"); // Enforce the new rules
      }
    };
    window.addEventListener("mouseup", onMouseUp);

    // Clean up memory
    const removeRow = () => {
      window.removeEventListener("mouseup", onMouseUp);
      row.remove();
    };

    // --- Delete ---
    del.addEventListener("click", () => {
      if (this.stackEl.querySelectorAll(".trix-ps-row").length <= 1) return;
      removeRow();
      this._notify();
      if (this.onGrowNeeded) this.onGrowNeeded("delete");
    });


    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => {
        if (_isProgrammatic) return; // ignore our own height updates
        if (_isDragging) return;     // ignore during manual dragging
        
        // Node resized, or initial layout render completed!
        // Re-evaluate text height and auto-fit to the new layout width.
        updateRow("resize");
      });
      ro.observe(ta);
    }

    // --- LIVE translate on input ---
    ta.addEventListener("input", () => {
      updateRow("input");
      if (!this.transEnabled || this.transMode !== "live") return;

      clearTimeout(this._livePopupTimer);
      const val = ta.value.trim();
      if (!val) { this._hideLivePopup(); return; }

      this._livePopupTimer = setTimeout(async () => {
        if (this._livePopupTranslating) return;
        this._livePopupTranslating = true;
        try {
          const translated = await this._callTranslate(val);
          if (translated && ta.value.trim()) {
            this._showLivePopup(ta, translated);
          }
        } catch (_) {}
        this._livePopupTranslating = false;
      }, 350);
    });

    // --- Hide live popup when textarea loses focus (no longer typing) ---
    ta.addEventListener("blur", () => {
      clearTimeout(this._livePopupTimer);
      // Small delay so popup click can fire before hiding
      setTimeout(() => {
        if (this._livePopupTA === ta) this._hideLivePopup();
      }, 200);
    });

    // --- Show live popup again on focus if text exists ---
    ta.addEventListener("focus", () => {
      if (!this.transEnabled || this.transMode !== "live") return;
      const val = ta.value.trim();
      if (!val) return;
      clearTimeout(this._livePopupTimer);
      this._livePopupTimer = setTimeout(async () => {
        const translated = await this._callTranslate(val).catch(() => null);
        if (translated && document.activeElement === ta && ta.value.trim()) {
          this._showLivePopup(ta, translated);
        }
      }, 350);
    });

    ta.addEventListener("scroll", () => this._syncBackdrop(ta, backdrop));

    // Attach selection translation & live translation helpers
    this.attachTranslationToTextarea(ta);

    if (this.autocomplete) this.autocomplete.attach(ta, () => updateRow());

    // --- Drag and drop (handle only) ---
    handle.addEventListener("dragstart", (e) => {
      this.draggedRow = row;
      e.dataTransfer.effectAllowed = "move";
      row.classList.add("is-dragging");
    });
    handle.addEventListener("dragend", () => {
      if (this.draggedRow) this.draggedRow.classList.remove("is-dragging");
      this.draggedRow = null;
      this.stackEl.querySelectorAll(".trix-ps-row").forEach(r => {
        r.classList.remove("is-drop-target-above", "is-drop-target-below");
      });
      this._notify();
    });
    row.addEventListener("dragover", (e) => {
      if (!this.draggedRow || this.draggedRow === row) return;
      e.preventDefault();
      const rect = row.getBoundingClientRect();
      const above = (e.clientY - rect.top) < rect.height / 2;
      this.stackEl.querySelectorAll(".trix-ps-row").forEach(r => {
        r.classList.remove("is-drop-target-above", "is-drop-target-below");
      });
      row.classList.add(above ? "is-drop-target-above" : "is-drop-target-below");
    });
    row.addEventListener("drop", (e) => {
      if (!this.draggedRow || this.draggedRow === row) return;
      e.preventDefault();
      const rect = row.getBoundingClientRect();
      const above = (e.clientY - rect.top) < rect.height / 2;
      if (above) {
        this.stackEl.insertBefore(this.draggedRow, row);
      } else {
        this.stackEl.insertBefore(this.draggedRow, row.nextSibling);
      }
      row.classList.remove("is-drop-target-above", "is-drop-target-below");
    });

    this.stackEl.appendChild(row);
    this._renderBackdrop(ta, backdrop);

    // Apply saved height if provided (restoring from workflow state)
    if (shrunkH !== null && shrunkH > 0) {
      ta.dataset.userShrunk = shrunkH;
      ta.style.height = shrunkH + "px";
      requestAnimationFrame(() => {
        ta.style.height = shrunkH + "px";
      });
    } else {
      ta.style.height = "auto";
      ta.style.height = Math.max(62, ta.scrollHeight) + "px";
    }

    this._notify();
    if (this.onGrowNeeded) this.onGrowNeeded("delete");
  }

  // ─── Backdrop rendering ───────────────────────────────────────────────────────

  _renderBackdrop(ta, backdrop) {
    const text = ta.value;
    const escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const highlighted = escaped.replace(/@[a-zA-Z0-9_-]+/g, (m) => {
      const hasStyle = this.styleTagMap.has(m);
      if (hasStyle) {
        return `<mark class="trix-tag-hl" style="color:var(--trix-prompt-accent,#ff5500); filter:brightness(1.25); background:color-mix(in srgb, var(--trix-prompt-accent) 25%, transparent); border-radius:2px;">${m}</mark>`;
      }
      return m;
    }).replace(/\*[a-zA-Z0-9_-]+/g, (m) => {
      const catName = m.substring(1).toLowerCase();
      const normCat = catName.replace(/[^a-z0-9]+/g, "_");
      if (this.categorySet && (this.categorySet.has(catName) || this.categorySet.has(normCat))) {
        return `<mark class="trix-tag-hl" style="color:#DD7055; background:color-mix(in srgb, #DD7055 25%, transparent); border-radius:2px;">${m}</mark>`;
      }
      return m;
    });
    backdrop.innerHTML = highlighted + "\n";
    this._syncBackdrop(ta, backdrop);
  }

  _syncBackdrop(ta, backdrop) {
    backdrop.scrollTop = ta.scrollTop;
    backdrop.scrollLeft = ta.scrollLeft;
  }

  // ─── Text getters ─────────────────────────────────────────────────────────────

  expandTags(text) {
    return text.replace(/@[a-zA-Z0-9_-]+/g, (tag) => {
      const style = this.styleTagMap.get(tag);
      return style ? (style.positive || style.prompt || tag) : tag;
    });
  }

  loadState(state) {
    if (!state || !state.rows || !Array.isArray(state.rows)) return;
    this.stackEl.innerHTML = "";
    state.rows.forEach(r => {
      let shrunkH = null;
      if (r.shrunkHeight !== undefined && r.shrunkHeight !== null) {
        shrunkH = parseInt(r.shrunkHeight, 10);
      } else if (r.shrunk === "true" || r.shrunk === true) {
        shrunkH = parseInt(r.height, 10);
      }
      this.addRow(r.text, r.enabled, shrunkH);
    });
    if (this.stackEl.querySelectorAll(".trix-ps-row").length === 0) this.addRow("");
    if (this.onGrowNeeded) this.onGrowNeeded();
  }

  getState() {
    const rows = [];
    this.stackEl.querySelectorAll(".trix-ps-row").forEach(row => {
      const ta = row.querySelector(".trix-ps-textarea");
      rows.push({
        id: row.dataset.id,
        enabled: row.dataset.enabled === "true",
        text: ta?.value || "",
        shrunkHeight: ta?.dataset.userShrunk ? parseInt(ta.dataset.userShrunk, 10) : null
      });
    });
    return { rows };
  }

  expandTagsHTML(text) {
    return text.replace(/@[a-zA-Z0-9_-]+/g, (tag) => {
      const style = this.styleTagMap.get(tag);
      if (style) {
        const textVal = style.positive || style.prompt || tag;
        return `<b class="trix-expanded-tag" data-tag="${tag}" contenteditable="false" style="color:var(--trix-prompt-accent,#ff5500); filter:brightness(1.25); font-weight:700;">${textVal}</b>`;
      }
      return tag;
    }).replace(/\*[a-zA-Z0-9_-]+/g, (tag) => {
      const catName = tag.substring(1).toLowerCase();
      const normCat = catName.replace(/[^a-z0-9]+/g, "_");
      if (this.categorySet && (this.categorySet.has(catName) || this.categorySet.has(normCat))) {
        return `<b class="trix-expanded-category" data-cat="${tag}" contenteditable="false" style="color:#DD7055; font-weight:700;">${tag}</b>`;
      }
      return tag;
    });
  }

  setSeparators(hasComma, hasPeriod, hasSpace, hasNewline) {
    this.sepComma = hasComma !== false;
    this.sepPeriod = hasPeriod === true;
    this.sepSpace = hasSpace !== false;
    this.sepNewline = hasNewline === true;
  }

  _joinCompiledRows(rows) {
    let punc = "";
    if (this.sepComma && this.sepPeriod) punc = ";";
    else if (this.sepComma) punc = ",";
    else if (this.sepPeriod) punc = ".";
    
    let result = "";
    for (let i = 0; i < rows.length; i++) {
      let text = rows[i].trim();
      if (!text) continue;
      
      if (result !== "") {
        let addPunc = punc;
        // Check if the previous text already ends with punctuation (ignoring HTML tags and spaces)
        let strippedResult = result.replace(/<[^>]+>/g, "").replace(/[\s\n]+$/, "");
        if (strippedResult.endsWith(",") || strippedResult.endsWith(".") || strippedResult.endsWith(";")) {
          addPunc = ""; // Avoid double punctuation
        }
        
        result += addPunc;
        if (this.sepNewline) result += "\n";
        if (this.sepSpace) result += " ";
        result += text;
      } else {
        result = text;
      }
    }
    return result;
  }

  getCompiledPositiveHTML() {
    const state = this.getState();
    const rows = state.rows
      .filter(r => r.enabled && r.text.trim())
      .map(r => this.expandTagsHTML(r.text.trim()));
    return this._joinCompiledRows(rows);
  }

  getCompiledPositive() {
    const state = this.getState();
    const rows = state.rows
      .filter(r => r.enabled && r.text.trim())
      .map(r => this.expandTags(r.text.trim()));
    return this._joinCompiledRows(rows);
  }

  insertTag(tagText) {
    const last = this.stackEl.querySelector(".trix-ps-row:last-child .trix-ps-textarea");
    if (last) {
      last.value += (last.value ? ", " : "") + tagText;
      last.dispatchEvent(new Event("input"));
    } else {
      this.addRow(tagText);
    }
  }

  _notify() {
    if (this.onStateChange) this.onStateChange(this.getState());
  }
}
