// ─── 专业方向分组数据 (major_direction_groups.json) ─────────────────────────

export interface MajorDirectionGroup {
  id: string;
  name: string;
  keywords?: string[];
  exclude?: string[];
}

// ─── 专业方向索引数据 (major_direction_index.json) ───────────────────────────

export type MajorDirectionFlag =
  | 'cross_discipline'
  | 'needs_review'
  | 'elite_unresolved_major'
  | 'cooperation'
  | 'broad_category'
  | 'experiment_class'
  | 'unclassified'
  | 'campus'
  | 'high_fee';

export interface MajorDirectionIndexEntry {
  majorName: string;
  groups: string[];         // direction IDs, e.g. ["computer"] or ["broad_unspecified"]
  confidence: 'high' | 'medium' | 'low' | 'uncertain';
  flags: MajorDirectionFlag[];
  reason?: string;
  years?: number[];
  count?: number;
  sampleSchools?: string[];
  matchAllMajorGroups: boolean;     // 大类专业，命中所有方向
  showUncertainMajorWarning: boolean;
  eliteSchoolTags?: string[];
  eliteSampleSchools?: string[];
}

/** major_direction_index.json 顶层结构：majorName -> entry */
export type MajorDirectionIndex = Record<string, MajorDirectionIndexEntry>;
