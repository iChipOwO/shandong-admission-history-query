import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import xlrd


ADMISSION_DATA_PATH = Path("data/processed/admissions_shandong_2023_2025.json")
MOE_REGULAR_COLLEGE_LIST_PATH = Path("data/raw/moe_regular_college_list_2025.xls")
DOUBLE_FIRST_CLASS_TEXT_PATH = Path("data/raw/double_first_class_2022_list.txt")
TAG_REFERENCE_PATH = Path("scripts/reference/school_tag_reference.json")
METADATA_JSON_PATH = Path("data/processed/school_metadata.json")
MISSING_JSON_PATH = Path("data/processed/school_metadata_missing.json")
REPORT_JSON_PATH = Path("data/processed/school_metadata_report.json")
TS_OUTPUT_PATH = Path("src/data/schoolMetadata.ts")

MOE_SOURCE_NAME = "教育部全国普通高等学校名单（截至2025年6月20日）"
MOE_SOURCE_URL = "http://www.moe.gov.cn/jyb_xxgk/s5743/s5744/202506/t20250627_1195683.html"
DOUBLE_FIRST_CLASS_SOURCE_NAME = "教育部 财政部 国家发展改革委第二轮“双一流”建设高校及建设学科名单"
DOUBLE_FIRST_CLASS_SOURCE_URL = "https://www.gov.cn/zhengce/zhengceku/2022-02/14/content_5673496.htm"

STANDARD_TAGS = [
    "985",
    "211",
    "双一流",
    "公办",
    "民办",
    "本科",
    "专科",
    "高职专科",
    "本科层次职业大学",
    "军校",
    "港澳高校",
    "中外合作办学",
    "独立学院",
    "中外合作办学机构",
    "特殊办学单位",
]

PROVINCE_NORMALIZATION = {
    "北京市": "北京",
    "天津市": "天津",
    "上海市": "上海",
    "重庆市": "重庆",
    "内蒙古自治区": "内蒙古",
    "广西壮族自治区": "广西",
    "西藏自治区": "西藏",
    "宁夏回族自治区": "宁夏",
    "新疆维吾尔自治区": "新疆",
    "香港特别行政区": "香港",
    "澳门特别行政区": "澳门",
}

CITY_TO_PROVINCE = {
    "北京": "北京",
    "上海": "上海",
    "长沙": "湖南",
    "南京": "江苏",
    "西安": "陕西",
    "香港": "香港",
    "苏州": "江苏",
    "威海": "山东",
    "珠海": "广东",
    "宣城": "安徽",
    "深圳": "广东",
    "盘锦": "辽宁",
    "成都": "四川",
    "重庆": "重庆",
    "保定": "河北",
    "克拉玛依": "新疆",
    "秦皇岛": "河北",
    "杭州": "浙江",
    "包头": "内蒙古",
}

