"""
ND Super LoRA Loader Node - Main implementation
Clean, robust multi-LoRA loader built to Pixaroma / ComfyUI parity standard.
Supports optional per-LoRA optimizations:
 1. SmoothStep (Weight contrast & noise suppression)
 2. DARE Sparsification (Anti-overcooking & stacking conflict resolution)
 3. Block Target Filter (Layer specialization)

Runs 100% at load time with zero sampler overhead and maximum native GPU speed.
When optimizations are disabled, execution is 100% pure standard ComfyUI load_lora_for_models.
"""

import os
import json
from typing import Union, Dict, Any, Tuple, List, Optional
import torch

try:
    import folder_paths
    import comfy.sd
    import comfy.utils
    COMFYUI_AVAILABLE = True
except ImportError:
    print("Super LoRA Loader: ComfyUI modules not available (normal during offline testing)")
    folder_paths = None
    COMFYUI_AVAILABLE = False

try:
    from .lora_utils import resolve_lora_full_path, get_lora_by_filename
except ImportError:
    import sys
    sys.path.append(os.path.dirname(__file__))
    from lora_utils import resolve_lora_full_path, get_lora_by_filename


def parse_strength(entry: Dict[str, Any], key_primary: str, key_fallback: str, default_val: float = 1.0) -> float:
    """
    Safely parses floating point strength values from dictionary.
    Handles None, null, invalid types, and fallbacks cleanly.
    """
    for k in (key_primary, key_fallback):
        v = entry.get(k)
        if v is not None:
            try:
                return float(v)
            except (ValueError, TypeError):
                pass
    return float(default_val)


def apply_smooth_step(sd: Dict[str, Any], factor: float = 0.8) -> Dict[str, Any]:
    """
    Applies Hermite smoothstep normalization (3x^2 - 2x^3) to LoRA weights.
    Enhances salient learned concepts above the mean while reducing background noise.
    """
    if factor <= 0.0:
        return sd
    factor = min(1.0, max(0.0, factor))
    new_sd = {}
    for k, v in sd.items():
        if isinstance(v, torch.Tensor) and v.is_floating_point():
            v_min = v.min()
            v_max = v.max()
            rng = v_max - v_min
            if rng.abs() > 1e-7:
                norm = (v - v_min) / (rng + 1e-7)
                poly = 3.0 * (norm ** 2) - 2.0 * (norm ** 3)
                adj = v_min + poly * rng
                new_sd[k] = v * (1.0 - factor) + adj * factor
            else:
                new_sd[k] = v.clone()
        else:
            new_sd[k] = v
    return new_sd


def apply_dare_sparsification(sd: Dict[str, Any], density: float = 0.75) -> Dict[str, Any]:
    """
    Applies DARE random sparsification with unbiased 1/density magnitude rescaling.
    Prunes low-impact noisy weights, preventing overcooked stacking artifacts.
    """
    if density >= 1.0 or density <= 0.0:
        return sd
    density = max(0.1, min(1.0, density))
    new_sd = {}
    for k, v in sd.items():
        if isinstance(v, torch.Tensor) and v.is_floating_point():
            mask = (torch.rand_like(v) < density).to(dtype=v.dtype)
            new_sd[k] = (v * mask) / density
        else:
            new_sd[k] = v
    return new_sd


