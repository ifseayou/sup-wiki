#!/usr/bin/env python3
"""Parse 2026 中国桨板精英联赛（无锡站） result book."""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

import pdfplumber


EVENT_ID = 386
SUBMISSION_ID = 35
BATCH_ID = "mp_1783304553728_z2743en7"
EVENT_NAME = "2026年中国桨板精英联赛（无锡站）"
EVENT_SLUG = "china-sup-elite-league-wuxi-2026"
SOURCE_URL = (
    "https://sport-hacker-assets.oss-cn-hangzhou.aliyuncs.com/"
    "sup-wiki/result-submissions/1/"
    "1783304554724-m6bp4x-%E6%88%90%E7%BB%A9%E5%86%8C-%E6%97%A0%E9%94%A1.pdf"
)
PUBLIC_SOURCE_URL = f"https://sup.iaddu.cn/result-books/{EVENT_SLUG}/results-book.pdf"
FILE_NAME = "成绩册-无锡.pdf"
DEFAULT_INPUT = ".cache/result-submissions/mp_1783304553728_z2743en7/results-book.pdf"
DEFAULT_OUTPUT = f".cache/{EVENT_SLUG}-results.json"

STATUS_LABELS = {
    "DNS": "未出发",
    "DNF": "未完赛",
    "DQ": "取消成绩",
    "DSQ": "取消成绩",
    "DSQ-R": "取消成绩",
}
STATUS_BASE_RANK = {
    "DNF": 9000,
    "DSQ": 9100,
    "DSQ-R": 9100,
    "DQ": 9100,
    "DNS": 9200,
}


def clean(value: Any) -> str:
    text = str(value or "").replace("\u3000", " ").strip()
    text = text.replace("：", ":")
    return re.sub(r"\s+", " ", text)


def page_text(page: pdfplumber.page.Page) -> str:
    return page.extract_text(layout=True, x_tolerance=2, y_tolerance=3) or ""


def normalize_status(value: str | None) -> str | None:
    text = clean(value).upper().replace("DSQ R", "DSQ-R")
    if text in STATUS_LABELS:
        return text
    if text.startswith("DSQ"):
        return "DSQ"
    if text in {"DNS", "DNF", "DQ"}:
        return text
    return None


def normalize_finish(value: str | None) -> str:
    text = clean(value)
    code = normalize_status(text)
    if code:
        return code
    if not text or text == "/":
        return "/"
    return text


def time_seconds(value: str | None) -> float | None:
    text = normalize_finish(value)
    if normalize_status(text) or text == "/":
        return None
    match = re.fullmatch(r"(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d+))?|\.(\d+))", text)
    if not match:
        return None
    first, second, third, frac_a, frac_b = match.groups()
    if third is not None:
        return int(first) * 3600 + int(second) * 60 + int(third) + (float(f"0.{frac_a}") if frac_a else 0)
    return int(first) * 60 + int(second) + (float(f"0.{frac_b}") if frac_b else 0)


def status_note(code: str | None) -> str | None:
    return STATUS_LABELS.get(code or "")


def normalize_group(raw: str) -> str:
    text = clean(raw).replace("组男子", "男子组").replace("组女子", "女子组")
    text = text.replace("公开组男子", "公开男子组").replace("公开组女子", "公开女子组")
    text = text.replace("40+组男子", "40+男子组").replace("40+组女子", "40+女子组")
    text = text.replace("50+组男子", "50+男子组").replace("50+组女子", "50+女子组")
    text = text.replace("青少年组男子", "青少年男子组").replace("青少年组女子", "青少年女子组")
    text = text.replace("高校组男子", "高校男子组").replace("高校组女子", "高校女子组")
    text = text.replace("U12组男子", "U12男子组").replace("U12组女子", "U12女子组")
    text = text.replace("U15组男子", "U15男子组").replace("U15组女子", "U15女子组")
    return text


