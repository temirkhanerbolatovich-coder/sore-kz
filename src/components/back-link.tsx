"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BackIcon } from "@/components/icons";

/**
 * Кнопка «Назад»: возвращает туда, откуда пользователь пришёл (история браузера).
 * Если страницу открыли по прямой ссылке и истории нет, ведёт на запасной адрес.
 */
export function BackLink({
  fallback,
  children,
  className = "",
  ariaLabel,
}: {
  fallback: string;
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  const router = useRouter();
  return (
    <Link
      href={fallback}
      className={className}
      aria-label={ariaLabel}
      onClick={(e) => {
        const cameFromHere = document.referrer.startsWith(window.location.origin);
        if (window.history.length > 1 && cameFromHere) {
          e.preventDefault();
          router.back();
        }
      }}
    >
      {children}
    </Link>
  );
}

export function BackArrow() {
  return (
    <BackIcon size={22} />
  );
}
