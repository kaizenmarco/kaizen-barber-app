-- Lista de espera: quando um cliente não acha horário disponível com o
-- profissional/dia escolhido, pode deixar o contato aqui. Consulte esta
-- tabela pelo Table Editor do Supabase para ver quem está esperando.
create table if not exists lista_espera (
  id bigint generated always as identity primary key,
  nome text not null,
  email text not null,
  telefone text,
  servico text,
  profissional text,
  data_desejada date,
  criado_em timestamptz not null default now()
);

alter table lista_espera enable row level security;

drop policy if exists "Leitura publica lista_espera" on lista_espera;
create policy "Leitura publica lista_espera"
  on lista_espera for select
  using (true);

drop policy if exists "Insercao publica lista_espera" on lista_espera;
create policy "Insercao publica lista_espera"
  on lista_espera for insert
  with check (true);
