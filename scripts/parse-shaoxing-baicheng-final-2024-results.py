#!/usr/bin/env python3
"""Parse 2024 China Baicheng SUP Open Final Shaoxing result sheets."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any
from urllib.parse import quote

import pdfplumber


EVENT_NAME = "2024中国百城桨板公开赛总决赛绍兴站"
EVENT_SLUG = "china-baicheng-sup-open-final-shaoxing-2024"
ORIGINAL_DIR = Path("/Users/xhl/Downloads/桨板赛事/20241123 中国百城桨板公开赛总决赛绍兴站")
PUBLIC_BOOK_DIR_NAME = "20241123 中国百城桨板公开赛总决赛绍兴站"
PUBLIC_FILE_NAME_OVERRIDES = {
    "公开组男子-竞速赛决赛-成绩单.pdf": "公开组男子-竞速赛决赛-成绩单(1).pdf",
}

STATUS_LABELS = {
    "DNS": "未出发",
    "DNF": "未完赛",
    "DSQ": "取消成绩",
    "DQ": "取消成绩",
}
STATUS_CODES = set(STATUS_LABELS)


def clean(value: Any) -> str:
    text = str(value or "").strip()
    text = text.replace("（", "(").replace("）", ")")
    return re.sub(r"\s+", " ", text)


def normalize_joined_text(value: str) -> str:
    text = clean(value)
    previous = None
    while previous != text:
        previous = text
        text = re.sub(r"(?<=[\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff])", "", text)
    return (
        text.replace("有限公 司", "有限公司")
        .replace("发展有限公 司", "发展有限公司")
        .replace("服务有限公 司", "服务有限公司")
    )


def normalize_group(value: str) -> str:
    text = clean(value)
    replacements = {
        "公开组男子": "公开男子组",
        "公开组女子": "公开女子组",
        "大师组男子": "大师男子组",
        "大师组女子": "大师女子组",
    }
    return replacements.get(text, text)


def normalize_time(value: str) -> str:
    text = clean(value).upper().rstrip(".")
    return text


def status_code(value: str) -> str | None:
    text = clean(value).upper()
    return text if text in STATUS_CODES else None


def status_note(code: str | None) -> str | None:
    return STATUS_LABELS.get(code or "")


def parse_title(line: str) -> dict[str, Any] | None:
    match = re.search(r"NO\.\d+\s+200米竞速赛(.+?)决赛\s+时间：([\d/]+\s+\d{1,2}:\d{2})", clean(line), re.I)
    if not match:
        return None
    return {
        "discipline": "200米",
        "gender_group": normalize_group(match.group(1)),
        "board_class": None,
        "round_label": "决赛",
        "race_time": match.group(2),
    }


def source_url(file_name: str) -> str:
    public_file_name = PUBLIC_FILE_NAME_OVERRIDES.get(file_name, file_name)
    return f"/result-books/{quote(PUBLIC_BOOK_DIR_NAME, safe='')}/{quote(public_file_name, safe='')}"


def split_name_team(prefix: str) -> tuple[str, str] | None:
    text = clean(prefix)
    if " MOLOKAI" in text:
        return text.replace(" MOLOKAI", "").strip(), "MOLOKAI"
    if " OceanStar" in text:
        name, team = text.split(" OceanStar", 1)
        return name.strip(), normalize_joined_text(f"OceanStar{team}")
    for team_prefix, team_name in {
        "上海浪浪桨板俱乐部": "上海浪浪桨板俱乐部（上海动欢体育服务有限公司）",
    }.items():
        index = text.find(team_prefix)
        if index > 0:
            return text[:index].strip(), team_name
    parts = text.split(" ", 1)
    if not parts or not parts[0]:
        return None
    return parts[0], normalize_joined_text(parts[1] if len(parts) > 1 else "个人")


def split_finish_tail(text: str) -> tuple[str, str, str | None] | None:
    match = re.search(r"\s(DNS|DNF|DSQ|DQ|\d{2}:\d{2}\.\d{3})(?:\s+(.+))?$", clean(text), re.I)
    if not match:
        return None
    prefix = text[: match.start()].strip()
    finish_time = normalize_time(match.group(1))
    note = clean(match.group(2)) or None
    return prefix, finish_time, note


def make_result(
    context: dict[str, Any],
    *,
    page_number: int,
    rank_position: int,
    bib_number: str,
    round_label: str,
    athlete_name: str,
    team_name: str,
    finish_time: str,
    result_label: str | None = None,
) -> dict[str, Any]:
    code = status_code(finish_time)
    return {
        "athlete_name_snapshot": athlete_name,
        "bib_number": bib_number,
        "gender_group": context["gender_group"],
        "discipline": context["discipline"],
        "board_class": context.get("board_class"),
        "round_label": round_label,
        "rank_position": rank_position,
        "result_label": result_label,
        "finish_time": finish_time,
        "result_status_code": code,
        "result_status_note": status_note(code),
        "team_name": team_name or "个人",
        "team_members": [],
        "points": None,
        "source_locator": f"page:{page_number}",
        "parse_confidence": 0.97,
        "review_status": "confirmed",
        "is_verified": True,
        "source_note": "2024中国百城桨板公开赛总决赛绍兴站竞速赛成绩单解析导入；积分页未录入。",
    }


def parse_result_line(line: str, context: dict[str, Any], page_number: int, status_order: int) -> tuple[dict[str, Any] | None, int]:
    text = clean(line)
    match = re.match(r"^(\d{1,3}|DNS|DNF|DSQ|DQ)\s+(.+)$", text, re.I)
    if not match:
        return None, status_order

    rank_token = match.group(1).upper()
    parts = match.group(2).split(" ", 2)
    if len(parts) < 3:
        return None, status_order

    lane_or_round = parts[0]
    bib_number = parts[1]
    tail = parts[2]
    round_label = "预赛" if lane_or_round == "预赛" else context.get("round_label", "决赛")

    split = split_finish_tail(tail)
    if not split:
        return None, status_order
    prefix, finish_time, note = split
    name_team = split_name_team(prefix)
    if not name_team:
        return None, status_order
    athlete_name, team_name = name_team

    if rank_token.isdigit():
        rank_position = int(rank_token)
    else:
        status_order += 1
        rank_position = 9000 + status_order

    result_label = None if not note else ("预赛组别 " + note if note.isdigit() else note)
    return (
        make_result(
            context,
            page_number=page_number,
            rank_position=rank_position,
            bib_number=bib_number,
            round_label=round_label,
            athlete_name=athlete_name,
            team_name=team_name,
            finish_time=finish_time,
            result_label=result_label,
        ),
        status_order,
    )


def parse_pdf(path: Path) -> dict[str, Any]:
    results: list[dict[str, Any]] = []
    page_counts: dict[str, int] = {}
    status_order = 0
    context: dict[str, Any] | None = None

    with pdfplumber.open(str(path)) as pdf:
        for page_number, page in enumerate(pdf.pages, 1):
            text = page.extract_text(x_tolerance=2, y_tolerance=3) or ""
            lines = [clean(line) for line in text.splitlines() if clean(line)]
            for line in lines[:5]:
                found = parse_title(line)
                if found:
                    context = found
                    break
            if not context:
                continue

            for line in lines:
                if line.startswith(("竞速赛-成绩单", "NO.", "名次 ")):
                    continue
                item, status_order = parse_result_line(line, context, page_number, status_order)
                if item:
                    results.append(item)
                    page_counts[str(page_number)] = page_counts.get(str(page_number), 0) + 1

    return {
        "event": {
            "name": EVENT_NAME,
            "slug": EVENT_SLUG,
            "province": "浙江省",
            "city": "绍兴市",
            "venue": "绍兴",
            "start_date": "2024-11-23",
            "end_date": "2024-11-24",
            "source_scope": "本地成绩单导入",
            "result_source_note": "由4份竞速赛成绩单导入；团体积分文件未录入。",
        },
        "source": {
            "file_name": path.name,
            "file_type": "pdf",
            "source_url": source_url(path.name),
            "original_path": str(path),
            "parser_name": Path(__file__).name,
            "parser_note": "2024中国百城桨板公开赛总决赛绍兴站竞速赛成绩单解析导入；只导入成绩，不导入积分。",
            "extracted_rows": len(results),
            "metadata": {
                "page_counts": page_counts,
                "excluded_files": ["团体积分.pdf"],
            },
        },
        "results": results,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", type=Path, default=ORIGINAL_DIR)
    parser.add_argument("--output", type=Path, required=True)
    return parser.parse_args()


def validate(payloads: list[dict[str, Any]]) -> None:
    expected = {
        "公开女子组": 25,
        "公开男子组": 44,
        "大师女子组": 22,
        "大师男子组": 48,
    }
    counts: dict[str, int] = {}
    for payload in payloads:
        if "积分" in payload["source"]["file_name"]:
            raise ValueError("points source must not be imported")
        for row in payload["results"]:
            if row["points"] is not None:
                raise ValueError("points must be null")
            counts[row["gender_group"]] = counts.get(row["gender_group"], 0) + 1
            if row["finish_time"] == "DNS" and row["result_status_code"] != "DNS":
                raise ValueError("DNS row missing status code")
    if counts != expected:
        raise ValueError(f"unexpected group counts: {counts}")


def main() -> None:
    args = parse_args()
    files = sorted(path for path in args.input_dir.glob("*.pdf") if "积分" not in path.name)
    payloads = [parse_pdf(path) for path in files]
    validate(payloads)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payloads, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"parsed {sum(len(item['results']) for item in payloads)} results from {len(payloads)} sources -> {args.output}")


if __name__ == "__main__":
    main()
