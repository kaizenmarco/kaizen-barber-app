-- ============================================================================
-- Atendente de WhatsApp com IA (Kapso + Claude) — Kaizen Barber Shop
-- Só ACRESCENTA tabelas novas; não altera nenhuma tabela existente.
-- Usado pela Edge Function supabase/functions/whatsapp-atendente.
-- ============================================================================

-- Uma linha por número de WhatsApp de cliente.
--   mensagens: histórico da conversa atual no formato da API do Claude
--              (só cresce; é zerado quando a conversa fica parada por horas).
--   pausado:   true = a IA não responde esse número (a equipe assume o papo).
--   lock_ate:  trava curta pra duas mensagens seguidas não serem respondidas
--              ao mesmo tempo (cada uma com uma resposta diferente).
create table if not exists public.whatsapp_conversas (
  telefone text primary key,
  nome_whatsapp text,
  mensagens jsonb not null default '[]'::jsonb,
  pausado boolean not null default false,
  lock_ate timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Cada mensagem recebida (id do WhatsApp é único → a Kapso pode reenviar o
-- mesmo evento sem a IA responder duas vezes).
create table if not exists public.whatsapp_mensagens_recebidas (
  wamid text primary key,
  telefone text not null,
  texto text,
  tipo text,
  processado boolean not null default false,
  criado_em timestamptz not null default now()
);

create index if not exists whatsapp_mensagens_recebidas_pendentes
  on public.whatsapp_mensagens_recebidas (telefone, criado_em)
  where processado = false;

-- Só a Edge Function (service role) mexe nessas tabelas. Com RLS ligado e
-- nenhuma policy, o app público (anon) não consegue ler as conversas.
alter table public.whatsapp_conversas enable row level security;
alter table public.whatsapp_mensagens_recebidas enable row level security;
