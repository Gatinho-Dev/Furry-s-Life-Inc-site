## Plano de melhorias

### 1. OSINT Explorer (Mapa Mental estilo Maltego)
Reescrever `/agency/staff` aba "Mapa Mental" inspirado na imagem 1:
- **Layout**: sidebar esquerda escura com seções "Investigação" (Painel, Mapa Visual, Timeline, Relatórios, Alertas), "Buscas" (Email, Telefone, Nome, Usuário, Domínio, IP/Host), "Configurações" (Fontes, Preferências)
- **Topbar**: busca global unificada que detecta o tipo (email/telefone/IP/domínio/nome) + botões Exportar / Relatório / Configurações
- **Canvas central**: grafo interativo com `@xyflow/react`
  - Nós coloridos por tipo: Pessoa (branco), Email (azul), Telefone (verde), Domínio (vermelho), Empresa (amarelo), Localização (laranja), Usuário (ciano), IP/Host (azul claro), Rede Social (roxo)
  - Ícones lucide dentro de cada bolha
  - Arestas curvas tracejadas/contínuas coloridas
  - Zoom, pan, drag, mini-controles (+/−, fit, lock), legenda no rodapé
  - Expandir nó → carrega entidades conectadas (via OSINT functions ou stub)
  - Colapsar/expandir ramos
- **Painel lateral direito**: detalhes da entidade selecionada com tabs (Resumo, Detalhes, Atividades), tags, notas, exportar JSON/PNG da entidade
- **Modos**: alternância "Grafo" / "Timeline" (linha do tempo dos eventos)
- **Exportar**: grafo completo como PNG (html-to-image) e JSON (nodes+edges)
- **Persistência**: salva nodes/edges/notas/tags em `osint_case_nodes` e `osint_case_edges` (já existem); adicionar colunas `tags text[]`, `notes text` via migração
- Tema dark consistente com tokens semânticos

### 2. Fix login dos mini sites
Hoje `/auth` sempre manda para `/staff/dashboard`. Mudar para:
- `/auth` aceita query param `?redirect=/cond/staff` (ou agency/college/aircare)
- Após login, navega para `redirect` se válido, senão `/staff/dashboard`
- Cada página `*.staff.tsx` que detectar sessão ausente redireciona para `/auth?redirect=<rota atual>`
- OAuth Google também propaga o redirect

### 3. Usuários & Cargos — facilitar visualização
Na aba "Usuários" do `/staff/dashboard`:
- Card por usuário (avatar, nome, email) com badges visuais por cargo global e chips por subsidiária+sub_role
- Filtro/busca por nome/email + filtro por subsidiária
- Ações inline (criar usuário, resetar senha, deletar) em dropdown
- Matriz visual "Subsidiária × Cargo" colorida em vez de listagem textual

### 4. Life College — painel staff (estilo imagem 2)
Reformular `/college/staff` com layout dashboard:
- Sidebar esquerda fixa com: Dashboard, Alunos, Professores, Turmas, Eventos, Financeiro, Calendário, Avisos, Notificações
- Cards de KPI no topo: Total de Alunos, Total de Professores, Eventos, Mensalidades
- Gráfico de desempenho (recharts) + lista de próximos eventos
- CRUD existente de alunos/professores/turmas movido para abas internas
- Tema verde/azul College, evitar roxo do mockup
- Novas tabelas se necessário: `college_events`, `college_invoices` (com RLS + GRANTs)

### 5. Life Cond — painel staff profissional
Reformular `/cond/staff`:
- Sidebar esquerda fixa (igual padrão College) com: Dashboard, Moradores, Unidades, Visitantes, Encomendas, Incidentes, Avisos, Reservas (áreas comuns), Manutenção, Financeiro
- KPIs: moradores ativos, visitantes hoje, encomendas pendentes, incidentes abertos
- Novas tabelas: `cond_packages`, `cond_incidents`, `cond_reservations`, `cond_maintenance` (RLS + GRANTs)

### 6. Ajeitar todos os sites + corrigir erros
- Padronizar layout dos painéis staff (Agency, Aircare, College, Cond, Life Server) com mesma shell de sidebar
- Rodar `tsgo` e corrigir erros TypeScript pendentes
- Verificar console/network do preview, corrigir warnings e bugs visíveis
- Garantir que `_authenticated` redireciona corretamente para `/auth?redirect=...`

### Detalhes técnicos
- Lib novas: `html-to-image` (export PNG do grafo). `@xyflow/react` já instalado.
- Migração SQL (uma só): adiciona colunas `tags`, `notes`, `expanded`, `parent_node_id` em `osint_case_nodes`; cria `cond_packages`, `cond_incidents`, `cond_reservations`, `cond_maintenance`, `college_events`, `college_invoices` — todas com `GRANT` + RLS via `has_subsidiary_access`.
- Roteamento auth: alterar `src/routes/auth.tsx` para ler/validar `redirect` (whitelist de prefixos: `/staff`, `/agency/staff`, `/college/staff`, `/cond/staff`, `/aircare/staff`, `/life-server`).
- Componente compartilhado `StaffShell` em `src/components/staff/StaffShell.tsx` (sidebar + topbar + outlet) reaproveitado pelos 5 painéis.

### Perguntas (rápidas, posso assumir defaults)
1. **Timeline mode** no OSINT: linha do tempo só dos eventos da investigação atual (criação de nós, descobertas) — ok? *(default: sim)*
2. **Exportar PNG**: usar `html-to-image` (lib leve client-side) — ok? *(default: sim)*
3. **Sidebar do College/Cond**: manter as cores atuais de cada subsidiária (College verde, Cond azul) em vez do roxo da referência — ok? *(default: sim)*

Se nenhuma resposta, sigo com os defaults acima.