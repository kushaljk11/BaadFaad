/**
 * @fileoverview Network Online/Offline Status Hook
 * @description Listens to browser network connectivity events to support PWA offline UX.
 *
 * @module hooks/useNetworkStatus
 */

import { useState, useEffect } from 'react';

export default function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
