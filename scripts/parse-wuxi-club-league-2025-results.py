#!/usr/bin/env python3
"""Parse 2025 中国桨板俱乐部联赛无锡站 scanned result pages."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

import fitz
from rapidocr_onnxruntime import RapidOCR


EVENT_ID = 280
SOURCE_ID = 341
EVENT_NAME = "中国桨板俱乐部联赛无锡站"
SOURCE_URL = "/result-books/20250707期 中国桨板俱乐部联赛无锡站/2025中国桨板俱乐部联赛无锡站成绩册.pdf"
ORIGINAL_PATH = "/Users/xhl/Downloads/桨板赛事/20250707期 中国桨板俱乐部联赛无锡站/2025中国桨板俱乐部联赛无锡站成绩册.pdf"
FIRST_RESULT_PAGE = 20
LAST_RESULT_PAGE = 50

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
    text = text.replace("：", ":").replace("．", ".")
    text = text.replace("奖板", "桨板").replace("醬板", "桨板")
    text = text.replace("義桨纵横", "义桨纵横").replace("羲桨纵横", "义桨纵横")
    text = text.replace("上海果体育", "上海槊果体育")
    return re.sub(r"\s+", " ", text)


def status_code(value: str) -> str | None:
    text = clean(value).upper()
    return text if text in STATUS_CODES else None


def normalize_time(value: str) -> str:
    text = clean(value).upper()
    text = text.replace("O", "0").replace("：", ":")
    if text in STATUS_CODES:
        return text
    match = re.fullmatch(r"(\d{1,2}):(\d{2}):(\d{2})\.(\d{2})", text)
    if match:
        return f"{int(match.group(1)):02d}:{match.group(2)}:{match.group(3)}.{match.group(4)}"
    match = re.fullmatch(r"(\d{1,2}):(\d{2})\.(\d{2})", text)
    if match:
        return f"{int(match.group(1)):02d}:{match.group(2)}.{match.group(3)}"
    return text


def is_time_or_status(value: str) -> bool:
    text = normalize_time(value)
    return bool(status_code(text) or re.fullmatch(r"\d{1,2}:\d{2}(?::\d{2})?\.\d{2}", text))


def normalize_group(value: str) -> str:
    text = clean(value)
    text = text.replace("青少年组", "").replace("青少年", "")
    text = text.replace("卡胡纳组男子", "卡胡纳男子组")
    text = text.replace("卡胡纳组女子", "卡胡纳女子组")
    text = text.replace("大师组男子", "大师男子组")
    text = text.replace("大师组女子", "大师女子组")
    text = text.replace("公开组男子", "公开男子组")
    text = text.replace("公开组女子", "公开女子组")
    text = text.replace("高校组男子", "高校男子组")
    text = text.replace("高校组女子", "高校女子组")
    match = re.fullmatch(r"U(\d+)(男子|女子)", text, re.I)
    if match:
        return f"U{match.group(1)}组{match.group(2)}"
    return text


def text_in(items: list[dict[str, Any]], left: float, right: float) -> str:
    parts = [item["text"] for item in items if left <= item["cx"] < right]
    return clean("".join(parts))


def first_text_in(items: list[dict[str, Any]], left: float, right: float) -> str:
    for item in items:
        if left <= item["cx"] < right:
            return clean(item["text"])
    return ""


def make_result(
    context: dict[str, Any],
    *,
    page_number: int,
    rank_position: int,
    bib_number: str | None,
    athlete_name: str,
    team_name: str,
    finish_time: str,
    result_label: str | None = None,
    team_members: list[str] | None = None,
    source_note: str | None = None,
    confidence: float = 0.94,
) -> dict[str, Any]:
    finish = normalize_time(finish_time)
    code = status_code(finish)
    return {
        "athlete_name_snapshot": clean(athlete_name),
        "bib_number": clean(bib_number),
        "gender_group": context["gender_group"],
        "discipline": context["discipline"],
        "board_class": context.get("board_class"),
        "round_label": context.get("round_label") or "决赛",
        "rank_position": rank_position,
        "result_label": clean(result_label) or None,
        "finish_time": finish,
        "result_status_code": code,
        "result_status_note": STATUS_LABELS.get(code),
        "time_seconds": None,
        "points": None,
        "team_name": clean(team_name) or "个人",
        "team_members": team_members or [],
        "source_locator": f"page:{page_number}",
        "source_note": source_note or context["source_note"],
        "parse_confidence": confidence,
        "review_status": "confirmed",
    }


def ocr_page(doc: fitz.Document, page_number: int, cache_dir: Path, ocr: RapidOCR) -> list[dict[str, Any]]:
    cache_dir.mkdir(parents=True, exist_ok=True)
    json_path = cache_dir / f"page-{page_number:03d}.json"
    if json_path.exists():
        return json.loads(json_path.read_text(encoding="utf-8"))

    image_path = cache_dir / f"page-{page_number:03d}.png"
    if not image_path.exists():
        pix = doc[page_number - 1].get_pixmap(matrix=fitz.Matrix(2.5, 2.5), alpha=False)
        pix.save(str(image_path))

    result, _ = ocr(str(image_path))
    rows: list[dict[str, Any]] = []
    for box, text, score in result or []:
        xs = [point[0] for point in box]
        ys = [point[1] for point in box]
        item = {
            "x0": min(xs),
            "y0": min(ys),
            "x1": max(xs),
            "y1": max(ys),
            "cx": (min(xs) + max(xs)) / 2,
            "cy": (min(ys) + max(ys)) / 2,
            "text": clean(text),
            "score": float(score),
        }
        if item["text"]:
            rows.append(item)
    rows.sort(key=lambda item: (item["cy"], item["cx"]))
    json_path.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    return rows


def group_lines(items: list[dict[str, Any]]) -> list[list[dict[str, Any]]]:
    body = [item for item in items if 250 <= item["cy"] <= 1600]
    lines: list[list[dict[str, Any]]] = []
    for item in sorted(body, key=lambda value: (value["cy"], value["cx"])):
        if not lines or abs(lines[-1][0]["cy"] - item["cy"]) > 18:
            lines.append([item])
        else:
            lines[-1].append(item)
    return [sorted(line, key=lambda value: value["cx"]) for line in lines]


def context_from_page(items: list[dict[str, Any]], page_number: int) -> dict[str, Any] | None:
    title_text = clean(" ".join(item["text"] for item in items if 120 <= item["cy"] <= 310))
    if "团队龙板赛" in title_text:
        return {
            "discipline": "团队龙板赛",
            "gender_group": "公开组",
            "board_class": "龙板",
            "round_label": "总成绩",
            "kind": "team",
            "source_note": f"无锡站成绩册第{page_number}页 团队龙板赛",
        }

    long_match = re.search(r"长距离赛\s*([36])\s*km\s*(.+?)(?:\s|$)", title_text, re.I)
    if long_match:
        group = normalize_group(long_match.group(2))
        return {
            "discipline": f"{long_match.group(1)}公里",
            "gender_group": group,
            "board_class": "卡胡纳" if "卡胡纳" in group else None,
            "round_label": "决赛",
            "kind": "long",
            "source_note": f"无锡站成绩册第{page_number}页 {long_match.group(0)}",
        }

    sprint_match = re.search(r"200米竞速赛\s*(.+?)(?:\s|$)", title_text)
    if sprint_match:
        group = normalize_group(sprint_match.group(1))
        return {
            "discipline": "200米",
            "gender_group": group,
            "board_class": "卡胡纳" if "卡胡纳" in group else None,
            "round_label": "决赛成绩",
            "kind": "sprint",
            "source_note": f"无锡站成绩册第{page_number}页 200米竞速赛{group}",
        }
    return None


def parse_rank(rank_text: str, status_counter: int) -> tuple[int | None, int, str | None]:
    text = clean(rank_text).upper()
    if re.fullmatch(r"\d{1,3}", text):
        return int(text), status_counter, None
    if text in STATUS_CODES:
        status_counter += 1
        return 9000 + status_counter, status_counter, f"PDF名次列为{text}"
    return None, status_counter, None


def parse_long_page(items: list[dict[str, Any]], context: dict[str, Any], page_number: int) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    status_counter = 0
    for line in group_lines(items):
        if not any(is_time_or_status(item["text"]) for item in line):
            continue
        rank_text = first_text_in(line, 150, 270)
        rank, status_counter, note = parse_rank(rank_text, status_counter)
        bib = first_text_in(line, 700, 830)
        name = text_in(line, 830, 990)
        team = text_in(line, 260, 700)
        finish = first_text_in(line, 990, 1180)
        if not rank or not bib or not name or not is_time_or_status(finish):
            continue
        results.append(
            make_result(
                context,
                page_number=page_number,
                rank_position=rank,
                bib_number=bib,
                athlete_name=name,
                team_name=team,
                finish_time=finish,
                source_note=note or context["source_note"],
                confidence=min(item["score"] for item in line),
            )
        )
    return results


def parse_sprint_page(items: list[dict[str, Any]], context: dict[str, Any], page_number: int) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    status_counter = 0
    for line in group_lines(items):
        if not any(is_time_or_status(item["text"]) for item in line):
            continue
        rank_text = first_text_in(line, 150, 260)
        rank, status_counter, note = parse_rank(rank_text, status_counter)
        round_label = text_in(line, 260, 380)
        bib = first_text_in(line, 380, 510)
        name = text_in(line, 510, 670)
        team = text_in(line, 670, 1060)
        finish = first_text_in(line, 1060, 1200)
        if not rank or not bib or not name or not is_time_or_status(finish):
            continue
        results.append(
            make_result(
                context,
                page_number=page_number,
                rank_position=rank,
                bib_number=bib,
                athlete_name=name,
                team_name=team,
                finish_time=finish,
                result_label=round_label,
                source_note=note or context["source_note"],
                confidence=min(item["score"] for item in line),
            )
        )
    return results


def parse_team_page(items: list[dict[str, Any]], context: dict[str, Any], page_number: int) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    status_counter = 0
    for line in group_lines(items):
        if not any(is_time_or_status(item["text"]) for item in line):
            continue
        rank_text = first_text_in(line, 150, 250)
        rank, status_counter, note = parse_rank(rank_text, status_counter)
        if rank is None:
            status_counter += 1
            rank = 9000 + status_counter
            note = "PDF未识别名次，按表格顺序补位"
        bib = first_text_in(line, 250, 380)
        members_text = text_in(line, 380, 700)
        team = text_in(line, 700, 1060)
        finish = first_text_in(line, 1060, 1200)
        if not bib or not members_text or not team or not is_time_or_status(finish):
            continue
        members = [clean(item) for item in re.split(r"[/／]", members_text) if clean(item)]
        results.append(
            make_result(
                context,
                page_number=page_number,
                rank_position=rank,
                bib_number=bib,
                athlete_name=team,
                team_name=team,
                finish_time=finish,
                team_members=members,
                source_note=note or context["source_note"],
                confidence=min(item["score"] for item in line),
            )
        )
    return results


def dedupe(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[tuple[Any, ...]] = set()
    unique: list[dict[str, Any]] = []
    for row in rows:
        key = (
            row["discipline"],
            row["gender_group"],
            row["round_label"],
            row["rank_position"],
            row["athlete_name_snapshot"],
            row["bib_number"],
            row["source_locator"],
        )
        if key in seen:
            continue
        seen.add(key)
        unique.append(row)
    return unique


def parse_pdf(pdf_path: Path, cache_dir: Path) -> dict[str, Any]:
    doc = fitz.open(str(pdf_path))
    ocr = RapidOCR()
    results: list[dict[str, Any]] = []
    pages: list[dict[str, Any]] = []
    for page_number in range(FIRST_RESULT_PAGE, LAST_RESULT_PAGE + 1):
        items = ocr_page(doc, page_number, cache_dir, ocr)
        context = context_from_page(items, page_number)
        page_results: list[dict[str, Any]]
        if not context:
            page_results = []
        elif context["kind"] == "long":
            page_results = parse_long_page(items, context, page_number)
        elif context["kind"] == "sprint":
            page_results = parse_sprint_page(items, context, page_number)
        else:
            page_results = parse_team_page(items, context, page_number)
        results.extend(page_results)
        pages.append(
            {
                "page": page_number,
                "kind": context["kind"] if context else "unknown",
                "discipline": context["discipline"] if context else None,
                "gender_group": context["gender_group"] if context else None,
                "rows": len(page_results),
            }
        )

    return {
        "event": {
            "event_id": EVENT_ID,
            "name": EVENT_NAME,
            "slug": "china-sup-club-league-wuxi-2025",
            "province": "江苏省",
            "city": "无锡市",
            "start_date": "2025-07-07",
            "end_date": "2025-07-07",
        },
        "source": {
            "source_id": SOURCE_ID,
            "file_name": pdf_path.name,
            "source_url": SOURCE_URL,
            "original_path": str(pdf_path),
            "parser_name": Path(__file__).name,
            "parser_note": "无锡站扫描版成绩册第20-50页本地OCR重解析；第2-19页积分未录入。",
            "metadata": {
                "page_range": f"{FIRST_RESULT_PAGE}-{LAST_RESULT_PAGE}",
                "skipped_pages": "2-19积分页, 51封底",
                "ocr": "rapidocr_onnxruntime",
                "pages": pages,
            },
        },
        "results": dedupe(results),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", default=ORIGINAL_PATH)
    parser.add_argument("--output", required=True)
    parser.add_argument("--cache-dir", default="/private/tmp/wuxi-club-league-2025-ocr")
    args = parser.parse_args()

    payload = parse_pdf(Path(args.pdf), Path(args.cache_dir))
    Path(args.output).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    team_rows = sum(1 for row in payload["results"] if row.get("team_members"))
    print(f"wrote {len(payload['results'])} rows, team rows {team_rows}: {args.output}")
    for page in payload["source"]["metadata"]["pages"]:
        print(f"page {page['page']:>2} {page['kind']:<6} {page['discipline'] or '-'} · {page['gender_group'] or '-'}: {page['rows']}")
    grouped: dict[str, int] = {}
    status: dict[str, int] = {}
    for row in payload["results"]:
        key = f"{row['discipline']} · {row['gender_group']} · {row.get('round_label') or '-'}"
        grouped[key] = grouped.get(key, 0) + 1
        if row.get("result_status_code"):
            status[row["result_status_code"]] = status.get(row["result_status_code"], 0) + 1
    print("status", json.dumps(status, ensure_ascii=False, sort_keys=True))
    for key, count in sorted(grouped.items()):
        print(f"{count:4d}  {key}")


if __name__ == "__main__":
    main()
