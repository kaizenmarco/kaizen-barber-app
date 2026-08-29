import React from 'react';
import { Link } from 'react-router-dom';

const estilos = {
  pagina: { minHeight: '100vh', background: '#1a1a1a', color: '#e8e8e8', fontFamily: 'system-ui, sans-serif', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' },
  cartao: { background: '#2d2d2d', border: '1px solid #333', borderRadius: '12px', padding: '40px', maxWidth: '440px', textAlign: 'center' },
  icone: { fontSize: '48px', marginBottom: '12px' },
  titulo: { color: '#e8e8e8', fontSize: '22px', marginBottom: '14px' },
  texto: { color: '#ccc', fontSize: '14px', lineHeight: 1.6, marginBottom: '24px' },
  botao: { display: 'inline-block', padding: '12px 24px', background: '#d4af37', color: '#1a1a1a', borderRadius: '6px', fontWeight: 'bold', textDecoration: 'none' },
};

export default function CadastroCancelado() {
  return (
    <div style={estilos.pagina}>
      <div style={estilos.cartao}>
        <div style={estilos.icone}>⚠️</div>
        <h1 style={estilos.titulo}>Pagamento não concluído</h1>
        <p style={estilos.texto}>
          Você saiu antes de finalizar o pagamento. Nenhuma cobrança foi feita.
          Quando quiser, pode tentar novamente.
        </p>
        <Link to="/cadastro" style={estilos.botao}>Voltar para o cadastro</Link>
      </div>
    </div>
  );
}
