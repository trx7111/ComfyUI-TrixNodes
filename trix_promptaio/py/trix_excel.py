import os
import re
import json
import io
import uuid
import glob
import logging
import zipfile
import xml.etree.ElementTree as ET
from typing import Dict, List, Tuple, Any, Optional

from PIL import Image as PILImage

logger = logging.getLogger("ComfyUI-TrixPromptAIO.ExcelManager")


class ExcelStyleManager:

    _STYLES_CACHE: Optional[List[dict]] = None
    _IMAGES_CACHE: Optional[Dict[str, Tuple[bytes, str]]] = None

    @staticmethod
    def _require_openpyxl():
        try:
            import openpyxl
            from openpyxl.styles import Alignment, Font, PatternFill, Border, Side
            return openpyxl, Alignment, Font, PatternFill, Border, Side
        except ImportError:
            raise RuntimeError("The 'openpyxl' package is required for Excel import/export. Please install it using 'pip install openpyxl'.")

    @staticmethod
    def _sanitize_name(name: str) -> str:
        clean = re.sub(r'[^a-z0-9_\-]', '_', str(name or "category").lower()).strip('_')
        return clean if clean else "category"

    @staticmethod
    def _slugify(text: str) -> str:
        slug = re.sub(r'[^a-z0-9]+', '_', str(text or "").lower()).strip('_')
        return slug if slug else "style"

    @classmethod
    def get_styles_dir(cls) -> str:
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        styles_dir = os.path.join(base_dir, "styles")
        os.makedirs(styles_dir, exist_ok=True)
        return styles_dir

    @classmethod
    def get_excel_files(cls) -> List[str]:
        styles_dir = cls.get_styles_dir()
        files = glob.glob(os.path.join(styles_dir, "*.xlsx"))
        return sorted([f for f in files if not os.path.basename(f).endswith("_test.xlsx")])

    @classmethod
    def get_categories(cls) -> List[str]:
        files = cls.get_excel_files()
        cats = []
        for f in files:
            cat = cls._sanitize_name(os.path.splitext(os.path.basename(f))[0])
            cats.append(cat)
        return cats

    @classmethod
    def clear_cache(cls):
        cls._STYLES_CACHE = None
        cls._IMAGES_CACHE = None

    @classmethod
    def _parse_single_excel_file(cls, path: str, openpyxl) -> Tuple[List[dict], Dict[str, Tuple[bytes, str]]]:
        styles: List[dict] = []
        images: Dict[str, Tuple[bytes, str]] = {}

        if not os.path.exists(path):
            return styles, images

        default_cat = cls._sanitize_name(os.path.splitext(os.path.basename(path))[0])

        try:
            with zipfile.ZipFile(path, 'r') as z:
                # Read drawing images per sheet
                wb_tree = ET.fromstring(z.read('xl/workbook.xml'))
                ns_wb = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
                         'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
                
                sheet_names = {}
                for s_el in wb_tree.findall('.//main:sheet', ns_wb):
                    r_id = s_el.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
                    sheet_names[r_id] = s_el.attrib.get('name')

                wb_rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
                ns_rel = {'rel': 'http://schemas.openxmlformats.org/package/2006/relationships'}
                rid_to_target = {rel.attrib['Id']: rel.attrib['Target'] for rel in wb_rels.findall('./rel:Relationship', ns_rel)}

                target_to_cat = {}
                for r_id, name in sheet_names.items():
                    target = rid_to_target.get(r_id)
                    if target:
                        clean_target = target.lstrip('/')
                        if not clean_target.startswith('xl/'):
                            clean_target = 'xl/' + clean_target
                        target_to_cat[clean_target] = name

                for sheet_path, sheet_title in target_to_cat.items():
                    if sheet_path not in z.namelist():
                        continue
                    
                    cat_name = default_cat

                    rel_path = os.path.normpath(os.path.join(os.path.dirname(sheet_path), '_rels', os.path.basename(sheet_path) + '.rels')).replace('\\', '/')
                    drawing_path = None
                    
                    if rel_path in z.namelist():
                        sheet_rels = ET.fromstring(z.read(rel_path))
                        for rel in sheet_rels.findall('./rel:Relationship', ns_rel):
                            if 'drawing' in rel.attrib['Target']:
                                target_draw = rel.attrib['Target'].lstrip('/')
                                if target_draw.startswith('../'):
                                    target_draw = target_draw[3:]
                                if not target_draw.startswith('xl/'):
                                    target_draw = 'xl/' + target_draw
                                drawing_path = target_draw

                    row_images = {}
                    if drawing_path and drawing_path in z.namelist():
                        draw_rel_path = os.path.normpath(os.path.join(os.path.dirname(drawing_path), '_rels', os.path.basename(drawing_path) + '.rels')).replace('\\', '/')
                        draw_rel_map = {}
                        if draw_rel_path in z.namelist():
                            draw_rels = ET.fromstring(z.read(draw_rel_path))
                            for rel in draw_rels.findall('./rel:Relationship', ns_rel):
                                draw_rel_map[rel.attrib['Id']] = rel.attrib['Target']

                        draw_tree = ET.fromstring(z.read(drawing_path))
                        ns_xdr = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing'
                        ns_a = 'http://schemas.openxmlformats.org/drawingml/2006/main'
                        ns_r = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
                        
                        for anchor in draw_tree.findall(f'{{{ns_xdr}}}oneCellAnchor') + draw_tree.findall(f'{{{ns_xdr}}}twoCellAnchor'):
                            from_row = anchor.find(f'{{{ns_xdr}}}from/{{{ns_xdr}}}row')
                            from_col = anchor.find(f'{{{ns_xdr}}}from/{{{ns_xdr}}}col')
                            blip = anchor.find(f'.//{{{ns_a}}}blip')
                            if from_row is not None and from_col is not None and blip is not None:
                                r_num = int(from_row.text) + 1
                                c_num = int(from_col.text) + 1
                                embed_id = blip.attrib.get(f'{{{ns_r}}}embed')
                                target = draw_rel_map.get(embed_id)
                                if target:
                                    clean_target = target.lstrip('/')
                                    if clean_target.startswith('../'):
                                        clean_target = clean_target[3:]
                                    if not clean_target.startswith('xl/'):
                                        clean_target = 'xl/' + clean_target
                                    
                                    if clean_target in z.namelist():
                                        img_b = z.read(clean_target)
                                        ext = os.path.splitext(clean_target)[1].lower()
                                        m_type = "image/png" if ext=='.png' else "image/webp" if ext=='.webp' else "image/jpeg"
                                        row_images.setdefault(r_num, {})[c_num] = (img_b, m_type, ext)

                    # Use raw XML parsing to bypass openpyxl formatting bugs (e.g. extLst)
                    shared_strings = []
                    if 'xl/sharedStrings.xml' in z.namelist():
                        try:
                            root = ET.fromstring(z.read('xl/sharedStrings.xml'))
                            ns_main = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
                            for si in root.findall('./main:si', ns_main):
                                s_val = "".join(t.text for t in si.findall('.//main:t', ns_main) if t.text)
                                shared_strings.append(s_val)
                        except Exception as e:
                            logger.error(f"Error reading sharedStrings.xml in {path}: {e}")

                    if sheet_path in z.namelist():
                        try:
                            sheet_xml = ET.fromstring(z.read(sheet_path))
                            ns_main = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
                            
                            rows_list = sheet_xml.findall('.//main:row', ns_main)
                            rows_list.sort(key=lambda r: int(r.attrib.get('r', 0)))

                            for row in rows_list:
                                r_num_str = row.attrib.get('r')
                                if not r_num_str:
                                    continue
                                r_num = int(r_num_str)
                                if r_num == 1:
                                    continue # header
                                
                                row_dict = {}
                                for cell in row.findall('.//main:c', ns_main):
                                    r = cell.attrib.get('r')
                                    if not r: continue
                                    col_letter = ''.join(filter(str.isalpha, r)).upper()
                                    
                                    val = ""
                                    if cell.attrib.get('t') == 'inlineStr':
                                        is_elem = cell.find('./main:is', ns_main)
                                        if is_elem is not None:
                                            val = "".join(t.text for t in is_elem.findall('.//main:t', ns_main) if t.text)
                                    else:
                                        v_elem = cell.find('./main:v', ns_main)
                                        if v_elem is not None and v_elem.text:
                                            if cell.attrib.get('t') == 's':
                                                idx = int(v_elem.text)
                                                if 0 <= idx < len(shared_strings):
                                                    val = shared_strings[idx]
                                            else:
                                                val = v_elem.text
                                    row_dict[col_letter] = val
                                
                                name = str(row_dict.get('C', '') or "").strip()
                                tag = str(row_dict.get('D', '') or "").strip()
                                pos = str(row_dict.get('E', '') or "").strip()
                                neg = str(row_dict.get('F', '') or "").strip()
                                
                                if not name and not pos:
                                    continue

                                r_imgs = row_images.get(r_num, {})
                                thumb_val = ""
                                thumb_variant = ""

                                slug = cls._slugify(name)
                                if 1 in r_imgs and 2 in r_imgs:
                                    img1_b, m1, ext1 = r_imgs[1]
                                    img2_b, m2, ext2 = r_imgs[2]
                                    fn1 = f"{cat_name}_{slug}_1{ext1}"
                                    fn2 = f"{cat_name}_{slug}_2{ext2}"
                                    images[fn1] = (img1_b, m1)
                                    images[fn2] = (img2_b, m2)
                                    thumb_val = [fn1, fn2]
                                    thumb_variant = "compareSlider"
                                elif 1 in r_imgs:
                                    img1_b, m1, ext1 = r_imgs[1]
                                    fn1 = f"{cat_name}_{slug}{ext1}"
                                    images[fn1] = (img1_b, m1)
                                    thumb_val = fn1

                                styles.append({
                                    "id": name,
                                    "name": name,
                                    "tag": tag,
                                    "tags": [tag] if tag else [],
                                    "positive": pos,
                                    "negative": neg,
                                    "thumbnail": thumb_val,
                                    "thumbnail_variant": thumb_variant,
                                    "categoryKey": cat_name,
                                    "category": cat_name,
                                    "favorite": False
                                })
                        except Exception as e:
                            logger.error(f"Error parsing sheet {sheet_path} in {path}: {e}")
        except Exception as e:
            logger.error(f"Error loading Excel file {path}: {e}")

        return styles, images

    @classmethod
    def load_master_data(cls) -> Tuple[List[dict], Dict[str, Tuple[bytes, str]]]:
        if cls._STYLES_CACHE is not None and cls._IMAGES_CACHE is not None:
            return cls._STYLES_CACHE, cls._IMAGES_CACHE

        openpyxl, *_ = cls._require_openpyxl()

        all_styles: List[dict] = []
        all_images: Dict[str, Tuple[bytes, str]] = {}
        all_tags = set()

        excel_files = cls.get_excel_files()

        for path in excel_files:
            s_list, img_dict = cls._parse_single_excel_file(path, openpyxl)
            
            modified = False
            for s in s_list:
                orig_tag = s.get("tag", "")
                tag_val = orig_tag
                
                if not tag_val:
                    slug = cls._slugify(s.get("name", ""))
                    tag_val = f"@{slug}"
                elif not tag_val.startswith("@"):
                    tag_val = "@" + cls._slugify(tag_val)
                    
                base_tag = tag_val
                suffix = 2
                while tag_val.lower() in all_tags:
                    tag_val = f"{base_tag}_{suffix}"
                    suffix += 1
                
                if tag_val != orig_tag:
                    s["tag"] = tag_val
                    s["tags"] = [tag_val]
                    modified = True
                
                all_tags.add(tag_val.lower())
            
            all_styles.extend(s_list)
            all_images.update(img_dict)
            
            if modified:
                try:
                    from py.trix_backend import StyleManager
                    cat_clean = cls._sanitize_name(os.path.splitext(os.path.basename(path))[0])
                    StyleManager._write_category_to_disk(cat_clean, s_list, img_dict)
                    logger.info(f"Auto-generated tags and re-saved {cat_clean}.xlsx")
                except Exception as e:
                    logger.error(f"Failed to write auto-tags to Excel file: {e}")

        cls._STYLES_CACHE = all_styles
        cls._IMAGES_CACHE = all_images
        logger.info(f"Loaded {len(all_styles)} styles and {len(all_images)} images across {len(excel_files)} Excel files into RAM cache.")
        return all_styles, all_images

    @classmethod
    def get_image_bytes(cls, img_name: str) -> Optional[Tuple[bytes, str]]:
        _, images = cls.load_master_data()
        return images.get(img_name)

    @classmethod
    def export_category(cls, category_name: Optional[str] = None) -> Tuple[bytes, str, str]:
        styles_dir = cls.get_styles_dir()
        cat_clean = cls._sanitize_name(category_name) if category_name and category_name.lower() not in ("all", "favorite", "favourites") else None

        if cat_clean:
            file_path = os.path.join(styles_dir, f"{cat_clean}.xlsx")
            if os.path.exists(file_path):
                with open(file_path, "rb") as f:
                    return f.read(), f"{cat_clean}.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            
            for f in cls.get_excel_files():
                base_c = cls._sanitize_name(os.path.splitext(os.path.basename(f))[0])
                if base_c == cat_clean:
                    with open(f, "rb") as f_in:
                        return f_in.read(), os.path.basename(f), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

        excel_files = cls.get_excel_files()
        zip_buf = io.BytesIO()
        with zipfile.ZipFile(zip_buf, 'w', zipfile.ZIP_DEFLATED) as z:
            for fpath in excel_files:
                z.write(fpath, os.path.basename(fpath))

        zip_buf.seek(0)
        return zip_buf.getvalue(), "all_trix_styles.zip", "application/zip"

    @classmethod
    def import_excel_file(cls, file_bytes: bytes, filename: str) -> dict:
        styles_dir = cls.get_styles_dir()
        clean_base = cls._sanitize_name(os.path.splitext(os.path.basename(filename))[0])
        target_path = os.path.join(styles_dir, f"{clean_base}.xlsx")

        openpyxl, *_ = cls._require_openpyxl()

        all_existing_styles, _ = cls.load_master_data()
        existing_tags = set()
        for s in all_existing_styles:
            if s.get("categoryKey") != clean_base:
                t = s.get("tag")
                if t:
                    existing_tags.add(t.strip().lower())

        with open(target_path, "wb") as f:
            f.write(file_bytes)
            
        cls.clear_cache()
        all_styles, all_images = cls.load_master_data()

        cat_styles = [s for s in all_styles if s.get("categoryKey") == clean_base]

        return {
            "status": "success",
            "category": clean_base,
            "filename": f"{clean_base}.xlsx",
            "imported_styles": len(cat_styles),
            "total_styles": len(all_styles)
        }
