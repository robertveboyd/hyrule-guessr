"use client";

import { useEffect, type ReactNode } from "react";

import { fetchExclusiveSessionActive } from "@/lib/auth/fetch-exclusive-session";

export function ExclusiveSessionGate({ children }: { children: ReactNode }) {
  useEffect(() => {
    void fetchExclusiveSessionActive().then((active) => {
      if (!active) window.location.replace("/login");
    });
  }, []);

  return children;
}
