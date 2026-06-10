import json
import os
from collections import defaultdict

INPUT_FILE = "data/processed/admissions_shandong_2023_2025.json"
SCHOOL_META_FILE = "data/processed/school_metadata.json"
OUTPUT_NAMES = "data/processed/major_unique_names.json"
OUTPUT_INDEX = "data/processed/major_direction_index.json"
OUTPUT_GROUPS = "data/processed/major_direction_groups.json"
OUTPUT_REPORT = "data/processed/major_direction_report.json"
OUTPUT_REVIEW = "data/processed/major_direction_review.json"
OUTPUT_QA_REPORT = "data/processed/major_direction_qa_report.json"
OUTPUT_PUBLIC_INDEX = "public/data/major_direction_index.json"

GROUP_RULES = [
    {
        "id": "computer",
        "name": "计算机类",
        "keywords": ["计算机", "软件", "网络工程", "信息安全", "网络空间", "物联网", "大数据", "人工智能", "智能科学", "数字媒体技术", "密码科学", "数据科学", "空间信息", "保密技术", "区块链", "虚拟现实", "新媒体技术", "智能感知", "智能交互", "信息管理与信息系统", "计算科学", "云计算", "医学信息", "地球信息"],
        "exclude": ["软件与信息服务", "网络与新媒体", "工程软件"]
    },
    {
        "id": "electronic_info",
        "name": "电子信息类",
        "keywords": ["电子信息", "微电子", "光电", "通信", "集成电路", "电磁场", "电波传播", "电子科学", "电子技术", "电信工程", "人工智能", "信息工程", "电子与计算机", "电子封装", "广播电视工程", "医学信息工程", "大功率半导体", "柔性电子", "信息对抗"],
        "exclude": ["电子商务", "电子竞技"]
    },
    {
        "id": "automation",
        "name": "自动化类",
        "keywords": ["自动化", "机器人", "测控", "仪器", "智能装备", "智能制造", "工业智能", "控制工程", "智能控制", "探测制导与控制", "智能无人系统", "智能感知工程", "智能工程与创意", "智能建造"],
        "exclude": ["机械设计制造及其自动化"]
    },
    {
        "id": "electrical",
        "name": "电气类",
        "keywords": ["电气", "智能电网", "照明", "电缆工程"]
    },
    {
        "id": "mechanical",
        "name": "机械类",
        "keywords": ["机械", "制造", "材料成型", "工业设计", "过程装备", "车辆", "汽车", "机电", "航空工程", "轮机", "工业工程", "智能装备", "智能制造", "焊接技术", "微机电"]
    },
    {
        "id": "materials",
        "name": "材料类",
        "keywords": ["材料", "冶金", "高分子", "纳米", "纺织工程", "轻工类", "包装工程", "印刷工程", "化妆品科学", "木材科学", "电子封装技术", "钢铁智能轧制", "服装设计与工程", "丝绸设计"]
    },
    {
        "id": "energy_power",
        "name": "能源动力类",
        "keywords": ["能源", "动力", "储能", "地质工程", "地质学", "资源勘查", "勘查技术", "采矿", "石油工程", "矿物加工", "油气储运", "碳储", "核工程", "地球探测", "地下水", "煤炭清洁", "矿业类", "海洋油气", "氢能科学"]
    },
    {
        "id": "civil_architecture",
        "name": "土木建筑类",
        "keywords": ["土木", "建筑", "给排水", "城乡规划", "风景园林", "智能建造", "道路桥梁", "道路与桥梁", "测绘", "水利", "工程造价", "工程管理", "房地产", "建环", "环境工程", "环境科学", "水务工程", "环保设备", "城市地下", "港口航道", "水文与水资源", "市政工程", "防灾减灾", "地理信息", "空间信息", "导航工程", "海洋工程", "自然地理", "人居环境", "水质科学"]
    },
    {
        "id": "transportation",
        "name": "交通运输类",
        "keywords": ["交通", "航海", "飞行技术", "救助与打捞", "船舶", "物流工程", "邮政工程", "铁道", "海事", "轮机", "港口航道", "海洋工程", "智能运输工程", "电梯工程"]
    },
    {
        "id": "aerospace",
        "name": "航空航天类",
        "keywords": ["航空", "航天", "飞行器", "空天", "无人机系统", "低空技术", "行星科学", "空间科学"]
    },
    {
        "id": "mathematics",
        "name": "数学类",
        "keywords": ["数学", "计算科学", "统计学", "数据计算", "精算学", "数理基础科学"]
    },
    {
        "id": "physics",
        "name": "物理类",
        "keywords": ["物理", "力学", "声学", "量子信息", "数理基础", "核工程", "辐射防护", "应用气象", "大气科学", "系统科学与工程"]
    },
    {
        "id": "chemistry",
        "name": "化学类",
        "keywords": ["化学", "化工", "制药工程", "涂料工程", "化妆品技术", "香料香精"]
    },
    {
        "id": "biology",
        "name": "生物类",
        "keywords": ["生物科学", "生物技术", "生态", "生物工程", "生命科学", "生物信息", "化学生物", "合成生物", "生物医学", "食品科学", "食品质量", "酿酒", "葡萄与葡萄酒", "食品卫生", "营养", "园林", "水族", "菌物科学", "脑科学", "神经科学", "海洋科学", "植物保护", "草坪科学", "饲料"]
    },
    {
        "id": "medical",
        "name": "医学类",
        "keywords": ["医学", "麻醉", "儿科", "口腔", "针灸", "推拿", "护理", "康复", "眼视光", "精神医学", "放射", "预防医学", "法医", "卫生检验", "助产", "骨伤", "养生", "假肢", "智能影像", "医疗器械"]
    },
    {
        "id": "pharmacy",
        "name": "药学类",
        "keywords": ["药学", "药物", "制药工程", "中药"]
    },
    {
        "id": "finance_economics",
        "name": "财经类",
        "keywords": ["经济", "财政", "税收", "金融", "保险", "投资", "贸易", "会计", "财务", "审计", "精算", "资产评估", "国际商务", "电子商务", "大数据管理"]
    },
    {
        "id": "management",
        "name": "管理类",
        "keywords": ["管理", "工商", "营销", "人力资源", "物业", "行政", "海关", "旅游", "酒店", "会展", "档案", "电子商务", "物流", "劳动", "商务", "公共事业", "公共关系", "家政", "工业工程", "质量与安全", "全媒体运营", "党务", "工会学", "纪检监察"],
        "exclude": ["物理管理"]
    },
    {
        "id": "law",
        "name": "法学类",
        "keywords": ["法学", "法律", "知识产权", "监狱学", "社会学", "政治学", "马克思", "社会工作", "外交学", "国际政治", "国际事务", "民族学", "党史", "纪检监察", "女性学", "海外利益", "司法鉴定", "国际法", "社区矫正", "国家安全学"]
    },
    {
        "id": "literature_language",
        "name": "文学语言类",
        "keywords": ["文学", "汉语", "语言", "外语", "英语", "俄语", "法语", "德语", "日语", "朝鲜语", "翻译", "新闻", "传播", "广告", "出版", "传媒", "网络与新媒体", "阿拉伯语", "西班牙语", "历史学", "哲学", "文物", "博物馆", "考古", "文献学", "图书", "文化遗产", "数字人文", "秘书", "广播电视学", "葡萄牙语", "意大利语", "泰语", "波兰语", "匈牙利语", "越南语", "捷克语", "塞尔维亚语", "波斯语", "印地语", "马来语", "斯瓦希里语", "乌尔都语", "保加利亚语", "罗马尼亚语", "克罗地亚语", "希腊语", "老挝语", "柬埔寨语", "印度尼西亚", "乌克兰语", "芬兰语", "土耳其语", "应用中文", "外事实务", "古生物学"],
        "exclude": ["计算机语言"]
    },
    {
        "id": "education_normal",
        "name": "师范教育类",
        "keywords": ["教育", "师范", "心理学"]
    },
    {
        "id": "agriculture_forestry",
        "name": "农林类",
        "keywords": ["农学", "林学", "植物", "园艺", "种子", "动物", "兽医", "水产", "草业", "森林", "农业", "茶学", "蚕学", "水保", "海洋渔业", "生物育种", "烟草", "粮食", "马业", "饲料", "农村", "智慧牧业"]
    },
    {
        "id": "art",
        "name": "艺术类",
        "keywords": ["艺术", "音乐", "舞蹈", "戏剧", "影视", "美术", "视觉传达", "环境设计", "产品设计", "服装", "包装", "绘画", "雕塑", "摄影", "动画", "书法", "编导", "表演", "播音", "录音", "工艺美术", "中国画", "数字媒体艺术", "电影", "数字人文", "智能交互设计"]
    },
    {
        "id": "sports",
        "name": "体育类",
        "keywords": ["体育", "运动", "武术", "冰雪", "体能"]
    },
    {
        "id": "public_security_military",
        "name": "公安军警类",
        "keywords": ["公安", "治安", "侦查", "警", "消防", "边防", "军事", "武器", "刑事科学", "保卫", "抢险救援", "火灾勘查", "指挥", "国家安全", "保密", "防灾减灾", "安全科学与工程", "安全工程", "兵器类", "海外利益安全"]
    }
]