CAMPUS_OVERRIDES = {
    "中国人民大学(苏州校区)": ("苏州", "中国人民大学苏州校区官网", "https://sc.ruc.edu.cn/"),
    "北京交通大学(威海校区)": ("威海", "北京交通大学威海校区官网", "https://wh.bjtu.edu.cn/"),
    "北京师范大学(珠海校区)": ("珠海", "北京师范大学珠海校区官网", "https://www.bnuzh.edu.cn/xqjj/"),
    "北京邮电大学(宏福校区)": ("北京", "北京邮电大学官网", "https://www.bupt.edu.cn/"),
    "合肥工业大学(宣城校区)": ("宣城", "合肥工业大学宣城校区官网", "https://xc.hfut.edu.cn/"),
    "哈尔滨工业大学(威海)": ("威海", "哈尔滨工业大学（威海）官网", "https://www.hitwh.edu.cn/"),
    "哈尔滨工业大学(深圳)": ("深圳", "哈尔滨工业大学（深圳）官网", "https://www.hitsz.edu.cn/main.htm"),
    "大连理工大学(盘锦校区)": ("盘锦", "大连理工大学盘锦校区官网", "https://panjin.dlut.edu.cn/"),
    "电子科技大学(沙河校区)": ("成都", "电子科技大学官网", "https://www.uestc.edu.cn/index.html"),
    "西南大学(荣昌校区)": ("重庆", "西南大学官网", "https://www.swu.edu.cn/index.htm"),
    "山东大学(威海)": ("威海", "山东大学（威海）官网", "https://www.wh.sdu.edu.cn/"),
    "山东大学威海分校": ("威海", "山东大学（威海）官网", "https://www.wh.sdu.edu.cn/"),
    "华北电力大学(北京)": ("北京", "华北电力大学官网", "https://www.ncepu.edu.cn/"),
    "华北电力大学(保定)": ("保定", "华北电力大学官网", "https://net.ncepu.edu.cn/"),
    "中国石油大学(北京)克拉玛依校区": ("克拉玛依", "中国石油大学（北京）克拉玛依校区官网", "https://www.cupk.edu.cn/"),
    "东北大学秦皇岛分校": ("秦皇岛", "东北大学秦皇岛分校官网", "https://www.neuq.edu.cn/"),
    "北京大学医学部": ("北京", "北京大学医学部官网", "https://www.bjmu.edu.cn/"),
    "复旦大学医学院": ("上海", "复旦大学上海医学院官网", "https://shmc.fudan.edu.cn/"),
    "上海交通大学医学院": ("上海", "上海交通大学医学院官网", "https://www.shsmu.edu.cn/"),
    "浙江大学医学院": ("杭州", "浙江大学医学院官网", "https://www.cmm.zju.edu.cn/"),
    "内蒙古科技大学包头师范学院": ("包头", "内蒙古科技大学包头师范学院2025年本科招生章程", "https://www.bttc.edu.cn/info/1011/18979.htm"),
    "内蒙古科技大学包头医学院": ("包头", "内蒙古科技大学包头医学院2025年普通本科招生章程", "https://www.btmc.edu.cn/zsxxw/info/1263/2511.htm"),
}

RENAMED_SCHOOL_ALIASES = {
    "滨州学院": "山东航空学院",
    "吉林化工学院": "吉林化工大学",
    "潍坊医学院": "山东第二医科大学",
    "四川外国语大学成都学院": "成都外国语学院",
    "南昌工程学院": "江西水利电力大学",
    "海南医学院": "海南医科大学",
    "西藏农牧学院": "西藏农牧大学",
    "重庆科技学院": "重庆科技大学",
    "嘉兴学院": "嘉兴大学",
    "宁夏师范学院": "宁夏师范大学",
    "常熟理工学院": "苏州工学院",
    "桂林医学院": "桂林医科大学",
    "天水师范学院": "天水师范大学",
    "浙江科技学院": "浙江科技大学",
    "云南大学滇池学院": "滇池学院",
    "合肥学院": "合肥大学",
    "牡丹江医学院": "牡丹江医科大学",
    "新乡医学院": "河南医药大学",
    "赣南医学院": "赣南医科大学",
    "佛山科学技术学院": "佛山大学",
    "蚌埠医学院": "蚌埠医科大学",
    "湖南理工学院南湖学院": "岳阳学院",
    "新乡医学院三全学院": "豫北医学院",
    "云南艺术学院文华学院": "昆明传媒学院",
}

