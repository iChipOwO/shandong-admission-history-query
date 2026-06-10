import React, { createContext, useContext, useEffect, useState } from 'react';
import type { SchoolMetadata } from '../data/schoolMetadata';
import { normalizeSchoolName } from '../utils/schoolMetadata';

export type MetadataStatus = 'idle' | 'loading' | 'ready' | 'error';

interface SchoolMetadataContextType {
  status: MetadataStatus;
  metadataList: SchoolMetadata[];
  getSchoolMetadata: (schoolCode?: string | null, schoolName?: string | null) => SchoolMetadata | undefined;
}

const SchoolMetadataContext = createContext<SchoolMetadataContextType | undefined>(undefined);

export const SchoolMetadataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<MetadataStatus>('idle');
  const [metadataList, setMetadataList] = useState<SchoolMetadata[]>([]);
  const [codeMap, setCodeMap] = useState<Map<string, SchoolMetadata>>(new Map());
  const [nameMap, setNameMap] = useState<Map<string, SchoolMetadata>>(new Map());

  useEffect(() => {
    let isMounted = true;
    const loadMetadata = async () => {
      try {
        setStatus('loading');
        const res = await fetch('data/school_metadata.json');
        if (!res.ok) throw new Error('Failed to fetch school metadata');
        const data: SchoolMetadata[] = await res.json();
        
        if (isMounted) {
          setMetadataList(data);
          
          const newCodeMap = new Map<string, SchoolMetadata>();
          const newNameMap = new Map<string, SchoolMetadata>();
          
          data.forEach(item => {
            if (item.schoolCode) {
              newCodeMap.set(item.schoolCode, item);
            }
            newNameMap.set(normalizeSchoolName(item.schoolName), item);
          });
          
          setCodeMap(newCodeMap);
          setNameMap(newNameMap);
          setStatus('ready');
        }
      } catch (err) {
        console.error(err);
        if (isMounted) {
          setStatus('error');
        }
      }
    };

    loadMetadata();

    return () => {
      isMounted = false;
    };
  }, []);

  const getSchoolMetadata = (schoolCode?: string | null, schoolName?: string | null): SchoolMetadata | undefined => {
    if (schoolCode && codeMap.has(schoolCode)) {
      return codeMap.get(schoolCode);
    }
    if (schoolName) {
      const normalized = normalizeSchoolName(schoolName);
      if (nameMap.has(normalized)) {
        return nameMap.get(normalized);
      }
    }
    return undefined;
  };

  return (
    <SchoolMetadataContext.Provider value={{ status, metadataList, getSchoolMetadata }}>
      {children}
    </SchoolMetadataContext.Provider>
  );
};

export const useSchoolMetadataContext = () => {
  const context = useContext(SchoolMetadataContext);
  if (!context) {
    throw new Error('useSchoolMetadataContext must be used within a SchoolMetadataProvider');
  }
  return context;
};