def split_title(title: str) -> tuple[str, str, str]:
    text = clean(title).replace("成绩单", "").strip()
    if "-" in text:
        race_type, rest = text.split("-", 1)
    else:
        race_type, rest = "", text
    race_type = clean(race_type)
    if "-" in rest:
        group, discipline = rest.rsplit("-", 1)
    else:
        group, discipline = rest, ""
    group_name = normalize_group(group)
    return race_type, group_name, clean(discipline)


def find_titles(text: str) -> list[str]:
    titles: list[str] = []
    for raw in text.splitlines():
        line = clean(raw)
        if "成绩单" not in line:
            continue
        if "年中国桨板" in line:
            continue
        line = line.replace("  ", " ")
        titles.append(line)
    return titles


def context_from_title(title: str, fallback_discipline: str | None = None) -> dict[str, str]:
    race_type, group, discipline = split_title(title)
    if not discipline:
        discipline = fallback_discipline or "成绩"
    if race_type:
        gender_group = f"{race_type}-{group}"
    else:
        gender_group = group
    return {
        "race_type": race_type,
        "gender_group": gender_group,
        "discipline": discipline,
    }


def endurance_context(page_no: int, text: str) -> dict[str, str] | None:
    title = next((item for item in find_titles(text) if "-" in item), "")
    if not title:
        return None
    discipline_match = re.search(r"(3km耐力赛|6km耐力赛)", text, re.I)
    discipline = discipline_match.group(1).replace("KM", "km") if discipline_match else None
    return context_from_title(title, discipline)


def make_result(
    *,
    context: dict[str, str],
    page_no: int,
    rank: int | None,
    bib: str | None,
    name: str,
    team: str,
    finish: str,
    note: str | None,
    status_counts: dict[str, int],
    round_label: str = "决赛",
    members: list[str] | None = None,
    entry_type: str = "individual",
) -> dict[str, Any]:
    status = normalize_status(finish)
    finish_time = normalize_finish(finish)
    result_note = clean(note)
    if status:
        status_counts[status] = status_counts.get(status, 0) + 1
        rank_position = rank if rank is not None else STATUS_BASE_RANK.get(status, 9900) + status_counts[status]
    else:
        rank_position = int(rank or 0)
    if rank_position <= 0:
        raise ValueError(f"invalid rank page:{page_no} {name} {finish}")
    label = result_note or None
    return {
        "athlete_name_snapshot": clean(name),
        "bib_number": clean(bib) or None,
        "gender_group": context["gender_group"],
        "discipline": context["discipline"],
        "board_class": None,
        "round_label": round_label,
        "rank_position": rank_position,
        "result_label": label,
        "finish_time": finish_time,
        "result_status_code": status,
        "result_status_note": status_note(status),
        "time_seconds": time_seconds(finish_time),
        "points": None,
        "team_name": clean(team) or "个人",
        "team_members": members or [],
        "nationality_snapshot": "中国",
        "source_locator": f"page:{page_no}",
        "source_note": f"{context['gender_group']} {context['discipline']}",
        "parse_confidence": 0.96 if entry_type == "team" else 0.98,
        "review_status": "confirmed",
        "is_verified": True,
        "entry_type": entry_type,
    }


def parse_endurance_page(page: pdfplumber.page.Page, page_no: int, previous: dict[str, str] | None, status_counts: dict[str, int]) -> tuple[list[dict[str, Any]], dict[str, str] | None]:
    text = page_text(page)
    context = endurance_context(page_no, text) or previous
    if not context:
        return [], previous
    rows: list[dict[str, Any]] = []
    for table in page.extract_tables():
        for raw in table[1:]:
            if not raw or len(raw) < 5:
                continue
            rank_raw = clean(raw[0])
            bib = clean(raw[1])
            name = clean(raw[2])
            team = clean(raw[3]) or "个人"
            finish = clean(raw[4])
            note = clean(raw[5] if len(raw) > 5 else "")
            if not bib or not name or not finish:
                continue
            rank = int(rank_raw) if rank_raw.isdigit() else None
            rows.append(make_result(context=context, page_no=page_no, rank=rank, bib=bib, name=name, team=team, finish=finish, note=note, status_counts=status_counts))
    return rows, context


