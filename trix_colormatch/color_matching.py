import os
import time
import torch
import torch.nn.functional as F
import numpy as np
from typing import Tuple
import folder_paths
from PIL import Image, ImageOps
try:
    from server import PromptServer
    from aiohttp import web
except ImportError:
    PromptServer = None

def _get_extension_folder() -> str:
    try:
        this_dir = os.path.dirname(os.path.abspath(__file__))
        parent = os.path.dirname(this_dir)
        return os.path.basename(parent)
    except Exception:
        return "comfyui-trixnodes"

# Color matching methods
COLOR_MATCH_METHODS = [
    "LAB", "RGB", "Histogram", 
    "wavelet", "adain", 
    "mkl", "reinhard", "mvgd", "hm", 
    "hm-mvgd-hm", "hm-mkl-hm"
]

# Target channels to apply match to (in Oklab space)
COLOR_MATCH_TARGETS = ["All", "Lightness", "Color"]


# --- Standalone Oklab conversions ---
def rgb_to_oklab(rgb: torch.Tensor) -> torch.Tensor:
    b, h, w, c = rgb.shape
    rgb_flat = rgb.reshape(-1, 3)
    mask = rgb_flat <= 0.04045
    rgb_lin = torch.where(mask, rgb_flat / 12.92, ((rgb_flat + 0.055) / 1.055) ** 2.4)

    M1 = torch.tensor([
        [0.4122214708, 0.5363325363, 0.0514459929],
        [0.2119034982, 0.6806995451, 0.1073969566],
        [0.0883024619, 0.2817188376, 0.6299787005],
    ], device=rgb.device, dtype=rgb.dtype)
    lms = torch.matmul(rgb_lin, M1.T)
    lms_cbrt = torch.sign(lms) * torch.abs(lms) ** (1.0 / 3.0)

    M2 = torch.tensor([
        [0.2104542553, 0.7936177850, -0.0040720468],
        [1.9779984951, -2.4285922050, 0.4505937099],
        [0.0259040371, 0.7827717662, -0.8086757660],
    ], device=rgb.device, dtype=rgb.dtype)
    lab = torch.matmul(lms_cbrt, M2.T)
    return lab.reshape(b, h, w, 3)


def oklab_to_rgb(lab: torch.Tensor) -> torch.Tensor:
    b, h, w, c = lab.shape
    lab_flat = lab.reshape(-1, 3)

    M2_inv = torch.tensor([
        [1.0000000000, 0.3963377774, 0.2158037573],
        [1.0000000000, -0.1055613458, -0.0638541728],
        [1.0000000000, -0.0894841775, -1.2914855480],
    ], device=lab.device, dtype=lab.dtype)
    lms_cbrt = torch.matmul(lab_flat, M2_inv.T)
    lms = torch.sign(lms_cbrt) * torch.abs(lms_cbrt) ** 3

    M1_inv = torch.tensor([
        [4.0767416621, -3.3077115913, 0.2309699292],
        [-1.2684380046, 2.6097574011, -0.3413193965],
        [-0.0041960863, -0.7034186147, 1.7076147010],
    ], device=lab.device, dtype=lab.dtype)
    rgb_lin = torch.matmul(lms, M1_inv.T)

    mask = rgb_lin <= 0.0031308
    rgb = torch.where(mask, rgb_lin * 12.92, 1.055 * torch.clamp(rgb_lin, min=0.0) ** (1.0 / 2.4) - 0.055)
    rgb = rgb.reshape(b, h, w, 3)
    return torch.clamp(rgb, 0.0, 1.0)


# --- Preview Helpers ---
def _downscale_for_preview(img: torch.Tensor, max_dim: int = 512) -> torch.Tensor:
    if max_dim is None or max_dim <= 0:
        return img
    b, h, w, c = img.shape
    if max(h, w) <= max_dim:
        return img
    scale = max_dim / float(max(h, w))
    nh, nw = max(1, int(round(h * scale))), max(1, int(round(w * scale)))
    x = img.permute(0, 3, 1, 2)
    x = F.interpolate(x, size=(nh, nw), mode="bilinear", align_corners=False)
    return x.permute(0, 2, 3, 1)


