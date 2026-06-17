#!/usr/bin/env python3
"""Parse 2026 绿水青山中国休闲运动挑战赛宁波北仑站 result book."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

import pdfplumber


EVENT_ID = 358
SUBMISSION_ID = 31
BATCH_ID = "mp_1781489980326_rdfi0mec"
EVENT_NAME = "2026年“绿水青山”中国休闲运动挑战赛（宁波站）"
EVENT_SLUG = "lvshuiqingshan-ningbo-2026"
SOURCE_URL = "https://sport-hacker-assets.oss-cn-hangzhou.aliyuncs.com/sup-wiki/result-submissions/1/1781489981450-yfsp5d-%E6%88%90%E7%BB%A9%E5%86%8C-2026%E7%BB%BF%E6%B0%B4%E9%9D%92%E5%B1%B1%E6%8C%91%E6%88%98%E8%B5%9B-%E5%AE%81%E6%B3%A2%E5%8C%97%E4%BB%91%E7%AB%99.pdf"
FILE_NAME = "成绩册-2026绿水青山挑战赛 宁波北仑站.pdf"
DEFAULT_INPUT = "/tmp/lvshuiqingshan-ningbo-2026-results.pdf"
DEFAULT_OUTPUT = ".cache/lvshuiqingshan-ningbo-2026-results.json"

STATUS_LABELS = {
    "DNS": "未出发",
    "DNF": "未完赛",
    "DSQ": "取消成绩",
    "DQ": "取消成绩",
}
STATUS_CODES = set(STATUS_LABELS)
STATUS_BASE_RANK = {
    "DNF": 9000,
    "DSQ": 9100,
    "DQ": 9100,
    "DNS": 9200,
}
CHINESE_RANKS = {
    "第一名": 1,
    "第二名": 2,
    "第三名": 3,
}
KNOWN_TEAMS = [
    "宁波斯波特体育文化发展有限公司",
    "宁波甬炫旅游文化发展有限公司",
    "宁波栖拓文旅有限公司",
    "黄衫人水上运动俱乐部",
    "温州飞速桨板俱乐部",
    "上海远香湖金钥匙桨板俱乐部",
    "广州陆洋运动船艇科技有限公司",
    "品创建筑装饰工程有限责任公司",
    "苏州风之曲水上运动俱乐部",
    "北京whale sports户外水上运动俱乐部",
    "北仑爱尚皮划艇俱乐部",
    "青岛小顽童桨板俱乐部",
    "重庆市第七中学",
    "广东省冬泳协会",
    "江山市鲲鹏桨板俱乐部",
    "威海朝阳船艇开发有限公司",
    "浙大宁波理工学院",
    "鄞州区首南街道办事处",
    "宁波国际旅行卫生保健中心",
    "重庆江浪俱乐部",
    "杭州富阳水上协会",
    "宁波铁人三项俱乐部",
    "梅山铁人三项俱乐部",
    "梅山湾铁人三项俱乐部",
    "梅山湾潮风体育公园",
    "宁波职业技术大学",
    "滨海新城实验学校",
    "上海鲸屿体育",
    "上海浩玩体育",
    "进击桨板工作室",
    "澄爸玩桨板",
    "格兰德智能科技",
    "义桨纵横",
    "指向轻艇会",
    "阳光战队",
    "集美大学",
    "redpig",
    "NBTC",
    "Speedup",
    "sup nova水上运动社",
    "碧云皮划艇俱乐部",
    "甬士健身",
    "宁波崧峥健身",
    "汕头市华实体教融合",
    "6号俱乐部",
    "苏州恶狠狠划水组",
]


def clean(value: Any) -> str:
    text = str(value or "").strip()
    text = text.replace("（", "(").replace("）", ")")
    return re.sub(r"\s+", " ", text)


def normalize_team(value: str) -> str:
    text = clean(value)
    replacements = {
        "宁波甬炫旅游文化发展有限 公司": "宁波甬炫旅游文化发展有限公司",
        "宁波斯波特体育文化发展有限公": "宁波斯波特体育文化发展有限公司",
        "宁波斯波特体育文化发展有限 公司": "宁波斯波特体育文化发展有限公司",
        "广州陆洋运动船艇科技有限 公司": "广州陆洋运动船艇科技有限公司",
        "品创建筑装饰工程有限责任 公司": "品创建筑装饰工程有限责任公司",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    return text


def status_note(code: str | None) -> str | None:
    return STATUS_LABELS.get(code or "")


def normalize_group(value: str) -> str:
    text = clean(value)
    text = text.replace("男子 公开组", "公开男子组")
    text = text.replace("女子 公开组", "公开女子组")
    text = text.replace("男子 城市公开组", "城市公开男子组")
    text = text.replace("男子 40+组", "40+男子组")
    text = text.replace("女子 40+组", "40+女子组")
    text = text.replace("男子 青少年组", "青少年男子组")
    text = text.replace("女子 青少年组", "青少年女子组")
    text = text.replace("男子公开组", "公开男子组")
    text = text.replace("女子公开组", "公开女子组")
    text = text.replace("男子城市公开组", "城市公开男子组")
    text = text.replace("男子40+组", "40+男子组")
    text = text.replace("女子40+组", "40+女子组")
    text = text.replace("男子青少年组", "青少年男子组")
    text = text.replace("女子青少年组", "青少年女子组")
    return text


def context_from_line(line: str) -> dict[str, str] | None:
    text = clean(line)
    if "成绩单" not in text:
        return None
    title = text.replace("成绩单", "").strip()
    if "-" in title:
        discipline, group = title.split("-", 1)
        return {
            "discipline": clean(discipline),
            "gender_group": normalize_group(group),
            "round_label": "决赛",
        }
    return {
        "discipline": title,
        "gender_group": "混合组" if "混合" in title else "公开组",
        "round_label": "决赛",
    }


def is_noise(line: str) -> bool:
    text = clean(line)
    return (
        not text
        or text.startswith("2026年")
        or text.startswith("NO.")
        or text.startswith("名 次")
        or text.startswith("裁判长")
    )


def looks_like_row(line: str) -> bool:
    text = clean(line)
    return bool(
        re.match(r"^\d{1,3}\s+\d{3}\s+", text)
        or re.match(r"^(DNS|DNF|DSQ|DQ)\s+\d{3}\s+", text, re.I)
    )


def split_name_team(prefix: str, external_team: str | None = None) -> tuple[str, str]:
    prefix = clean(prefix)
    if external_team:
        return prefix, normalize_team(external_team)

    for team in sorted(KNOWN_TEAMS, key=len, reverse=True):
        if prefix == team:
            return prefix, "个人"
        if prefix.endswith(team):
            name = prefix[: -len(team)].strip()
            if name:
                return name, team
        marker = f" {team}"
        if marker in prefix:
            name = prefix.split(marker, 1)[0].strip()
            if name:
                return name, team

    parts = prefix.split(" ", 1)
    if len(parts) == 1:
        return parts[0], "个人"
    return parts[0], normalize_team(parts[1] or "个人")


def parse_row(line: str, context: dict[str, str], page_number: int, status_counts: dict[str, int], external_team: str | None = None) -> dict[str, Any] | None:
    text = clean(line)
    ranked = re.match(r"^(\d{1,3})\s+(\d{3})\s+(.+?)\s+(\d{2}:\d{2}:\d{2})(?:\s+(.*))?$", text)
    status = None if ranked else re.match(r"^(DNS|DNF|DSQ|DQ)\s+(\d{3})\s+(.+?)\s+(DNS|DNF|DSQ|DQ)(?:\s+(.*))?$", text, re.I)
    if ranked:
        rank_position = int(ranked.group(1))
        bib = ranked.group(2)
        prefix = ranked.group(3)
        finish_time = ranked.group(4)
        result_label = clean(ranked.group(5)) or None
        code = None
    elif status:
        code = status.group(1).upper()
        bib = status.group(2)
        prefix = status.group(3)
        finish_time = status.group(4).upper()
        result_label = clean(status.group(5)) or None
        status_counts[code] = status_counts.get(code, 0) + 1
        rank_position = STATUS_BASE_RANK.get(code, 9900) + status_counts[code]
    else:
        return None

    athlete_name, team_name = split_name_team(prefix, external_team)
    team_members = athlete_name.split("/") if "/" in athlete_name else []
    return {
        "athlete_name_snapshot": athlete_name,
        "bib_number": bib,
        "gender_group": context["gender_group"],
        "discipline": context["discipline"],
        "board_class": None,
        "round_label": context.get("round_label") or "决赛",
        "rank_position": rank_position,
        "result_label": result_label,
        "finish_time": finish_time,
        "result_status_code": code,
        "result_status_note": status_note(code),
        "points": None,
        "team_name": team_name or "个人",
        "team_members": team_members,
        "nationality_snapshot": "中国",
        "source_locator": f"page:{page_number}",
        "source_note": f"{context['discipline']} {context['gender_group']}",
        "parse_confidence": 0.96,
        "review_status": "confirmed",
        "is_verified": True,
    }


def repair_results(results: list[dict[str, Any]]) -> None:
    for item in results:
        name = item["athlete_name_snapshot"]
        team = item["team_name"]
        bib = item.get("bib_number")
        if bib == "154" and name == "NBTC":
            item["athlete_name_snapshot"] = "Katerina Brozovska"
            item["team_name"] = "NBTC"
            item["nationality_snapshot"] = "捷克"
            item["parse_confidence"] = 0.9
        elif bib == "224" and name == "NBTC":
            item["athlete_name_snapshot"] = "Martin Brozovsky"
            item["team_name"] = "NBTC"
            item["nationality_snapshot"] = "捷克"
            item["parse_confidence"] = 0.9
        elif bib == "359" and name.startswith("焦思齐"):
            item["athlete_name_snapshot"] = "焦思齐"
            item["team_name"] = "宁波斯波特体育文化发展有限公司"
            item["parse_confidence"] = 0.9
        elif bib == "903" and item["result_status_code"] == "DSQ":
            item["team_name"] = "宁波甬炫旅游文化发展有限公司"
            item["parse_confidence"] = 0.9
        elif bib == "310" and name.startswith("徐浩桐"):
            item["athlete_name_snapshot"] = "徐浩桐"
            item["team_name"] = "北京whale sports户外水上运动俱乐部"
            item["parse_confidence"] = 0.9
        if team == "宁波甬炫旅游文化发展有限":
            item["team_name"] = "宁波甬炫旅游文化发展有限公司"


def parse_results(pdf_path: Path) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    current: dict[str, str] | None = None
    status_counts: dict[str, int] = {}
    previous_fragment: str | None = None

    with pdfplumber.open(str(pdf_path)) as pdf:
        for page_number, page in enumerate(pdf.pages, 1):
            if page_number < 6 or page_number > 25:
                continue
            lines = [clean(line) for line in (page.extract_text(x_tolerance=2, y_tolerance=3) or "").splitlines()]
            index = 0
            while index < len(lines):
                line = clean(lines[index])
                found = context_from_line(line)
                if found:
                    current = found
                    previous_fragment = None
                    index += 1
                    continue
                if not current or is_noise(line):
                    index += 1
                    continue
                if looks_like_row(line):
                    next_line = clean(lines[index + 1]) if index + 1 < len(lines) else ""
                    external_team = None
                    if previous_fragment and next_line == "公司":
                        external_team = previous_fragment + next_line
                        previous_fragment = None
                        index += 1
                    row = parse_row(line, current, page_number, status_counts, external_team=external_team)
                    if row:
                        results.append(row)
                    index += 1
                    continue
                previous_fragment = line
                index += 1

    repair_results(results)
    return results


def parse_point_standings(pdf_path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with pdfplumber.open(str(pdf_path)) as pdf:
        for page_number in (26, 27):
            page = pdf.pages[page_number - 1]
            lines = [clean(line) for line in (page.extract_text(x_tolerance=2, y_tolerance=3) or "").splitlines()]
            for line in lines:
                if not line or line.startswith(("2026年", "(", "团体总分", "名次", "注：")):
                    continue
                ranked = re.match(r"^(\d{1,2})\s+(.+?)\s+(\d+(?:\.\d+)?)$", line)
                if ranked:
                    rank = int(ranked.group(1))
                    team = normalize_team(ranked.group(2))
                    points = float(ranked.group(3))
                else:
                    unranked = re.match(r"^(.+?)\s+0$", line)
                    if not unranked:
                        continue
                    rank = 9000 + len([r for r in rows if r["rank_position"] >= 9000]) + 1
                    team = normalize_team(unranked.group(1))
                    points = 0.0
                rows.append({
                    "group_name": "团体总分",
                    "rank_position": rank,
                    "status_rank": None if rank < 9000 else "未排名",
                    "bib_number": None,
                    "athlete_name_snapshot": team,
                    "team_name": team,
                    "endurance_rank": None,
                    "endurance_points": None,
                    "sprint_rank": None,
                    "sprint_points": None,
                    "total_points": points,
                    "source_locator": f"page:{page_number}",
                })
    return rows


def build_payload(pdf_path: Path) -> dict[str, Any]:
    results = parse_results(pdf_path)
    point_standings = parse_point_standings(pdf_path)
    return {
        "event": {
            "event_id": EVENT_ID,
            "name": EVENT_NAME,
            "slug": EVENT_SLUG,
            "start_date": "2026-06-14",
            "end_date": "2026-06-14",
            "province": "浙江",
            "city": "宁波",
            "venue": "梅山湾",
            "source_scope": "用户提交成绩册导入",
            "result_status": "extended_complete",
        },
        "source": {
            "original_path": str(pdf_path),
            "file_name": FILE_NAME,
            "file_type": "pdf",
            "source_url": SOURCE_URL,
            "result_submission_id": SUBMISSION_ID,
            "result_submission_batch_id": BATCH_ID,
            "parser_name": "parse-lvshuiqingshan-ningbo-2026-results.py",
            "parser_status": "parsed",
            "parser_note": "解析页6-25完整成绩明细；页26-27团体总分；跳过页2-5前三名摘要避免重复。",
            "extracted_rows": len(results),
            "imported_rows": len(results),
            "metadata": {
                "source_kind": "user_result_submission",
                "page_range": "6-27",
                "submission_id": SUBMISSION_ID,
                "batch_id": BATCH_ID,
                "point_standings": len(point_standings),
            },
        },
        "results": results,
        "point_standings": point_standings,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default=DEFAULT_INPUT)
    parser.add_argument("--output", default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    pdf_path = Path(args.input)
    if not pdf_path.exists():
        raise SystemExit(f"PDF not found: {pdf_path}")
    payload = build_payload(pdf_path)
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    status_counts: dict[str, int] = {}
    for row in payload["results"]:
        key = row.get("result_status_code") or "OK"
        status_counts[key] = status_counts.get(key, 0) + 1
    modules = sorted(set((r["discipline"], r["gender_group"]) for r in payload["results"]))
    print(f"results={len(payload['results'])} modules={len(modules)} statuses={status_counts} point_standings={len(payload['point_standings'])} output={output_path}")


if __name__ == "__main__":
    main()
