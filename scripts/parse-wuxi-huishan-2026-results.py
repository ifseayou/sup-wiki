#!/usr/bin/env python3
import argparse
import json
import re
from pathlib import Path
from typing import Any

from pypdf import PdfReader


EVENT_NAME = "2026“水运江苏”桨板赛（无锡惠山站）"
EVENT_SLUG = "water-jiangsu-sup-wuxi-huishan-2026"
BASE_DIR = Path("/Users/xhl/Desktop/桨板比赛成绩/2026水运江苏桨板赛（无锡惠山站）")
PUBLIC_DIR = "20260524水运江苏桨板赛无锡惠山站"

FILES = [
    {
        "file_name": "3公里公开组男子决赛成绩表.pdf",
        "discipline": "3公里",
        "gender_group": "公开组男子",
        "round_label": "决赛",
        "source_note": "3公里绕标（公开组）决赛 男子组",
    },
    {
        "file_name": "3公里大师组男子决赛成绩表.pdf",
        "discipline": "3公里",
        "gender_group": "大师组男子",
        "round_label": "决赛",
        "source_note": "3公里绕标（大师组）决赛 男子组",
    },
    {
        "file_name": "3公里女子大师组决赛成绩单.pdf",
        "discipline": "3公里",
        "gender_group": "大师组女子",
        "round_label": "决赛",
        "source_note": "3公里绕标（大师组）决赛 女子组",
    },
    {
        "file_name": "3公里青少年决赛成绩表.pdf",
        "discipline": "3公里",
        "gender_group": "青少年组",
        "round_label": "决赛",
        "source_note": "3公里绕标 决赛 青少年组",
    },
    {
        "file_name": "200男子预赛成绩.pdf",
        "discipline": "200米",
        "gender_group": "男子组",
        "round_label": "预赛",
        "source_note": "200米竞速赛 预赛 男子",
    },
    {
        "file_name": "200女子预赛成绩.pdf",
        "discipline": "200米",
        "gender_group": "女子组",
        "round_label": "预赛",
        "source_note": "200米竞速赛 预赛 女子",
    },
]

STATUS_LABELS = {
    "DNS": "未出发",
    "DNF": "未完赛",
    "DQ": "取消成绩",
    "DSQ": "取消成绩",
}


