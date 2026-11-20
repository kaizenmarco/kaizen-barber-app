-- ============================================================================
-- Cartão Fidelidade Digital (Kaizen Barber Shop)
--
-- Substitui o programa de pontos (2 pts/atendimento, 10 pts = ¥500) por um
-- cartão de selos no celular do cliente:
--   * Entrada por QR code (/cartao) → cupom de X% (padrão 40%) na 1ª visita,
--     válido por N dias (padrão 21).
--   * Cada atendimento REALIZADO (que conta fidelidade) = 1 selo.
--   * Selo de boas-vindas ao entrar pelo cartão (padrão 1).
--   * Brinde no selo 5 e prêmio no selo 10 (configurável); o cartão recomeça.
--   * Indicação: amigo entra pelo link do cliente; quando o amigo faz a 1ª
--     visita, o cliente ganha +1 selo.
--
-- Os dados do cartão ficam numa tabela própria (cartoes_fidelidade), SEM
-- leitura pública — a tabela clientes hoje é legível por anon, então o token
-- do cartão não pode morar lá. O site público só fala com o cartão pelas
-- funções fidelidade_entrar / fidelidade_cartao (SECURITY DEFINER).
-- ============================================================================

-- ---------------------------------------------------------------- config ---
create table if not exists public.config_fidelidade (
  id int primary key default 1 check (id = 1),
  ativo boolean not null default true,
  meta_selos int not null default 10 check (meta_selos between 3 and 30),
  selo_brinde int default 5,               -- null = sem brinde intermediário
  selos_boas_vindas int not null default 1 check (selos_boas_vindas between 0 and 5),
  desconto_primeira_visita_pct int not null default 40 check (desconto_primeira_visita_pct between 0 and 100),
  validade_cupom_dias int not null default 21 check (validade_cupom_dias between 1 and 365),
  brinde_pt text not null default 'Sobrancelha grátis',
  brinde_en text not null default 'Free eyebrow trim',
  brinde_ja text not null default '眉カット無料',
  premio_pt text not null default 'Corte grátis',
  premio_en text not null default 'Free haircut',
  premio_ja text not null default 'カット無料',
  -- Visitas antes desta data contam para a posição no cartão, mas ciclos já
  -- completos antes do lançamento NÃO geram prêmio retroativo.
  data_lancamento date not null default date '2026-11-20',
  atualizado_em timestamptz not null default now()
);
insert into public.config_fidelidade (id) values (1) on conflict do nothing;

alter table public.config_fidelidade enable row level security;
drop policy if exists publico_le_config_fidelidade on public.config_fidelidade;
create policy publico_le_config_fidelidade on public.config_fidelidade for select to anon, authenticated using (true);
drop policy if exists staff_edita_config_fidelidade on public.config_fidelidade;
create policy staff_edita_config_fidelidade on public.config_fidelidade for update to authenticated
  using (private.eh_staff()) with check (private.eh_staff());

-- --------------------------------------------------------------- cartões ---
create table if not exists public.cartoes_fidelidade (
  cliente_id uuid primary key references public.clientes(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  codigo_indicacao text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 6)),
  selos_bonus int not null default 0,
  indicado_por uuid references public.clientes(id) on delete set null,
  indicacao_creditada boolean not null default false,
  cupom_expira_em date,
  cupom_usado_em timestamptz,
  criado_em timestamptz not null default now()
);
alter table public.cartoes_fidelidade enable row level security;
drop policy if exists staff_acesso_total on public.cartoes_fidelidade;
create policy staff_acesso_total on public.cartoes_fidelidade for all to authenticated
  using (private.eh_staff()) with check (private.eh_staff());

create table if not exists public.resgates_fidelidade (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  tipo text not null check (tipo in ('brinde', 'premio')),
  marco int not null,                       -- nº acumulado do selo (5, 10, 15, 20…)
  resgatado_em timestamptz not null default now(),
  resgatado_por uuid default auth.uid(),
  unique (cliente_id, marco)
);
alter table public.resgates_fidelidade enable row level security;
drop policy if exists staff_acesso_total on public.resgates_fidelidade;
create policy staff_acesso_total on public.resgates_fidelidade for all to authenticated
  using (private.eh_staff()) with check (private.eh_staff());

alter table public.agendamentos add column if not exists desconto_primeira_visita boolean not null default false;
alter table public.agendamentos add column if not exists preco_antes_desconto numeric;

-- -------------------------------------------------------------- helpers ---
create or replace function private.fidelidade_cartao_garantir(p_cliente_id uuid)
returns public.cartoes_fidelidade
language plpgsql security definer set search_path = public as $$
declare v public.cartoes_fidelidade;
begin
  insert into cartoes_fidelidade (cliente_id) values (p_cliente_id) on conflict (cliente_id) do nothing;
  select * into v from cartoes_fidelidade where cliente_id = p_cliente_id;
  return v;
