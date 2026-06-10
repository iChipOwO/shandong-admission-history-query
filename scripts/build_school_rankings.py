import json
import os
import urllib.request
import re
import shutil

# Paths
DATA_PROCESSED_DIR = os.path.join("data", "processed")
PUBLIC_DATA_DIR = os.path.join("public", "data")
METADATA_FILE = os.path.join(DATA_PROCESSED_DIR, "school_metadata.json")

RANKING_SOURCES_FILE = os.path.join(DATA_PROCESSED_DIR, "ranking_sources.json")
SCHOOL_RANKINGS_FILE = os.path.join(DATA_PROCESSED_DIR, "school_rankings.json")
MATCH_REPORT_FILE = os.path.join(DATA_PROCESSED_DIR, "ranking_match_report.json")

def normalize_name(name):
    if not name:
        return ""
    name = str(name).replace(" ", "")
    name = name.replace("（", "(").replace("）", ")")
    return name

def load_metadata():
    if not os.path.exists(METADATA_FILE):
        return []
    with open(METADATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def fetch_shanghai_ranking(bcur_type, year=2025):
    url = f"https://www.shanghairanking.cn/api/pub/v1/bcur?bcur_type={bcur_type}&year={year}"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        response = urllib.request.urlopen(req, timeout=15).read().decode('utf-8')
        data = json.loads(response)
        return data.get("data", {}).get("rankings", [])
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return []

def main():
    metadata = load_metadata()
    school_dict_code = {m["schoolCode"]: m for m in metadata if "schoolCode" in m}
    school_dict_name = {m["schoolName"]: m for m in metadata if "schoolName" in m}
    school_dict_norm = {normalize_name(m["schoolName"]): m for m in metadata if "schoolName" in m}
    
    # Pre-calculate 985/211 sets
    schools_985 = set()
    schools_211 = set()
    schools_double_first = set()
    
    for m in metadata:
        tags = m.get("schoolTypeTags", [])
        code = m.get("schoolCode")
        if "985工程" in tags or "985" in tags:
            schools_985.add(code)
        if "211工程" in tags or "211" in tags:
            schools_211.add(code)
        if "双一流" in tags:
            schools_double_first.add(code)
            
    match_report = {
        "schoolMetadataCount": len(metadata),
        "schoolRankingRecordCount": 0,
        "schoolsWithAnyRanking": 0,
        "schoolsWithoutAnyRanking": 0,
        "sources": [],
        "sourceCoverage": {},
        "importantCoverage": {
            "985": {"total": len(schools_985), "covered": 0, "missing": []},
            "211": {"total": len(schools_211), "covered": 0, "missing": []},
            "doubleFirstClass": {"total": len(schools_double_first), "covered": 0, "missing": []}
        },
        "importantMissingAnalysis": [],
        "importantMissingByReason": {},
        "unresolvedImportantMissing": [],
        "unmatchedRankingNames": [],
        "ambiguousRankingNames": [],
        "branchCampusRisks": [],
        "failedSources": [],
        "partialPreviewSources": []
    }
    
    # Aliases dict (verified)
    alias_dict = {
        "华北电力大学(北京)": "华北电力大学",
        "华北电力大学(保定)": "华北电力大学",
        "中国石油大学(北京)": "中国石油大学",
        "中国石油大学(华东)": "中国石油大学",
        "中国地质大学(北京)": "中国地质大学",
        "中国地质大学(武汉)": "中国地质大学",
        "中国矿业大学(北京)": "中国矿业大学",
        "中国矿业大学(徐州)": "中国矿业大学",
        "北京体育大学": "北京体育大学"
    }
    
    def match_school_codes(raw_name):
        norm_raw = normalize_name(raw_name)
        if norm_raw in alias_dict:
            norm_raw = alias_dict[norm_raw]
            
        matched_codes = []
        for m in metadata:
            m_norm = normalize_name(m.get("schoolName", ""))
            if m_norm in alias_dict:
                m_norm = alias_dict[m_norm]
            if m_norm == norm_raw:
                matched_codes.append(m.get("schoolCode"))
        
        # Branch campus handling warning
        if "(" in norm_raw and "分校" not in norm_raw and "校区" not in norm_raw:
             match_report["branchCampusRisks"].append(raw_name)
             
        if not matched_codes:
            match_report["ambiguousRankingNames"].append(raw_name)
            
        return matched_codes, norm_raw

    sources = []
    
    # Prepare all schools output structure
    rankings_by_school = {}
    for m in metadata:
        code = m.get("schoolCode")
        rankings_by_school[code] = {
            "schoolCode": code,
            "schoolName": m.get("schoolName"),
            "province": m.get("province", ""),
            "city": m.get("city", ""),
            "schoolTypeTags": m.get("schoolTypeTags", []),
            "rankings": [],
            "rankingCoverage": {
                "hasAnyRanking": False,
                "sourceCount": 0
            }
        }

    # 1. Shanghai Ranking (软科)
    categories = {
        11: "主榜", 14: "合作办学", 15: "民办高校", 16: "独立学院",
        17: "中外合作办学", 21: "医药类", 22: "财经类", 23: "语言类",
        24: "政法类", 25: "民族类", 26: "体育类", 30: "艺术类/其他"
    }
    
    shanghai_total_matches = 0
    shanghai_total_records = 0
    
    print("Fetching Shanghai Rankings...")
    for t, cat in categories.items():
        data = fetch_shanghai_ranking(t, 2025)
        if not data:
            data = fetch_shanghai_ranking(t, 2024)
            
        if data:
            shanghai_total_records += len(data)
            match_count = 0
            for row in data:
                raw_name = row.get("univNameCn", "")
                if not raw_name:
                    continue
                
                matched_codes, norm_raw = match_school_codes(raw_name)
                if matched_codes:
                    rank_str = row.get("ranking", "")
                    try:
                        rank = int(re.sub(r'\D.*', '', str(rank_str)))
                    except:
                        rank = 9999
                        
                    for code in matched_codes:
                        if code in rankings_by_school:
                            rankings_by_school[code]["rankings"].append({
                                "sourceId": f"shanghai_ranking_bcur_2025_{t}",
                                "sourceName": "软科中国大学排名",
                                "year": 2025,
                                "category": cat,
                                "rank": rank,
                                "rankDisplay": str(rank_str),
                                "score": float(row.get("score") or 0.0),
                                "rawName": raw_name,
                                "sourceStatus": "success",
                                "sourceConfidence": "official",
                                "sourceUrl": f"https://www.shanghairanking.cn/rankings/bcur/2025"
                            })
                    match_count += 1
                else:
                    if raw_name not in match_report["unmatchedRankingNames"]:
                        match_report["unmatchedRankingNames"].append(raw_name)
                        
            sources.append({
                "sourceId": f"shanghai_ranking_bcur_2025_{t}",
                "sourceName": "软科中国大学排名",
                "type": "school_ranking",
                "year": 2025,
                "category": cat,
                "sourceUrl": "https://www.shanghairanking.cn/rankings/bcur/2025",
                "status": "success",
                "recordCount": len(data),
                "matchedCount": match_count,
                "sourceConfidence": "official",
                "originalSourceName": "上海软科",
                "coverageNote": "完整榜单",
                "note": "不同榜单分数不可比较，不参与查询排序。"
            })
            match_report["sourceCoverage"][f"shanghai_ranking_bcur_2025_{t}"] = match_count
            shanghai_total_matches += match_count
            
    # 2. Alumni Association (校友会) using Pandas for the secondary mirror
    print("Fetching Alumni Association Rankings...")
    try:
        import pandas as pd
        dfs = pd.read_html('https://www.dxsbb.com/news/5463.html')
        if dfs:
            df = dfs[0]
            # Assumed columns: 0: 名次, 1: 学校名称, 2: 总分, 3: 星级, 4: 办学层次
            match_count = 0
            # Drop header row if needed (usually pandas parses first row as header, but if not we skip)
            for _, row in df.iterrows():
                rank_str = str(row.iloc[0])
                if rank_str == "名次" or "名次" in rank_str or rank_str == "nan":
                    continue
                    
                raw_name = str(row.iloc[1])
                score_str = str(row.iloc[2])
                star_str = str(row.iloc[3]) if len(row) > 3 else ""
                level_str = str(row.iloc[4]) if len(row) > 4 else ""
                
                matched_codes, norm_raw = match_school_codes(raw_name)
                
                if matched_codes:
                    try:
                        rank = int(re.sub(r'\D.*', '', rank_str))
                    except:
                        rank = 9999
                    
                    try:
                        score = float(re.sub(r'[^\d.]', '', score_str))
                    except:
                        score = 0.0
                        
                    for code in matched_codes:
                        if code in rankings_by_school:
                            rankings_by_school[code]["rankings"].append({
                                "sourceId": "xiaoyouhui_2025_main_800",
                                "sourceName": "校友会2025中国大学排名",
                                "year": 2025,
                                "category": "总榜",
                                "rank": rank,
                                "rankDisplay": rank_str,
                                "score": score,
                                "rawName": raw_name,
                                "star": star_str,
                                "level": level_str,
                                "sourceStatus": "success",
                                "sourceConfidence": "secondary_mirror",
                                "sourceUrl": "https://www.dxsbb.com/news/5463.html"
                            })
                    match_count += 1
                else:
                    if raw_name not in match_report["unmatchedRankingNames"]:
                        match_report["unmatchedRankingNames"].append(raw_name)
                        
            sources.append({
                "sourceId": "xiaoyouhui_2025_main_800",
                "sourceName": "校友会2025中国大学排名",
                "type": "school_ranking",
                "year": 2025,
                "category": "总榜",
                "sourceUrl": "https://www.dxsbb.com/news/5463.html",
                "status": "success",
                "recordCount": len(df),
                "matchedCount": match_count,
                "sourceConfidence": "secondary_mirror",
                "originalSourceName": "艾瑞深校友会网 / Cuaa.net",
                "coverageNote": "二级镜像抓取总榜",
                "note": "分数可能受限于镜像准确度。"
            })
            match_report["sourceCoverage"]["xiaoyouhui_2025_main_800"] = match_count
        else:
            raise Exception("No tables found in HTML")
    except Exception as e:
        print(f"Error fetching Alumni Association: {e}")
        sources.append({
            "sourceId": "xiaoyouhui_2025_main_800",
            "sourceName": "校友会2025中国大学排名",
            "type": "school_ranking",
            "year": 2025,
            "category": "总榜",
            "sourceUrl": "https://www.dxsbb.com/news/5463.html",
            "status": "failed",
            "recordCount": 0,
            "matchedCount": 0,
            "sourceConfidence": "secondary_mirror",
            "originalSourceName": "艾瑞深校友会网 / Cuaa.net",
            "coverageNote": f"失败原因: {e}",
            "note": "抓取失败"
        })
        match_report["failedSources"].append("xiaoyouhui_2025_main_800")
        
    # Compute coverages
    schools_with_ranking = set()
    for code, s in rankings_by_school.items():
        if len(s["rankings"]) > 0:
            s["rankingCoverage"]["hasAnyRanking"] = True
            s["rankingCoverage"]["sourceCount"] = len({r["sourceId"] for r in s["rankings"]})
            schools_with_ranking.add(code)
            
    match_report["schoolsWithAnyRanking"] = len(schools_with_ranking)
    match_report["schoolsWithoutAnyRanking"] = len(rankings_by_school) - len(schools_with_ranking)
    match_report["schoolRankingRecordCount"] = len(rankings_by_school)
    
    # 985/211/双一流
    def check_coverage(codes_set, report_key):
        for code in codes_set:
            if code in schools_with_ranking:
                match_report["importantCoverage"][report_key]["covered"] += 1
            else:
                match_report["importantCoverage"][report_key]["missing"].append(code)
                
    check_coverage(schools_985, "985")
    check_coverage(schools_211, "211")
    check_coverage(schools_double_first, "doubleFirstClass")
    
    # Analyze important missing
    all_missing_codes = set(match_report["importantCoverage"]["985"]["missing"] + 
                            match_report["importantCoverage"]["211"]["missing"] + 
                            match_report["importantCoverage"]["doubleFirstClass"]["missing"])
                            
    for code in all_missing_codes:
        school = school_dict_code[code]
        name = school["schoolName"]
        tags = []
        schoolTypeTags = school.get("schoolTypeTags", [])
        if "985工程" in schoolTypeTags or "985" in schoolTypeTags: tags.append("985")
        if "211工程" in schoolTypeTags or "211" in schoolTypeTags: tags.append("211")
        if "双一流" in schoolTypeTags: tags.append("双一流")
        
        isBranch = "分校" in name or "校区" in name or name in ["哈尔滨工业大学(深圳)", "哈尔滨工业大学(威海)"]
        isMedical = "医学院" in name or "医学部" in name or "医科" in name or "中医药" in name
        isMilitary = "军" in name or "国防" in name or "警察" in name
        isHKMacau = "香港" in name or "澳门" in name
        
        parentCandidate = ""
        parentHasRanking = False
        shouldInherit = False
        reason = "未被软科/校友会主榜及子榜单收录"
        
        if isBranch:
            parentCandidate = name.split("(")[0].split("（")[0].replace("分校", "").replace("校区", "")
            if parentCandidate in school_dict_name:
                parentCode = school_dict_name[parentCandidate]["schoolCode"]
                parentHasRanking = parentCode in schools_with_ranking
            reason = f"该记录为{name}，通常软科/校友会源未单独列出该校区；为避免误导，不自动继承本部排名。"
        elif isMedical and "大学" in name and ("医学部" in name or "医学院" in name):
            parentCandidate = name.replace("医学部", "").replace("医学院", "").replace("上海医学院", "")
            if parentCandidate in school_dict_name:
                parentCode = school_dict_name[parentCandidate]["schoolCode"]
                parentHasRanking = parentCode in schools_with_ranking
            reason = f"该记录为{name}，属于医学独立招生实体，主榜通常只对大学本部进行总体排名；不继承本部排名。"
        elif isMilitary:
            reason = "军校/警校特殊性质，多数排名源不予排位或公开展示。"
        elif isHKMacau:
            reason = "港澳高校或中外合作办学，未被内地部分主榜单收录。"
            
        analysis = {
            "schoolCode": code,
            "schoolName": name,
            "tags": tags,
            "schoolTypeTags": schoolTypeTags,
            "isBranchCampus": isBranch,
            "isMedicalSchoolEntity": isMedical,
            "isMilitary": isMilitary,
            "isHongKongMacau": isHKMacau,
            "parentCandidate": parentCandidate,
            "parentHasRanking": parentHasRanking,
            "shouldInheritParentRanking": shouldInherit,
            "reason": reason
        }
        match_report["importantMissingAnalysis"].append(analysis)
        
        reasonKey = "Branch" if isBranch else "Medical" if isMedical else "Military" if isMilitary else "HK/Macau" if isHKMacau else "Other"
        match_report["importantMissingByReason"][reasonKey] = match_report["importantMissingByReason"].get(reasonKey, 0) + 1
        
        if reasonKey == "Other":
            match_report["unresolvedImportantMissing"].append(name)
            
    # Resolve the display names of missing schools in importantCoverage
    for key in ["985", "211", "doubleFirstClass"]:
        match_report["importantCoverage"][key]["missing"] = [school_dict_code[c]["schoolName"] for c in match_report["importantCoverage"][key]["missing"]]
    
    # Assign missingReason to all unranked schools
    def get_general_missing_reason(name):
        isBranch = "分校" in name or "校区" in name or name in ["哈尔滨工业大学(深圳)", "哈尔滨工业大学(威海)"]
        isMedical = "医学院" in name or "医学部" in name or "医科" in name or "中医药" in name
        isMilitary = "军" in name or "国防" in name or "警察" in name
        isHKMacau = "香港" in name or "澳门" in name
        if isBranch: return "分校区不继承本部排名"
        if isMilitary: return "军校或警校不参与公开排位"
        if isMedical and ("医学院" in name or "医学部" in name): return "医学院独立招生代码不继承本部综合排名"
        if isHKMacau: return "未被内地部分主流榜单收录"
        return "未被软科或校友会榜单收录"

    for code, s in rankings_by_school.items():
        if not s["rankingCoverage"]["hasAnyRanking"]:
            s["missingReason"] = get_general_missing_reason(s["schoolName"])

    match_report["sources"] = sources
    match_report["unmatchedRankingNames"] = list(set(match_report["unmatchedRankingNames"]))
    match_report["ambiguousRankingNames"] = list(set(match_report["ambiguousRankingNames"]))
    match_report["branchCampusRisks"] = list(set(match_report["branchCampusRisks"]))

    def write_json(path, data):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            
    print("Writing files...")
    write_json(RANKING_SOURCES_FILE, sources)
    write_json(SCHOOL_RANKINGS_FILE, list(rankings_by_school.values()))
    write_json(MATCH_REPORT_FILE, match_report)
    
    shutil.copy2(RANKING_SOURCES_FILE, os.path.join(PUBLIC_DATA_DIR, "ranking_sources.json"))
    shutil.copy2(SCHOOL_RANKINGS_FILE, os.path.join(PUBLIC_DATA_DIR, "school_rankings.json"))

    print("Done!")

if __name__ == "__main__":
    main()