SPECIAL_SCHOOLS = {
    "国防科技大学": {
        "province": "湖南",
        "city": "长沙",
        "educationLevel": "本科",
        "department": "中央军委",
        "schoolTypeTags": ["军校", "公办", "本科"],
        "sourceName": "国防科技大学本科招生网",
        "sourceUrl": "https://www.nudt.edu.cn/",
        "tagSources": {"军校": "国防科技大学本科招生网"},
    },
    "陆军工程大学": {
        "province": "江苏",
        "city": "南京",
        "educationLevel": "本科",
        "department": "陆军",
        "schoolTypeTags": ["军校", "公办", "本科"],
        "sourceName": "陆军工程大学招生信息",
        "sourceUrl": "https://www.81.cn/",
        "tagSources": {"军校": "陆军工程大学招生信息"},
    },
    "海军军医大学": {
        "province": "上海",
        "city": "上海",
        "educationLevel": "本科",
        "department": "海军",
        "schoolTypeTags": ["军校", "公办", "本科"],
        "sourceName": "海军军医大学官网",
        "sourceUrl": "https://www.smmu.edu.cn/",
        "tagSources": {"军校": "海军军医大学官网"},
    },
    "空军军医大学": {
        "province": "陕西",
        "city": "西安",
        "educationLevel": "本科",
        "department": "空军",
        "schoolTypeTags": ["军校", "公办", "本科"],
        "sourceName": "空军军医大学官网",
        "sourceUrl": "https://www.fmmu.edu.cn/",
        "tagSources": {"军校": "空军军医大学官网"},
    },
    "香港珠海学院": {
        "province": "香港",
        "city": "香港",
        "educationLevel": "本科",
        "department": "",
        "schoolTypeTags": ["港澳高校", "本科"],
        "sourceName": "香港珠海学院官网",
        "sourceUrl": "https://www.chuhai.edu.hk/",
        "tagSources": {"港澳高校": "香港珠海学院官网"},
    },
}


def normalize_text(value):
    text = str(value or "").strip()
    text = text.replace("（", "(").replace("）", ")")
    text = re.sub(r"\s+", "", text)
    return text


def normalize_province(value):
    value = str(value or "").strip()
    value = re.sub(r"（.*?）", "", value)
    if value in PROVINCE_NORMALIZATION:
        return PROVINCE_NORMALIZATION[value]
    if value.endswith("省"):
        return value[:-1]
    return value


def normalize_city(value):
    value = str(value or "").strip()
    if value in PROVINCE_NORMALIZATION:
        return PROVINCE_NORMALIZATION[value]
    if value.endswith("市"):
        return value[:-1]
    return value


def cell_to_text(value):
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value or "").strip()


def campus_base_name(name):
    normalized = normalize_text(name)
    explicit = {
        "山东大学威海分校": "山东大学",
        "中国石油大学(北京)克拉玛依校区": "中国石油大学(北京)",
        "东北大学秦皇岛分校": "东北大学",
        "北京大学医学部": "北京大学",
        "复旦大学医学院": "复旦大学",
        "上海交通大学医学院": "上海交通大学",
        "浙江大学医学院": "浙江大学",
        "内蒙古科技大学包头师范学院": "内蒙古科技大学",
        "内蒙古科技大学包头医学院": "内蒙古科技大学",
        "华北电力大学(北京)": "华北电力大学",
        "华北电力大学(保定)": "华北电力大学",
    }
    if normalized in explicit:
        return explicit[normalized]
    if normalized in CAMPUS_OVERRIDES:
        return re.sub(r"\([^)]*校区\)|\([^)]*\)", "", normalized)
    return normalized


def load_admission_schools():
    with ADMISSION_DATA_PATH.open("r", encoding="utf-8") as f:
        records = json.load(f)

    school_map = {}
    for record in records:
        code = record.get("schoolCode")
        name = record.get("schoolName")
        if not code or not name:
            continue
        if code not in school_map:
            school_map[code] = {
                "schoolCode": code,
                "schoolName": name,
                "recordCount": 0,
            }
        school_map[code]["recordCount"] += 1

    return sorted(school_map.values(), key=lambda item: (-item["recordCount"], item["schoolCode"]))


def load_moe_regular_colleges():
    book = xlrd.open_workbook(str(MOE_REGULAR_COLLEGE_LIST_PATH))
    sheet = book.sheet_by_index(0)
    colleges = {}
    current_province = ""

    for row_idx in range(sheet.nrows):
        row = [cell_to_text(sheet.cell_value(row_idx, col)) for col in range(sheet.ncols)]
        first = row[0]
        if first.endswith("所）") and "（" in first:
            current_province = normalize_province(first)
            continue
        if not first.isdigit() or len(row) < 6:
            continue

        school_name = row[1].strip()
        if not school_name:
            continue

        level = row[5].strip()
        remark = row[6].strip() if len(row) > 6 else ""
        item = {
            "schoolName": school_name,
            "standardName": normalize_text(school_name),
            "nationalSchoolId": row[2].strip(),
            "province": current_province,
            "city": normalize_city(row[4]),
            "educationLevel": "本科层次职业大学"
            if level == "本科" and ("职业大学" in school_name or "职业技术大学" in school_name)
            else level,
            "department": row[3].strip(),
            "remark": remark,
            "sourceName": MOE_SOURCE_NAME,
            "sourceUrl": MOE_SOURCE_URL,
        }
        colleges[item["standardName"]] = item

    return colleges


