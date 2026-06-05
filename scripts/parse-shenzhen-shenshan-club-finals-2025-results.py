#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any
from urllib.request import urlretrieve

from pypdf import PdfReader


EVENT_ID = 341
EVENT_NAME = "2025年中国桨板俱乐部联赛总决赛（深圳深汕站）"
EVENT_SLUG = "china-sup-club-league-finals-shenzhen-shenshan-2025"
SOURCE_URL = "https://sport-hacker-assets.oss-cn-hangzhou.aliyuncs.com/sup-wiki/result-submissions/1/1780580463557-u3an0f----2025-1-.pdf"
SOURCE_FILE_NAME = "成绩册--2025年中国桨板俱乐部联赛总决赛（深汕站）(1).pdf"
PUBLIC_SOURCE_URL = "/result-books/china-sup-club-league-finals-shenzhen-shenshan-2025/results-book.pdf"
SUBMISSION_ID = 23
SUBMISSION_BATCH_ID = "mp_1780580462138_gywsnawb"

POINT_PAGES = range(2, 17)
RESULT_PAGES = range(17, 44)
STATUS_CODES = {"DNS", "DNF", "DQ", "DSQ"}
STATUS_LABELS = {
    "DNS": "未出发",
    "DNF": "未完赛",
    "DQ": "取消成绩",
    "DSQ": "取消成绩",
}


def clean(value: Any) -> str:
    text = str(value or "").strip()
    text = text.replace("（", "(").replace("）", ")")
    text = text.replace("：", ":").replace("．", ".")
    text = text.replace("㎞", "km")
    return re.sub(r"\s+", " ", text)


def normalize_group(raw: str) -> str:
    text = clean(raw)
    match = re.fullmatch(r"(男子|女子)(U\d+)组", text, re.I)
    if match:
        return f"{match.group(2).upper()}{match.group(1)}组"
    mapping = {
        "男子公开组": "公开男子组",
        "女子公开组": "公开女子组",
        "男子大师组": "大师男子组",
        "女子大师组": "大师女子组",
        "男子卡胡纳组": "卡胡纳男子组",
        "女子卡胡纳组": "卡胡纳女子组",
    }
    return mapping.get(text, text)


def result_label(rank: int | None, code: str | None = None) -> str | None:
    if code:
        return code
    if rank == 1:
        return "冠军"
    if rank == 2:
        return "亚军"
    if rank == 3:
        return "季军"
    if rank:
        return f"第{rank}名"
    return None


def parse_time_to_seconds(value: str) -> float | None:
    raw = clean(value).upper()
    if not raw or raw in STATUS_CODES:
        return None
    match = re.fullmatch(r"(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?", raw)
    if match:
        return int(match.group(1)) * 60 + int(match.group(2)) + float(f"0.{match.group(3) or 0}")
    match = re.fullmatch(r"(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?", raw)
    if match:
        return int(match.group(1)) * 3600 + int(match.group(2)) * 60 + int(match.group(3)) + float(f"0.{match.group(4) or 0}")
    return None


def status_code(value: str) -> str | None:
    code = clean(value).upper()
    return code if code in STATUS_CODES else None


def ensure_input(path_or_url: str) -> Path:
    if path_or_url.startswith(("http://", "https://")):
        target = Path("/tmp/shenzhen-shenshan-2025-results.pdf")
        if not target.exists():
            urlretrieve(path_or_url, target)
        return target
    return Path(path_or_url)


def page_lines(reader: PdfReader, page_no: int) -> list[str]:
    text = reader.pages[page_no - 1].extract_text() or ""
    return [clean(line) for line in text.splitlines() if clean(line)]


