import { getUiLang, tr } from "@/lib/ui-lang";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiConfigured, generateCard } from "@/lib/ai-providers";
import { loadOwnedPhoto, reserveAi, shopCategories } from "@/lib/ai-request";

export const maxDuration = 60;

const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

export async function POST(request: Request) {
  const lang = await getUiLang();
  const t = (ru: string, kz: string) => tr(lang, ru, kz);
  if (!aiConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return fail(503, t("ИИ пока не настроен. Заполните карточку вручную.", "ЖИ әлі бапталмаған. Карточканы қолмен толтырыңыз."));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail(401, t("Войдите в аккаунт.", "Аккаунтқа кіріңіз."));

  const { data: shop } = await supabase.from("shops").select("id").eq("owner_id", user.id).maybeSingle();
  if (!shop) return fail(404, t("Сначала создайте магазин.", "Алдымен дүкен ашыңыз."));

  const body = (await request.json().catch(() => null)) as { photo_url?: string; categories?: unknown } | null;
  const loaded = await loadOwnedPhoto(supabase, user.id, body?.photo_url ?? "", t("Сначала загрузите фото товара.", "Алдымен тауар фотосын жүктеңіз."), lang);
  if (!loaded.ok) return fail(loaded.status, loaded.error);
  const { photo } = loaded;

  const quota = await reserveAi(supabase, shop.id, t("заполните карточку вручную", "карточканы қолмен толтырыңыз"), lang);
  if (!quota.ok) return fail(quota.status, quota.error);

  try {
    const bytes = Buffer.from(await photo.arrayBuffer());
    // Категории, уже выбранные ИИ для соседних фото одной партии, помогают держать их единообразными.
    const extra = Array.isArray(body?.categories) ? body.categories.filter((c): c is string => typeof c === "string").map((c) => c.slice(0, 60)).slice(0, 20) : [];
    const categories = [...new Set([...(await shopCategories(supabase, shop.id)), ...extra])];
    const { card, provider, kzDropped } = await generateCard({ base64: bytes.toString("base64"), mime: photo.type, categories });
    console.info("ai-card ok", provider);

    return NextResponse.json({ card, provider: provider.split(":")[0], kzDropped, remaining: quota.remaining });
  } catch (e) {
    console.error("ai-card failed:", e instanceof Error ? e.message : e);
    await quota.release();
    return fail(502, t("ИИ не смог разобрать фото. Попробуйте ещё раз или заполните вручную.", "ЖИ фотоны талдай алмады. Қайталап көріңіз немесе қолмен толтырыңыз."));
  }
}
