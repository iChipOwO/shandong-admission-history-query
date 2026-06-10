import React, { createContext, useContext, useEffect, useState } from 'react';
import type { MajorDirectionGroup, MajorDirectionIndex } from '../types/majorDirection';

export type MajorDirectionStatus = 'idle' | 'loading' | 'ready' | 'error';

interface MajorDirectionContextType {
  status: MajorDirectionStatus;
  groups: MajorDirectionGroup[];        // 具体方向列表（不含 broad_unspecified）
  allGroups: MajorDirectionGroup[];     // 含 broad_unspecified 的完整列表
  index: MajorDirectionIndex;           // majorName -> entry
  getEntry: (majorName: string) => MajorDirectionIndex[string] | undefined;
}

const MajorDirectionContext = createContext<MajorDirectionContextType | undefined>(undefined);

export const MajorDirectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<MajorDirectionStatus>('idle');
  const [allGroups, setAllGroups] = useState<MajorDirectionGroup[]>([]);
  const [index, setIndex] = useState<MajorDirectionIndex>({});

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setStatus('loading');
      try {
        const [groupsRes, indexRes] = await Promise.all([
          fetch('data/major_direction_groups.json'),
          fetch('data/major_direction_index.json'),
        ]);
        if (!groupsRes.ok) throw new Error(`major_direction_groups.json: HTTP ${groupsRes.status}`);
        if (!indexRes.ok) throw new Error(`major_direction_index.json: HTTP ${indexRes.status}`);

        const [groupsData, indexData] = await Promise.all([
          groupsRes.json(),
          indexRes.json(),
        ]);

        if (isMounted) {
          setAllGroups(groupsData);
          setIndex(indexData);
          setStatus('ready');
        }
      } catch (err) {
        console.error('[MajorDirection] Failed to load:', err);
        if (isMounted) setStatus('error');
      }
    };

    load();
    return () => { isMounted = false; };
  }, []);

  // 过滤掉 broad_unspecified 作为普通方向
  const groups = allGroups.filter(g => g.id !== 'broad_unspecified');

  const getEntry = (majorName: string) => index[majorName];

  return (
    <MajorDirectionContext.Provider value={{ status, groups, allGroups, index, getEntry }}>
      {children}
    </MajorDirectionContext.Provider>
  );
};

export const useMajorDirection = () => {
  const ctx = useContext(MajorDirectionContext);
  if (!ctx) throw new Error('useMajorDirection must be used within MajorDirectionProvider');
  return ctx;
};
