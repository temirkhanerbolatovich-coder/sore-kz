import type { ReactNode } from "react";

/** Объясняет пустой результат и предлагает следующее действие. */
export function EmptyState({ icon, title, description, action }: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-3 p-5 text-center">
      <span className="icon-badge" aria-hidden="true">{icon}</span>
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="leading-relaxed text-muted">{description}</p>
      {action}
    </div>
  );
}
