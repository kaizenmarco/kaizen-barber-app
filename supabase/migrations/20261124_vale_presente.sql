-- ============================================================================
-- Vale Presente Kaizen (campanha de fim de ano 2026)
--
-- Regras:
--   * O vale é de UM SERVIÇO (Corte / Corte + Barba), com valor de face igual
--     ao preço do serviço na hora da compra. Se o presenteado escolher um
--     serviço mais caro, paga só a diferença (upgrade).
--   * Uso único, transferível, sem troca por dinheiro.
--   * Validade de 6 meses a partir do pagamento (fica fora do 資金決済法).
--   * O resgate acontece NA RESERVA: o agendamento é feito com o código e o
--     banco aplica o vale (trigger trg_zzz_vale_presente). O vale só vira
--     "usado" quando o atendimento é marcado como REALIZADO.
--   * Cancelou avisando -> vale volta a valer. Faltou sem avisar -> pode
--     reagendar 1 vez; na 2ª falta o vale é perdido.
--   * NÃO acumula com o desconto de 1ª visita (40%), cupom de indicação nem
--     promoção de horário: o vale substitui qualquer desconto.
--   * Bônus para quem compra: 1 cupom de ¥500 por pedido (tipo 'bonus'),
--     usado do mesmo jeito (código na reserva), válido até fev/2027.
--   * Combo: 3 vales ou mais no mesmo pedido = 10% de desconto no total.
-- ============================================================================

create table if not exists public.config_vale_presente (
  id int primary key default 1 check (id = 1),
  venda_ativa boolean not null default true,
  servico_ids uuid[] not null default '{}',
  validade_meses int not null default 6 check (validade_meses between 1 and 6),
  combo_min_qtd int not null default 3,
  combo_pct int not null default 10 check (combo_pct between 0 and 50),
  bonus_ativo boolean not null default true,
  bonus_valor numeric not null default 500,
  bonus_venda_ate date default '2026-12-31',
  bonus_expira_em date default '2027-02-28',
  atualizado_em timestamptz not null default now()
);

insert into public.config_vale_presente (id, servico_ids)
select 1, array(select id from public.servicos where nome in ('Corte', 'Corte + Barba') and ativo order by preco)
on conflict (id) do nothing;

create table if not exists public.vales_presente (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  tipo text not null default 'presente' check (tipo in ('presente', 'bonus')),
  servico_id uuid references public.servicos(id),
  valor numeric not null check (valor > 0),
  valor_pago numeric,
  nome_presenteado text,
  nome_comprador text,
  email_comprador text,
  telefone_comprador text,
  mensagem text,
  origem text not null default 'balcao' check (origem in ('stripe', 'balcao', 'cortesia')),
  forma_pagamento text,
  status text not null default 'pendente' check (status in ('pendente', 'ativo', 'usado', 'perdido', 'cancelado')),
  faltas int not null default 0,
  expira_em date,
  pedido_id uuid,
  stripe_session_id text,
  agendamento_id uuid references public.agendamentos(id) on delete set null,
  criado_em timestamptz not null default now(),
  pago_em timestamptz,
  usado_em timestamptz,
  criado_por uuid default auth.uid()
);

create index if not exists vales_presente_pedido_idx on public.vales_presente (pedido_id);
create index if not exists vales_presente_codigo_norm_idx on public.vales_presente ((replace(codigo, '-', '')));

alter table public.vales_presente enable row level security;
alter table public.config_vale_presente enable row level security;

drop policy if exists staff_acesso_total on public.vales_presente;
create policy staff_acesso_total on public.vales_presente for all to authenticated
  using (private.eh_staff()) with check (private.eh_staff());

drop policy if exists staff_acesso_total on public.config_vale_presente;
create policy staff_acesso_total on public.config_vale_presente for all to authenticated
  using (private.eh_staff()) with check (private.eh_staff());

alter table public.agendamentos
  add column if not exists vale_presente_id uuid references public.vales_presente(id),
  add column if not exists vale_presente_codigo text;

-- ---------------------------------------------------------------------------
-- Código: KZN-XXXX-XXXX (sem 0/O/1/I pra não confundir ao digitar)
-- ---------------------------------------------------------------------------
create or replace function private.gerar_codigo_vale()
returns text language plpgsql volatile set search_path = public, extensions as $$
declare
  alfabeto constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  bytes bytea;
  bruto text;
  i int;
