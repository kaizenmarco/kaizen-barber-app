// Cliente Supabase do projeto SaaS (kaizen-saas) — multi-tenant, onde vivem
// as empresas clientes, os planos e o Super Admin.
//
// Este é um projeto DIFERENTE do supabaseClient.js (que continua apontando
// pro banco de produção da Kaizen Barber Shop original). Não misturar os
// dois: telas do app de UMA barbearia usam supabaseClient.js; telas do
// SaaS (Super Admin, futura tela de onboarding) usam este arquivo.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_SAAS_URL = 'https://bjrrgxfghwumhirvdpmx.supabase.co';
const SUPABASE_SAAS_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqcnJneGZnaHd1bWhpcnZkcG14Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4OTI3MzgsImV4cCI6MjEwMzQ2ODczOH0.WK8s-Q-LGBds2fm9Xtb01X2oNhqelFFzFKb2kfw1Atw';

export const supabaseSaaS = createClient(SUPABASE_SAAS_URL, SUPABASE_SAAS_ANON_KEY);
