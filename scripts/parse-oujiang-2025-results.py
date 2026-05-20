#!/usr/bin/env python3
"""Parse the scanned 2025 八百里瓯江 result book with page-specific table rules."""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SWIFT_OCR = ROOT / "scripts" / "ocr-image-macos-json.swift"
TIME_RE = re.compile(r"^\d{1,2}:\d{2}:\d{2}$")
STATUS_LABELS = {
    "DNS": "未出发",
    "DNF": "未完赛",
    "DQ": "取消成绩",
    "DSQ": "取消成绩",
}


PAGE_SPECS: dict[int, dict[str, Any]] = {
    2: {"discipline": "33公里", "gender_group": "勇士组（公开组）男子", "start_rank": 1},
    3: {"discipline": "33公里", "gender_group": "勇士组（公开组）男子", "start_rank": 30},
    4: {"discipline": "33公里", "gender_group": "勇士组（公开组）男子", "start_rank": 59},
    5: {"discipline": "33公里", "gender_group": "勇士组（公开组）男子", "status_only": True},
    6: {"discipline": "33公里", "gender_group": "勇士组（公开组）女子", "start_rank": 1},
    8: {"discipline": "33公里", "gender_group": "勇士组（大师组）男子", "start_rank": 1},
    9: {"discipline": "33公里", "gender_group": "勇士组（大师组）男子", "start_rank": 30},
    10: {"discipline": "33公里", "gender_group": "勇士组（大师组）男子", "start_rank": 59},
    11: {"discipline": "33公里", "gender_group": "勇士组（大师组）女子", "start_rank": 1},
    14: {"discipline": "13公里", "gender_group": "白水组-男子", "start_rank": 1},
    15: {"discipline": "13公里", "gender_group": "白水组-男子", "start_rank": 30},
    16: {"discipline": "13公里", "gender_group": "白水组-男子", "start_rank": 59},
    17: {"discipline": "13公里", "gender_group": "白水组-男子", "start_rank": 88},
    18: {"discipline": "13公里", "gender_group": "白水组-男子", "status_only": True},
    19: {"discipline": "13公里", "gender_group": "白水组-女子", "start_rank": 1},
    20: {"discipline": "13公里", "gender_group": "白水组-女子", "start_rank": 36},
}


