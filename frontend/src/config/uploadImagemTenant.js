import { supabase } from './supabaseClientTenant';

// Envia uma imagem pro bucket compartilhado "empresas-imagens", sempre dentro
// da pasta da própria empresa (empresaId/subpasta/arquivo) — é esse prefixo
// que a política de storage usa pra isolar os arquivos de cada empresa,
// mesma lógica do RLS nas tabelas do banco. Devolve a URL pública do
// arquivo, pra salvar no registro (empresas.logo_url, profissionais.imagem_url
// ou servicos.imagem_url).
export async function enviarImagemTenant(empresaId, arquivo, subpasta) {
  if (!empresaId) throw new Error('empresaId é obrigatório para enviar imagem.');
  if (!arquivo) throw new Error('Nenhum arquivo selecionado.');

  const extensao = arquivo.name.split('.').pop();
  const nomeUnico = `${Date.now()}-${Math.random().toString(36).slice(2)}.${extensao}`;
  const caminho = `${empresaId}/${subpasta}/${nomeUnico}`;

  const { error } = await supabase.storage
    .from('empresas-imagens')
    .upload(caminho, arquivo, { upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from('empresas-imagens').getPublicUrl(caminho);
  return data.publicUrl;
}
