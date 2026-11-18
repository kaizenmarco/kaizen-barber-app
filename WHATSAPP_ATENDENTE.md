# Atendente de WhatsApp com IA (Kapso + Claude)

O cliente manda mensagem no WhatsApp da barbearia e a IA responde sozinha: tira dúvidas, mostra horários livres, agenda, mostra e cancela horários. Funciona 24h, em português, japonês, inglês e espanhol.

O agendamento cai na mesma tabela do site, então tudo que já existe continua funcionando: Agenda do Admin, push, e-mail, aviso no seu WhatsApp e trava contra conflito de horário.

## O que já está pronto

- Função `whatsapp-atendente` publicada no Supabase (projeto da Kaizen Barber Shop). Fica desligada até as chaves abaixo serem configuradas.
- Tabelas novas `whatsapp_conversas` e `whatsapp_mensagens_recebidas` (arquivo `supabase_whatsapp_atendente.sql`). Nenhuma tabela existente foi alterada.

## Para ligar (uma vez só)

1. **Kapso:** crie a conta em app.kapso.ai e conecte o número da barbearia, escolhendo "usar meu próprio número". Esse número sai do app comum do WhatsApp e passa a funcionar só pela API.
2. **Kapso → API keys:** gere uma chave.
3. **Kapso → Webhooks do número:** crie um webhook com:
   - URL: `https://unnoljaucmqygdrzhppn.supabase.co/functions/v1/whatsapp-atendente`
   - Evento: `whatsapp.message.received`
   - Tipo: Kapso, payload `v2`
   - Buffer ligado, com 5 segundos (junta mensagens mandadas em sequência)
   - Guarde o "secret" do webhook.
4. **Anthropic:** crie uma chave da API do Claude em console.anthropic.com.
5. **Supabase → Edge Functions → Secrets:** adicione
   - `ANTHROPIC_API_KEY`
   - `KAPSO_API_KEY`
   - `KAPSO_WEBHOOK_SECRET`
   - `KAPSO_PHONE_NUMBER_ID` (opcional: é o id do número que aparece na Kapso)
6. Mande "oi" de outro celular para o número e veja a resposta.

## No dia a dia

- **Assumir uma conversa:** no Supabase, na tabela `whatsapp_conversas`, marque `pausado = true` no número do cliente. A IA para de responder esse número até você desmarcar.
- **Ver as conversas:** a tabela `whatsapp_conversas` guarda o histórico. O inbox da Kapso também mostra tudo.
- **Agendamentos feitos pela IA** aparecem com a observação "Agendado pelo WhatsApp (atendente IA)".

## Regras que a IA segue (iguais às do site)

- Agenda até 90 dias à frente, só em horários livres de verdade. A grade é calculada igual à do site, considerando almoço, bloqueios, horário estendido e terça fechada.
- No máximo 4 horários futuros por número. Cliente bloqueado não agenda.
- Cancelamento só com 2h ou mais de antecedência.
- O cliente é identificado pelo número de WhatsApp. Se o número ainda não tem cadastro, a IA cria um.
- Promoções ativas são aplicadas no preço, igual ao site.

## Se mudar algo no site

O horário do salão e quem faz cada serviço estão copiados no topo de `supabase/functions/whatsapp-atendente/index.ts` (`HORARIO_SALAO` e `PROFISSIONAIS_POR_SERVICO`). Se mudar em `frontend/src/config/horarios.js` ou `servicos.js`, mude lá também e publique a função de novo.

## Custos

- Kapso: plano mensal deles.
- Meta: responder quem escreveu primeiro (dentro de 24h) é a parte barata. Mensagens que a barbearia inicia exigem template aprovado e são cobradas por mensagem. Confira a tabela atual na Kapso.
- Claude: por uso. Uma conversa de agendamento custa alguns centavos de dólar.
