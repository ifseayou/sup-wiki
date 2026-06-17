#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

from pypdf import PdfReader


EVENT_NAME = "第二届全国全民健身大赛（西北区陕西省）桨板比赛"
EVENT_SLUG = "national-fitness-shaanxi-sup-2026"
BATCH_ID = "mp_1780969858286_o27c9hxc"
SUBMISSION_ID = 29
SOURCE_URL = (
    "https://sport-hacker-assets.oss-cn-hangzhou.aliyuncs.com/"
    "sup-wiki/result-submissions/719/"
    "1780969859536-cqw72z-%E7%AC%AC%E4%BA%8C%E5%B1%8A%E5%85%A8%E5%9B%BD%E5%85%A8%E6%B0%91%E5%81%A5%E8%BA%AB%E5%A4%A7%E8%B5%9B-%E8%A5%BF%E5%8C%97%E5%8C%BA%E9%99%95%E8%A5%BF%E7%9C%81-%E6%A1%A8%E6%9D%BF%E6%AF%94%E8%B5%9B%E6%88%90%E7%BB%A9%E5%86%8C.pdf"
)
DISPLAY_FILE_NAME = "第二届全国全民健身大赛（西北区陕西省）桨板比赛成绩册.pdf"

STATUS_LABELS = {
    "DNS": "未出发",
    "DNF": "未完赛",
    "DQ": "取消成绩",
    "DSQ": "取消成绩",
}
STATUS_PATTERN = r"DNS|DNF|DQ|DSQ(?:-[A-Z]+)?"
TIME_PATTERN = r"\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?|\d{1,2}[′']\d{2}[″\"]\d+"
RESULT_PATTERN = rf"(?:{TIME_PATTERN}|{STATUS_PATTERN})"


def clean(value: Any) -> str:
    text = str(value or "").replace("：", ":").strip()
    return re.sub(r"\s+", " ", text)


def normalize_time(raw: str) -> str:
    text = clean(raw).upper().replace("'", "′").replace('"', "″")
    if re.fullmatch(STATUS_PATTERN, text):
        return text.split("-", 1)[0]
    quote_match = re.fullmatch(r"(\d{1,2})′(\d{2})″(\d+)", text)
    if quote_match:
        minutes, seconds, fraction = quote_match.groups()
        return f"00:{int(minutes):02d}:{int(seconds):02d}.{fraction}"
    if re.fullmatch(r"\d{1,2}:\d{2}\.\d+", text):
        minutes, rest = text.split(":", 1)
        seconds, fraction = rest.split(".", 1)
        return f"00:{int(minutes):02d}:{int(seconds):02d}.{fraction}"
    if re.fullmatch(r"\d{1,2}:\d{2}:\d{2}(?:\.\d+)?", text):
        hours, minutes, seconds = text.split(":", 2)
        return f"{int(hours):02d}:{int(minutes):02d}:{seconds}"
    if re.fullmatch(r"\d{1,2}:\d{2}", text):
        minutes, seconds = text.split(":", 1)
        return f"00:{int(minutes):02d}:{int(seconds):02d}"
    return text


def parse_seconds(finish_time: str) -> float | None:
    if not finish_time or finish_time in STATUS_LABELS:
        return None
    match = re.fullmatch(r"(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?", finish_time)
    if not match:
        return None
    hours, minutes, seconds, fraction = match.groups()
    total = int(hours) * 3600 + int(minutes) * 60 + int(seconds)
    if fraction:
        total += float(f"0.{fraction}")
    return total


def split_members(name: str) -> list[str]:
    return [part.strip() for part in clean(name).split("/") if part.strip()]


def normalize_group(raw_group: str) -> tuple[str, str]:
    text = clean(raw_group)
    text = re.sub(r"^\d+米耐力赛", "", text)
    text = text.replace("双人耐力赛", "双人")
    text = text.replace("双人混合耐力赛", "双人混合")
    text = text.replace("组组", "组")
    group_match = re.match(r"^(甲|乙|丙)组(.+)$", text)
    if group_match:
        grade, rest = group_match.groups()
        rest = rest.strip()
        heat = ""
        heat_match = re.search(r"第(\d+)组$", rest)
        if heat_match:
            heat = f"第{heat_match.group(1)}组"
            rest = rest[: -len(heat)].strip()
        if rest in {"男子", "男子组"}:
            return f"{grade}组男子组", heat
        if rest in {"女子", "女子组"}:
            return f"{grade}组女子组", heat
        if rest == "双人男子":
            return f"{grade}组双人男子组", heat
        if rest == "双人女子":
            return f"{grade}组双人女子组", heat
        if rest == "双人混合":
            return f"{grade}组双人混合组", heat
        return f"{grade}组{rest}", heat

    mixed_match = re.match(r"^双人混合(?:耐力赛)?(甲|乙|丙)组$", text)
    if mixed_match:
        return f"{mixed_match.group(1)}组双人混合组", ""
    double_match = re.match(r"^双人(?:耐力赛)?(甲|乙|丙)组(男子|女子)$", text)
    if double_match:
        grade, gender = double_match.groups()
        return f"{grade}组双人{gender}组", ""
    return text, ""