def line_contexts(lines: list[str]) -> list[tuple[int, dict[str, str]]]:
    contexts: list[tuple[int, dict[str, str]]] = []
    for index, line in enumerate(lines):
        text = clean(line)
        if "成绩单" in text and "年中国桨板" not in text:
            contexts.append((index, context_from_title(text)))
    return contexts


def parse_individual_layout_page(page: pdfplumber.page.Page, page_no: int, previous: dict[str, str] | None, status_counts: dict[str, int]) -> tuple[list[dict[str, Any]], dict[str, str] | None]:
    lines = page_text(page).splitlines()
    context_marks = line_contexts(lines)
    rows: list[dict[str, Any]] = []
    current = previous
    mark_index = 0
    for index, raw in enumerate(lines):
        if mark_index < len(context_marks) and index >= context_marks[mark_index][0]:
            current = context_marks[mark_index][1]
            mark_index += 1
            continue
        if not current:
            continue
        line = clean(raw)
        if not line or line.startswith(("名次 ", "裁判长", "NO.")):
            continue
        match = re.match(
            r"^(?P<rank>\d{1,3}|DNS|DNF|DSQ|DQ)\s+"
            r"(?:(?P<round>决赛|半决赛|预赛|排名赛)\s+)?"
            r"(?P<bib>[A-Z]?\d{2,4})\s+(?P<name>\S+)\s+"
            r"(?P<team>.+?)\s+(?P<finish>\d{2}:\d{2}(?::\d{2}|[.:]\d{2})?|DNS|DNF|DSQ(?:-R)?|DQ|/)"
            r"(?:\s+(?P<note>.*))?$",
            line,
            re.I,
        )
        if not match:
            continue
        rank_text = match.group("rank").upper()
        status_rank = normalize_status(rank_text)
        rank = None if status_rank else int(rank_text)
        finish = match.group("finish")
        note = clean(match.group("note"))
        rows.append(
            make_result(
                context=current,
                page_no=page_no,
                rank=rank,
                bib=match.group("bib"),
                name=match.group("name"),
                team=match.group("team"),
                finish=finish if not status_rank else rank_text,
                note=note,
                status_counts=status_counts,
                round_label=match.group("round") or "决赛",
            )
        )
    return rows, current


def split_members(value: str) -> list[str]:
    items = re.findall(r"[A-Z]?\d{2,4}([\u4e00-\u9fffA-Za-z·]+)", value)
    return [clean(item) for item in items if clean(item)]


def split_team_result_body(body: str) -> tuple[list[str], str]:
    matches = list(re.finditer(r"[A-Z]?\d{2,4}([\u4e00-\u9fffA-Za-z·]+)", body))
    if not matches:
        return [], clean(body)
    members = [clean(match.group(1)) for match in matches]
    team = clean(body[matches[-1].end() :])
    return members, team


def parse_team_layout_page(page: pdfplumber.page.Page, page_no: int, status_counts: dict[str, int]) -> list[dict[str, Any]]:
    text = page_text(page)
    title = next((item for item in find_titles(text)), "")
    if not title:
        for raw in text.splitlines():
            line = clean(raw)
            if "家庭三人龙板" in line or "双人板" in line or "四人龙板" in line:
                title = line
                break
    if not title:
        return []
    context = {"gender_group": "混合组", "discipline": title.replace("成绩单", "").strip()}
    rows: list[dict[str, Any]] = []
    current_round = "排名赛"
    for raw in text.splitlines():
        line = clean(raw)
        if "决赛" in line and line.startswith("NO."):
            current_round = "决赛"
            continue
        if "排名赛" in line and line.startswith("NO."):
            current_round = "排名赛"
            continue
        match = re.match(
            r"^(?P<rank>\d{1,3})\s+(?P<start>\d{1,2})\s+(?P<body>.+?)\s+"
            r"(?P<finish>\d{2}:\d{2}(?:\.\d{2})?|DNS|DNF|DSQ(?:-R)?|DQ)(?:\s+(?P<note>.*))?$",
            line,
            re.I,
        )
        if not match:
            continue
        members, team = split_team_result_body(clean(match.group("body")))
        rows.append(
            make_result(
                context=context,
                page_no=page_no,
                rank=int(match.group("rank")),
                bib=None,
                name=team,
                team=team,
                finish=match.group("finish"),
                note=clean(match.group("note")),
                status_counts=status_counts,
                round_label=current_round,
                members=members,
                entry_type="team",
            )
        )
    return rows


