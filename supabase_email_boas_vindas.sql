-- E-mail de boas-vindas do Kaizen Flow (projeto kaizen-saas).
--
-- O stripe-webhook manda o e-mail no primeiro checkout.session.completed.
-- Esta coluna é a trava: o webhook só envia se conseguir preenchê-la (update
-- ... where email_boas_vindas_enviado_em is null), então um evento repetido
-- pela Stripe não manda o e-mail de novo.
alter table public.empresas
  add column if not exists email_boas_vindas_enviado_em timestamptz;
