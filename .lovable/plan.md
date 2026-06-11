## Furry's Life Inc. — Site Corporativo

Nota técnica: o projeto usa **TanStack Start + React + Tailwind v4** (não HTML/CSS/JS puro). Vou entregar o mesmo resultado visual e funcional dentro desse stack — mais robusto, responsivo e pronto para deploy. Se preferir mesmo arquivos HTML/CSS/JS soltos, me avise antes de implementar.

### Identidade visual
- Tema escuro premium corporativo
- Paleta: fundo `#0A0E1A` (azul-noite), acentos azul elétrico `#3B82F6` + roxo `#8B5CF6`, detalhes verde-neon `#10B981`
- Tipografia: Inter (corpo) + Space Grotesk (títulos)
- Cards arredondados, bordas com glow sutil, gradientes, sombras suaves
- Animações leves no scroll (fade-in/slide-up), hover em cards
- Logos enviados (símbolo + wordmark) usados no header e hero via Lovable Assets

### Estrutura de rotas
```
/                       Landing (Hero, Sobre, Subsidiárias, Notícias, Contato)
/staff                  Tela de login fictício
/staff/dashboard        Painel de Staffs (após login)
```
Navegação por âncoras no topo (Início, Sobre, Subsidiárias, Notícias, Contato, Staff).

### Seções da home
1. **Hero** — logo, "Furry's Life Inc.", tagline "Conectando criatividade, tecnologia e experiências para o futuro.", CTAs "Conheça nossas subsidiárias" e "Entrar em contato", fundo com gradiente animado.
2. **Sobre nós** — texto institucional + 3 stats (subsidiárias, setores, alcance).
3. **Subsidiárias** — grid de 14 cards (as listadas), cada um com ícone (lucide-react), nome, categoria e descrição.
4. **Notícias e avisos** — 4 cards com data fictícia, título, descrição, tag.
5. **Contato** — formulário (nome, e-mail, assunto, mensagem) com validação visual e toast de confirmação.
6. **Rodapé** — copyright 2026, links fictícios (Termos, Privacidade, Contato, Subsidiárias).

### Painel de Staffs
- **/staff** — card de login moderno (usuário + senha, mostrar/ocultar senha, botão "Entrar"). Credenciais aceitas: `Lobo_2033` / `L`. Estado salvo em `sessionStorage` (apenas visual). Mensagem de erro animada se incorreto.
- **/staff/dashboard** — layout de dashboard:
  - Sidebar com navegação
  - Cards de métricas (admins online, avisos, subsidiárias)
  - Tabela "Administradores" com nome, cargo, status online/offline (badge verde/cinza pulsante)
  - Painel "Avisos Internos" com lista de comunicados
  - Botão logout

### Arquivos a criar/editar
- `src/routes/index.tsx` — substitui placeholder pela landing completa
- `src/routes/staff.tsx` — login
- `src/routes/staff.dashboard.tsx` — dashboard
- `src/components/site/` — `Navbar`, `Hero`, `About`, `Subsidiaries`, `News`, `Contact`, `Footer`, `SubsidiaryCard`, `NewsCard`
- `src/components/staff/` — `LoginForm`, `StatusBadge`, `AdminTable`, `NoticesPanel`
- `src/lib/staff-data.ts` — dados fictícios (admins, avisos, notícias, subsidiárias)
- `src/styles.css` — tokens da paleta nova
- `src/assets/` — pointers para os dois logos enviados via Lovable Assets
- `src/routes/__root.tsx` — meta tags (título, descrição, OG) "Furry's Life Inc."

### Fora de escopo
- Backend real, banco, autenticação real (login é só visual conforme solicitado)
- Envio real de e-mail do formulário (apenas toast)

Posso prosseguir?