def _save_web_preview(img: torch.Tensor, web_dir: str, filename: str, max_dim: int = 512) -> None:
    try:
        os.makedirs(web_dir, exist_ok=True)
        try:
            from PIL import Image as _PILImage  # type: ignore
        except Exception:
            return
        img_ds = _downscale_for_preview(img.detach().to("cpu"), max_dim=max_dim)
        b, h, w, c = img_ds.shape
        if b < 1:
            return
        arr = (img_ds[0].clamp(0.0, 1.0).numpy() * 255.0).astype(np.uint8)
        pil = _PILImage.fromarray(arr, mode="RGB")
        out_path = os.path.join(web_dir, filename)
        pil.save(out_path, format="PNG")
    except Exception as e:
        print(f"[TrixColorMatchNode] Preview save failed: {e}")


def _save_mask_preview(mask: torch.Tensor, web_dir: str, filename: str) -> None:
    try:
        os.makedirs(web_dir, exist_ok=True)
        from PIL import Image as _PILImage  # type: ignore
        mask_cpu = mask.detach().to("cpu")
        if len(mask_cpu.shape) == 2:
            mask_cpu = mask_cpu.unsqueeze(0)
        b, h, w = mask_cpu.shape
        if b < 1:
            return
        arr = (mask_cpu[0].clamp(0.0, 1.0).numpy() * 255.0).astype(np.uint8)
        pil = _PILImage.fromarray(arr, mode="L")
        out_path = os.path.join(web_dir, filename)
        pil.save(out_path, format="PNG")
    except Exception as e:
        print(f"[TrixColorMatchNode] Mask preview save failed: {e}")


def _load_mask_image(image_path: str) -> torch.Tensor:
    from PIL import Image as _PILImage  # type: ignore
    with _PILImage.open(image_path) as i:
        i = i.convert("L")
        mask = np.array(i).astype(np.float32) / 255.0
        mask = torch.from_numpy(mask)
    return mask


def _apply_mask_to_preview(image: torch.Tensor, matched: torch.Tensor, mask: torch.Tensor) -> torch.Tensor:
    try:
        if len(mask.shape) == 2:
            mask = mask.unsqueeze(0)
        if mask.shape[0] != image.shape[0]:
            mask = mask.expand(image.shape[0], -1, -1)
        mask = mask.unsqueeze(-1)
        if mask.shape[1:3] != image.shape[1:3]:
            mask_temp = mask.permute(0, 3, 1, 2)
            mask_temp = F.interpolate(mask_temp, size=image.shape[1:3], mode="bilinear", align_corners=False)
            mask = mask_temp.permute(0, 2, 3, 1)
        composite = mask * matched + (1.0 - mask) * image
        return torch.clamp(composite, 0.0, 1.0)
    except Exception as e:
        print(f"[TrixColorMatchNode] Mask preview blending failed: {e}")
        return matched


# --- Color Matching Logic (Standard Methods) ---
def _match_mean_std(src: torch.Tensor, ref: torch.Tensor) -> torch.Tensor:
    dims = (0, 1, 2)
    src_mean = src.mean(dim=dims, keepdim=True)
    src_std = src.std(dim=dims, keepdim=True, unbiased=False)
    ref_mean = ref.mean(dim=dims, keepdim=True)
    ref_std = ref.std(dim=dims, keepdim=True, unbiased=False)
    return (src - src_mean) * (ref_std / (src_std + 1e-6)) + ref_mean


def color_match_lab(image: torch.Tensor, reference: torch.Tensor) -> torch.Tensor:
    src_lab = rgb_to_oklab(image)
    ref_lab = rgb_to_oklab(reference)
    out_lab = _match_mean_std(src_lab, ref_lab)
    return oklab_to_rgb(out_lab)


def color_match_rgb(image: torch.Tensor, reference: torch.Tensor) -> torch.Tensor:
    return torch.clamp(_match_mean_std(image, reference), 0.0, 1.0)


