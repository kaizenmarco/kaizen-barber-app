-- ============================================================================
-- Kaizen Flow — fidelidade com as regras do próprio dono
--
-- * Sem regras pré-preenchidas: % da 1ª visita, validade, nº de selos,
--   brinde, prêmio e indicação começam em branco. O programa só pode ser
--   ligado com o mínimo preenchido (constraint config_completa_para_ativar).
--   Indicação em branco/0 = quem indica não ganha cupom.
-- * Carimbo do cartão à escolha: tesoura, logo da barbearia ou imagem própria
--   (o painel sobe uma cópia 240px em selo_imagem_url para o cartão ficar leve).
-- ============================================================================

alter table public.config_fidelidade
  alter column desconto_primeira_visita_pct drop not null, alter column desconto_primeira_visita_pct drop default,
  alter column validade_cupom_dias drop not null, alter column validade_cupom_dias drop default,
  alter column meta_selos drop not null, alter column meta_selos drop default,
  alter column selo_brinde drop default,
  alter column selos_boas_vindas set default 0,
  alter column brinde_pt drop not null, alter column brinde_pt drop default,
  alter column brinde_en drop not null, alter column brinde_en drop default,
  alter column brinde_ja drop not null, alter column brinde_ja drop default,
  alter column premio_pt drop not null, alter column premio_pt drop default,
  alter column premio_en drop not null, alter column premio_en drop default,
  alter column premio_ja drop not null, alter column premio_ja drop default,
  alter column indicacao_pct_inicial drop not null, alter column indicacao_pct_inicial drop default,
  alter column indicacao_reducao_pct drop not null, alter column indicacao_reducao_pct drop default,
  alter column indicacao_minimo_pct drop not null, alter column indicacao_minimo_pct drop default;

alter table public.config_fidelidade
  add column if not exists selo_estilo text not null default 'tesoura' check (selo_estilo in ('tesoura', 'logo', 'imagem')),
  add column if not exists selo_imagem_url text;

alter table public.config_fidelidade drop constraint if exists config_completa_para_ativar;
alter table public.config_fidelidade add constraint config_completa_para_ativar check (
  not ativo or (
    meta_selos is not null and validade_cupom_dias is not null and desconto_primeira_visita_pct is not null
    and coalesce(btrim(premio_pt), '') <> ''
    and (coalesce(selo_brinde, 0) = 0 or coalesce(btrim(brinde_pt), '') <> '')
  )
);

