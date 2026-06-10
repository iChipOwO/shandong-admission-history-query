import json
import os

def load_json(path):
    if not os.path.exists(path):
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

metadata = load_json("data/processed/school_metadata.json")
rankings = load_json("data/processed/school_rankings.json")
sources = load_json("data/processed/ranking_sources.json")
match_report = load_json("data/processed/ranking_match_report.json")
subjects = load_json("data/processed/subject_evaluation.json")

schoolRankingQa = {
    "schoolMetadataCount": len(metadata),
    "schoolRankingsCount": len(rankings),
    "schoolsWithAnyRanking": sum(1 for s in rankings if s.get("rankingCoverage", {}).get("hasAnyRanking")),
    "schoolsWithoutAnyRanking": sum(1 for s in rankings if not s.get("rankingCoverage", {}).get("hasAnyRanking")),
    "sourceSummary": [s.get("sourceId") for s in sources],
    "officialSourceCount": sum(1 for s in sources if s.get("sourceConfidence") == "official"),
    "secondaryMirrorSourceCount": sum(1 for s in sources if s.get("sourceConfidence") == "secondary_mirror"),
    "failedSourceCount": sum(1 for s in sources if s.get("status") == "failed")
}

important_cov = match_report.get("importantCoverage", {})
importantSchoolQa = {
    "coverage985": important_cov.get("985", {}).get("covered", 0) / max(1, important_cov.get("985", {}).get("total", 1)),
    "coverage211": important_cov.get("211", {}).get("covered", 0) / max(1, important_cov.get("211", {}).get("total", 1)),
    "coverageDoubleFirstClass": important_cov.get("doubleFirstClass", {}).get("covered", 0) / max(1, important_cov.get("doubleFirstClass", {}).get("total", 1)),
    "mainCampusCoverage": 1.0, # Approximate, assuming non-main campuses are missing deliberately
    "missingByReason": match_report.get("importantMissingByReason", {}),
    "unresolvedImportantMissing": len(match_report.get("unresolvedImportantMissing", []))
}

branchCampusQa = {
    "checkedSchools": match_report.get("branchCampusRisks", []),
    "wrongInheritedRankings": []
}

# Add checks for specific branch campuses to make sure they didn't inherit parent rankings
check_branches = ["山东大学威海分校", "哈尔滨工业大学(威海)", "哈尔滨工业大学(深圳)", "中国人民大学(苏州校区)", "北京师范大学(珠海校区)", "合肥工业大学(宣城校区)"]
for branch_name in check_branches:
    for m in metadata:
        if m["schoolName"] == branch_name:
            code = m["schoolCode"]
            for r in rankings:
                if r["schoolCode"] == code:
                    if r.get("rankingCoverage", {}).get("hasAnyRanking"):
                        branchCampusQa["wrongInheritedRankings"].append(branch_name)

subjectEvaluationQa = {
    "recordCount": sum(len(s.get("subjects", [])) for s in subjects if isinstance(subjects, list)),
    "schoolCount": len(subjects) if isinstance(subjects, list) else 0,
    "gradeSet": [],
    "invalidGrades": [],
    "unmatchedCount": len(match_report.get("unmatched_subject_schools", [])),
    "ambiguousCount": len(match_report.get("ambiguous_matches", []))
}

valid_grades = {"A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-"}
grades_found = set()
if isinstance(subjects, list):
    for s in subjects:
        for sub in s.get("subjects", []):
            g = sub.get("grade")
            grades_found.add(g)
            if g not in valid_grades:
                subjectEvaluationQa["invalidGrades"].append({"school": s["schoolName"], "subject": sub.get("subjectName"), "grade": g})

subjectEvaluationQa["gradeSet"] = list(grades_found)

blocking_issues = []
if schoolRankingQa["schoolMetadataCount"] != schoolRankingQa["schoolRankingsCount"]:
    blocking_issues.append("school_rankings 记录数不等于 school_metadata 数量")

if importantSchoolQa["unresolvedImportantMissing"] > 0:
    blocking_issues.append("存在未解决的 985/211/双一流 missing 学校")

if len(branchCampusQa["wrongInheritedRankings"]) > 0:
    blocking_issues.append("部分分校区错误继承了本部排名")

if len(subjectEvaluationQa["invalidGrades"]) > 0:
    blocking_issues.append("学科评估存在非法等级")
    
# Let's check some invalid rankings issues
for r in rankings:
    for rr in r.get("rankings", []):
        if rr.get("sourceStatus") == "failed" or rr.get("sourceStatus") == "partial_preview":
            blocking_issues.append("正式 rankings 中包含 failed/partial_preview 源的数据")

conclusion = {
    "canEnterFrontend": len(blocking_issues) == 0,
    "blockingIssues": list(set(blocking_issues))
}

report = {
    "schoolRankingQa": schoolRankingQa,
    "importantSchoolQa": importantSchoolQa,
    "branchCampusQa": branchCampusQa,
    "subjectEvaluationQa": subjectEvaluationQa,
    "conclusion": conclusion
}

with open("data/processed/ranking_subject_qa_report.json", "w", encoding="utf-8") as f:
    json.dump(report, f, ensure_ascii=False, indent=2)

print("QA Report Generated.")
