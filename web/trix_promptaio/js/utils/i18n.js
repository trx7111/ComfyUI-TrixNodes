const translations = {
  en: {
    "settings_title": "⚙︎ Settings",
    "accent_color": "✿ Accent Color",
    "group_mode": "🗁 Group Styles Mode",
    "mode_fixed": "🖈 Fixed",
    "mode_increment": "» Increment",
    "view_mode": "ᨒ Style View Mode",
    "view_grid": "⊞ Grid",
    "view_compact": "𝄜 Compact",
    "view_list": "☰ List",
    "translation": "🌏︎ Translation",
    "trans_mode": "Mode",
    "trans_engine": "Engine",
    "trans_live": "⚡︎ Live",
    "trans_button": "▧ Selection",
    "trans_output": "⌛︎ On Run",
    "trans_source": "Source",
    "trans_target": "Target",
    "trans_auto": "Auto",
    "trans_offline_model": "◌ Model",
    "reset_defaults": "↻ Reset to Defaults",
    
    "prompt_placeholder": "type your prompt, use @ for tags, * for group tags",
    "tooltip_drag": "Drag to reorder",
    "tooltip_delete": "Delete row",
    "tooltip_toggle": "Toggle ON/OFF",
    
    "search_styles": "Search styles...",
    "cat_all": "All",
    "cat_favorite": "♡ favorite",
    "cat_custom": "Custom",
    "no_styles": "No styles found.",
    "tooltip_copy": "Click to copy prompt: ",
    "copied": "Copied!",
    "pos_prompt": "Positive",
    "neg_prompt": "Negative",
    
    "add_style": "Add Style",
    "drop_image": "Drop image here",
    "style_name": "Style Name:",
    "style_tags": "Tags (comma separated):",
    "style_pos": "Positive Prompt:",
    "style_neg": "Negative Prompt:",
    "save_pack": "Save Pack",
    "btn_cancel": "Cancel",
    "delete_pack": "Delete Pack",
    "delete_pack_msg": "What to do with styles in this pack?",
    "move_to_custom": "Move styles to Custom",
    "delete_all": "Delete ALL styles",
    "pack_name": "Pack Name:",
    "add_pack": "Add Pack",
    "rename_pack": "Rename Pack",
    "create_style": "Create Style",
    "manage_packs": "Manage Packs"
  },
  ru: {}
};
translations.ru = translations.en;

let currentLang = "en";

export function initI18n() {
  try {
    const s = JSON.parse(localStorage.getItem("trix_prompt_aio_v2_settings") || "{}");
    if (s.uiLang) {
      currentLang = s.uiLang;
    }
  } catch (e) {}
}

export function setLang(lang) {
  if (translations[lang]) {
    currentLang = lang;
    document.dispatchEvent(new CustomEvent("trix_lang_changed", { detail: { lang } }));
  }
}

export function getLang() {
  return currentLang;
}

export function t(key) {
  const dict = translations[currentLang] || translations["en"];
  return (dict && dict[key]) ? dict[key] : key;
}

initI18n();
