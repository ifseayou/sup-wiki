#!/usr/bin/env python3
"""Parse 2025 Tianzi Lake SUP Super League result PDFs."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any
from urllib.parse import quote

import pdfplumber


EVENT_ID = 14
EVENT_NAME = "“奔跑吧·邵阳”2025年中国桨板超级联赛暨第四届天子湖桨板公开赛"
EVENT_SLUG = "china-sup-super-league-shaoyang-2025"
BASE_DIR = Path("/Users/xhl/Downloads/桨板赛事/20250830 中国桨板超级联赛邵阳天子湖站")
PUBLIC_BOOK_DIR_NAME = "20250830 中国桨板超级联赛邵阳天子湖站"

STATUS_LABELS = {
    "DNS": "未出发",
    "DNF": "未完赛",
    "DQ": "取消成绩",
    "DSQ": "取消成绩",
    "DNQ": "未晋级",
    "OTL": "超过关门时间",
}


def clean(value: Any) -> str:
    text = str(value or "").strip()
    text = text.replace("（", "(").replace("）", ")").replace("：", ":")
    text = text.replace("艋拓世恒", "艋拓世恒")
    return re.sub(r"\s+", " ", text)


def normalize_time(value: str) -> str:
    text = clean(value).upper().replace("O", "0")
    if text in STATUS_LABELS:
        return text
    match = re.fullmatch(r"(\d{1,2}):(\d{2}):(\d{2})\.(\d{1,3})", text)
    if match:
        return f"{int(match.group(1)):02d}:{match.group(2)}:{match.group(3)}.{match.group(4).ljust(3, '0')}"
    return text


def status_code(value: str) -> str | None:
    text = clean(value).upper()
    return text if text in STATUS_LABELS else None


def is_time_or_status(value: str) -> bool:
    text = normalize_time(value)
    return bool(status_code(text) or re.fullmatch(r"\d{2}:\d{2}:\d{2}\.\d{3}", text))


def normalize_group(gender: str, group: str) -> str:
    base = clean(group).replace("组", "")
    base = base.replace("公开", "公开").replace("大师", "大师").replace("卡胡纳", "卡胡纳").replace("高校", "高校")
    return f"{base}{gender}组"


def source_url(file_name: str) -> str:
    return f"/result-books/{quote(PUBLIC_BOOK_DIR_NAME, safe='')}/{quote(file_name, safe='')}"


def line_text(words: list[dict[str, Any]], left: float, right: float) -> str:
    return clean(" ".join(word["text"] for word in words if left <= float(word["x0"]) < right))


def group_lines(words: list[dict[str, Any]]) -> list[list[dict[str, Any]]]:
    body = [word for word in words if float(word["top"]) > 125]
    lines: list[list[dict[str, Any]]] = []
    for word in sorted(body, key=lambda item: (float(item["top"]), float(item["x0"]))):
        if not lines or abs(float(lines[-1][0]["top"]) - float(word["top"])) > 4.8:
            lines.append([word])
        else:
            lines[-1].append(word)
    return [sorted(line, key=lambda item: float(item["x0"])) for line in lines]


def page_title(page: pdfplumber.page.Page) -> str:
    words = page.extract_words(x_tolerance=1, y_tolerance=3, keep_blank_chars=False) or []
    title_words = [word["text"] for word in words if float(word["top"]) < 145]
    return clean(" ".join(title_words))


def context_from_title(title: str, file_name: str, page_number: int) -> dict[str, Any] | None:
    youth_match = re.search(r"(男子|女子)\s*组\s*耐力赛\s*成绩单(?:\(更正\))?\s*U\s*(\d+)\s*(\d+)\s*km", title, re.I)
    if youth_match:
        gender, age, distance = youth_match.groups()
        return {
            "discipline": f"{distance}公里耐力赛",
            "gender_group": f"U{age}组{gender}",
            "board_class": None,
            "round_label": "决赛",
            "kind": "individual",
            "layout": "long",
            "source_note": f"天子湖成绩册 {file_name} 第{page_number}页 U{age}{gender}{distance}km耐力赛",
        }

    long_match = re.search(r"(男子|女子)(充气板|硬板)?(.+?组)\s*耐力赛\s*成绩单\s*(\d+)\s*km", title)
    if long_match:
        gender, board, group, distance = long_match.groups()
        return {
            "discipline": f"{distance}公里耐力赛",
            "gender_group": normalize_group(gender, group),
            "board_class": board,
            "round_label": "决赛",
            "kind": "individual",
            "layout": "long",
            "source_note": f"天子湖成绩册 {file_name} 第{page_number}页 {gender}{board or ''}{group}{distance}km耐力赛",
        }

    sprint_match = re.search(r"(男子|女子)(充气板|硬板)(.+?组)\s*200m\s*冲刺赛", title)
    if sprint_match:
        gender, board, group = sprint_match.groups()
        return {
            "discipline": "200米冲刺赛",
            "gender_group": normalize_group(gender, group),
            "board_class": board,
            "round_label": "决赛",
            "kind": "individual",
            "layout": "sprint",
            "source_note": f"天子湖成绩册 {file_name} 第{page_number}页 {gender}{board}{group}200m冲刺赛决赛",
        }

    if "混合四人200m冲刺赛" in title:
        return {
            "discipline": "混合四人200米龙板赛",
            "gender_group": "团体组",
            "board_class": "龙板",
            "round_label": "决赛",
            "kind": "team",
            "layout": "team",
            "source_note": f"天子湖成绩册 {file_name} 第{page_number}页 混合四人200m冲刺赛决赛",
        }

    if "混合双人200m冲刺赛" in title:
        return {
            "discipline": "混合双人200米冲刺赛",
            "gender_group": "团体组",
            "board_class": None,
            "round_label": "决赛",
            "kind": "team",
            "layout": "team",
            "source_note": f"天子湖成绩册 {file_name} 第{page_number}页 混合双人200m冲刺赛决赛",
        }

    return None


def make_result(context: dict[str, Any], page_number: int, rank: int, bib: str, name: str, team: str, finish: str, **extra: Any) -> dict[str, Any]:
    result_status = status_code(finish)
    return {
        "athlete_name_snapshot": clean(name),
        "bib_number": clean(bib) or None,
        "gender_group": context["gender_group"],
        "discipline": context["discipline"],
        "board_class": context.get("board_class"),
        "round_label": context.get("round_label") or "决赛",
        "rank_position": rank,
        "result_label": extra.get("result_label"),
        "finish_time": normalize_time(finish),
        "result_status_code": result_status,
        "result_status_note": STATUS_LABELS.get(result_status),
        "time_seconds": None,
        "points": None,
        "team_name": clean(team) or "个人",
        "team_members": extra.get("team_members") or [],
        "source_locator": f"page:{page_number}",
        "source_note": extra.get("source_note") or context["source_note"],
        "parse_confidence": extra.get("parse_confidence", 0.98),
        "review_status": "confirmed",
        "is_verified": True,
    }


def parse_individual_page(page: pdfplumber.page.Page, context: dict[str, Any], file_name: str, page_number: int) -> list[dict[str, Any]]:
    words = page.extract_words(x_tolerance=1, y_tolerance=3, keep_blank_chars=False) or []
    results: list[dict[str, Any]] = []
    rank_counter = 0
    for line in group_lines(words):
        if not any(is_time_or_status(word["text"]) for word in line):
            continue
        layout = context["layout"]
        if layout == "sprint":
            rank_text = line_text(line, 60, 98)
            lane_text = line_text(line, 98, 160)
            bib = line_text(line, 160, 230)
            name = line_text(line, 225, 315)
            team = line_text(line, 300, 440)
            finish = line_text(line, 435, 540)
            source_note = f"{context['source_note']} 出发位置:{lane_text}" if lane_text else context["source_note"]
        else:
            rank_text = line_text(line, 60, 98)
            bib = line_text(line, 100, 170)
            name = line_text(line, 170, 265)
            team = line_text(line, 250, 430)
            finish = line_text(line, 430, 540)
            source_note = context["source_note"]

        code = status_code(rank_text)
        if code:
            rank_counter += 1
            rank = 9000 + rank_counter
            source_note = f"{source_note}；PDF名次列为{code}"
        elif re.fullmatch(r"\d{1,3}", rank_text):
            rank = int(rank_text)
        else:
            continue

        if not bib or not name or not is_time_or_status(finish):
            continue
        results.append(make_result(context, page_number, rank, bib, name, team, finish, source_note=source_note))
    return results


def parse_team_page(page: pdfplumber.page.Page, context: dict[str, Any], file_name: str, page_number: int) -> list[dict[str, Any]]:
    words = page.extract_words(x_tolerance=1, y_tolerance=3, keep_blank_chars=False) or []
    lines = group_lines(words)
    results: list[dict[str, Any]] = []
    pending_bib = ""
    for line in lines:
        text = clean(" ".join(word["text"] for word in line))
        if re.fullmatch(r"\d+(?:/\d+)+", text):
            pending_bib = text
            continue
        finish = line_text(line, 440, 550)
        rank_text = line_text(line, 60, 100)
        if not (re.fullmatch(r"\d{1,3}", rank_text) and is_time_or_status(finish)):
            continue
        team = line_text(line, 155, 345)
        member_line = line_text(line, 300, 455)
        if "/" not in member_line:
            member_line = ""
        current_top = float(line[0]["top"])
        for candidate in lines:
            candidate_top = float(candidate[0]["top"])
            if not member_line and 0 < candidate_top - current_top < 8:
                member_line = line_text(candidate, 300, 450)
                break
        members = [clean(item) for item in re.split(r"[/、,，]", member_line) if clean(item)]
        results.append(
            make_result(
                context,
                page_number,
                int(rank_text),
                pending_bib,
                team,
                team,
                finish,
                team_members=members,
                source_note=f"{context['source_note']}；成员:{'/'.join(members)}" if members else context["source_note"],
            )
        )
        pending_bib = ""
    return results


def parse_pdf(pdf_path: Path) -> dict[str, Any]:
    results: list[dict[str, Any]] = []
    contexts: list[str] = []
    with pdfplumber.open(str(pdf_path)) as pdf:
        for index, page in enumerate(pdf.pages, 1):
            title = page_title(page)
            context = context_from_title(title, pdf_path.name, index)
            if not context:
                continue
            contexts.append(f"{index}:{context['discipline']}:{context['gender_group']}:{context.get('board_class') or '-'}")
            page_results = parse_team_page(page, context, pdf_path.name, index) if context["kind"] == "team" else parse_individual_page(page, context, pdf_path.name, index)
            for item in page_results:
                item["source_title"] = pdf_path.name
                item["source_url"] = source_url(pdf_path.name)
            results.extend(page_results)

    return {
        "event": {
            "event_id": EVENT_ID,
            "name": EVENT_NAME,
            "slug": EVENT_SLUG,
            "province": "湖南省",
            "city": "邵阳市",
            "venue": "邵阳·天子湖",
            "start_date": "2025-08-30",
            "end_date": "2025-08-31",
            "event_status": "completed",
            "result_status": "extended_complete",
            "result_source_note": "天子湖本地12份PDF成绩册重解析导入；仅导入成绩，不导入积分。",
        },
        "source": {
            "original_path": str(pdf_path),
            "file_name": pdf_path.name,
            "file_type": "pdf",
            "source_url": source_url(pdf_path.name),
            "parser_name": "parse-tianzi-lake-2025-results.py",
            "parser_status": "parsed",
            "parser_note": "天子湖成绩册文本层解析；积分未导入。",
            "extracted_rows": len(results),
            "metadata": {
                "page_contexts": contexts,
                "source_kind": "local_result_book",
                "results_only": True,
            },
        },
        "results": results,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", default=str(BASE_DIR))
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    input_dir = Path(args.input_dir)
    payloads = []
    for pdf_path in sorted(input_dir.glob("*.pdf")):
        payload = parse_pdf(pdf_path)
        payloads.append(payload)
        print(f"{pdf_path.name}: pages={len(payload['source']['metadata']['page_contexts'])} results={len(payload['results'])}")

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payloads, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {len(payloads)} sources, {sum(len(item['results']) for item in payloads)} results -> {output_path}")


if __name__ == "__main__":
    main()
