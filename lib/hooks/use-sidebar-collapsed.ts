"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "orbit.sidebar.collapsed";

function readCollapsedPreference() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(STORAGE_KEY) === "true";
}

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setCollapsed(readCollapsedPreference());
      setReady(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  };

  return { collapsed, toggleCollapsed, ready };
}
