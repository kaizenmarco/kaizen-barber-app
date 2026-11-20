-- ============================================================================
-- Cartão Fidelidade — presente de "obrigado" para quem já era cliente.
--
-- Cliente com pelo menos 1 atendimento REALIZADO antes do lançamento do
-- cartão (config.data_lancamento) ganha `selos_obrigado_clientes` selos extras
-- (1), somados ao selo de boas-vindas (total 2 de presente). É calculado em fidelidade_estado —
-- vale também para cartões já criados e para os gerados pelo admin.
-- O 40% de 1ª visita continua só para quem nunca foi atendido.
-- ============================================================================

alter table public.config_fidelidade
  add column if not exists selos_obrigado_clientes int not null default 0
    check (selos_obrigado_clientes between 0 and 10);

update public.config_fidelidade set selos_obrigado_clientes = 1 where id = 1;

create or replace function private.fidelidade_estado(p_cliente_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  cfg config_fidelidade;
  c cartoes_fidelidade;
  v_visitas int;
  v_visitas_antes int;
  v_obrigado int;
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

  -- presente para quem já era cliente antes do cartão existir
  v_obrigado := case when v_visitas_antes > 0 then coalesce(cfg.selos_obrigado_clientes, 0) else 0 end;

  v_total := v_visitas + coalesce(c.selos_bonus, 0) + v_obrigado;
  v_base := (v_visitas_antes / cfg.meta_selos) * cfg.meta_selos;

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
    'selos_obrigado', v_obrigado,
    'recompensas_pendentes', v_pendentes,
    'cupom', jsonb_build_object('ativo', coalesce(v_cupom_ativo, false), 'expira_em', c.cupom_expira_em,
                                'usado_em', c.cupom_usado_em, 'pct', cfg.desconto_primeira_visita_pct),
    'indicacoes_creditadas', v_indicacoes
  );
end $$;

create or replace function private.fidelidade_config_json()
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('ativo', ativo, 'meta_selos', meta_selos, 'selo_brinde', selo_brinde,
    'desconto_pct', desconto_primeira_visita_pct, 'validade_cupom_dias', validade_cupom_dias,
    'selos_boas_vindas', selos_boas_vindas, 'indicacao_pct', indicacao_pct_inicial,
    'selos_obrigado', selos_obrigado_clientes,
    'brinde', jsonb_build_object('pt', brinde_pt, 'en', brinde_en, 'ja', brinde_ja),
    'premio', jsonb_build_object('pt', premio_pt, 'en', premio_en, 'ja', premio_ja))
  from config_fidelidade where id = 1
$$;
