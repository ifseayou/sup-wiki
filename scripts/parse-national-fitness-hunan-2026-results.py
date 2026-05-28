#!/usr/bin/env python3
import argparse
import json
import re
import urllib.request
from pathlib import Path
from typing import Any

from pypdf import PdfReader


EVENT_NAME = "第二届全国全民健身大赛（湖南赛区）桨板比赛"
EVENT_SLUG = "national-fitness-hunan-sup-2026"
SOURCE_URL = (
    "https://sport-hacker-assets.oss-cn-hangzhou.aliyuncs.com/"
    "sup-wiki/result-submissions/559/"
    "1779948962717-f7sa3m-tmp_afdc06e2e7fce82aa51b31d42e3085de50198aadfa51d605.pdf"
)
DISPLAY_FILE_NAME = "第二届全国全民健身大赛（湖南赛区）桨板比赛成绩册.pdf"

TEAMS = sorted([
    "邵阳县塘渡口镇霞塘云初级中学",
    "长沙市芙蓉区朝阳小学",
    "郴州北湖区杰士攀体育战队",
    "CSC星城桨板联盟代表队（长沙市）",
    "江华瑶都水上运动协会",
    "株洲YUKIE桨板瑜伽",
    "郴州领航体育战队",
    "郴州市体育学校",
    "长沙市代表队",
    "衡阳代表队",
    "益阳市代表队",
], key=len, reverse=True)

STATUS_LABELS = {
    "DNS": "未出发",
    "DNF": "未完赛",
    "DQ": "取消成绩",
    "DSQ": "取消成绩",
    "DNQ": "未晋级",
    "OTL": "超过关门时间",
}
KNOWN_STATUS_CODES = set(STATUS_LABELS)
RAW_STATUS_CODES = KNOWN_STATUS_CODES | {"DMS"}
RESULT_PATTERN = r"(?:\d{2}:\d{2}:\d{2}\.\d{1,3}|\d{2}:\d{2}:\d{2}|\d{2}:\d{2}\.\d{1,3}|DNS|DNF|DQ|DSQ|DNQ|OTL|DMS)"


