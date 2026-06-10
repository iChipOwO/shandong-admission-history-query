// ─── 学校排名数据类型 ──────────────────────────────────────────────────────────

export interface RankingEntry {
  sourceId: string;
  sourceName: string;
  year: number;
  category: string;
  rank: number;
  rankDisplay: string;
  score?: number;
  rawName?: string;
  star?: string;
  level?: string;
  sourceStatus: string;
  sourceConfidence: 'official' | 'secondary_mirror' | string;
  sourceUrl?: string;
}

export interface SchoolRankingData {
  schoolCode: string;
  schoolName: string;
  province?: string;
  city?: string;
  schoolTypeTags?: string[];
  rankings: RankingEntry[];
  rankingCoverage: {
    hasAnyRanking: boolean;
    sourceCount: number;
  };
  missingReason?: string;
}

export interface RankingSource {
  sourceId: string;
  sourceName: string;
  type: string;
  year: number;
  category: string;
  sourceUrl?: string;
  status: string;
  recordCount?: number;
  matchedCount?: number;
  sourceConfidence: 'official' | 'secondary_mirror' | string;
  originalSourceName?: string;
  coverageNote?: string;
  note?: string;
}

// ─── 学科评估数据类型 ──────────────────────────────────────────────────────────

export interface SubjectEvaluationEntry {
  subjectName: string;
  evaluationRound: string;
  grade: string;
  sourceId: string;
  rawName?: string;
}

export interface SchoolSubjectEvaluation {
  schoolCode: string;
  schoolName: string;
  subjects: SubjectEvaluationEntry[];
}

// ─── 专业方向→学科映射类型 ────────────────────────────────────────────────────

export interface MajorSubjectItem {
  subjectName: string;
  priority: number;
  note?: string;
}

export interface MajorSubjectMapEntry {
  directionName: string;
  subjects: MajorSubjectItem[];
}

export type MajorSubjectMap = Record<string, MajorSubjectMapEntry>;

// ─── 等级排序 ─────────────────────────────────────────────────────────────────

export const GRADE_ORDER = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-'] as const;
export type Grade = typeof GRADE_ORDER[number];

export function compareGrades(a: string, b: string): number {
  const ai = GRADE_ORDER.indexOf(a as Grade);
  const bi = GRADE_ORDER.indexOf(b as Grade);
  if (ai === -1 && bi === -1) return 0;
  if (ai === -1) return 1;
  if (bi === -1) return -1;
  return ai - bi;
}
