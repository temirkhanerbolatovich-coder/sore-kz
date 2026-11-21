"use client";
import { ReportClientError } from "@/components/report-client-error";
import { ErrorState } from "@/components/ui/error-state";
import { useTr } from "@/components/ui-lang";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const tr = useTr();
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto flex max-w-md flex-col gap-4 p-5">
      <ReportClientError error={error} />
      <ErrorState title={tr("Сервис временно недоступен", "Сервис уақытша қолжетімсіз")} description={tr("Не удалось загрузить данные. Проверьте соединение и попробуйте снова.", "Деректерді жүктеу мүмкін болмады. Байланысты тексеріп, қайталап көріңіз.")} retry={reset}>
        {/* Обычная ссылка (полная перезагрузка): надёжнее после сбоя, чем клиентский переход. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="btn-outline">{tr("На главную", "Басты бетке")}</a>
      </ErrorState>
    </main>
  );
}
