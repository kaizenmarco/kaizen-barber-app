alter table clientes add column if not exists line_user_id text unique;
comment on column clientes.line_user_id is 'ID do usuário no LINE (Messaging API), preenchido quando o cliente se vincula à conta oficial do LINE da Kaizen Barber Shop.';
