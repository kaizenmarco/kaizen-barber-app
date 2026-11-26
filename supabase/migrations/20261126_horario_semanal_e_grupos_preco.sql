-- Já aplicada no Supabase (migração horario_semanal_e_grupos_preco, 2026-11-26).

-- 1) Horário semanal individual por profissional. Sem linha para o dia =
--    segue o horário padrão do salão (config/horarios.js).
create table public.horario_semanal_profissional (
  profissional_id uuid not null references public.profissionais(id) on delete cascade,
  dia_semana smallint not null check (dia_semana between 0 and 6), -- 0 = domingo
  aberto boolean not null default true,
  abertura text check (abertura ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  fechamento text check (fechamento ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  atualizado_em timestamptz not null default now(),
  primary key (profissional_id, dia_semana),
  constraint horario_semanal_ordem check (not aberto or (abertura is not null and fechamento is not null and abertura < fechamento))
);
alter table public.horario_semanal_profissional enable row level security;
create policy publico_le_horario_semanal on public.horario_semanal_profissional for select to anon, authenticated using (true);
create policy staff_acesso_total on public.horario_semanal_profissional for all to authenticated using (private.eh_staff()) with check (private.eh_staff());

-- Site público não pode agendar fora do horário individual do profissional
-- (a equipe no Admin pode, como encaixe).
create or replace function public.respeitar_horario_semanal_profissional()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  v_h horario_semanal_profissional;
  v_duracao int;
  v_inicio text;
  v_fim text;
begin
  if coalesce(auth.role(), '') <> 'anon' or new.status = 'CANCELADO' then
    return new;
  end if;
  select * into v_h from horario_semanal_profissional
   where profissional_id = new.profissional_id and dia_semana = extract(dow from new.data_hora)::int;
  if not found then return new; end if;
  if not v_h.aberto then
    raise exception 'FORA_HORARIO_PROFISSIONAL';
  end if;
  select coalesce(new.duracao_minutos_manual, s.duracao_minutos, 30) into v_duracao from servicos s where s.id = new.servico_id;
  v_inicio := to_char(new.data_hora, 'HH24:MI');
  v_fim := to_char(new.data_hora + make_interval(mins => coalesce(v_duracao, 30)), 'HH24:MI');
  if v_inicio < v_h.abertura or v_fim > v_h.fechamento then
    raise exception 'FORA_HORARIO_PROFISSIONAL';
  end if;
  return new;
end $$;
create trigger trg_horario_semanal_profissional before insert or update of data_hora, profissional_id on public.agendamentos
  for each row execute function public.respeitar_horario_semanal_profissional();

-- 2) Grupos de preço especial (ex.: "Corte quinzenal especial").
create table public.grupos_preco (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create table public.grupos_preco_servicos (
  grupo_id uuid not null references public.grupos_preco(id) on delete cascade,
  servico_id uuid not null references public.servicos(id) on delete cascade,
  preco numeric not null check (preco >= 0),
  primary key (grupo_id, servico_id)
);
-- Cada cliente fica em no máximo um grupo.
create table public.grupos_preco_clientes (
  cliente_id uuid primary key references public.clientes(id) on delete cascade,
  grupo_id uuid not null references public.grupos_preco(id) on delete cascade,
  criado_em timestamptz not null default now()
);
create index on public.grupos_preco_clientes (grupo_id);
alter table public.grupos_preco enable row level security;
alter table public.grupos_preco_servicos enable row level security;
alter table public.grupos_preco_clientes enable row level security;
create policy staff_acesso_total on public.grupos_preco for all to authenticated using (private.eh_staff()) with check (private.eh_staff());
create policy staff_acesso_total on public.grupos_preco_servicos for all to authenticated using (private.eh_staff()) with check (private.eh_staff());
create policy staff_acesso_total on public.grupos_preco_clientes for all to authenticated using (private.eh_staff()) with check (private.eh_staff());

alter table public.agendamentos add column grupo_preco_id uuid references public.grupos_preco(id) on delete set null;

-- Preço especial aplicado pelo banco em todo agendamento novo (site ou
-- Admin). Promoção mais barata continua valendo; o desconto de 1ª visita /
-- cupom (trg_zz_...) roda depois e só entra se ficar ainda mais barato.
create or replace function public.aplicar_preco_grupo()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  v_especial record;
  v_base numeric;
begin
  if new.status = 'CANCELADO' or new.cliente_id is null or new.servico_id is null
     or coalesce(new.origem_pagamento, 'avulso') = 'assinatura' then
    return new;
  end if;

  select g.id, gs.preco into v_especial
    from grupos_preco_clientes gc
    join grupos_preco g on g.id = gc.grupo_id and g.ativo
    join grupos_preco_servicos gs on gs.grupo_id = g.id and gs.servico_id = new.servico_id
   where gc.cliente_id = new.cliente_id;

  select coalesce(s.preco, s.preco_minimo) into v_base from servicos s where s.id = new.servico_id;

  if tg_op = 'UPDATE' then
    -- Trocou o serviço/cliente de um agendamento que tinha preço especial:
    -- recalcula (novo especial, ou volta ao preço normal do serviço).
    if old.grupo_preco_id is null and v_especial.id is null then return new; end if;
    if v_especial.id is null then
      new.grupo_preco_id := null;
      new.preco_final := v_base;
      return new;
    end if;
    new.grupo_preco_id := v_especial.id;
    new.preco_final := v_especial.preco;
    new.preco_antes_desconto := v_base;
    return new;
  end if;

  if v_especial.id is null then return new; end if;
  if new.preco_final is null or new.preco_final = 0 or new.preco_final > v_especial.preco then
    new.preco_antes_desconto := coalesce(v_base, new.preco_final);
    new.preco_final := v_especial.preco;
    new.grupo_preco_id := v_especial.id;
  end if;
  return new;
end $$;
create trigger trg_preco_grupo before insert or update of servico_id, cliente_id on public.agendamentos
  for each row execute function public.aplicar_preco_grupo();

-- Site público: preços especiais do cliente dono do comprovante de telefone
-- (token do SMS guardado no aparelho). Sem token válido, não devolve nada.
create or replace function public.precos_especiais_cliente(p_token uuid)
returns table (servico_id uuid, preco numeric, grupo text)
language sql stable security definer set search_path to 'public' as $$
  select gs.servico_id, gs.preco, g.nome
    from telefones_verificados tv
    join grupos_preco_clientes gc on gc.cliente_id = tv.cliente_id
    join grupos_preco g on g.id = gc.grupo_id and g.ativo
    join grupos_preco_servicos gs on gs.grupo_id = g.id
   where tv.token = p_token and tv.expira_em > now();
$$;
revoke all on function public.precos_especiais_cliente(uuid) from public;
grant execute on function public.precos_especiais_cliente(uuid) to anon, authenticated;
