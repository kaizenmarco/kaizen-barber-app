-- ============================================================================
-- Kaizen Flow — cupons de indicação + acompanhamento de descontos
-- (mesma regra de ../20261121_cupons_indicacao.sql, por empresa)
--   Quem indica ganha cupom quando o amigo faz a 1ª visita:
--   40% → 30% → 20% → 10% (mínimo); a escada zera se passar
--   validade_cupom_dias (21) desde a última indicação.
-- ============================================================================

alter table public.config_fidelidade
  add column if not exists indicacao_pct_inicial int not null default 40 check (indicacao_pct_inicial between 0 and 100),
  add column if not exists indicacao_reducao_pct int not null default 10 check (indicacao_reducao_pct between 0 and 100),
  add column if not exists indicacao_minimo_pct int not null default 10 check (indicacao_minimo_pct between 0 and 100);

create table if not exists public.cupons_fidelidade (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  tipo text not null default 'indicacao' check (tipo in ('indicacao')),
  pct int not null check (pct between 1 and 100),
  degrau int not null default 0,
  indicado_cliente_id uuid references public.clientes(id) on delete set null,
  criado_em timestamptz not null default now(),
  expira_em date not null,
  usado_em timestamptz
);
create index if not exists cupons_fidelidade_cliente_idx on public.cupons_fidelidade (cliente_id);
create index if not exists cupons_fidelidade_empresa_idx on public.cupons_fidelidade (empresa_id);
alter table public.cupons_fidelidade enable row level security;
drop policy if exists empresa_acesso on public.cupons_fidelidade;
create policy empresa_acesso on public.cupons_fidelidade for all to authenticated
  using (private.fidelidade_eh_da_empresa(empresa_id)) with check (private.fidelidade_eh_da_empresa(empresa_id));

alter table public.agendamentos add column if not exists cupom_fidelidade_id uuid
  references public.cupons_fidelidade(id) on delete set null;
create index if not exists agendamentos_cupom_fidelidade_idx on public.agendamentos (cupom_fidelidade_id)
  where cupom_fidelidade_id is not null;

create or replace function private.fidelidade_config_json(p_empresa_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('ativo', ativo, 'meta_selos', meta_selos, 'selo_brinde', selo_brinde,
    'desconto_pct', desconto_primeira_visita_pct, 'validade_cupom_dias', validade_cupom_dias,
    'selos_boas_vindas', selos_boas_vindas, 'indicacao_pct', indicacao_pct_inicial,
    'brinde', jsonb_build_object('pt', brinde_pt, 'en', brinde_en, 'ja', brinde_ja),
    'premio', jsonb_build_object('pt', premio_pt, 'en', premio_en, 'ja', premio_ja))
  from config_fidelidade where empresa_id = p_empresa_id
$$;

create or replace function private.fidelidade_cupons_ativos(p_cliente_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id, 'pct', c.pct, 'expira_em', c.expira_em,
           'agendado', exists (select 1 from agendamentos a where a.cupom_fidelidade_id = c.id and a.status <> 'CANCELADO'))
         order by c.pct desc, c.expira_em), '[]'::jsonb)
  from cupons_fidelidade c
  where c.cliente_id = p_cliente_id and c.usado_em is null and c.expira_em >= current_date
$$;