TEAM_ROWS = [
    {
        "source_locator": "page:7",
        "discipline": "33公里",
        "gender_group": "勇士组（双人组）",
        "rank_position": 1,
        "bib_number": "0707/0708",
        "athlete_name_snapshot": "张晶晶",
        "team_name": "余慈甬桨板联盟",
        "finish_time": "02:49:02",
        "team_members": ["张晶晶", "俞挺"],
    },
    {
        "source_locator": "page:7",
        "discipline": "33公里",
        "gender_group": "勇士组（双人组）",
        "rank_position": 2,
        "bib_number": "0698/0699",
        "athlete_name_snapshot": "喻君君",
        "team_name": "义桨纵横",
        "finish_time": "02:52:48",
        "team_members": ["喻君君", "郑樑洁"],
    },
    {
        "source_locator": "page:7",
        "discipline": "33公里",
        "gender_group": "勇士组（双人组）",
        "rank_position": 3,
        "bib_number": "0711/0712",
        "athlete_name_snapshot": "刘继华",
        "team_name": "碧云皮划艇俱乐部",
        "finish_time": "02:56:07",
        "team_members": ["刘继华", "张晓冬"],
    },
    {
        "source_locator": "page:7",
        "discipline": "33公里",
        "gender_group": "勇士组（双人组）",
        "rank_position": 4,
        "bib_number": "0693/0695",
        "athlete_name_snapshot": "潘学敏",
        "team_name": "龙港市乐划户外运动俱乐部",
        "finish_time": "02:59:22",
        "team_members": ["潘学敏", "林美存"],
    },
    {
        "source_locator": "page:7",
        "discipline": "33公里",
        "gender_group": "勇士组（双人组）",
        "rank_position": 5,
        "bib_number": "0700/0701",
        "athlete_name_snapshot": "徐硼",
        "team_name": "上海远香湖金钥匙桨板俱乐部",
        "finish_time": "03:01:59",
        "team_members": ["徐硼", "陈晨"],
    },
    {
        "source_locator": "page:7",
        "discipline": "33公里",
        "gender_group": "勇士组（双人组）",
        "rank_position": 6,
        "bib_number": "0702/0703",
        "athlete_name_snapshot": "邢凌凌",
        "team_name": "自由动力-江阴水上运动俱乐部",
        "finish_time": "03:17:49",
        "team_members": ["邢凌凌", "黄骏"],
    },
    {
        "source_locator": "page:7",
        "discipline": "33公里",
        "gender_group": "勇士组（双人组）",
        "rank_position": 7,
        "bib_number": "0709/0710",
        "athlete_name_snapshot": "刘琼",
        "team_name": "个人",
        "finish_time": "03:41:23",
        "team_members": ["刘琼", "夏红远"],
    },
    {
        "source_locator": "page:7",
        "discipline": "33公里",
        "gender_group": "勇士组（双人组）",
        "rank_position": 8,
        "bib_number": "0705/0706",
        "athlete_name_snapshot": "王丹",
        "team_name": "个人",
        "finish_time": "03:50:34",
        "team_members": ["王丹", "戴南儿"],
    },
    {
        "source_locator": "page:7",
        "discipline": "33公里",
        "gender_group": "勇士组（双人组）",
        "rank_position": 9001,
        "bib_number": "0691/0692",
        "athlete_name_snapshot": "王亮",
        "team_name": "个人",
        "finish_time": "DNS",
        "team_members": ["王亮", "李艺"],
    },
    {
        "source_locator": "page:7",
        "discipline": "33公里",
        "gender_group": "勇士组（双人组）",
        "rank_position": 9002,
        "bib_number": "0696/0697",
        "athlete_name_snapshot": "郑凯译",
        "team_name": "个人",
        "finish_time": "DNS",
        "team_members": ["郑凯译", "曾文浩"],
    },
]

DRAGON_ROWS = [
    (12, 1, "0663/0665/0666/0667", "九龙王", "02:31:26", ["郑浩", "叶贵桐", "赖淑婧", "蒋余龙"]),
    (12, 2, "0632/0633/0635/0636", "集美大学", "02:32:30", ["李世潮", "王耳", "张骏", "梁卢健"]),
    (12, 3, "0686/0687/0688/0689", "温州飞速桨板俱乐部", "02:34:21", ["孙镇剑", "陈成辉", "王晓和", "孙建叶"]),
    (12, 4, "0659/0660/0661/0662", "银川市翔龙皮划艇运动协会", "02:42:55", ["陈祥炎", "朱德智", "曾嵘峰", "倪淑炯"]),
    (12, 5, "0651/0652/0653/0690", "甬炫观光车", "02:46:38", ["王晓慧", "胡海莲", "黄银丰", "王飞雄"]),
    (12, 6, "0677/0678/0679/0680", "上海远香湖金钥匙1号龙板队", "02:47:53", ["董毅文", "张黔光", "赵鸣鸣", "王志宇"]),
    (12, 7, "0655/0656/0657/0658", "江西省桨板运动协会翼飞龙板队", "02:54:05", ["邓小强", "杨联兰", "周华", "吴林洲"]),
    (13, 8, "0637/0638/0639/0650", "余波更浪", "02:54:43", ["刘明君", "邓宇", "耿放", "陈波"]),
    (13, 9, "0672/0673/0675/0676", "汗血白宝马冲冲冲队", "03:00:46", ["全冰", "周间圆", "徐孟柯", "刘丰"]),
    (13, 10, "0628/0629/0630/0631", "货物运输队", "03:08:06", ["韦恩宇", "石峰", "叶欣吾", "黄宁超"]),
    (13, 11, "0681/0682/0683/0685", "星城桨板联盟", "03:08:19", ["李世军", "陈骏", "谢砧玮", "吴樱军"]),
    (13, 12, "0668/0669/0670/0671", "宁波-人菜瘾大队", "03:08:36", ["王利荣", "谢晓勇", "孙传凤", "吴露东"]),
    (13, 13, "0623/0625/0626/0627", "绿谷桨板队", "03:19:04", ["潘军龙", "朱剑", "李萍", "周金龙"]),
]