-- Config pública: inclui o carimbo já resolvido em URL.
create or replace function private.fidelidade_config_json(p_empresa_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('ativo', c.ativo, 'meta_selos', c.meta_selos, 'selo_brinde', c.selo_brinde,
    'desconto_pct', coalesce(c.desconto_primeira_visita_pct, 0), 'validade_cupom_dias', c.validade_cupom_dias,
    'selos_boas_vindas', coalesce(c.selos_boas_vindas, 0), 'indicacao_pct', coalesce(c.indicacao_pct_inicial, 0),
    'brinde', jsonb_build_object('pt', c.brinde_pt, 'en', c.brinde_en, 'ja', c.brinde_ja),
    'premio', jsonb_build_object('pt', c.premio_pt, 'en', c.premio_en, 'ja', c.premio_ja),
    'selo_url', case c.selo_estilo
                  when 'logo' then coalesce(c.selo_imagem_url, e.logo_pequeno_url, e.logo_url)  -- cópia 240px gerada no painel
                  when 'imagem' then c.selo_imagem_url
                end)
  from config_fidelidade c join empresas e on e.id = c.empresa_id
  where c.empresa_id = p_empresa_id
$$;

-- Estado do cartão tolerante a regras ainda em branco.
create or replace function private.fidelidade_estado(p_cliente_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_empresa uuid;
  cfg config_fidelidade;
  c cartoes_fidelidade;
  v_meta int; v_brinde int;
  v_visitas int; v_visitas_antes int; v_total int; v_base int; v_marco int;
  v_pendentes jsonb := '[]'::jsonb;
  v_tem_realizado boolean; v_cupom_ativo boolean; v_indicacoes int;
begin
  select empresa_id into v_empresa from clientes where id = p_cliente_id;
  cfg := private.fidelidade_config(v_empresa);
  v_meta := coalesce(cfg.meta_selos, 10);
  v_brinde := cfg.selo_brinde;
  select * into c from cartoes_fidelidade where cliente_id = p_cliente_id;

  select count(*) filter (where conta_pontos_fidelidade is not false),
         count(*) filter (where conta_pontos_fidelidade is not false and data_hora::date < cfg.data_lancamento),
         count(*) > 0
    into v_visitas, v_visitas_antes, v_tem_realizado
  from agendamentos where cliente_id = p_cliente_id and status = 'REALIZADO';

  v_total := v_visitas + coalesce(c.selos_bonus, 0);
  v_base := (v_visitas_antes / v_meta) * v_meta;

  v_marco := v_base;
  while v_marco < v_total loop
    if v_brinde is not null and v_brinde > 0 and v_brinde < v_meta
       and v_marco + v_brinde <= v_total
       and not exists (select 1 from resgates_fidelidade r where r.cliente_id = p_cliente_id and r.marco = v_marco + v_brinde) then
      v_pendentes := v_pendentes || jsonb_build_object('tipo', 'brinde', 'marco', v_marco + v_brinde);
    end if;
    if v_marco + v_meta <= v_total
       and not exists (select 1 from resgates_fidelidade r where r.cliente_id = p_cliente_id and r.marco = v_marco + v_meta) then
      v_pendentes := v_pendentes || jsonb_build_object('tipo', 'premio', 'marco', v_marco + v_meta);
    end if;
    v_marco := v_marco + v_meta;
  end loop;

  v_cupom_ativo := c.cliente_id is not null and c.cupom_expira_em is not null and c.cupom_usado_em is null
                   and c.cupom_expira_em >= current_date and not v_tem_realizado;

  select count(*) into v_indicacoes from cartoes_fidelidade x where x.indicado_por = p_cliente_id and x.indicacao_creditada;

  return jsonb_build_object(
    'selos_total', v_total,
    'selos_no_ciclo', case when v_total > 0 and v_total % v_meta = 0 and jsonb_array_length(v_pendentes) > 0
                           then v_meta else v_total % v_meta end,
    'visitas', v_visitas,
    'selos_bonus', coalesce(c.selos_bonus, 0),
    'recompensas_pendentes', v_pendentes,
    'cupom', jsonb_build_object('ativo', coalesce(v_cupom_ativo, false), 'expira_em', c.cupom_expira_em,
                                'usado_em', c.cupom_usado_em, 'pct', coalesce(cfg.desconto_primeira_visita_pct, 0)),
    'indicacoes_creditadas', v_indicacoes
  );
end $$;

-- Indicação: em branco/0 = sem cupom para quem indica.
create or replace function private.fidelidade_ao_realizar()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c cartoes_fidelidade;
  cfg config_fidelidade;
  v_ult record;
  v_degrau int;
  v_pct int;
  v_dias int;
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
    v_dias := coalesce(cfg.validade_cupom_dias, 0);
    if coalesce(cfg.indicacao_pct_inicial, 0) > 0 and v_dias > 0 then
      select cf.degrau, cf.criado_em into v_ult
      from cupons_fidelidade cf
      where cf.cliente_id = c.indicado_por and cf.tipo = 'indicacao'
      order by cf.criado_em desc, cf.degrau desc limit 1;

      if v_ult.criado_em is null or v_ult.criado_em < now() - make_interval(days => v_dias) then
        v_degrau := 0;
      else
        v_degrau := v_ult.degrau + 1;
      end if;
      v_pct := greatest(cfg.indicacao_pct_inicial - v_degrau * coalesce(cfg.indicacao_reducao_pct, 0),
                        coalesce(cfg.indicacao_minimo_pct, 0));

      if v_pct > 0 then
        insert into cupons_fidelidade (empresa_id, cliente_id, tipo, pct, degrau, indicado_cliente_id, expira_em)
        values (c.empresa_id, c.indicado_por, 'indicacao', least(v_pct, 100), v_degrau, NEW.cliente_id,
                current_date + v_dias);
      end if;
    end if;
  end if;
  return NEW;
end $$;
