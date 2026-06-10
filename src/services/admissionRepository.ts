import type { AdmissionRecord } from '../types/admission';
import type { AdmissionSearchFilters, AdmissionSearchResult } from '../types/search';
import { groupRecordsBySchoolMajor, sortByLatestMinRank } from '../utils/admissionGrouping';
import type { MajorDirectionIndex } from '../types/majorDirection';

import type { SchoolMetadata } from '../data/schoolMetadata';

const CITY_KEY_SEPARATOR = '::';

function getCityKey(province?: string, city?: string): string | null {
  if (!province || !city) return null;
  return `${province}${CITY_KEY_SEPARATOR}${city}`;
}

export type AdmissionDataStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface AdmissionRepository {
  loadAdmissions(): Promise<void>;
  getStatus(): AdmissionDataStatus;
  getAllRecords(): AdmissionRecord[];
  searchRecords(
    filters: AdmissionSearchFilters, 
    getSchoolMetadata?: (schoolCode?: string | null, schoolName?: string | null) => SchoolMetadata | undefined,
    majorDirectionIndex?: MajorDirectionIndex
  ): Promise<AdmissionSearchResult>;
  
  // deprecated explicit methods (keep temporarily for compatibility)
  getAdmissionsBySchool(schoolName: string): Promise<AdmissionRecord[]>;
  getAdmissionsByMajor(majorName: string): Promise<AdmissionRecord[]>;
}

export class LocalAdmissionRepository implements AdmissionRepository {
  private data: AdmissionRecord[] = [];
  private status: AdmissionDataStatus = 'idle';
  private loadPromise: Promise<void> | null = null;

  async loadAdmissions(): Promise<void> {
    if (this.status === 'ready') return Promise.resolve();
    if (this.loadPromise) return this.loadPromise;

    this.status = 'loading';
    this.loadPromise = fetch('data/admissions_shandong_2023_2025.json')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then((json: AdmissionRecord[]) => {
        this.data = json;
        this.status = 'ready';
      })
      .catch(e => {
        console.error("Failed to load admissions data:", e);
        this.status = 'error';
        throw e;
      })
      .finally(() => {
        this.loadPromise = null;
      });

    return this.loadPromise;
  }

  getStatus(): AdmissionDataStatus {
    return this.status;
  }

  getAllRecords(): AdmissionRecord[] {
    return this.data;
  }

