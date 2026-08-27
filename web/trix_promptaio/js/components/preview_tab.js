/**
 * PreviewTab — dual editable preview for Positive and Negative prompts.
 * Supports HTML preview rendering so expanded @tag text appears in BOLD.
 */
export class PreviewTab {
  constructor(containerEl, onPositiveChange, onNegativeChange) {
    this.container = containerEl;
    this.onPositiveChange = onPositiveChange;
    this.onNegativeChange = onNegativeChange;
    this._sourcePositive = "";
    this.init();
  }

  init() {
    this.posEl = this.container.querySelector(".trix-ps-pos-preview");
    this.negEl = this.container.querySelector(".trix-ps-neg-preview");

    if (this.posEl) {
      this.posEl.addEventListener("input", () => {
        let textVal = "";
        if (this.posEl.tagName === "TEXTAREA") {
          textVal = this.posEl.value;
        } else {
          for (const node of this.posEl.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) {
              textVal += node.textContent;
            } else if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.hasAttribute("data-tag")) {
                textVal += node.getAttribute("data-tag");
              } else if (node.hasAttribute("data-cat")) {
                textVal += node.getAttribute("data-cat");
              } else {
                textVal += node.innerText || node.textContent;
              }
            }
          }
        }
        if (this.onPositiveChange) this.onPositiveChange(textVal);
      });
    }

    if (this.negEl) {
      this.negEl.addEventListener("input", () => {
        const textVal = this.negEl.tagName === "TEXTAREA" ? this.negEl.value : (this.negEl.innerText || this.negEl.textContent || "");
        if (this.onNegativeChange) this.onNegativeChange(textVal);
      });
    }
  }

  setPositive(textOrHTML) {
    this._sourcePositive = textOrHTML;
    if (this.posEl && document.activeElement !== this.posEl) {
      if (this.posEl.tagName === "TEXTAREA") {
        // Strip HTML tags for textarea fallback if needed
        const tmp = document.createElement("div");
        tmp.innerHTML = textOrHTML;
        this.posEl.value = tmp.textContent || tmp.innerText || textOrHTML;
      } else {
        this.posEl.innerHTML = textOrHTML;
      }
    }
  }

  setNegative(text) {
    if (this.negEl && document.activeElement !== this.negEl) {
      if (this.negEl.tagName === "TEXTAREA") {
        this.negEl.value = text;
      } else {
        this.negEl.textContent = text;
      }
    }
  }
}