end $$;

-- Estado completo do cartão de um cliente (usado pelo site público e admin).
create or replace function private.fidelidade_estado(p_cliente_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  cfg config_fidelidade;
  c cartoes_fidelidade;
  v_visitas int;
  v_visitas_antes int;
  v_total int;
  v_base int;
  v_marco int;
  v_pendentes jsonb := '[]'::jsonb;
  v_tem_realizado boolean;
  v_cupom_ativo boolean;
  v_indicacoes int;
begin
  select * into cfg from config_fidelidade where id = 1;
  select * into c from cartoes_fidelidade where cliente_id = p_cliente_id;

  select count(*) filter (where conta_pontos_fidelidade is not false),
         count(*) filter (where conta_pontos_fidelidade is not false and data_hora::date < cfg.data_lancamento),
         count(*) > 0
    into v_visitas, v_visitas_antes, v_tem_realizado
  from agendamentos where cliente_id = p_cliente_id and status = 'REALIZADO';

  v_total := v_visitas + coalesce(c.selos_bonus, 0);
  v_base := (v_visitas_antes / cfg.meta_selos) * cfg.meta_selos;

  -- marcos ganhos (depois da base) e ainda não resgatados
  v_marco := v_base;
  while v_marco < v_total loop
    if cfg.selo_brinde is not null and cfg.selo_brinde > 0 and cfg.selo_brinde < cfg.meta_selos
       and v_marco + cfg.selo_brinde <= v_total
       and not exists (select 1 from resgates_fidelidade r where r.cliente_id = p_cliente_id and r.marco = v_marco + cfg.selo_brinde) then
      v_pendentes := v_pendentes || jsonb_build_object('tipo', 'brinde', 'marco', v_marco + cfg.selo_brinde);
    end if;
    if v_marco + cfg.meta_selos <= v_total
       and not exists (select 1 from resgates_fidelidade r where r.cliente_id = p_cliente_id and r.marco = v_marco + cfg.meta_selos) then
      v_pendentes := v_pendentes || jsonb_build_object('tipo', 'premio', 'marco', v_marco + cfg.meta_selos);
    end if;
    v_marco := v_marco + cfg.meta_selos;
  end loop;

  v_cupom_ativo := c.cliente_id is not null and c.cupom_expira_em is not null and c.cupom_usado_em is null
                   and c.cupom_expira_em >= (now() at time zone 'Asia/Tokyo')::date and not v_tem_realizado;

  select count(*) into v_indicacoes from cartoes_fidelidade x where x.indicado_por = p_cliente_id and x.indicacao_creditada;

  return jsonb_build_object(
    'selos_total', v_total,
    'selos_no_ciclo', case when v_total > 0 and v_total % cfg.meta_selos = 0 and jsonb_array_length(v_pendentes) > 0
                           then cfg.meta_selos else v_total % cfg.meta_selos end,
    'visitas', v_visitas,
    'selos_bonus', coalesce(c.selos_bonus, 0),
    'recompensas_pendentes', v_pendentes,
    'cupom', jsonb_build_object('ativo', coalesce(v_cupom_ativo, false), 'expira_em', c.cupom_expira_em,
                                'usado_em', c.cupom_usado_em, 'pct', cfg.desconto_primeira_visita_pct),
    'indicacoes_creditadas', v_indicacoes
  );
end $$;

create or replace function private.fidelidade_config_json()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('ativo', ativo, 'meta_selos', meta_selos, 'selo_brinde', selo_brinde,
    'desconto_pct', desconto_primeira_visita_pct, 'validade_cupom_dias', validade_cupom_dias,
    'selos_boas_vindas', selos_boas_vindas,
    'brinde', jsonb_build_object('pt', brinde_pt, 'en', brinde_en, 'ja', brinde_ja),
    'premio', jsonb_build_object('pt', premio_pt, 'en', premio_en, 'ja', premio_ja))
  from config_fidelidade where id = 1
$$;

-- ------------------------------------------------------ RPCs públicas ---
-- Entrar no programa pelo QR code. Devolve o token do cartão.
create or replace function public.fidelidade_entrar(p_nome text, p_telefone text, p_ref text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  cfg config_fidelidade;
  v_tel text := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
  v_nome text := btrim(coalesce(p_nome, ''));
  v_cliente_id uuid;
  v_novo boolean := false;
  v_tem_realizado boolean;
  v_indicador uuid;
  c cartoes_fidelidade;
begin
  select * into cfg from config_fidelidade where id = 1;
  if not cfg.ativo then raise exception 'PROGRAMA_INATIVO'; end if;
  if length(v_tel) < 9 or length(v_tel) > 15 then raise exception 'TELEFONE_INVALIDO'; end if;
  if length(v_nome) < 2 or length(v_nome) > 80 then raise exception 'NOME_INVALIDO'; end if;

  -- mesmo critério do site: últimos 9 dígitos
  select cl.id into v_cliente_id
  from clientes cl
  where right(regexp_replace(coalesce(cl.telefone, ''), '\D', '', 'g'), 9) = right(v_tel, 9)
  order by (select count(*) from agendamentos a where a.cliente_id = cl.id and a.status = 'REALIZADO') desc, cl.criado_em
  limit 1;

  if v_cliente_id is null then
    insert into clientes (nome, telefone, data_primeiro_cadastro)
    values (v_nome, case when btrim(p_telefone) like '+%' then '+' || v_tel else v_tel end, now() at time zone 'UTC')
    returning id into v_cliente_id;
  end if;

  if exists (select 1 from clientes where id = v_cliente_id and bloqueado) then
    raise exception 'CLIENTE_BLOQUEADO';
  end if;

  select not exists (select 1 from cartoes_fidelidade where cliente_id = v_cliente_id) into v_novo;  -- true = cartão novo
  c :=private.fidelidade_cartao_garantir(v_cliente_id);

  if v_novo then
    select exists (select 1 from agendamentos where cliente_id = v_cliente_id and status = 'REALIZADO') into v_tem_realizado;

    if p_ref is not null and not v_tem_realizado then
      select cliente_id into v_indicador from cartoes_fidelidade where codigo_indicacao = upper(btrim(p_ref));
      if v_indicador = v_cliente_id then v_indicador := null; end if;
    end if;

    update cartoes_fidelidade set
      selos_bonus = cfg.selos_boas_vindas,
      cupom_expira_em = case when v_tem_realizado or cfg.desconto_primeira_visita_pct = 0 then null
                             else (now() at time zone 'Asia/Tokyo')::date + cfg.validade_cupom_dias end,
      indicado_por = v_indicador
    where cliente_id = v_cliente_id
    returning * into c;
  end if;

  return jsonb_build_object('token', c.token, 'cartao_novo', v_novo);
end $$;

-- Lê o cartão pelo token (o link pessoal do cliente).
create or replace function public.fidelidade_cartao(p_token uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  c cartoes_fidelidade;
  v_nome text;
begin
  select * into c from cartoes_fidelidade where token = p_token;
  if not found then return null; end if;
  select split_part(btrim(nome), ' ', 1) into v_nome from clientes where id = c.cliente_id;
  return private.fidelidade_estado(c.cliente_id)
    || jsonb_build_object('primeiro_nome', v_nome, 'codigo_indicacao', c.codigo_indicacao,
                          'config', private.fidelidade_config_json());
end $$;

-- Para a tela de confirmação do agendamento: o cliente tem cupom ativo?
create or replace function public.fidelidade_cupom_ativo(p_cliente_id uuid)
returns int
language sql stable security definer set search_path = public as $$
  select case when (private.fidelidade_estado(p_cliente_id) -> 'cupom' ->> 'ativo')::boolean
              then (select desconto_primeira_visita_pct from config_fidelidade where id = 1) else 0 end
$$;

revoke all on function public.fidelidade_entrar(text, text, text) from public;
revoke all on function public.fidelidade_cartao(uuid) from public;
revoke all on function public.fidelidade_cupom_ativo(uuid) from public;
grant execute on function public.fidelidade_entrar(text, text, text) to anon, authenticated;
grant execute on function public.fidelidade_cartao(uuid) to anon, authenticated;
grant execute on function public.fidelidade_cupom_ativo(uuid) to anon, authenticated;

-- ------------------------------------------------------ RPCs do admin ---
create or replace function public.fidelidade_resumo_admin()
returns table (cliente_id uuid, nome text, telefone text, tem_cartao boolean, token uuid, estado jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  if not private.eh_staff() then raise exception 'SEM_PERMISSAO'; end if;
  return query
  select cl.id, cl.nome::text, cl.telefone::text, cf.cliente_id is not null, cf.token, private.fidelidade_estado(cl.id)
  from clientes cl
  left join cartoes_fidelidade cf on cf.cliente_id = cl.id
  where cf.cliente_id is not null
     or exists (select 1 from agendamentos a where a.cliente_id = cl.id and a.status = 'REALIZADO')
  order by cl.nome;
end $$;

-- Gera (se preciso) o cartão de um cliente e devolve o token — botão
-- "copiar link do cartão" no admin.
create or replace function public.fidelidade_token_cliente(p_cliente_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
begin
  if not private.eh_staff() then raise exception 'SEM_PERMISSAO'; end if;
  return (private.fidelidade_cartao_garantir(p_cliente_id)).token;
end $$;

create or replace function public.fidelidade_resgatar(p_cliente_id uuid, p_marco int)
returns void
language plpgsql security definer set search_path = public as $$
declare v_item jsonb;
begin
  if not private.eh_staff() then raise exception 'SEM_PERMISSAO'; end if;
  select x into v_item from jsonb_array_elements(private.fidelidade_estado(p_cliente_id) -> 'recompensas_pendentes') x
  where (x ->> 'marco')::int = p_marco;
  if v_item is null then raise exception 'RECOMPENSA_INDISPONIVEL'; end if;
  insert into resgates_fidelidade (cliente_id, tipo, marco) values (p_cliente_id, v_item ->> 'tipo', p_marco);
end $$;

revoke all on function public.fidelidade_resumo_admin() from public, anon;
revoke all on function public.fidelidade_token_cliente(uuid) from public, anon;
revoke all on function public.fidelidade_resgatar(uuid, int) from public, anon;
grant execute on function public.fidelidade_resumo_admin() to authenticated;
grant execute on function public.fidelidade_token_cliente(uuid) to authenticated;
grant execute on function public.fidelidade_resgatar(uuid, int) to authenticated;

-- -------------------------------------------------------------- triggers ---
-- 40% na 1ª visita. Roda depois dos outros BEFORE INSERT (ordem alfabética:
-- "trg_zz_"), então já sabe se é assinatura/promoção. Usa o melhor preço:
-- se a promoção do horário já deixar mais barato, mantém a promoção.
create or replace function private.aplicar_desconto_primeira_visita()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_pct int;
  v_preco_base numeric;
  v_novo numeric;
begin
  if NEW.status = 'CANCELADO' or NEW.origem_pagamento = 'assinatura' or NEW.cliente_id is null then
    return NEW;
  end if;

  if not exists (
    select 1 from cartoes_fidelidade c
    where c.cliente_id = NEW.cliente_id and c.cupom_usado_em is null and c.cupom_expira_em is not null
      and c.cupom_expira_em >= (now() at time zone 'Asia/Tokyo')::date
  ) then return NEW; end if;

  if exists (select 1 from agendamentos a where a.cliente_id = NEW.cliente_id
             and (a.status = 'REALIZADO' or (a.desconto_primeira_visita and a.status <> 'CANCELADO'))) then
    return NEW;
  end if;

  select desconto_primeira_visita_pct into v_pct from config_fidelidade where id = 1 and ativo;
  if coalesce(v_pct, 0) = 0 then return NEW; end if;

  select coalesce(s.preco, s.preco_minimo) into v_preco_base from servicos s where s.id = NEW.servico_id;
  v_preco_base := coalesce(v_preco_base, NEW.preco_final);
  if v_preco_base is null or v_preco_base <= 0 then return NEW; end if;

  v_novo := round(v_preco_base * (100 - v_pct) / 100.0);
  if NEW.preco_final is null or v_novo < NEW.preco_final then
    NEW.preco_antes_desconto := coalesce(NEW.preco_final, v_preco_base);
    NEW.preco_final := v_novo;
    NEW.desconto_primeira_visita := true;
    NEW.elegivel_desconto_recorrencia := false;   -- não acumula com os 15%
  end if;
  return NEW;
end $$;

drop trigger if exists trg_zz_desconto_primeira_visita on public.agendamentos;
create trigger trg_zz_desconto_primeira_visita
  before insert on public.agendamentos
  for each row execute function private.aplicar_desconto_primeira_visita();

-- Quando vira REALIZADO: baixa o cupom e credita a indicação.
create or replace function private.fidelidade_ao_realizar()
returns trigger
language plpgsql security definer set search_path = public as $$
declare c cartoes_fidelidade;
begin
  if NEW.status <> 'REALIZADO' or OLD.status is not distinct from 'REALIZADO' then return NEW; end if;

  select * into c from cartoes_fidelidade where cliente_id = NEW.cliente_id;
  if not found then return NEW; end if;

  if c.cupom_usado_em is null and c.cupom_expira_em is not null then
    update cartoes_fidelidade set cupom_usado_em = now() where cliente_id = NEW.cliente_id;
  end if;

  if c.indicado_por is not null and not c.indicacao_creditada then
    update cartoes_fidelidade set indicacao_creditada = true where cliente_id = NEW.cliente_id;
    perform private.fidelidade_cartao_garantir(c.indicado_por);
    update cartoes_fidelidade set selos_bonus = selos_bonus + 1 where cliente_id = c.indicado_por;
  end if;
  return NEW;
end $$;

drop trigger if exists trg_fidelidade_ao_realizar on public.agendamentos;
create trigger trg_fidelidade_ao_realizar
  after update of status on public.agendamentos
  for each row execute function private.fidelidade_ao_realizar();
