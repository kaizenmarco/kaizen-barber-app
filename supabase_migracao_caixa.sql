-- ============================================================================
-- Migração: Comandas ↔ Caixa ↔ Comissão (Kaizen Barber Shop)
-- Já foi aplicada diretamente no Supabase (projeto kaizen-barber) via MCP em
-- 10/08/2026. Mantido aqui só como documentação — não precisa rodar de novo
-- (os comandos são idempotentes, então rodar novamente não quebra nada).
--
-- Observação: o banco já tinha uma tabela "caixa" (vazia, criada num design
-- anterior do projeto, com colunas categoria/registrado_por obrigatórias e
-- sem conceito de "dia aberto/fechado"). Optei por não reaproveitá-la e criar
-- caixa_dias/caixa_movimentacoes novas, mais simples e alinhadas com como o
-- app realmente funciona hoje (sem tabela de usuários/login via Supabase
-- Auth). A tabela "caixa" antiga ficou intocada, sem uso.
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

-- 4) Permissões — NÃO ativei RLS aqui de propósito: todas as outras tabelas
--    do projeto (profissionais, agendamentos, clientes, servicos etc.) estão
--    com RLS desligado, porque o app inteiro (site público + Admin) acessa o
--    Supabase direto pela chave anônima, sem login de usuário. Ativar RLS só
--    nas tabelas novas, sem mexer nas outras, não resolveria a segurança e
--    ainda quebraria a gravação automática do caixa. Isso é um problema maior
--    do projeto todo — ver aviso de segurança separado.