begin
  loop
    bytes := extensions.gen_random_bytes(8);
    bruto := '';
    for i in 0..7 loop
      bruto := bruto || substr(alfabeto, (get_byte(bytes, i) % 32) + 1, 1);
    end loop;
    bruto := 'KZN-' || substr(bruto, 1, 4) || '-' || substr(bruto, 5, 4);
    exit when not exists (select 1 from vales_presente where codigo = bruto);
  end loop;
  return bruto;
end $$;

create or replace function private.normalizar_codigo_vale(p text)
returns text language sql immutable as $$
  select nullif(upper(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g')), '')
$$;

alter table public.vales_presente alter column codigo set default private.gerar_codigo_vale();

-- ---------------------------------------------------------------------------
-- Consulta pública do vale (página /valepresente/:codigo e reserva)
-- ---------------------------------------------------------------------------
create or replace function public.consultar_vale_presente(p_codigo text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v vales_presente;
  v_hoje date := (now() at time zone 'Asia/Tokyo')::date;
  v_status text;
  v_reserva record;
  v_servico record;
begin
  select * into v from vales_presente
   where replace(codigo, '-', '') = private.normalizar_codigo_vale(p_codigo)
   limit 1;
  if not found then
    return jsonb_build_object('encontrado', false);
  end if;

  select a.id, a.data_hora, s.nome as servico into v_reserva
    from agendamentos a join servicos s on s.id = a.servico_id
   where a.vale_presente_id = v.id and a.status not in ('CANCELADO', 'NÃO_COMPARECEU', 'REALIZADO')
   order by a.data_hora desc limit 1;

  v_status := v.status;
  if v.status = 'ativo' and v.expira_em is not null and v.expira_em < v_hoje then
    v_status := 'expirado';
  elsif v.status = 'ativo' and v_reserva.id is not null then
    v_status := 'reservado';
  end if;

  select id, nome, preco, duracao_minutos into v_servico from servicos where id = v.servico_id;

  return jsonb_build_object(
    'encontrado', true,
    'codigo', v.codigo,
    'tipo', v.tipo,
    'status', v_status,
    'valor', v.valor,
    'servico_id', v.servico_id,
    'servico_nome', v_servico.nome,
    'nome_presenteado', v.nome_presenteado,
    'nome_comprador', v.nome_comprador,
    'mensagem', v.mensagem,
    'expira_em', v.expira_em,
    'faltas', v.faltas,
    'reserva_data_hora', v_reserva.data_hora,
    'reserva_servico', v_reserva.servico
  );
end $$;

revoke all on function public.consultar_vale_presente(text) from public;
grant execute on function public.consultar_vale_presente(text) to anon, authenticated;

create or replace function public.config_vale_presente_publica()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'venda_ativa', c.venda_ativa,
    'validade_meses', c.validade_meses,
    'combo_min_qtd', c.combo_min_qtd,
    'combo_pct', c.combo_pct,
    'bonus_ativo', c.bonus_ativo and (c.bonus_venda_ate is null or (now() at time zone 'Asia/Tokyo')::date <= c.bonus_venda_ate),
    'bonus_valor', c.bonus_valor,
    'bonus_expira_em', c.bonus_expira_em,
    'servicos', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'nome', s.nome, 'preco', coalesce(s.preco, s.preco_minimo), 'imagem_url', s.imagem_url) order by coalesce(s.preco, s.preco_minimo))
        from servicos s where s.id = any(c.servico_ids) and s.ativo), '[]'::jsonb)
  )
  from config_vale_presente c where c.id = 1
$$;

revoke all on function public.config_vale_presente_publica() from public;
grant execute on function public.config_vale_presente_publica() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Aplica o vale no agendamento. Roda POR ÚLTIMO entre os BEFORE triggers
-- (nome trg_zzz_), por isso sobrescreve promoção, 1ª visita e cupom.
-- ---------------------------------------------------------------------------
create or replace function private.aplicar_vale_presente()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v vales_presente;
  v_hoje date := (now() at time zone 'Asia/Tokyo')::date;
  v_preco numeric;
  v_nome_servico text;
  v_eh_anon boolean := coalesce(auth.role(), '') = 'anon';
  v_nota text;
