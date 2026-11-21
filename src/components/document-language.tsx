"use client";

import { useEffect } from "react";
import type { Lang } from "@/lib/lang";

export function DocumentLanguage({ lang }: { lang: Lang }) {
  useEffect(() => {
    document.documentElement.lang = lang === "kz" ? "kk" : "ru";
    return () => { document.documentElement.lang = "ru"; };
  }, [lang]);

  return null;
}