def page_context(text: str) -> dict[str, str]:
    title = next((clean(line) for line in text.splitlines() if "成绩单" in line), "")
    if not title:
        raise ValueError("missing title")
    info = re.search(r"组别:(.+?)\s+时间:(\d{4})/(\d{1,2})/(\d{1,2})\s+(\d{1,2}:\d{2})", text.replace("：", ":"))
    if not info:
        raise ValueError(f"missing page context: {title}")
    raw_group, year, month, day, clock = info.groups()
    gender_group, heat = normalize_group(raw_group)
    if "200米" in title:
        discipline = "200米竞速赛"
    elif "3000米" in title:
        discipline = "3000米耐力赛"
    else:
        raise ValueError(f"unknown discipline: {title}")
    round_label = "决赛"
    if "预决赛" in title:
        round_label = "预决赛"
    elif "预赛" in title:
        round_label = "预赛"
    if heat:
        round_label = f"{round_label}{heat}"
    return {
        "discipline": discipline,
        "gender_group": gender_group,
        "round_label": round_label,
        "date": f"{year}-{int(month):02d}-{int(day):02d}",
        "clock": clock,
        "source_note": f"{discipline} {gender_group} {round_label}",
    }


def is_result_row(line: str) -> bool:
    return bool(re.search(rf"\s(?:{RESULT_PATTERN})(?:\s+[A-Z])?$", clean(line), re.I))


def iter_rows(text: str) -> list[str]:
    rows: list[str] = []
    for raw in text.splitlines():
        line = clean(raw)
        if not line:
            continue
        if line.startswith(("第二届", "3000米长距离赛", "200米竞速赛", "赛序", "名次", "公示时间", "请在成绩", "裁判长")):
            continue
        if is_result_row(line):
            rows.append(line)
    return rows


def parse_row(line: str, context: dict[str, str], page_number: int, status_index: int) -> tuple[dict[str, Any], int]:
    text = clean(line)
    match = re.match(rf"^(?P<prefix>.+?)\s+(?P<finish>{RESULT_PATTERN})(?:\s+(?P<label>[A-Z]))?$", text, re.I)
    if not match:
        raise ValueError(f"cannot parse row page {page_number}: {line}")
    finish_raw = match.group("finish").upper()
    finish_time = normalize_time(finish_raw)
    status_code = None
    status_note = ""
    result_label = clean(match.group("label")) or None
    if re.fullmatch(STATUS_PATTERN, finish_raw):
        status_code = finish_raw.split("-", 1)[0]
        status_note = STATUS_LABELS.get(status_code, "")
        if "-" in finish_raw:
            result_label = finish_raw
            status_note = f"{status_note}（原文：{finish_raw}）"
    tokens = match.group("prefix").split()
    rank_position: int
    bib_number = ""
    athlete_name = ""

    if context["discipline"] == "200米竞速赛":
        if status_code:
            status_index += 1
            rank_position = 9000 + status_index
            if len(tokens) >= 3 and re.fullmatch(r"\d+", tokens[0]) and re.fullmatch(r"[A-Z]\d+(?:/[A-Z]\d+)*", tokens[1]):
                bib_number = tokens[1]
                athlete_name = "".join(tokens[2:])
            elif len(tokens) >= 4 and re.fullmatch(r"\d+", tokens[0]) and re.fullmatch(r"\d+", tokens[1]):
                bib_number = tokens[2]
                athlete_name = "".join(tokens[3:])
            elif len(tokens) >= 2:
                bib_number = tokens[0]
                athlete_name = "".join(tokens[1:])
        else:
            if len(tokens) < 4:
                raise ValueError(f"200m row missing columns page {page_number}: {line}")
            rank_position = int(tokens[0])
            bib_number = tokens[2]
            athlete_name = "".join(tokens[3:])
    else:
        if status_code:
            status_index += 1
            rank_position = 9000 + status_index
            if len(tokens) >= 3 and re.fullmatch(r"\d+", tokens[0]):
                bib_number = tokens[1]
                athlete_name = "".join(tokens[2:])
            elif len(tokens) >= 2:
                bib_number = tokens[0]
                athlete_name = "".join(tokens[1:])
        else:
            if len(tokens) < 3:
                raise ValueError(f"3000m row missing columns page {page_number}: {line}")
            rank_position = int(tokens[0])
            bib_number = tokens[1]
            athlete_name = "".join(tokens[2:])

    if not athlete_name or not bib_number:
        raise ValueError(f"row missing athlete/bib page {page_number}: {line}")

    return {
        "athlete_name_snapshot": athlete_name,
        "bib_number": bib_number,
        "gender_group": context["gender_group"],
        "discipline": context["discipline"],
        "board_class": "桨板",
        "round_label": context["round_label"],
        "rank_position": rank_position,
        "result_label": result_label,
        "finish_time": finish_time,
        "result_status_code": status_code,
        "result_status_note": status_note,
        "time_seconds": parse_seconds(finish_time),
        "points": None,
        "team_name": "个人",
        "team_members": split_members(athlete_name),
        "nationality_snapshot": "中国",
        "source_locator": f"page:{page_number}",
        "source_note": context["source_note"],
        "parse_confidence": 0.99,
        "review_status": "confirmed",
        "is_verified": True,
    }, status_index


