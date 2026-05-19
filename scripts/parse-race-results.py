#!/usr/bin/env python3
"""Parse local SUP result books into JSON payloads for /api/admin/result-import.

This script is intentionally conservative: text PDFs and spreadsheets are parsed
when a stable table shape is detected; image-only files are emitted as
pending_review sources so the original asset can still be tracked.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any


CORE_KEYWORDS = (
    "亚洲", "全国", "中国桨板", "冠军", "超级联赛", "俱乐部联赛", "百城",
    "省", "长三角", "公开赛", "精英赛",
)
SKIP_KEYWORDS = ("皮划艇", "独木舟", "龙舟")
SUP_KEYWORDS = ("桨板", "SUP", "sup")
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
EXCEL_EXTS = {".xlsx", ".xls"}


def classify_file(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        return "pdf"
    if suffix in EXCEL_EXTS:
        return "excel"
    if suffix in IMAGE_EXTS:
        return "image"
    if suffix == ".txt":
        return "text"
    return "unknown"


def is_core(path: Path) -> bool:
    text = str(path)
    if not any(k in text for k in SUP_KEYWORDS):
        return False
    if any(k in text for k in CORE_KEYWORDS):
        return True
    return False


def event_from_path(path: Path, root: Path) -> dict[str, Any]:
    try:
        rel = path.relative_to(root)
        first = rel.parts[0] if len(rel.parts) > 1 else path.parent.name
    except ValueError:
        first = path.parent.name
    date_match = re.search(r"(\d{4})(\d{2})(\d{2})", first)
    start_date = None
    if date_match:
        start_date = f"{date_match.group(1)}-{date_match.group(2)}-{date_match.group(3)}"
    name = re.sub(r"^\d{8}\s*", "", first).strip() or path.stem
    name = name.replace("2O026", "2026")
    return {
        "name": name,
        "start_date": start_date,
        "source_scope": "本地成绩册导入",
        "star_level": infer_star(name),
        "score_coefficient": infer_score(name),
    }


def infer_star(name: str) -> str | None:
    if "亚洲" in name:
        return "五星+"
    if any(k in name for k in ("全国", "冠军", "超级联赛")):
        return "五星"
    if any(k in name for k in ("俱乐部联赛", "百城", "中国桨板公开赛")):
        return "四星+"
    if any(k in name for k in ("省", "长三角", "精英赛")):
        return "四星"
    return "三星"


def infer_score(name: str) -> float | None:
    mapping = {"五星+": 5.5, "五星": 5.0, "四星+": 4.5, "四星": 4.0, "三星": 3.0}
    star = infer_star(name)
    return mapping.get(star or "")


def normalize_result_row(row: dict[str, Any], context: dict[str, Any]) -> dict[str, Any] | None:
    name = str(row.get("姓名") or row.get("运动员姓名") or row.get("运动员") or row.get("name") or "").strip()
    rank_raw = str(row.get("名次") or row.get("排名") or row.get("rank") or "").strip()
    finish = str(row.get("成绩") or row.get("赛会成绩") or row.get("finish_time") or "").strip()
    if not name or not rank_raw or not finish:
        return None
    if rank_raw in {"/", "·", "-", "DNS", "DNF"}:
        return None
    try:
        rank = int(float(rank_raw))
    except ValueError:
        return None
    return {
        "athlete_name_snapshot": name,
        "bib_number": str(row.get("参赛号") or row.get("号码") or row.get("参赛号码") or "").strip() or None,
        "gender_group": context.get("gender_group") or infer_gender(context.get("sheet") or context.get("title") or ""),
        "discipline": context.get("discipline") or infer_discipline(context.get("sheet") or context.get("title") or ""),
        "round_label": context.get("round_label"),
        "rank_position": rank,
        "finish_time": finish,
        "team_name": str(row.get("代表队") or row.get("代表单位/地区") or row.get("单位") or row.get("队伍") or "").strip() or None,
        "points": parse_number(row.get("积分") or row.get("总积分")),
        "source_locator": context.get("locator"),
        "parse_confidence": 0.86,
        "review_status": "confirmed",
    }


def infer_gender(text: str) -> str:
    if "女子" in text:
        return "女子组"
    if "男子" in text:
        return "男子组"
    return "公开组"


def infer_discipline(text: str) -> str:
    match = re.search(r"(\d+(?:\.\d+)?)\s*(米|m|M|公里|KM|km|K)", text)
    if match:
        unit = match.group(2).lower()
        value = match.group(1)
        if unit in {"公里", "km", "k"}:
            return f"{value}公里"
        return f"{value}米"
    if "长距离" in text:
        return "长距离"
    if "竞速" in text or "冲刺" in text:
        return "竞速赛"
    return text[:40] or "未分项目"


def parse_number(value: Any) -> float | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text or text == "/":
        return None
    try:
        return float(text)
    except ValueError:
        return None


def parse_excel(path: Path) -> list[dict[str, Any]]:
    import pandas as pd

    results: list[dict[str, Any]] = []
    sheets = pd.read_excel(path, sheet_name=None, header=None)
    for sheet_name, df in sheets.items():
        df = df.dropna(how="all")
        if df.empty:
            continue
        header_idx = None
        for idx, row in df.iterrows():
            values = [str(v).strip() for v in row.tolist()]
            if "姓名" in values and any(v in values for v in ("名次", "排名")):
                header_idx = idx
                break
        if header_idx is None:
            continue
        header = [str(v).strip() for v in df.loc[header_idx].tolist()]
        body = df.loc[header_idx + 1 :].copy()
        body.columns = header
        for _, item in body.iterrows():
            parsed = normalize_result_row(item.to_dict(), {"sheet": sheet_name, "locator": f"sheet:{sheet_name}"})
            if parsed:
                results.append(parsed)
    return results


def parse_pdf(path: Path) -> list[dict[str, Any]]:
    import pdfplumber

    results: list[dict[str, Any]] = []
    with pdfplumber.open(path) as pdf:
        for index, page in enumerate(pdf.pages, start=1):
            title = (page.extract_text() or "").split("\n")[:3]
            page_title = " ".join(title)
            tables = page.extract_tables() or []
            for table in tables:
                if not table or len(table) < 2:
                    continue
                header = [str(v or "").strip().replace("\n", "") for v in table[0]]
                if "姓名" not in "".join(header) or not any("名次" in h or "排名" in h for h in header):
                    continue
                for row in table[1:]:
                    item = {header[i]: row[i] if i < len(row) else "" for i in range(len(header))}
                    parsed = normalize_result_row(item, {"title": page_title, "locator": f"page:{index}"})
                    if parsed:
                        results.append(parsed)
            if not tables:
                results.extend(parse_pdf_text_page(page.extract_text() or "", index))
    return results


def parse_pdf_text_page(text: str, page_number: int) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    title = " ".join(lines[:3])
    pattern = re.compile(r"^(\d+)\s+([A-Z]?\d{1,4})?\s*([\u4e00-\u9fa5A-Za-z·]{2,30})\s+(.+?)\s+((?:\d+:)?\d{1,2}[:.]\d{2}(?:[.:]\d{1,3})?|\d+'\d+(?:\.\d+)?\"?)$")
    for line in lines:
        match = pattern.match(line)
        if not match:
            continue
        rank, bib, name, team, finish = match.groups()
        parsed = normalize_result_row(
            {"名次": rank, "号码": bib or "", "姓名": name, "代表队": team, "成绩": finish},
            {"title": title, "locator": f"page:{page_number}"},
        )
        if parsed:
            parsed["parse_confidence"] = 0.72
            parsed["review_status"] = "needs_review"
            out.append(parsed)
    return out


def parse_one(path: Path, root: Path) -> dict[str, Any] | None:
    file_type = classify_file(path)
    if not is_core(path):
        return None
    if any(k in path.name for k in SKIP_KEYWORDS) and "桨板" not in path.name:
        return None
    results: list[dict[str, Any]] = []
    note = ""
    status = "pending_review"
    try:
        if file_type == "excel":
            results = parse_excel(path)
        elif file_type == "pdf":
            results = parse_pdf(path)
        elif file_type == "text":
            text = path.read_text(encoding="utf-8", errors="ignore")
            results = parse_pdf_text_page(text, 1)
        else:
            note = "图片或未知格式，需后台人工复核"
    except Exception as exc:  # noqa: BLE001
        note = f"解析失败：{exc}"
        status = "failed"
    if results:
        status = "parsed"
    return {
        "event": event_from_path(path, root),
        "source": {
            "original_path": str(path),
            "file_name": path.name,
            "file_type": file_type,
            "parser_name": "parse-race-results.py",
            "parser_status": status,
            "parser_note": note,
            "extracted_rows": len(results),
            "metadata": {"relative_path": str(path.relative_to(root)) if path.is_relative_to(root) else str(path)},
        },
        "results": results,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("root", type=Path)
    parser.add_argument("-o", "--output", type=Path, default=Path("race-results-import.json"))
    args = parser.parse_args()
    payloads = []
    paths = [args.root] if args.root.is_file() else sorted(args.root.rglob("*"))
    scan_root = args.root.parent if args.root.is_file() else args.root
    for path in paths:
        if path.is_file() and classify_file(path) != "unknown":
            item = parse_one(path, scan_root)
            if item:
                payloads.append(item)
    args.output.write_text(json.dumps(payloads, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {len(payloads)} payloads to {args.output}")


if __name__ == "__main__":
    main()