create or replace function public.fidelidade_cartao(p_slug text, p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c cartoes_fidelidade; v_nome text;
begin
  select cf.* into c from cartoes_fidelidade cf join empresas e on e.id = cf.empresa_id
  where cf.token = p_token and e.slug = p_slug;
  if not found then return null; end if;
  select split_part(btrim(nome), ' ', 1) into v_nome from clientes where id = c.cliente_id;
  return private.fidelidade_estado(c.cliente_id)
    || jsonb_build_object('primeiro_nome', v_nome, 'codigo_indicacao', c.codigo_indicacao,
                          'cupons', private.fidelidade_cupons_ativos(c.cliente_id),
                          'config', private.fidelidade_config_json(c.empresa_id));
end $$;

create or replace function private.aplicar_desconto_primeira_visita()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  cfg config_fidelidade;
  v_empresa uuid;
  v_pct_1a int := 0;
  v_cupom record;
  v_pct int;
  v_preco_base numeric;
  v_novo numeric;
begin
  if NEW.status = 'CANCELADO' or NEW.cliente_id is null then return NEW; end if;

  v_empresa := coalesce(NEW.empresa_id, (select cl.empresa_id from clientes cl where cl.id = NEW.cliente_id));
  select * into cfg from config_fidelidade where empresa_id = v_empresa;
  if not coalesce(cfg.ativo, false) then return NEW; end if;

  if exists (
       select 1 from cartoes_fidelidade c
       where c.cliente_id = NEW.cliente_id and c.cupom_usado_em is null and c.cupom_expira_em is not null
         and c.cupom_expira_em >= current_date)
     and not exists (
       select 1 from agendamentos a where a.cliente_id = NEW.cliente_id
         and (a.status = 'REALIZADO' or (a.desconto_primeira_visita and a.status <> 'CANCELADO'))) then
    v_pct_1a := coalesce(cfg.desconto_primeira_visita_pct, 0);
  end if;

  select c.id, c.pct into v_cupom
  from cupons_fidelidade c
  where c.cliente_id = NEW.cliente_id and c.usado_em is null and c.expira_em >= current_date
    and not exists (select 1 from agendamentos a where a.cupom_fidelidade_id = c.id and a.status <> 'CANCELADO')
  order by c.pct desc, c.expira_em
  limit 1;

  v_pct := greatest(v_pct_1a, coalesce(v_cupom.pct, 0));
  if v_pct <= 0 then return NEW; end if;

  select s.preco_minimo into v_preco_base from servicos s where s.id = NEW.servico_id;
  v_preco_base := coalesce(v_preco_base, NEW.preco_final);
  if v_preco_base is null or v_preco_base <= 0 then return NEW; end if;

  v_novo := round(v_preco_base * (100 - v_pct) / 100.0);
  if NEW.preco_final is null or v_novo < NEW.preco_final then
    NEW.preco_antes_desconto := coalesce(NEW.preco_final, v_preco_base);
    NEW.preco_final := v_novo;
    NEW.elegivel_desconto_recorrencia := false;
    if v_pct_1a >= coalesce(v_cupom.pct, 0) then
      NEW.desconto_primeira_visita := true;
    else
      NEW.cupom_fidelidade_id := v_cupom.id;
    end if;
  end if;
  return NEW;
end $$;

create or replace function private.fidelidade_ao_realizar()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c cartoes_fidelidade;
  cfg config_fidelidade;
  v_ult record;
  v_degrau int;
  v_pct int;
begin
  if NEW.status <> 'REALIZADO' or OLD.status is not distinct from 'REALIZADO' then return NEW; end if;

  if NEW.cupom_fidelidade_id is not null then
    update cupons_fidelidade set usado_em = now() where id = NEW.cupom_fidelidade_id and usado_em is null;
  end if;

  select * into c from cartoes_fidelidade where cliente_id = NEW.cliente_id;
  if not found then return NEW; end if;

  if c.cupom_usado_em is null and c.cupom_expira_em is not null then
    update cartoes_fidelidade set cupom_usado_em = now() where cliente_id = NEW.cliente_id;
  end if;

  if c.indicado_por is not null and not c.indicacao_creditada then
    update cartoes_fidelidade set indicacao_creditada = true where cliente_id = NEW.cliente_id;
    perform private.fidelidade_cartao_garantir(c.indicado_por);

    cfg := private.fidelidade_config(c.empresa_id);
    select cf.degrau, cf.criado_em into v_ult
    from cupons_fidelidade cf
    where cf.cliente_id = c.indicado_por and cf.tipo = 'indicacao'
    order by cf.criado_em desc, cf.degrau desc limit 1;

    if v_ult.criado_em is null or v_ult.criado_em < now() - make_interval(days => cfg.validade_cupom_dias) then
      v_degrau := 0;
    else
      v_degrau := v_ult.degrau + 1;
    end if;
    v_pct := greatest(cfg.indicacao_pct_inicial - v_degrau * cfg.indicacao_reducao_pct, cfg.indicacao_minimo_pct);

    if v_pct > 0 then
      insert into cupons_fidelidade (empresa_id, cliente_id, tipo, pct, degrau, indicado_cliente_id, expira_em)
      values (c.empresa_id, c.indicado_por, 'indicacao', least(v_pct, 100), v_degrau, NEW.cliente_id,
              current_date + cfg.validade_cupom_dias);
    end if;
  end if;
  return NEW;
end $$;

create or replace function public.fidelidade_descontos_admin(p_empresa_id uuid)
returns table (
  id text, cliente_id uuid, nome text, telefone text, tipo text, pct int, indicado_nome text,
  criado_em timestamptz, expira_em date, status text, agendamento_data timestamptz,
  preco_antes numeric, preco_final numeric, usado_em timestamptz)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare v_pct_1a int;
begin
  if not private.fidelidade_eh_da_empresa(p_empresa_id) then raise exception 'SEM_PERMISSAO'; end if;
  v_pct_1a := (private.fidelidade_config(p_empresa_id)).desconto_primeira_visita_pct;
  return query
  with primeira as (
    select 'p-' || cf.cliente_id::text as id, cf.cliente_id, 'primeira_visita'::text as tipo,
           v_pct_1a as pct, null::text as indicado_nome,
           cf.criado_em, cf.cupom_expira_em as expira_em, cf.cupom_usado_em as usado_em,
           (select a.id from agendamentos a where a.cliente_id = cf.cliente_id and a.desconto_primeira_visita
              and a.status <> 'CANCELADO' order by a.data_hora desc limit 1) as ag_id
    from cartoes_fidelidade cf
    where cf.empresa_id = p_empresa_id and cf.cupom_expira_em is not null
  ), indic as (
    select 'i-' || cu.id::text, cu.cliente_id, 'indicacao'::text, cu.pct, ind.nome::text,
           cu.criado_em, cu.expira_em, cu.usado_em,
           (select a.id from agendamentos a where a.cupom_fidelidade_id = cu.id
              and a.status <> 'CANCELADO' order by a.data_hora desc limit 1)
    from cupons_fidelidade cu left join clientes ind on ind.id = cu.indicado_cliente_id
    where cu.empresa_id = p_empresa_id
  ), todos as (select * from primeira union all select * from indic)
  select t.id, t.cliente_id, cl.nome::text, cl.telefone::text, t.tipo, t.pct, t.indicado_nome,
         t.criado_em, t.expira_em,
         case when a.status = 'REALIZADO' or (t.usado_em is not null and a.id is null) then 'usado'
              when a.id is not null then 'agendado'
              else 'disponivel' end,
         a.data_hora, a.preco_antes_desconto, a.preco_final,
         coalesce(t.usado_em, case when a.status = 'REALIZADO' then a.data_hora end)
  from todos t
  join clientes cl on cl.id = t.cliente_id
  left join agendamentos a on a.id = t.ag_id
  where not (t.usado_em is null and a.id is null and t.expira_em < current_date)
  order by case when a.id is null and t.usado_em is null then 0 when a.status <> 'REALIZADO' then 1 else 2 end,
           t.expira_em, cl.nome;
end $$;

revoke all on function public.fidelidade_descontos_admin(uuid) from public, anon;
grant execute on function public.fidelidade_descontos_admin(uuid) to authenticated;
