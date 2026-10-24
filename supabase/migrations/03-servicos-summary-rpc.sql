-- KPIs de Serviços e Adiantamentos calculados no servidor.
-- Rodar manualmente no SQL Editor do Supabase.
-- SECURITY INVOKER: respeita as políticas RLS do usuário logado.
-- Parâmetros de id são text e comparados via ::text para não depender do tipo da coluna (uuid/bigint).

create or replace function public.get_services_summary(
  p_company_id text,
  p_status text default null,
  p_search text default null,
  p_collaborator_id text default null,
  p_project_id text default null,
  p_start_date date default null,
  p_end_date date default null
)
returns table (total_value numeric, total_paid numeric, total_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    coalesce(sum(s.total_value), 0)::numeric as total_value,
    coalesce(sum(coalesce(a.paid, 0)), 0)::numeric as total_paid,
    count(*)::bigint as total_count
  from public.servicos s
  left join lateral (
    select sum(ad.value) as paid
    from public.adiantamentos ad
    where ad.service_id = s.id
  ) a on true
  where s.company_id::text = p_company_id
    and (p_status is null or s.status::text = p_status)
    and (p_search is null or s.description ilike '%' || p_search || '%')
    and (p_collaborator_id is null or s.collaborator_id::text = p_collaborator_id)
    and (p_project_id is null or s.project_id::text = p_project_id)
    and (p_start_date is null or s.start_date >= p_start_date)
    and (p_end_date is null or s.end_date <= p_end_date);
$$;

create or replace function public.get_advances_summary(
  p_company_id text,
  p_search text default null,
  p_collaborator_id text default null,
  p_project_id text default null,
  p_service_id text default null,
  p_from date default null,
  p_to date default null
)
returns table (total_paid numeric, total_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    coalesce(sum(ad.value), 0)::numeric as total_paid,
    count(*)::bigint as total_count
  from public.adiantamentos ad
  join public.servicos s on s.id = ad.service_id
  where ad.company_id::text = p_company_id
    and (p_search is null
         or ad.description ilike '%' || p_search || '%'
         or s.description ilike '%' || p_search || '%')
    and (p_collaborator_id is null or s.collaborator_id::text = p_collaborator_id)
    and (p_project_id is null or s.project_id::text = p_project_id)
    and (p_service_id is null or ad.service_id::text = p_service_id)
    and (p_from is null or ad.payment_date::date >= p_from)
    and (p_to is null or ad.payment_date::date <= p_to);
$$;

grant execute on function public.get_services_summary(text, text, text, text, text, date, date) to authenticated;
grant execute on function public.get_advances_summary(text, text, text, text, text, date, date) to authenticated;
