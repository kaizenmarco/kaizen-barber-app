import React, { useEffect, useRef, useState } from 'react';
import { PAISES_TELEFONE, PAIS_TELEFONE_PADRAO, montarTelefoneInternacional } from '../config/paisesTelefone';

// Separa um telefone salvo em { pais, numero }. Salvo com "+" -> acha o país
// pelo prefixo (o mais longo primeiro, pra +591 não virar +5). Sem "+" é
// cadastro antigo, sempre do Japão (era o único formato antes do seletor).
const separarTelefone = (telefone) => {
  const bruto = (telefone || '').trim();
  if (!bruto.startsWith('+')) return { pais: PAIS_TELEFONE_PADRAO, numero: bruto };
  const digitos = bruto.replace(/\D/g, '');
  const pais = [...PAISES_TELEFONE]
    .sort((a, b) => b.codigo.length - a.codigo.length)
    .find(p => digitos.startsWith(p.codigo));
  if (!pais) return { pais: PAIS_TELEFONE_PADRAO, numero: bruto };
  return { pais: pais.codigo, numero: digitos.slice(pais.codigo.length) };
};

// Campo de telefone com seletor de país, pro Admin (mesma lista de países do
// site público). Devolve em onChange o número já no formato internacional
// (+81..., +55...), que é o que o WhatsApp do Admin e o SMS esperam.
function CampoTelefone({ value, onChange, placeholder, required, estiloSelect, estiloInput }) {
  const [pais, setPais] = useState(() => separarTelefone(value).pais);
  const [numero, setNumero] = useState(() => separarTelefone(value).numero);
  const ultimoEmitido = useRef(value);

  // Valor trocado de fora (ex.: escolheu um cliente da lista de sugestões,
  // ou o formulário foi limpo) — reparte em país + número.
  useEffect(() => {
    if (value === ultimoEmitido.current) return;
    const separado = separarTelefone(value);
    setPais(separado.pais);
    setNumero(separado.numero);
    ultimoEmitido.current = value;
  }, [value]);

  const emitir = (novoPais, novoNumero) => {
    const completo = montarTelefoneInternacional(novoPais, novoNumero);
    ultimoEmitido.current = completo;
    onChange(completo);
  };

  return (
    <div style={{ display: 'flex', gap: '6px', width: '100%' }}>
      <select
        aria-label="País"
        value={pais}
        onChange={(e) => { setPais(e.target.value); emitir(e.target.value, numero); }}
        style={{ flex: '0 0 auto', width: 'auto', maxWidth: '45%', ...estiloSelect }}
      >
        {PAISES_TELEFONE.map(p => (
          <option key={p.codigo} value={p.codigo}>{p.bandeira} +{p.codigo}</option>
        ))}
      </select>
      <input
        type="tel"
        autoComplete="tel-national"
        placeholder={placeholder}
        value={numero}
        required={required}
        onChange={(e) => { setNumero(e.target.value); emitir(pais, e.target.value); }}
        style={{ flex: '1 1 0', width: 'auto', minWidth: 0, ...estiloInput }}
      />
    </div>
  );
}

export default CampoTelefone;
