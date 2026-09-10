"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

const HomeReadyContext = createContext<(ready: boolean) => void>(() => {});

const HomeReadyVisibilityContext = createContext(true);

export function HomeReadyProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [homeReady, setHomeReady] = useState(false);
  const showFriendsDock = pathname !== "/" || homeReady;

  return (
    <HomeReadyContext.Provider value={setHomeReady}>
      <HomeReadyVisibilityContext.Provider value={showFriendsDock}>
        {children}
      </HomeReadyVisibilityContext.Provider>
    </HomeReadyContext.Provider>
  );
}

export function useShowFriendsDock() {
  return useContext(HomeReadyVisibilityContext);
}

export function useReportHomeReady(ready: boolean) {
  const setHomeReady = useContext(HomeReadyContext);
  useLayoutEffect(() => {
    setHomeReady(ready);
    return () => setHomeReady(false);
  }, [ready, setHomeReady]);
}