def _hist_match_channel(src_q: np.ndarray, ref_q: np.ndarray) -> np.ndarray:
    s_hist = np.bincount(src_q, minlength=256).astype(np.float64)
    r_hist = np.bincount(ref_q, minlength=256).astype(np.float64)
    s_cdf = np.cumsum(s_hist)
    r_cdf = np.cumsum(r_hist)
    s_cdf /= (s_cdf[-1] + 1e-12)
    r_cdf /= (r_cdf[-1] + 1e-12)
    lut = np.searchsorted(r_cdf, s_cdf, side="left")
    lut = np.clip(lut, 0, 255).astype(np.float64) / 255.0
    return lut[src_q]


def color_match_histogram(image: torch.Tensor, reference: torch.Tensor) -> torch.Tensor:
    dev, dt = image.device, image.dtype
    img = image.detach().cpu().numpy()
    ref = reference.detach().cpu().numpy()
    B, H, W, C = img.shape
    out = np.empty_like(img)
    for c in range(C):
        src_q = np.clip((img[..., c].reshape(-1) * 255.0), 0, 255).astype(np.int64)
        ref_q = np.clip((ref[..., c].reshape(-1) * 255.0), 0, 255).astype(np.int64)
        out[..., c] = _hist_match_channel(src_q, ref_q).reshape(B, H, W)
    return torch.from_numpy(out).to(device=dev, dtype=dt).clamp(0.0, 1.0)


# --- Color Matching Logic (AdaIN Method) ---
def calc_mean_std(feat: torch.Tensor, eps=1e-5):
    size = feat.size()
    assert len(size) == 4, 'The input feature should be 4D tensor.'
    b, c = size[:2]
    feat_var = feat.view(b, c, -1).var(dim=2) + eps
    feat_std = feat_var.sqrt().view(b, c, 1, 1)
    feat_mean = feat.view(b, c, -1).mean(dim=2).view(b, c, 1, 1)
    return feat_mean, feat_std


def adaptive_instance_normalization(content_feat: torch.Tensor, style_feat: torch.Tensor):
    size = content_feat.size()
    style_mean, style_std = calc_mean_std(style_feat)
    content_mean, content_std = calc_mean_std(content_feat)
    normalized_feat = (content_feat - content_mean.expand(size)) / content_std.expand(size)
    return normalized_feat * style_std.expand(size) + style_mean.expand(size)


def color_match_adain(image: torch.Tensor, reference: torch.Tensor) -> torch.Tensor:
    content_feat = image.permute(0, 3, 1, 2)
    style_feat = reference.permute(0, 3, 1, 2)
    
    # If spatial dimensions differ, resize style_feat to match content_feat
    if content_feat.shape[2:] != style_feat.shape[2:]:
        style_feat = F.interpolate(
            style_feat, size=content_feat.shape[2:], mode="bilinear", align_corners=False
        )
        
    out = adaptive_instance_normalization(content_feat, style_feat)
    return out.permute(0, 2, 3, 1).clamp(0.0, 1.0)


# --- Color Matching Logic (Wavelet Method) ---
def wavelet_blur(image: torch.Tensor, radius: int) -> torch.Tensor:
    kernel_vals = [
        [0.0625, 0.125, 0.0625],
        [0.125, 0.25, 0.125],
        [0.0625, 0.125, 0.0625],
    ]
    kernel = torch.tensor(kernel_vals, dtype=image.dtype, device=image.device)
    kernel = kernel[None, None]
    kernel = kernel.repeat(3, 1, 1, 1)
    image_padded = F.pad(image, (radius, radius, radius, radius), mode='replicate')
    output = F.conv2d(image_padded, kernel, groups=3, dilation=radius)
    return output


def wavelet_decomposition(image: torch.Tensor, levels=5) -> Tuple[torch.Tensor, torch.Tensor]:
    high_freq = torch.zeros_like(image)
    for i in range(levels):
        radius = 2 ** i
        low_freq = wavelet_blur(image, radius)
        high_freq += (image - low_freq)
        image = low_freq
    return high_freq, low_freq