def get_lora_block_info(key: str) -> Tuple[str, int]:
    """
    Classifies a LoRA state dict key into standard architecture categories and block index.
    Supports: SD 1.5, SD 2.1, SDXL, Flux.1, Flux.2/Klein, SD3/3.5, Wan 2.1, Hunyuan, PixArt, Chroma.
    """
    import re
    k = key.lower()
    
    # 1. Text Encoders (CLIP, T5, OpenCLIP, TE1, TE2)
    if any(t in k for t in ["lora_te", "text_model", "text_encoder", "clip", "conditioner", "t5"]):
        return ("clip", 0)
        
    # 2. U-Net Input / Down Blocks (SD 1.5, SDXL, Kohya, Diffusers, LyCORIS)
    m_in = re.search(r"(?:input_blocks|down_blocks|lora_unet_down_blocks|lora_unet_input_blocks|in_layers)[._](\d+)", k)
    if m_in:
        return ("unet_in", int(m_in.group(1)))
    if any(p in k for p in ["input_blocks", "down_blocks", "lora_unet_down_blocks", "lora_unet_input_blocks", "in_layers"]):
        return ("unet_in", 0)
        
    # 3. U-Net Middle / Bottleneck Block (Deepest spatial geometry, composition, pose)
    if any(p in k for p in ["middle_block", "mid_block", "lora_unet_mid_block", "lora_unet_middle_block"]):
        return ("unet_mid", 0)
        
    # 4. U-Net Output / Up Blocks (Reconstruction, high-frequency details, faces, textures)
    m_out = re.search(r"(?:output_blocks|up_blocks|lora_unet_up_blocks|lora_unet_output_blocks|out_layers)[._](\d+)", k)
    if m_out:
        return ("unet_out", int(m_out.group(1)))
    if any(p in k for p in ["output_blocks", "up_blocks", "lora_unet_up_blocks", "lora_unet_output_blocks", "out_layers"]):
        return ("unet_out", 0)

    # 5. Flux / MMDiT Double Stream Blocks (Joint text-image attention)
    m_dbl = re.search(r"(?:double_blocks|transformer_blocks)[._](\d+)", k)
    if m_dbl:
        return ("dit_double", int(m_dbl.group(1)))
        
    # 6. Flux / MMDiT Single Stream Blocks (Combined image feature refinement)
    m_sgl = re.search(r"(?:single_blocks|single_transformer_blocks)[._](\d+)", k)
    if m_sgl:
        return ("dit_single", int(m_sgl.group(1)))

    # 7. SD3 / SD3.5 Joint Transformer Blocks
    m_joint = re.search(r"joint_blocks[._](\d+)", k)
    if m_joint:
        return ("dit_joint", int(m_joint.group(1)))

    # 8. Generic DiT Blocks (Wan 2.1, Hunyuan, PixArt, Chroma)
    m_blk = re.search(r"(?:blocks|layers)[._](\d+)", k)
    if m_blk:
        return ("dit_block", int(m_blk.group(1)))

    # 9. DiT Projections
    if any(p in k for p in ["img_in", "txt_in", "time_in", "vector_in", "x_embedder", "t_embedder"]):
        return ("dit_proj_in", 0)
    if any(p in k for p in ["final_layer", "out_layer", "head", "norm_out"]):
        return ("dit_proj_out", 0)

    return ("other", 0)


def filter_lora_blocks(sd: Dict[str, Any], block_filter: str = "all") -> Dict[str, Any]:
    """
    Filters LoRA weights to target specific network components.
    Supported modes:
      - 'all': Complete LoRA (all layers).
      - 'structure': Structure & Anatomy (Pose, composition, layout, global geometry).
      - 'details': Details & Textures (Skin, textures, face micro-details, lighting, surface finish).
      - 'unet_only': Visual UNet/DiT blocks only (zero CLIP impact).
      - 'clip_only': Text encoder / prompt comprehension only (zero visual layer changes).
    """
    if not block_filter or block_filter == "all":
        return sd

    # Dynamic inspection of layer boundaries in the current LoRA
    max_dbl, max_sgl, max_joint, max_blk = -1, -1, -1, -1
    parsed = {}
    for k in sd.keys():
        b_type, idx = get_lora_block_info(k)
        parsed[k] = (b_type, idx)
        if b_type == "dit_double": max_dbl = max(max_dbl, idx)
        elif b_type == "dit_single": max_sgl = max(max_sgl, idx)
        elif b_type == "dit_joint": max_joint = max(max_joint, idx)
        elif b_type == "dit_block": max_blk = max(max_blk, idx)

    new_sd = {}
    for k, v in sd.items():
        b_type, idx = parsed[k]

        if block_filter == "unet_only":
            if b_type == "clip":
                continue
        elif block_filter == "clip_only":
            if b_type != "clip":
                continue
        elif block_filter == "structure":
            # Structure & Anatomy: Keep Input + Middle + Early DiT + CLIP.
            # Drop Output blocks (high frequency upsampling) and Late DiT blocks.
            if b_type == "unet_out":
                continue
            if b_type == "dit_double" and max_dbl >= 0 and idx > int(max_dbl * 0.55):
                continue
            if b_type == "dit_single" and max_sgl >= 0 and idx > int(max_sgl * 0.35):
                continue
            if b_type == "dit_joint" and max_joint >= 0 and idx > int(max_joint * 0.50):
                continue
            if b_type == "dit_block" and max_blk >= 0 and idx > int(max_blk * 0.50):
                continue
            if b_type == "dit_proj_out":
                continue
        elif block_filter == "details":
            # Details & Textures: Keep Output blocks + Late DiT + Single blocks + CLIP.
            # Drop Input/Down blocks and Middle/Bottleneck blocks.
            if b_type in ("unet_in", "unet_mid"):
                continue
            if b_type == "dit_double" and max_dbl >= 0 and idx < int(max_dbl * 0.50):
                continue
            if b_type == "dit_joint" and max_joint >= 0 and idx < int(max_joint * 0.50):
                continue
            if b_type == "dit_block" and max_blk >= 0 and idx < int(max_blk * 0.50):
                continue
            if b_type == "dit_proj_in":
                continue

        new_sd[k] = v

    return new_sd