def parse_result_pages(pdf: pdfplumber.PDF) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    status_counts: dict[str, int] = {}
    context: dict[str, str] | None = None
    for page_no in range(2, 26):
        rows, context = parse_endurance_page(pdf.pages[page_no - 1], page_no, context, status_counts)
        results.extend(rows)
    context = None
    for page_no in range(26, 48):
        rows, context = parse_individual_layout_page(pdf.pages[page_no - 1], page_no, context, status_counts)
        results.extend(rows)
    for page_no in range(48, 51):
        results.extend(parse_team_layout_page(pdf.pages[page_no - 1], page_no, status_counts))
    return results


def parse_number(value: str | None) -> float | None:
    text = clean(value)
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def parse_rank(value: str | None) -> str | None:
    text = clean(value).upper()
    if not text or text in {"·", "-", "/"}:
        return None
    return text


def point_context_from_line(line: str) -> tuple[str, bool] | None:
    text = clean(line)
    if "个人赛成绩积分" not in text:
        return None
    title = text.replace("个人赛成绩积分", "").strip()
    race_type, group, _ = split_title(f"{title}-积分")
    group = f"{race_type}-{group}" if race_type else group
    return group, "精英赛" in race_type


def parse_personal_points_page(page: pdfplumber.page.Page, page_no: int, previous: tuple[str, bool] | None) -> tuple[list[dict[str, Any]], tuple[str, bool] | None]:
    lines = page_text(page).splitlines()
    context = previous
    rows: list[dict[str, Any]] = []
    for raw in lines:
        line = clean(raw)
        if not line:
            continue
        next_context = point_context_from_line(line)
        if next_context:
            context = next_context
            continue
        if not context:
            continue
        group_name, has_technical = context
        if has_technical:
            match = re.match(
                r"^(?P<bib>[A-Z]?\d{1,4})\s+(?P<name>\S+)\s+(?P<team>.+?)\s+"
                r"(?P<end_rank>DNS|DNF|DSQ|DQ|\d{1,3})\s+(?P<end_points>\d+(?:\.\d+)?)\s+"
                r"(?P<sprint_rank>DNS|DNF|DSQ|DQ|\d{1,3})?\s*(?P<sprint_points>\d+(?:\.\d+)?)\s+"
                r"(?P<tech_rank>DNS|DNF|DSQ|DQ|\d{1,3})?\s*(?P<tech_points>\d+(?:\.\d+)?)\s+"
                r"(?P<total>\d+(?:\.\d+)?)$",
                line,
                re.I,
            )
        else:
            match = re.match(
                r"^(?P<rank>\d{1,3}|·)?\s*(?P<bib>[A-Z]?\d{2,4})\s+(?P<name>\S+)\s+(?P<team>.+?)\s+"
                r"(?P<end_rank>DNS|DNF|DSQ|DQ|\d{1,3})\s+(?P<end_points>\d+(?:\.\d+)?)\s+"
                r"(?P<sprint_rank>DNS|DNF|DSQ|DQ|\d{1,3})?\s*(?P<sprint_points>\d+(?:\.\d+)?)\s+"
                r"(?P<total>\d+(?:\.\d+)?)$",
                line,
                re.I,
            )
        if not match:
            continue
        data = match.groupdict()
        rank_text = clean(data.get("rank"))
        rows.append({
            "group_name": group_name,
            "rank_position": int(rank_text) if rank_text.isdigit() else None,
            "status_rank": None if rank_text.isdigit() else ("未排名" if rank_text == "·" else None),
            "bib_number": data["bib"],
            "athlete_name_snapshot": clean(data["name"]),
            "team_name": clean(data["team"]) or "个人",
            "endurance_rank": parse_rank(data.get("end_rank")),
            "endurance_points": parse_number(data.get("end_points")),
            "sprint_rank": parse_rank(data.get("sprint_rank")),
            "sprint_points": parse_number(data.get("sprint_points")),
            "technical_rank": parse_rank(data.get("tech_rank")) if has_technical else None,
            "technical_points": parse_number(data.get("tech_points")) if has_technical else None,
            "total_points": parse_number(data.get("total")),
            "source_locator": f"page:{page_no}",
        })
    return rows, context


