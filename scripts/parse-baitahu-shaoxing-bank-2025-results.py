#!/usr/bin/env python3
import argparse
import json
import re
from pathlib import Path
from typing import Any

from pypdf import PdfReader


EVENT_NAME = "2025“绍兴银行杯”白塔湖湿地皮划艇桨板马拉松邀请赛"
EVENT_SLUG = "shaoxing-bank-cup-baitahu-sup-marathon-2025"
PDF_PATH = Path("/Users/xhl/Downloads/桨板赛事/20251026绍兴银行杯 白塔胡湿地公园皮划艇桨板邀请赛/2025“绍兴银行杯”白塔湖湿地皮划艇桨板马拉松邀请赛成绩公示.pdf")
PUBLIC_DIR = "20251026绍兴银行杯 白塔湖湿地皮划艇桨板马拉松邀请赛"
FILE_NAME = "2025“绍兴银行杯”白塔湖湿地皮划艇桨板马拉松邀请赛成绩公示.pdf"

STATUS_LABELS = {
    "DNS": "未出发",
    "DNF": "未完赛",
    "DQ": "取消成绩",
    "DSQ": "取消成绩",
}
STATUS_CODES = set(STATUS_LABELS)


def clean(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def status_code(value: str) -> str | None:
    code = clean(value).upper()
    return code if code in STATUS_CODES else None


def normalize_time(value: str) -> str:
    text = clean(value).upper().replace("：", ":")
    return text


def time_seconds(value: str) -> float | None:
    text = normalize_time(value)
    if status_code(text):
        return None
    match = re.fullmatch(r"(\d+):(\d{2})'(\d{2})\"(\d{2})", text)
    if not match:
        return None
    hours, minutes, seconds, hundredths = match.groups()
    return int(hours) * 3600 + int(minutes) * 60 + int(seconds) + int(hundredths) / 100


def normalize_group(raw: str) -> tuple[str, str]:
    text = clean(raw)
    match = re.fullmatch(r"(.+?)(\d+(?:\.\d+)?)公里", text)
    if not match:
        raise ValueError(f"Invalid group title: {raw}")
    group, distance = match.groups()
    group = group.replace("男子桨板精英组", "男子桨板精英组")
    return group, f"{distance}公里"


def is_single_cjk_token(value: str) -> bool:
    return bool(re.fullmatch(r"[\u4e00-\u9fff]", value))


def split_name_team(rest: str) -> tuple[str, str]:
    tokens = clean(rest).split()
    if len(tokens) < 2:
        raise ValueError(f"Cannot split name/team: {rest}")
    if re.fullmatch(r"[\u4e00-\u9fff]{2,4}", tokens[0]):
        return tokens[0], clean(" ".join(tokens[1:])) or "个人"

    name_parts: list[str] = []
    index = 0
    while index < len(tokens) and is_single_cjk_token(tokens[index]) and len(name_parts) < 3:
        if len(name_parts) >= 2 and tokens[index] in {"个人", "无"}:
            break
        name_parts.append(tokens[index])
        index += 1
        if index < len(tokens) and not is_single_cjk_token(tokens[index]):
            break
    if not name_parts or index >= len(tokens):
        return tokens[0], clean(" ".join(tokens[1:])) or "个人"
    return "".join(name_parts), clean(" ".join(tokens[index:])) or "个人"


def parse_row(line: str, group: str, discipline: str, page_number: int, status_index: int) -> tuple[dict[str, Any] | None, int]:
    match = re.match(r"^(?:(\d{1,3})\s+)?(\d{3})\s+(.+?)\s+(\d+:\d{2}'\d{2}\"\d{2}|DNS|DNF|DQ|DSQ)(?:\s+(.*))?$", line, re.I)
    if not match:
        return None, status_index
    rank_raw, bib_number, rest, finish_raw, note = match.groups()
    finish = normalize_time(finish_raw)
    code = status_code(finish)
    if rank_raw:
        rank = int(rank_raw)
    else:
        status_index += 1
        rank = 9000 + status_index
    athlete_name, team_name = split_name_team(rest)
    return {
        "athlete_name_snapshot": athlete_name,
        "bib_number": bib_number,
        "gender_group": group,
        "discipline": discipline,
        "board_class": "桨板",
        "round_label": "决赛",
        "rank_position": rank,
        "result_label": clean(note) or None,
        "finish_time": finish,
        "result_status_code": code,
        "result_status_note": STATUS_LABELS.get(code or ""),
        "time_seconds": time_seconds(finish),
        "points": None,
        "team_name": team_name,
        "team_members": [],
        "source_locator": f"page:{page_number}",
        "source_note": f"{group} {discipline}",
        "parse_confidence": 0.99,
        "review_status": "confirmed",
    }, status_index


def parse_pdf(path: Path) -> dict[str, Any]:
    reader = PdfReader(str(path))
    results: list[dict[str, Any]] = []
    current_group = ""
    current_discipline = ""
    status_index_by_group: dict[str, int] = {}
    for page_number, page in enumerate(reader.pages, start=1):
        if page_number < 9 or page_number > 15:
            continue
        for raw in (page.extract_text() or "").splitlines():
            line = clean(raw)
            if not line or line.startswith(("2025“", "成绩公示", "名次 ")):
                continue
            if line.startswith("组别："):
                title = clean(line.replace("组别：", ""))
                if "桨板" not in title:
                    current_group = ""
                    current_discipline = ""
                    continue
                current_group, current_discipline = normalize_group(title)
                status_index_by_group.setdefault(current_group, 0)
                continue
            if not current_group:
                continue
            parsed, status_index_by_group[current_group] = parse_row(
                line,
                current_group,
                current_discipline,
                page_number,
                status_index_by_group[current_group],
            )
            if parsed:
                results.append(parsed)
            elif re.search(r"\d{3}", line):
                raise ValueError(f"Unparsed SUP row on page {page_number}: {line}")

    return {
        "event": {
            "name": EVENT_NAME,
            "slug": EVENT_SLUG,
            "start_date": "2025-10-26",
            "end_date": "2025-10-26",
            "province": "浙江省",
            "city": "绍兴市",
            "venue": "白塔湖湿地公园",
            "event_status": "completed",
            "result_status": "extended_complete",
            "source_scope": "本地成绩公示导入",
            "result_source_note": "仅录入白塔湖湿地皮划艇桨板马拉松邀请赛成绩公示中的桨板组别明细。",
        },
        "source": {
            "original_path": str(path),
            "file_name": FILE_NAME,
            "file_type": "pdf",
            "source_url": f"/result-books/{PUBLIC_DIR}/{FILE_NAME}",
            "parser_name": "parse-baitahu-shaoxing-bank-2025-results.py",
            "parser_status": "parsed",
            "parser_note": "白塔湖成绩公示仅抽取桨板组别，第9-15页明细；第16页前三摘要不重复录入。",
            "extracted_rows": len(results),
            "imported_rows": len(results),
            "metadata": {
                "source_kind": "local_result_book",
                "relative_path": f"{PUBLIC_DIR}/{FILE_NAME}",
                "event_key": EVENT_SLUG,
                "page_range": "9-15",
                "excluded_pages": "1-8皮艇,16前三摘要",
            },
        },
        "results": results,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("-o", "--output", type=Path, default=Path(".cache/baitahu-shaoxing-bank-2025-results.json"))
    args = parser.parse_args()
    payload = parse_pdf(PDF_PATH)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"results={len(payload['results'])} output={args.output}")


if __name__ == "__main__":
    main()
