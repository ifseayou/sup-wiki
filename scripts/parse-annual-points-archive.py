#!/usr/bin/env python3
"""Parse archived WeChat annual point articles into a cache JSON.

The source folder contains offline-saved WeChat HTML articles. The rankings are
embedded as images, so this script downloads article images, OCRs them with the
existing macOS Vision Swift helper, and normalizes rows for the DB import script.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path

from bs4 import BeautifulSoup


DEFAULT_SOURCE_DIR = Path("/Users/xhl/Desktop/22年-24年桨板积分")
DEFAULT_CACHE_DIR = Path(".cache/annual-points-2022-2024")
OCR_SCRIPT = Path("scripts/ocr-image-macos-json.swift")

GROUP_CODE_BY_NAME = {
    "U9女子组": "u9-women",
    "U9男子组": "u9-men",
    "U15女子组": "u15-women",
    "U15男子组": "u15-men",
    "U18女子组": "u18-women",
    "U18男子组": "u18-men",
    "公开女子组": "open-women",
    "公开男子组": "open-men",
    "大师女子组": "masters-women",
    "大师男子组": "masters-men",
    "高校女子组": "college-women",
    "高校男子组": "college-men",
    "卡胡纳女子组": "kahuna-women",
    "卡胡纳男子组": "kahuna-men",
}


@dataclass
class Article:
    path: Path
    title: str
    year: int
    group_name: str | None
    group_code: str | None
    source_key: str
    source_url: str
    raw_url: str
    published_at: str | None
    image_urls: list[str]
    is_club: bool = False
    is_notice: bool = False


def clean_text(value: str) -> str:
    return re.sub(r"\s+", "", str(value or "")).strip()


def normalize_number(value: str | None) -> float | None:
    raw = str(value or "").strip().replace(",", "").replace("，", "")
    raw = raw.replace("O", "0").replace("o", "0").replace("l", "1")
    raw = raw.replace("T", "7").replace("G", "6").replace("：", ".")
    raw = re.sub(r"(?<=\d):(?=\d)", ".", raw)
    raw = re.sub(r"(?<=\d)\.\s+(?=\d)", ".", raw)
    raw = re.sub(r"[^0-9.\-]", "", raw)
    raw = re.sub(r"\.+$", "", raw)
    if raw.count(".") > 1:
        first = raw.find(".")
        raw = raw[:first + 1] + raw[first + 1:].replace(".", "")
    if not raw or raw in {"-", ".", "-."}:
        return None
    try:
        return round(float(raw), 3)
    except ValueError:
        return None


def normalize_rank(value: str | None) -> int | None:
    text = str(value or "")
    numbers = re.findall(r"\d+", text.replace("O", "0").replace("o", "0").replace("l", "1"))
    if numbers:
        return int(numbers[-1])
    num = normalize_number(value)
    if num is None:
        return None
    return int(num)


def normalize_url(raw: str) -> str:
    if not raw:
        return ""
    parsed = urllib.parse.urlsplit(raw)
    return urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, parsed.path, "", ""))


def source_key(title: str, url: str) -> str:
    token = urllib.parse.urlsplit(normalize_url(url)).path.rstrip("/").split("/")[-1]
    prefix = "wechat-annual-points"
    if token:
        return f"{prefix}-{token[:32]}"
    digest = hashlib.sha1(title.encode("utf-8")).hexdigest()[:12]
    return f"{prefix}-{digest}"


def parse_article(path: Path) -> Article | None:
    html = path.read_text(errors="ignore")
    soup = BeautifulSoup(html, "html.parser")
    title_match = re.search(r"<title>(.*?)</title>", html, re.S)
    title = BeautifulSoup(title_match.group(1), "html.parser").get_text("", strip=True) if title_match else path.stem
    year_match = re.search(r"(20\d{2})年度", title)
    if not year_match:
        return None
    year = int(year_match.group(1))
    if year not in {2022, 2023, 2024}:
        return None

    raw_link_match = re.search(r'var msg_link = "([^"]+)"', html)
    raw_url = raw_link_match.group(1) if raw_link_match else ""
    source_url = normalize_url(raw_url)
    pub_match = re.search(r'publish_time"[^>]*>(.*?)</em>', html, re.S)
    published_at = BeautifulSoup(pub_match.group(1), "html.parser").get_text("", strip=True) if pub_match else None

    is_club = "俱乐部积分" in title or "社团组织" in title
    is_notice = "通知" in title
    group_name = None
    if not is_club and not is_notice:
        gender = "女子组" if re.search(r"女子|女\)", title) else "男子组" if re.search(r"男子|男\)", title) else None
        for label in ["U9", "U15", "U18", "公开", "大师", "高校", "卡胡纳"]:
            if label in title:
                group_name = f"{label}{gender}" if label.startswith("U") else f"{label}{gender}"
                break
    group_code = GROUP_CODE_BY_NAME.get(group_name or "")

    image_urls: list[str] = []
    for img in soup.select("#js_content img"):
        url = img.get("data-src") or img.get("src") or ""
        if not url or url.startswith("data:"):
            continue
        if "mmbiz.qpic.cn" not in url:
            continue
        clean = url.split("#", 1)[0]
        if clean not in image_urls:
            image_urls.append(clean)

    return Article(
        path=path,
        title=title,
        year=year,
        group_name=group_name,
        group_code=f"{year}-{group_code}" if group_code else None,
        source_key=source_key(title, raw_url or str(path)),
        source_url=source_url,
        raw_url=raw_url,
        published_at=published_at,
        image_urls=image_urls,
        is_club=is_club,
        is_notice=is_notice,
    )


def download(url: str, target: Path, sleep: float = 0.1) -> None:
    if target.exists() and target.stat().st_size > 0:
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        target.write_bytes(response.read())
    if sleep:
        time.sleep(sleep)


def ocr_image(image_path: Path, ocr_path: Path, refresh: bool = False) -> list[dict]:
    if ocr_path.exists() and not refresh:
        return json.loads(ocr_path.read_text())
    ocr_path.parent.mkdir(parents=True, exist_ok=True)
    output = subprocess.check_output(["swift", str(OCR_SCRIPT), str(image_path)], text=True)
    rows = json.loads(output)
    ocr_path.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    return rows


def row_buckets(items: list[dict]) -> list[list[dict]]:
    ranked = sorted(items, key=lambda item: (-float(item["y"]), float(item["x"])))
    buckets: list[list[dict]] = []
    for item in ranked:
        text = str(item.get("text") or "").strip()
        if not text:
            continue
        if not buckets or abs(float(item["y"]) - sum(float(x["y"]) for x in buckets[-1]) / len(buckets[-1])) > 0.018:
            buckets.append([item])
        else:
            buckets[-1].append(item)
    return [sorted(bucket, key=lambda item: float(item["x"])) for bucket in buckets]


def columnize(bucket: list[dict]) -> dict[str, str]:
    cols: dict[str, list[str]] = defaultdict(list)
    for item in bucket:
        x = float(item["x"])
        text = str(item["text"]).strip()
        if x < 0.15:
            key = "rank"
        elif x < 0.29:
            key = "name"
        elif x < 0.50:
            key = "team"
        elif x < 0.615:
            key = "endurance"
        elif x < 0.705:
            key = "sprint"
        elif x < 0.795:
            key = "technical"
        else:
            key = "total"
        cols[key].append(text)
    return {key: " ".join(values).strip() for key, values in cols.items()}


def looks_like_header(row: dict[str, str]) -> bool:
    text = "".join(row.values())
    return any(token in text for token in ["排名", "姓名", "积分", "年度", "总积分", "公示", "查询二维码"])


def normalize_name(value: str) -> str:
    text = clean_text(value)
    text = re.sub(r"[^A-Za-z\u4e00-\u9fff·・]", "", text)
    return text


def normalize_team(value: str | None) -> str | None:
    text = re.sub(r"\s+", "", str(value or "").strip())
    if not text or text in {"-", "无", "个人"}:
        return None
    return text


TEAM_KEYWORD_RE = re.compile(r"俱乐部|协会|高校|大学|学院|中心|体育|桨板|皮划艇|运动|队|基地|学校")


def split_name_team(row: dict[str, str]) -> tuple[str, str | None, str | None]:
    raw_name = str(row.get("name") or "").strip()
    raw_team = str(row.get("team") or "").strip()
    team_prefix = ""
    if re.search(r"\s", raw_name):
        parts = [part for part in re.split(r"\s+", raw_name) if part]
        raw_name = parts[0]
        team_prefix = "".join(parts[1:])
    name = normalize_name(raw_name)
    team = normalize_team(f"{team_prefix}{raw_team}")
    if len(name) > 4 and TEAM_KEYWORD_RE.search(name):
        return name, team, "name_team_merged"
    return name, team, None


def split_point_columns(row: dict[str, str]) -> tuple[float | None, float | None, float | None, float | None, str | None]:
    values = {
        "endurance": str(row.get("endurance") or ""),
        "sprint": str(row.get("sprint") or ""),
        "technical": str(row.get("technical") or ""),
        "total": str(row.get("total") or ""),
    }
    cleaned = {}
    for key, value in values.items():
        text = value.replace(",", "").replace("，", "")
        text = text.replace("O", "0").replace("o", "0").replace("l", "1")
        text = text.replace("T", "7").replace("G", "6").replace("：", ".")
        text = re.sub(r"(?<=\d):(?=\d)", ".", text)
        text = re.sub(r"(?<=\d)\.\s+(?=\d)", ".", text)
        cleaned[key] = text
    numbers = {key: re.findall(r"-?\d+(?:\.\d+)?", value) for key, value in cleaned.items()}
    if len(numbers["endurance"]) == 3 and not numbers["sprint"] and not numbers["technical"]:
        values["endurance"], values["sprint"], values["technical"] = numbers["endurance"]
    if len(numbers["endurance"]) == 2 and not numbers["sprint"]:
        values["endurance"], values["sprint"] = numbers["endurance"]
    if len(numbers["endurance"]) == 2 and numbers["sprint"] and not numbers["technical"]:
        values["endurance"], values["sprint"], values["technical"] = numbers["endurance"][0], numbers["endurance"][1], numbers["sprint"][0]
    if len(numbers["sprint"]) == 2 and not numbers["technical"]:
        values["sprint"], values["technical"] = numbers["sprint"]
    if len(numbers["technical"]) == 2 and not numbers["total"]:
        values["technical"], values["total"] = numbers["technical"]
    parsed = {
        "endurance": normalize_number(values["endurance"]),
        "sprint": normalize_number(values["sprint"]),
        "technical": normalize_number(values["technical"]),
        "total": normalize_number(values["total"]),
    }
    if parsed["total"] is not None and len(numbers["total"]) > 1 and normalize_number(values["total"]) is not None:
        values["total"] = str(parsed["total"])
    if parsed["total"] is not None:
        subtotal = sum(value for key, value in parsed.items() if key != "total" and value is not None)
        missing_components = [key for key in ["endurance", "sprint", "technical"] if parsed[key] is None]
        if len(missing_components) == 1 and 0 < subtotal < parsed["total"]:
            inferred = round(parsed["total"] - subtotal, 3)
            parsed[missing_components[0]] = inferred
            values[missing_components[0]] = str(inferred)
    unresolved = next(
        (
            key
            for key, found in numbers.items()
            if len(found) > 1
            and values[key] == row.get(key)
            and normalize_number(values[key]) is None
        ),
        None,
    )
    return (parsed["endurance"], parsed["sprint"], parsed["technical"], parsed["total"], f"merged_point_column:{unresolved}" if unresolved else None)


def is_noise_row(row: dict[str, str]) -> bool:
    text = "".join(str(value or "") for value in row.values())
    if not text:
        return True
    compact = clean_text(text)
    if re.fullmatch(r"[•£E:：8.\-\d]+", compact):
        return True
    return bool(re.search(r"MOLOKAI|feesuy|WALK\s*ON\s*WATER|瑞\s*阳\s*体育|中国桨板|查询二维码|癿ab|极限运动护肤", text, re.I))


ANNUAL_TOTAL_EXCLUDE_RE = re.compile(r"全能|竞速|技巧|长距离|体适能|适能|瑜伽")


def image_is_annual_total_page(article: Article, ocr_rows: list[dict]) -> bool:
    if article.year != 2022 or article.is_club:
        return True
    header_text = "".join(
        "".join(columnize(bucket).values())
        for bucket in row_buckets(ocr_rows)[:4]
    )
    compact = clean_text(header_text).replace("奖板", "桨板")
    if ANNUAL_TOTAL_EXCLUDE_RE.search(compact):
        return False
    return "年度总积分" in compact or ("年度" in compact and "总积分" in compact)


def parse_athlete_rows(article: Article, image_index: int, ocr_rows: list[dict]) -> tuple[list[dict], list[dict], list[dict]]:
    standings = []
    anomalies = []
    manual = []
    for row_index, bucket in enumerate(row_buckets(ocr_rows), start=1):
        row = columnize(bucket)
        if looks_like_header(row):
            continue
        if is_noise_row(row):
            continue
        rank_text = str(row.get("rank") or "").strip()
        rank_name_match = re.match(r"^(\d+)\s+(.+)$", rank_text) or re.match(r"^(\d+)([A-Za-z\u4e00-\u9fff].*)$", rank_text)
        if rank_name_match and (not row.get("name") or TEAM_KEYWORD_RE.search(str(row.get("name") or ""))):
            old_name = str(row.get("name") or "")
            old_team = str(row.get("team") or "")
            row["rank"] = rank_name_match.group(1)
            row["name"] = rank_name_match.group(2)
            if old_name:
                row["team"] = f"{old_name}{old_team}"
        raw_name = str(row.get("name") or "").strip()
        paren_name_match = re.match(r"^[（(]\d+[）)]?\s*(.+)$", raw_name)
        if paren_name_match:
            row["name"] = paren_name_match.group(1)
        rank = normalize_rank(row.get("rank"))
        name, team, name_warning = split_name_team(row)
        endurance, sprint, technical, total, point_warning = split_point_columns(row)
        if article.year == 2022 and total is None and technical is not None:
            total = technical
            technical = None
        if rank is None and not name:
            continue
        if name and total is None and not point_warning:
            manual.append({"article": article.title, "image_index": image_index, "row": row, "reason": name_warning or "missing_total"})
            continue
        if not name and total is not None:
            manual.append({"article": article.title, "image_index": image_index, "row": row, "reason": "missing_name"})
            continue
        if name_warning and total is not None:
            manual.append({"article": article.title, "image_index": image_index, "row": row, "reason": name_warning})
            continue
        if not name or total is None or point_warning:
            anomalies.append({"article": article.title, "image_index": image_index, "row": row, "reason": point_warning or "missing_name_or_total"})
            continue
        standings.append({
            "source_key": article.source_key,
            "source_record_id": f"{article.source_key}:img{image_index:03d}:row{row_index:02d}:rank{rank if rank is not None else 'null'}",
            "year": article.year,
            "group_code": article.group_code,
            "group_name": article.group_name,
            "rank_position": rank,
            "athlete_name_snapshot": name,
            "team_name": team,
            "total_points": total,
            "endurance_points": endurance,
            "sprint_points": sprint,
            "technical_points": technical,
            "base_detail_text": None,
            "adjustment_detail_text": None,
            "raw_json": {"ocr_row": row, "image_index": image_index},
        })
    return standings, anomalies, manual


def parse_club_rows(article: Article, image_index: int, ocr_rows: list[dict]) -> tuple[list[dict], list[dict]]:
    rows = []
    anomalies = []
    for row_index, bucket in enumerate(row_buckets(ocr_rows), start=1):
        row = columnize(bucket)
        if looks_like_header(row):
            continue
        if is_noise_row(row):
            continue
        rank = normalize_rank(row.get("rank"))
        club = normalize_team(row.get("name") or row.get("team") or "")
        total = normalize_number(row.get("total") or row.get("technical") or row.get("endurance"))
        if not club and total is None:
            continue
        if rank is None and not club:
            continue
        if not club or total is None:
            anomalies.append({"article": article.title, "image_index": image_index, "row": row, "reason": "club_missing_rank_name_or_total"})
            continue
        rows.append({
            "source_key": article.source_key,
            "source_record_id": f"{article.source_key}:img{image_index:03d}:rank{rank if rank is not None else 'row' + str(row_index)}",
            "year": article.year,
            "rank_position": rank,
            "club_name_snapshot": club,
            "total_points": total,
            "raw_json": {"ocr_row": row, "image_index": image_index, "row_index": row_index},
        })
    return rows, anomalies


def fill_club_ranks(rows: list[dict]) -> list[dict]:
    grouped: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        grouped[str(row.get("source_key") or "")].append(row)
    normalized: list[dict] = []
    for source_rows in grouped.values():
        ordered = sorted(
            source_rows,
            key=lambda item: (
                int((item.get("raw_json") or {}).get("image_index") or 0),
                int((item.get("raw_json") or {}).get("row_index") or 0),
            ),
        )
        missing_count = sum(1 for item in ordered if item.get("rank_position") is None)
        if missing_count > len(ordered) / 2:
            for index, item in enumerate(ordered, start=1):
                item["rank_position"] = index
                item["source_record_id"] = f"{item['source_key']}:rank{index:03d}"
        else:
            current = 0
            for item in ordered:
                if item.get("rank_position") is not None:
                    current = int(item["rank_position"])
                else:
                    current += 1
                    item["rank_position"] = current
                    item["source_record_id"] = f"{item['source_key']}:rank{current:03d}"
        normalized.extend(ordered)
    return normalized


def write_review_csv(path: Path, anomalies: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        fh.write("article,image_index,reason,row_json\n")
        for item in anomalies:
            row_json = json.dumps(item.get("row", {}), ensure_ascii=False).replace('"', '""')
            fh.write(f'"{item.get("article","")}","{item.get("image_index","")}","{item.get("reason","")}","{row_json}"\n')


def write_manual_review_csv(path: Path, rows: list[dict]) -> None:
    write_review_csv(path, rows)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", default=str(DEFAULT_SOURCE_DIR))
    parser.add_argument("--cache-dir", default=str(DEFAULT_CACHE_DIR))
    parser.add_argument("--refresh-ocr", action="store_true")
    parser.add_argument("--year", type=int, default=0)
    parser.add_argument("--only-path", action="append", default=[], help="Only parse the specified HTML path. Can be repeated.")
    parser.add_argument("--limit-articles", type=int, default=0)
    parser.add_argument("--limit-images", type=int, default=0)
    parser.add_argument("--skip-download", action="store_true")
    parser.add_argument("--workers", type=int, default=4)
    args = parser.parse_args()

    source_dir = Path(args.source_dir)
    cache_dir = Path(args.cache_dir)
    articles = [item for item in (parse_article(path) for path in sorted(source_dir.glob("*.html"))) if item]
    articles = [article for article in articles if article.year in {2022, 2023, 2024}]
    if args.year:
        articles = [article for article in articles if article.year == args.year]
    if args.only_path:
        only_paths = {str(Path(item).expanduser().resolve()) for item in args.only_path}
        articles = [article for article in articles if str(article.path.expanduser().resolve()) in only_paths]
    if args.limit_articles:
        articles = articles[:args.limit_articles]

    sources = []
    standings = []
    club_standings = []
    anomalies = []
    manual_review = []
    tasks = []

    for article in articles:
        sources.append({
            "source_key": article.source_key,
            "year": article.year,
            "title": article.title,
            "source_url": article.source_url,
            "raw_config": {
                "msg_link_raw": article.raw_url,
                "published_at": article.published_at,
                "html_path": str(article.path),
                "group_name": article.group_name,
                "group_code": article.group_code,
                "is_club": article.is_club,
                "is_notice": article.is_notice,
                "image_count": len(article.image_urls),
            },
            "parser_name": "parse-annual-points-archive.py",
        })
        if article.is_notice:
            continue
        for index, url in enumerate(article.image_urls[:args.limit_images or None], start=1):
            tasks.append((article, index, url))

    def process_image(task: tuple[Article, int, str]) -> tuple[list[dict], list[dict], list[dict], list[dict]]:
        article, index, url = task
        digest = hashlib.sha1(url.encode("utf-8")).hexdigest()[:16]
        image_path = cache_dir / "images" / f"{article.source_key}-{index:03d}-{digest}.img"
        ocr_path = cache_dir / "ocr" / f"{article.source_key}-{index:03d}-{digest}.json"
        local_anomalies = []
        if not args.skip_download:
            download(url, image_path)
        if not image_path.exists():
            return [], [], [{"article": article.title, "image_index": index, "reason": "missing_image", "row": {"url": url}}], []
        try:
            ocr_rows = ocr_image(image_path, ocr_path, args.refresh_ocr)
        except Exception as error:
            return [], [], [{"article": article.title, "image_index": index, "reason": f"ocr_failed:{error}", "row": {"url": url}}], []
        if article.is_club:
            rows, bad = parse_club_rows(article, index, ocr_rows)
            return [], rows, bad, []
        if not image_is_annual_total_page(article, ocr_rows):
            return [], [], [], []
        if not article.group_code:
            local_anomalies.append({"article": article.title, "image_index": index, "reason": "unknown_group", "row": {}})
            return [], [], local_anomalies, []
        rows, bad, manual = parse_athlete_rows(article, index, ocr_rows)
        return rows, [], bad, manual

    total_tasks = len(tasks)
    completed = 0
    workers = max(1, int(args.workers or 1))
    if total_tasks:
        print(f"processing images={total_tasks} workers={workers}", file=sys.stderr)
    with ThreadPoolExecutor(max_workers=workers) as executor:
        future_map = {executor.submit(process_image, task): task for task in tasks}
        for future in as_completed(future_map):
            rows, club_rows, bad, manual = future.result()
            standings.extend(rows)
            club_standings.extend(club_rows)
            anomalies.extend(bad)
            manual_review.extend(manual)
            completed += 1
            if completed == total_tasks or completed % 25 == 0:
                print(f"progress {completed}/{total_tasks} standings={len(standings)} club={len(club_standings)} anomalies={len(anomalies)} manual={len(manual_review)}", file=sys.stderr)

    club_standings = fill_club_ranks(club_standings)

    payload = {"sources": sources, "standings": standings, "club_standings": club_standings, "anomalies": anomalies, "manual_review": manual_review}
    cache_dir.mkdir(parents=True, exist_ok=True)
    output_path = cache_dir / "standings.json"
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    write_review_csv(cache_dir / "review" / "anomalies.csv", anomalies)
    write_manual_review_csv(cache_dir / "review" / "manual-missing-total.csv", manual_review)

    by_year_group: dict[str, int] = defaultdict(int)
    for row in standings:
        by_year_group[f"{row['year']} {row['group_name']}"] += 1
    print(json.dumps({
        "articles": len(articles),
        "sources": len(sources),
        "standings": len(standings),
        "club_standings": len(club_standings),
        "anomalies": len(anomalies),
        "manual_review": len(manual_review),
        "output": str(output_path),
        "review": str(cache_dir / "review" / "anomalies.csv"),
        "manual_review_file": str(cache_dir / "review" / "manual-missing-total.csv"),
        "groups": dict(sorted(by_year_group.items())),
    }, ensure_ascii=False, indent=2))
    return 1 if anomalies else 0


if __name__ == "__main__":
    sys.exit(main())