def context_from_lines(lines: list[str], previous: dict[str, Any] | None = None) -> dict[str, Any] | None:
    text = " ".join(lines[:8])
    point = re.search(r"((?:男子|女子)(?:U\d+|公开|大师|卡胡纳)组)\s*个人赛积分", text, re.I)
    if point:
        return {"kind": "points", "group_name": normalize_group(point.group(1))}

    result = re.search(r"((?:男子|女子)(?:U\d+|公开|大师|卡胡纳)组)\s*([0-9.]+)\s*(?:KM|km|M|m)\s*(耐力赛|冲刺赛)", text, re.I)
    if result:
        distance = result.group(2)
        kind = result.group(3)
        if kind == "耐力赛":
            discipline = f"{distance.replace('.0', '')}公里耐力赛"
        else:
            discipline = f"{distance.replace('.0', '')}米冲刺赛"
        return {
            "kind": "result",
            "mode": "sprint" if kind == "冲刺赛" else "endurance",
            "group_name": normalize_group(result.group(1)),
            "discipline": discipline,
            "round_label": "决赛",
        }

    if "四人龙板200M冲刺赛" in text or "四人龙板200米冲刺赛" in text:
        return {
            "kind": "dragon",
            "mode": "dragon",
            "group_name": "龙板组",
            "discipline": "龙板200米冲刺赛",
            "board_class": "龙板",
            "round_label": "决赛",
        }

    if previous and lines and re.search(r"名\s*次|名次|参赛", " ".join(lines[:5])):
        return previous
    return None


def split_name_team(rest: str, bib: str, profiles: dict[str, dict[str, str]]) -> tuple[str, str]:
    text = clean(rest)
    profile = profiles.get(str(bib))
    if profile:
        name = profile["name"]
        if text.startswith(name):
            team = clean(text[len(name):]) or profile.get("team") or "个人"
            return name, team
    # Most rows use 2-3 Chinese-character names. Try a conservative fallback.
    match = re.match(r"^([\u4e00-\u9fff]{2,4})(.+)$", text)
    if match:
        return clean(match.group(1)), clean(match.group(2)) or "个人"
    parts = text.split(" ", 1)
    return clean(parts[0]), clean(parts[1] if len(parts) > 1 else "个人") or "个人"


def make_result(
    *,
    context: dict[str, Any],
    page_no: int,
    rank_text: str,
    bib_number: str,
    athlete_name: str,
    team_name: str,
    finish_time: str,
    previous_rank: str | None = None,
    note: str | None = None,
    team_members: list[str] | None = None,
) -> dict[str, Any]:
    rank_raw = clean(rank_text).upper()
    code = status_code(finish_time) or (rank_raw if rank_raw in STATUS_CODES else None)
    if code:
        rank = 9000
    elif rank_raw in {"####", "DNS", "DNF", "DQ", "DSQ"}:
        rank = 9000
    elif rank_raw.isdigit():
        rank = int(rank_raw)
    else:
        rank = 9000

    if rank >= 9000:
        rank += make_result.status_counts.get(context["discipline"] + context["group_name"], 0) + 1
        make_result.status_counts[context["discipline"] + context["group_name"]] = rank - 9000

    source_bits = [f"PDF第{page_no}页", f"{context['discipline']} {context['group_name']}"]
    if previous_rank:
        source_bits.append(f"前置排名:{previous_rank}")
    if note:
        source_bits.append(f"备注:{note}")

    finish = clean(finish_time).upper()
    return {
        "athlete_name_snapshot": clean(athlete_name),
        "bib_number": clean(bib_number) or None,
        "gender_group": context["group_name"],
        "discipline": context["discipline"],
        "board_class": context.get("board_class"),
        "round_label": context.get("round_label") or "决赛",
        "rank_position": rank,
        "result_label": result_label(rank if rank < 9000 else None, code),
        "finish_time": finish,
        "result_status_code": code,
        "result_status_note": STATUS_LABELS.get(code),
        "time_seconds": parse_time_to_seconds(finish),
        "points": None,
        "team_name": clean(team_name) or "个人",
        "team_members": team_members or [],
        "nationality_snapshot": "中国",
        "source_locator": f"page:{page_no}",
        "source_note": "；".join(source_bits),
        "parse_confidence": 0.98 if rank < 9000 else 0.94,
        "review_status": "confirmed",
        "is_verified": True,
    }


