// Cliente Supabase para as telas do painel administrativo MULTI-TENANT
// (Kaizen Flow App). Reexporta o cliente do projeto kaizen-saas com o
// mesmo nome ("supabase") que as páginas originais já esperam — assim,
// cada página copiada em pages/tenant/ só precisa trocar de ONDE importa
// "supabase", sem tocar em nenhuma outra linha do arquivo.
export { supabaseSaaS as supabase } from './supabaseClientSaaS';
