#!/usr/bin/env python3
"""Parse 2024 Asian SUP Championship Huangshi result book pages 22-end.

The source PDF is text-extractable. This parser caches every parsed page under
.cache so retries never have to start from scratch, and processes pages in
parallel by default.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

from pypdf import PdfReader


EVENT_NAME = "2024年亚洲桨板锦标赛暨中国黄石（国际）桨板邀请赛"
EVENT_START_DATE = "2024-10-03"
EVENT_END_DATE = "2024-10-06"
EVENT_PROVINCE = "湖北省"
EVENT_CITY = "黄石市"
EVENT_VENUE = "湖北黄石"
DEFAULT_PDF = "/Users/xhl/Downloads/桨板赛事/20241003期 亚洲桨板锦标赛（中国黄石）/成绩汇总.pdf"
SOURCE_URL = "/result-books/20241003期 亚洲桨板锦标赛（中国黄石）/成绩汇总.pdf"
PAGE_FIRST = 22
STATUS_CODES = {"DNS", "DNF", "DQ", "DSQ", "DNQ", "OTL"}
STATUS_LABELS = {
    "DNS": "未出发",
    "DNF": "未完赛",
    "DQ": "取消成绩",
    "DSQ": "取消成绩",
    "DNQ": "未晋级",
    "OTL": "超过关门时间",
}
COUNTRIES = {
    "CHN", "JPN", "KOR", "TPE", "HKG", "BAN", "UZB", "IRI", "KSA", "THA",
    "MAS", "SGP", "PHI", "IND", "INA", "VIE", "CAM", "MGL", "AUS",
}
ROUND_MAP = {
    "FINAL": "决赛",
    "FINANL": "决赛",
    "SEMI-FINAL": "复赛",
    "SEMIFINAL": "复赛",
    "HEAT": "预赛",
}


def clean(value: Any) -> str:
    text = str(value or "").strip()
    text = (
        text.replace("：", ":")
        .replace("（", "(")
        .replace("）", ")")
        .replace("，", ",")
        .replace("；", ";")
    )
    return re.sub(r"\s+", " ", text).strip()


def normalize_time(value: str) -> str:
    text = clean(value).upper()
    text = text.rstrip(".,")
    return text


def status_code(value: str) -> str | None:
    text = normalize_time(value)
    return text if text in STATUS_CODES else None


def status_note(code: str | None) -> str | None:
    return STATUS_LABELS.get(code or "")


def parse_time_to_seconds(value: str) -> float | None:
    text = normalize_time(value)
    if not text or status_code(text):
        return None
    if re.fullmatch(r"\d+(?:\.\d+)?", text):
        return float(text)
    parts = text.split(":")
    try:
        if len(parts) == 2:
            return int(parts[0]) * 60 + float(parts[1])
        if len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])
    except ValueError:
        return None
    return None


def normalize_round(value: str) -> str | None:
    text = clean(value).upper()
    return ROUND_MAP.get(text)


def normalize_group(chinese: str, english: str) -> str:
    text = f"{chinese} {english}"
    compact = text.replace(" ", "").lower()
    if "公开" in compact or "open" in compact:
        group = "公开组"
    elif "大师" in compact or "master" in compact:
        group = "大师组"
    elif "卡胡纳" in compact or "kahuna" in compact:
        group = "卡胡纳组"
    elif "u16" in compact:
        group = "U16组"
    elif "u18" in compact:
        group = "U18组"
    elif "u12" in compact:
        group = "U12组"
    else:
        group = "公开组"

    if "女子" in compact or "women" in compact or "girls" in compact:
        gender = "女子"
    elif "男子" in compact or "men" in compact or "boys" in compact:
        gender = "男子"
    else:
        gender = ""
    return f"{group}{gender}" if gender else group


def normalize_discipline(chinese: str, english: str) -> str:
    text = f"{chinese} {english}"
    compact = text.replace(" ", "").lower()
    if "12km" in compact or "12KM" in text:
        return "12KM长距离赛"
    if "6000米" in compact or "6km" in compact:
        return "6KM技巧赛"
    if "1500m" in compact or "1.5km" in compact or "1500米" in compact:
        if "inflatable" in compact:
            return "1.5KM充气板技巧赛"
        return "1.5KM技巧赛"
    if "200m" in compact:
        return "200M冲刺赛"
    if "technical" in compact or "技巧" in compact:
        return "技巧赛"
    if "longdistance" in compact or "longdistance" in compact or "长距离" in compact:
        return "长距离赛"
    return clean(chinese or english)[:100] or "未分项目"


def context_from_titles(english: str, chinese: str, is_overall: bool) -> dict[str, Any]:
    no_match = re.search(r"\bNO\.?\s*(\d+)", f"{english} {chinese}", re.I)
    round_label = "总排名" if is_overall else None
    if not round_label:
        heat_match = re.search(r"预赛第\s*(\d+)\s*组|Heat\s*(\d+)", f"{chinese} {english}", re.I)
        semi_match = re.search(r"(?:半决赛|复赛)第\s*(\d+)\s*组|Semi-?Final\s*(\d+)", f"{chinese} {english}", re.I)
        if heat_match:
            round_label = f"预赛第{heat_match.group(1) or heat_match.group(2)}组"
        elif semi_match:
            round_label = f"复赛第{semi_match.group(1) or semi_match.group(2)}组"
        elif re.search(r"决赛|Final", f"{chinese} {english}", re.I):
            round_label = "决赛"
        elif re.search(r"预赛|Heat", f"{chinese} {english}", re.I):
            round_label = "预赛"
        elif re.search(r"复赛|Semi", f"{chinese} {english}", re.I):
            round_label = "复赛"
        else:
            round_label = "决赛"

    return {
        "title": clean(chinese or english),
        "english_title": clean(english),
        "gender_group": normalize_group(chinese, english),
        "discipline": normalize_discipline(chinese, english),
        "board_class": "充气板" if re.search(r"Inflatable|充气", f"{english} {chinese}", re.I) else None,
        "round_label": round_label,
        "source_note": f"2024黄石亚洲桨板锦标赛成绩汇总解析：{clean(chinese or english)}",
        "source_no": no_match.group(1) if no_match else None,
        "is_overall": is_overall,
    }


def is_context_start(line: str) -> bool:
    text = clean(line)
    if re.match(r"^(?:\d+(?:\.\d+)?KM|200M|12KM|6KM).*(?:Race|Ranking|Location|Time)", text, re.I):
        return True
    if re.match(r"^NO\.?\d+", text, re.I):
        return True
    if re.match(r"^(?:公开|大师|卡胡纳|U\d+).*(?:组).*(?:赛|排名)", text):
        return True
    return False


def split_blocks(lines: list[str]) -> list[dict[str, Any]]:
    blocks: list[dict[str, Any]] = []
    index = 0
    while index < len(lines):
        line = clean(lines[index])
        if not line or line in {"RESULT /成绩单", "RESULT/成绩单"}:
            index += 1
            continue
        if line.startswith("OVERALL RANKING"):
            english = clean(lines[index + 1]) if index + 1 < len(lines) else ""
            chinese = clean(lines[index + 2]) if index + 2 < len(lines) else ""
            index += 3
            rows: list[str] = []
            while index < len(lines):
                current = clean(lines[index])
                if current.startswith("Chief Referee") or current.startswith("RESULT") or current.startswith("OVERALL RANKING") or is_context_start(current):
                    break
                rows.append(current)
                index += 1
            blocks.append({"context": context_from_titles(english, chinese, True), "rows": rows})
            continue

        if re.search(r"Race|Location:|Time:", line, re.I):
            english = line
            chinese = ""
            if index + 1 < len(lines) and re.match(r"^NO\.?\d+", clean(lines[index + 1]), re.I):
                chinese = clean(lines[index + 1])
                index += 2
            else:
                index += 1
            rows = []
            while index < len(lines):
                current = clean(lines[index])
                if current.startswith("Chief Referee") or current.startswith("/*") or current.startswith("RESULT") or current.startswith("OVERALL RANKING"):
                    if current.startswith("/*"):
                        index += 1
                    break
                if rows and is_context_start(current) and re.search(r"Race|Location:|Time:", current, re.I):
                    break
                rows.append(current)
                index += 1
            blocks.append({"context": context_from_titles(english, chinese, False), "rows": rows})
            continue

        if re.match(r"^NO\.?\d+", line, re.I):
            chinese = line
            index += 1
            rows = []
            while index < len(lines):
                current = clean(lines[index])
                if current.startswith("Chief Referee") or current.startswith("/*") or current.startswith("RESULT") or current.startswith("OVERALL RANKING"):
                    if current.startswith("/*"):
                        index += 1
                    break
                if rows and is_context_start(current):
                    break
                rows.append(current)
                index += 1
            blocks.append({"context": context_from_titles("", chinese, False), "rows": rows})
            continue

        index += 1
    return blocks


def starts_result_row(line: str) -> bool:
    text = clean(line)
    return bool(
        re.match(r"^\d{1,3}\s+(?:Final|Finanl|Semi-Final|Heat)\s+\d{3,5}", text, re.I)
        or re.match(r"^(?:Final|Finanl|Semi-Final|Heat)\s+\d{3,5}", text, re.I)
        or re.match(r"^\d{1,3}\s+\d{1,2}\s+\d{3,5}", text)
        or re.match(r"^\d{1,3}\s+\d{3,5}", text)
        or re.match(r"^\d{3,5}\s+", text)
        or re.match(r"^\d{3,5}[A-Za-z]", text)
    )


def normalize_result_rows(rows: list[str]) -> list[str]:
    logical: list[str] = []
    current = ""
    for raw in rows:
        line = clean(raw)
        if not line or is_header_or_noise(line):
            continue
        line = re.sub(r"\b(\d{3,5})(?=[A-Za-z])", r"\1 ", line)
        if starts_result_row(line):
            if current:
                logical.append(current)
            current = line
        elif current:
            current = f"{current} {line}"
        else:
            logical.append(line)
        if current and looks_like_result_line(current):
            logical.append(current)
            current = ""
    if current:
        logical.append(current)
    return logical


def is_header_or_noise(line: str) -> bool:
    if not line:
        return True
    if re.match(r"^\d{1,3}$", line):
        return True
    return any(
        token in line
        for token in (
            "RANK", "Bib No", "NAME", "TEAM", "RESULT", "名次", "参赛号码",
            "运动员姓名", "代表队", "成绩", "裁判长", "晋级规则", "Progression",
        )
    )


def looks_like_result_line(line: str) -> bool:
    text = clean(line)
    return bool(re.search(r"\b(?:DNS|DNF|DQ|DSQ|DNQ|OTL|\d{1,2}:\d{2}:\d{2}(?:\.\d+)?|\d{2}:\d{2}(?:\.\d+)?)\b", text))


def split_name_team(tokens: list[str]) -> tuple[str, str]:
    country_index = -1
    for index in range(len(tokens) - 1, -1, -1):
        if tokens[index].upper() in COUNTRIES:
            country_index = index
            break
    if country_index < 0:
        return " ".join(tokens), ""
    return " ".join(tokens[:country_index]), tokens[country_index].upper()


def parse_result_line(line: str, context: dict[str, Any], page_number: int, status_sequence: int) -> tuple[dict[str, Any] | None, int]:
    text = clean(line)
    if is_header_or_noise(text) or not looks_like_result_line(text):
        return None, status_sequence
    tokens = text.split()
    if len(tokens) < 4:
        return None, status_sequence

    rank_position: int | None = None
    round_from_row: str | None = None
    result_label: str | None = None
    idx = 0

    if re.fullmatch(r"\d{1,3}", tokens[idx]) and len(tokens) >= 5:
        rank_position = int(tokens[idx])
        idx += 1
    if idx < len(tokens) and normalize_round(tokens[idx]):
        round_from_row = normalize_round(tokens[idx])
        idx += 1

    lane_label = None
    if idx + 1 < len(tokens) and re.fullmatch(r"\d{1,2}", tokens[idx]) and re.fullmatch(r"\d{3,5}", tokens[idx + 1]):
        lane_label = f"出发位置 {tokens[idx]}"
        if status_code(tokens[-1]) and rank_position is not None and context["round_label"] != "总排名":
            rank_position = None
        idx += 1

    if idx >= len(tokens) or not re.fullmatch(r"\d{3,5}", tokens[idx]):
        return None, status_sequence
    bib_number = tokens[idx]
    idx += 1

    result_index = None
    for index in range(len(tokens) - 1, idx - 1, -1):
        if status_code(tokens[index]) or re.fullmatch(r"\d{1,2}:\d{2}:\d{2}(?:\.\d+)?|\d{2}:\d{2}(?:\.\d+)?", tokens[index]):
            result_index = index
            break
    if result_index is None:
        return None, status_sequence

    finish_time = normalize_time(tokens[result_index])
    trailing = tokens[result_index + 1:]
    if trailing:
        if trailing[0].upper() == "Q":
            result_label = "Q"
        elif trailing[0].upper() in STATUS_CODES:
            result_label = trailing[0].upper()
        else:
            result_label = " ".join(trailing)
    if lane_label and not result_label:
        result_label = lane_label

    name_team_tokens = tokens[idx:result_index]
    athlete_name, team_name = split_name_team(name_team_tokens)
    athlete_name = clean(athlete_name)
    if not athlete_name:
        return None, status_sequence

    code = status_code(finish_time)
    if rank_position is None:
        if code:
            status_sequence += 1
            rank_position = 9000 + status_sequence
        else:
            return None, status_sequence

    return {
        "athlete_name_snapshot": athlete_name.replace("   ", " "),
        "bib_number": bib_number,
        "gender_group": context["gender_group"],
        "discipline": context["discipline"],
        "board_class": context.get("board_class"),
        "round_label": f"总排名-{round_from_row}" if context.get("is_overall") and round_from_row else (context["round_label"] if context.get("is_overall") else (round_from_row or context["round_label"])),
        "rank_position": rank_position,
        "result_label": result_label,
        "finish_time": finish_time,
        "result_status_code": code,
        "result_status_note": status_note(code),
        "time_seconds": parse_time_to_seconds(finish_time),
        "team_name": team_name or "个人",
        "nationality_snapshot": team_name or None,
        "team_members": [],
        "source_locator": f"page:{page_number}",
        "source_note": context["source_note"],
        "parse_confidence": 0.96 if not code else 0.9,
        "review_status": "confirmed",
    }, status_sequence


def parse_block(block: dict[str, Any], page_number: int) -> tuple[list[dict[str, Any]], list[str]]:
    context = block["context"]
    results: list[dict[str, Any]] = []
    errors: list[str] = []
    status_sequence = 0
    for row in normalize_result_rows(block["rows"]):
        line = clean(row)
        if is_header_or_noise(line):
            continue
        parsed, status_sequence = parse_result_line(line, context, page_number, status_sequence)
        if parsed:
            results.append(parsed)
        elif starts_result_row(line) and looks_like_result_line(line):
            errors.append(line)
    return results, errors


def extract_page_text(pdf_path: str, page_number: int) -> str:
    reader = PdfReader(pdf_path)
    return reader.pages[page_number - 1].extract_text() or ""


def parse_page_task(args: tuple[str, int, str, bool]) -> dict[str, Any]:
    pdf_path, page_number, cache_dir_raw, force = args
    cache_dir = Path(cache_dir_raw)
    cache_path = cache_dir / f"page-{page_number:03d}.json"
    if cache_path.exists() and not force:
        return json.loads(cache_path.read_text(encoding="utf-8"))

    text = extract_page_text(pdf_path, page_number)
    lines = [clean(line) for line in text.splitlines()]
    blocks = split_blocks(lines)
    results: list[dict[str, Any]] = []
    errors: list[str] = []
    contexts: list[dict[str, Any]] = []
    for block in blocks:
        contexts.append(block["context"])
        block_results, block_errors = parse_block(block, page_number)
        results.extend(block_results)
        errors.extend(block_errors)

    payload = {
        "page": page_number,
        "text_chars": len(text),
        "contexts": contexts,
        "results": results,
        "errors": errors,
    }
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return payload


def dedupe_results(results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[tuple[Any, ...]] = set()
    out: list[dict[str, Any]] = []
    for item in results:
        key = (
            item["source_locator"],
            item["gender_group"],
            item["discipline"],
            item["round_label"],
            item["rank_position"],
            item["athlete_name_snapshot"],
            item["finish_time"],
        )
        if key in seen:
            continue
        seen.add(key)
        out.append(item)
    return out


def parse_pdf(pdf_path: Path, cache_dir: Path, workers: int, force: bool) -> dict[str, Any]:
    reader = PdfReader(str(pdf_path))
    page_last = len(reader.pages)
    if page_last < PAGE_FIRST:
        raise RuntimeError(f"PDF has only {page_last} pages; expected at least {PAGE_FIRST}")
    tasks = [(str(pdf_path), page, str(cache_dir), force) for page in range(PAGE_FIRST, page_last + 1)]
    if workers <= 1:
        pages = [parse_page_task(task) for task in tasks]
    else:
        with concurrent.futures.ProcessPoolExecutor(max_workers=workers) as executor:
            pages = list(executor.map(parse_page_task, tasks))
    pages.sort(key=lambda item: item["page"])

    results = dedupe_results([row for page in pages for row in page.get("results", [])])
    errors = {f"page:{page['page']}": page.get("errors", []) for page in pages if page.get("errors")}
    page_counts = {f"page:{page['page']}": len(page.get("results", [])) for page in pages}
    contexts = {f"page:{page['page']}": page.get("contexts", []) for page in pages if page.get("contexts")}
    return {
        "event": {
            "name": EVENT_NAME,
            "start_date": EVENT_START_DATE,
            "end_date": EVENT_END_DATE,
            "province": EVENT_PROVINCE,
            "city": EVENT_CITY,
            "venue": EVENT_VENUE,
        },
        "source": {
            "file_name": pdf_path.name,
            "file_type": "pdf",
            "source_url": SOURCE_URL,
            "original_path": str(pdf_path),
            "parser_name": "parse-huangshi-2024-results.py",
            "parser_note": "文本型PDF第22页至最后一页，并行解析；第1-21页积分汇总未纳入本结果payload",
            "metadata": {
                "page_first": PAGE_FIRST,
                "page_last": page_last,
                "page_result_counts": page_counts,
                "contexts": contexts,
                "error_count": sum(len(v) for v in errors.values()),
                "errors": errors,
                "workers": workers,
            },
        },
        "results": results,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", default=DEFAULT_PDF)
    parser.add_argument("--output", default=".cache/huangshi-2024-results.json")
    parser.add_argument("--cache-dir", default=".cache/huangshi-2024-pages")
    parser.add_argument("--workers", type=int, default=min(os.cpu_count() or 2, 8))
    parser.add_argument("--force", action="store_true", help="reparse cached pages")
    args = parser.parse_args()

    payload = parse_pdf(Path(args.pdf), Path(args.cache_dir), max(1, args.workers), args.force)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    groups: dict[str, int] = {}
    pages: dict[str, int] = {}
    for row in payload["results"]:
        group_key = " / ".join([row["discipline"], row["gender_group"], row["round_label"]])
        groups[group_key] = groups.get(group_key, 0) + 1
        pages[row["source_locator"]] = pages.get(row["source_locator"], 0) + 1
    print(json.dumps({
        "rows": len(payload["results"]),
        "groups": groups,
        "pages": pages,
        "error_count": payload["source"]["metadata"]["error_count"],
        "output": str(output),
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