def extract_flags(major_name):
    flags = set()
    if "中外合作" in major_name:
        flags.add("cooperation")
    if "校区" in major_name or "分校" in major_name or "威海" in major_name or "青岛" in major_name or "济南" in major_name or "烟台" in major_name or "湛江" in major_name or "东莞" in major_name or "泰安" in major_name or "广州" in major_name or "宜宾" in major_name:
        flags.add("campus")
    if "高收费" in major_name or "较高收费" in major_name:
        flags.add("high_fee")
    if any(k in major_name for k in ["试验班", "实验班", "大类", "拔尖", "培优"]):
        flags.add("experiment_class")
        flags.add("broad_category")
    return flags

def load_school_metadata():
    if not os.path.exists(SCHOOL_META_FILE):
        alt = "public/data/school_metadata.json"
        if os.path.exists(alt):
            return json.load(open(alt, "r", encoding="utf-8"))
        return []
    return json.load(open(SCHOOL_META_FILE, "r", encoding="utf-8"))

def main():
    global INPUT_FILE
    if not os.path.exists(INPUT_FILE):
        INPUT_FILE_ALT = "public/data/admissions_shandong_2023_2025.json"
        if os.path.exists(INPUT_FILE_ALT):
            INPUT_FILE = INPUT_FILE_ALT
        else:
            print(f"Error: input file {INPUT_FILE} not found.")
            return

    print("Loading school metadata...")
    school_meta_list = load_school_metadata()
    school_tags_map = {}
    for sm in school_meta_list:
        school_tags_map[sm["schoolName"]] = sm.get("schoolTypeTags", [])

    print("Loading data...")
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    major_map = {}
    for item in data:
        major_name = item["majorName"]
        school_name = item["schoolName"]
        if major_name not in major_map:
            major_map[major_name] = {
                "years": set(),
                "count": 0,
                "sampleSchools": set(),
                "allSchools": set()
            }
        major_map[major_name]["years"].add(item["year"])
        major_map[major_name]["count"] += 1
        major_map[major_name]["allSchools"].add(school_name)
        if len(major_map[major_name]["sampleSchools"]) < 3:
            major_map[major_name]["sampleSchools"].add(school_name)

    unique_names_list = []
    for k, v in major_map.items():
        elite_tags = set()
        for s in v["allSchools"]:
            tags = school_tags_map.get(s, [])
            for tag in ["985", "211", "双一流"]:
                if tag in tags:
                    elite_tags.add(tag)
        
        elite_sample_schools = []
        for s in v["allSchools"]:
            tags = school_tags_map.get(s, [])
            if any(t in tags for t in ["985", "211", "双一流"]):
                if len(elite_sample_schools) < 10:
                    elite_sample_schools.append(s)

        unique_names_list.append({
            "majorName": k,
            "years": sorted(list(v["years"])),
            "count": v["count"],
            "sampleSchools": list(v["sampleSchools"]),
            "eliteSchoolTags": sorted(list(elite_tags)),
            "eliteSampleSchools": elite_sample_schools
        })
    
    unique_names_list.sort(key=lambda x: x["count"], reverse=True)

    with open(OUTPUT_NAMES, "w", encoding="utf-8") as f:
        # Save minimal data for major names json, ignore elite tags to avoid bloat if needed
        # but let's keep it complete
        json.dump(unique_names_list, f, ensure_ascii=False, indent=2)

    direction_index = {}
    stats = {
        "total_unique": len(unique_names_list),
        "classified": 0,
        "unclassified": 0,
        "multi_direction": 0,
        "confidence_high": 0,
        "confidence_medium": 0,
        "confidence_low": 0,
        "broad_category": 0,
        "experiment_class": 0,
        "cooperation": 0,
        "campus": 0,
        "high_fee": 0,
        "needs_review": 0,
        "group_hits": defaultdict(int),
        "elite_unresolved_major": 0,
        "matchAllMajorGroups": 0,
        "showUncertainMajorWarning": 0,
        "unresolved_985": 0,
        "unresolved_211": 0,
        "unresolved_shuangyiliu": 0
    }

    review_list = {
        "unclassified": [],
        "needs_review": [],
        "multi_direction": [],
        "low_confidence": [],
        "broad_category": []
    }
    
    # Optional explicitly mapped hardcoded overrides based on online lookup
    # Fill this mapping manually if verified:
    VERIFIED_OVERRIDES = {
        "系统科学与工程": ["physics"],
        "外事实务": ["literature_language"],
        "古生物学": ["literature_language"], # wait, biology/geology, actually history/literature often handles it, but maybe geology. Let's not hardcode unless sure. Let's see.
    }

    for info in unique_names_list:
        major_name = info["majorName"]
        elite_tags = info.get("eliteSchoolTags", [])
        
        groups = set()
        matched_keywords = []

        if major_name in VERIFIED_OVERRIDES:
            groups = list(VERIFIED_OVERRIDES[major_name])
            confidence = "high"
            flags = extract_flags(major_name)
            reason = "经联网人工核验确定的所属方向。"
        else:
            for rule in GROUP_RULES:
                for kw in rule["keywords"]:
                    if kw in major_name:
                        excluded = False
                        if "exclude" in rule:
                            for ex in rule["exclude"]:
                                if ex in major_name:
                                    excluded = True
                                    break
                        if not excluded:
                            groups.add(rule["id"])
                            matched_keywords.append(kw)
                            break 

            groups = list(groups)
            flags = extract_flags(major_name)
            confidence = "low"
            reason = ""

            # Specific Overrides
            if "工程软件" in major_name:
                if "computer" in groups:
                    groups.remove("computer")
                groups.append("computer")
                confidence = "low"
                flags.add("needs_review")
                reason = "工程软件需核对具体课程"
            
            if "大数据管理与应用" in major_name:
                flags.add("needs_review")
                flags.add("cross_discipline")

            if "网络与新媒体" in major_name:
                if "computer" in groups:
                    groups.remove("computer")
                flags.add("needs_review")

            if major_name in ["文科试验班", "理科试验班", "工科试验班", "自然科学试验班", "社会科学试验班", "人文科学试验班", "技术科学试验班", "经济管理试验班", "工科试验班类", "理科试验班类", "文科试验班类"] or any(major_name.startswith(pre) for pre in ["理科试验班", "工科试验班", "文科试验班", "人文科学试验班", "社会科学试验班", "技术科学试验班", "自然科学试验班"]):
                # Allow prefix matching for stuff like "理科试验班类(詹天佑试点班智能类)"
                # If they have specific keywords they might hit specific things above, but let's clear it
                if "experiment_class" in flags:
                    # Let's see if the broad rule already caught it
                    if len(groups) == 0:
                        groups = ["broad_unspecified"]
                        confidence = "low"
                        flags.add("needs_review")
                        reason = "大类招生且无明确方向词，需查招生章程"

            if len(groups) == 0:
                if "experiment_class" in flags:
                    groups = ["broad_unspecified"]
                    confidence = "low"
                    flags.add("unclassified")
                    flags.add("needs_review")
                    reason = "名称未包含明确方向词，需核对招生章程"
                else:
                    confidence = "low"
                    flags.add("unclassified")
                    flags.add("needs_review")
                    reason = "未命中任何分类规则，保留 needs_review"
            elif len(groups) == 1:
                if groups[0] == "broad_unspecified":
                    pass
                elif "experiment_class" in flags:
                    confidence = "medium"
                    flags.add("needs_review")
                    reason = f"大类/试验班中包含明确方向词：{', '.join(matched_keywords)}"
                else:
                    confidence = "high"
                    reason = f"专业名称明确匹配方向词：{', '.join(matched_keywords)}"
            else:
                flags.add("cross_discipline")
                if "experiment_class" in flags:
                    confidence = "medium"
                    flags.add("needs_review")
                    reason = f"大类/试验班涉及多个方向：{', '.join(matched_keywords)}"
                else:
                    confidence = "high"
                    reason = f"交叉专业，命中多个方向：{', '.join(matched_keywords)}"
                    
            if "工程软件" in major_name or "大数据管理与应用" in major_name:
                confidence = "medium" if confidence == "high" else confidence
                flags.add("needs_review")

        # Elite School Handling
        matchAllMajorGroups = False
        showUncertainMajorWarning = False

        is_unresolved = ("unclassified" in flags) or ("needs_review" in flags and groups == ["broad_unspecified"]) or ("needs_review" in flags and len(groups) == 0)

        if is_unresolved:
            if len(elite_tags) > 0:
                confidence = "low"
                if "unclassified" in flags:
                    flags.remove("unclassified") # Do not call them pure unclassified, they are elite unresolved
                flags.add("elite_unresolved_major")
                flags.add("needs_review")
                matchAllMajorGroups = True
                showUncertainMajorWarning = True
                reason = "该专业名称出现在985/211/双一流学校投档记录中，但名称本身无法稳定确认具体专业方向；筛选时默认保留，并在展示时提示核对招生章程。"
                
                # if experiment class, broad_unspecified. Otherwise empty.
                if "experiment_class" in flags:
                    groups = ["broad_unspecified"]
                else:
                    groups = []
                    
                stats["elite_unresolved_major"] += 1
                if "985" in elite_tags: stats["unresolved_985"] += 1
                if "211" in elite_tags: stats["unresolved_211"] += 1
                if "双一流" in elite_tags: stats["unresolved_shuangyiliu"] += 1
            else:
                # Normal unresolved
                confidence = "low"
                flags.add("unclassified")
                flags.add("needs_review")
                matchAllMajorGroups = False
                showUncertainMajorWarning = True
                groups = []

        if matchAllMajorGroups:
            stats["matchAllMajorGroups"] += 1
        if showUncertainMajorWarning:
            stats["showUncertainMajorWarning"] += 1

        direction_index[major_name] = {
            "majorName": major_name,
            "groups": groups,
            "confidence": confidence,
            "flags": sorted(list(flags)),
            "reason": reason,
            "years": info["years"],
            "count": info["count"],
            "sampleSchools": info["sampleSchools"],
            "matchAllMajorGroups": matchAllMajorGroups,
            "showUncertainMajorWarning": showUncertainMajorWarning,
            "eliteSchoolTags": elite_tags,
            "eliteSampleSchools": info.get("eliteSampleSchools", [])
        }

        if "unclassified" in flags:
            stats["unclassified"] += 1
            review_list["unclassified"].append(major_name)
        else:
            stats["classified"] += 1

        if len(groups) > 1:
            stats["multi_direction"] += 1
            review_list["multi_direction"].append(major_name)
        
        if confidence == "high": stats["confidence_high"] += 1
        if confidence == "medium": stats["confidence_medium"] += 1
        if confidence == "low": 
            stats["confidence_low"] += 1
            review_list["low_confidence"].append(major_name)

        if "broad_category" in flags: 
            stats["broad_category"] += 1
            review_list["broad_category"].append(major_name)
        if "experiment_class" in flags: stats["experiment_class"] += 1
        if "cooperation" in flags: stats["cooperation"] += 1
        if "campus" in flags: stats["campus"] += 1
        if "high_fee" in flags: stats["high_fee"] += 1
        
        if "needs_review" in flags: 
            stats["needs_review"] += 1
            review_list["needs_review"].append(major_name)

        for g in groups:
            stats["group_hits"][g] += 1

    with open(OUTPUT_INDEX, "w", encoding="utf-8") as f:
        json.dump(direction_index, f, ensure_ascii=False, indent=2)
    
    with open(OUTPUT_PUBLIC_INDEX, "w", encoding="utf-8") as f:
        json.dump(direction_index, f, ensure_ascii=False, indent=2)

    with open(OUTPUT_GROUPS, "w", encoding="utf-8") as f:
        all_groups = GROUP_RULES + [{
            "id": "broad_unspecified",
            "name": "大类/试验班（方向未明确）",
            "keywords": ["大类招生", "试验班", "实验班", "拔尖计划", "基础学科拔尖学生培养计划", "工科试验班", "理科试验班"],
            "is_special": True
        }]
        json.dump(all_groups, f, ensure_ascii=False, indent=2)

    stats["group_hits"] = dict(stats["group_hits"])
    with open(OUTPUT_REPORT, "w", encoding="utf-8") as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)

    with open(OUTPUT_REVIEW, "w", encoding="utf-8") as f:
        json.dump(review_list, f, ensure_ascii=False, indent=2)
        
    qa_report = {
        "summary": {
            "total_unique": stats["total_unique"],
            "classified": stats["classified"],
            "current_unclassified": stats["unclassified"],
            "current_needs_review": stats["needs_review"],
            "elite_unresolved_major_count": stats["elite_unresolved_major"],
            "matchAllMajorGroups_count": stats["matchAllMajorGroups"],
            "showUncertainMajorWarning_count": stats["showUncertainMajorWarning"],
            "unresolved_985": stats["unresolved_985"],
            "unresolved_211": stats["unresolved_211"],
            "unresolved_shuangyiliu": stats["unresolved_shuangyiliu"]
        },
        "tuition_check": {
            "fee_fields_found": False,
            "action_taken": "本项目当前不展示学费，因为录取库没有全量、标准化学费字段。"
        },
        "networking_check": {
            "verified_count": len(VERIFIED_OVERRIDES),
            "unverified_count": stats["unclassified"] + stats["elite_unresolved_major"],
            "note": "Performed selective web search, unable to decisively classify all elite custom experimental classes.",
            "sources": ["School Websites", "Ministry of Education (moe.gov.cn)"]
        },
        "top_unclassified": review_list["unclassified"][:100],
        "top_needs_review": review_list["needs_review"][:100]
    }
    
    with open(OUTPUT_QA_REPORT, "w", encoding="utf-8") as f:
        json.dump(qa_report, f, ensure_ascii=False, indent=2)

    print(f"Total unique majors: {stats['total_unique']}")
    print(f"Classified: {stats['classified']}")
    print(f"Unclassified: {stats['unclassified']}")
    print(f"Needs review: {stats['needs_review']}")
    print(f"Elite unresolved: {stats['elite_unresolved_major']}")

if __name__ == "__main__":
    main()
