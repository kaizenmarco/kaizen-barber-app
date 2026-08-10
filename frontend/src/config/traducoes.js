// ============================================================================
// Traduções do App Público (site de agendamento dos clientes).
// Fonte única de verdade para pt-BR / en / ja. O Admin não usa este arquivo.
//
// Uso: traduzir(idioma, 'chave') ou traduzir(idioma, 'chave', { var: valor })
// para chaves com placeholders tipo {var}.
// ============================================================================

export const IDIOMAS = [
  { codigo: 'pt-BR', rotulo: 'PT', bandeira: '🇧🇷' },
  { codigo: 'en', rotulo: 'EN', bandeira: '🇺🇸' },
  { codigo: 'ja', rotulo: '日本語', bandeira: '🇯🇵' },
];

export const IDIOMA_PADRAO = 'pt-BR';

const TEXTOS = {
  'pt-BR': {
    header_subtitulo: 'Premium Barbershop - Anjo, Aichi',

    nav_servicos: 'Serviços',
    nav_agendar: 'Agendar',
    nav_endereco: 'Endereço',
    nav_profissionais: 'Profissionais',
    nav_fidelidade: 'Fidelidade',
    nav_avaliacoes: 'Avaliações',

    conf_titulo: 'Horário agendado com sucesso!',
    conf_profissional: 'Profissional:',
    conf_data: 'Data:',
    conf_horario: 'Horário:',
    conf_valor: 'Valor:',
    conf_desconto_aplicado: '(desconto de {valor} aplicado)',
    conf_pontos_fidelidade: 'Você ganhará +2 pontos de fidelidade assim que este atendimento for realizado.',
    conf_criar_lembrete: 'Criar lembrete',
    conf_min_antes: '{min} min antes',
    conf_add_calendario: 'Adicionar lembrete ao calendário do celular',
    conf_google_agenda: 'ou adicionar ao Google Agenda',
    conf_presenca_confirmada: 'Presença confirmada',
    conf_confirmar_presenca: 'Confirmar presença',
    conf_voltar_site: 'Voltar para o site',

    servicos_titulo: 'Nossos Serviços',
    servicos_ver_mais: 'Ver mais',
    servicos_ver_menos: 'Ver menos',
    servicos_agendar: 'Agendar',

    agendar_titulo: 'Agendar horário',
    agendar_servico_label: 'Serviço:',
    agendar_servico_placeholder: 'Selecione um serviço',
    agendar_escolha_servico: 'Escolha um serviço acima para ver os horários disponíveis.',
    agendar_profissional_label: 'Profissional:',
    agendar_sem_horario: 'Nenhum horário disponível com {prof} neste dia.',
    agendar_este_profissional: 'este profissional',
    agendar_lista_espera: 'Lista de espera',
    agendar_anotado: 'Anotado! Avisaremos assim que abrir um horário.',
    agendar_le_nome: 'Nome',
    agendar_le_email: 'Email',
    agendar_le_telefone: 'Telefone (opcional)',
    agendar_le_enviar: 'Entrar na lista de espera',
    agendar_le_enviando: 'Enviando...',
    agendar_manha: 'Manhã ({n})',
    agendar_tarde: 'Tarde ({n})',
    agendar_mes_anterior: 'Mês anterior',
    agendar_proximo_mes: 'Próximo mês',
    agendar_fora_periodo: 'Fora do período de agendamento',

    endereco_titulo: 'Localização',
    endereco_horario_titulo: 'Horário de Funcionamento',
    endereco_fechado: 'Fechado',
    endereco_almoco: 'Intervalo de almoço: {inicio} - {fim} (nos dias de funcionamento)',
    endereco_fachada: 'Fachada',
    endereco_interior: 'Interior',
    endereco_detalhes: 'Detalhes',
    endereco_ambiente: 'Ambiente',

    profissionais_titulo: 'Profissionais',

    fidelidade_titulo: 'Fidelidade',
    fidelidade_regra1: '2 pontos por atendimento realizado',
    fidelidade_regra2: '10 pontos = ¥500 de desconto no próximo agendamento',
    fidelidade_consultar_titulo: 'Consultar meu saldo',
    fidelidade_email_placeholder: 'Seu email cadastrado',
    fidelidade_consultar_botao: 'Consultar',
    fidelidade_atendimentos: 'Atendimentos realizados:',
    fidelidade_resgatados: 'Pontos já resgatados:',
    fidelidade_saldo: 'Saldo disponível:',
    fidelidade_pontos: 'pontos',
    fidelidade_pode_resgatar: 'Você já pode resgatar ¥500 de desconto no seu próximo agendamento! É só marcar a opção na hora de confirmar o horário.',
    fidelidade_faltam: 'Faltam {n} pontos para o próximo desconto de ¥500.',

    avaliacoes_titulo: 'Avaliações',
    avaliacoes_deixe: 'Deixe sua avaliação!',
    avaliacoes_nome_placeholder: 'Seu nome',
    avaliacoes_texto_placeholder: 'Sua avaliação',
    avaliacoes_enviar: 'Enviar',

    footer_direitos: 'Todos os direitos reservados.',

    modal_nome_placeholder: 'Nome',
    modal_email_placeholder: 'Email',
    modal_telefone_placeholder: 'Telefone',
    modal_obs_placeholder: 'Alguma observação? (Ex: Não precisa lavar, etc...)',
    modal_consultando_pontos: 'Consultando seus pontos de fidelidade...',
    modal_pontos_disponiveis: 'Você tem {n} pontos de fidelidade disponíveis.',
    modal_usar_pontos: 'Usar 10 pontos agora para ganhar ¥500 de desconto neste agendamento',
    modal_faltam_pontos: 'Faltam {n} pontos ({a} atendimento(s)) para o próximo desconto de ¥500.',
    modal_agendando: 'Agendando serviço...',
    modal_confirmar: 'Confirmar agendamento',
    modal_cancelar: 'Cancelar',

    alerta_preencha_nome_email: 'Preencha seu nome e email!',
    alerta_selecione_servico: 'Selecione um serviço!',
    alerta_pontos_insuficientes: 'Você não tem pontos suficientes para resgatar desconto!',
    alerta_erro_agendar: 'Erro ao agendar: ',
    alerta_erro_presenca: 'Não foi possível confirmar a presença agora: ',
    alerta_erro_lista_espera: 'Não foi possível registrar na lista de espera agora: ',
    alerta_avaliacao_enviada: 'Avaliação enviada!',
  },

  en: {
    header_subtitulo: 'Premium Barbershop - Anjo, Aichi',

    nav_servicos: 'Services',
    nav_agendar: 'Book',
    nav_endereco: 'Location',
    nav_profissionais: 'Our Team',
    nav_fidelidade: 'Rewards',
    nav_avaliacoes: 'Reviews',

    conf_titulo: 'Appointment booked successfully!',
    conf_profissional: 'Stylist:',
    conf_data: 'Date:',
    conf_horario: 'Time:',
    conf_valor: 'Price:',
    conf_desconto_aplicado: '(discount of {valor} applied)',
    conf_pontos_fidelidade: "You'll earn +2 reward points once this appointment is completed.",
    conf_criar_lembrete: 'Set a reminder',
    conf_min_antes: '{min} min before',
    conf_add_calendario: 'Add reminder to your phone calendar',
    conf_google_agenda: 'or add to Google Calendar',
    conf_presenca_confirmada: 'Attendance confirmed',
    conf_confirmar_presenca: 'Confirm attendance',
    conf_voltar_site: 'Back to site',

    servicos_titulo: 'Our Services',
    servicos_ver_mais: 'See more',
    servicos_ver_menos: 'See less',
    servicos_agendar: 'Book',

    agendar_titulo: 'Book an appointment',
    agendar_servico_label: 'Service:',
    agendar_servico_placeholder: 'Select a service',
    agendar_escolha_servico: 'Choose a service above to see available times.',
    agendar_profissional_label: 'Stylist:',
    agendar_sem_horario: 'No available times with {prof} on this day.',
    agendar_este_profissional: 'this stylist',
    agendar_lista_espera: 'Join waitlist',
    agendar_anotado: "Got it! We'll let you know as soon as a slot opens up.",
    agendar_le_nome: 'Name',
    agendar_le_email: 'Email',
    agendar_le_telefone: 'Phone (optional)',
    agendar_le_enviar: 'Join waitlist',
    agendar_le_enviando: 'Sending...',
    agendar_manha: 'Morning ({n})',
    agendar_tarde: 'Afternoon ({n})',
    agendar_mes_anterior: 'Previous month',
    agendar_proximo_mes: 'Next month',
    agendar_fora_periodo: 'Outside the booking window',

    endereco_titulo: 'Location',
    endereco_horario_titulo: 'Business Hours',
    endereco_fechado: 'Closed',
    endereco_almoco: 'Lunch break: {inicio} - {fim} (on business days)',
    endereco_fachada: 'Storefront',
    endereco_interior: 'Interior',
    endereco_detalhes: 'Details',
    endereco_ambiente: 'Atmosphere',

    profissionais_titulo: 'Our Team',

    fidelidade_titulo: 'Rewards',
    fidelidade_regra1: '2 points per completed appointment',
    fidelidade_regra2: '10 points = ¥500 off your next appointment',
    fidelidade_consultar_titulo: 'Check my balance',
    fidelidade_email_placeholder: 'Your registered email',
    fidelidade_consultar_botao: 'Check',
    fidelidade_atendimentos: 'Completed appointments:',
    fidelidade_resgatados: 'Points already redeemed:',
    fidelidade_saldo: 'Available balance:',
    fidelidade_pontos: 'points',
    fidelidade_pode_resgatar: 'You can now redeem ¥500 off your next appointment! Just check the option when confirming your booking.',
    fidelidade_faltam: '{n} points to go until your next ¥500 discount.',

    avaliacoes_titulo: 'Reviews',
    avaliacoes_deixe: 'Leave a review!',
    avaliacoes_nome_placeholder: 'Your name',
    avaliacoes_texto_placeholder: 'Your review',
    avaliacoes_enviar: 'Submit',

    footer_direitos: 'All rights reserved.',

    modal_nome_placeholder: 'Name',
    modal_email_placeholder: 'Email',
    modal_telefone_placeholder: 'Phone',
    modal_obs_placeholder: 'Any notes? (e.g. no shampoo needed, etc.)',
    modal_consultando_pontos: 'Checking your reward points...',
    modal_pontos_disponiveis: 'You have {n} reward points available.',
    modal_usar_pontos: 'Use 10 points now to get ¥500 off this appointment',
    modal_faltam_pontos: '{n} points to go ({a} appointment(s)) until your next ¥500 discount.',
    modal_agendando: 'Booking...',
    modal_confirmar: 'Confirm booking',
    modal_cancelar: 'Cancel',

    alerta_preencha_nome_email: 'Please fill in your name and email!',
    alerta_selecione_servico: 'Please select a service!',
    alerta_pontos_insuficientes: "You don't have enough points to redeem a discount!",
    alerta_erro_agendar: 'Booking error: ',
    alerta_erro_presenca: "Couldn't confirm attendance right now: ",
    alerta_erro_lista_espera: "Couldn't join the waitlist right now: ",
    alerta_avaliacao_enviada: 'Review submitted!',
  },

  ja: {
    header_subtitulo: 'プレミアム理容室 - 愛知県安城市',

    nav_servicos: 'サービス',
    nav_agendar: '予約する',
    nav_endereco: 'アクセス',
    nav_profissionais: 'スタイリスト',
    nav_fidelidade: 'ポイント',
    nav_avaliacoes: '口コミ',

    conf_titulo: 'ご予約が完了しました!',
    conf_profissional: '担当スタイリスト:',
    conf_data: '日付:',
    conf_horario: '時間:',
    conf_valor: '料金:',
    conf_desconto_aplicado: '({valor}の割引適用済み)',
    conf_pontos_fidelidade: 'この施術が完了すると、+2ポイントが貯まります。',
    conf_criar_lembrete: 'リマインダーを設定',
    conf_min_antes: '{min}分前',
    conf_add_calendario: 'スマホのカレンダーにリマインダーを追加',
    conf_google_agenda: 'またはGoogleカレンダーに追加',
    conf_presenca_confirmada: '来店確認済み',
    conf_confirmar_presenca: '来店を確認する',
    conf_voltar_site: 'サイトに戻る',

    servicos_titulo: 'メニュー',
    servicos_ver_mais: '続きを見る',
    servicos_ver_menos: '閉じる',
    servicos_agendar: '予約する',

    agendar_titulo: '予約する',
    agendar_servico_label: 'サービス:',
    agendar_servico_placeholder: 'サービスを選択してください',
    agendar_escolha_servico: '上のサービスを選択すると、空き時間が表示されます。',
    agendar_profissional_label: 'スタイリスト:',
    agendar_sem_horario: 'この日は{prof}の空き時間がありません。',
    agendar_este_profissional: 'このスタイリスト',
    agendar_lista_espera: 'キャンセル待ちに登録',
    agendar_anotado: '承知しました!空きが出次第ご連絡します。',
    agendar_le_nome: 'お名前',
    agendar_le_email: 'メールアドレス',
    agendar_le_telefone: '電話番号（任意）',
    agendar_le_enviar: 'キャンセル待ちに登録する',
    agendar_le_enviando: '送信中...',
    agendar_manha: '午前 ({n})',
    agendar_tarde: '午後 ({n})',
    agendar_mes_anterior: '前の月',
    agendar_proximo_mes: '次の月',
    agendar_fora_periodo: '予約可能期間外です',

    endereco_titulo: 'アクセス',
    endereco_horario_titulo: '営業時間',
    endereco_fechado: '定休日',
    endereco_almoco: '昼休み: {inicio} - {fim}（営業日のみ）',
    endereco_fachada: '外観',
    endereco_interior: '店内',
    endereco_detalhes: 'こだわり',
    endereco_ambiente: '雰囲気',

    profissionais_titulo: 'スタイリスト紹介',

    fidelidade_titulo: 'ポイントプログラム',
    fidelidade_regra1: '施術1回につき2ポイント',
    fidelidade_regra2: '10ポイントで次回¥500割引',
    fidelidade_consultar_titulo: 'ポイント残高を確認',
    fidelidade_email_placeholder: '登録済みのメールアドレス',
    fidelidade_consultar_botao: '確認する',
    fidelidade_atendimentos: '施術回数:',
    fidelidade_resgatados: '使用済みポイント:',
    fidelidade_saldo: '利用可能ポイント:',
    fidelidade_pontos: 'ポイント',
    fidelidade_pode_resgatar: '次回の予約で¥500の割引が利用できます!予約確定時にオプションを選択してください。',
    fidelidade_faltam: '次の¥500割引まであと{n}ポイントです。',

    avaliacoes_titulo: '口コミ',
    avaliacoes_deixe: '口コミを投稿する',
    avaliacoes_nome_placeholder: 'お名前',
    avaliacoes_texto_placeholder: '口コミ内容',
    avaliacoes_enviar: '送信する',

    footer_direitos: '全著作権所有。',

    modal_nome_placeholder: 'お名前',
    modal_email_placeholder: 'メールアドレス',
    modal_telefone_placeholder: '電話番号',
    modal_obs_placeholder: 'ご要望があればご記入ください（例:シャンプー不要 等）',
    modal_consultando_pontos: 'ポイントを確認しています...',
    modal_pontos_disponiveis: '現在{n}ポイントをお持ちです。',
    modal_usar_pontos: '10ポイントを使用して今回の予約を¥500割引にする',
    modal_faltam_pontos: '次の¥500割引まであと{n}ポイント（施術{a}回）です。',
    modal_agendando: '予約処理中...',
    modal_confirmar: '予約を確定する',
    modal_cancelar: 'キャンセル',

    alerta_preencha_nome_email: 'お名前とメールアドレスを入力してください!',
    alerta_selecione_servico: 'サービスを選択してください!',
    alerta_pontos_insuficientes: '割引に必要なポイントが不足しています!',
    alerta_erro_agendar: '予約エラー: ',
    alerta_erro_presenca: '現在、来店確認ができませんでした: ',
    alerta_erro_lista_espera: '現在、キャンセル待ちに登録できませんでした: ',
    alerta_avaliacao_enviada: '口コミを送信しました!',
  },
};