make_result.status_counts = {}


def parse_individual_result_line(line: str, context: dict[str, Any], page_no: int, profiles: dict[str, dict[str, str]]) -> dict[str, Any] | None:
    if not re.search(r"\d{1,2}:\d{2}\.\d{2}|DNS|DNF|DSQ|DQ", line, re.I):
        return None
    match = re.match(
        r"^(?P<rank>\d{1,3}|DNS|DNF|DSQ|DQ|####)\s+"
        r"(?:(?P<prev>\d{1,3})\s+)?"
        r"(?P<bib>\d{2,4})\s+"
        r"(?P<rest>.+?)\s+"
        r"(?P<finish>\d{1,2}:\d{2}\.\d{2}|DNS|DNF|DSQ|DQ)"
        r"(?:\s+(?P<note>.+))?$",
        line,
        re.I,
    )
    if not match:
        return None
    bib = match.group("bib")
    name, team = split_name_team(match.group("rest"), bib, profiles)
    if bib not in profiles and name and team:
        profiles[bib] = {"name": name, "team": team}
    return make_result(
        context=context,
        page_no=page_no,
        rank_text=match.group("rank"),
        bib_number=bib,
        athlete_name=name,
        team_name=team,
        finish_time=match.group("finish"),
        previous_rank=match.group("prev"),
        note=match.group("note"),
    )


def parse_dragon_results(lines: list[str], context: dict[str, Any], page_no: int) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    index = 0
    status_counter = 0
    while index < len(lines):
        line = lines[index]
        match = re.match(
            r"^(?:(?P<rank>\d{1,3})\s+(?P<prev>\d{1,3})\s+)?(?P<bib>\d{2})\s+"
            r"(?P<team>.+?)\s+(?P<members>[\u4e00-\u9fffA-Za-z·/／]+)$",
            line,
        )
        if not match or index + 1 >= len(lines):
            index += 1
            continue
        next_line = lines[index + 1]
        finish_match = re.match(r"^(?P<member_bibs>[\d/／]+)\s+(?P<finish>\d{1,2}:\d{2}\.\d{2}|DNS|DNF|DSQ|DQ)$", next_line, re.I)
        if not finish_match:
            index += 1
            continue
        rank_text = match.group("rank")
        finish = clean(finish_match.group("finish")).upper()
        if not rank_text:
            status_counter += 1
            rank_text = finish if finish in STATUS_CODES else str(9000 + status_counter)
        members = [clean(item) for item in re.split(r"[/／]", match.group("members")) if clean(item)]
        source_note = f"成员号码:{finish_match.group('member_bibs')}"
        rows.append(
            make_result(
                context=context,
                page_no=page_no,
                rank_text=rank_text,
                bib_number=match.group("bib"),
                athlete_name=match.group("team"),
                team_name=match.group("team"),
                finish_time=finish,
                previous_rank=match.group("prev"),
                note=source_note,
                team_members=members,
            )
        )
        index += 2
    return rows


def parse_results(reader: PdfReader) -> tuple[list[dict[str, Any]], dict[str, dict[str, str]], list[dict[str, Any]]]:
    results: list[dict[str, Any]] = []
    profiles: dict[str, dict[str, str]] = {}
    pages: list[dict[str, Any]] = []
    previous: dict[str, Any] | None = None
    make_result.status_counts = {}

    for page_no in RESULT_PAGES:
        lines = page_lines(reader, page_no)
        context = context_from_lines(lines, previous)
        page_rows: list[dict[str, Any]] = []
        if context and context["kind"] == "result":
            previous = context
            for line in lines:
                row = parse_individual_result_line(line, context, page_no, profiles)
                if row:
                    page_rows.append(row)
        elif context and context["kind"] == "dragon":
            previous = context
            page_rows.extend(parse_dragon_results(lines, context, page_no))
        results.extend(page_rows)
        pages.append({
            "page": page_no,
            "kind": context["kind"] if context else "unknown",
            "discipline": context.get("discipline") if context else None,
            "group_name": context.get("group_name") if context else None,
            "rows": len(page_rows),
        })
    return results, profiles, pages