MANUAL_STATUS_ROWS = [
    (4, "33公里", "勇士组（公开组）男子", "0509", "黄家田", "赣州远山户外", "DNS"),
    (4, "33公里", "勇士组（公开组）男子", "0528", "吴凯", "南昌SK桨板俱乐部", "DNS"),
    (4, "33公里", "勇士组（公开组）男子", "0532", "庄佳康", "个人", "DNS"),
    (4, "33公里", "勇士组（公开组）男子", "0533", "潘季鑫", "个人", "DNS"),
    (5, "33公里", "勇士组（公开组）男子", "0537", "陈松林", "遂宁市水上运动协会", "DNS"),
    (5, "33公里", "勇士组（公开组）男子", "0552", "向海波", "个人", "DNS"),
    (5, "33公里", "勇士组（公开组）男子", "0577", "章新", "个人", "DNS"),
    (5, "33公里", "勇士组（公开组）男子", "0578", "应宏熹", "江山市桨艇协会", "DNS"),
    (5, "33公里", "勇士组（公开组）男子", "0590", "杨豪", "杭州水尚皮划艇俱乐部", "DNS"),
    (5, "33公里", "勇士组（公开组）男子", "0616", "郑旭", "EHENHEN划水组", "DNS"),
    (5, "33公里", "勇士组（公开组）男子", "0833", "罗屋", "个人", "DNS"),
    (6, "33公里", "勇士组（公开组）女子", "0556", "高甜", "武昌湾楚天桨板俱乐部", "DNS"),
    (6, "33公里", "勇士组（公开组）女子", "0562", "冯爱心", "长兴县桨板运动协会", "DNS"),
    (6, "33公里", "勇士组（公开组）女子", "0619", "纪玲玲", "个人", "DNS"),
    (10, "33公里", "勇士组（大师组）男子", "0277", "李尚财", "泰顺县桨板协会", "DNS"),
    (10, "33公里", "勇士组（大师组）男子", "0287", "胡晓东", "个人", "DNS"),
    (10, "33公里", "勇士组（大师组）男子", "0289", "李孝广", "瑞安飞浪桨板俱乐部", "DNS"),
    (10, "33公里", "勇士组（大师组）男子", "0296", "杨帆", "武汉龙行无界桨板队", "DNS"),
    (10, "33公里", "勇士组（大师组）男子", "0309", "樊平", "个人", "DNS"),
    (10, "33公里", "勇士组（大师组）男子", "0311", "刘远鹤", "上海远香湖金钥匙桨板俱乐部", "DNS"),
    (10, "33公里", "勇士组（大师组）男子", "0316", "黄国春", "个人", "DNS"),
    (10, "33公里", "勇士组（大师组）男子", "0319", "王俊", "武汉市同兴桨板俱乐部", "DNS"),
    (10, "33公里", "勇士组（大师组）男子", "0321", "朱凯唯", "个人", "DNS"),
    (10, "33公里", "勇士组（大师组）男子", "0325", "代义俊", "武汉龙行无界桨板队", "DNS"),
    (10, "33公里", "勇士组（大师组）男子", "0336", "朱惊雷", "义桨纵横", "DNS"),
    (10, "33公里", "勇士组（大师组）男子", "0362", "李明", "个人", "DNS"),
    (10, "33公里", "勇士组（大师组）男子", "0378", "丁建海", "个人", "DNS"),
    (10, "33公里", "勇士组（大师组）男子", "0392", "高志刚", "上海浪浪桨板俱乐部", "DNS"),
    (11, "33公里", "勇士组（大师组）女子", "0332", "徐玲丽", "长兴县桨板运动协会", "DNF"),
    (11, "33公里", "勇士组（大师组）女子", "0281", "洪智峰", "宁波甬炫旅游文化发展有限公司", "DNS"),
    (11, "33公里", "勇士组（大师组）女子", "0396", "齐凤敏", "个人", "DNS"),
    (11, "33公里", "勇士组（大师组）女子", "0352", "黄水娥", "个人", "DNS"),
    (17, "13公里", "白水组-男子", "0117", "刘士东", "建德市冬泳协会", "DNF"),
    (17, "13公里", "白水组-男子", "0075", "李存波", "个人", "DNS"),
    (17, "13公里", "白水组-男子", "0211", "廖勇", "自由动力-江阴水上运动俱乐部", "DNS"),
    (17, "13公里", "白水组-男子", "0172", "陆诠良", "长兴县桨板运动协会", "DNS"),
    (17, "13公里", "白水组-男子", "0110", "胡俊杰", "个人", "DNS"),
    (17, "13公里", "白水组-男子", "0133", "周志伟", "上饶市公开水域运动协会", "DNS"),
    (17, "13公里", "白水组-男子", "0158", "黎武亮", "个人", "DNS"),
    (17, "13公里", "白水组-男子", "0227", "徐柯", "武汉龙行无界桨板队", "DNS"),
    (17, "13公里", "白水组-男子", "0065", "何睿琪", "上海浪浪桨板俱乐部", "DNS"),
    (17, "13公里", "白水组-男子", "0107", "孙佳午", "个人", "DNS"),
    (17, "13公里", "白水组-男子", "0102", "张华兵", "个人", "DNS"),
    (17, "13公里", "白水组-男子", "0068", "吴名章", "个人", "DNS"),
    (17, "13公里", "白水组-男子", "0085", "边韦瀚", "个人", "DNS"),
    (17, "13公里", "白水组-男子", "0025", "龙增辉", "深圳市万科梅沙书院", "DNS"),
    (17, "13公里", "白水组-男子", "0210", "沈骏", "个人", "DNS"),
    (17, "13公里", "白水组-男子", "0800", "陈燕军", "Black皮艇桨板运动中心", "DNS"),
    (17, "13公里", "白水组-男子", "0237", "张剑", "个人", "DNS"),
    (17, "13公里", "白水组-男子", "0067", "蓝海锋", "个人", "DNS"),
    (18, "13公里", "白水组-男子", "0191", "唐春辉", "个人", "DNS"),
    (18, "13公里", "白水组-男子", "0005", "曹学林", "温州飞速", "DNS"),
    (18, "13公里", "白水组-男子", "0106", "娄银宇", "温州冬泳协会桨板俱乐部", "DNS"),
    (18, "13公里", "白水组-男子", "0175", "赵静", "九山救生站", "DNS"),
    (18, "13公里", "白水组-男子", "0103", "蔡家东", "个人", "DNS"),
    (18, "13公里", "白水组-男子", "0011", "聂刚", "南昌市桨板运动协会", "DNS"),
    (18, "13公里", "白水组-男子", "0257", "史坤", "杭州水尚皮划艇俱乐部", "DNS"),
    (18, "13公里", "白水组-男子", "0019", "姜成志", "个人", "DNS"),
    (18, "13公里", "白水组-男子", "0150", "岳跃珂", "江西省桨板协会", "DNS"),
]

