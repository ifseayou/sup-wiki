#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

from pypdf import PdfReader


EVENT_NAME = "2026杭州桨板系列赛-西溪湿地"
EVENT_SLUG = "hangzhou-xixi-series-2026"
BATCH_ID = "mp_1781419973432_ofobbfxv"
SUBMISSION_ID = 30
SOURCE_URL = (
    "https://sport-hacker-assets.oss-cn-hangzhou.aliyuncs.com/"
    "sup-wiki/result-submissions/1/"
    "1781419973751-8944pc-%E4%B8%8A%E5%8D%88%E6%88%90%E4%BA%BA%E7%BB%84%E6%88%90%E7%BB%A9.pdf"
)
DISPLAY_FILE_NAME = "上午成人组成绩.pdf"

STATUS_LABELS = {
    "DNS": "未出发",
    "DNF": "未完赛",
    "DQ": "取消成绩",
    "DSQ": "取消成绩",
}
STATUS_CODES = set(STATUS_LABELS)


def clean(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def normalize_time(value: str) -> str:
    text = clean(value).upper().replace("：", ":")
    if text in STATUS_CODES or text == "#VALUE!":
        return text
    match = re.fullmatch(r"(\d{1,2}):(\d{1,2}):(\d{1,2})(?:\.(\d+))?", text)
    if not match:
        return text
    hours, minutes, seconds, fraction = match.groups()
    normalized = f"{int(hours):02d}:{int(minutes):02d}:{int(seconds):02d}"
    if fraction:
        normalized += f".{fraction}"
    return normalized


def parse_seconds(value: str) -> float | None:
    text = normalize_time(value)
    if text in STATUS_CODES or text == "#VALUE!":
        return None
    match = re.fullmatch(r"(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?", text)
    if not match:
        return None
    hours, minutes, seconds, fraction = match.groups()
    total = int(hours) * 3600 + int(minutes) * 60 + int(seconds)
    if fraction:
        total += float(f"0.{fraction}")
    return total


def normalize_group(raw_title: str) -> tuple[str, str]:
    title = clean(raw_title).replace(" ", "")
    match = re.match(r"^(男子|女子)(公开|大师|卡胡纳)组(\d+)KM决赛成绩公示$", title)
    if not match:
        raise ValueError(f"无法识别成绩模块标题: {raw_title}")
    gender, group, distance = match.groups()
    gender_group = f"{group}{'男子' if gender == '男子' else '女子'}组"
    discipline = f"{int(distance)}公里"
    return gender_group, discipline


def parse_row(line: str, context: dict[str, str], status_index: int) -> tuple[dict[str, Any] | None, int]:
    text = clean(line)
    if not text or text.startswith(("名次 ", "赛序", "“桨动")):
        return None, status_index

    normal = re.match(r"^(?P<rank>\d{1,3})\s+(?P<bib>\d{3})\s+(?P<name>.+?)\s+(?P<finish>\d{1,2}:\d{1,2}:\d{1,2}(?:\.\d+)?)$", text)
    status = None
    needs_review = False
    if not normal:
        status = re.match(r"^(?P<bib>\d{3})\s+(?P<name>.+?)\s+(?P<finish>DNS|DNF|DQ|DSQ|#VALUE!)$", text, re.I)
    if not normal and not status:
        return None, status_index

    groups = normal.groupdict() if normal else status.groupdict()
    finish_time = normalize_time(groups["finish"])
    status_code = finish_time if finish_time in STATUS_CODES else None
    result_status_note = STATUS_LABELS.get(status_code or "")
    result_label = None
    review_status = "confirmed"
    is_verified = True

    if normal:
        rank_position = int(groups["rank"])
    else:
        status_index += 1
        rank_position = 9000 + status_index
        if finish_time == "#VALUE!":
            needs_review = True
            review_status = "needs_review"
            is_verified = False
            result_label = "#VALUE!"
            result_status_note = "原成绩为 #VALUE!，待人工核验"

    return {
        "athlete_name_snapshot": clean(groups["name"]),
        "bib_number": clean(groups["bib"]),
        "gender_group": context["gender_group"],
        "discipline": context["discipline"],
        "board_class": "桨板",
        "round_label": "决赛",
        "rank_position": rank_position,
        "result_label": result_label,
        "finish_time": finish_time,
        "result_status_code": status_code,
        "result_status_note": result_status_note,
        "time_seconds": parse_seconds(finish_time),
        "points": None,
        "team_name": "个人",
        "team_members": [],
        "nationality_snapshot": "中国",
        "source_locator": context["source_locator"],
        "source_note": f"{context['gender_group']} {context['discipline']} 决赛",
        "parse_confidence": 0.6 if needs_review else 0.99,
        "review_status": review_status,
        "is_verified": is_verified,
        "source_url": SOURCE_URL,
    }, status_index


def parse_pdf(path: Path) -> dict[str, Any]:
    reader = PdfReader(str(path))
    results: list[dict[str, Any]] = []
    current_context: dict[str, str] | None = None
    status_index_by_module: dict[tuple[str, str], int] = {}

    for page_number, page in enumerate(reader.pages, start=1):
        pending_line = ""
        for raw in (page.extract_text() or "").splitlines():
            line = clean(raw)
            if not line:
                continue
            if "成绩公示" in line:
                gender_group, discipline = normalize_group(line)
                current_context = {
                    "gender_group": gender_group,
                    "discipline": discipline,
                    "source_locator": f"page:{page_number}",
                }
                status_index_by_module.setdefault((gender_group, discipline), 0)
                continue
            if not current_context:
                continue
            if pending_line:
                line = clean(f"{pending_line} {line}")
                pending_line = ""
            key = (current_context["gender_group"], current_context["discipline"])
            row, status_index_by_module[key] = parse_row(line, current_context, status_index_by_module[key])
            if row:
                results.append(row)
            elif re.match(r"^\d{1,3}\s+\d{3}\s+", line):
                pending_line = line
            elif re.match(r"^(?:\d{1,3}\s+)?\d{3}\s+", line) and not line.startswith("名次 "):
                raise ValueError(f"疑似成绩行未解析 page:{page_number}: {line}")
        if pending_line:
            raise ValueError(f"跨行成绩未补齐 page:{page_number}: {pending_line}")

    return {
        "event": {
            "name": EVENT_NAME,
            "slug": EVENT_SLUG,
            "start_date": "2026-06-14",
            "end_date": "2026-06-14",
            "province": "浙江省",
            "city": "杭州市",
            "venue": "西溪湿地",
            "event_status": "completed",
            "result_status": "extended_complete",
            "source_scope": "用户提交成绩册导入",
            "result_source_note": "导入用户提交的2026杭州桨板系列赛-西溪湿地上午成人组成绩；PDF无积分列，仅录入成绩。",
        },
        "source": {
            "original_path": str(path),
            "file_name": DISPLAY_FILE_NAME,
            "file_type": "pdf",
            "source_url": SOURCE_URL,
            "result_submission_id": SUBMISSION_ID,
            "result_submission_batch_id": BATCH_ID,
            "parser_name": "parse-hangzhou-xixi-series-2026-results.py",
            "parser_status": "parsed",
            "parser_note": "解析12页成人组成绩；#VALUE! 行保留为后台待核验且不公开；无积分列。",
            "extracted_rows": len(results),
            "imported_rows": len(results),
            "metadata": {
                "source_kind": "result_submission",
                "result_submission_id": SUBMISSION_ID,
                "result_submission_batch_id": BATCH_ID,
                "page_count": len(reader.pages),
                "page_range": "1-12",
            },
        },
        "results": results,
    }


def validate_payload(payload: dict[str, Any]) -> None:
    seen_rows: set[tuple[str, str, str, str, str]] = set()
    rank_ones: dict[tuple[str, str, str, str], int] = {}
    for row in payload["results"]:
        key = (
            row["discipline"],
            row["gender_group"],
            row.get("round_label") or "",
            row.get("bib_number") or "",
            row["athlete_name_snapshot"],
        )
        if key in seen_rows:
            raise ValueError(f"重复成绩行: {key}")
        seen_rows.add(key)
        module = (row["discipline"], row["gender_group"], row.get("board_class") or "", row.get("round_label") or "")
        if row["rank_position"] == 1 and not row.get("result_status_code") and row.get("is_verified"):
            rank_ones[module] = rank_ones.get(module, 0) + 1
    bad = {key: value for key, value in rank_ones.items() if value != 1}
    if bad:
        raise ValueError(f"成绩模块第一名数量异常: {bad}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", type=Path, default=Path(".cache/result-submissions/mp_1781419973432_ofobbfxv/source.pdf"))
    parser.add_argument("-o", "--output", type=Path, default=Path(".cache/hangzhou-xixi-series-2026-results.json"))
    args = parser.parse_args()

    payload = parse_pdf(args.pdf)
    validate_payload(payload)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    modules = {
        (row["discipline"], row["gender_group"], row.get("round_label") or "")
        for row in payload["results"]
    }
    statuses: dict[str, int] = {}
    for row in payload["results"]:
        key = row.get("result_status_code") or ("NEEDS_REVIEW" if not row.get("is_verified") else "OK")
        statuses[key] = statuses.get(key, 0) + 1
    print(f"results={len(payload['results'])} modules={len(modules)} status={statuses} output={args.output}")


if __name__ == "__main__":
    main()
