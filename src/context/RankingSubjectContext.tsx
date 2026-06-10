import React, { createContext, useContext, useEffect, useState } from 'react';
import type {
  SchoolRankingData,
  RankingSource,
  SchoolSubjectEvaluation,
  MajorSubjectMap,
} from '../types/ranking';

export type RankingSubjectStatus = 'idle' | 'loading' | 'ready' | 'error';

interface RankingSubjectContextType {
  status: RankingSubjectStatus;
  /** schoolCode → SchoolRankingData */
  rankingByCode: Map<string, SchoolRankingData>;
  /** normalized schoolName → SchoolRankingData */
  rankingByName: Map<string, SchoolRankingData>;
  /** 所有排名来源 */
  rankingSources: RankingSource[];
  /** schoolCode → SchoolSubjectEvaluation */
  subjectByCode: Map<string, SchoolSubjectEvaluation>;
  /** normalized schoolName → SchoolSubjectEvaluation */
  subjectByName: Map<string, SchoolSubjectEvaluation>;
  /** directionId → MajorSubjectMapEntry */
  majorSubjectMap: MajorSubjectMap;
  /** 原始排名列表（供排名页遍历） */
  rankingList: SchoolRankingData[];
  /** 原始学科评估列表（供学科页遍历） */
  subjectList: SchoolSubjectEvaluation[];
}

const RankingSubjectContext = createContext<RankingSubjectContextType | undefined>(undefined);

const normalizeNameForMap = (name: string): string =>
  name.trim().replace(/\s+/g, '');

export const RankingSubjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<RankingSubjectStatus>('idle');
  const [rankingByCode, setRankingByCode] = useState<Map<string, SchoolRankingData>>(new Map());
  const [rankingByName, setRankingByName] = useState<Map<string, SchoolRankingData>>(new Map());
  const [rankingSources, setRankingSources] = useState<RankingSource[]>([]);
  const [subjectByCode, setSubjectByCode] = useState<Map<string, SchoolSubjectEvaluation>>(new Map());
  const [subjectByName, setSubjectByName] = useState<Map<string, SchoolSubjectEvaluation>>(new Map());
  const [majorSubjectMap, setMajorSubjectMap] = useState<MajorSubjectMap>({});
  const [rankingList, setRankingList] = useState<SchoolRankingData[]>([]);
  const [subjectList, setSubjectList] = useState<SchoolSubjectEvaluation[]>([]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setStatus('loading');
      try {
        const [rankingsRes, sourcesRes, subjectRes, mapRes] = await Promise.all([
          fetch('data/school_rankings.json'),
          fetch('data/ranking_sources.json'),
          fetch('data/subject_evaluation.json'),
          fetch('data/major_subject_map.json'),
        ]);

        if (!rankingsRes.ok) throw new Error(`school_rankings.json: HTTP ${rankingsRes.status}`);
        if (!sourcesRes.ok) throw new Error(`ranking_sources.json: HTTP ${sourcesRes.status}`);
        if (!subjectRes.ok) throw new Error(`subject_evaluation.json: HTTP ${subjectRes.status}`);
        if (!mapRes.ok) throw new Error(`major_subject_map.json: HTTP ${mapRes.status}`);

        const [rankingsData, sourcesData, subjectData, mapData]: [
          SchoolRankingData[],
          RankingSource[],
          SchoolSubjectEvaluation[],
          MajorSubjectMap,
        ] = await Promise.all([
          rankingsRes.json(),
          sourcesRes.json(),
          subjectRes.json(),
          mapRes.json(),
        ]);

        if (!isMounted) return;

        const newRankingByCode = new Map<string, SchoolRankingData>();
        const newRankingByName = new Map<string, SchoolRankingData>();
        for (const item of rankingsData) {
          if (item.schoolCode) newRankingByCode.set(item.schoolCode, item);
          newRankingByName.set(normalizeNameForMap(item.schoolName), item);
        }

        const newSubjectByCode = new Map<string, SchoolSubjectEvaluation>();
        const newSubjectByName = new Map<string, SchoolSubjectEvaluation>();
        for (const item of subjectData) {
          if (item.schoolCode) newSubjectByCode.set(item.schoolCode, item);
          newSubjectByName.set(normalizeNameForMap(item.schoolName), item);
        }

        setRankingList(rankingsData);
        setSubjectList(subjectData);
        setRankingByCode(newRankingByCode);
        setRankingByName(newRankingByName);
        setRankingSources(sourcesData);
        setSubjectByCode(newSubjectByCode);
        setSubjectByName(newSubjectByName);
        setMajorSubjectMap(mapData);
        setStatus('ready');
      } catch (err) {
        console.error('[RankingSubject] Failed to load:', err);
        if (isMounted) setStatus('error');
      }
    };

    load();
    return () => { isMounted = false; };
  }, []);

  return (
    <RankingSubjectContext.Provider value={{
      status,
      rankingByCode,
      rankingByName,
      rankingSources,
      subjectByCode,
      subjectByName,
      majorSubjectMap,
      rankingList,
      subjectList,
    }}>
      {children}
    </RankingSubjectContext.Provider>
  );
};

export const useRankingSubjectContext = () => {
  const ctx = useContext(RankingSubjectContext);
  if (!ctx) throw new Error('useRankingSubjectContext must be used within RankingSubjectProvider');
  return ctx;
};