def parse_team_points_page(page: pdfplumber.page.Page, page_no: int, group_name: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for raw in page_text(page).splitlines():
        line = clean(raw)
        match = re.match(r"^(?P<rank>\d{1,3})\s+(?P<team>.+?)\s+(?P<count>\d{1,3})\s+(?P<total>\d+(?:\.\d+)?)$", line)
        if not match:
            continue
        team = clean(match.group("team"))
        rows.append({
            "group_name": group_name,
            "rank_position": int(match.group("rank")),
            "status_rank": None,
            "bib_number": None,
            "athlete_name_snapshot": team,
            "team_name": team,
            "endurance_rank": None,
            "endurance_points": None,
            "sprint_rank": clean(match.group("count")),
            "sprint_points": None,
            "technical_rank": None,
            "technical_points": None,
            "total_points": parse_number(match.group("total")),
            "source_locator": f"page:{page_no}",
        })
    return rows


def parse_point_pages(pdf: pdfplumber.PDF) -> list[dict[str, Any]]:
    points: list[dict[str, Any]] = []
    context: tuple[str, bool] | None = None
    for page_no in range(51, 75):
        rows, context = parse_personal_points_page(pdf.pages[page_no - 1], page_no, context)
        points.extend(rows)
    points.extend(parse_team_points_page(pdf.pages[74], 75, "优秀参赛单位"))
    points.extend(parse_team_points_page(pdf.pages[75], 76, "优秀参赛单位"))
    points.extend(parse_team_points_page(pdf.pages[76], 77, "高校团体积分"))
    return points


def validate_payload(payload: dict[str, Any], page_count: int) -> None:
    if page_count != 77:
        raise RuntimeError(f"PDF页数异常：期望77，实际{page_count}")
    results = payload["results"]
    points = payload["point_standings"]
    if len(results) < 700:
        raise RuntimeError(f"成绩行数过少：{len(results)}")
    if len(points) < 360:
        raise RuntimeError(f"积分行数过少：{len(points)}")
    result_keys = Counter((r["gender_group"], r["discipline"], r.get("round_label"), r["rank_position"], r["athlete_name_snapshot"]) for r in results)
    duplicates = [key for key, count in result_keys.items() if count > 1]
    if duplicates:
        raise RuntimeError(f"重复成绩行：{duplicates[:5]}")
    rank_ones: dict[tuple[str, str, str], int] = defaultdict(int)
    for row in results:
        if row["rank_position"] == 1 and not row.get("result_status_code") and row.get("round_label") == "决赛":
            rank_ones[(row["gender_group"], row["discipline"], row.get("round_label") or "")] += 1
    bad = {key: count for key, count in rank_ones.items() if count != 1}
    if bad:
        raise RuntimeError(f"决赛模块第一名数量异常：{bad}")

    def has_result(group: str, discipline: str, name: str, finish: str) -> bool:
        return any(row["gender_group"] == group and row["discipline"] == discipline and row["athlete_name_snapshot"] == name and row["finish_time"] == finish for row in results)

    def has_point(group: str, name: str, total: float) -> bool:
        return any(row["group_name"] == group and row["athlete_name_snapshot"] == name and float(row["total_points"] or 0) == total for row in points)

    checks = [
        has_result("精英赛-青少年男子组", "3km耐力赛", "肖森予", "00:18:43"),
        has_result("精英赛-公开男子组", "6km耐力赛", "钟梓进", "00:33:31"),
        has_result("精英赛-青少年女子组", "500m技术赛", "陈锦萌", "03:46.58"),
        has_result("大众赛-40+男子组", "100m冲刺赛", "龙俊", "00:29.93"),
        has_result("混合组", "家庭三人龙板-100米冲刺赛", "义桨纵横1队", "00:27.63"),
        has_point("优秀参赛单位", "自由动力-江阴水上运动俱乐部", 7188.4),
        has_point("高校团体积分", "河北美术学院", 2573.0),
    ]
    if not all(checks):
        raise RuntimeError(f"关键样本校验失败：{checks}")


def build_payload(pdf_path: Path) -> dict[str, Any]:
    with pdfplumber.open(str(pdf_path)) as pdf:
        results = parse_result_pages(pdf)
        points = parse_point_pages(pdf)
        payload = {
            "event": {
                "event_id": EVENT_ID,
                "name": EVENT_NAME,
                "slug": EVENT_SLUG,
                "start_date": "2026-07-04",
                "end_date": "2026-07-05",
                "province": "江苏省",
                "city": "无锡市",
                "venue": "梁溪区清名桥历史文化街区",
                "event_status": "completed",
                "result_status": "extended_complete",
                "source_scope": "用户提交成绩册导入",
                "result_source_note": "用户提交成绩册导入：录入2026中国桨板精英联赛（无锡站）成绩与个人/团体/高校积分。",
            },
            "source": {
                "original_path": str(pdf_path),
                "file_name": FILE_NAME,
                "file_type": "pdf",
                "source_url": PUBLIC_SOURCE_URL,
                "result_submission_id": SUBMISSION_ID,
                "result_submission_batch_id": BATCH_ID,
                "parser_name": "parse-wuxi-elite-league-2026-results.py",
                "parser_status": "parsed",
                "parser_note": "解析成绩册第2-50页成绩、第51-77页个人与团体积分；第1页空白忽略。",
                "extracted_rows": len(results),
                "imported_rows": len(results),
                "metadata": {
                    "source_kind": "result_submission",
                    "result_submission_id": SUBMISSION_ID,
                    "result_submission_batch_id": BATCH_ID,
                    "page_count": len(pdf.pages),
                    "result_pages": "2-50",
                    "point_pages": "51-77",
                    "point_rows": len(points),
                },
            },
            "results": results,
            "point_standings": points,
        }
        validate_payload(payload, len(pdf.pages))
        return payload


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", type=Path, default=Path(DEFAULT_INPUT))
    parser.add_argument("-o", "--output", type=Path, default=Path(DEFAULT_OUTPUT))
    args = parser.parse_args()

    payload = build_payload(args.pdf)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    statuses = Counter(row.get("result_status_code") or "OK" for row in payload["results"])
    modules = Counter((row["gender_group"], row["discipline"], row.get("round_label") or "") for row in payload["results"])
    point_groups = Counter(row["group_name"] for row in payload["point_standings"])
    print(f"results={len(payload['results'])} modules={len(modules)} statuses={dict(statuses)}")
    print(f"point_standings={len(payload['point_standings'])} point_groups={len(point_groups)}")
    for key, count in sorted(point_groups.items()):
        print(f"point_group {key}: {count}")
    print(f"output={args.output}")


if __name__ == "__main__":
    main()
