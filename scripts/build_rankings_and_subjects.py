import json
import os
import urllib.request
import csv
from io import StringIO
import shutil

# Paths
DATA_PROCESSED_DIR = os.path.join("data", "processed")
PUBLIC_DATA_DIR = os.path.join("public", "data")
METADATA_FILE = os.path.join(DATA_PROCESSED_DIR, "school_metadata.json")
SUBJECT_EVALUATION_FILE = os.path.join(DATA_PROCESSED_DIR, "subject_evaluation.json")
MATCH_REPORT_FILE = os.path.join(DATA_PROCESSED_DIR, "ranking_match_report.json")

# Ensure dirs
os.makedirs(DATA_PROCESSED_DIR, exist_ok=True)
os.makedirs(PUBLIC_DATA_DIR, exist_ok=True)

def normalize_name(name):
    if not name:
        return ""
    name = name.replace(" ", "")
    name = name.replace("（", "(").replace("）", ")")
    return name

def load_metadata():
    if not os.path.exists(METADATA_FILE):
        return []
    with open(METADATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def fetch_url(url, timeout=15):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        return urllib.request.urlopen(req, timeout=timeout).read().decode('utf-8')
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return None

def main():
    metadata = load_metadata()
    school_dict_code = {m["schoolCode"]: m for m in metadata if "schoolCode" in m}
    school_dict_name = {m["schoolName"]: m for m in metadata if "schoolName" in m}
    school_dict_norm = {normalize_name(m["schoolName"]): m for m in metadata if "schoolName" in m}
    
    # We load existing match report to append to it
    if os.path.exists(MATCH_REPORT_FILE):
        with open(MATCH_REPORT_FILE, "r", encoding="utf-8") as f:
            match_report = json.load(f)
    else:
        match_report = {}
        
    match_report["subject_matched_count"] = 0
    match_report["unmatched_subject_schools"] = []
    
    def match_school(name):
        norm = normalize_name(name)
        if name in school_dict_name:
            return school_dict_name[name]
        if norm in school_dict_norm:
            return school_dict_norm[norm]
        
        # Branch campus handling
        if "(" in norm and "分校" not in norm and "校区" not in norm:
             if "branch_campus_risks" not in match_report:
                 match_report["branch_campus_risks"] = []
             if name not in match_report["branch_campus_risks"]:
                 match_report["branch_campus_risks"].append(name)
             
        if "ambiguous_matches" not in match_report:
            match_report["ambiguous_matches"] = []
        if name not in match_report["ambiguous_matches"]:
            match_report["ambiguous_matches"].append(name)
        return None

    subjects_by_school = {}
    
    # Subject Evaluation (Round 4)
    print("Processing Subject Evaluation Round 4...")
    
    csv_url = "https://ghproxy.net/https://raw.githubusercontent.com/Johnnydaszhu/2017ChinaUniversityDisciplineAssessment/master/2017%E6%95%99%E8%82%B2%E9%83%A8%E7%AC%AC%E5%9B%9B%E8%BD%AE%E5%AD%A6%E7%A7%91%E8%AF%84%E4%BC%B0.csv"
    csv_data = fetch_url(csv_url)
    if csv_data:
        if csv_data.startswith('\ufeff'):
            csv_data = csv_data[1:]
        
        reader = csv.reader(StringIO(csv_data))
        header = next(reader)
        
        # Columns: [0]Code, [1]Name, [2]Grade, [3..] School names
        for row in reader:
            if not row or len(row) < 4:
                continue
            subject_code = row[0].strip()
            subject_name = row[1].strip()
            grade = row[2].strip()
            
            for school_name in row[3:]:
                school_name = school_name.strip()
                if not school_name:
                    continue
                
                school = match_school(school_name)
                if school:
                    code = school["schoolCode"]
                    if code not in subjects_by_school:
                        subjects_by_school[code] = {
                            "schoolCode": code,
                            "schoolName": school["schoolName"],
                            "subjects": []
                        }
                    subjects_by_school[code]["subjects"].append({
                        "subjectName": subject_name,
                        "evaluationRound": "第四轮",
                        "grade": grade,
                        "sourceId": "cdgdc_round4",
                        "rawName": school_name
                    })
                else:
                    if school_name not in match_report["unmatched_subject_schools"]:
                        match_report["unmatched_subject_schools"].append(school_name)
    else:
        print("Failed to fetch subject evaluation data.")
        
    # Write files
    match_report["subject_matched_count"] = len(subjects_by_school)
                
    def write_json(path, data):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            
    print("Writing files...")
    write_json(SUBJECT_EVALUATION_FILE, list(subjects_by_school.values()))
    write_json(MATCH_REPORT_FILE, match_report)
    
    shutil.copy2(SUBJECT_EVALUATION_FILE, os.path.join(PUBLIC_DATA_DIR, "subject_evaluation.json"))

    print("Done!")

if __name__ == "__main__":
    main()
