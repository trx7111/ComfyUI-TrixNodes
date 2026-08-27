/**
 * TabManager component for switching between Prompts, Negatives, Styles, and Translation tabs.
 */
export class TabManager {
  constructor(containerEl) {
    this.container = containerEl;
    this.init();
  }

  init() {
    const tabs = this.container.querySelectorAll(".trix-tab-btn");
    const panels = this.container.querySelectorAll(".trix-panel");

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const targetTab = tab.getAttribute("data-tab");

        tabs.forEach((t) => t.classList.remove("active"));
        panels.forEach((p) => p.classList.remove("active"));

        tab.classList.add("active");
        const activePanel = this.container.querySelector(`.trix-panel[data-panel="${targetTab}"]`);
        if (activePanel) {
          activePanel.classList.add("active");
        }
      });
    });
  }
}
