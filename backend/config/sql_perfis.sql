-- Tabela de perfis: liga cada conta de login (auth.users) a um papel de
-- acesso dentro do painel admin.
--
-- role:
--   'admin'                -> acesso completo (Dashboard, Agendamentos,
--                              Clientes, Profissionais, Caixa, Comandas,
--                              Fidelidade, Ordem de Chegada)
--   'profissional_restrito' -> acesso só a Agendamentos, Comandas e Ordem
--                              de Chegada. É o papel padrão de qualquer
--                              conta nova (menor privilégio por padrão).
create table if not exists perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  email text,
  role text not null default 'profissional_restrito' check (role in ('admin', 'profissional_restrito')),
  profissional_uuid text,
  criado_em timestamptz not null default now()
);

alter table perfis enable row level security;

-- Cada pessoa só consegue ler o próprio perfil (para saber seu papel após
-- o login). Não existe policy de UPDATE/INSERT/DELETE para anon/authenticated
-- de propósito: promover alguém a 'admin' só pode ser feito por aqui
-- (SQL Editor, com a role postgres), nunca pelo próprio app.
drop policy if exists "Usuario le proprio perfil" on perfis;
create policy "Usuario le proprio perfil"
  on perfis for select
  using (auth.uid() = id);

-- Cria automaticamente um perfil (com o papel mínimo) sempre que alguém
-- se cadastra pela tela de login do app.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.perfis (id, nome, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    new.email,
    'profissional_restrito'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Depois que Marco, Gabriel e Neia se cadastrarem no app (cada um com sua
-- própria senha), rode o bloco abaixo para dar acesso completo aos três.
-- Ajuste os e-mails se algum estiver diferente do combinado.
-- ----------------------------------------------------------------------------
-- update perfis set role = 'admin', profissional_uuid = '11c0c7fb-e020-4c49-ab0a-28a16109b35f' where email = 'kaizenbarbershopjapan@gmail.com';
-- update perfis set role = 'admin', profissional_uuid = '66266181-d06b-4f54-bcc9-12dccc100cb4' where email = 'gkmiasato09@gmail.com';
-- update perfis set role = 'admin', profissional_uuid = 'ad232428-9872-46db-82b3-27819ab353ff' where email = 'idineis.gica.miasato@gmail.com';