class NdSuperLoraLoader:
    """
    ND Super LoRA Loader - High performance, exact-weight multi-LoRA loader for ComfyUI.
    """
    
    CATEGORY = "loaders"
    RETURN_TYPES = ("MODEL", "CLIP", "STRING")
    RETURN_NAMES = ("MODEL", "CLIP", "TRIGGER_WORDS")
    FUNCTION = "load_loras"
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "model": ("MODEL", {"tooltip": "The diffusion model every switched-on LoRA is applied to."}),
            },
            "optional": {
                "clip": ("CLIP", {"tooltip": "The text encoder (CLIP) the LoRAs are applied to."}),
                "lora_bundle": ("STRING", {"default": "[]"}),
            },
            "hidden": {}
        }
    
    def __init__(self):
        # path -> (lora_state_dict, lora_metadata)
        # Supported cacheMode:
        #   "last" (default) = ComfyUI parity, retain only the most recently used file
        #   "all"  = keep all loaded LoRA files in RAM for instant re-runs
        #   "none" = release memory immediately after execution
        self._cache: Dict[str, Tuple[Any, Optional[Dict[str, Any]]]] = {}
        self._last_path: Optional[str] = None

    def _get_lora(self, path: str) -> Tuple[Any, Optional[Dict[str, Any]]]:
        cached = self._cache.get(path)
        if cached is not None:
            return cached
        try:
            lora, meta = comfy.utils.load_torch_file(path, safe_load=True, return_metadata=True)
        except TypeError:
            lora, meta = comfy.utils.load_torch_file(path, safe_load=True), None
        self._cache[path] = (lora, meta)
        return (lora, meta)

    def load_loras(self, model, clip=None, lora_bundle: Union[str, None] = None, **kwargs) -> Tuple[Any, Any, str]:
        if not COMFYUI_AVAILABLE:
            print("Super LoRA Loader: ComfyUI not available, returning unchanged")
            return (model, clip, "")

        if model is None:
            print("Super LoRA Loader: No model provided, returning unchanged")
            return (None, clip, "")

        lora_configs: List[Dict[str, Any]] = []
        cache_mode: str = "last"
        separator: str = ", "

        if isinstance(lora_bundle, str) and lora_bundle.strip():
            try:
                parsed = json.loads(lora_bundle)
                if isinstance(parsed, list):
                    lora_configs = parsed
                elif isinstance(parsed, dict):
                    lora_configs = parsed.get("loras", [])
                    cache_mode = str(parsed.get("cacheMode", "last"))
                    separator = str(parsed.get("separator", ", "))
            except json.JSONDecodeError as e:
                print(f"Super LoRA Loader: Failed to parse lora_bundle JSON: {e}")
        elif isinstance(lora_bundle, list):
            lora_configs = lora_bundle
        elif isinstance(lora_bundle, dict):
            lora_configs = lora_bundle.get("loras", [])
            cache_mode = str(lora_bundle.get("cacheMode", "last"))
            separator = str(lora_bundle.get("separator", ", "))
        else:
            for key, val in kwargs.items():
                if key.lower().startswith("lora_") and isinstance(val, dict):
                    lora_configs.append(val)

        last_this_run = None
        used_paths = set()
        trigger_words: List[str] = []
        applied_count = 0

        current_model = model
        current_clip = clip

        for entry in lora_configs:
            if not isinstance(entry, dict):
                continue

            enabled = bool(entry.get("enabled", entry.get("on", False)))
            if not enabled:
                continue

            lora_name = (entry.get("lora") or entry.get("name") or "").strip()
            if not lora_name or lora_name == "None":
                continue

            path = resolve_lora_full_path(lora_name)
            if not path and folder_paths is not None:
                try:
                    path = folder_paths.get_full_path("loras", lora_name)
                except Exception:
                    path = None
            if not path or not os.path.isfile(path):
                print(f"Super LoRA Loader: skipped (file not found): '{lora_name}'")
                continue

            # Safe numeric strength parsing
            sm = parse_strength(entry, "strength", "sm", 1.0)
            sc = parse_strength(entry, "strengthClip", "sc", sm)
            if current_clip is None:
                sc = 0.0

            tw = (entry.get("triggerWords") or entry.get("triggerWord") or entry.get("tw") or "").strip()
            if tw:
                trigger_words.append(tw)

            if sm == 0.0 and sc == 0.0:
                used_paths.add(path)
                continue

            # Load LoRA state dict
            try:
                lora_data, meta = self._get_lora(path)

                # Check for advanced optimization settings
                adv = entry.get("adv_settings") or entry.get("advSettings") or {}
                smooth_step_opt = adv.get("smoothStep", {}) if isinstance(adv, dict) else {}
                dare_opt = adv.get("dare", {}) if isinstance(adv, dict) else {}
                block_filter_opt = adv.get("blockFilter", "all") if isinstance(adv, dict) else "all"

                is_smooth_active = isinstance(smooth_step_opt, dict) and bool(smooth_step_opt.get("enabled"))
                is_dare_active = isinstance(dare_opt, dict) and bool(dare_opt.get("enabled"))
                is_filter_active = bool(block_filter_opt and block_filter_opt != "all")
                has_custom_adv = is_smooth_active or is_dare_active or is_filter_active

                desc_parts = []

                if has_custom_adv:
                    # Work on a fresh copy so pristine cache in RAM is never altered
                    processed_lora = dict(lora_data)

                    if is_smooth_active:
                        intensity = float(smooth_step_opt.get("intensity", 0.8))
                        processed_lora = apply_smooth_step(processed_lora, intensity)
                        desc_parts.append(f"SmoothStep({intensity:.2f})")

                    if is_dare_active:
                        density = float(dare_opt.get("density", 0.75))
                        processed_lora = apply_dare_sparsification(processed_lora, density)
                        desc_parts.append(f"DARE({density:.2f})")

                    if is_filter_active:
                        orig_len = len(processed_lora)
                        processed_lora = filter_lora_blocks(processed_lora, block_filter_opt)
                        desc_parts.append(f"Filter({block_filter_opt}: {len(processed_lora)}/{orig_len} keys)")
                else:
                    # Pure standard LoRA directly from cache (100% Pixaroma / ComfyUI parity)
                    processed_lora = lora_data

                # 100% Standard ComfyUI loader
                try:
                    current_model, current_clip = comfy.sd.load_lora_for_models(
                        current_model, current_clip, processed_lora, sm, sc, lora_metadata=meta
                    )
                except TypeError:
                    current_model, current_clip = comfy.sd.load_lora_for_models(
                        current_model, current_clip, processed_lora, sm, sc
                    )

                used_paths.add(path)
                applied_count += 1
                if cache_mode != "all":
                    if last_this_run is not None and last_this_run != path:
                        self._cache.pop(last_this_run, None)
                    last_this_run = path

                adv_desc = f" [{', '.join(desc_parts)}]" if has_custom_adv else ""
                print(f"Super LoRA Loader: Applied '{lora_name}' (model={sm}, clip={sc}){adv_desc}")

            except Exception as exc:
                print(f"Super LoRA Loader: Failed to apply '{lora_name}': {exc}")

        # Memory pruning based on cacheMode
        if cache_mode == "none":
            self._cache.clear()
            self._last_path = None
        elif cache_mode == "all":
            for p in list(self._cache):
                if p not in used_paths:
                    del self._cache[p]
        else:  # "last" - keep at most 1 most recently loaded entry
            keep = last_this_run
            if keep is None and self._last_path in used_paths:
                keep = self._last_path
            for p in list(self._cache):
                if p != keep:
                    del self._cache[p]
            self._last_path = keep

        combined_triggers = separator.join(trigger_words) if trigger_words else ""
        print(f"Super LoRA Loader: Successfully applied {applied_count} LoRA(s).")
        return (current_model, current_clip, combined_triggers)
