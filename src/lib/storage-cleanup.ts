// Уборка осиротевших фото (задача #30): база находит файлы (storage_orphan_photos), Storage API удаляет.
import type { SupabaseClient } from "@supabase/supabase-js";

const BATCH = 1000;
const REMOVE_CHUNK = 100;

export type CleanupResult = { removed: number; failed: number; complete: boolean };

/**
 * Удаляет пачками, пока база находит сирот или пока не вышло время. Сбой удаления одной пачки не прерывает
 * уборку: эти файлы останутся сиротами и попадут в следующий запуск.
 */
export async function removeOrphanPhotos(db: SupabaseClient, opts: { deadline?: number; maxRounds?: number } = {}): Promise<CleanupResult> {
  const deadline = opts.deadline ?? Date.now() + 50_000;
  const maxRounds = opts.maxRounds ?? 20;
  let removed = 0;
  let failed = 0;
  const skipped = new Set<string>();

  for (let round = 0; round < maxRounds; round++) {
    const { data, error } = await db.rpc("storage_orphan_photos", { p_limit: BATCH });
    if (error) throw new Error(`storage_orphan_photos: ${error.message}`);
    const names = ((data ?? []) as { name: string }[]).map((r) => r.name).filter((n) => !skipped.has(n));
    if (names.length === 0) return { removed, failed, complete: true };

    for (let i = 0; i < names.length; i += REMOVE_CHUNK) {
      const chunk = names.slice(i, i + REMOVE_CHUNK);
      const { error: removeError } = await db.storage.from("product-photos").remove(chunk);
      if (removeError) {
        failed += chunk.length;
        chunk.forEach((n) => skipped.add(n));
      } else {
        removed += chunk.length;
      }
      if (Date.now() > deadline) return { removed, failed, complete: false };
    }
    if ((data ?? []).length < BATCH) return { removed, failed, complete: true };
  }
  return { removed, failed, complete: false };
}
