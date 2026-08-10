-- ============================================================================
-- Migração: Comandas ↔ Caixa ↔ Comissão (Kaizen Barber Shop)
-- Rode este script inteiro no Supabase: Dashboard > SQL Editor > New query > Run
-- ============================================================================

-- 1) Comissão de cada profissional (editável na tela Profissionais do Admin)
alter table public.profissionais
  add column if not exists comissao_percentual numeric not null default 40;

-- 2) Um registro por dia de caixa (aberto/fechado, saldo inicial, horários)
create table if not exists public.caixa_dias (
  id uuid primary key default gen_random_uuid(),
  data date not null unique,
  status text not null default 'fechado' check (status in ('aberto', 'fechado')),
  saldo_inicial numeric not null default 0,
  aberto_em timestamptz,
  fechado_em timestamptz,
  criado_em timestamptz not null default now()
);

-- 3) Cada entrada/saída de dinheiro (gerada automaticamente ao fechar uma
--    comanda, ou lançada manualmente pelo Admin)
create table if not exists public.caixa_movimentacoes (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  hora time not null default current_time,
  tipo text not null check (tipo in ('entrada', 'saida')),
  descricao text,
  valor numeric not null,
  profissional_id uuid references public.profissionais(id) on delete set null,
  agendamento_id uuid references public.agendamentos(id) on delete set null,
  criado_em timestamptz not null default now()
);

create index if not exists idx_caixa_mov_data on public.caixa_movimentacoes(data);
create index if not exists idx_caixa_mov_profissional on public.caixa_movimentacoes(profissional_id);

-- 4) Permissões — mesma política aberta que as tabelas agendamentos/clientes
--    já usam (o app público/admin usa a chave anônima, sem login de usuário).
--    Se alguma das outras tabelas tiver RLS desativado em vez de policy,
--    e o Admin der erro de permissão ao salvar, desative o RLS aqui também
--    em Table Editor > (tabela) > ... > Disable RLS.
alter table public.caixa_dias enable row level security;
alter table public.caixa_movimentacoes enable row level security;

drop policy if exists "Acesso total caixa_dias" on public.caixa_dias;
create policy "Acesso total caixa_dias" on public.caixa_dias for all using (true) with check (true);

drop policy if exists "Acesso total caixa_movimentacoes" on public.caixa_movimentacoes;
create policy "Acesso total caixa_movimentacoes" on public.caixa_movimentacoes for all using (true) with check (true);
