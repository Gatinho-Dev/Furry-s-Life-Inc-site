# LifePay — mini-site fintech fictício

Nova subsidiária da Furry's Life Inc. — banco digital totalmente fictício, estética premium dark mode inspirada em fintechs de alto padrão (estilo "private banking" digital), sem usar marcas reais.

## Stack (ajustes em relação ao briefing)

O projeto roda em **TanStack Start + React + Tailwind v4**, não Next.js — vou manter o stack do projeto (mudar quebraria todo o resto). O resto do briefing é respeitado:

- Tailwind v4 (tokens em `src/styles.css`)
- Lucide para ícones
- Recharts para gráficos
- **Framer Motion** será adicionado (`bun add framer-motion`) para microanimações, parallax e transições 60fps
- Estado local com React (escopo pequeno demais para Zustand — evito dependência extra)
- Tema dark fixo (paleta exata do briefing escopada só ao LifePay, sem afetar os outros sites)

## Cadastro da subsidiária

- Adicionar `lifepay` em `src/lib/site-data.ts`: novo `SubsidiaryKey`, label "LifePay", categoria "Finanças", ícone `Wallet`/`Landmark`, `href: "/lifepay"`.
- Atualizar `SubsidiaryKey` em `src/lib/use-auth.ts` para incluir `"lifepay"`.
- Adicionar `'lifepay'` no enum `subsidiary` do banco (migration) para que o sistema de acessos/cargos funcione.

## Rotas

```text
src/routes/
  lifepay.index.tsx     -> /lifepay   (landing pública com toda a UX descrita)
  lifepay.staff.tsx     -> /lifepay/staff  (painel staff básico via StaffShell)
```

A landing pública usa um shell próprio (navbar + footer dark) totalmente separado da Navbar principal do site, para preservar a identidade visual da fintech.

## Estrutura da landing `/lifepay`

Sections (cada uma é um componente em `src/components/lifepay/`):

1. **Navbar fixa** — logo "LifePay" + itens (Início, Cartões, Pix, Investimentos, Empresas, Segurança, Sobre, Entrar) + botão `[ Criar Conta ]`. Glassmorphism leve, blur, borda inferior sutil.
2. **Hero** — título, subtítulo, CTAs `[ Abrir Conta ]` `[ Explorar ]`, mockup central com **3 celulares** premium dispostos em leque mostrando telas mock do app. Parallax suave no scroll via Framer Motion `useScroll`/`useTransform`.
3. **Dashboard principal** (mock interativo) — card de saldo `R$ 16.460,00` com toggle olho mostrar/ocultar, grid 4×2 de ações rápidas (Pix, Transferir, Pagar, Cartões, Investir, Extrato, Cobrar, Mais), hover elegante (lift + glow amarelo).
4. **Pix** — campo "Digite CPF, chave ou código" + botão →, abas Enviar/Receber/QR/Programado/Histórico, lista de Pix recorrentes (Netflix R$39,90 / Spotify R$21,90), últimos Pix mock. Ao clicar enviar: animação loading → check verde de sucesso (`#20D97A`).
5. **Cartões** — "LifePay Black" metálico em CSS (gradient escuro com reflexo dourado), tilt 3D no hover via Framer Motion (`useMotionValue` + transform), limite R$25.000 / disponível R$18.400, botões Bloquear / Virtual / Ajustar limite / Apple Pay / Google Pay.
6. **Investimentos** — saldo investido R$260.000, 4 cards (Renda Fixa, Ações, Cripto simulada, Fundos) com mini-spark, gráfico de linha suave (Recharts `AreaChart` com gradient amarelo), rentabilidade mock, CTA `[ Investir ]`.
7. **Life Assistant (IA)** — botão flutuante bottom-right, abre drawer com 4 sugestões clicáveis ("Quanto gastei este mês?" etc.). Resposta simulada com efeito de "digitando" (animação de texto stream).
8. **LifePay Empresas (PJ)** — 5 recursos em grid (Cobranças, Gestão financeira, Folha de pagamento, Despesas, Dashboard), CTA `[ Abrir Conta PJ ]`.
9. **Segurança** — 4 cards (biometria, criptografia, aprovação por dispositivo, alertas), fade-in no scroll.
10. **Extrato** — tabela elegante (Data / Tipo / Valor) com 8-10 linhas mock, campo de busca + filtro por tipo (Pix / Compra / Investimento), valores em verde/vermelho.
11. **Disclaimer global** — faixa fixa no rodapé + em cada seção sensível: *"LifePay é um projeto fictício da Furry's Life Inc. Não realiza operações financeiras reais."*
12. **Footer dark** próprio com links institucionais + copyright Furry's Life Inc.

## Componentes reutilizáveis

Criar em `src/components/lifepay/`:

- `LpShell.tsx` — wrapper que aplica os tokens da paleta LifePay via `style` scoped (não vaza pro resto do site)
- `LpNavbar.tsx`, `LpFooter.tsx`, `LpDisclaimer.tsx`
- `GlassCard.tsx` — card com `bg-card/60 backdrop-blur-xl border-white/5`
- `PhoneMock.tsx` — moldura de celular CSS reutilizável
- `CreditCard3D.tsx` — cartão metálico com tilt
- `LpToast.tsx`, `LpSkeleton.tsx`, `LpTooltip.tsx`, `LpModal.tsx`, `LpDrawer.tsx`, `LpEmptyState.tsx`, `LpBottomNav.tsx` (mobile)

Tokens locais em `src/components/lifepay/lifepay.css` ou inline via `style={{...}}`:

```text
--lp-bg: #090909
--lp-bg-2: #111111
--lp-card: #171717
--lp-primary: #FFD84D
--lp-primary-dim: #B89B2E
--lp-text: #FFFFFF
--lp-text-2: #9C9C9C
--lp-success: #20D97A
```

Fontes Inter/SF Pro Display via `<link>` no `__root.tsx` (Google Fonts → Inter; SF Pro como fallback do system stack — não é distribuível). Pesos 400–700.

## Painel staff `/lifepay/staff`

Usa o `StaffShell` existente, abas básicas (Dashboard mock + Disclaimer). Apenas placeholder funcional — usuários com acesso à subsidiária `lifepay` veem o painel; CEO/admin sempre.

## Migration

Adicionar `'lifepay'` ao enum `subsidiary` (`ALTER TYPE public.subsidiary ADD VALUE 'lifepay'`). Sem novas tabelas — todos os dados da landing são mock client-side, como pede o briefing ("Não usar APIs bancárias reais").

## Garantias

- Dark mode 100% scoped: nenhuma cor nova vaza para os outros mini-sites.
- Disclaimer visível em ≥4 pontos (hero, cartões, investimentos, footer fixo).
- Sem referência a C6, Nubank, Inter ou qualquer marca real — só nível visual.
- 60fps: animações apenas em `transform`/`opacity`, sem layout thrash.
- Mobile first: Bottom Navigation aparece <768px; navbar vira hamburger drawer.
- Typecheck e build limpos antes de finalizar.

## Detalhes técnicos

- Framer Motion: `bun add framer-motion` (compatível com Tanstack Start, SSR-safe).
- `PhoneMock` usa SVG/CSS puro — sem imagens externas.
- Mock data em `src/components/lifepay/mock.ts` (saldo, Pix, cartões, extrato, investimentos).
- A nova rota `/lifepay` será adicionada à whitelist de `safeRedirect` em `src/routes/auth.tsx` para login no painel.
- `News`, `Subsidiaries`, etc. continuam intactos.

Pronto pra implementar quando você aprovar.