def wavelet_reconstruction(content_feat: torch.Tensor, style_feat: torch.Tensor) -> torch.Tensor:
    content_high_freq, content_low_freq = wavelet_decomposition(content_feat)
    style_high_freq, style_low_freq = wavelet_decomposition(style_feat)
    return content_high_freq + style_low_freq


def color_match_wavelet(image: torch.Tensor, reference: torch.Tensor) -> torch.Tensor:
    content_feat = image.permute(0, 3, 1, 2)
    style_feat = reference.permute(0, 3, 1, 2)
    
    # If spatial dimensions differ, resize style_feat to match content_feat
    if content_feat.shape[2:] != style_feat.shape[2:]:
        style_feat = F.interpolate(
            style_feat, size=content_feat.shape[2:], mode="bilinear", align_corners=False
        )
        
    out = wavelet_reconstruction(content_feat, style_feat)
    return out.permute(0, 2, 3, 1).clamp(0.0, 1.0)


# --- Color Matching Logic (color-matcher library Methods) ---
def color_match_matcher(image: torch.Tensor, reference: torch.Tensor, method: str) -> torch.Tensor:
    try:
        from color_matcher import ColorMatcher
    except ImportError as e:
        print("[TrixColorMatchNode] Cannot import color-matcher library. Fallback to LAB method.")
        return color_match_lab(image, reference)

    cm = ColorMatcher()
    dev, dt = image.device, image.dtype
    img_np = image.detach().cpu().numpy()
    ref_np = reference.detach().cpu().numpy()
    
    B = img_np.shape[0]
    ref_B = ref_np.shape[0]
    out = np.empty_like(img_np)
    
    for i in range(B):
        src_i = img_np[i]
        ref_i = ref_np[min(i, ref_B - 1)]
        try:
            res_i = cm.transfer(src=src_i, ref=ref_i, method=method)
        except Exception as e:
            print(f"[TrixColorMatchNode] color-matcher error for method {method}: {e}")
            res_i = src_i
        out[i] = res_i
        
    return torch.from_numpy(out).to(device=dev, dtype=dt).clamp(0.0, 1.0)


# --- Universal Target & Execution Manager ---
def _apply_target(original: torch.Tensor, matched: torch.Tensor, target: str) -> torch.Tensor:
    t = (target or "All").strip().lower()
    if t == "all":
        return matched
    orig_lab = rgb_to_oklab(original)
    match_lab = rgb_to_oklab(matched)
    if t == "lightness":
        out_lab = torch.stack([match_lab[..., 0], orig_lab[..., 1], orig_lab[..., 2]], dim=-1)
    else:  # "color"
        out_lab = torch.stack([orig_lab[..., 0], match_lab[..., 1], match_lab[..., 2]], dim=-1)
    return oklab_to_rgb(out_lab)


def get_torch_device(device_option: str) -> torch.device:
    if device_option == "gpu":
        if torch.cuda.is_available():
            return torch.device("cuda")
        elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            return torch.device("mps")
        return torch.device("cpu")
    elif device_option == "cpu":
        return torch.device("cpu")
    else:  # "auto"
        try:
            from comfy import model_management
            return model_management.get_torch_device()
        except ImportError:
            if torch.cuda.is_available():
                return torch.device("cuda")
            elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                return torch.device("mps")
            return torch.device("cpu")


def apply_color_match(image: torch.Tensor, reference: torch.Tensor,
                      method: str = "LAB", target: str = "All", device: str = "auto") -> torch.Tensor:
    target_device = get_torch_device(device)
    orig_device = image.device
    
    # Move tensors to selected device
    image = image.to(target_device)
    reference = reference.to(target_device)
    
    image = torch.clamp(image, 0.0, 1.0)
    reference = torch.clamp(reference, 0.0, 1.0)
    m = (method or "LAB").strip().lower()
    if m == "rgb":
        matched = color_match_rgb(image, reference)
    elif m == "histogram":
        matched = color_match_histogram(image, reference)
    elif m == "adain":
        matched = color_match_adain(image, reference)
    elif m == "wavelet":
        matched = color_match_wavelet(image, reference)
    elif m in ["mkl", "reinhard", "mvgd", "hm", "hm-mvgd-hm", "hm-mkl-hm"]:
        matched = color_match_matcher(image, reference, m)
    else:
        matched = color_match_lab(image, reference)
    
    res = torch.clamp(_apply_target(image, matched, target), 0.0, 1.0)
    return res.to(orig_device)