def parse_points(reader: PdfReader, profiles: dict[str, dict[str, str]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    standings: list[dict[str, Any]] = []
    pages: list[dict[str, Any]] = []
    previous: dict[str, Any] | None = None
    for page_no in POINT_PAGES:
        lines = page_lines(reader, page_no)
        context = context_from_lines(lines, previous)
        if not context or context["kind"] != "points":
            pages.append({"page": page_no, "group_name": None, "rows": 0})
            continue
        previous = context
        rows = 0
        for line in lines:
            if not re.search(r"\s(?:DNS|\d{1,3})\s+0|\s\d{2,4}\s", line, re.I):
                continue
            match = re.match(
                r"^(?:(?P<rank>\d{1,3})\s+)?(?P<bib>\d{2,4})\s+(?P<left>.+?)\s+"
                r"(?P<end_rank>DNS|DNF|DSQ|DQ|\d{1,3})\s+(?P<end_points>\d+(?:\.\d+)?)\s+"
                r"(?P<sprint_rank>DNS|DNF|DSQ|DQ|\d{1,3})\s+(?P<sprint_points>\d+(?:\.\d+)?)\s+"
                r"(?P<total>\d+(?:\.\d+)?)$",
                line,
                re.I,
            )
            if not match:
                continue
            bib = match.group("bib")
            name, team = split_name_team(match.group("left"), bib, profiles)
            rank_text = match.group("rank")
            end_rank = clean(match.group("end_rank")).upper()
            sprint_rank = clean(match.group("sprint_rank")).upper()
            total = float(match.group("total"))
            standing = {
                "group_name": context["group_name"],
                "rank_position": int(rank_text) if rank_text else None,
                "status_rank": None if rank_text else ("DNS" if total == 0 else "未排名"),
                "bib_number": bib,
                "athlete_name_snapshot": name,
                "team_name": team or "个人",
                "endurance_rank": end_rank,
                "endurance_points": float(match.group("end_points")),
                "sprint_rank": sprint_rank,
                "sprint_points": float(match.group("sprint_points")),
                "total_points": total,
                "source_locator": f"page:{page_no}",
                "subevents": {
                    "endurance": {
                        "discipline": "1.5公里耐力赛" if "U12" in context["group_name"] or "U15" in context["group_name"] or "U18" in context["group_name"] else "3公里耐力赛",
                        "rank": end_rank,
                        "points": float(match.group("end_points")),
                    },
                    "sprint": {
                        "discipline": "200米冲刺赛",
                        "rank": sprint_rank,
                        "points": float(match.group("sprint_points")),
                    },
                },
            }
            standings.append(standing)
            rows += 1
        pages.append({"page": page_no, "group_name": context["group_name"], "rows": rows})
    return standings, pages


def validate_payload(payload: dict[str, Any]) -> None:
    results = payload["results"]
    points = payload["point_standings"]
    if len(results) != 426:
        raise RuntimeError(f"成绩行数异常：期望426，实际{len(results)}")
    if len(points) != 204:
        raise RuntimeError(f"积分行数异常：期望204，实际{len(points)}")

    def has_result(group: str, discipline: str, name: str, finish: str) -> bool:
        return any(
            row["gender_group"] == group
            and row["discipline"] == discipline
            and row["athlete_name_snapshot"] == name
            and row["finish_time"] == finish
            for row in results
        )

    def has_point(group: str, name: str, total: float) -> bool:
        return any(row["group_name"] == group and row["athlete_name_snapshot"] == name and float(row["total_points"]) == total for row in points)

    checks = [
        has_point("U12男子组", "黄靖宇", 1860.0),
        has_point("U12男子组", "马辰睿", 1583.0),
        has_result("U12男子组", "1.5公里耐力赛", "马辰睿", "15:07.03"),
        has_result("卡胡纳女子组", "200米冲刺赛", "周傑", "04:52.26"),
        has_result("龙板组", "龙板200米冲刺赛", "赤壁市陆水湖桨板运动俱乐部", "02:27.28"),
    ]
    if not all(checks):
        raise RuntimeError(f"关键样本校验失败：{checks}")


def build_payload(pdf_path: Path) -> dict[str, Any]:
    reader = PdfReader(str(pdf_path))
    if len(reader.pages) != 44:
        raise RuntimeError(f"PDF页数异常：期望44页，实际{len(reader.pages)}页")
    results, profiles, result_pages = parse_results(reader)
    point_standings, point_pages = parse_points(reader, profiles)
    payload = {
        "event": {
            "event_id": EVENT_ID,
            "name": EVENT_NAME,
            "slug": EVENT_SLUG,
            "event_type": "race",
            "location": "广东省深圳市深汕特别合作区南方澳度假村",
            "province": "广东省",
            "city": "深圳市",
            "venue": "深汕特别合作区南方澳度假村",
            "start_date": "2025-12-20",
            "end_date": "2025-12-21",
            "description": "用户提交成绩册导入，包含个人赛积分、耐力赛、200M冲刺赛和四人龙板200M冲刺赛。",
            "disciplines": ["1.5公里耐力赛", "3公里耐力赛", "200米冲刺赛", "龙板200米冲刺赛"],
            "star_level": "四星+",
            "score_coefficient": 4.5,
            "source_scope": "全国",
            "result_source_note": "用户提交成绩册：第2-16页为个人赛积分，第17-43页为成绩单。",
            "status": "published",
            "event_status": "completed",
            "result_status": "extended_complete",
        },
        "source": {
            "original_path": str(pdf_path),
            "file_name": SOURCE_FILE_NAME,
            "file_type": "pdf",
            "source_url": PUBLIC_SOURCE_URL,
            "original_submission_url": SOURCE_URL,
            "result_submission_id": SUBMISSION_ID,
            "result_submission_batch_id": SUBMISSION_BATCH_ID,
            "parser_name": "parse-shenzhen-shenshan-club-finals-2025-results.py",
            "parser_status": "parsed",
            "parser_note": "解析第2-16页个人赛积分、第17-43页成绩单；第1页和第44页为空白/封面页。",
            "extracted_rows": len(results),
            "imported_rows": len(results),
            "metadata": {
                "source_kind": "result_submission",
                "page_range_points": "2-16",
                "page_range_results": "17-43",
                "excluded_pages": "1,44",
                "result_submission_id": SUBMISSION_ID,
                "result_submission_batch_id": SUBMISSION_BATCH_ID,
                "point_rows": len(point_standings),
                "result_pages": result_pages,
                "point_pages": point_pages,
            },
        },
        "results": results,
        "point_standings": point_standings,
    }
    validate_payload(payload)
    return payload


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default=SOURCE_URL)
    parser.add_argument("--output", default=".cache/shenzhen-shenshan-club-finals-2025-results.json")
    args = parser.parse_args()

    pdf_path = ensure_input(args.input)
    payload = build_payload(pdf_path)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    modules: dict[str, int] = {}
    statuses: dict[str, int] = {}
    for row in payload["results"]:
        key = f"{row['discipline']} · {row['gender_group']}"
        modules[key] = modules.get(key, 0) + 1
        code = row.get("result_status_code") or "OK"
        statuses[code] = statuses.get(code, 0) + 1
    print(json.dumps({
        "output": str(output),
        "results": len(payload["results"]),
        "point_standings": len(payload["point_standings"]),
        "modules": modules,
        "statuses": statuses,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
