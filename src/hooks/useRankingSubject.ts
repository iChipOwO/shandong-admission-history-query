import { useRankingSubjectContext } from '../context/RankingSubjectContext';
import type { RankingEntry, SchoolRankingData, SubjectEvaluationEntry, MajorSubjectMap } from '../types/ranking';
import { GRADE_ORDER, compareGrades } from '../types/ranking';

// ─── localStorage 偏好 key ───────────────────────────────────────────────────
export const RANK_DISPLAY_PREF_KEY = 'gaokao_rank_display_source';

// 软科2025主榜 sourceId
export const SOFT_SCIENCE_MAIN_SOURCE_ID = 'shanghai_ranking_bcur_2025_11';
// 校友会2025 sourceId
export const ALUMNI_MAIN_SOURCE_ID = 'xiaoyouhui_2025_main_800';

/** 软科分类榜 sourceId 前缀 */
export const SOFT_SCIENCE_PREFIX = 'shanghai_ranking_bcur_2025_';

const normalizeNameForMap = (name: string): string =>
  name.trim().replace(/\s+/g, '');

export interface ResolvedRank {
  rank: number;
  rankDisplay: string;
  sourceId: string;
  sourceName: string;
  year: number;
  category: string;
  sourceConfidence: string;
}

/** auto 逻辑：只展示软科主榜，不自动回退到分类榜 */
function resolveAutoRank(data: SchoolRankingData): ResolvedRank | null {
  const rankings = data.rankings || [];

  // 1. 软科主榜
  const main = rankings.find(
    r => r.sourceId === SOFT_SCIENCE_MAIN_SOURCE_ID && r.rank > 0 && r.rank < 9999
  );
  if (main) return toResolved(main);

  return null;
}

function toResolved(r: RankingEntry): ResolvedRank {
  return {
    rank: r.rank,
    rankDisplay: r.rankDisplay || String(r.rank),
    sourceId: r.sourceId,
    sourceName: r.sourceName,
    year: r.year,
    category: r.category,
    sourceConfidence: r.sourceConfidence,
  };
}

export function useRankingSubject() {
  const ctx = useRankingSubjectContext();

  const getSchoolRankingData = (
    schoolCode?: string | null,
    schoolName?: string | null
  ): SchoolRankingData | undefined => {
    if (schoolCode && ctx.rankingByCode.has(schoolCode)) {
      return ctx.rankingByCode.get(schoolCode);
    }
    if (schoolName) {
      const normalized = normalizeNameForMap(schoolName);
      if (ctx.rankingByName.has(normalized)) {
        return ctx.rankingByName.get(normalized);
      }
    }
    return undefined;
  };

  /** 获取 auto 模式下最佳排名 */
  const getAutoRank = (
    schoolCode?: string | null,
    schoolName?: string | null
  ): ResolvedRank | null => {
    const data = getSchoolRankingData(schoolCode, schoolName);
    if (!data) return null;
    return resolveAutoRank(data);
  };

  /** 获取指定 sourceId 的排名 */
  const getRankForSource = (
    schoolCode?: string | null,
    schoolName?: string | null,
    sourceId?: string
  ): ResolvedRank | null => {
    if (!sourceId) return null;
    const data = getSchoolRankingData(schoolCode, schoolName);
    if (!data) return null;
    const found = data.rankings.find(
      r => r.sourceId === sourceId && r.rank > 0 && r.rank < 9999
    );
    return found ? toResolved(found) : null;
  };

  /** 根据用户偏好获取要展示的排名（用于查询页/报告页小标签） */
  const getDisplayRank = (
    schoolCode?: string | null,
    schoolName?: string | null
  ): ResolvedRank | null => {
    const pref = localStorage.getItem(RANK_DISPLAY_PREF_KEY) ?? 'auto';
    if (pref === 'hidden') return null;
    if (pref === 'auto') return getAutoRank(schoolCode, schoolName);
    // 具体 sourceId
    return getRankForSource(schoolCode, schoolName, pref);
  };

  /** 获取该校全部排名列表 */
  const getAllRankings = (
    schoolCode?: string | null,
    schoolName?: string | null
  ): RankingEntry[] => {
    return getSchoolRankingData(schoolCode, schoolName)?.rankings ?? [];
  };

  /** 获取该校学科评估 */
  const getSubjectEval = (
    schoolCode?: string | null,
    schoolName?: string | null
  ): SubjectEvaluationEntry[] => {
    let data;
    if (schoolCode && ctx.subjectByCode.has(schoolCode)) {
      data = ctx.subjectByCode.get(schoolCode);
    } else if (schoolName) {
      const normalized = normalizeNameForMap(schoolName);
      data = ctx.subjectByName.get(normalized);
    }
    return data?.subjects ?? [];
  };

  /**
   * 根据专业方向 groups 和 major_subject_map，找到该校最佳学科评估等级
   * 返回 { grade, subjectName } 或 null
   */
  const getBestSubjectGradeForDirs = (
    schoolCode: string | null | undefined,
    schoolName: string | null | undefined,
    dirGroups: string[],
    majorSubjectMap: MajorSubjectMap
  ): { grade: string; subjectName: string } | null => {
    const subjects = getSubjectEval(schoolCode, schoolName);
    if (!subjects || subjects.length === 0) return null;

    // 汇总所有相关一级学科
    const candidateSubjects: Array<{ subjectName: string; priority: number }> = [];
    for (const dirId of dirGroups) {
      const mapEntry = majorSubjectMap[dirId];
      if (!mapEntry) continue;
      for (const s of mapEntry.subjects) {
        candidateSubjects.push({ subjectName: s.subjectName, priority: s.priority });
      }
    }
    if (candidateSubjects.length === 0) return null;

    // 建立该校已有评估 map
    const evalMap = new Map<string, string>();
    for (const s of subjects) {
      evalMap.set(s.subjectName, s.grade);
    }

    // 找最高等级（等级相同则看 priority 更小者）
    let best: { grade: string; subjectName: string; priority: number } | null = null;
    for (const cs of candidateSubjects) {
      const grade = evalMap.get(cs.subjectName);
      if (!grade) continue;
      if (!best) {
        best = { grade, subjectName: cs.subjectName, priority: cs.priority };
      } else {
        const cmp = compareGrades(grade, best.grade);
        if (cmp < 0) {
          // 新的等级更高
          best = { grade, subjectName: cs.subjectName, priority: cs.priority };
        } else if (cmp === 0 && cs.priority < best.priority) {
          // 等级相同，priority 更小（更重要）
          best = { grade, subjectName: cs.subjectName, priority: cs.priority };
        }
      }
    }

    return best ? { grade: best.grade, subjectName: best.subjectName } : null;
  };

  return {
    status: ctx.status,
    rankingSources: ctx.rankingSources,
    rankingList: ctx.rankingList,
    subjectList: ctx.subjectList,
    majorSubjectMap: ctx.majorSubjectMap,
    getSchoolRankingData,
    getAutoRank,
    getRankForSource,
    getDisplayRank,
    getAllRankings,
    getSubjectEval,
    getBestSubjectGradeForDirs,
    GRADE_ORDER,
  };
}
