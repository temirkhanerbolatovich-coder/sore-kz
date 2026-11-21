"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Toast } from "@/components/ui/toast";
import { useTr } from "@/components/ui-lang";

/** Подтверждение действия после редиректа (?saved=…). Закрывается само; при закрытии параметр убирается из адреса. */
export function SavedToast({ message }: { message: string }) {
  const router = useRouter();
  const tr = useTr();
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <Toast
      message={message}
      closeLabel={tr("Закрыть", "Жабу")}
      onClose={() => {
        setOpen(false);
        router.replace("/dashboard", { scroll: false });
      }}
    />
  );
}
