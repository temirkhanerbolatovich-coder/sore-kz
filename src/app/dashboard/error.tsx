"use client";
import { ReportClientError } from "@/components/report-client-error";
import { ErrorState } from "@/components/ui/error-state";
import { useTr } from "@/components/ui-lang";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const tr = useTr();
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto flex max-w-md flex-col gap-4 p-5">
      <ReportClientError error={error} />
      <ErrorState
        title={tr("Не удалось загрузить кабинет", "Кабинетті жүктеу мүмкін болмады")}
        description={tr("Проверьте соединение и повторите попытку. Если ошибка сохраняется, выйдите и войдите снова.", "Байланысты тексеріп, қайталап көріңіз. Қате қайталанса, шығып, қайта кіріңіз.")}
        retry={reset}
      >
        {/* Полная перезагрузка после сбоя надёжнее клиентского перехода. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/dashboard" className="btn-outline">{tr("В кабинет", "Кабинетке")}</a>
        <form action="/auth/signout" method="post">
          <button type="submit" className="min-h-11 px-3 text-sm font-semibold text-muted underline">{tr("Выйти из аккаунта", "Аккаунттан шығу")}</button>
        </form>
      </ErrorState>
    </main>
  );
}