  async searchRecords(
    filters: AdmissionSearchFilters,
    getSchoolMetadata?: (schoolCode?: string | null, schoolName?: string | null) => SchoolMetadata | undefined,
    majorDirectionIndex?: MajorDirectionIndex
  ): Promise<AdmissionSearchResult> {
    if (this.status !== 'ready') {
      throw new Error("Admission data is not ready.");
    }

    let result = this.data;

    // keyword matches both school and major
    if (filters.keyword) {
      const kw = filters.keyword.toLowerCase();
      result = result.filter(r => 
        (r.schoolName && r.schoolName.toLowerCase().includes(kw)) ||
        (r.majorName && r.majorName.toLowerCase().includes(kw))
      );
    }

    if (filters.schoolKeyword) {
      const kw = filters.schoolKeyword.toLowerCase();
      result = result.filter(r => r.schoolName && r.schoolName.toLowerCase().includes(kw));
    }

    // 精确学校筛选（优先 schoolCode，fallback schoolName 精确匹配）
    if (filters.selectedSchoolCodes && filters.selectedSchoolCodes.length > 0) {
      const codeSet = new Set(filters.selectedSchoolCodes);
      // Build name lookup: code -> schoolName from metadata for fallback
      const nameSet = new Set<string>();
      if (getSchoolMetadata) {
        for (const code of filters.selectedSchoolCodes) {
          const meta = getSchoolMetadata(code, null);
          if (meta?.schoolName) nameSet.add(meta.schoolName);
        }
      }
      result = result.filter(r => {
        if (r.schoolCode && codeSet.has(r.schoolCode)) return true;
        if (!r.schoolCode && r.schoolName && nameSet.has(r.schoolName)) return true;
        return false;
      });
    }

    if (filters.majorKeyword) {
      const kw = filters.majorKeyword.toLowerCase();
      result = result.filter(r => r.majorName && r.majorName.toLowerCase().includes(kw));
    }

    // ─── 新专业方向筛选（基于 major_direction_index.json）─────────────────
    if (
      filters.selectedMajorDirectionIds &&
      filters.selectedMajorDirectionIds.length > 0 &&
      majorDirectionIndex &&
      Object.keys(majorDirectionIndex).length > 0
    ) {
      const selectedIds = new Set(filters.selectedMajorDirectionIds);
      const showUncertain = filters.showUncertainMajorDirections === true;
      const majorKwLower = (filters.majorKeyword || '').trim().toLowerCase();

      result = result.filter(r => {
        const name = r.majorName || '';
        const entry = majorDirectionIndex[name];
        const isMajorNameMatched = Boolean(majorKwLower && name.toLowerCase().includes(majorKwLower));

        if (!entry) {
          // 没有索引记录：不在方向内，不显示
          return false;
        }

        // matchAllMajorGroups：大类专业，命中所有方向，直接通过
        if (entry.matchAllMajorGroups) return true;

        // broad_unspecified / needs_review / showUncertainMajorWarning：由开关控制
        const isBroadUnspecified = entry.groups.includes('broad_unspecified');
        const isNeedsReview = entry.flags.includes('needs_review');
        const isUncertain = entry.showUncertainMajorWarning;
        if (isBroadUnspecified || isNeedsReview || isUncertain) {
          return showUncertain;
        }

        // 普通 unclassified：默认不显示；专业名称明确命中时允许展示
        if (entry.flags.includes('unclassified') && entry.groups.length === 0) {
          return isMajorNameMatched;
        }

        // 检查 groups 与 selectedIds 是否有交集
        return entry.groups.some(g => selectedIds.has(g));
      });
    }

    if (filters.cityKeywords && filters.cityKeywords.length > 0) {
      result = result.filter(r => {
        const meta = getSchoolMetadata ? getSchoolMetadata(r.schoolCode, r.schoolName) : undefined;
        const city = meta?.city;
        if (!city) return true; // Do not filter out schools without city data yet
        return filters.cityKeywords!.some(kw => city.includes(kw));
      });
    }

    // 精确城市筛选（来自 school_metadata 的 province::city，精确匹配）
    if (filters.selectedCities && filters.selectedCities.length > 0) {
      const citySet = new Set(filters.selectedCities);
      result = result.filter(r => {
        const meta = getSchoolMetadata ? getSchoolMetadata(r.schoolCode, r.schoolName) : undefined;
        const cityKey = getCityKey(meta?.province, meta?.city);
        if (!cityKey) {
          return filters.showCityUnconfirmed === true;
        }
        if (meta?.cityConfirmed === false && filters.showCityUnconfirmed === true) {
          return true;
        }
        return citySet.has(cityKey);
      });
    }

    if (filters.selectedSchoolTags && filters.selectedSchoolTags.length > 0) {
      result = result.filter(r => {
        const meta = getSchoolMetadata ? getSchoolMetadata(r.schoolCode, r.schoolName) : undefined;
        if (!meta) return true; // keep if no metadata
        const tags = meta.schoolTypeTags || [];
        // must contain ALL selected tags
        return filters.selectedSchoolTags!.every(tag => tags.includes(tag));
      });
    }

    if (filters.showCityUnconfirmed === false) {
      result = result.filter(r => {
        const meta = getSchoolMetadata ? getSchoolMetadata(r.schoolCode, r.schoolName) : undefined;
        if (!meta) return true;
        return meta.cityConfirmed !== false;
      });
    }

    // Now group the filtered records
    const grouped = groupRecordsBySchoolMajor(result);

    // Apply rank filters to the groups
    let filteredGroups = grouped;
    const hasRankMin = filters.rankMin !== undefined && filters.rankMin !== null;
    const hasRankMax = filters.rankMax !== undefined && filters.rankMax !== null;
    if (hasRankMin || hasRankMax) {
      let rMin = hasRankMin ? filters.rankMin! : 1;
      let rMax = hasRankMax ? filters.rankMax! : 9999999;
      
      const expand = filters.rankExpandPercent !== undefined ? filters.rankExpandPercent : 10;
      
      // Expand limits
      const expandedMin = Math.max(1, Math.floor(rMin * (1 - expand / 100)));
      const expandedMax = Math.floor(rMax * (1 + expand / 100));

      filteredGroups = filteredGroups.filter(g => {
        const rank = g.latestRecord?.minRank;
        if (rank === null || rank === undefined) return false;
        return rank >= expandedMin && rank <= expandedMax;
      });
    }
    
    // Sort
    const sortedGroups = sortByLatestMinRank(filteredGroups, true);

    return {
      groups: sortedGroups,
      totalMatched: sortedGroups.length
    };
  }

  async getAdmissionsBySchool(schoolName: string): Promise<AdmissionRecord[]> {
    if (!schoolName.trim() || this.status !== 'ready') return [];
    return this.data.filter(r => r.schoolName && r.schoolName.includes(schoolName));
  }

  async getAdmissionsByMajor(majorName: string): Promise<AdmissionRecord[]> {
    if (!majorName.trim() || this.status !== 'ready') return [];
    return this.data.filter(r => r.majorName && r.majorName.includes(majorName));
  }
}

export const admissionRepository = new LocalAdmissionRepository();
