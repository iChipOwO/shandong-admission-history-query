export interface AdmissionSearchFilters {
  keyword?: string;
  schoolKeyword?: string;
  majorKeyword?: string;
  /** @deprecated 旧字段，已被 selectedMajorDirectionIds 替代，保留以兼容旧状态 */
  selectedMajorGroups?: string[];
  selectedMajorTerms?: string[];
  cityKeywords?: string[];
  /** 新专业方向筛选：选中的方向 ID 列表（来自 major_direction_index.json 的 groups 字段） */
  selectedMajorDirectionIds?: string[];
  /** 是否显示未明确归属的大类/试验班（broad_unspecified / needs_review / showUncertainMajorWarning）*/
  showUncertainMajorDirections?: boolean;
  rankMin?: number | null;
  rankMax?: number | null;
  rankExpandPercent?: number; // 默认 10
  onlyFavorites?: boolean;
  includeSinoForeign?: boolean;
  includeHighFee?: boolean;
  includeRemoteCampus?: boolean;
  selectedSchoolTags?: string[];
  showCityUnconfirmed?: boolean;
  // 精确选择器字段（优先级高于 schoolKeyword / cityKeywords）
  selectedSchoolCodes?: string[];   // 精确学校 Code 列表，空/undefined = 不限制
  selectedCities?: string[];        // 精确城市 key 列表：province::city（来自 school_metadata），空/undefined = 不限制
}

export interface AdmissionSearchResult {
  groups: any[]; // we'll use GroupedAdmission here
  totalMatched: number;
}