# --- ComfyUI Custom Node Class ---
def _load_image(image_path: str) -> torch.Tensor:
    with Image.open(image_path) as i:
        i = ImageOps.exif_transpose(i)
        image = i.convert("RGB")
        image = np.array(image).astype(np.float32) / 255.0
        image = torch.from_numpy(image)[None,]
    return image

def _resolve_image_filepath(img_input: str) -> str:
    if not img_input:
        return ""
    if "filename=" in img_input or "view?" in img_input:
        import urllib.parse
        parsed = urllib.parse.urlparse(img_input)
        qs = urllib.parse.parse_qs(parsed.query)
        fn = qs.get("filename", [""])[0]
        sub = qs.get("subfolder", [""])[0]
        typ = qs.get("type", ["input"])[0]
        if fn:
            full_fn = os.path.join(sub, fn) if sub else fn
            try:
                p = folder_paths.get_annotated_filepath(f"{full_fn} [{typ}]" if typ != "input" else full_fn)
                if p and os.path.exists(p):
                    return p
            except Exception:
                pass
    try:
        p = folder_paths.get_annotated_filepath(img_input)
        if p and os.path.exists(p):
            return p
    except Exception:
        pass
    input_dir = folder_paths.get_input_directory()
    candidate = os.path.join(input_dir, img_input)
    if os.path.exists(candidate):
        return candidate
    output_dir = folder_paths.get_output_directory()
    candidate = os.path.join(output_dir, img_input)
    if os.path.exists(candidate):
        return candidate
    temp_dir = folder_paths.get_temp_directory()
    candidate = os.path.join(temp_dir, img_input)
    if os.path.exists(candidate):
        return candidate
    return img_input

if PromptServer is not None:
    @PromptServer.instance.routes.post("/trix_color_match/live_preview")
    async def trix_color_match_live_preview(request):
        try:
            data = await request.json()
            image_upload = data.get("image_upload")
            reference_upload = data.get("reference_upload")
            method = data.get("method", "LAB")
            target = data.get("target", "All")
            strength = float(data.get("strength", 1.0))
            device = data.get("device", "auto")
            preview_id = data.get("preview_id", "A")

            this_dir = os.path.dirname(os.path.abspath(__file__))
            web_dir = os.path.join(os.path.dirname(this_dir), "web")
            safe_id = ''.join(ch if ch.isalnum() or ch in ('-', '_') else '_' for ch in (preview_id or 'A'))

            if not image_upload or not reference_upload:
                # Fall back to using the last executed images in the web folder
                src_cached_path = os.path.join(web_dir, f"trix_color_match_src_{safe_id}.png")
                ref_cached_path = os.path.join(web_dir, f"trix_color_match_ref_{safe_id}.png")
                if os.path.exists(src_cached_path) and os.path.exists(ref_cached_path):
                    img_path = src_cached_path
                    ref_path = ref_cached_path
                else:
                    return web.json_response({"error": "Missing image uploads and no cached previews available"})
            else:
                img_path = _resolve_image_filepath(image_upload)
                ref_path = _resolve_image_filepath(reference_upload)

            image = _load_image(img_path)
            reference = _load_image(ref_path)

            matched = apply_color_match(image, reference, method, target="All", device=device)
            final_matched = _apply_target(image, matched, target)

            if strength != 1.0:
                out = (1.0 - strength) * image + strength * final_matched
                out = torch.clamp(out, 0.0, 1.0)
            else:
                out = final_matched

            # Check if mask exists in cache
            mask_connected = data.get("mask_connected", True)
            mask_cached_path = os.path.join(web_dir, f"trix_color_match_mask_{safe_id}.png")
            
            if not mask_connected:
                if os.path.exists(mask_cached_path):
                    try:
                        os.remove(mask_cached_path)
                    except Exception:
                        pass

            preview_matched = out
            if mask_connected and os.path.exists(mask_cached_path):
                try:
                    mask = _load_mask_image(mask_cached_path)
                    preview_matched = _apply_mask_to_preview(image, out, mask)
                except Exception as me:
                    print(f"[TrixColorMatchNode] Failed to load cached mask preview: {me}")

            _save_web_preview(image, web_dir, filename=f"trix_color_match_src_{safe_id}.png", max_dim=1024)
            _save_web_preview(reference, web_dir, filename=f"trix_color_match_ref_{safe_id}.png", max_dim=1024)
            _save_web_preview(preview_matched, web_dir, filename=f"trix_color_match_live_{safe_id}.png", max_dim=1024)

            folder = _get_extension_folder()
            return web.json_response({"url": f"/extensions/{folder}/trix_color_match_live_{safe_id}.png?t={time.time()}"})
        except Exception as e:
            return web.json_response({"error": str(e)}, status=500)


