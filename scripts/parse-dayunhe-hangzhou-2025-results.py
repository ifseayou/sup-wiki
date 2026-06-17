#!/usr/bin/env python3
import argparse
import json
import re
from pathlib import Path
from urllib.request import urlretrieve

import pdfplumber


SOURCE_URL = "https://sport-hacker-assets.oss-cn-hangzhou.aliyuncs.com/sup-wiki/result-submissions/1/1780490167287-s3ehp3-大运河-长距离成绩公告.pdf"
EVENT_NAME = "2025年“京杭大运河”皮划艇马拉松系列赛（浙江·杭州站）"
EVENT_SLUG = "jinghang-grand-canal-kayak-sup-marathon-hangzhou-2025"
SOURCE_FILE_NAME = "大运河-长距离成绩公告.pdf"
SUBMISSION_ID = 21
SUBMISSION_BATCH_ID = "00a364a74e2a4d368e93dacf"

SUP_PAGES = {
    9: "公开男子组",
    10: "公开男子组",
    11: "公开男子组",
    12: "大师男子组",
    13: "公开女子组",
    14: "大师女子组",
}

EXPECTED_RESULTS = 148
EXPECTED_POINTS = 103


def clean(value):
    return re.sub(r"\s+", " ", str(value or "").strip())


def result_label(rank):
    if rank == 1:
        return "冠军"
    if rank == 2:
        return "亚军"
    if rank == 3:
        return "季军"
    return f"第{rank}名"


def is_time(value):
    return bool(re.match(r"^\d+:\d{2}(?::\d{2})?(?:\.\d+)?$", clean(value)))


def parse_points(value):
    raw = clean(value)
    if not raw:
        return None
    try:
        return float(raw)
    except ValueError:
        return None


def normalize_rank(value):
    raw = clean(value)
    if not raw:
        return None
    if raw.isdigit():
        return int(raw)
    return None


def source_note(group_name, page_no, row_index, kind):
    if kind == "ranked":
        return f"{group_name}10KM长距离赛，PDF第{page_no}页第{row_index}行。"
    if kind == "unranked_time":
        return f"{group_name}10KM长距离赛，PDF第{page_no}页未给出名次/积分，保留完赛时间。"
    return f"{group_name}10KM长距离赛，PDF第{page_no}页未公布完赛时间，按未完赛状态录入。"


def ensure_input(path_or_url):
    if path_or_url.startswith("http://") or path_or_url.startswith("https://"):
        target = Path("/tmp/dayunhe-long-distance-results.pdf")
        if not target.exists():
            urlretrieve(path_or_url, target)
        return target
    return Path(path_or_url)


def parse_pdf(pdf_path):
    results = []
    point_standings = []
    unranked_time_index = {}
    no_time_index = {}

    with pdfplumber.open(str(pdf_path)) as pdf:
        if len(pdf.pages) < 14:
            raise RuntimeError(f"PDF页数不足，期望至少14页，实际{len(pdf.pages)}页")

        for page_no, group_name in SUP_PAGES.items():
            tables = pdf.pages[page_no - 1].extract_tables()
            if not tables:
                raise RuntimeError(f"第{page_no}页未抽取到表格")
            table = tables[0]
            for row_index, row in enumerate(table[1:], 1):
                padded = list(row or []) + [""] * 5
                rank = normalize_rank(padded[0])
                name = clean(padded[1])
                team = clean(padded[2]) or "个人"
                finish_time = clean(padded[3])
                points = parse_points(padded[4])
                if not name:
                    continue

                key = group_name
                if rank is not None and finish_time:
                    rank_position = rank
                    label = result_label(rank)
                    status_code = None
                    status_note = None
                    kind = "ranked"
                elif finish_time and is_time(finish_time):
                    unranked_time_index[key] = unranked_time_index.get(key, 0) + 1
                    rank_position = 9000 + unranked_time_index[key]
                    label = "完赛未排名"
                    status_code = None
                    status_note = "成绩公告未给出名次和积分"
                    kind = "unranked_time"
                else:
                    no_time_index[key] = no_time_index.get(key, 0) + 1
                    rank_position = 9100 + no_time_index[key]
                    finish_time = "DNF"
                    label = "未完赛"
                    status_code = "DNF"
                    status_note = "成绩公告未公布完赛时间"
                    kind = "no_time"

                item = {
                    "athlete_name_snapshot": name,
                    "bib_number": None,
                    "gender_group": group_name,
                    "discipline": "10KM长距离赛",
                    "board_class": "桨板",
                    "round_label": "决赛",
                    "rank_position": rank_position,
                    "result_label": label,
                    "finish_time": finish_time,
                    "result_status_code": status_code,
                    "result_status_note": status_note,
                    "points": points,
                    "team_name": team,
                    "team_members": [],
                    "nationality_snapshot": "中国",
                    "source_locator": f"page:{page_no}:row:{row_index}",
                    "source_note": source_note(group_name, page_no, row_index, kind),
                    "parse_confidence": 0.99 if kind == "ranked" else 0.9,
                    "review_status": "confirmed",
                    "is_verified": True,
                }
                results.append(item)

                if rank is not None and points is not None:
                    point_standings.append({
                        "group_name": group_name,
                        "rank_position": rank,
                        "status_rank": None,
                        "bib_number": None,
                        "athlete_name_snapshot": name,
                        "team_name": team,
                        "endurance_rank": str(rank),
                        "endurance_points": points,
                        "sprint_rank": None,
                        "sprint_points": None,
                        "total_points": points,
                        "source_locator": f"page:{page_no}:row:{row_index}",
                    })

    return results, point_standings


