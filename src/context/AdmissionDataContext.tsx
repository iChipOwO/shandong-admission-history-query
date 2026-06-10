import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { admissionRepository, type AdmissionDataStatus } from '../services/admissionRepository';

interface AdmissionDataContextType {
  status: AdmissionDataStatus;
  retry: () => void;
}

const AdmissionDataContext = createContext<AdmissionDataContextType>({
  status: 'idle',
  retry: () => {}
});

export const AdmissionDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<AdmissionDataStatus>('idle');

  const loadData = () => {
    setStatus('loading');
    admissionRepository.loadAdmissions()
      .then(() => {
        setStatus(admissionRepository.getStatus());
      })
      .catch((err) => {
        console.error(err);
        setStatus('error');
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <AdmissionDataContext.Provider value={{ status, retry: loadData }}>
      {children}
    </AdmissionDataContext.Provider>
  );
};

export const useAdmissionData = () => useContext(AdmissionDataContext);
