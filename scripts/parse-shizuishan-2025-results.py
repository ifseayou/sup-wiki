#!/usr/bin/env python3
"""Parse 2025 中国桨板精英赛石嘴山站 result pages."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any
from urllib.parse import quote

import pdfplumber


EVENT_NAME = "2025年中国桨板精英赛石嘴山站"
EVENT_SLUG = "china-sup-elite-series-shizuishan-2025"
PDF_PATH = Path("/Users/xhl/Downloads/桨板赛事/20250719 中国桨板精英赛石嘴山站/成绩册-石嘴山.pdf")
PUBLIC_BOOK_DIR_NAME = "20250719 中国桨板精英赛石嘴山站"
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
    return re.sub(r"\s+", " ", text)


def status_code(value: str) -> str | None:
    text = clean(value).upper()
    return text if text in STATUS_LABELS else None


def normalize_time(value: str) -> str:
    text = clean(value).upper().replace("O", "0")
    return text


def is_time_or_status(value: str) -> bool:
    text = normalize_time(value)
    return bool(status_code(text) or re.fullmatch(r"\d{1,2}:\d{2}(?::\d{2})?(?:\.\d{1,3})?", text))


def source_url(file_name: str) -> str:
    return f"/result-books/{quote(PUBLIC_BOOK_DIR_NAME, safe='')}/{quote(file_name, safe='')}"


def normalize_group(group: str, gender: str) -> str:
    text = clean(group).replace("组", "")
    if re.fullmatch(r"U\d+", text, re.I):
        return f"{text.upper()}{gender}组"
    return f"{text}{gender}组"


def split_members(value: str) -> list[str]:
    return [item.strip() for item in re.split(r"[/、,，;；\s]+", clean(value)) if item.strip()]


def page_title(page: pdfplumber.page.Page) -> str:
    words = page.extract_words(x_tolerance=1, y_tolerance=3, keep_blank_chars=False) or []
    return clean(" ".join(word["text"] for word in words if float(word["top"]) < 155))


def group_lines(words: list[dict[str, Any]], top_min: float = 120) -> list[list[dict[str, Any]]]:
    body = [word for word in words if float(word["top"]) > top_min]
    lines: list[list[dict[str, Any]]] = []
    for word in sorted(body, key=lambda item: (float(item["top"]), float(item["x0"]))):
        if not lines or abs(float(lines[-1][0]["top"]) - float(word["top"])) > 5.2:
            lines.append([word])
        else:
            lines[-1].append(word)
    return [sorted(line, key=lambda item: float(item["x0"])) for line in lines]


def line_text(words: list[dict[str, Any]], left: float, right: float) -> str:
    return clean(" ".join(word["text"] for word in words if left <= float(word["x0"]) < right))


def row_words(words: list[dict[str, Any]], left: float, right: float) -> list[dict[str, Any]]:
    return [word for word in words if left <= float(word["x0"]) < right]


def split_name_team(words: list[dict[str, Any]], left: float, right: float) -> tuple[str, str]:
    items = row_words(words, left, right)
    if not items:
        return "", ""
    name = clean(items[0]["text"])
    team = clean(" ".join(word["text"] for word in items[1:]))
    return name, team


def make_result(
    context: dict[str, Any],
    page_number: int,
    rank: int,
    bib: str | None,
    name: str,
    team: str,
    finish: str,
    source_note: str,
    result_label: str | None = None,
    team_members: list[str] | None = None,
) -> dict[str, Any]:
    finish_time = normalize_time(finish)
    code = status_code(finish_time)
    return {
        "athlete_name_snapshot": clean(name),
        "bib_number": clean(bib) or None,
        "gender_group": context["gender_group"],
        "discipline": context["discipline"],
        "board_class": context.get("board_class"),
        "round_label": context.get("round_label") or "决赛",
        "rank_position": rank,
        "result_label": result_label,
        "finish_time": finish_time,
        "result_status_code": code,
        "result_status_note": STATUS_LABELS.get(code),
        "time_seconds": None,
        "points": None,
        "team_name": clean(team) or "个人",
        "team_members": team_members or [],
        "source_locator": f"page:{page_number}",
        "source_note": source_note,
        "parse_confidence": 0.98,
        "review_status": "confirmed",
        "is_verified": True,
    }


def long_context(title: str, file_name: str, page_number: int) -> dict[str, Any] | None:
    match = re.search(r"((?:精英|公开|大师|卡胡纳|U\d+)组)(男子|女子)\s+长距离赛成绩单", title, re.I)
    if not match:
        return None
    group, gender = match.groups()
    return {
        "discipline": "长距离赛",
        "gender_group": normalize_group(group, gender),
        "board_class": "卡胡纳" if "卡胡纳" in group else None,
        "round_label": "决赛",
        "source_note": f"石嘴山成绩册 {file_name} 第{page_number}页 {group}{gender}长距离赛决赛",
    }


def sprint_context(title: str, file_name: str, page_number: int) -> dict[str, Any] | None:
    match = re.search(r"200m竞速赛-((?:精英|公开|大师|卡胡纳|U\d+)组)(男子|女子)决赛", title, re.I)
    if not match:
        return None
    group, gender = match.groups()
    return {
        "discipline": "200米竞速赛",
        "gender_group": normalize_group(group, gender),
        "board_class": "卡胡纳" if "卡胡纳" in group else None,
        "round_label": "决赛",
        "source_note": f"石嘴山成绩册 {file_name} 第{page_number}页 {group}{gender}200m竞速赛决赛",
    }


def parse_long_page(page: pdfplumber.page.Page, context: dict[str, Any], page_number: int) -> list[dict[str, Any]]:
    words = page.extract_words(x_tolerance=1, y_tolerance=3, keep_blank_chars=False) or []
    results: list[dict[str, Any]] = []
    for line in group_lines(words):
        if not any(is_time_or_status(word["text"]) for word in line):
            continue
        rank_text = line_text(line, 55, 100)
        bib = line_text(line, 100, 160)
        name, team = split_name_team(line, 160, 410)
        finish = line_text(line, 410, 510)
        if not re.fullmatch(r"\d{1,3}", rank_text):
            continue
        if not bib or not name or not is_time_or_status(finish):
            continue
        results.append(make_result(context, page_number, int(rank_text), bib, name, team, finish, context["source_note"]))
    return results


def valid_final_lane(value: str) -> bool:
    return bool(re.fullmatch(r"(?:[1-9]|1[0-6])", clean(value)))


def parse_sprint_page(page: pdfplumber.page.Page, context: dict[str, Any], page_number: int) -> list[dict[str, Any]]:
    words = page.extract_words(x_tolerance=1, y_tolerance=3, keep_blank_chars=False) or []
    results: list[dict[str, Any]] = []
    status_counter = 0
    in_prelim_appendix = False
    for line in group_lines(words):
        full_line = clean(" ".join(word["text"] for word in line))
        if "预赛" in full_line or any(float(word["x0"]) > 515 for word in line):
            in_prelim_appendix = True
            continue
        if in_prelim_appendix:
            continue
        if not any(is_time_or_status(word["text"]) for word in line):
            continue

        rank_text = line_text(line, 55, 95)
        lane_text = line_text(line, 95, 145)
        bib = line_text(line, 145, 205)
        name, team = split_name_team(line, 205, 430)
        finish = line_text(line, 430, 515)

        if re.fullmatch(r"\d{1,3}", rank_text) and valid_final_lane(lane_text):
            rank = int(rank_text)
        elif status_code(finish) and valid_final_lane(lane_text):
            status_counter += 1
            rank = 9000 + status_counter
            team = line_text(line, 280, 430)
        else:
            continue

        if not bib or not name or not is_time_or_status(finish):
            continue
        note = f"{context['source_note']} 出发位置:{lane_text}"
        results.append(make_result(context, page_number, rank, bib, name, team, finish, note))
    return results


def dragon_context(title: str, file_name: str, page_number: int) -> dict[str, Any] | None:
    if "家庭三人龙板赛" in title:
        return {
            "discipline": "家庭三人龙板赛200米",
            "gender_group": "家庭组",
            "board_class": "龙板",
            "round_label": "决赛",
            "source_note": f"石嘴山成绩册 {file_name} 第{page_number}页 家庭三人龙板赛",
        }
    if "男女混合四人龙板赛" in title:
        return {
            "discipline": "男女混合四人龙板赛200米",
            "gender_group": "混合组",
            "board_class": "龙板",
            "round_label": "决赛",
            "source_note": f"石嘴山成绩册 {file_name} 第{page_number}页 男女混合四人龙板赛",
        }
    return None


def parse_dragon_page(page: pdfplumber.page.Page, base_context: dict[str, Any], page_number: int) -> list[dict[str, Any]]:
    lines = [clean(line) for line in (page.extract_text() or "").splitlines() if clean(line)]
    results: list[dict[str, Any]] = []
    current_round = base_context["round_label"]
    index = 0
    while index < len(lines):
        line = lines[index]
        round_match = re.search(r"NO\.\d+\s+(.+?)(7-12名排位赛|9-17名排位赛|决赛)", line)
        if round_match:
            current_round = round_match.group(2)
            index += 1
            continue
        if re.fullmatch(r"(?:\d{1,3}/)+\d{1,3}", line) and index + 2 < len(lines):
            row = lines[index + 1]
            members = lines[index + 2]
            match = re.match(r"^(\d{1,2})\s+(\d{1,2})\s+(.+?)\s+(\d{2}:\d{2}\.\d{3}|DNS)$", row)
            if match:
                rank_raw, lane, team, finish = match.groups()
                context = {**base_context, "round_label": current_round}
                note = f"{base_context['source_note']} {current_round} 出发位置:{lane}"
                results.append(
                    make_result(
                        context,
                        page_number,
                        int(rank_raw),
                        line,
                        team,
                        team,
                        finish,
                        note,
                        team_members=split_members(members),
                    )
                )
                index += 3
                continue
        index += 1
    return results


def duplicate_rank_issues(results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: dict[tuple[str, str, str, str, int], int] = {}
    issues: list[dict[str, Any]] = []
    for row in results:
        rank = int(row["rank_position"])
        if rank >= 9000:
            continue
        key = (
            row["discipline"],
            row["gender_group"],
            row.get("board_class") or "",
            row.get("round_label") or "",
            rank,
        )
        seen[key] = seen.get(key, 0) + 1
    for key, count in seen.items():
        if count > 1:
            issues.append({
                "discipline": key[0],
                "gender_group": key[1],
                "board_class": key[2] or None,
                "round_label": key[3],
                "rank": key[4],
                "count": count,
            })
    return issues


def parse_pdf(pdf_path: Path) -> dict[str, Any]:
    results: list[dict[str, Any]] = []
    contexts: list[str] = []
    with pdfplumber.open(str(pdf_path)) as pdf:
        for page_number in range(22, min(56, len(pdf.pages)) + 1):
            page = pdf.pages[page_number - 1]
            title = page_title(page)
            context = None
            page_results: list[dict[str, Any]] = []
            if 22 <= page_number <= 23:
                context = dragon_context(title, pdf_path.name, page_number)
                if context:
                    page_results = parse_dragon_page(page, context, page_number)
            elif 24 <= page_number <= 40:
                context = long_context(title, pdf_path.name, page_number)
                if context:
                    page_results = parse_long_page(page, context, page_number)
            elif 41 <= page_number <= 56:
                if page_number in {51, 54}:
                    continue
                context = sprint_context(title, pdf_path.name, page_number)
                if context:
                    page_results = parse_sprint_page(page, context, page_number)

            if not context:
                continue
            contexts.append(
                f"{page_number}:{context['discipline']}:{context['gender_group']}:{context.get('board_class') or '-'}:{len(page_results)}"
            )
            for row in page_results:
                row["source_title"] = pdf_path.name
                row["source_url"] = source_url(pdf_path.name)
            results.extend(page_results)

    issues = duplicate_rank_issues(results)
    return {
        "event": {
            "name": EVENT_NAME,
            "slug": EVENT_SLUG,
            "province": "宁夏回族自治区",
            "city": "石嘴山市",
            "venue": "石嘴山·星海湖",
            "start_date": "2025-07-19",
            "end_date": "2025-07-20",
            "event_status": "completed",
            "result_status": "extended_complete",
            "star_level": "四星 / 4.5",
            "score_coefficient": 4.5,
            "result_source_note": "石嘴山站本地PDF成绩册重解析导入；个人积分、预赛页和团体积分未导入，200m竞速只保留决赛行。",
        },
        "source": {
            "original_path": str(pdf_path),
            "file_name": pdf_path.name,
            "file_type": "pdf",
            "source_url": source_url(pdf_path.name),
            "parser_name": "parse-shizuishan-2025-results.py",
            "parser_status": "parsed",
            "parser_note": "石嘴山站PDF成绩页重解析；跳过积分和200m预赛附带排名。",
            "extracted_rows": len(results),
            "metadata": {
                "page_contexts": contexts,
                "source_kind": "local_result_book",
                "results_only": True,
                "included_pages": "22-56",
                "skipped_pages": "3-19个人积分,20-21龙板预赛,57-61竞速预赛,62-63团体积分",
                "duplicate_rank_issues": issues,
            },
        },
        "results": results,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default=str(PDF_PATH))
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    payload = parse_pdf(Path(args.input))
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    for context in payload["source"]["metadata"]["page_contexts"]:
        print(context)
    issues = payload["source"]["metadata"]["duplicate_rank_issues"]
    if issues:
        print("duplicate_rank_issues:")
        for issue in issues:
            print(issue)
    print(f"wrote 1 source, {len(payload['results'])} results -> {output_path}")


if __name__ == "__main__":
    main()