export const DIAS_ABREV_POR_IDIOMA = {
  'pt-BR': ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  ja: ['日', '月', '火', '水', '木', '金', '土'],
};

export const DIAS_NOMES_POR_IDIOMA = {
  'pt-BR': {
    segunda: 'Segunda-feira', terca: 'Terça-feira', quarta: 'Quarta-feira',
    quinta: 'Quinta-feira', sexta: 'Sexta-feira', sabado: 'Sábado', domingo: 'Domingo',
  },
  en: {
    segunda: 'Monday', terca: 'Tuesday', quarta: 'Wednesday',
    quinta: 'Thursday', sexta: 'Friday', sabado: 'Saturday', domingo: 'Sunday',
  },
  ja: {
    segunda: '月曜日', terca: '火曜日', quarta: '水曜日',
    quinta: '木曜日', sexta: '金曜日', sabado: '土曜日', domingo: '日曜日',
  },
};

// Locale usado em toLocaleDateString / toLocaleTimeString para cada idioma.
export const LOCALE_POR_IDIOMA = {
  'pt-BR': 'pt-BR',
  en: 'en-US',
  ja: 'ja-JP',
};

// traduzir('en', 'conf_min_antes', { min: 15 }) => "15 min before"
export const traduzir = (idioma, chave, valores) => {
  const bruto = TEXTOS[idioma]?.[chave] ?? TEXTOS[IDIOMA_PADRAO][chave] ?? chave;
  if (!valores) return bruto;
  return bruto.replace(/\{(\w+)\}/g, (_, k) => (valores[k] !== undefined ? valores[k] : `{${k}}`));
};
