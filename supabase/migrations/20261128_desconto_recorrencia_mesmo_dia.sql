-- Já aplicada no Supabase (migração desconto_recorrencia_mesmo_dia, 2026-11-28).
-- Regra da mensagem enviada ao cliente: "Garanta 15% de desconto se fizer o
-- próximo agendamento ainda hoje". Antes a função comparava o dia do
-- atendimento com o dia do NOVO agendamento (nunca batia). Agora: o
-- agendamento foi CRIADO no mesmo dia (horário do Japão) em que o cliente
-- foi atendido (REALIZADO ou já tinha chegado a hora), para um dia futuro.

create or replace function public.marcar_elegibilidade_desconto_recorrencia()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  v_criado timestamp := coalesce(NEW.criado_em, now() at time zone 'utc') at time zone 'utc' at time zone 'Asia/Tokyo';
  v_dia date := v_criado::date;
  v_atendido_no_dia boolean;
  v_desconto_aniversario_ativo boolean;
begin
  if NEW.status = 'CANCELADO' or NEW.cliente_id is null or NEW.data_hora::date <= v_dia then
    NEW.elegivel_desconto_recorrencia := false;
    return NEW;
  end if;

  select exists (
    select 1 from agendamentos a
     where a.cliente_id = NEW.cliente_id
       and a.id <> NEW.id
       and a.status <> 'CANCELADO'
       and a.data_hora::date = v_dia
       and (a.status = 'REALIZADO' or a.data_hora <= greatest(v_criado, now() at time zone 'Asia/Tokyo'))
  ) into v_atendido_no_dia;

  select coalesce(c.desconto_aniversario_disponivel, false)
         and (c.desconto_aniversario_expira_em is null or c.desconto_aniversario_expira_em >= current_date)
    into v_desconto_aniversario_ativo
    from clientes c where c.id = NEW.cliente_id;

  NEW.elegivel_desconto_recorrencia := coalesce(v_atendido_no_dia, false) and not coalesce(v_desconto_aniversario_ativo, false);
  return NEW;
end $$;

-- O agendamento já entra com o preço com 15% (sobre o preço normal do
-- serviço). Não soma com preço especial / promoção mais barata; o desconto
-- de 1ª visita/cupom (trg_zz_) e o vale presente (trg_zzz_) rodam depois.
create or replace function public.aplicar_desconto_recorrencia()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  v_base numeric;
  v_novo numeric;
begin
  if not coalesce(NEW.elegivel_desconto_recorrencia, false)
     or NEW.status = 'CANCELADO'
     or coalesce(NEW.origem_pagamento, 'avulso') = 'assinatura'
     or NEW.vale_presente_codigo is not null then
    return NEW;
  end if;
  select coalesce(s.preco, s.preco_minimo) into v_base from servicos s where s.id = NEW.servico_id;
  if v_base is null or v_base <= 0 then return NEW; end if;
  v_novo := round(v_base * 0.85);
  if NEW.preco_final is null or NEW.preco_final = 0 or v_novo < NEW.preco_final then
    NEW.preco_antes_desconto := v_base;
    NEW.preco_final := v_novo;
    NEW.grupo_preco_id := null;
  end if;
  return NEW;
end $$;

create trigger trg_preco_recorrencia before insert or update of servico_id, cliente_id, data_hora on public.agendamentos
  for each row execute function public.aplicar_desconto_recorrencia();

-- Segunda migração (desconto_recorrencia_sem_bloqueio_aniversario): o desconto
-- de aniversário (dado na mão pela equipe) não tira mais os 15%, porque o
-- cliente recebeu a mensagem prometendo os 15%.
create or replace function public.marcar_elegibilidade_desconto_recorrencia()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  v_criado timestamp := coalesce(NEW.criado_em, now() at time zone 'utc') at time zone 'utc' at time zone 'Asia/Tokyo';
  v_dia date := v_criado::date;
begin
  if NEW.status = 'CANCELADO' or NEW.cliente_id is null or NEW.data_hora::date <= v_dia then
    NEW.elegivel_desconto_recorrencia := false;
    return NEW;
  end if;
  NEW.elegivel_desconto_recorrencia := exists (
    select 1 from agendamentos a
     where a.cliente_id = NEW.cliente_id
       and a.id <> NEW.id
       and a.status <> 'CANCELADO'
       and a.data_hora::date = v_dia
       and (a.status = 'REALIZADO' or a.data_hora <= greatest(v_criado, now() at time zone 'Asia/Tokyo'))
  );
  return NEW;
end $$;