PAGE19_ROWS = [
    (1, "0262", "傅文涛", "个人", "00:57:51"),
    (2, "0152", "柳珺", "个人", "01:04:36"),
    (3, "0037", "戴茜雅", "上海远香湖金钥匙桨板俱乐部", "01:04:41"),
    (4, "0167", "应爱娟", "格兰德智能科技", "01:04:48"),
    (5, "0239", "赖红仙", "余甬慈桨板联盟", "01:06:54"),
    (6, "0129", "张双凤", "个人", "01:10:04"),
    (7, "0192", "郭易红", "个人", "01:10:10"),
    (8, "0100", "向其芝", "银川市翔龙皮划艇运动协会", "01:10:32"),
    (9, "0121", "何金莲", "丽水市水上运动协会", "01:10:34"),
    (10, "0151", "董文霞", "磐安县游泳协会", "01:10:40"),
    (11, "0193", "李清利", "狼之印", "01:12:02"),
    (12, "0128", "刘翘楚", "南昌S.K桨类运动俱乐部", "01:12:09"),
    (13, "0186", "陈玲", "武汉龙行无界桨板队", "01:12:20"),
    (14, "0259", "冯颖", "上海中医药大学", "01:12:36"),
    (15, "0026", "王鹂", "武汉龙行无界桨板队", "01:13:46"),
    (16, "0177", "毛丽姿", "个人", "01:14:35"),
    (17, "0131", "刘宇晨", "个人", "01:14:58"),
    (18, "0265", "李旦旦", "长兴县桨板运动协会", "01:16:28"),
    (19, "0126", "曹欣 Tsao Hsin", "个人", "01:16:50"),
    (20, "0209", "曹冬梅", "远香湖金钥匙俱乐部", "01:17:06"),
    (21, "0212", "曾玉玫", "江山市桨艇协会", "01:17:15"),
    (22, None, "胡一福", "磐安县游泳协会", "01:18:20"),
    (23, None, "陈络", "个人", "01:18:39"),
    (24, None, "苏玥", "上饶市公开水域运动协会", "01:18:58"),
    (25, None, "孙和平", "个人", "01:19:15"),
    (26, None, "徐成和", "个人", "01:20:16"),
    (27, None, "胡彦婷", "南昌S.K桨类运动俱乐部", "01:20:38"),
    (28, None, "李欣然", "桨花花Supher女子桨板俱乐部", "01:21:38"),
    (29, None, "于贵珍 Yu Gui-zhen", "上海远香湖金钥匙桨板俱乐部", "01:24:50"),
    (30, None, "吕盼", "磐安县游泳协会", "01:25:11"),
    (31, None, "张丽霞", "个人", "01:26:33"),
    (32, None, "叶雅文", "桨花花Supher女子桨板俱乐部", "01:26:53"),
    (33, None, "郭晓方", "江西省桨板运动协会", "01:27:31"),
    (34, None, "徐莹", "桨花花Supher女子桨板俱乐部", "01:28:33"),
    (35, None, "田雪莲", "个人", "01:29:25"),
]