begin
  if tg_op = 'UPDATE' then
    if new.vale_presente_codigo is not distinct from old.vale_presente_codigo
       and new.vale_presente_id is not distinct from old.vale_presente_id then
      return new;
    end if;
    if v_eh_anon then
      raise exception 'ALTERACAO_NAO_PERMITIDA';
    end if;
  end if;

  -- O site público só pode mandar o código, nunca o id direto.
  if v_eh_anon and new.vale_presente_id is not null and private.normalizar_codigo_vale(new.vale_presente_codigo) is null then
    raise exception 'VALE_INVALIDO';
  end if;

  if private.normalizar_codigo_vale(new.vale_presente_codigo) is null then
    if tg_op = 'UPDATE' and new.vale_presente_id is null then
      new.vale_presente_codigo := null;
    end if;
    return new;
  end if;

  if new.status = 'CANCELADO' then
    return new;
  end if;

  select * into v from vales_presente
   where replace(codigo, '-', '') = private.normalizar_codigo_vale(new.vale_presente_codigo)
   for update;

  if not found or v.status in ('cancelado', 'perdido') then
    raise exception 'VALE_INVALIDO';
  end if;
  if v.status = 'pendente' then
    raise exception 'VALE_PENDENTE';
  end if;
  if v.status = 'usado' then
    raise exception 'VALE_JA_USADO';
  end if;
  if v.expira_em is not null and (v.expira_em < v_hoje or new.data_hora::date > v.expira_em) then
    raise exception 'VALE_EXPIRADO';
  end if;
  if exists (
    select 1 from agendamentos a
     where a.vale_presente_id = v.id
       and a.status not in ('CANCELADO', 'NÃO_COMPARECEU')
       and (tg_op = 'INSERT' or a.id <> new.id)
  ) then
    raise exception 'VALE_JA_RESERVADO';
  end if;

  select coalesce(s.preco, s.preco_minimo), s.nome into v_preco, v_nome_servico
    from servicos s where s.id = new.servico_id;
  v_preco := coalesce(v_preco, new.preco_final, 0);

  new.vale_presente_id := v.id;
  new.vale_presente_codigo := v.codigo;
  new.origem_pagamento := 'vale_presente';
  new.preco_antes_desconto := v_preco;
  new.preco_final := greatest(0, v_preco - v.valor);
  new.desconto_primeira_visita := false;
  new.cupom_fidelidade_id := null;
  new.promocao_id := null;
  new.conta_pontos_fidelidade := true;

  v_nota := case when v.tipo = 'bonus'
    then '🎁 Bônus vale presente ' || v.codigo || ' (−¥' || v.valor::int || ')'
    else '🎁 Vale presente ' || v.codigo || ' (vale ¥' || v.valor::int || ')' end;
  if new.preco_final > 0 then
    v_nota := v_nota || ' — cobrar diferença ¥' || new.preco_final::int;
  end if;
  if coalesce(new.observacoes, '') not like '%' || v.codigo || '%' then
    new.observacoes := v_nota || coalesce(' | ' || nullif(new.observacoes, ''), '');
  end if;

  return new;
end $$;

drop trigger if exists trg_zzz_vale_presente on public.agendamentos;
create trigger trg_zzz_vale_presente
  before insert or update of vale_presente_codigo, vale_presente_id on public.agendamentos
  for each row execute function private.aplicar_vale_presente();

-- ---------------------------------------------------------------------------
-- Atualiza o vale conforme o status do atendimento.
-- ---------------------------------------------------------------------------
create or replace function private.vale_presente_ao_mudar_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.vale_presente_id is null or new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'REALIZADO' then
    update vales_presente
       set status = 'usado', usado_em = now(), agendamento_id = new.id
     where id = new.vale_presente_id and status = 'ativo';
  elsif old.status = 'REALIZADO' then
    -- Correção feita pela equipe: volta o vale a valer.
    update vales_presente
       set status = 'ativo', usado_em = null, agendamento_id = null
     where id = new.vale_presente_id and status = 'usado' and agendamento_id = new.id;
  end if;

  if new.status = 'NÃO_COMPARECEU' then
    update vales_presente
       set faltas = faltas + 1,
           status = case when faltas + 1 >= 2 then 'perdido' else status end
     where id = new.vale_presente_id and status = 'ativo';
  elsif old.status = 'NÃO_COMPARECEU' then
    update vales_presente
       set faltas = greatest(faltas - 1, 0),
           status = case when status = 'perdido' then 'ativo' else status end
     where id = new.vale_presente_id;
  end if;

  return new;
end $$;