class TrixColorMatchNode:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "reference": ("IMAGE",),
                "method": (COLOR_MATCH_METHODS, {"default": "LAB"}),
                "target": (COLOR_MATCH_TARGETS, {"default": "All"}),
                "strength": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 1.0, "step": 0.01}),
                "device": (["auto", "cpu", "gpu"], {"default": "auto"}),
                "preview_mode": (["show", "hide", "show before-after", "show compare reference"], {"default": "show"}),
            },
            "optional": {
                "mask (preview only)": ("MASK",),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
            }
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    FUNCTION = "run"
    CATEGORY = "image/processing"

    def run(self, image, reference, method="LAB", target="All", strength=1.0, device="auto", preview_mode="show", **kwargs):
        unique_id = kwargs.get("unique_id") or kwargs.get("preview_id") or "A"
        preview_id = str(unique_id)
        mask = kwargs.get("mask (preview only)", None)
        # Always run color matching with target="All" to get the raw matched image
        matched = apply_color_match(image, reference, method, target="All", device=device)

        # Apply spatial target mask
        final_matched = _apply_target(image, matched, target)

        # Apply strength blending
        if strength != 1.0:
            out = (1.0 - strength) * image + strength * final_matched
            out = torch.clamp(out, 0.0, 1.0)
        else:
            out = final_matched

        # If preview is shown, save files and emit sync websocket event
        if preview_mode != "hide":
            this_dir = os.path.dirname(os.path.abspath(__file__))
            web_dir = os.path.join(os.path.dirname(this_dir), "web")
            safe_id = ''.join(ch if ch.isalnum() or ch in ('-', '_') else '_' for ch in (preview_id or 'A'))
            
            # Composite with mask for preview if mask is present
            preview_matched = out
            if mask is not None:
                _save_mask_preview(mask, web_dir, filename=f"trix_color_match_mask_{safe_id}.png")
                preview_matched = _apply_mask_to_preview(image, out, mask)
            else:
                # Remove cached mask file if it exists
                mask_cached_path = os.path.join(web_dir, f"trix_color_match_mask_{safe_id}.png")
                if os.path.exists(mask_cached_path):
                    try:
                        os.remove(mask_cached_path)
                    except Exception:
                        pass

            _save_web_preview(image, web_dir, filename=f"trix_color_match_src_{safe_id}.png", max_dim=1024)
            _save_web_preview(reference, web_dir, filename=f"trix_color_match_ref_{safe_id}.png", max_dim=1024)
            _save_web_preview(preview_matched, web_dir, filename=f"trix_color_match_matched_{safe_id}.png", max_dim=1024)

            try:
                from server import PromptServer  # type: ignore
                payload = {
                    "preview_id": safe_id,
                    "ts": time.time(),
                    "method": method,
                }
                PromptServer.instance.send_sync("trix_color_match_preview", payload)
            except Exception:
                pass

        return (out,)