PAGE20_ROWS = [
    (36, "0185", "张琳", "个人", "01:46:40"),
    (37, "0269", "田娅菲", "个人", "02:06:07"),
    (9001, "0058", "王江文", "个人", "DNF"),
    (9002, "0006", "陶春波", "个人", "DNS"),
    (9003, "0021", "胡邠", "个人", "DNS"),
    (9004, "0087", "景嫡", "个人", "DNS"),
    (9005, "0095", "万海凤", "个人", "DNS"),
    (9006, "0096", "陈可臻", "个人", "DNS"),
    (9007, "0099", "褚玲珊", "磐安县游泳协会", "DNS"),
    (9008, "0109", "吴柏珍", "个人", "DNS"),
    (9009, "0115", "秦媛", "个人", "DNS"),
    (9010, "0119", "雷伟梅", "丽水市水上运动协会", "DNS"),
    (9011, "0153", "秦芳", "江西省桨板运动协会", "DNS"),
    (9012, "0163", "马琳", "江西省桨板运动协会", "DNS"),
    (9013, "0181", "危艳云", "南昌S.K桨类运动俱乐部", "DNS"),
    (9014, "0190", "徐英", "上海远香湖金钥匙桨板俱乐部", "DNS"),
    (9015, "0217", "刘晓莉", "浪里个浪国际桨板俱乐部", "DNS"),
    (9016, "0223", "丁美珊", "永康桨自游", "DNS"),
]


def clean_text(value: str) -> str:
    text = value.strip()
    text = text.replace("咸绩", "成绩").replace("咸名", "姓名")
    return re.sub(r"\s+", " ", text)


def normalize_time(value: str) -> str | None:
    text = clean_text(value).upper().replace("；", ":").replace("：", ":").rstrip(".,。")
    if text in STATUS_LABELS:
        return text
    if re.fullmatch(r"\d{1,2}:\d{2}[:.]\d{2}", text):
        return text.replace(".", ":")
    return None


