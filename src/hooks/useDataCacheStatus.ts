import { useState, useEffect, useCallback } from 'react';

interface DataCacheStatus {
  admissions: boolean;
  schoolMetadata: boolean;
  dataManifest: boolean;
  checked: boolean;
}

/**
 * Checks whether the large data files are already cached in the Service Worker.
 * Uses the MessageChannel API to communicate with the SW.
 */
export function useDataCacheStatus(): DataCacheStatus {
  const [cacheStatus, setCacheStatus] = useState<DataCacheStatus>({
    admissions: false,
    schoolMetadata: false,
    dataManifest: false,
    checked: false,
  });

  const check = useCallback(async () => {
    if (!('serviceWorker' in navigator)) {
      setCacheStatus(prev => ({ ...prev, checked: true }));
      return;
    }

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        setCacheStatus(prev => ({ ...prev, checked: true }));
        return;
      }

      const target = navigator.serviceWorker.controller ?? registration.active;

      if (!target) {
        setCacheStatus(prev => ({ ...prev, checked: true }));
        return;
      }

      const channel = new MessageChannel();
      const timeout = window.setTimeout(() => {
        channel.port1.close();
        setCacheStatus(prev => ({ ...prev, checked: true }));
      }, 2500);

      channel.port1.onmessage = (event) => {
        window.clearTimeout(timeout);
        channel.port1.close();

        if (event.data?.type === 'DATA_CACHE_STATUS') {
          const s = event.data.status as Record<string, boolean>;
          setCacheStatus({
            admissions: !!s['data/admissions_shandong_2023_2025.json'],
            schoolMetadata: !!s['data/school_metadata.json'],
            dataManifest: !!s['data/data_manifest.json'],
            checked: true,
          });
        } else {
          setCacheStatus(prev => ({ ...prev, checked: true }));
        }
      };

      target.postMessage(
        { type: 'CHECK_DATA_CACHE' },
        [channel.port2]
      );
    } catch {
      setCacheStatus(prev => ({ ...prev, checked: true }));
    }
  }, []);

  useEffect(() => {
    // Wait briefly for SW to be ready before querying
    const timer = setTimeout(check, 800);
    return () => clearTimeout(timer);
  }, [check]);

  return cacheStatus;
}
