-- Tabela de configuração do "horário estendido" (feriados prolongados etc.)
-- Linha única (id fixo = 1) que liga/desliga um horário de abertura
-- diferente do padrão do salão, válido para todos os profissionais,
-- dentro de um intervalo de datas.
create table if not exists configuracoes_horario (
  id int primary key default 1,
  ativo boolean not null default false,
  abertura text not null default '08:00',
  data_inicio date,
  data_fim date,
  atualizado_em timestamptz not null default now(),
  constraint configuracoes_horario_singleton check (id = 1)
);

insert into configuracoes_horario (id)
values (1)
on conflict (id) do nothing;

-- RLS: o app usa apenas a chave anônima (sem login de admin real), então
-- liberamos leitura e escrita para o anon, igual já acontece hoje nas
-- tabelas "agendamentos" e "clientes" deste projeto.
alter table configuracoes_horario enable row level security;

drop policy if exists "Leitura publica configuracoes_horario" on configuracoes_horario;
create policy "Leitura publica configuracoes_horario"
  on configuracoes_horario for select
  using (true);

drop policy if exists "Atualizacao publica configuracoes_horario" on configuracoes_horario;
create policy "Atualizacao publica configuracoes_horario"
  on configuracoes_horario for update
  using (true)
  with check (true);