def clean(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def compact(value: Any) -> str:
    return clean(value).replace(" ", "")


def download_pdf(target: Path, refresh: bool = False) -> Path:
    if target.exists() and not refresh:
        return target
    target.parent.mkdir(parents=True, exist_ok=True)
    urllib.request.urlretrieve(SOURCE_URL, target)
    return target


def module_title(text: str) -> str:
    lines = [clean(line) for line in text.splitlines() if clean(line)]
    for index, line in enumerate(lines):
        if line == "成绩公告" and index > 0:
            return lines[index - 1]
        if line.endswith("成绩公告") and "桨板比赛" not in line:
            return line[:-4]
    raise ValueError("Cannot find result module title")


def normalize_module(title: str) -> tuple[str, str]:
    text = clean(title).replace("冲剌", "冲刺")
    if "3000" in text:
        return text.split("3000")[0], "3000米耐力赛"
    return re.split(r"200M|200米", text)[0], "200米冲刺赛"


def normalize_finish_time(raw: str, discipline: str) -> str:
    text = clean(raw).upper().replace("：", ":")
    if text in RAW_STATUS_CODES:
        return text
    if re.fullmatch(r"\d{2}:\d{2}\.\d{1,3}", text):
        minutes, rest = text.split(":")
        seconds, fraction = rest.split(".")
        return f"00:{int(minutes):02d}:{int(seconds):02d}.{fraction}"
    if re.fullmatch(r"\d{2}:\d{2}:\d{2}", text):
        first, second, third = text.split(":")
        if discipline.startswith("200"):
            return f"00:{int(first):02d}:{int(second):02d}.{third}"
        return f"{int(first):02d}:{int(second):02d}:{int(third):02d}"
    return text


def split_name_team(body: str) -> tuple[str, str]:
    text = clean(body)
    sex_column = re.match(r"^(.+?)\s+(男|女)(?:[（(].+?[）)])?\s+(.+)$", text)
    if sex_column:
        text = clean(f"{sex_column.group(1)} {sex_column.group(3)}")

    compacted = compact(text)
    for team in TEAMS:
        team_compacted = compact(team)
        if compacted.endswith(team_compacted):
            return compacted[:-len(team_compacted)], team

    parts = text.split(" ")
    if len(parts) >= 2:
        return compact(parts[0]), clean(" ".join(parts[1:])) or "个人"
    raise ValueError(f"Cannot split athlete/team: {body}")


def split_members(name: str) -> list[str]:
    members = []
    for part in compact(name).split("/"):
        member = re.sub(r"[（(].*?[）)]", "", part).strip()
        if member:
            members.append(member)
    return members


def is_noise(line: str) -> bool:
    return (
        not line
        or line.startswith(("NO.", "名次 ", "第二届全国", "地点：", "2026.4.25", "总裁判长"))
        or line == "成绩公告"
    )


def is_row_start(line: str) -> bool:
    return bool(
        re.match(r"^(?:\d{1,3}\s+)?(?:\d+(?:/\d+)*)", line)
        or re.match(r"^[\u4e00-\u9fff]{2,4}/[\u4e00-\u9fff]{2,4}\s+", line)
    )


def has_result_value(line: str) -> bool:
    return bool(re.search(rf"\s{RESULT_PATTERN}(?:\s+\d+)?$", line, re.I))


def parse_row(buffer: str, gender_group: str, discipline: str, page_number: int, status_index: int) -> tuple[dict[str, Any], int]:
    line = clean(buffer)
    line = re.sub(r"^(\d+\s+)(\d+(?:/\d+)+)(?=[\u4e00-\u9fff])", r"\1\2 ", line)
    match = re.match(
        rf"^(?:(?P<rank>\d{{1,3}})\s+)?(?:(?P<bib>\d+(?:/\d+)*)\s+)?(?P<body>.+?)\s+"
        rf"(?P<finish>{RESULT_PATTERN})(?:\s+(?P<points>\d+))?$",
        line,
        re.I,
    )
    if not match:
        raise ValueError(f"Unparsed row on page {page_number}: {line}")

    rank_raw = match.group("rank")
    bib_number = match.group("bib") or ""
    finish_raw = match.group("finish").upper()
    finish_time = normalize_finish_time(finish_raw, discipline)
    status_code = finish_raw if finish_raw in KNOWN_STATUS_CODES else None
    unsupported_status = finish_raw in RAW_STATUS_CODES and status_code is None

    if rank_raw and not bib_number and finish_raw in RAW_STATUS_CODES:
        bib_number = rank_raw
        rank_raw = None

    if rank_raw:
        rank_position = int(rank_raw)
    else:
        status_index += 1
        rank_position = 9000 + status_index

    athlete_name, team_name = split_name_team(match.group("body"))
    team_members = split_members(athlete_name)

    return {
        "athlete_name_snapshot": athlete_name,
        "bib_number": bib_number or None,
        "gender_group": gender_group,
        "discipline": discipline,
        "board_class": "桨板",
        "round_label": "决赛",
        "rank_position": rank_position,
        "result_label": None,
        "finish_time": finish_time,
        "result_status_code": status_code,
        "result_status_note": STATUS_LABELS.get(status_code or "") or ("原文状态：DMS（待人工核验）" if unsupported_status else ""),
        "points": None,
        "team_name": team_name,
        "team_members": team_members,
        "nationality_snapshot": "中国",
        "source_locator": f"page:{page_number}",
        "source_note": f"{gender_group} {discipline}",
        "parse_confidence": 0.99 if not unsupported_status else 0.6,
        "review_status": "needs_review" if unsupported_status else "confirmed",
        "is_verified": not unsupported_status,
    }, status_index


def parse_pdf(path: Path) -> dict[str, Any]:
    reader = PdfReader(str(path))
    results: list[dict[str, Any]] = []

    for page_number in range(13, 43):
        page = reader.pages[page_number - 1]
        text = page.extract_text() or ""
        title = module_title(text)
        gender_group, discipline = normalize_module(title)
        status_index = 0
        buffer = ""

        for raw in text.splitlines():
            line = clean(raw)
            if is_noise(line) or line in {title, f"{title}成绩公告"}:
                continue
            if is_row_start(line):
                if buffer and not has_result_value(buffer):
                    raise ValueError(f"Dangling row on page {page_number}: {buffer}")
                buffer = line
            else:
                if not buffer:
                    continue
                buffer = clean(f"{buffer} {line}")

            if buffer and has_result_value(buffer):
                row, status_index = parse_row(buffer, gender_group, discipline, page_number, status_index)
                results.append(row)
                buffer = ""

        if buffer and not has_result_value(buffer):
            raise ValueError(f"Dangling row on page {page_number}: {buffer}")

    deduped_results: list[dict[str, Any]] = []
    duplicate_rows: list[dict[str, Any]] = []
    seen_result_keys: set[tuple[str, str, str, str, str, str]] = set()
    for row in results:
        result_key = (
            row["discipline"],
            row["gender_group"],
            row["athlete_name_snapshot"],
            row.get("bib_number") or "",
            row["finish_time"],
            row["team_name"],
        )
        if result_key in seen_result_keys:
            duplicate_rows.append(row)
            continue
        seen_result_keys.add(result_key)
        deduped_results.append(row)
    results = deduped_results

    return {
        "event": {
            "name": EVENT_NAME,
            "slug": EVENT_SLUG,
            "start_date": "2026-04-25",
            "end_date": "2026-04-26",
            "province": "湖南省",
            "city": "郴州市",
            "venue": "郴州北湖",
            "event_status": "completed",
            "result_status": "extended_complete",
            "source_scope": "用户提交成绩册导入",
            "result_source_note": "仅录入第13-42页逐项成绩公告；第4-6页团体积分、第7-12页前八名汇总不重复录入。",
        },
        "source": {
            "original_path": SOURCE_URL,
            "file_name": DISPLAY_FILE_NAME,
            "file_type": "pdf",
            "source_url": SOURCE_URL,
            "parser_name": "parse-national-fitness-hunan-2026-results.py",
            "parser_status": "parsed",
            "parser_note": "用户提交PDF文本解析，仅导入第13-42页逐项成绩明细；积分与前八名汇总页排除；第28页何宏伟同成绩重复行保留首次出现记录。",
            "extracted_rows": len(results),
            "imported_rows": len(results),
            "metadata": {
                "source_kind": "user_result_submission",
                "event_key": EVENT_SLUG,
                "submission_id": 559,
                "page_count": len(reader.pages),
                "page_range": "13-42",
                "excluded_pages": "1封面/空白,2导读,3奖项,4-6团体积分,7-12前八名汇总",
                "deduped_rows": len(duplicate_rows),
            },
        },
        "results": results,
    }


def validate_payload(payload: dict[str, Any]) -> None:
    modules: dict[tuple[str, str, str], list[dict[str, Any]]] = {}
    for row in payload["results"]:
        key = (row["discipline"], row["gender_group"], row.get("round_label") or "")
        modules.setdefault(key, []).append(row)

    bad_modules = []
    for key, rows in modules.items():
        normal_ranks = [row["rank_position"] for row in rows if row["rank_position"] < 9000]
        if len(normal_ranks) != len(set(normal_ranks)):
            bad_modules.append(key)
    if bad_modules:
        raise ValueError(f"Duplicate normal ranks detected: {bad_modules}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", type=Path, default=Path(".cache/national-fitness-hunan-sup-2026/source.pdf"))
    parser.add_argument("-o", "--output", type=Path, default=Path(".cache/national-fitness-hunan-sup-2026-results.json"))
    parser.add_argument("--refresh", action="store_true")
    args = parser.parse_args()

    pdf_path = download_pdf(args.pdf, args.refresh)
    payload = parse_pdf(pdf_path)
    validate_payload(payload)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    modules = {(row["discipline"], row["gender_group"], row.get("round_label") or "") for row in payload["results"]}
    status_count: dict[str, int] = {}
    for row in payload["results"]:
        key = row.get("result_status_code") or ("UNVERIFIED" if row.get("is_verified") is False else "OK")
        status_count[key] = status_count.get(key, 0) + 1
    print(f"results={len(payload['results'])} modules={len(modules)} status={status_count} output={args.output}")


if __name__ == "__main__":
    main()
