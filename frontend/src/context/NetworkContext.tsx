"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { saveLocalDraft, getLocalDraft, removeLocalDraft } from "@/lib/api";

interface NetworkContextType {
  isOnline: boolean;
  wasOffline: boolean;
  offlineSince: Date | null;
  reconnectedAt: Date | null;
  saveDraft: <T>(key: string, data: T) => void;
  getDraft: <T>(key: string) => { data: T; savedAt: string; badge: string } | null;
  removeDraft: (key: string) => void;
}

const NetworkContext = createContext<NetworkContextType>({
  isOnline: true,
  wasOffline: false,
  offlineSince: null,
  reconnectedAt: null,
  saveDraft: () => {},
  getDraft: () => null,
  removeDraft: () => {},
});

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [wasOffline, setWasOffline] = useState<boolean>(false);
  const [offlineSince, setOfflineSince] = useState<Date | null>(null);
  const [reconnectedAt, setReconnectedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      setReconnectedAt(new Date());
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      setOfflineSince(new Date());
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <NetworkContext.Provider
      value={{
        isOnline,
        wasOffline,
        offlineSince,
        reconnectedAt,
        saveDraft: saveLocalDraft,
        getDraft: getLocalDraft,
        removeDraft: removeLocalDraft,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  return useContext(NetworkContext);
}
