import json
import os
import sys

def main():
    groups_path = "data/processed/major_direction_groups.json"
    eval_path = "data/processed/subject_evaluation.json"
    
    if not os.path.exists(groups_path) or not os.path.exists(eval_path):
        print("Required input files are missing.")
        sys.exit(1)
        
    with open(groups_path, "r", encoding="utf-8") as f:
        groups = json.load(f)
        
    with open(eval_path, "r", encoding="utf-8") as f:
        eval_data = json.load(f)
        
    valid_subjects = set()
    for school in eval_data:
        for subject in school.get("subjects", []):
            valid_subjects.add(subject.get("subjectName"))
            
    group_dict = {g["id"]: g for g in groups}
    
    suggested_map = {
        "computer": [
            ("计算机科学与技术", 1, "计算机类核心一级学科"),
            ("软件工程", 2, "与软件工程专业直接相关"),
            ("网络空间安全", 3, "与信息安全、网络安全方向相关")
        ],
        "electronic_info": [
            ("电子科学与技术", 1, "电子信息类核心学科"),
            ("信息与通信工程", 2, "通信领域核心学科"),
            ("光学工程", 3, "光电方向"),
            ("仪器科学与技术", 4, "测控、仪器方向")
        ],
        "automation": [
            ("控制科学与工程", 1, "自动化类核心一级学科")
        ],
        "electrical": [
            ("电气工程", 1, "电气类核心一级学科")
        ],
        "mechanical": [
            ("机械工程", 1, "机械类核心一级学科")
        ],
        "materials": [
            ("材料科学与工程", 1, "材料类核心一级学科")
        ],
        "energy_power": [
            ("动力工程及工程热物理", 1, "能源动力类核心一级学科"),
            ("核科学与技术", 2, "核工程相关")
        ],
        "civil_architecture": [
            ("土木工程", 1, "土木类核心"),
            ("建筑学", 2, "建筑类核心"),
            ("城乡规划学", 3, "城乡规划相关"),
            ("风景园林学", 4, "风景园林相关")
        ],
        "transportation": [
            ("交通运输工程", 1, "交通运输核心学科"),
            ("船舶与海洋工程", 2, "航海、船舶方向")
        ],
        "aerospace": [
            ("航空宇航科学与技术", 1, "航空航天类核心一级学科")
        ],
        "mathematics": [
            ("数学", 1, "数学类核心"),
            ("统计学", 2, "统计相关")
        ],
        "physics": [
            ("物理学", 1, "物理类核心"),
            ("天文学", 2, "天文相关")
        ],
        "chemistry": [
            ("化学", 1, "化学类核心"),
            ("化学工程与技术", 2, "化工相关")
        ],
        "biology": [
            ("生物学", 1, "生物类核心"),
            ("生态学", 2, "生态相关")
        ],
        "medical": [
            ("临床医学", 1, "临床核心"),
            ("口腔医学", 2, "口腔核心"),
            ("基础医学", 3, "基础医学"),
            ("公共卫生与预防医学", 4, "公卫核心"),
            ("中医学", 5, "中医核心"),
            ("中西医结合", 6, "中西医核心"),
            ("护理学", 7, "护理核心"),
            ("特种医学", 8, "特种医学")
        ],
        "pharmacy": [
            ("药学", 1, "药学核心"),
            ("中药学", 2, "中药学核心")
        ],
        "finance_economics": [
            ("理论经济学", 1, "经济学基础"),
            ("应用经济学", 2, "财经核心"),
            ("统计学", 3, "经济统计相关"),
            ("工商管理", 4, "财会、商管相关")
        ],
        "management": [
            ("管理科学与工程", 1, "管理类核心"),
            ("工商管理", 2, "工商管理"),
            ("公共管理", 3, "公共管理"),
            ("农林经济管理", 4, "农林管理"),
            ("图书情报与档案管理", 5, "图书档案管理")
        ],
        "law": [
            ("法学", 1, "法学核心"),
            ("政治学", 2, "政治学相关"),
            ("社会学", 3, "社会学相关"),
            ("马克思主义理论", 4, "马理论"),
            ("民族学", 5, "民族学")
        ],
        "literature_language": [
            ("中国语言文学", 1, "中文类核心"),
            ("外国语言文学", 2, "外语类核心"),
            ("新闻传播学", 3, "新闻传播类核心")
        ],
        "education_normal": [
            ("教育学", 1, "教育学核心"),
            ("心理学", 2, "心理学核心")
        ],
        "agriculture_forestry": [
            ("作物学", 1, "农学核心"),
            ("园艺学", 2, "园艺核心"),
            ("农业资源与环境", 3, "农业资源"),
            ("植物保护", 4, "植保"),
            ("畜牧学", 5, "畜牧"),
            ("兽医学", 6, "兽医"),
            ("林学", 7, "林学"),
            ("水产", 8, "水产"),
            ("草学", 9, "草学")
        ],
        "art": [
            ("艺术学理论", 1, "艺术理论"),
            ("音乐与舞蹈学", 2, "音乐舞蹈"),
            ("戏剧与影视学", 3, "戏剧影视"),
            ("美术学", 4, "美术"),
            ("设计学", 5, "设计")
        ],
        "sports": [
            ("体育学", 1, "体育学核心")
        ],
        "public_security_military": [
            ("公安学", 1, "公安学"),
            ("公安技术", 2, "公安技术")
        ]
    }
    
    final_map = {}
    unmatched_subjects = []
    unmapped_directions = []
    
    # Validation & Construction
    for gid, group in group_dict.items():
        if gid == "broad_unspecified":
            continue
            
        if gid not in suggested_map:
            unmapped_directions.append(gid)
            continue
            
        direction_name = group["name"]
        subjects_list = []
        priorities = set()
        
        for sub_name, prio, note in suggested_map[gid]:
            if not note:
                print(f"Error: Empty note for {sub_name} in {gid}")
                sys.exit(1)
            if prio in priorities:
                print(f"Error: Duplicate priority {prio} in {gid}")
                sys.exit(1)
            
            priorities.add(prio)
            
            if sub_name in valid_subjects:
                subjects_list.append({
                    "subjectName": sub_name,
                    "priority": prio,
                    "note": note
                })
            else:
                unmatched_subjects.append({
                    "directionId": gid,
                    "subjectName": sub_name
                })
                
        if subjects_list:
            final_map[gid] = {
                "directionName": direction_name,
                "subjects": sorted(subjects_list, key=lambda x: x["priority"])
            }
        else:
            unmapped_directions.append(gid)

    total_directions = len(group_dict)
    specific_directions = total_directions - 1 if "broad_unspecified" in group_dict else total_directions
    mapped_directions = len(final_map)
    total_mapped_subjects = sum(len(v["subjects"]) for v in final_map.values())
    
    report = {
        "summary": {
            "totalDirections": total_directions,
            "specificDirections": specific_directions,
            "mappedDirections": mapped_directions,
            "unmappedDirections": len(unmapped_directions),
            "totalMappedSubjects": total_mapped_subjects,
            "unmatchedSubjectsCount": len(unmatched_subjects),
            "broadUnspecifiedMapped": "broad_unspecified" in final_map
        },
        "unmatchedSubjects": unmatched_subjects,
        "unmappedDirections": unmapped_directions,
        "gradePriority": "A+ > A > A- > B+ > B > B- > C+ > C > C-",
        "displayRules": {
            "defaultRankingSource": "软科 2025",
            "rankingDisplay": "查询页和报告页只显示排名数字小标签。无排名则不显示，不展示'未入榜'。",
            "evaluationDisplay": "专业名右侧只显示评级小标签。如果一个专业方向映射到多个一级学科，前端应选该学校在相关学科中的最高等级展示。评级相同时优先展示priority更高的一级学科。没有学科评估则不显示。待核对、大类/试验班、无法确认方向的专业不显示学科评估小标签。",
            "disclaimer": "学科评估不等于本科专业排名。"
        }
    }
    
    print(f"=== Mapping Report ===")
    print(f"Total Directions: {total_directions}")
    print(f"Specific Directions: {specific_directions}")
    print(f"Mapped Directions: {mapped_directions}")
    print(f"Unmapped Directions: {len(unmapped_directions)}")
    print(f"Total Mapped Subjects: {total_mapped_subjects}")
    print(f"Unmatched Subjects: {len(unmatched_subjects)}")
    print(f"broad_unspecified mapped: {'broad_unspecified' in final_map}")
    
    with open("data/processed/major_subject_map.json", "w", encoding="utf-8") as f:
        json.dump(final_map, f, ensure_ascii=False, indent=2)
        
    with open("public/data/major_subject_map.json", "w", encoding="utf-8") as f:
        json.dump(final_map, f, ensure_ascii=False, indent=2)
        
    with open("data/processed/major_subject_map_report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
        
    print("Files successfully generated.")

if __name__ == "__main__":
    main()
