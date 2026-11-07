import React from 'react';

// Endereço do painel do Kaizen Flow (subdomínio da página de vendas) e
// WhatsApp do suporte — os mesmos do e-mail de boas-vindas que o
// stripe-webhook manda logo depois do pagamento.
const URL_PAINEL = 'https://painel.kaizenflowaplicativo.com';
const WHATSAPP_SUPORTE = '818097242512';

const estilos = {
  pagina: { minHeight: '100vh', background: '#1a1a1a', color: '#e8e8e8', fontFamily: 'system-ui, sans-serif', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' },
  cartao: { background: '#2d2d2d', border: '2px solid #d4af37', borderRadius: '12px', padding: '40px', maxWidth: '480px', textAlign: 'center' },
  icone: { fontSize: '48px', marginBottom: '12px' },
  titulo: { color: '#d4af37', fontSize: '22px', marginBottom: '14px' },
  texto: { color: '#ccc', fontSize: '14px', lineHeight: 1.6, margin: '0 0 14px' },
  bonus: { background: '#1a1a1a', border: '1px solid #444', borderRadius: '8px', padding: '16px', margin: '18px 0', textAlign: 'left' },
  bonusTitulo: { color: '#d4af37', fontSize: '15px', margin: '0 0 8px' },
  lista: { color: '#ccc', fontSize: '13px', lineHeight: 1.7, margin: 0, paddingLeft: '18px' },
  botao: { display: 'inline-block', background: '#d4af37', color: '#1a1a1a', fontWeight: 'bold', padding: '12px 22px', borderRadius: '6px', textDecoration: 'none' },
  ajuda: { color: '#999', fontSize: '12px', lineHeight: 1.6, marginTop: '18px' },
  linkAjuda: { color: '#d4af37' },
};

export default function CadastroSucesso() {
  return (
    <div style={estilos.pagina}>
      <div style={estilos.cartao}>
        <div style={estilos.icone}>✅</div>
        <h1 style={estilos.titulo}>Pagamento confirmado!</h1>
        <p style={estilos.texto}>
          Sua assinatura foi criada e a conta é ativada em alguns instantes. Enviamos para o
          e-mail que você cadastrou as instruções de acesso — se ainda não tem senha, o e-mail
          traz o link para criar a sua.
        </p>

        <div style={estilos.bonus}>
          <h2 style={estilos.bonusTitulo}>🎁 Seus bônus já estão liberados</h2>
          <ul style={estilos.lista}>
            <li>Implantação Kaizen — a barbearia pronta em 5 passos</li>
            <li>Manual de Bolso da Equipe — planos Intermediário e Completo</li>
            <li>Migração Sem Perder Histórico — plano Completo</li>
          </ul>
          <p style={{ ...estilos.texto, fontSize: '13px', margin: '10px 0 0' }}>
            Estão no painel, na aba <strong>Meus Bônus</strong>, em PDF.
          </p>
        </div>

        <a href={URL_PAINEL} style={estilos.botao}>Acessar meu painel</a>

        <p style={estilos.ajuda}>
          O e-mail não chegou em alguns minutos? Confira o spam ou fale com o suporte no{' '}
          <a href={`https://wa.me/${WHATSAPP_SUPORTE}`} style={estilos.linkAjuda} target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>.
        </p>
      </div>
    </div>
  );
}
