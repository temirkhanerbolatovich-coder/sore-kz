create function public.move_product(p_shop uuid,p_product uuid,p_direction integer)
returns void language plpgsql security definer set search_path = '' as $$
declare v_ids uuid[]; v_pos integer; v_other uuid;
begin
  if not public.owns_shop(p_shop) then raise exception 'unauthorized'; end if;
  if p_direction not in (-1,1) then raise exception 'invalid direction'; end if;
  perform 1 from public.shops where id=p_shop for update;
  select array_agg(id order by sort,created_at,id) into v_ids from public.products where shop_id=p_shop;
  v_pos := array_position(v_ids,p_product);
  if v_pos is null then raise exception 'product unavailable'; end if;
  v_other := v_ids[v_pos+p_direction];
  if v_other is null then return; end if;
  v_ids[v_pos] := v_other;
  v_ids[v_pos+p_direction] := p_product;
  update public.products p set sort=q.n from unnest(v_ids) with ordinality q(id,n) where p.id=q.id;
end $$;
revoke all on function public.move_product(uuid,uuid,integer) from public;
grant execute on function public.move_product(uuid,uuid,integer) to authenticated;
