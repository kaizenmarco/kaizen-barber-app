# Kaizen Flow: passar o Stripe do teste para o real

Hoje o Kaizen Flow cobra numa conta **sandbox** do Stripe ("New business"): nenhum pagamento é real.
Estes são os passos para começar a receber de verdade.

## 1. Ativar a conta do Stripe (você)

1. Entre em dashboard.stripe.com e clique em **Verify your business** (ou "Ativar pagamentos").
2. Preencha os dados da empresa, os seus dados e a conta bancária para receber.
3. Espere o Stripe aprovar (às vezes é na hora, às vezes leva 1 ou 2 dias).

## 2. Pegar as duas chaves secretas (você)

- **Chave de teste:** no sandbox "New business" → Developers → API keys → Secret key (`sk_test_...`).
- **Chave real:** saia do sandbox (modo Live) → Developers → API keys → Secret key (`sk_live_...`).

Não mande essas chaves por chat ou e-mail; elas só entram no comando abaixo, no seu terminal.

## 3. Rodar o script (você, no terminal)

Primeiro uma simulação, que só lê e mostra o que vai criar:

```bash
cd ~/kaizen-barber-app
STRIPE_TEST_KEY=sk_test_COLE_AQUI node scripts/stripe-copiar-para-producao.mjs --simular
```

Se a lista mostrar os 8 preços (Básico, Intermediário, Completo e Profissional Adicional, em JPY e BRL),
rode para valer:

```bash
STRIPE_TEST_KEY=sk_test_COLE_AQUI STRIPE_LIVE_KEY=sk_live_COLE_AQUI node scripts/stripe-copiar-para-producao.mjs
```

O script cria no Stripe real:
- os 4 produtos e os 8 preços, com os mesmos valores do teste;
- o cupom de 50% e o código **KAIZENAMIGO**;
- o webhook que avisa o Kaizen Flow dos pagamentos, nos 5 eventos que ele usa.

No fim ele grava o arquivo `~/kaizen-stripe-producao.env` com tudo que a Supabase precisa.

## 4. Colar os secrets na Supabase (você)

1. Abra Supabase → projeto **kaizen-saas** → Edge Functions → **Secrets**.
2. Abra o arquivo `~/kaizen-stripe-producao.env`, copie tudo e cole no campo de colar vários pares
   ("paste key-value pairs"). Clique em **Save**.
3. Apague o arquivo: `rm ~/kaizen-stripe-producao.env`

A partir desse momento o checkout já cobra de verdade.

## 5. Conferir (me avise que eu faço)

- Confiro se o webhook real está recebendo e se as funções leem as chaves novas.
- Limpo as barbearias de teste que apontam para clientes do sandbox
  (Barbearia Bárbaros, Kaizen Flow App, Barbearia SIlva, Marco Neia Barber SHOP).
- Uma compra real pequena (sua) com reembolso logo depois confirma tudo de ponta a ponta.

## Fora deste passo

A assinatura da própria Kaizen Barber Shop (aba Planos, projeto kaizen-barber, função
`stripe-assinatura-webhook`) também usa o sandbox. É uma migração separada.
