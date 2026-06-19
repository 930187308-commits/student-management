#!/usr/bin/env python3
import json
import pathlib
import sys
import base64
import posixpath
import zipfile
import xml.etree.ElementTree as ET


def clean_text(value: str) -> str:
    return "\n".join(line.rstrip() for line in (value or "").replace("\r", "\n").split("\n")).strip()


def extract_pdf(path: pathlib.Path) -> str:
    from pypdf import PdfReader

    reader = PdfReader(str(path))
    pages = []
    for index, page in enumerate(reader.pages, start=1):
        try:
            text = page.extract_text() or ""
        except Exception:
            text = ""
        if text.strip():
            pages.append(f"--- page {index} ---\n{text}")
    return clean_text("\n".join(pages))


def extract_docx(path: pathlib.Path) -> str:
    ns = {
        "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
        "m": "http://schemas.openxmlformats.org/officeDocument/2006/math",
        "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
        "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
        "rel": "http://schemas.openxmlformats.org/package/2006/relationships",
    }
    assets = []
    seen_assets = {}

    with zipfile.ZipFile(path) as zf:
        document_xml = zf.read("word/document.xml")
        rels_xml = zf.read("word/_rels/document.xml.rels")
        rel_root = ET.fromstring(rels_xml)
        rels = {
            rel.attrib.get("Id"): rel.attrib.get("Target", "")
            for rel in rel_root.findall("rel:Relationship", ns)
            if "image" in rel.attrib.get("Type", "")
        }

        def read_asset(rel_id: str) -> str:
            target = rels.get(rel_id, "")
            if not target:
                return ""
            zip_name = target.lstrip("/")
            if zip_name not in zf.namelist():
                zip_name = posixpath.normpath(posixpath.join("word", target))
            if zip_name not in zf.namelist():
                return ""
            if rel_id in seen_assets:
                return seen_assets[rel_id]
            suffix = pathlib.PurePosixPath(zip_name).suffix.lower() or ".png"
            marker = f"[[image:{rel_id}{suffix}]]"
            assets.append({
                "marker": marker,
                "fileName": pathlib.PurePosixPath(zip_name).name,
                "extension": suffix,
                "dataBase64": base64.b64encode(zf.read(zip_name)).decode("ascii"),
            })
            seen_assets[rel_id] = marker
            return marker

        def math_text(node) -> str:
            if node.tag == f"{{{ns['m']}}}f":
                num = "".join(math_text(child) for child in node.findall("m:num", ns)).strip()
                den = "".join(math_text(child) for child in node.findall("m:den", ns)).strip()
                return f"\\frac{{{num}}}{{{den}}}" if num or den else ""
            if node.tag == f"{{{ns['m']}}}rad":
                base = "".join(math_text(child) for child in node.findall("m:e", ns)).strip()
                degree = "".join(math_text(child) for child in node.findall("m:deg", ns)).strip()
                if not base:
                    return ""
                return f"\\sqrt[{degree}]{{{base}}}" if degree else f"\\sqrt{{{base}}}"
            if node.tag == f"{{{ns['m']}}}sSup":
                base = "".join(math_text(child) for child in node.findall("m:e", ns)).strip()
                sup = "".join(math_text(child) for child in node.findall("m:sup", ns)).strip()
                return f"{base}^{{{sup}}}" if sup else base
            if node.tag == f"{{{ns['m']}}}sSub":
                base = "".join(math_text(child) for child in node.findall("m:e", ns)).strip()
                sub = "".join(math_text(child) for child in node.findall("m:sub", ns)).strip()
                return f"{base}_{{{sub}}}" if sub else base
            if node.tag == f"{{{ns['m']}}}t":
                return node.text or ""
            parts = [math_text(child) for child in list(node)]
            merged = ""
            for part in parts:
                if merged and part and part.startswith("\\frac") and merged[-1].isdigit():
                    merged += ""
                merged += part
            return merged

        def inline_text(node) -> str:
            if node.tag == f"{{{ns['w']}}}t":
                return node.text or ""
            if node.tag == f"{{{ns['w']}}}tab":
                return "\t"
            if node.tag == f"{{{ns['w']}}}br":
                return "\n"
            if node.tag in {f"{{{ns['m']}}}oMath", f"{{{ns['m']}}}oMathPara"}:
                return math_text(node)
            if node.tag == f"{{{ns['w']}}}drawing":
                markers = []
                for blip in node.findall(".//a:blip", ns):
                    rel_id = blip.attrib.get(f"{{{ns['r']}}}embed")
                    marker = read_asset(rel_id)
                    if marker:
                        markers.append(marker)
                return "".join(markers)
            return "".join(inline_text(child) for child in list(node))

        def paragraph_text(paragraph) -> str:
            return "".join(inline_text(child) for child in list(paragraph)).strip()

        root = ET.fromstring(document_xml)
        body = root.find("w:body", ns)
        parts = []
        for block in list(body):
            if block.tag == f"{{{ns['w']}}}p":
                text = paragraph_text(block)
                if text:
                    parts.append(text)
            elif block.tag == f"{{{ns['w']}}}tbl":
                for row in block.findall(".//w:tr", ns):
                    cells = []
                    for cell in row.findall("w:tc", ns):
                        cell_text = "\n".join(filter(None, (paragraph_text(p) for p in cell.findall(".//w:p", ns))))
                        if cell_text:
                            cells.append(cell_text)
                    if cells:
                        parts.append("\t".join(cells))
    return {"text": clean_text("\n".join(parts)), "assets": assets}


def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "missing file path"}, ensure_ascii=False))
        return 2

    path = pathlib.Path(sys.argv[1])
    suffix = path.suffix.lower()
    try:
        if suffix == ".pdf":
            text = extract_pdf(path)
        elif suffix == ".docx":
            docx_result = extract_docx(path)
            text = docx_result["text"]
            assets = docx_result.get("assets", [])
        else:
            print(json.dumps({"ok": False, "error": f"unsupported extension: {suffix}"}, ensure_ascii=False))
            return 2
        print(json.dumps({"ok": True, "text": text, "assets": locals().get("assets", [])}, ensure_ascii=False))
        return 0
    except Exception as exc:
        print(json.dumps({"ok": False, "error": f"{type(exc).__name__}: {exc}"}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