def parse_pdf(path: Path) -> dict[str, Any]:
    reader = PdfReader(str(path))
    results: list[dict[str, Any]] = []
    dates: set[str] = set()
    for page_number, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        if not text.strip():
            continue
        context = page_context(text)
        dates.add(context["date"])
        status_index = 0
        page_rows = iter_rows(text)
        if not page_rows:
            raise ValueError(f"no rows parsed on page {page_number}")
        for row_text in page_rows:
            row, status_index = parse_row(row_text, context, page_number, status_index)
            row["source_url"] = SOURCE_URL
            results.append(row)

    start_date = min(dates) if dates else "2026-05-31"
    end_date = max(dates) if dates else start_date
    return {
        "event": {
            "name": EVENT_NAME,
            "slug": EVENT_SLUG,
            "start_date": start_date,
            "end_date": end_date,
            "province": "陕西省",
            "city": None,
            "venue": None,
            "event_status": "completed",
            "result_status": "extended_complete",
            "star_level": "三星",
            "score_coefficient": 3.0,
            "source_scope": "用户提交成绩册导入",
            "result_source_note": "导入用户提交的第二届全国全民健身大赛（西北区陕西省）桨板比赛成绩册；积分列为空，本次仅录入成绩。",
        },
        "source": {
            "original_path": str(path),
            "file_name": DISPLAY_FILE_NAME,
            "file_type": "pdf",
            "source_url": SOURCE_URL,
            "result_submission_id": SUBMISSION_ID,
            "result_submission_batch_id": BATCH_ID,
            "parser_name": "parse-national-fitness-shaanxi-2026-results.py",
            "parser_status": "parsed",
            "parser_note": "解析第2-33页成绩单；第1页和第34页为空白；积分列为空未导入积分。",
            "extracted_rows": len(results),
            "imported_rows": len(results),
            "metadata": {
                "source_kind": "result_submission",
                "result_submission_id": SUBMISSION_ID,
                "result_submission_batch_id": BATCH_ID,
                "page_count": len(reader.pages),
                "page_range": "2-33",
            },
        },
        "results": results,
    }


def validate_payload(payload: dict[str, Any]) -> None:
    modules: dict[tuple[str, str, str, str], list[dict[str, Any]]] = {}
    duplicate_rows: set[tuple[str, str, str, str, str, str]] = set()
    seen_rows: set[tuple[str, str, str, str, str, str]] = set()
    for row in payload["results"]:
        key = (row["discipline"], row["gender_group"], row.get("board_class") or "", row.get("round_label") or "")
        modules.setdefault(key, []).append(row)
        row_key = (
            row["discipline"],
            row["gender_group"],
            row.get("round_label") or "",
            row["athlete_name_snapshot"],
            row.get("bib_number") or "",
            row["finish_time"],
        )
        if row_key in seen_rows:
            duplicate_rows.add(row_key)
        seen_rows.add(row_key)
    if duplicate_rows:
        raise ValueError(f"duplicate result rows: {sorted(duplicate_rows)[:5]}")
    bad_modules = []
    for key, rows in modules.items():
        normal_rank_ones = [row for row in rows if row["rank_position"] == 1 and not row.get("result_status_code")]
        if len(normal_rank_ones) > 1:
            bad_modules.append((key, len(normal_rank_ones)))
    if bad_modules:
        raise ValueError(f"duplicate normal rank 1 modules: {bad_modules}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", type=Path, default=Path(".cache/result-submissions/mp_1780969858286_o27c9hxc/results-book.pdf"))
    parser.add_argument("-o", "--output", type=Path, default=Path(".cache/national-fitness-shaanxi-sup-2026-results.json"))
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
        key = row.get("result_status_code") or "OK"
        statuses[key] = statuses.get(key, 0) + 1
    print(f"results={len(payload['results'])} modules={len(modules)} status={statuses} output={args.output}")


if __name__ == "__main__":
    main()
