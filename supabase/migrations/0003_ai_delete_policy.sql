-- Неудачная ИИ-генерация не должна тратить лимит: владелец может удалить свою запись.
create policy "ai_owner_delete" on public.ai_generations for delete to authenticated
  using (public.owns_shop(shop_id));