def is_noise(text: str) -> bool:
    return any(
        token in text
        for token in (
            "MTS",
            "世恒杯",
            "中国体育彩票",
            "飞翔体育",
            "裁判长",
            "地点：",
            "日期：",
            "发令：",
            "检录：",
            "名次",
            "参赛号码",
            "姓名",
            "代表单位",
            "成绩",
            "备注",
            "2025八百里",
            "桨板赛",
        )
    )


def render_pages(pdf_path: Path, out_dir: Path) -> None:
    import fitz

    out_dir.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(pdf_path)
    for index in range(len(doc)):
        image_path = out_dir / f"page-{index + 1:02d}.png"
        if image_path.exists():
            continue
        pix = doc[index].get_pixmap(matrix=fitz.Matrix(2.2, 2.2), alpha=False)
        pix.save(str(image_path))
    doc.close()


def ocr_page(image_path: Path) -> list[dict[str, Any]]:
    env = {
        **os.environ,
        "CLANG_MODULE_CACHE_PATH": "/private/tmp/sup-oujiang-swift-cache",
        "SWIFT_MODULE_CACHE_PATH": "/private/tmp/sup-oujiang-swift-cache",
    }
    completed = subprocess.run(
        ["swift", str(SWIFT_OCR), str(image_path)],
        check=True,
        capture_output=True,
        text=True,
        timeout=60,
        env=env,
    )
    rows = json.loads(completed.stdout)
    for row in rows:
        row["text"] = clean_text(row["text"])
    return rows


def nearest(items: list[dict[str, Any]], y: float, min_x: float, max_x: float, tolerance: float = 0.014) -> str:
    candidates = [
        item
        for item in items
        if min_x <= float(item["x"]) <= max_x
        and abs(float(item["y"]) - y) <= tolerance
        and not is_noise(item["text"])
        and not normalize_time(item["text"])
    ]
    if not candidates:
        return ""
    candidates.sort(key=lambda item: (abs(float(item["y"]) - y), float(item["x"])))
    return candidates[0]["text"]


def parse_individual_page(page: int, items: list[dict[str, Any]], spec: dict[str, Any]) -> list[dict[str, Any]]:
    time_items = [
        item
        for item in items
        if float(item["x"]) >= 0.66 and normalize_time(item["text"])
    ]
    time_items.sort(key=lambda item: -float(item["y"]))
    rows: list[dict[str, Any]] = []
    official_index = 0
    status_index = 1
    for time_item in time_items:
        y = float(time_item["y"])
        finish = normalize_time(time_item["text"])
        if not finish:
            continue
        name = nearest(items, y, 0.22, 0.45)
        bib = nearest(items, y, 0.16, 0.26)
        team = nearest(items, y, 0.44, 0.74) or "个人"
        if not name or is_noise(name):
            continue
        is_status = finish in STATUS_LABELS
        if is_status:
            rank = 9000 + status_index
            status_index += 1
        else:
            rank = int(spec.get("start_rank", 1)) + official_index
            official_index += 1
        rows.append(
            make_result(
                discipline=spec["discipline"],
                gender_group=spec["gender_group"],
                rank_position=rank,
                bib_number=bib,
                athlete_name=name,
                team_name=team,
                finish_time=finish,
                page=page,
            )
        )
    return rows


def make_result(
    *,
    discipline: str,
    gender_group: str,
    rank_position: int,
    bib_number: str,
    athlete_name: str,
    team_name: str,
    finish_time: str,
    page: int,
    team_members: list[str] | None = None,
    board_class: str | None = None,
) -> dict[str, Any]:
    status = finish_time if finish_time in STATUS_LABELS else None
    return {
        "discipline": discipline,
        "gender_group": gender_group,
        "board_class": board_class,
        "round_label": "决赛",
        "rank_position": rank_position,
        "bib_number": bib_number or None,
        "athlete_name_snapshot": athlete_name,
        "team_name": team_name or "个人",
        "finish_time": finish_time,
        "result_status_code": status,
        "result_status_note": STATUS_LABELS.get(status or ""),
        "team_members": team_members or [],
        "source_locator": f"page:{page}",
        "source_note": "八百里瓯江成绩册坐标重解析",
        "parse_confidence": 0.92 if not status else 0.86,
        "review_status": "confirmed",
    }


