export interface AdmissionRecord {
  id: string;
  year: number;
  province: string;
  batch: string;
  schoolCode: string;
  schoolName: string;
  majorCode: string;
  majorName: string;
  planCount: number | null;
  minScore: number | null;
  minRank: number | null;
  subjectRequirement: string;
  note: string;
  sourceName: string;
  sourceUrl: string;
}

// 风险 = 录取风险，不是就业风险。它表示考生当前位次相对于该学校+专业往年最低录取位次的危险程度。
export type RiskLevel = '低' | '中低' | '中' | '中高' | '高' | '数据不足';

// 趋势：升温 / 稳定 / 降温 / 波动较大 / 数据不足
export type Trend = '升温' | '稳定' | '降温' | '波动较大' | '数据不足';

// 判断：冲 / 稳中偏冲 / 稳 / 保 / 谨慎参考 / 数据不足
export type Recommendation = '冲' | '稳中偏冲' | '稳' | '保' | '谨慎参考' | '数据不足';

export interface AdmissionAnalysis {
  record: AdmissionRecord;
  hotness: number; // 热度：0-100
  risk: RiskLevel;
  trend: Trend;
  recommendation: Recommendation;
}