def clean(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def normalize_name(value: str) -> str:
    return clean(value).replace(" ", "")


def status_code(value: str) -> str | None:
    code = clean(value).upper()
    return code if code in STATUS_LABELS else None


def normalize_time(value: str) -> str:
    text = clean(value).upper()
    text = text.replace("：", ":").replace("′", "'").replace("’", "'")
    text = text.replace("“", '"').replace("”", '"').replace("″", '"')
    text = re.sub(r"\s+", "", text)
    match = re.fullmatch(r"(\d{1,2})'(\d{2})\"?(\d{1,3})?", text)
    if match:
        minutes, seconds, fraction = match.groups()
        if fraction:
            fraction = fraction[:3].ljust(3, "0")
            return f"00:{int(minutes):02d}:{int(seconds):02d}.{fraction}"
        return f"00:{int(minutes):02d}:{int(seconds):02d}"
    return text


def time_seconds(value: str) -> float | None:
    text = normalize_time(value)
    if status_code(text):
        return None
    match = re.fullmatch(r"(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?", text)
    if not match:
        return None
    hours, minutes, seconds, millis = match.groups()
    return int(hours) * 3600 + int(minutes) * 60 + int(seconds) + (int((millis or "0").ljust(3, "0")) / 1000)


def is_noise(line: str) -> bool:
    return (
        not line
        or line.startswith("2026“水运江苏”")
        or line in {"成绩单", "裁判长签名：", "裁判长签字：", "总裁判长签字："}
        or line.startswith("赛序")
        or line.startswith("成绩单")
        or line.startswith("名次 ")
        or line.startswith("/*")
    )


def parse_result_line(line: str, rank_cursor: int, status_cursor: int) -> tuple[dict[str, Any] | None, int, int]:
    finish_match = re.search(r"((?:\d{1,2}[’'′]\d{2}[“\"”″]?\s*\d{0,3})|DNS|DNF|DQ|DSQ)\s*$", line, re.I)
    if not finish_match:
        return None, rank_cursor, status_cursor
    finish_raw = finish_match.group(1)
    before = clean(line[:finish_match.start()])
    parts = before.split(" ")
    if len(parts) < 2:
        return None, rank_cursor, status_cursor

    rank: int | None = None
    bib_number = parts[0]
    name_parts = parts[1:]
    if len(parts) >= 3 and parts[0].isdigit() and parts[1].isdigit():
        rank = int(parts[0])
        bib_number = parts[1]
        name_parts = parts[2:]
    elif parts[0].isdigit():
        rank_cursor += 1
        rank = rank_cursor
    name = normalize_name("".join(name_parts))
    if not name or not bib_number.isdigit():
        return None, rank_cursor, status_cursor

    finish = normalize_time(finish_raw)
    code = status_code(finish)
    if code:
        status_cursor += 1
        rank = 9000 + status_cursor
    elif rank is None:
        rank_cursor += 1
        rank = rank_cursor
    else:
        rank_cursor = max(rank_cursor, rank)

    return {
        "athlete_name_snapshot": name,
        "bib_number": bib_number,
        "rank_position": rank,
        "finish_time": finish,
        "result_status_code": code,
        "result_status_note": STATUS_LABELS.get(code or ""),
        "time_seconds": time_seconds(finish),
    }, rank_cursor, status_cursor


def parse_file(config: dict[str, Any]) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    path = BASE_DIR / config["file_name"]
    reader = PdfReader(str(path))
    rows: list[dict[str, Any]] = []
    rank_cursor = 0
    status_cursor = 0
    source_key = config["file_name"]

    for page_number, page in enumerate(reader.pages, start=1):
        for raw in (page.extract_text() or "").splitlines():
            line = clean(raw)
            if is_noise(line):
                continue
            parsed, rank_cursor, status_cursor = parse_result_line(line, rank_cursor, status_cursor)
            if not parsed:
                if re.search(r"(DNS|DNF|DQ|DSQ|\d{1,2}[’'′]\d{2})", line, re.I):
                    raise ValueError(f"Unparsed row in {config['file_name']} page {page_number}: {line}")
                continue
            parsed.update({
                "gender_group": config["gender_group"],
                "discipline": config["discipline"],
                "board_class": "桨板",
                "round_label": config["round_label"],
                "result_label": None,
                "points": None,
                "team_name": "个人",
                "team_members": [],
                "source_key": source_key,
                "source_locator": f"page:{page_number}",
                "source_note": config["source_note"],
                "parse_confidence": 0.99,
                "review_status": "confirmed",
            })
            rows.append(parsed)

    source = {
        "source_key": source_key,
        "original_path": str(path),
        "file_name": config["file_name"],
        "file_type": "pdf",
        "source_url": f"/result-books/{PUBLIC_DIR}/{config['file_name']}",
        "parser_name": "parse-wuxi-huishan-2026-results.py",
        "parser_status": "parsed",
        "parser_note": config["source_note"],
        "extracted_rows": len(rows),
        "imported_rows": len(rows),
        "metadata": {
            "source_kind": "local_result_book",
            "relative_path": f"{PUBLIC_DIR}/{config['file_name']}",
            "event_key": EVENT_SLUG,
            "page_count": len(reader.pages),
        },
    }
    return source, rows


def parse_all() -> dict[str, Any]:
    sources = []
    results = []
    for config in FILES:
        source, rows = parse_file(config)
        sources.append(source)
        results.extend(rows)

    return {
        "event": {
            "name": EVENT_NAME,
            "slug": EVENT_SLUG,
            "start_date": "2026-05-24",
            "end_date": "2026-05-24",
            "province": "江苏省",
            "city": "无锡市",
            "venue": "无锡惠山",
            "event_status": "completed",
            "result_status": "extended_complete",
            "source_scope": "本地成绩册导入",
            "result_source_note": "录入2026“水运江苏”桨板赛（无锡惠山站）6份PDF成绩册，含200米预赛和3公里各组决赛。",
        },
        "sources": sources,
        "results": results,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("-o", "--output", type=Path, default=Path(".cache/wuxi-huishan-2026-results.json"))
    args = parser.parse_args()
    payload = parse_all()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"sources={len(payload['sources'])} results={len(payload['results'])} output={args.output}")


if __name__ == "__main__":
    main()