def load_tag_reference():
    with TAG_REFERENCE_PATH.open("r", encoding="utf-8") as f:
        reference = json.load(f)
    reference["project985"] = {normalize_text(name) for name in reference["project985"]}
    reference["project211"] = {normalize_text(name) for name in reference["project211"]}
    return reference


def load_double_first_class_names():
    if not DOUBLE_FIRST_CLASS_TEXT_PATH.exists():
        return set()
    text = DOUBLE_FIRST_CLASS_TEXT_PATH.read_text(encoding="utf-8")
    names = set()
    for line in text.splitlines():
        line = line.strip()
        if "：" not in line:
            continue
        name = line.split("：", 1)[0].strip()
        if name and not name.startswith("附件"):
            names.add(normalize_text(name))
    return names


def add_tag(tags, tag_sources, tag, source):
    if tag not in tags:
        tags.append(tag)
    tag_sources.setdefault(tag, source)


def apply_level_and_ownership_tags(item, match, tags, tag_sources):
    if item.get("educationLevel") == "本科层次职业大学":
        add_tag(tags, tag_sources, "本科", MOE_SOURCE_NAME)
        add_tag(tags, tag_sources, "本科层次职业大学", MOE_SOURCE_NAME)
    elif item.get("educationLevel") == "本科":
        add_tag(tags, tag_sources, "本科", MOE_SOURCE_NAME)
    elif item.get("educationLevel") == "专科":
        add_tag(tags, tag_sources, "专科", MOE_SOURCE_NAME)
        add_tag(tags, tag_sources, "高职专科", MOE_SOURCE_NAME)

    remark = match.get("remark", "") if match else ""
    if "民办" in remark:
        add_tag(tags, tag_sources, "民办", MOE_SOURCE_NAME)
    elif match and match.get("department") and "中外合作" not in remark and "内地与港澳合作" not in remark:
        add_tag(tags, tag_sources, "公办", MOE_SOURCE_NAME)

    if "独立学院" in item["schoolName"] or item["schoolName"].endswith("学院") and "大学" in item["schoolName"]:
        if "独立学院" in remark or item["schoolName"] in {"湖南理工学院南湖学院"}:
            add_tag(tags, tag_sources, "独立学院", MOE_SOURCE_NAME)

    if "中外合作" in remark:
        add_tag(tags, tag_sources, "中外合作办学", MOE_SOURCE_NAME)
        add_tag(tags, tag_sources, "中外合作办学机构", MOE_SOURCE_NAME)

    if "内地与港澳合作" in remark:
        add_tag(tags, tag_sources, "中外合作办学", MOE_SOURCE_NAME)
        add_tag(tags, tag_sources, "特殊办学单位", MOE_SOURCE_NAME)


def apply_high_level_tags(item, tag_key, reference, double_first_class_names, tags, tag_sources, notes):
    sources = reference["sources"]
    inherited = normalize_text(item["schoolName"]) != tag_key

    if tag_key in reference["project985"]:
        add_tag(tags, tag_sources, "985", sources["project985"]["sourceName"])
        if inherited:
            notes.add("校区或医学部沿用本部985标签")
    if tag_key in reference["project211"]:
        add_tag(tags, tag_sources, "211", sources["project211"]["sourceName"])
        if inherited:
            notes.add("校区或医学部沿用本部211标签")
    if tag_key in double_first_class_names:
        add_tag(tags, tag_sources, "双一流", sources["doubleFirstClass"]["sourceName"])
        if inherited:
            notes.add("校区或医学部沿用本部双一流标签")


