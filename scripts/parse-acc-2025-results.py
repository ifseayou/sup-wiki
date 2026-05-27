#!/usr/bin/env python3
"""Parse the image-only 2025 ACC SUP Asian Cup result book (pages 1-112).

Pipeline:
1. OCR every page with macOS Vision (scale=4.0 by default; cached on disk).
2. Pass 1 — parse the INDIVIDUAL POINTS pages (86-112) to build a
   (group, bib) → name lookup and a (group, discipline, rank) → name lookup.
3. Pass 2 — parse race result pages (1-85). Rows with missing OCR name are
   recovered through the indices; otherwise a sentinel `#待识别-...` is recorded
   with `review_status='needs_review'` so the admin UI can resolve later.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import fitz


EVENT_ID = 11
EVENT_NAME = "2025年桨板亚洲杯暨中国桨板嘉年华"
EVENT_START_DATE = "2025-07-11"
EVENT_END_DATE = "2025-07-13"
EVENT_PROVINCE = "浙江省"
EVENT_CITY = "丽水市"
EVENT_VENUE = "浙江青田"
SOURCE_URL = "/result-books/20250710期 ACC2025年桨板亚洲杯暨中国桨板嘉年华/2025桨板亚洲杯成绩总结册-2025 ACC Stand Up Paddle (SUP) Asian Cup Results Book.pdf"
DEFAULT_PDF = "/Users/xhl/Downloads/桨板赛事/20250710期 ACC2025年桨板亚洲杯暨中国桨板嘉年华/2025桨板亚洲杯成绩总结册-2025 ACC Stand Up Paddle (SUP) Asian Cup Results Book.pdf"
PAGE_FIRST = 1
PAGE_LAST = 112
RESULT_PAGE_LAST = 85  # pages 1-85 are per-event races; 86-112 are total points
DEFAULT_SCALE = 4.0
STATUS_CODES = {"DNS", "DNF", "DQ", "DSQ", "DNQ", "OTL"}
STATUS_LABELS = {
    "DNS": "未出发",
    "DNF": "未完赛",
    "DQ": "取消成绩",
    "DSQ": "取消成绩",
    "DNQ": "未晋级",
    "OTL": "超过关门时间",
}

SUBEVENT_TO_DISCIPLINE = {
    "6km": "6km长距离赛",
    "3km": "3km长距离赛",
    "200m": "200米短距离赛",
    "1km": "1km技术赛",
    "600m": "600米短距离赛",
}


def manual_row(
    rank: int | str,
    bib: str,
    name: str,
    finish: str,
    team: str,
    nationality: str = "CHN",
) -> dict[str, Any]:
    """Manually verified ACC rows for pages where Vision OCR drops name/rank cells."""
    finish_text = str(finish or "").strip().upper()
    rank_text = str(rank or "").strip().upper()
    code = finish_text if finish_text in STATUS_CODES else (rank_text if rank_text in STATUS_CODES else None)
    rank_position = int(rank) if isinstance(rank, int) or re.fullmatch(r"\d{1,3}", str(rank).strip()) else None
    return {
        "rank": rank,
        "rank_position": rank_position,
        "bib_number": bib,
        "athlete_name_snapshot": name,
        "finish_time": finish,
        "result_status_code": code,
        "result_status_note": STATUS_LABELS.get(code or ""),
        "team_name": team or "个人",
        "nationality_snapshot": nationality,
    }


MANUAL_RACE_PAGE_ROWS: dict[int, list[dict[str, Any]]] = {
    # Women's Elite 6km: OCR split TAKAYO YOKOYAMA across two lines.
    3: [
        manual_row(1, "E421", "徐浩婷", "37:54.03", "starboard"),
        manual_row(2, "E408", "李若琪", "38:22.45", "TPE TEAM", "TPE"),
        manual_row(3, "E401", "TAKAYO YOKOYAMA", "39:19.80", "JAPAN TEAM", "JPN"),
        manual_row(4, "E415", "傅文涛", "40:01.49", "个人"),
        manual_row(5, "E411", "林小新", "40:42.31", "个人"),
        manual_row(6, "E425", "陈晓晓", "41:09.77", "温州飞速桨板俱乐部"),
        manual_row(7, "E405", "杨镕", "41:19.33", "集美大学"),
        manual_row(8, "E416", "刘发苹", "41:24.61", "格兰德智能科技"),
        manual_row(9, "E413", "李培飞", "41:39.34", "温州飞速桨板俱乐部"),
        manual_row(10, "E418", "关晓燕", "41:50.40", "甘肃速浪体育文化发展有限公司"),
        manual_row(11, "E417", "吴庭锋", "42:08.49", "个人"),
        manual_row(12, "E426", "何银莲", "42:24.41", "格兰德智能科技"),
        manual_row(13, "E402", "严含燕", "42:29.56", "格兰德智能科技"),
        manual_row(14, "E407", "蒋莉文", "42:54.54", "乐划桨板俱乐部"),
        manual_row(15, "E412", "张静", "43:42.91", "个人"),
        manual_row(16, "E410", "张瑛", "44:00.05", "黄山滑水协会"),
        manual_row(17, "E406", "陈烨", "45:13.51", "杭州开心桨板俱乐部"),
        manual_row(18, "E428", "陈颖琪", "45:57.18", "个人"),
        manual_row(19, "E419", "夏艺炀", "46:25.47", "指向轻艇会"),
        manual_row(20, "E423", "汤琳娜", "47:06.28", "个人"),
        manual_row(21, "E427", "汪黎飞", "47:18.46", "宁波甬炫旅游文化发展有限公司"),
        manual_row(22, "E409", "李佳慧", "48:24.68", "福州桨与板文化传播有限公司"),
        manual_row(23, "E420", "刘宇航", "49:16.53", "福州桨与板文化传播有限公司"),
        manual_row(24, "E403", "王可易", "50:12.10", "个人"),
        manual_row(25, "E414", "魏利芬", "51:24.94", "宁波甬炫旅游文化发展有限公司"),
        manual_row(26, "E404", "董舒雯", "53:25.82", "弋汉市汉阳区游泳和水上运动协会"),
        manual_row("DNS", "E424", "支杨洋", "DNS", "个人"),
        manual_row("DNS", "E422", "秦佳", "DNS", "个人"),
    ],
    12: [
        manual_row(1, "716", "秦著华", "00:40:55", "格兰德智能科技"),
        manual_row(2, "737", "胡苏萍", "00:42:47", "个人"),
        manual_row(3, "717", "谭惠娟", "00:42:56", "广东省冬泳协会"),
        manual_row(4, "720", "贺桂梅", "00:43:55", "江西省桨板运动协会"),
        manual_row(5, "736", "王晓慧", "00:44:45", "个人"),
        manual_row(6, "726", "许海峰", "00:45:13", "福建省曙光救援中心"),
        manual_row(7, "729", "卜仕宣", "00:45:22", "芜湖市桨板运动协会"),
        manual_row(8, "728", "胡玉美", "00:45:34", "格兰德智能科技"),
        manual_row(9, "731", "朱春花", "00:46:13", "芜湖市桨板运动协会"),
        manual_row(10, "741", "林杏美", "00:46:25", "瑞安尚舟桨板俱乐部"),
        manual_row(11, "709", "孙建叶", "00:46:38", "温州飞速桨板俱乐部"),
        manual_row(12, "710", "赵海侠", "00:47:02", "格兰德智能科技"),
        manual_row(13, "746", "杨红梅", "00:47:55", "上海远香湖金钥匙桨板俱乐部"),
        manual_row(14, "718", "曾诗萍", "00:48:26", "弋汉市汉阳区游泳和水上运动协会"),
        manual_row(15, "721", "戴茜雅", "00:48:45", "上海远香湖金钥匙桨板俱乐部"),
        manual_row(16, "703", "刘志云", "00:48:48", "个人"),
        manual_row(17, "739", "屠若曦", "00:49:18", "长兴县桨板运动协会"),
        manual_row(18, "713", "吉雅勤", "00:50:25", "进击桨板工作室"),
        manual_row(19, "701", "聂明艳", "00:53:13", "个人"),
        manual_row(20, "722", "谢章琴", "00:54:06", "温州飞速桨板俱乐部"),
        manual_row(21, "723", "刘丽娟", "00:54:19", "福建省曙光救援中心"),
        manual_row(22, "725", "赵浩然", "00:54:24", "福建省曙光救援中心"),
        manual_row(23, "708", "赖红仙", "00:54:43", "宁波甬炫旅游文化发展有限公司"),
        manual_row(24, "738", "杨浩英", "00:55:07", "个人"),
        manual_row(25, "749", "许慧珊", "00:55:12", "Hong Kong, China", "HKG"),
        manual_row(26, "742", "吴回回", "00:55:33", "温州飞速桨板俱乐部"),
        manual_row(27, "748", "姜杉", "00:57:12", "上海远香湖金钥匙桨板俱乐部"),
        manual_row(28, "743", "徐建芬", "00:57:36", "温州飞速桨板俱乐部"),
        manual_row(29, "735", "朱少菊", "00:59:00", "青田桨板运动俱乐部"),
        manual_row(30, "733", "毛丽姿", "00:59:17", "青田桨板运动俱乐部"),
        manual_row(31, "707", "梁玲玲", "01:00:01", "芜湖市桨板运动协会"),
        manual_row("DSQ", "724", "陈婷", "DSQ", "个人"),
    ],
    15: [
        manual_row(35, "143", "孙晨轩", "00:31:11", "丽水水上运动协会"),
        manual_row(36, "112", "何羿均", "00:31:24", "个人"),
        manual_row(37, "105", "刘航霄", "00:31:31", "格兰德智能科技"),
        manual_row(38, "178", "杨昕瑄", "00:32:15", "苏州棕榈湾文旅水上运动俱乐部"),
        manual_row(39, "165", "张亦钦", "00:32:19", "个人"),
        manual_row(40, "146", "傅育", "00:32:27", "上饶市公开水域运动协会"),
        manual_row(41, "124", "龚奕宁", "00:32:40", "武汉中法外校-中竞"),
        manual_row(42, "151", "徐一阳", "00:32:44", "个人"),
        manual_row(43, "104", "赵安然", "00:33:35", "格兰德智能科技"),
        manual_row(44, "145", "王岭山", "00:33:46", "武汉中法外校-中竞"),
        manual_row(45, "138", "赵泓博", "00:35:10", "青岛小顽童桨板俱乐部"),
        manual_row(46, "136", "李铭宣", "00:35:23", "青岛小顽童桨板俱乐部"),
        manual_row(47, "111", "陈家骏", "00:35:44", "温州飞速桨板俱乐部"),
        manual_row(48, "154", "李训耀", "00:35:53", "宁波斯波特体育文化发展有限公司"),
        manual_row(49, "156", "李宗曼", "00:36:27", "宁波栖拓文旅有限公司"),
        manual_row(50, "150", "李秉韬", "00:36:29", "宁波斯波特体育文化发展有限公司"),
        manual_row(51, "122", "崔嘉豪", "00:37:21", "重庆军航户外"),
        manual_row(52, "128", "韩笑语", "00:37:32", "个人"),
        manual_row(53, "137", "张珺轩", "00:38:04", "青岛小顽童桨板俱乐部"),
        manual_row(54, "110", "蔡其柯", "00:38:16", "上海极浪水上运动中心"),
        manual_row(55, "133", "余子豪", "00:38:31", "武汉中法外校-中竞"),
        manual_row(56, "117", "鲁诗远", "00:39:41", "个人"),
        manual_row(57, "177", "徐世兴", "00:39:51", "宁波斯波特体育文化发展有限公司"),
        manual_row(58, "106", "吴讷言", "00:40:47", "个人"),
        manual_row(59, "149", "朱子墨", "00:42:13", "温州飞速桨板俱乐部"),
        manual_row(60, "131", "舒万隆", "00:43:10", "武汉中法外校-中竞"),
        manual_row("DNF", "144", "陈灵羲", "DNF", "个人"),
        manual_row("DNF", "107", "吴翼然", "DNF", "上海绘玩户外运动俱乐部"),
        manual_row("DNF", "167", "谈艺蒙", "DNF", "指向轻艇会"),
        manual_row("DSQ", "142", "唐逐原", "DSQ", "个人"),
        manual_row("DSQ", "120", "沈钜翔", "DSQ", "四川击浪"),
        manual_row("DNS", "102", "何麟", "DNS", "苏州剑鱼皮划艇俱乐部"),
        manual_row("DNS", "108", "王柒捷", "DNS", "铜仁市乐水水上运动俱乐部"),
        manual_row("DNS", "113", "李峻锐", "DNS", "周口市桨板运动协会"),
    ],
    17: [
        manual_row(1, "218", "思文慧", "00:21:54", "赤壁市陆水湖桨板运动俱乐部"),
        manual_row(2, "245", "戴言纹", "00:22:23", "上海极浪水上运动中心"),
        manual_row(3, "248", "张煊妍", "00:23:14", "指向轻艇会"),
        manual_row(4, "212", "周蔚熹", "00:23:44", "四川击浪"),
        manual_row(5, "254", "韩琢彧", "00:24:07", "进击桨板工作室"),
        manual_row(6, "221", "郭雨晨", "00:24:11", "赤壁市陆水湖桨板运动俱乐部"),
        manual_row(7, "216", "喻美琳", "00:24:16", "赤壁市陆水湖桨板运动俱乐部"),
        manual_row(8, "256", "韦一莹", "00:25:01", "指向轻艇会"),
        manual_row(9, "225", "柯栖源", "00:25:14", "弋汉市汉阳区游泳和水上运动协会"),
        manual_row(10, "219", "蔡昊璟", "00:26:19", "赤壁市陆水湖桨板运动俱乐部"),
        manual_row(11, "246", "鲍美伊", "00:26:27", "上海极浪水上运动中心"),
        manual_row(12, "247", "赵嘉倪", "00:26:27", "指向轻艇会"),
        manual_row(13, "217", "刘鑫怡", "00:26:37", "赤壁市陆水湖桨板运动俱乐部"),
        manual_row(14, "222", "聂令仪", "00:26:56", "上海槊果体育"),
        manual_row(15, "220", "蔡昊辰", "00:26:59", "赤壁市陆水湖桨板运动俱乐部"),
        manual_row(16, "215", "邓雅鑫", "00:27:00", "赤壁市陆水湖桨板运动俱乐部"),
        manual_row(17, "207", "游思语", "00:27:47", "铜仁市乐水水上运动俱乐部"),
        manual_row(18, "255", "赵驭妃", "00:28:17", "个人"),
        manual_row(19, "208", "伏羲浩玥", "00:28:39", "昆明飚风文化传播有限公司"),
        manual_row(20, "229", "王馨艾", "00:29:12", "青岛小顽童桨板俱乐部"),
        manual_row(21, "251", "张雨禾", "00:29:28", "上海绘玩户外运动俱乐部"),
        manual_row(22, "206", "徐艺菲", "00:30:11", "铜仁市乐水水上运动俱乐部"),
        manual_row(23, "232", "赵梓彤", "00:30:14", "青岛小顽童桨板俱乐部"),
        manual_row(24, "224", "陈锦宜", "00:30:25", "弋汉市汉阳区游泳和水上运动协会"),
        manual_row(25, "257", "杨昕玥", "00:30:29", "苏州棕榈湾文旅水上运动俱乐部"),
        manual_row(26, "209", "王子梵", "00:30:43", "苏州棕榈湾文旅水上运动俱乐部"),
        manual_row(27, "243", "李秋瞳", "00:30:43", "扬州嘉泽皮划艇桨板俱乐部"),
        manual_row(28, "242", "焦思齐", "00:31:13", "宁波斯波特体育文化发展有限公司"),
        manual_row(29, "228", "徐泫浠", "00:31:23", "苏州棕榈湾文旅水上运动俱乐部"),
        manual_row(30, "239", "何梦晨", "00:31:40", "丽水水上运动协会"),
        manual_row(31, "204", "徐伊琳", "00:31:47", "苏州剑鱼皮划艇俱乐部"),
        manual_row(32, "240", "童子曦", "00:32:29", "宁波甬炫旅游文化发展有限公司"),
        manual_row(33, "203", "沈之好", "00:32:41", "苏州剑鱼皮划艇俱乐部"),
        manual_row(34, "214", "吴昕凌", "00:33:14", "佛山市顺德区桨板运动协会"),
    ],
    18: [
        manual_row(35, "236", "张舒萌", "00:33:20", "安徽蓝鲸体育文化有限公司"),
        manual_row(36, "250", "潘书然", "00:34:21", "个人"),
        manual_row(37, "E428", "胡梓萱", "00:34:59", "宁波甬炫旅游文化发展有限公司"),
        manual_row(38, "241", "李筱涵", "00:36:28", "宁波斯波特体育文化发展有限公司"),
        manual_row(39, "237", "陈一诺", "00:37:55", "丽水水上运动协会"),
        manual_row(40, "238", "王若辰", "00:38:12", "丽水水上运动协会"),
        manual_row(41, "227", "穆昱涵", "00:38:22", "周口市桨板运动协会"),
        manual_row(42, "244", "俞思羽", "00:38:23", "苏州棕榈湾文旅水上运动俱乐部"),
        manual_row(43, "201", "陈蓝伊一", "00:38:40", "个人"),
        manual_row(44, "233", "卓灵犀", "00:38:50", "格兰德智能科技"),
        manual_row(45, "231", "王梓童", "00:39:18", "青岛小顽童桨板俱乐部"),
        manual_row("DNF", "202", "舒欣悦", "DNF", "个人"),
        manual_row("DNS", "205", "王钰晰", "DNS", "铜仁市乐水水上运动俱乐部"),
        manual_row("DNS", "213", "全钰婷", "DNS", "个人"),
        manual_row("DNS", "223", "杨依柔", "DNS", "个人"),
        manual_row("DNS", "226", "张曾子", "DNS", "弋汉市汉阳区游泳和水上运动协会"),
        manual_row("DNS", "230", "王仟意", "DNS", "个人"),
        manual_row("DNS", "235", "汪莞增", "DNS", "个人"),
        manual_row("DNS", "249", "唐诗", "DNS", "上海极浪水上运动中心"),
        manual_row("DNS", "252", "纪念初", "DNS", "上海绘玩户外运动俱乐部"),
        manual_row("DNS", "253", "叶闻涛", "DNS", "个人"),
    ],
    19: [
        manual_row(1, "364", "熊志远", "00:19:56", "进击桨板工作室"),
        manual_row(2, "363", "甘耀昆", "00:20:13", "苏州剑鱼皮划艇俱乐部"),
        manual_row(3, "310", "杨思远", "00:20:15", "铜仁市乐水水上运动俱乐部"),
        manual_row(4, "359", "史彬扬", "00:20:31", "宁波斯波特体育文化发展有限公司"),
        manual_row(5, "357", "谢珂峻", "00:20:40", "宁波甬炫旅游文化发展有限公司"),
        manual_row(6, "315", "冉昊瞳", "00:20:45", "铜仁市乐水水上运动俱乐部"),
        manual_row(7, "358", "王煊安", "00:20:52", "宁波甬炫旅游文化发展有限公司"),
        manual_row(8, "377", "王德瑞", "00:21:01", "个人"),
        manual_row(9, "326", "罗义凡", "00:21:08", "重庆南开两江中学"),
        manual_row(10, "374", "金郎翼", "00:21:16", "上海槊果体育"),
        manual_row(11, "352", "王子谦", "00:21:23", "宁波甬炫旅游文化发展有限公司"),
        manual_row(12, "366", "陆昊君", "00:21:41", "指向轻艇会"),
        manual_row(13, "336", "彭煜泽", "00:21:46", "个人"),
        manual_row(14, "313", "刘益诚", "00:21:53", "铜仁市乐水水上运动俱乐部"),
        manual_row(15, "351", "徐梓航", "00:21:59", "宁波甬炫旅游文化发展有限公司"),
        manual_row(16, "343", "杨禹柯", "00:22:08", "BLACK皮艇桨板运动中心"),
        manual_row(17, "306", "胡晨朔", "00:22:10", "苏州剑鱼皮划艇俱乐部"),
        manual_row(18, "327", "陈书瀚", "00:22:14", "重庆军航户外"),
        manual_row(19, "391", "林语", "00:22:27", "厦门十里长堤浪里白条桨板俱乐部"),
        manual_row(20, "346", "陈则添", "00:22:33", "个人"),
        manual_row(21, "329", "唐梓涵", "00:22:37", "重庆江浪体育俱乐部"),
        manual_row(22, "323", "赵子木", "00:22:38", "昆明飚风文化传播有限公司"),
        manual_row(23, "314", "冉芷浩", "00:22:47", "铜仁市乐水水上运动俱乐部"),
        manual_row(24, "361", "倪浩铭", "00:22:48", "苏州棕榈湾文旅水上运动俱乐部"),
        manual_row(25, "367", "吴天宇", "00:22:49", "个人"),
        manual_row(26, "354", "池平涛", "00:22:51", "宁波甬炫旅游文化发展有限公司"),
        manual_row(27, "362", "陈俊翔", "00:23:00", "苏州剑鱼皮划艇俱乐部"),
        manual_row(28, "335", "叶展成", "00:23:08", "金澎体育文化(广东)有限公司"),
        manual_row(29, "376", "冯乐齐", "00:23:12", "指向轻艇会"),
        manual_row(30, "368", "邢家禾", "00:23:13", "指向轻艇会"),
        manual_row(31, "385", "柴昕池", "00:23:15", "青岛小顽童桨板俱乐部"),
        manual_row(32, "381", "张辰阳", "00:23:19", "上海槊果体育"),
        manual_row(33, "328", "黄驿博", "00:23:25", "重庆南开两江中学"),
        manual_row(34, "373", "胡峻玮", "00:23:26", "个人"),
    ],
    20: [
        manual_row(35, "325", "秦子杰", "00:23:32", "个人"),
        manual_row(36, "350", "胡鸿博", "00:23:32", "宁波甬炫旅游文化发展有限公司"),
        manual_row(37, "341", "田梓骏", "00:23:41", "个人"),
        manual_row(38, "379", "张其骥", "00:23:44", "上海槊果体育"),
        manual_row(39, "311", "段翔曦", "00:23:54", "铜仁市乐水水上运动俱乐部"),
        manual_row(40, "372", "苟彦景", "00:24:19", "指向轻艇会"),
        manual_row(41, "360", "王培铭", "00:24:32", "宁波斯波特体育文化发展有限公司"),
        manual_row(42, "334", "刘家睿", "00:24:35", "金澎体育文化(广东)有限公司"),
        manual_row(43, "308", "倪中言", "00:24:43", "上海极浪水上运动中心"),
        manual_row(44, "382", "谢安嘉", "00:24:43", "上海槊果体育"),
        manual_row(45, "302", "Abel Tan Wei Ern", "00:25:08", "Team KL SUP (Malaysia)", "MAS"),
        manual_row(46, "333", "刘子洵", "00:25:11", "佛山市顺德桨板运动协会"),
        manual_row(47, "312", "陈浩宇", "00:25:17", "铜仁市乐水水上运动俱乐部"),
        manual_row(48, "347", "王君浩", "00:25:18", "指向轻艇会"),
        manual_row(49, "387", "张乐之", "00:25:19", "指向轻艇会"),
        manual_row(50, "321", "廖阳", "00:25:31", "赤壁市陆水湖桨板运动俱乐部"),
        manual_row(51, "303", "陆品铮", "00:26:23", "青岛小顽童桨板俱乐部"),
        manual_row(52, "322", "徐文钊", "00:26:46", "宁波甬炫旅游文化发展有限公司"),
        manual_row(53, "369", "项一珉", "00:27:09", "指向轻艇会"),
        manual_row(54, "330", "连胤伯", "00:27:11", "青岛小顽童桨板俱乐部"),
        manual_row(55, "380", "蔡舟涵", "00:27:18", "进击桨板工作室"),
        manual_row(56, "386", "李俊言", "00:27:27", "武汉中法外校-中竞"),
        manual_row(57, "309", "徐伊洋", "00:27:53", "苏州剑鱼皮划艇俱乐部"),
        manual_row(58, "353", "叶嘉庾", "00:28:02", "五四桨板俱乐部（棹歌体育）"),
        manual_row(59, "356", "王健宇", "00:28:10", "宁波栖拓文旅有限公司"),
        manual_row(60, "331", "陈梓浩", "00:28:40", "佛山市顺德桨板运动协会"),
        manual_row(61, "332", "陈沛立", "00:29:45", "佛山市顺德桨板运动协会"),
        manual_row(62, "318", "肖罗恩", "00:30:36", "福建省曙光救援中心"),
        manual_row(63, "320", "许轩豪", "00:30:40", "武汉中法外校-中竞"),
        manual_row(64, "319", "钟恺", "00:31:26", "个人"),
        manual_row(65, "349", "张家禾", "00:31:31", "安徽蓝鲸体育文化有限公司"),
        manual_row(66, "388", "闫乐闻", "00:31:44", "昆明飚风文化传播有限公司"),
        manual_row(67, "316", "侯毅飞", "00:32:04", "个人"),
    ],
    21: [
        manual_row(68, "355", "曹洛睿", "00:32:08", "个人"),
        manual_row(69, "371", "蒋辰昊", "00:32:27", "上海绘玩户外运动俱乐部"),
        manual_row(70, "344", "林钲轩", "00:35:21", "青岛小顽童桨板俱乐部"),
        manual_row(71, "305", "陈泽铠", "00:35:44", "个人"),
        manual_row(72, "E335", "吴倬丞", "00:38:48", "个人"),
        manual_row(73, "304", "林嘉炜", "00:40:06", "福建省曙光救援中心"),
        manual_row("DNF", "317", "叶佳浩", "DNF", "个人"),
        manual_row("DSQ", "307", "叶金彦磊", "DSQ", "青田桨板运动俱乐部"),
        manual_row("DNS", "301", "ANEESH KUMAR SATHISH KUMAR", "DNS", "印度", "IND"),
        manual_row("DNS", "324", "王耀梓", "DNS", "个人"),
        manual_row("DNS", "337", "陈思源", "DNS", "个人"),
        manual_row("DNS", "338", "李子辰", "DNS", "赤壁市陆水湖桨板运动俱乐部"),
        manual_row("DNS", "339", "阮文博", "DNS", "赤壁市陆水湖桨板运动俱乐部"),
        manual_row("DNS", "340", "陈皓", "DNS", "赤壁市陆水湖桨板运动俱乐部"),
        manual_row("DNS", "345", "何牧", "DNS", "格兰德智能科技"),
        manual_row("DNS", "348", "喻仁泽", "DNS", "芜湖市桨板运动协会"),
        manual_row("DNS", "365", "吴嘉懿", "DNS", "个人"),
        manual_row("DNS", "370", "孔子豪", "DNS", "上海槊果体育"),
        manual_row("DNS", "375", "王奕程", "DNS", "指向轻艇会"),
        manual_row("DNS", "378", "桂啸行", "DNS", "个人"),
        manual_row("DNS", "383", "邵泽恒", "DNS", "上海槊果体育"),
        manual_row("DNS", "384", "吴厚锐", "DNS", "个人"),
        manual_row("DNS", "389", "盛熠轩", "DNS", "个人"),
        manual_row("DNS", "390", "张根硕", "DNS", "武汉中法外校-中竞"),
    ],
    24: [
        manual_row(1, "809", "李再忠", "00:38:12", "泸州龙溪河酒庄"),
        manual_row(2, "808", "彭祥", "00:38:43", "个人"),
        manual_row(3, "810", "黄广谦", "00:39:08", "广东省冬泳协会"),
        manual_row(4, "817", "游正礼", "00:39:42", "格兰德智能科技"),
        manual_row(5, "839", "高正新", "00:40:50", "盐城市桨板运动协会"),
        manual_row(6, "813", "高绪洪", "00:41:28", "个人"),
        manual_row(7, "821", "陈孝辉", "00:41:34", "福州桨与板文化传播有限公司"),
        manual_row(8, "806", "袁先平", "00:42:42", "个人"),
        manual_row(9, "844", "孙志", "00:44:08", "个人"),
        manual_row(10, "811", "傅超文", "00:44:18", "个人"),
        manual_row(11, "843", "刘前曦", "00:45:03", "上海远香湖金钥匙桨板俱乐部"),
        manual_row(12, "819", "龚卫民", "00:45:06", "南昌市桨板运动协会"),
        manual_row(13, "825", "严雪林", "00:45:10", "个人"),
        manual_row(14, "832", "朱力明", "00:45:40", "瑞安尚舟桨板俱乐部"),
        manual_row(15, "836", "孙培雄", "00:45:53", "个人"),
        manual_row(16, "823", "应宏熹", "00:46:34", "个人"),
        manual_row(17, "828", "吴美堂", "00:46:35", "长兴县桨板运动协会"),
        manual_row(18, "835", "赖立新", "00:46:48", "温州飞速桨板俱乐部"),
        manual_row(19, "816", "龚尔斌", "00:47:00", "上饶市公开水域运动协会"),
        manual_row(20, "834", "毛劲峰", "00:47:47", "个人"),
        manual_row(21, "805", "杨京平", "00:48:07", "潇湘桨板水上运动俱乐部"),
        manual_row(22, "822", "徐旭峰", "00:48:56", "青田桨板运动俱乐部"),
        manual_row(23, "815", "陈养华", "00:48:57", "上饶市公开水域运动协会"),
        manual_row(24, "841", "倪建华", "00:48:58", "个人"),
        manual_row(25, "818", "徐玉光", "00:50:39", "个人"),
        manual_row(26, "801", "游世雄", "00:51:13", "个人"),
        manual_row(27, "803", "施金华", "00:51:37", "个人"),
        manual_row(28, "807", "王力军", "00:52:26", "个人"),
        manual_row(29, "829", "王宗楷", "00:53:19", "个人"),
        manual_row(30, "837", "刘晓锋", "00:53:33", "个人"),
        manual_row(31, "838", "徐煊", "00:53:54", "个人"),
        manual_row(32, "820", "林宇", "00:55:12", "福州桨与板文化传播有限公司"),
        manual_row(33, "833", "吕华国", "00:56:15", "个人"),
        manual_row(34, "830", "姜宠发", "00:56:37", "个人"),
    ],
    26: [
        manual_row(1, "911", "曹宝玉", "00:45:45", "格兰德智能科技"),
        manual_row(2, "914", "应爱娟", "00:46:03", "格兰德智能科技"),
        manual_row(3, "906", "杨美秀", "00:47:24", "潇湘桨板水上运动俱乐部"),
        manual_row(4, "909", "甘艳枝", "00:49:04", "弋汉市汉阳区游泳和水上运动协会"),
        manual_row(5, "908", "谢玲辉", "00:49:46", "潇湘桨板水上运动俱乐部"),
        manual_row(6, "922", "马兰", "00:50:10", "个人"),
        manual_row(7, "919", "曾朝莲", "00:50:26", "长兴县桨板运动协会"),
        manual_row(8, "917", "冯爱心", "00:52:38", "长兴县桨板运动协会"),
        manual_row(9, "915", "周杰", "00:53:48", "格兰德智能科技"),
        manual_row(10, "902", "赖爱桃", "00:55:28", "南昌市桨板运动协会"),
        manual_row(11, "921", "龚翠香", "00:55:59", "宁波栖拓sea-Tour水上俱乐部"),
        manual_row(12, "904", "邹颖红", "00:56:55", "南昌市桨板运动协会"),
        manual_row(13, "910", "王桂萍", "00:57:18", "湖北省贝斯特水上运动俱乐部"),
        manual_row(14, "923", "邵惠芬", "00:57:29", "个人"),
        manual_row(15, "924", "丁月红", "00:59:02", "个人"),
        manual_row(16, "905", "王晓燕", "01:01:41", "个人"),
        manual_row(17, "916", "黄水娥", "01:02:55", "长兴县桨板运动协会"),
        manual_row(18, "925", "于贵珍", "01:03:53", "上海远香湖金钥匙桨板俱乐部"),
        manual_row(19, "907", "李乃玉", "01:05:22", "广东省冬泳协会"),
        manual_row("DNF", "920", "吴乐平", "DNF", "个人"),
        manual_row("DNS", "901", "梁丽群", "DNS", "个人"),
        manual_row("DNS", "903", "朱惠平", "DNS", "个人"),
        manual_row("DNS", "913", "韩毅红", "DNS", "个人"),
    ],
}


@dataclass
class Cell:
    text: str
    x: float
    y: float
    w: float
    h: float


def clean(value: Any) -> str:
    text = str(value or "").strip()
    text = (
        text.replace("（", "(")
        .replace("）", ")")
        .replace("：", ":")
        .replace("．", ".")
        .replace("。", ".")
        .replace("–", "-")
        .replace("—", "-")
    )
    return re.sub(r"\s+", " ", text).strip()


def normalize_time(value: str) -> str:
    text = clean(value).upper()
    text = text.replace("O", "0") if re.search(r"\d", text) else text
    text = re.sub(r"[|｜]", "1", text)
    text = text.replace("-", ".")
    text = text.rstrip(".")
    if text in STATUS_CODES:
        return text
    match = re.fullmatch(r"(\d{1,2}):(\d{2}):(\d{2})", text)
    if match:
        return f"{match.group(1)}:{match.group(2)}.{match.group(3)}"
    return text


def status_code(value: str) -> str | None:
    text = clean(value).upper()
    return text if text in STATUS_CODES else None


def parse_time_to_seconds(value: str) -> float | None:
    text = normalize_time(value)
    if not text or status_code(text):
        return None
    if re.fullmatch(r"\d+(?:\.\d+)?", text):
        return float(text)
    parts = text.split(":")
    try:
        if len(parts) == 2:
            return int(parts[0]) * 60 + float(parts[1])
        if len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])
    except ValueError:
        return None
    return None


def norm_country(value: str) -> str:
    text = clean(value).upper()
    return {"CHIN": "CHN", "JAP": "JPN"}.get(text, text)


def split_members(value: str) -> list[str]:
    return [clean(item) for item in re.split(r"[/、,，;；]+", value) if clean(item)]


def normalize_bib(value: str) -> str:
    text = clean(value).upper().replace(" ", "")
    return text


def normalized_name(value: str) -> str:
    return re.sub(r"\s+", "", clean(value)).lower()


def load_or_ocr_page(pdf: fitz.Document, page_number: int, cache_dir: Path, swift_script: Path, scale: float) -> list[Cell]:
    cache_path = cache_dir / f"page-{page_number:03d}.json"
    if cache_path.exists():
        raw = json.loads(cache_path.read_text(encoding="utf-8"))
    else:
        with tempfile.TemporaryDirectory(prefix="sup-acc-page-") as tmp:
            tmp_path = Path(tmp)
            image_path = tmp_path / f"page-{page_number:03d}.png"
            pix = pdf[page_number - 1].get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
            pix.save(str(image_path))
            env = {
                **os.environ,
                "CLANG_MODULE_CACHE_PATH": str(tmp_path / "clang-module-cache"),
                "SWIFT_MODULE_CACHE_PATH": str(tmp_path / "swift-module-cache"),
            }
            completed = subprocess.run(
                ["swift", str(swift_script), str(image_path)],
                check=False,
                capture_output=True,
                text=True,
                timeout=120,
                env=env,
            )
            if completed.returncode != 0:
                raise RuntimeError(f"OCR failed on page {page_number}: {completed.stderr or completed.stdout}")
            raw = json.loads(completed.stdout or "[]")
            cache_path.parent.mkdir(parents=True, exist_ok=True)
            cache_path.write_text(json.dumps(raw, ensure_ascii=False, indent=2), encoding="utf-8")
    cells = [Cell(clean(item.get("text")), float(item.get("x", 0)), float(item.get("y", 0)), float(item.get("w", 0)), float(item.get("h", 0))) for item in raw]
    return [cell for cell in cells if cell.text]


GENDER_GROUP_RULES = [
    ("精英", "精英组"),
    ("U18", "U18组"),
    ("U15", "U15组"),
    ("U12", "U12组"),
    ("U9", "U9组"),
    ("大师", "大师组"),
    ("卡胡纳", "卡胡纳组"),
    ("公开", "公开组"),
    ("青少年", "青少年组"),
]


def detect_gender_group(joined: str, compact: str) -> tuple[str, str]:
    if "男子" in compact or re.search(r"\bMen", joined, re.I):
        gender = "男子"
    elif "女子" in compact or re.search(r"\bWomen", joined, re.I):
        gender = "女子"
    else:
        gender = "混合"

    group = None
    for key, label in GENDER_GROUP_RULES:
        if key in compact or key.lower() in joined.lower():
            group = label
            break
    if group is None:
        group = "混合组" if gender == "混合" else "公开组"
    gender_group = group if gender == "混合" else f"{group}{gender}"
    return group, gender_group


def page_context(cells: list[Cell]) -> dict[str, Any]:
    top = sorted([cell for cell in cells if cell.y > 0.78], key=lambda c: (-c.y, c.x))
    title_lines = [cell.text for cell in top]
    joined = " ".join(title_lines)
    chinese_candidates = [
        cell.text for cell in top
        if ("比赛成绩单" in cell.text or "成绩单" in cell.text) and not cell.text.startswith("2025")
    ]
    english_candidates = [cell.text for cell in top if "Results" in cell.text and "ACC" not in cell.text]
    title = clean(chinese_candidates[-1] if chinese_candidates else (english_candidates[-1] if english_candidates else joined))
    compact = title.replace(" ", "")

    round_label = "决赛" if re.search(r"决赛|Final", joined, re.I) else None
    if round_label is None and re.search(r"Heat|预赛", joined, re.I):
        round_label = "预赛"

    group, gender_group = detect_gender_group(joined, compact)

    if "龙板" in compact or "Dragon" in joined:
        discipline = re.sub(r"\s*比赛成绩单.*$", "", title)
        discipline = re.sub(r"^\d{3,4}m?", "200米", discipline)
        discipline = re.sub(r"^200米米", "200米", discipline)
        if not discipline or "Results" in discipline:
            discipline = "200米龙板男女混合四人赛"
        gender_group = "龙板混合组"
        board_class = "龙板"
    elif re.search(r"200\s*m|200米|Sprint", joined, re.I):
        discipline = "200米短距离赛"
        board_class = None
    elif re.search(r"1\s*km|1km|技术|Technical", joined, re.I):
        discipline = "1km技术赛"
        board_class = None
    elif re.search(r"6\s*km|6km", joined, re.I):
        discipline = "6km长距离赛"
        board_class = None
    elif re.search(r"3\s*km|3km", joined, re.I):
        discipline = "3km长距离赛"
        board_class = None
    elif re.search(r"600\s*m|600米", joined, re.I):
        discipline = "600米短距离赛"
        board_class = None
    else:
        discipline = re.sub(r"\s*比赛成绩单.*$", "", title) or "未分项目"
        board_class = None

    no_match = re.search(r"\bN[O0]\.?\s*(\d+)", joined, re.I)
    source_note = f"2025桨板亚洲杯成绩册OCR解析：{title}"
    return {
        "title": title,
        "group": group,
        "gender_group": gender_group,
        "discipline": discipline,
        "board_class": board_class,
        "round_label": round_label or "决赛",
        "source_note": source_note,
        "page_no_label": no_match.group(1) if no_match else None,
    }


def is_individual_points_page(cells: list[Cell]) -> bool:
    return any("INDIVIDUAL POINTS" in cell.text or "个人赛积分" in cell.text for cell in cells)


def is_result_value(text: str) -> bool:
    value = normalize_time(text)
    return bool(re.fullmatch(r"(?:\d{1,2}:)?\d{1,2}[:.]\d{2}(?:[.:]\d{1,3})?|\d{2,3}(?:\.\d{1,3})|DNS|DNF|DQ|DSQ|DNQ|OTL", value, re.I))


def is_bib(text: str) -> bool:
    return bool(re.fullmatch(r"[A-Z]\d{3}|G\d{3}|\d{2,4}", clean(text), re.I))


def is_rank(text: str) -> bool:
    text = clean(text).upper()
    return text in STATUS_CODES or bool(re.fullmatch(r"\d{1,3}", text))


def is_total_points(text: str) -> bool:
    return bool(re.fullmatch(r"\d{2,5}(?:\.\d+)?", clean(text)))


def name_like(text: str) -> bool:
    text = clean(text)
    if not text:
        return False
    if re.fullmatch(r"\d+", text):
        return False
    if is_rank(text) or is_bib(text) or is_result_value(text) or norm_country(text) in {"CHN", "JPN", "HKG", "TPE", "MAS", "IND", "SGP", "KOR"}:
        return False
    if any(skip in text for skip in ("Rank", "Name", "Club", "Result", "成绩", "名次", "姓名", "国家", "俱乐部", "备注", "发令", "Start", "2025", "ACC", "Chief", "Judge")):
        return False
    return True


def collect_rows(cells: list[Cell], y_min: float = 0.08, y_max: float = 0.79) -> list[list[Cell]]:
    body = [cell for cell in cells if y_min < cell.y < y_max]
    body.sort(key=lambda c: -c.y)
    rows: list[list[Cell]] = []
    for cell in body:
        if cell.h > 0.08 and cell.w < 0.08:
            continue
        for row in rows:
            if abs(row[0].y - cell.y) <= 0.011:
                row.append(cell)
                break
        else:
            rows.append([cell])
    for row in rows:
        row.sort(key=lambda c: c.x)
    rows.sort(key=lambda row: -sum(cell.y for cell in row) / len(row))
    return rows


def nearest_text(row: list[Cell], min_x: float, max_x: float, *, allow_join: bool = True) -> str:
    items = [cell for cell in row if min_x <= cell.x < max_x]
    if not items:
        return ""
    items.sort(key=lambda c: c.x)
    if allow_join:
        return clean(" ".join(item.text for item in items))
    return clean(max(items, key=lambda c: c.w).text)


# ---------------------------------------------------------------------------
# INDIVIDUAL POINTS (pages 86-112) parsing
# ---------------------------------------------------------------------------


def detect_points_subevents(cells: list[Cell]) -> list[str]:
    """Return ordered list of sub-event keys ("6km" / "3km" / "200m" / "1km" / "600m")
    based on the column header row of an INDIVIDUAL POINTS page."""
    header_lines = []
    for cell in cells:
        if 0.79 < cell.y < 0.84 and cell.x > 0.30:
            header_lines.append(cell.text)
    joined = " ".join(header_lines)
    pattern = re.compile(r"(6km|3km|200m|1km|600m)\s*(?:Rank|Points|排名|积分)", re.I)
    seen = []
    for match in pattern.finditer(joined):
        key = match.group(1).lower()
        if key not in seen:
            seen.append(key)
    return seen


def parse_points_row(row: list[Cell], context: dict[str, Any], subevents: list[str], page_number: int) -> dict[str, Any] | None:
    rank_text = nearest_text(row, 0.07, 0.13, allow_join=False)
    bib_text = nearest_text(row, 0.12, 0.18, allow_join=False)
    name_text = nearest_text(row, 0.17, 0.24)
    nat_text = nearest_text(row, 0.23, 0.30, allow_join=False)
    club_text = nearest_text(row, 0.30, 0.46)
    # Fallback: pull bib by pattern from leftmost columns if nearest_text missed
    if not bib_text:
        bib_candidates = [c.text for c in row if c.x < 0.20 and is_bib(c.text) and not re.fullmatch(r"\d{1,3}", c.text)]
        if bib_candidates:
            bib_text = bib_candidates[0]

    rank_position = int(rank_text) if re.fullmatch(r"\d{1,3}", clean(rank_text)) else None
    status_rank = clean(rank_text).upper() if (rank_text and not rank_position and clean(rank_text).upper() in STATUS_CODES) else None

    bib = normalize_bib(bib_text)
    if not bib:
        return None
    name = clean(name_text)
    if not name_like(name):
        # Tighten: any cell in 0.16-0.26 with Chinese or letters
        candidates = [c.text for c in row if 0.16 <= c.x < 0.26 and name_like(c.text)]
        name = clean(" ".join(candidates)) if candidates else ""
    if not name:
        return None

    nationality = norm_country(nat_text) or None
    team = clean(club_text) or "个人"

    # Score columns. Layout pattern (3 sub-events):
    # ~0.48 sub1_rank | 0.55 sub1_pts | 0.61 sub2_rank | 0.67 sub2_pts | 0.74 sub3_rank | 0.79 sub3_pts | 0.86 total
    score_cells = sorted([c for c in row if c.x > 0.45], key=lambda c: c.x)
    score_texts = [clean(c.text) for c in score_cells if clean(c.text)]
    # Take the trailing 7 numeric-ish tokens: rank1, pts1, rank2, pts2, rank3, pts3, total
    numeric = [t for t in score_texts if re.fullmatch(r"(?:\d+|DNS|DNF|DQ|DSQ|DNQ|OTL|/)(?:\.\d+)?", t, re.I)]
    if len(numeric) < 7:
        # Some rows have OCR drops — accept best effort
        pass

    def take(idx: int) -> str | None:
        if 0 <= idx < len(numeric):
            return numeric[idx]
        return None

    parsed_subevents: dict[str, dict[str, Any]] = {}
    # If we have exactly 7 tokens, indexes are [0,1]=sub1, [2,3]=sub2, [4,5]=sub3, [6]=total
    # If fewer than 7, try alignment by x-pos of score_cells instead
    if len(numeric) == 7 and len(subevents) >= 3:
        for i, ev in enumerate(subevents[:3]):
            rk = take(i * 2)
            pt = take(i * 2 + 1)
            if rk is not None or pt is not None:
                parsed_subevents[ev] = {"rank": rk, "points": pt}
        total_points = take(6)
    elif len(subevents) >= 3 and score_cells:
        # Fall back to x-based bucket assignment
        buckets = {
            subevents[0]: {"rank_x": (0.45, 0.55), "pts_x": (0.55, 0.61)},
            subevents[1]: {"rank_x": (0.61, 0.66), "pts_x": (0.66, 0.72)},
            subevents[2]: {"rank_x": (0.72, 0.79), "pts_x": (0.79, 0.85)},
        }
        for ev, bx in buckets.items():
            rk = nearest_text(row, *bx["rank_x"], allow_join=False)
            pt = nearest_text(row, *bx["pts_x"], allow_join=False)
            if rk or pt:
                parsed_subevents[ev] = {"rank": rk or None, "points": pt or None}
        total_points = nearest_text(row, 0.85, 0.95, allow_join=False)
    else:
        total_points = None

    def points_value(text: str | None) -> float | None:
        if text is None:
            return None
        text = clean(text)
        if not text or text == "/" or text.upper() in STATUS_CODES:
            return None
        try:
            return float(text)
        except ValueError:
            return None

    def rank_label(text: str | None) -> str | None:
        if text is None:
            return None
        text = clean(text)
        if not text or text == "/":
            return None
        return text.upper() if text.upper() in STATUS_CODES else text

    # Map to endurance / sprint / tech
    endurance_ev = next((ev for ev in subevents if ev in ("6km", "3km")), None)
    sprint_ev = next((ev for ev in subevents if ev == "200m"), None)
    tech_ev = next((ev for ev in subevents if ev in ("1km", "600m")), None)

    endurance_rank = rank_label(parsed_subevents.get(endurance_ev, {}).get("rank")) if endurance_ev else None
    endurance_points = points_value(parsed_subevents.get(endurance_ev, {}).get("points")) if endurance_ev else None
    sprint_rank = rank_label(parsed_subevents.get(sprint_ev, {}).get("rank")) if sprint_ev else None
    sprint_points = points_value(parsed_subevents.get(sprint_ev, {}).get("points")) if sprint_ev else None
    tech_rank = rank_label(parsed_subevents.get(tech_ev, {}).get("rank")) if tech_ev else None
    tech_points = points_value(parsed_subevents.get(tech_ev, {}).get("points")) if tech_ev else None
    total_points_val = points_value(total_points)

    source_locator_parts = [f"page:{page_number}"]
    if tech_ev:
        if tech_rank is not None:
            source_locator_parts.append(f"{tech_ev}_rank={tech_rank}")
        if tech_points is not None:
            source_locator_parts.append(f"{tech_ev}_points={tech_points}")
    source_locator = "|".join(source_locator_parts)

    subevent_index_payload = {}
    for ev, val in parsed_subevents.items():
        subevent_index_payload[ev] = {
            "rank": rank_label(val.get("rank")),
            "points": points_value(val.get("points")),
            "discipline": SUBEVENT_TO_DISCIPLINE.get(ev),
        }

    return {
        "group_name": context["gender_group"],
        "rank_position": rank_position,
        "status_rank": status_rank,
        "bib_number": bib,
        "athlete_name_snapshot": name,
        "nationality_snapshot": nationality,
        "team_name": team or "个人",
        "endurance_rank": endurance_rank,
        "endurance_points": endurance_points,
        "endurance_discipline": SUBEVENT_TO_DISCIPLINE.get(endurance_ev) if endurance_ev else None,
        "sprint_rank": sprint_rank,
        "sprint_points": sprint_points,
        "sprint_discipline": SUBEVENT_TO_DISCIPLINE.get(sprint_ev) if sprint_ev else None,
        "tech_rank": tech_rank,
        "tech_points": tech_points,
        "tech_discipline": SUBEVENT_TO_DISCIPLINE.get(tech_ev) if tech_ev else None,
        "total_points": total_points_val,
        "subevents": subevent_index_payload,
        "source_locator": source_locator,
        "source_note": f"2025桨板亚洲杯个人赛积分 / {context['gender_group']}",
        "parse_confidence": 0.85,
    }


def parse_points_page(cells: list[Cell], page_number: int) -> list[dict[str, Any]]:
    if not is_individual_points_page(cells):
        return []
    context = page_context(cells)
    subevents = detect_points_subevents(cells)
    if not subevents:
        return []
    rows = collect_rows(cells)
    out = []
    for row in rows:
        parsed = parse_points_row(row, context, subevents, page_number)
        if parsed:
            out.append(parsed)
    return out


# ---------------------------------------------------------------------------
# Race result pages (1-85) parsing
# ---------------------------------------------------------------------------


def parse_individual_row(
    row: list[Cell],
    context: dict[str, Any],
    page_number: int,
    bib_index: dict[tuple[str, str], dict[str, Any]],
    rank_index: dict[tuple[str, str, int], dict[str, Any]],
    bib_only_index: dict[str, dict[str, Any]],
    status_seq: list[int],
) -> dict[str, Any] | None:
    rank = nearest_text(row, 0.08, 0.17, allow_join=False)
    round_text = nearest_text(row, 0.155, 0.23)
    bib = nearest_text(row, 0.22, 0.31, allow_join=False)
    name = nearest_text(row, 0.29, 0.40)
    nationality = nearest_text(row, 0.39, 0.50, allow_join=False)
    team = nearest_text(row, 0.50, 0.74)
    finish = nearest_text(row, 0.735, 0.835, allow_join=False)
    notes = nearest_text(row, 0.835, 0.93)

    rank_cells = [cell for cell in row if 0.08 <= cell.x < 0.17 and is_rank(cell.text)]
    numeric_rank_cells = [cell for cell in rank_cells if re.fullmatch(r"\d{1,3}", clean(cell.text))]
    if numeric_rank_cells:
        rank = numeric_rank_cells[0].text
    elif rank_cells:
        rank = rank_cells[0].text

    if not finish:
        finish_candidates = [cell for cell in row if is_result_value(cell.text)]
        if finish_candidates:
            finish = max(finish_candidates, key=lambda c: c.x).text
    if not rank:
        rank_candidates = [cell for cell in row if cell.x < 0.22 and is_rank(cell.text)]
        numeric_rank_candidates = [cell for cell in rank_candidates if re.fullmatch(r"\d{1,3}", clean(cell.text))]
        if numeric_rank_candidates:
            rank = numeric_rank_candidates[0].text
        elif rank_candidates:
            rank = rank_candidates[0].text
    bib_candidates = [cell for cell in row if 0.18 <= cell.x < 0.31 and is_bib(cell.text)]
    if bib_candidates:
        bib = bib_candidates[-1].text
    if not name_like(name):
        name_candidates = [cell.text for cell in row if 0.28 <= cell.x < 0.41 and name_like(cell.text)]
        name = clean(" ".join(name_candidates))

    finish = normalize_time(finish)
    if not finish or not is_result_value(finish):
        return None

    code = status_code(finish)
    if not is_rank(rank):
        rank = code or ""

    rank_position = int(rank) if re.fullmatch(r"\d{1,3}", rank) else None

    if round_text and re.search(r"Semi|复赛", round_text, re.I):
        round_label = "复赛"
    elif round_text and re.search(r"Heat|预赛", round_text, re.I):
        round_label = "预赛"
    elif round_text and re.search(r"Final|决赛", round_text, re.I):
        round_label = "决赛"
    else:
        round_label = context["round_label"]

    parse_confidence = 0.9 if not code else 0.82
    review_status = "confirmed"

    name_clean = clean(name).replace(" ", "") if re.search(r"[一-鿿]", name) else clean(name)
    bib_norm = normalize_bib(bib)
    nationality_norm = norm_country(nationality) or None
    team_clean = clean(team) or "个人"

    if not name_like(name) or not name_clean:
        # Try POINTS-based lookups.
        looked_up: dict[str, Any] | None = None
        lookup_source = ""
        if bib_norm:
            looked_up = bib_index.get((context["gender_group"], bib_norm))
            if looked_up:
                lookup_source = "points_bib_group"
            else:
                looked_up = bib_only_index.get(bib_norm)
                if looked_up:
                    lookup_source = "points_bib_global"
        if not looked_up and rank_position is not None:
            looked_up = rank_index.get((context["gender_group"], context["discipline"], rank_position))
            if looked_up:
                lookup_source = "points_rank"
        if looked_up:
            name_clean = looked_up.get("name") or name_clean
            if not bib_norm and looked_up.get("bib"):
                bib_norm = normalize_bib(looked_up["bib"])
            if not nationality_norm and looked_up.get("nationality"):
                nationality_norm = looked_up["nationality"]
            if team_clean == "个人" and looked_up.get("team"):
                team_clean = looked_up["team"]
            parse_confidence = 0.7 if lookup_source != "points_rank" else 0.55
            review_status = "confirmed" if lookup_source != "points_rank" else "needs_review"

    if not name_clean:
        # Sentinel placeholder so the row survives for admin to inspect.
        bib_part = bib_norm or "NA"
        rank_part = rank if rank else "NA"
        name_clean = f"#待识别-p{page_number}-r{rank_part}-b{bib_part}"
        parse_confidence = 0.3
        review_status = "needs_review"

    if rank_position is None and code:
        status_seq[0] += 1
        rank_position = 9000 + status_seq[0]

    return {
        "athlete_name_snapshot": name_clean,
        "bib_number": bib_norm or None,
        "gender_group": context["gender_group"],
        "discipline": context["discipline"],
        "board_class": context.get("board_class"),
        "round_label": round_label,
        "rank_position": rank_position,
        "result_label": notes or None,
        "finish_time": finish,
        "result_status_code": code,
        "result_status_note": STATUS_LABELS.get(code or ""),
        "time_seconds": parse_time_to_seconds(finish),
        "team_name": team_clean,
        "nationality_snapshot": nationality_norm,
        "team_members": [],
        "source_locator": f"page:{page_number}",
        "source_note": context["source_note"],
        "parse_confidence": parse_confidence,
        "review_status": review_status,
    }


def parse_team_row(row: list[Cell], context: dict[str, Any], page_number: int) -> dict[str, Any] | None:
    rank = nearest_text(row, 0.08, 0.17, allow_join=False)
    lane = nearest_text(row, 0.18, 0.25, allow_join=False)
    bib = nearest_text(row, 0.25, 0.34, allow_join=False)
    team = nearest_text(row, 0.36, 0.54)
    names = nearest_text(row, 0.54, 0.755)
    finish = normalize_time(nearest_text(row, 0.755, 0.835, allow_join=False))
    notes = nearest_text(row, 0.835, 0.93)
    if not rank or not finish or not names:
        return None
    if not re.fullmatch(r"\d{1,3}", rank) or not is_result_value(finish):
        return None
    members = split_members(names)
    code = status_code(finish)
    return {
        "athlete_name_snapshot": members[0] if members else clean(team),
        "bib_number": clean(bib) or None,
        "gender_group": context["gender_group"],
        "discipline": context["discipline"],
        "board_class": context.get("board_class") or "龙板",
        "round_label": context["round_label"],
        "rank_position": int(rank),
        "result_label": f"出发位置 {lane}" if lane else (notes or None),
        "finish_time": finish,
        "result_status_code": code,
        "result_status_note": STATUS_LABELS.get(code or ""),
        "time_seconds": parse_time_to_seconds(finish),
        "team_name": clean(team) or "团队",
        "nationality_snapshot": "CHN",
        "team_members": members,
        "source_locator": f"page:{page_number}",
        "source_note": context["source_note"],
        "parse_confidence": 0.9,
        "review_status": "confirmed",
    }


def parse_race_page(
    cells: list[Cell],
    page_number: int,
    bib_index: dict[tuple[str, str], dict[str, Any]],
    rank_index: dict[tuple[str, str, int], dict[str, Any]],
    bib_only_index: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    context = page_context(cells)
    is_team = "龙板" in context["discipline"] or context.get("board_class") == "龙板"
    results = []
    status_seq = [0]
    for row in collect_rows(cells):
        if is_team:
            parsed = parse_team_row(row, context, page_number)
        else:
            parsed = parse_individual_row(row, context, page_number, bib_index, rank_index, bib_only_index, status_seq)
        if parsed:
            results.append(parsed)
    if not is_team:
        fill_individual_ranks(results)
    results = apply_manual_page_rows(page_number, context, results)
    return results


def apply_manual_page_rows(page_number: int, context: dict[str, Any], parsed_results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    manual_rows = MANUAL_RACE_PAGE_ROWS.get(page_number)
    if not manual_rows:
        return parsed_results

    out: list[dict[str, Any]] = []
    status_seq = 0
    for row in manual_rows:
        finish = normalize_time(row["finish_time"])
        code = row.get("result_status_code") or status_code(finish)
        if code and row.get("rank_position") is None:
            status_seq += 1
            rank_position = 9000 + status_seq
        else:
            rank_position = row.get("rank_position")
        result_label = None
        raw_rank = clean(str(row.get("rank", ""))).upper()
        if raw_rank in STATUS_CODES and code:
            result_label = STATUS_LABELS.get(code)
        out.append({
            "athlete_name_snapshot": row["athlete_name_snapshot"],
            "bib_number": normalize_bib(row.get("bib_number") or "") or None,
            "gender_group": context["gender_group"],
            "discipline": context["discipline"],
            "board_class": context.get("board_class"),
            "round_label": context["round_label"],
            "rank_position": rank_position,
            "result_label": result_label,
            "finish_time": finish,
            "result_status_code": code,
            "result_status_note": STATUS_LABELS.get(code or ""),
            "time_seconds": parse_time_to_seconds(finish),
            "team_name": clean(row.get("team_name")) or "个人",
            "nationality_snapshot": row.get("nationality_snapshot") or "CHN",
            "team_members": [],
            "source_locator": f"page:{page_number}",
            "source_note": context["source_note"] + "（人工复核页）",
            "parse_confidence": 1.0,
            "review_status": "confirmed",
        })
    return out


def fill_individual_ranks(results: list[dict[str, Any]]) -> None:
    status_sequence = 0
    for index, item in enumerate(results):
        if item.get("rank_position") is not None:
            continue
        if item.get("result_status_code"):
            status_sequence += 1
            item["rank_position"] = 9000 + status_sequence
            continue
        next_rank = None
        next_index = None
        for probe_index in range(index + 1, len(results)):
            probe_rank = results[probe_index].get("rank_position")
            if isinstance(probe_rank, int) and probe_rank < 9000:
                next_rank = probe_rank
                next_index = probe_index
                break
        previous_rank = None
        for probe_index in range(index - 1, -1, -1):
            probe_rank = results[probe_index].get("rank_position")
            if isinstance(probe_rank, int) and probe_rank < 9000:
                previous_rank = probe_rank
                break
        if next_rank is not None and next_index is not None:
            missing_before_next = sum(1 for item2 in results[index:next_index] if item2.get("rank_position") is None and not item2.get("result_status_code"))
            item["rank_position"] = max(1, next_rank - missing_before_next)
        elif previous_rank is not None:
            item["rank_position"] = previous_rank + 1
        else:
            item["rank_position"] = index + 1

    status_sequence = 0
    for item in results:
        if item.get("result_status_code") and (item.get("rank_position") is None or item.get("rank_position", 0) >= 9000):
            status_sequence += 1
            item["rank_position"] = 9000 + status_sequence


def dedupe_results(results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[tuple[Any, ...]] = set()
    out: list[dict[str, Any]] = []
    for item in results:
        key = (
            item["source_locator"],
            item["gender_group"],
            item["discipline"],
            item["round_label"],
            item["rank_position"],
            item["athlete_name_snapshot"],
            item.get("finish_time"),
        )
        if key in seen:
            continue
        seen.add(key)
        out.append(item)
    return out


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------


def build_points_indices(point_standings: list[dict[str, Any]]) -> tuple[
    dict[tuple[str, str], dict[str, Any]],
    dict[tuple[str, str, int], dict[str, Any]],
    dict[str, dict[str, Any]],
]:
    bib_index: dict[tuple[str, str], dict[str, Any]] = {}
    bib_only_index: dict[str, dict[str, Any]] = {}
    rank_index: dict[tuple[str, str, int], dict[str, Any]] = {}
    for row in point_standings:
        group = row["group_name"]
        bib = normalize_bib(row.get("bib_number") or "")
        entry = {
            "name": row.get("athlete_name_snapshot"),
            "bib": bib,
            "nationality": row.get("nationality_snapshot"),
            "team": row.get("team_name"),
            "group": group,
        }
        if bib:
            bib_index[(group, bib)] = entry
            bib_only_index.setdefault(bib, entry)
        for ev_key, ev_value in (row.get("subevents") or {}).items():
            rank_text = ev_value.get("rank")
            discipline = ev_value.get("discipline") or SUBEVENT_TO_DISCIPLINE.get(ev_key)
            if not discipline or rank_text is None:
                continue
            text = str(rank_text)
            if re.fullmatch(r"\d{1,3}", text):
                rank_index[(group, discipline, int(text))] = entry
    return bib_index, rank_index, bib_only_index


def parse_pdf(pdf_path: Path, cache_dir: Path, scale: float) -> dict[str, Any]:
    swift_script = Path(__file__).with_name("ocr-image-macos-json.swift")
    if not swift_script.exists() or sys.platform != "darwin":
        raise RuntimeError("macOS Vision OCR script is required")
    doc = fitz.open(str(pdf_path))
    if len(doc) < PAGE_LAST:
        raise RuntimeError(f"PDF has only {len(doc)} pages; expected at least {PAGE_LAST}")

    # Pass 1: parse INDIVIDUAL POINTS pages (86-112), build indices.
    point_standings: list[dict[str, Any]] = []
    points_pages: dict[str, int] = {}
    for page_number in range(RESULT_PAGE_LAST + 1, PAGE_LAST + 1):
        cells = load_or_ocr_page(doc, page_number, cache_dir, swift_script, scale)
        page_points = parse_points_page(cells, page_number)
        point_standings.extend(page_points)
        points_pages[f"page:{page_number}"] = len(page_points)

    bib_index, rank_index, bib_only_index = build_points_indices(point_standings)

    # Pass 2: parse race results (1-85), using indices for name recovery.
    results: list[dict[str, Any]] = []
    race_pages: dict[str, int] = {}
    for page_number in range(PAGE_FIRST, RESULT_PAGE_LAST + 1):
        cells = load_or_ocr_page(doc, page_number, cache_dir, swift_script, scale)
        page_results = parse_race_page(cells, page_number, bib_index, rank_index, bib_only_index)
        results.extend(page_results)
        race_pages[f"page:{page_number}"] = len(page_results)

    doc.close()
    results = dedupe_results(results)
    return {
        "event": {
            "event_id": EVENT_ID,
            "name": EVENT_NAME,
            "start_date": EVENT_START_DATE,
            "end_date": EVENT_END_DATE,
            "province": EVENT_PROVINCE,
            "city": EVENT_CITY,
            "venue": EVENT_VENUE,
        },
        "source": {
            "file_name": pdf_path.name,
            "file_type": "pdf",
            "source_url": SOURCE_URL,
            "original_path": str(pdf_path),
            "parser_name": "parse-acc-2025-results.py",
            "parser_note": f"扫描版PDF第{PAGE_FIRST}-{PAGE_LAST}页，macOS Vision OCR(scale={scale})坐标解析；INDIVIDUAL POINTS 用于姓名/号码布回填。",
            "metadata": {
                "page_first": PAGE_FIRST,
                "page_last": PAGE_LAST,
                "result_page_last": RESULT_PAGE_LAST,
                "ocr_scale": scale,
                "race_page_result_counts": race_pages,
                "points_page_row_counts": points_pages,
            },
        },
        "results": results,
        "point_standings": point_standings,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", default=DEFAULT_PDF)
    parser.add_argument("--output", default=".cache/acc-2025-results.json")
    parser.add_argument("--cache-dir", default=".cache/acc-2025-ocr")
    parser.add_argument("--scale", type=float, default=DEFAULT_SCALE)
    args = parser.parse_args()

    payload = parse_pdf(Path(args.pdf), Path(args.cache_dir), args.scale)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    groups: dict[str, int] = {}
    pages: dict[str, int] = {}
    for row in payload["results"]:
        key = f"{row['discipline']} / {row['gender_group']} / {row['round_label']}"
        groups[key] = groups.get(key, 0) + 1
        pages[row["source_locator"]] = pages.get(row["source_locator"], 0) + 1
    point_groups: dict[str, int] = {}
    for row in payload["point_standings"]:
        point_groups[row["group_name"]] = point_groups.get(row["group_name"], 0) + 1
    print(json.dumps({
        "race_rows": len(payload["results"]),
        "race_groups": groups,
        "race_pages": pages,
        "point_rows": len(payload["point_standings"]),
        "point_groups": point_groups,
        "output": str(output),
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