drop trigger if exists trg_vale_presente_status on public.agendamentos;
create trigger trg_vale_presente_status
  after update of status on public.agendamentos
  for each row execute function private.vale_presente_ao_mudar_status();

-- ---------------------------------------------------------------------------
-- Venda no balcão (Admin). Cria N vales já ativos + bônus do comprador e
-- lança a entrada no caixa do dia.
-- ---------------------------------------------------------------------------
create or replace function public.criar_vales_balcao(
  p_servico_id uuid,
  p_quantidade int default 1,
  p_nomes_presenteados text[] default '{}',
  p_nome_comprador text default null,
  p_telefone_comprador text default null,
  p_mensagem text default null,
  p_forma_pagamento text default 'dinheiro',
  p_origem text default 'balcao',
  p_registrar_caixa boolean default true,
  p_dar_bonus boolean default true
) returns setof public.vales_presente
language plpgsql security definer set search_path = public as $$
declare
  cfg config_vale_presente;
  v_hoje date := (now() at time zone 'Asia/Tokyo')::date;
  v_preco numeric;
  v_nome_servico text;
  v_unit numeric;
  v_pedido uuid := gen_random_uuid();
  v_expira date;
  i int;
begin
  if not private.eh_staff() then
    raise exception 'SEM_PERMISSAO';
  end if;
  if p_quantidade < 1 or p_quantidade > 20 then
    raise exception 'QUANTIDADE_INVALIDA';
  end if;
  if p_origem not in ('balcao', 'cortesia') then
    raise exception 'ORIGEM_INVALIDA';
  end if;

  select * into cfg from config_vale_presente where id = 1;
  select coalesce(preco, preco_minimo), nome into v_preco, v_nome_servico from servicos where id = p_servico_id;
  if v_preco is null then
    raise exception 'SERVICO_INVALIDO';
  end if;

  v_unit := case when p_origem = 'cortesia' then 0
                 when p_quantidade >= cfg.combo_min_qtd then round(v_preco * (100 - cfg.combo_pct) / 100.0)
                 else v_preco end;
  v_expira := ((v_hoje + make_interval(months => cfg.validade_meses)) - interval '1 day')::date;

  for i in 1..p_quantidade loop
    return query insert into vales_presente (
      tipo, servico_id, valor, valor_pago, nome_presenteado, nome_comprador, telefone_comprador,
      mensagem, origem, forma_pagamento, status, expira_em, pedido_id, pago_em
    ) values (
      'presente', p_servico_id, v_preco, v_unit,
      nullif(trim(coalesce(p_nomes_presenteados[i], '')), ''),
      nullif(trim(coalesce(p_nome_comprador, '')), ''),
      nullif(trim(coalesce(p_telefone_comprador, '')), ''),
      nullif(trim(coalesce(p_mensagem, '')), ''),
      p_origem, p_forma_pagamento, 'ativo', v_expira, v_pedido, now()
    ) returning *;
  end loop;

  if p_dar_bonus and p_origem = 'balcao' and cfg.bonus_ativo
     and (cfg.bonus_venda_ate is null or v_hoje <= cfg.bonus_venda_ate) then
    return query insert into vales_presente (
      tipo, valor, valor_pago, nome_presenteado, nome_comprador, telefone_comprador,
      origem, status, expira_em, pedido_id, pago_em
    ) values (
      'bonus', cfg.bonus_valor, 0,
      nullif(trim(coalesce(p_nome_comprador, '')), ''),
      nullif(trim(coalesce(p_nome_comprador, '')), ''),
      nullif(trim(coalesce(p_telefone_comprador, '')), ''),
      p_origem, 'ativo', coalesce(cfg.bonus_expira_em, v_expira), v_pedido, now()
    ) returning *;
  end if;

  if p_registrar_caixa and v_unit > 0 then
    insert into caixa_movimentacoes (data, tipo, descricao, valor)
    values (v_hoje, 'entrada',
            'Vale presente ' || v_nome_servico || ' x' || p_quantidade || ' (' || coalesce(p_forma_pagamento, '') || ')',
            v_unit * p_quantidade);
  end if;
end $$;

revoke all on function public.criar_vales_balcao(uuid, int, text[], text, text, text, text, text, boolean, boolean) from public, anon;
grant execute on function public.criar_vales_balcao(uuid, int, text[], text, text, text, text, text, boolean, boolean) to authenticated;
