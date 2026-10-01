// Países oferecidos no seletor de telefone do app público. O número é salvo
// no formato internacional (+país...), pra o Admin abrir o WhatsApp do
// cliente no país certo. A mesma lista de códigos está liberada na Edge
// Function verificar-telefone (PREFIXOS_PERMITIDOS) — se adicionar um país
// aqui, adicione lá também.
export const PAISES_TELEFONE = [
  { codigo: '81', bandeira: '🇯🇵', nome: 'Japan / 日本' },
  { codigo: '55', bandeira: '🇧🇷', nome: 'Brasil' },
  { codigo: '51', bandeira: '🇵🇪', nome: 'Perú' },
  { codigo: '63', bandeira: '🇵🇭', nome: 'Philippines' },
  { codigo: '84', bandeira: '🇻🇳', nome: 'Việt Nam' },
  { codigo: '62', bandeira: '🇮🇩', nome: 'Indonesia' },
  { codigo: '977', bandeira: '🇳🇵', nome: 'Nepal' },
  { codigo: '86', bandeira: '🇨🇳', nome: '中国' },
  { codigo: '82', bandeira: '🇰🇷', nome: '한국' },
  { codigo: '66', bandeira: '🇹🇭', nome: 'Thailand' },
  { codigo: '591', bandeira: '🇧🇴', nome: 'Bolivia' },
  { codigo: '595', bandeira: '🇵🇾', nome: 'Paraguay' },
  { codigo: '54', bandeira: '🇦🇷', nome: 'Argentina' },
  { codigo: '1', bandeira: '🇺🇸', nome: 'USA / Canada' },
  { codigo: '351', bandeira: '🇵🇹', nome: 'Portugal' },
  { codigo: '34', bandeira: '🇪🇸', nome: 'España' },
  { codigo: '44', bandeira: '🇬🇧', nome: 'United Kingdom' },
];

export const PAIS_TELEFONE_PADRAO = '81';

// "090-1234-5678" + Japão -> "+819012345678". Tira o 0 inicial de discagem
// nacional (Japão, Brasil "011..." etc.). Se a pessoa já digitou com "+",
// respeita o que ela escreveu e ignora o seletor.
export const montarTelefoneInternacional = (codigoPais, numeroDigitado) => {
  const bruto = (numeroDigitado || '').trim();
  if (bruto.startsWith('+')) return '+' + bruto.replace(/\D/g, '');
  const digitos = bruto.replace(/\D/g, '').replace(/^0+/, '');
  if (!digitos) return '';
  return `+${codigoPais}${digitos}`;
};

// Mínimo de 8 dígitos no número local, máximo de 15 no total (padrão E.164).
export const telefoneInternacionalValido = (telefone) => {
  if (!/^\+[1-9]\d{7,14}$/.test(telefone)) return false;
  const pais = PAISES_TELEFONE.find(p => telefone.startsWith(`+${p.codigo}`));
  return !!pais && telefone.length - 1 - pais.codigo.length >= 8;
};