def parse_status_only_page(page: int, items: list[dict[str, Any]], spec: dict[str, Any]) -> list[dict[str, Any]]:
    return parse_individual_page(page, items, {**spec, "start_rank": 9001})


def build_payload(pdf_path: Path, image_dir: Path) -> dict[str, Any]:
    render_pages(pdf_path, image_dir)
    results: list[dict[str, Any]] = []
    for page, spec in PAGE_SPECS.items():
        if page in {19, 20}:
            continue
        items = ocr_page(image_dir / f"page-{page:02d}.png")
        if spec.get("status_only"):
            results.extend(parse_status_only_page(page, items, spec))
        else:
            results.extend(parse_individual_page(page, items, spec))

    manual_status_pages = {page for page, *_ in MANUAL_STATUS_ROWS}
    results = [
        row for row in results
        if not (
            int(str(row["source_locator"]).split(":")[1]) in manual_status_pages
            and row.get("result_status_code")
        )
    ]
    status_counters: dict[tuple[int, str, str], int] = {}
    for page, discipline, group, bib, name, team, status in MANUAL_STATUS_ROWS:
        key = (page, discipline, group)
        status_counters[key] = status_counters.get(key, 0) + 1
        results.append(
            make_result(
                discipline=discipline,
                gender_group=group,
                rank_position=9000 + status_counters[key],
                bib_number=bib,
                athlete_name=name,
                team_name=team,
                finish_time=status,
                page=page,
            )
        )

    for rank, bib, name, team, finish in PAGE19_ROWS:
        results.append(
            make_result(
                discipline="13公里",
                gender_group="白水组-女子",
                rank_position=rank,
                bib_number=bib or "",
                athlete_name=name,
                team_name=team,
                finish_time=finish,
                page=19,
            )
        )

    for rank, bib, name, team, finish in PAGE20_ROWS:
        results.append(
            make_result(
                discipline="13公里",
                gender_group="白水组-女子",
                rank_position=rank,
                bib_number=bib,
                athlete_name=name,
                team_name=team,
                finish_time=finish,
                page=20,
            )
        )

    results.extend(TEAM_ROWS)
    for page, rank, bibs, team_name, finish, members in DRAGON_ROWS:
        results.append(
            make_result(
                discipline="33公里",
                gender_group="勇士组（龙板组）",
                board_class="龙板",
                rank_position=rank,
                bib_number=bibs,
                athlete_name=members[0],
                team_name=team_name,
                finish_time=finish,
                page=page,
                team_members=members,
            )
        )

    results.sort(key=lambda row: (int(str(row["source_locator"]).split(":")[1]), row["rank_position"]))
    return {
        "event": {
            "event_id": 191,
            "name": "2025八百里瓯江丽水山水诗路桨板赛",
            "start_date": "2025-10-19",
            "end_date": "2025-10-19",
            "province": "浙江省",
            "city": "丽水市",
            "venue": "浙江丽水",
        },
        "source": {
            "source_id": 246,
            "file_name": "2025八百里瓯江成绩册1020.pdf",
            "source_url": "/result-books/2025-800里瓯江/2025八百里瓯江成绩册1020.pdf",
            "original_path": "/Users/xhl/Desktop/桨板比赛成绩/2025-800里瓯江/2025八百里瓯江成绩册1020.pdf",
            "parser_name": "parse-oujiang-2025-results.py",
        },
        "results": results,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", required=True)
    parser.add_argument("--image-dir", default="/private/tmp/oujiang-pages")
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    payload = build_payload(Path(args.pdf), Path(args.image_dir))
    Path(args.output).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    groups: dict[str, int] = {}
    for row in payload["results"]:
        key = f"{row['discipline']} / {row['gender_group']}"
        groups[key] = groups.get(key, 0) + 1
    print(json.dumps({"rows": len(payload["results"]), "groups": groups}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
