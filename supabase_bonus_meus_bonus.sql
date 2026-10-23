-- Aba "Meus Bônus" do Kaizen Flow (projeto kaizen-saas).
--
-- Os PDFs dos bônus ficam no bucket PRIVADO "bonus" (gerados em
-- bonus/gerar-pdfs.sh, subidos pelo Dashboard com os mesmos nomes). O painel
-- pede um link temporário (createSignedUrl), e o Storage só gera esse link
-- se a política abaixo liberar o arquivo para o plano da empresa logada:
--   bonus-1-*  todos os planos
--   bonus-2-*  intermediario e completo
--   bonus-3-*  completo
-- Só o dono (role 'admin') de uma empresa ativa ou em trial baixa; o
-- super_admin vê tudo. Mesma regra de plano do front (tenant/MeusBonus.jsx).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bonus', 'bonus', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

create or replace function private.bonus_liberado(p_nome text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select private.eh_super_admin() or exists (
    select 1
      from public.usuarios u
      join public.empresas e on e.id = u.empresa_id
     where u.id = auth.uid()
       and u.role = 'admin'
       and e.status in ('ativo', 'trial')
       and case
             when p_nome like 'bonus-1-%' then true
             when p_nome like 'bonus-2-%' then e.plano in ('intermediario', 'completo')
             when p_nome like 'bonus-3-%' then e.plano = 'completo'
             else false
           end
  );
$$;

grant execute on function private.bonus_liberado(text) to authenticated;

drop policy if exists bonus_leitura_por_plano on storage.objects;
create policy bonus_leitura_por_plano
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'bonus' and private.bonus_liberado(name));