def build_payload(pdf_path):
    results, point_standings = parse_pdf(pdf_path)
    if len(results) != EXPECTED_RESULTS:
        raise RuntimeError(f"桨板成绩行数异常：期望{EXPECTED_RESULTS}，实际{len(results)}")
    if len(point_standings) != EXPECTED_POINTS:
        raise RuntimeError(f"积分行数异常：期望{EXPECTED_POINTS}，实际{len(point_standings)}")

    return {
        "event": {
            "name": EVENT_NAME,
            "slug": EVENT_SLUG,
            "event_type": "race",
            "location": "杭州拱墅区大运河武林门码头至拱宸桥水域",
            "province": "浙江省",
            "city": "杭州市",
            "venue": "大运河武林门码头至拱宸桥水域",
            "start_date": "2025-06-28",
            "end_date": "2025-06-28",
            "description": "来自用户提交成绩册，仅导入桨板10KM长距离项目，排除皮划艇项目。",
            "disciplines": ["桨板", "10KM长距离赛"],
            "source_scope": "用户提交成绩册导入（仅桨板）",
            "result_source_note": "大运河-长距离成绩公告.pdf；仅录入第9-14页桨板项目，排除皮划艇项目。",
            "status": "published",
            "event_status": "completed",
            "result_status": "extended_complete",
        },
        "source": {
            "original_path": str(pdf_path),
            "file_name": SOURCE_FILE_NAME,
            "file_type": "pdf",
            "source_url": SOURCE_URL,
            "result_submission_id": SUBMISSION_ID,
            "result_submission_batch_id": SUBMISSION_BATCH_ID,
            "parser_name": "parse-dayunhe-hangzhou-2025-results.py",
            "parser_status": "parsed",
            "parser_note": "仅解析第9-14页桨板10KM长距离项目；第1-8页和第15-16页为皮划艇项目，已排除。",
            "extracted_rows": len(results),
            "imported_rows": len(results),
            "metadata": {
                "source_kind": "result_submission",
                "page_range": "9-14",
                "excluded_pages": "1-8,15-16",
                "result_submission_id": SUBMISSION_ID,
                "result_submission_batch_id": SUBMISSION_BATCH_ID,
                "modules": sorted(list(set(item["gender_group"] for item in results))),
                "point_rows": len(point_standings),
            },
        },
        "results": results,
        "point_standings": point_standings,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default=SOURCE_URL)
    parser.add_argument("--output", default=".cache/dayunhe-hangzhou-2025-results.json")
    args = parser.parse_args()

    pdf_path = ensure_input(args.input)
    payload = build_payload(pdf_path)

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    groups = {}
    for item in payload["results"]:
        groups[item["gender_group"]] = groups.get(item["gender_group"], 0) + 1
    print(json.dumps({
        "output": str(output),
        "results": len(payload["results"]),
        "point_standings": len(payload["point_standings"]),
        "groups": groups,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
