
## Goal

Ao entrar no LifePay, o usuário cai direto no **app do banco** (não no painel staff), com visual mobile-first muito parecido com o C6 Bank (fundo preto, amarelo âmbar, cartões arredondados, bottom nav) e um Pix bem mais fácil de usar.

O login já redireciona para `/lifepay/app` quando o botão "Entrar" do LifePay é usado — vou apenas garantir isso e reforçar o fluxo. O trabalho principal é **redesenhar `src/routes/lifepay.app.tsx`** por completo.

## O que muda

### 1. Layout mobile-first estilo C6

- Container central `max-w-[440px]` (responsivo em desktop mostra ao centro, como um "device"), fundo `#0a0a0a`.
- **Header:** "Bom dia, {nome}" + avatar circular com inicial, ícone de sino (com dot vermelho se houver movimentação recente) e ícone de configurações.
- **Cartão de saldo horizontal (swipe):** primeiro card com "Saldo" em Robux (R$ formatado + toggle olho), segundo card "Robux investidos" (mock), terceiro card "Cashback" — carrossel horizontal com dots, igual C6.
- **Grade de atalhos rápidos (4 col x 2 rows):** ícones circulares cinza escuro com labels curtas — Meus Limites, Empréstimos, Cartões, Investir, Cobrar, Recarga, Doações, Mais.
- **Seção "Para você":** carrossel de banners promocionais fake (LifePay Black, Convide amigos, LifePay Yellow).
- **Bloco Pix destacado** com 4 botões amarelos redondos grandes: **QR Code**, **Transferir**, **Cobrar**, **Chave**.
- **Bottom nav fixo** (5 itens): Início · Extrato · **LifePay** (botão central destacado, preto/branco redondo) · Cartões · Menu.

### 2. Pix muito mais fácil

Ao tocar em qualquer botão do bloco Pix abre uma **sheet/modal** (bottom sheet) com tabs:

- **Transferir:** 
  - Linha horizontal de **contatos recentes** (avatares dos últimos destinatários — extraído das últimas transações) para envio em 1 toque.
  - Campo único "Chave Pix ou email" com auto-detect.
  - Chips de valor rápido: **R$ 10 · 50 · 100 · 500 · 1.000 · Outro**.
  - Confirmação em passo único mostrando destinatário resolvido antes de enviar.
- **Cobrar:** gera link `lifepay.app/pay/{pix_key}?amount=` copiável + QR (SVG inline com a chave).
- **Minha chave:** exibe chave Pix grande, botão copiar/compartilhar, QR grande.
- **QR Code:** leitor mock (input para colar código) + a própria chave em QR.

### 3. Menu / Admin

- O item "Menu" do bottom nav abre uma tela cheia com busca, grade de opções (Configurações, Ajustes de acessibilidade, Sair, Voltar ao site) e, se `is_admin`, seção **Admin** com o painel de conceder/debitar saldo já existente.
- O painel staff **não é mais aberto** ao logar via LifePay — o usuário staff que quiser acessar `staff/dashboard` faz por URL direta ou pelo site principal.

### 4. Ajustes finos

- Fonte: SF Pro / Inter (já herdada), tracking apertado como no C6.
- Ícones amarelos (`#FFD84D`) sobre círculos escuros nos atalhos Pix.
- Estados de loading em skeleton amarelo suave.
- Todos os saldos formatados como `R$ 1.000,00` + tag "Robux" pequenina abaixo.
- Confirmação de envio Pix mostra tela de sucesso animada (check verde + valor + destinatário + "Ver comprovante"), depois volta pra Início.

### 5. Garantias de fluxo

- `src/routes/auth.tsx` já tem `/lifepay/app` no whitelist — manter.
- Landing `/lifepay` já aponta "Entrar" com `?redirect=/lifepay/app` — manter.
- Nenhuma mudança de schema/DB: reutiliza `lifepay_accounts`, `lifepay_transactions`, RPC `lifepay_transfer` e `lifepay_admin_adjust`.

## Arquivos tocados

- **Reescrito:** `src/routes/lifepay.app.tsx` (única grande mudança).
- **Verificação apenas** (sem edit necessário): `src/routes/auth.tsx`, `src/routes/lifepay.tsx`.

## Escopo explicitamente fora

- Não mexo em outros mini-sites, staff dashboard, OSINT, AirCare, News etc.
- Não crio novas tabelas/migrations.
- Não adiciono modo claro — segue tema escuro C6.