def build_metadata():
    generated_at = datetime.now(timezone.utc).isoformat()
    admission_schools = load_admission_schools()
    moe_colleges = load_moe_regular_colleges()
    reference = load_tag_reference()
    double_first_class_names = load_double_first_class_names()
    metadata = []
    missing = []
    newly_confirmed = []
    warnings = []

    for school in admission_schools:
        raw_name = school["schoolName"]
        normalized_name = normalize_text(raw_name)
        match = moe_colleges.get(normalized_name)
        renamed_to = RENAMED_SCHOOL_ALIASES.get(normalized_name)
        campus_override = CAMPUS_OVERRIDES.get(normalized_name)
        special = SPECIAL_SCHOOLS.get(normalized_name)

        tag_key = normalized_name
        if match is None and renamed_to:
            tag_key = normalize_text(renamed_to)
            match = moe_colleges.get(tag_key)
        if match is None and campus_override:
            tag_key = normalize_text(campus_base_name(normalized_name))
            match = moe_colleges.get(tag_key)
        elif campus_override:
            tag_key = normalize_text(campus_base_name(normalized_name))
        if special:
            tag_key = normalized_name

        tags = []
        tag_sources = {}
        notes = set()

        if special:
            item = {
                "schoolCode": school["schoolCode"],
                "schoolName": raw_name,
                "province": special["province"],
                "city": special["city"],
                "cityConfirmed": True,
                "educationLevel": special["educationLevel"],
                "department": special["department"],
                "schoolTypeTags": [],
                "sourceName": special["sourceName"],
                "sourceUrl": special["sourceUrl"],
                "tagSources": dict(special.get("tagSources", {})),
                "confidence": "confirmed",
                "updatedAt": generated_at,
            }
            for tag in special["schoolTypeTags"]:
                add_tag(tags, item["tagSources"], tag, item["tagSources"].get(tag, item["sourceName"]))
            if raw_name in {"海军军医大学", "空军军医大学"}:
                tag_key = normalize_text(raw_name)
        elif match:
            province = match["province"]
            city = match["city"]
            source_name = match["sourceName"]
            source_url = match["sourceUrl"]

            if campus_override:
                city, campus_source_name, campus_source_url = campus_override
                province = CITY_TO_PROVINCE.get(city, province)
                source_name = f"{MOE_SOURCE_NAME}；{campus_source_name}"
                source_url = campus_source_url
            elif renamed_to:
                source_name = f"{MOE_SOURCE_NAME}；旧校名按教育部2025年名单匹配为{renamed_to}"

            item = {
                "schoolCode": school["schoolCode"],
                "schoolName": raw_name,
                "province": province,
                "city": city,
                "cityConfirmed": bool(province and city),
                "educationLevel": match["educationLevel"],
                "department": match["department"],
                "schoolTypeTags": [],
                "sourceName": source_name,
                "sourceUrl": source_url,
                "tagSources": {},
                "confidence": "confirmed" if province and city else "unknown",
                "updatedAt": generated_at,
            }
            apply_level_and_ownership_tags(item, match, tags, tag_sources)
        else:
            item = {
                "schoolCode": school["schoolCode"],
                "schoolName": raw_name,
                "province": "",
                "city": "",
                "cityConfirmed": False,
                "educationLevel": "",
                "department": "",
                "schoolTypeTags": [],
                "sourceName": "",
                "sourceUrl": "",
                "tagSources": {},
                "confidence": "unknown",
                "updatedAt": generated_at,
            }

        apply_high_level_tags(item, tag_key, reference, double_first_class_names, tags, tag_sources, notes)

        item["schoolTypeTags"] = [tag for tag in STANDARD_TAGS if tag in set(tags)]
        item["tagSources"].update({tag: tag_sources[tag] for tag in item["schoolTypeTags"] if tag in tag_sources})
        if notes:
            item["note"] = "；".join(sorted(notes))

        metadata.append(item)

        if item["cityConfirmed"] and special:
            newly_confirmed.append(
                {
                    "schoolCode": item["schoolCode"],
                    "schoolName": item["schoolName"],
                    "province": item["province"],
                    "city": item["city"],
                    "sourceName": item["sourceName"],
                    "sourceUrl": item["sourceUrl"],
                }
            )

        if not item["cityConfirmed"]:
            missing.append(
                {
                    "schoolCode": item["schoolCode"],
                    "schoolName": item["schoolName"],
                    "missingFields": [
                        field
                        for field in ("province", "city", "cityConfirmed")
                        if field == "cityConfirmed" or not item.get(field)
                    ],
                    "reason": "未从本轮可靠来源确认学校所在地城市",
                }
            )

    tag_counts = Counter(tag for item in metadata for tag in item["schoolTypeTags"])
    report = {
        "generatedAt": generated_at,
        "totalSchools": len(metadata),
        "totalSchoolsFromAdmissionData": len(admission_schools),
        "confirmedCityCount": sum(1 for item in metadata if item["cityConfirmed"]),
        "unknownCityCount": sum(1 for item in metadata if not item["cityConfirmed"]),
        "cityConfirmedRate": round(sum(1 for item in metadata if item["cityConfirmed"]) / len(metadata), 4),
        "tagCounts": {tag: tag_counts.get(tag, 0) for tag in STANDARD_TAGS},
        "newlyConfirmedCities": newly_confirmed,
        "stillMissingCities": missing,
        "sampleTaggedSchools": [item for item in metadata if item["schoolTypeTags"][:3]][:12],
        "warnings": warnings,
        "dataSources": {
            "moeRegularCollegeList": {
                "sourceName": MOE_SOURCE_NAME,
                "sourceUrl": MOE_SOURCE_URL,
                "localPath": str(MOE_REGULAR_COLLEGE_LIST_PATH).replace("\\", "/"),
            },
            "doubleFirstClass": {
                "sourceName": DOUBLE_FIRST_CLASS_SOURCE_NAME,
                "sourceUrl": DOUBLE_FIRST_CLASS_SOURCE_URL,
                "localPagePath": "data/raw/double_first_class_2022_gov_page.html",
                "localPdfPath": "data/raw/double_first_class_2022_list.pdf",
                "localTextPath": str(DOUBLE_FIRST_CLASS_TEXT_PATH).replace("\\", "/"),
            },
            "tagReference": str(TAG_REFERENCE_PATH).replace("\\", "/"),
        },
    }

    return metadata, missing, report


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def write_typescript(metadata):
    content = """// This file is generated by scripts/build_school_metadata.py.
// Do not edit manually; update data sources and rerun the script instead.

export interface SchoolMetadata {
  schoolCode?: string;
  schoolName: string;
  province?: string;
  city?: string;
  cityConfirmed?: boolean;
  educationLevel?: string;
  department?: string;
  schoolTypeTags?: string[];
  sourceName?: string;
  sourceUrl?: string;
  tagSources?: Record<string, string>;
  confidence?: 'confirmed' | 'unknown';
  updatedAt?: string;
  note?: string;
}

export const schoolMetadataList: SchoolMetadata[] = __DATA__;
"""
    data = json.dumps(metadata, ensure_ascii=False, indent=2)
    TS_OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    TS_OUTPUT_PATH.write_text(content.replace("__DATA__", data), encoding="utf-8", newline="\n")


def main():
    metadata, missing, report = build_metadata()
    write_json(METADATA_JSON_PATH, metadata)
    write_json(MISSING_JSON_PATH, missing)
    write_json(REPORT_JSON_PATH, report)
    write_typescript(metadata)

    print(f"Read {report['totalSchools']} unique schools from admission data.")
    print(f"Confirmed city for {report['confirmedCityCount']} schools.")
    print(f"Missing city for {report['unknownCityCount']} schools.")
    print(f"Wrote {METADATA_JSON_PATH}, {MISSING_JSON_PATH}, {REPORT_JSON_PATH}, and {TS_OUTPUT_PATH}.")


if __name__ == "__main__":
    main()
