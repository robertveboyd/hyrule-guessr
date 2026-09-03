"use client";

import { useEffect } from "react";

import { fetchExclusiveSessionActive } from "@/lib/auth/fetch-exclusive-session";
import { readSessionId } from "@/lib/auth/session-storage";

export function RedirectIfActiveTab() {
  useEffect(() => {
    if (!readSessionId()) return;

    void fetchExclusiveSessionActive().then((active) => {
      if (active) window.location.replace("/");
    });
  }, []);

  return null;
}
