import React from 'react';

const estilos = {
  pagina: { minHeight: '100vh', background: '#1a1a1a', color: '#e8e8e8', fontFamily: 'system-ui, sans-serif', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' },
  cartao: { background: '#2d2d2d', border: '2px solid #d4af37', borderRadius: '12px', padding: '40px', maxWidth: '440px', textAlign: 'center' },
  icone: { fontSize: '48px', marginBottom: '12px' },
  titulo: { color: '#d4af37', fontSize: '22px', marginBottom: '14px' },
  texto: { color: '#ccc', fontSize: '14px', lineHeight: 1.6 },
};

export default function CadastroSucesso() {
  return (
    <div style={estilos.pagina}>
      <div style={estilos.cartao}>
        <div style={estilos.icone}>✅</div>
        <h1 style={estilos.titulo}>Pagamento confirmado!</h1>
        <p style={estilos.texto}>
          Sua assinatura foi criada com sucesso. Em alguns instantes sua conta é
          ativada automaticamente. Você receberá as instruções de acesso no
          e-mail que cadastrou. Se não chegar em alguns minutos, verifique o spam
          ou entre em contato conosco.
        </p>
      </div>
    </div>
  );
}
