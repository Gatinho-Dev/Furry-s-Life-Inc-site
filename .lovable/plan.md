## Decisões já tomadas

- **Contas LifePay** usam o sistema de contas da Furry's Life Inc. (e-mail + senha reais, sessão segura já existente). O admin cria a conta pelo painel staff; nenhuma senha fica guardada em texto.
- **Biometria**: prioridade para a biometria do dispositivo (WebAuthn / Face ID / Windows Hello / Android). Quando o aparelho não tiver suporte, cai para o cadastro facial por câmera com prova de vida (piscar, virar o rosto, checagem de iluminação). Nenhuma foto ou vídeo é guardado.
- **Entrega por etapas**, cada uma testada antes da próxima.
- Nada de banco real, cartão real ou Pix oficial. Aviso discreto só no rodapé público, termos, privacidade, "Sobre o LifePay" e área administrativa.

---

## Etapa 1 — Base financeira, página pública e conta do usuário

**Banco de dados** (mantendo o que já existe e migrando os saldos atuais):
- `lifepay_users` (perfil financeiro ligado à conta do ecossistema): nome, status, saldo, tipo de conta, primeiro acesso concluído, troca de senha obrigatória, PIN protegido, último acesso.
- `lifepay_keys`: chave por e-mail e chaves aleatórias, com status, criação e remoção.
- `lifepay_transactions` (evoluída): tipo, remetente, destinatário, valor, descrição, status, chave usada, saldo anterior/posterior, método de autenticação, identificador único e chave de idempotência.
- Regras de acesso: cada pessoa só enxerga a própria conta e os próprios lançamentos; nomes de destinatário só aparecem via consulta controlada.

**Operações no servidor** (tudo validado no backend, transação atômica):
- Transferência por e-mail ou chave aleatória, com bloqueio de: valor ≤ 0, saldo insuficiente, conta bloqueada, chave inexistente/inativa, transferência para si mesmo e cliques repetidos (idempotência).
- Consulta de destinatário, criação/remoção/desativação de chave, extrato com filtros, comprovante.

**Páginas**:
- `/lifepay` vira a página pública institucional: banner, benefícios, demonstração visual do app, cartão, segurança, FAQ, rodapé, botões "Entrar na sua conta" e "Conheça o LifePay". Sem nenhum dado de conta.
- `/lifepay/entrar`: login com e-mail e senha, mostrar/ocultar senha, manter conectado, recuperar senha, mensagens de erro claras, limite de tentativas com bloqueio temporário.
- Primeiro acesso: trocar senha, aceitar termos, configurar PIN, opção de ativar biometria depois.
- `/lifepay/app`: painel com saudação, saldo (com ocultar), atalhos, últimas movimentações, navegação (Início, Transferências, Receber, Chaves, Extrato, Perfil, Segurança, Suporte) e o fluxo completo de transferência com revisão, confirmação por senha/PIN e comprovante.
- Páginas `/lifepay/termos`, `/lifepay/privacidade` e `/lifepay/sobre`.
- Identidade visual própria do LifePay: fundo escuro grafite, cor de destaque própria, cartões arredondados, sombras suaves, responsivo do celular ao desktop, sem copiar identidade de outro banco.

**Painel staff** — nova aba "Usuários LifePay", separada do cadastro de trabalhadores: listar, criar usuário (nome, e-mail, senha inicial, status, saldo inicial, limite, dia de fechamento/vencimento, tipo de conta, observações), bloquear/desbloquear, ajustar saldo, redefinir senha, ver transações. Permissões específicas do LifePay por administrador; quem não tem a permissão não vê a aba nem executa a ação.

---

## Etapa 2 — Cartão, compras, parcelamento e faturas

- Tabelas `lifepay_cards`, `lifepay_purchases`, `lifepay_installments`, `lifepay_invoices`.
- Área de cartão: cartão virtual com número mascarado, validade, código protegido, limite total/disponível/utilizado, melhor dia de compra, fechamento, vencimento, status. Mostrar dados completos só depois de senha, PIN ou biometria — nunca embutidos na página nem em endereço.
- Ações: bloquear/desbloquear, ajustar limite dentro do permitido, criar e excluir cartão virtual temporário.
- Compras internas (à vista e em 2, 3, 4, 5, 6, 8, 10 e 12 vezes) criadas por fluxos internos autorizados e pela área administrativa, com resumo antes de confirmar e reserva do limite total.
- Faturas: atual, futuras e anteriores; status aberta, fechada, paga, parcialmente paga, atrasada, cancelada; pagamento com saldo, liberando o limite, gerando lançamento no extrato, comprovante e registro.
- Valores no formato brasileiro (R$ 1.234,56).

---

## Etapa 3 — Biometria, sessões, privacidade e auditoria

- Tabelas `lifepay_biometrics` (tipo de autenticação, credencial protegida, consentimento, ativação, último uso, revogação), `lifepay_sessions` e `lifepay_audit_logs`.
- Tela de consentimento antes de qualquer uso de câmera, com caixa de autorização explícita.
- Cadastro biométrico: passkey do dispositivo quando houver suporte; senão, câmera com moldura, detecção de rosto único, checagem de iluminação e prova de vida guiada por instruções em tempo real. Nunca conclui com foto estática. Confirma com a senha atual no final.
- Uso da biometria para entrar, transferir, pagar fatura, ver dados do cartão e alterar segurança — sempre com "usar senha" como alternativa imediata, sem perder dados preenchidos nem duplicar a operação.
- Área "Segurança e acesso": alterar senha, criar/alterar PIN, biometria, dispositivos, sessões abertas, histórico de acessos, encerrar outras sessões.
- Área de privacidade: consultar consentimento, desativar e excluir dados biométricos (com senha e confirmação), baixar informações da conta, ver histórico de segurança.
- Auditoria completa de ações administrativas e financeiras, com responsável, ação, alvo, data/hora, IP e dispositivo quando disponível, dados anteriores e novos. No painel admin, a biometria aparece só como status, método, datas e opção de revogar — nunca imagem ou dado biométrico.
- Estados de interface completos (carregando, vazio, sem cartão, sem chave, saldo/limite insuficiente, conta bloqueada, sessão expirada, câmera negada, biometria indisponível, operação concluída/cancelada).

---

## Detalhes técnicos

- Stack atual mantida: TanStack Start com funções de servidor, Lovable Cloud (Postgres + Auth) e RLS por usuário. Nada de endpoint público sem autenticação para dados de conta.
- Transferências, compras e pagamentos rodam em função de banco transacional com verificação de saldo, limite, status e chave de idempotência — impossível ficar pela metade ou duplicar.
- Nenhum arquivo de outras subsidiárias é alterado além da adição da aba "Usuários LifePay" no painel staff e das permissões correspondentes.
- Ao final de cada etapa, executo os testes da lista (criação pelo admin, primeiro acesso, chave, transferência, falta de saldo, isolamento entre usuários, compra parcelada, pagamento de fatura, biometria e queda para senha) usando navegador automatizado no ambiente de desenvolvimento.
