import json
import os
import re
import math
from datetime import datetime
import pandas as pd

def parse_code_name(text):
    if not isinstance(text, str):
        return "", str(text)
    text = text.strip()
    match = re.match(r'^([A-Za-z0-9]+)\s*(.*)$', text)
    if match:
        return match.group(1), match.group(2).strip()
    return "", text

def to_int_or_null(val):
    try:
        if pd.isna(val):
            return None
        return int(float(val))
    except (ValueError, TypeError):
        return None

def main():
    print("开始执行山东省高考录取数据导入脚本")
    
    raw_dir = os.path.join("data", "raw")
    processed_dir = os.path.join("data", "processed")
    public_data_dir = os.path.join("public", "data")
    
    os.makedirs(raw_dir, exist_ok=True)
    os.makedirs(processed_dir, exist_ok=True)
    os.makedirs(public_data_dir, exist_ok=True)
    
    output_file = os.path.join(processed_dir, "admissions_shandong_2023_2025.json")
    public_output_file = os.path.join(public_data_dir, "admissions_shandong_2023_2025.json")
    report_file = os.path.join(processed_dir, "import_report.json")
    manifest_file = os.path.join(raw_dir, "download_manifest.json")
    
    manifest_data = {}
    if os.path.exists(manifest_file):
        with open(manifest_file, 'r', encoding='utf-8-sig') as f:
            manifest_list = json.load(f)
            if isinstance(manifest_list, list):
                for item in manifest_list:
                    manifest_data[str(item.get("year"))] = item
            
    xls_files = [f for f in os.listdir(raw_dir) if f.endswith('.xls') or f.endswith('.xlsx')]
    
    report = {
        "generatedAt": datetime.now().isoformat(),
        "inputFiles": xls_files,
        "outputFiles": [output_file, public_output_file],
        "totalRecords": 0,
        "recordsByYear": {},
        "emptySchoolNameCount": 0,
        "emptyMajorNameCount": 0,
        "emptyMinScoreCount": 0,
        "emptyMinRankCount": 0,
        "parseErrorCount": 0,
        "duplicateIdCount": 0,
        "sampleRecords": [],
        "warnings": []
    }

    if not xls_files:
        print(f"未能找到真实 Excel 数据文件。")
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        return

    records = []
    seen_ids = set()

    for file in xls_files:
        filepath = os.path.join(raw_dir, file)
        
        # Determine year
        year_match = re.search(r'202\d', file)
        year = int(year_match.group()) if year_match else 2025
        
        print(f"正在处理 {file} (年份: {year})")
        
        try:
            # Read first few rows to find header
            df_preview = pd.read_excel(filepath, header=None, nrows=20)
            header_row_idx = 0
            for idx, row in df_preview.iterrows():
                row_str = " ".join([str(x) for x in row.values if pd.notna(x)])
                if '院校' in row_str or '专业' in row_str or '投档' in row_str:
                    header_row_idx = idx
                    break
            
            df = pd.read_excel(filepath, header=None)
            
            major_idx = -1
            school_idx = -1
            plan_idx = -1
            rank_idx = -1
            
            data_start_idx = 0
            
            for idx, row in df.iterrows():
                row_vals = [str(x) if pd.notna(x) else "" for x in row.values]
                row_str = " ".join(row_vals)
                if '院校' in row_str or '专业' in row_str:
                    for c_idx, val in enumerate(row_vals):
                        if '专业' in val: major_idx = c_idx
                        elif '院校' in val: school_idx = c_idx
                        elif '计划' in val: plan_idx = c_idx
                        elif '位次' in val or '名次' in val: rank_idx = c_idx
                    data_start_idx = idx + 1
                    break
                    
            if major_idx == -1 and len(df.columns) >= 4:
                # Fallback
                if len(df.columns) == 5:
                    major_idx, school_idx, plan_idx, rank_idx = 1, 2, 3, 4
                else:
                    major_idx, school_idx, plan_idx, rank_idx = 0, 1, 2, 3

            year_count = 0
            for index in range(data_start_idx, len(df)):
                row = df.iloc[index]
                try:
                    raw_major = str(row[major_idx]) if major_idx != -1 and pd.notna(row[major_idx]) else ""
                    raw_school = str(row[school_idx]) if school_idx != -1 and pd.notna(row[school_idx]) else ""
                    raw_plan = row[plan_idx] if plan_idx != -1 else None
                    raw_rank = row[rank_idx] if rank_idx != -1 else None
                    
                    raw_major = raw_major.strip()
                    raw_school = raw_school.strip()
                    
                    if not raw_major and not raw_school:
                        continue
                        
                    school_code, school_name = parse_code_name(raw_school)
                    major_code, major_name = parse_code_name(raw_major)
                    
                    plan_count = to_int_or_null(raw_plan)
                    min_rank = to_int_or_null(raw_rank)
                    min_score = None # The standard shandong 1st placement table often lacks score
                    
                    if not school_name: report['emptySchoolNameCount'] += 1
                    if not major_name: report['emptyMajorNameCount'] += 1
                    if min_score is None: report['emptyMinScoreCount'] += 1
                    if min_rank is None: report['emptyMinRankCount'] += 1
                    
                    record_id = f"{year}_{school_code}_{major_code}_{index}"
                    if record_id in seen_ids:
                        report['duplicateIdCount'] += 1
                        record_id = f"{record_id}_dup"
                    seen_ids.add(record_id)
                    
                    manifest_info = manifest_data.get(str(year), {})
                    source_url = manifest_info.get('sourcePageUrl', '')
                    note = json.dumps(manifest_info) if manifest_info else ""
                    
                    record = {
                        "id": record_id,
                        "year": year,
                        "province": "山东",
                        "batch": "普通类常规批第1次志愿",
                        "schoolCode": school_code,
                        "schoolName": school_name,
                        "majorCode": major_code,
                        "majorName": major_name,
                        "planCount": plan_count,
                        "minScore": min_score,
                        "minRank": min_rank,
                        "subjectRequirement": "",
                        "note": note,
                        "sourceName": "山东省教育招生考试院",
                        "sourceUrl": source_url,
                        "rawSchoolText": raw_school,
                        "rawMajorText": raw_major,
                        "rawRowIndex": index,
                        "rawValues": [str(x) if pd.notna(x) else "" for x in row.values]
                    }
                    records.append(record)
                    year_count += 1
                    
                except Exception as e:
                    report['parseErrorCount'] += 1
                    report['warnings'].append(f"Row {index} in {file} failed: {str(e)}")
                    
            report['recordsByYear'][str(year)] = year_count
            print(f"  {year}: {year_count} 条")
            
        except Exception as e:
            report['parseErrorCount'] += 1
            report['warnings'].append(f"File {file} failed: {str(e)}")
            print(f"读取文件 {file} 失败: {str(e)}")
            
    report['totalRecords'] = len(records)
    
    for y in ['2023', '2024', '2025']:
        y_records = [r for r in records if str(r['year']) == y]
        report['sampleRecords'].extend(y_records[:3])
        
    print(f"总计: {len(records)} 条")
    print(f"空学校名: {report['emptySchoolNameCount']}")
    print(f"空专业名: {report['emptyMajorNameCount']}")
    print(f"空最低分: {report['emptyMinScoreCount']}")
    print(f"空最低位次: {report['emptyMinRankCount']}")
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(records, f, indent=2, ensure_ascii=False)
        
    with open(public_output_file, 'w', encoding='utf-8') as f:
        json.dump(records, f, indent=2, ensure_ascii=False)
        
    with open(report_file, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

if __name__ == "__main__":
    main()
