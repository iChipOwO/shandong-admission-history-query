import type { AdmissionRecord } from '../types/admission';

export interface GroupedAdmission {
  schoolCode: string;
  schoolName: string;
  majorCode: string;
  majorName: string;
  records: {
    [year: number]: AdmissionRecord;
  };
  latestRecord: AdmissionRecord | null;
}

export function groupRecordsBySchoolMajor(records: AdmissionRecord[]): GroupedAdmission[] {
  const map = new Map<string, GroupedAdmission>();
  
  for (const record of records) {
    const key = `${record.schoolCode}_${record.majorCode}`;
    if (!map.has(key)) {
      map.set(key, {
        schoolCode: record.schoolCode,
        schoolName: record.schoolName,
        majorCode: record.majorCode,
        majorName: record.majorName,
        records: {},
        latestRecord: null
      });
    }
    
    const group = map.get(key)!;
    group.records[record.year] = record;
    
    if (!group.latestRecord || record.year > group.latestRecord.year) {
      group.latestRecord = record;
    }
  }
  
  return Array.from(map.values());
}

export function sortByLatestMinRank(groups: GroupedAdmission[], ascending: boolean = true): GroupedAdmission[] {
  return groups.sort((a, b) => {
    const rankA = a.latestRecord?.minRank || 9999999;
    const rankB = b.latestRecord?.minRank || 9999999;
    return ascending ? rankA - rankB : rankB - rankA;
  });
}

export function formatRankDiff(userRank: number | null, targetRank: number | null): string {
  if (userRank === null || targetRank === null) return '';
  const diff = targetRank - userRank;
  if (diff > 0) {
    return `你比最低位次靠前 ${diff} 名`;
  } else if (diff < 0) {
    return `你比最低位次靠后 ${Math.abs(diff)} 名`;
  } else {
    return `与最低位次持平`;
  }
}
