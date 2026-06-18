# Plano — Mini-sites, Painel Staff com RBAC, OSINT Life Agency

## 1. Backend (Lovable Cloud)
Ativar Lovable Cloud com Postgres + Auth (email/senha). Substitui o login fake atual.

**Tabelas (com RLS):**
- `profiles` (id ↔ auth.users, nome, email, avatar)
- `app_role` enum: `ceo`, `admin`, `staff`
- `subsidiary` enum: `fli`, `cond`, `college`, `agency`, ... (14)
- `user_roles` (user_id, role) — usada por `has_role()` security-definer
- `user_subsidiary_access` (user_id, subsidiary) — define a quais mini-sites o staff pode entrar
- `residents` (cond.): nome, unidade, contato, foto, observações
- `visitor_logs` (cond.): nome, documento, unidade visitada, entrada, saída, registrado_por
- `students` (college): nome, matrícula, curso, turma, email
- `teachers` (college): nome, departamento, email
- `classes` (college): nome, professor_id, horário
- `osint_investigations` (agency): titulo, alvo, status, criado_por
- `osint_findings` (investigation_id, fonte, tipo, payload jsonb, snapshot_url)

CEO `gatinho@furrs.life` cadastrado via migração (auth.users + role=ceo + acesso a todas subsidiárias). Senha provisória gerada e mostrada uma vez na tela de login (toast) ou definida via reset de senha no primeiro acesso.

**Função `has_role()` security-definer** + helper `has_subsidiary_access(uid, sub)` para policies sem recursão.

## 2. Painel Staff central (`/staff`) — repaginado
- Login real via Supabase Auth (substitui credenciais hardcoded).
- Dashboard CEO/Admin: criar/editar staff, atribuir acesso por subsidiária (checkboxes das 14), revogar, resetar senha.
- Staff comum só vê o link para os mini-sites a que tem acesso.
- Tabela de admins online (presence via realtime) + avisos internos persistidos.

## 3. Mini-sites (cada um = landing pública + `/staff` próprio)

### `/cond` — Furry's Life Cond.
Landing institucional + botão "Painel Staff" → `/cond/staff` (login).  
Após login (precisa de `subsidiary_access=cond`):
- Moradores: CRUD com foto, unidade, contato, observação.
- Visitantes: registrar entrada/saída, motivo, morador visitado; histórico filtrável por data/unidade.
- Métricas no topo: moradores ativos, visitas hoje, visitas na semana.

### `/college` — Life College
Landing + `/college/staff`:
- Alunos: CRUD (matrícula, curso, turma, contato).
- Professores: CRUD.
- Turmas: vincular professor + alunos.
- Avisos do campus.

### `/agency` — Life Agency (tema escuro/preto, vermelho-sangue)
Landing misteriosa + `/agency/staff`:
- **OSINT Toolkit:**
  - **Roblox lookup**: dado username/ID, busca via API pública (`users.roblox.com`, `friends.roblox.com`, `games.roblox.com`, `badges.roblox.com`, `groups.roblox.com`, `inventory.roblox.com`) — perfil, criação, amigos, grupos, badges, jogos criados, avatar.
  - **Username pivot**: testa o mesmo username em redes sociais (GitHub, Twitter/X, Instagram, TikTok, Twitch, Steam, Reddit, YouTube) via checagem HTTP + Firecrawl scrape para enriquecer.
  - **Email/nome search**: Firecrawl `search` com operadores (`"email" site:linkedin.com`, etc.) + scrape dos top resultados.
  - **Domain/URL recon**: Firecrawl `map` + `scrape` (branding, links, metadata).
  - **Grafo OSINT**: visualização com `react-force-graph-2d` — nós (alvo, contas, emails, amigos) e arestas tipadas; clique no nó abre painel lateral com detalhes/snapshot.
  - Cada busca cria/append em `osint_investigations` + `osint_findings` (auditoria).
- Conectores necessários: **Firecrawl** (vou pedir conexão no momento certo).

### `/life-server` — redirect 301
Rota TanStack que faz `redirect()` server-side para `https://bio.site/lifeserver`.

## 4. Furry's Life Inc. (site principal)
Mantém o Liquid Glass atual — **sem mudanças visuais**. Os 14 cards de subsidiária ganham link: os 4 implementados (`cond`, `college`, `agency`, `life-server`) abrem o mini-site; os outros mostram "Em breve".

## 5. SEO / Indexação Google
- `sitemap.xml` atualizado com todas as novas rotas públicas (`/`, `/cond`, `/college`, `/agency`, mini landings).
- `head()` único por rota (title, description, og:title/description/image, canonical absoluto em `https://furrys.life`).
- `robots.txt` permitindo tudo exceto `/staff` e `/*/staff`.
- JSON-LD `Organization` no root + `LocalBusiness`/`EducationalOrganization` nos mini-sites relevantes.
- Após deploy: re-submeter sitemap no GSC (já conectado).
- Bug do "site não aparece no Google": a verificação já está OK, então o que falta é (a) sitemap completo, (b) conteúdo indexável SSR em cada rota, (c) tempo (24–72h após submissão). Vou garantir (a) e (b); (c) é Google.

## 6. Bugs a corrigir no caminho
- Painel staff atual (sessionStorage) → substituído por sessão Supabase real (resolve "página não carrega" de vez).
- Garantir `<Outlet />` em todos os layouts dos mini-sites.
- `errorComponent` + `notFoundComponent` em toda rota com loader.

## Detalhes técnicos
- **Stack**: TanStack Start + Supabase (via Lovable Cloud). Server functions com `requireSupabaseAuth` para dados protegidos; rotas `_authenticated` por mini-site.
- **OSINT calls**: tudo em `createServerFn` (Roblox direto via fetch, Firecrawl via SDK `@mendable/firecrawl-js` lendo `FIRECRAWL_API_KEY`).
- **Realtime presence** para "admins online" no dashboard central.
- **Storage bucket** `osint-snapshots` (privado) para screenshots Firecrawl; `residents-photos` (privado) para fotos de moradores.
- **Grafo**: `react-force-graph-2d` (leve, Canvas).
- **RBAC nas rotas**: layout `_authenticated/_subsidiary-cond.tsx` etc. com `beforeLoad` checando `has_subsidiary_access`.

## Fora de escopo (peço confirmação depois se quiser)
- Mini-sites das outras 10 subsidiárias (faço sob demanda).
- Pagamentos, emails transacionais, mobile app.
- OSINT em fontes que exigem APIs pagas (HIBP, Hunter, Shodan).

## Ordem de execução
1. Ativar Cloud + schema + seed CEO.
2. Auth real no `/staff` central + RBAC + UI de gestão de staff.
3. Mini-site Cond. (mais simples, valida o padrão).
4. Mini-site College.
5. Redirect Life Server.
6. Mini-site Agency + OSINT (pedirei Firecrawl aqui).
7. SEO: sitemap, robots, JSON-LD, heads.
8. Smoke test via Playwright nas rotas-chave.

Posso seguir?
