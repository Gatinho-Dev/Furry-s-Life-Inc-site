## Escopo

Várias frentes pedidas de uma vez — vou implementar tudo, mas em blocos claros pra você acompanhar.

---

### 1. Life Agency — Mapa Mental de Casos (substitui "Site Map")

- Renomeia aba **Site Map → Mapa Mental**.
- Nova aba "Casos": lista de investigações (criar, renomear, excluir).
- Ao abrir um caso, editor de mapa mental com **bolhas (nós)** ligadas por linhas:
  - Tipos de bolha: Email, Telefone, Nome, IP, URL, Usuário (Roblox/social), Localização, Nota livre.
  - Arrastar para posicionar, clicar para editar, conectar duas bolhas com linha rotulada.
  - Botão "Adicionar bolha do resultado" nas abas Web Search / Scrape / Roblox para jogar achados direto no caso ativo.
- **Tudo salvo** no banco (posições, ligações, conteúdo) — novas tabelas `osint_case_nodes` e `osint_case_edges` com acesso só para staff da Agency. Biblioteca: `@xyflow/react`.

### 2. Busca OSINT — simplificar

- Uma barra única "Buscar" no topo que detecta automaticamente o tipo (email, telefone, IP, URL, domínio, nome) e dispara a ferramenta certa, mostrando resultado consolidado.
- Abas avançadas ficam disponíveis embaixo para uso manual.

### 3. Painel de Staff — Usuários e Cargos

- Aba **Usuários** (CEO/Admin): listar, **criar manualmente** (email+senha, via Auth Admin), excluir, resetar senha.
- **Cargos por subsidiária**: ao invés do cargo global definir acesso, cada usuário recebe `{subsidiária → cargo}` (ex.: "Life College = Professor", "Cond. = Porteiro"). O acesso à subsidiária e o que ele pode fazer dentro dela vêm desse cargo.
- Novos cargos por subsidiária (exemplos): Agency → Investigador/Analista/Coordenador; College → Professor/Coordenador/Secretaria; Cond. → Porteiro/Síndico; AirCare → Técnico/Engenheiro; etc. CEO/Admin continuam globais.
- Migração: nova tabela `user_subsidiary_roles (user_id, subsidiary, role)` + função `has_sub_role()` usada nas policies; UI atualizada.

### 4. Life AirCare — novo mini site

- Rota `/aircare` (site público) + `/aircare/staff` (painel).
- Visual baseado nas suas 4 imagens: fundo verde-escuro, acentos verde-lima, cartões com cantos suaves, bolhas decorativas. Seções: Hero "Clean Air Factories", O Problema, A Solução (filtros + energia limpa), Tecnologia do Filtro (camadas mostradas na img 4), Contato.
- Painel: cadastro de **Unidades/Fábricas monitoradas**, **Leituras de qualidade do ar** (PM2.5, CO₂, etc.), **Manutenções de filtros**. Tudo salvo no banco.

### 5. Mini sites existentes — polimento + mais opções no painel

- Passe de design coerente em `/cond`, `/college`, `/agency`, `/life-server` (tipografia, espaçamento, cards, contraste) mantendo identidade de cada um.
- Mais opções nos painéis:
  - **Cond.**: registro de ocorrências, encomendas, comunicados aos moradores.
  - **College**: notas/frequência por aluno, calendário de provas.
  - **Agency**: já coberto pelos casos.
- Todos os formulários gravam no banco com RLS por subsidiária+cargo.

### 6. Notícias

- Excluir todas as notícias que não foram criadas por você. Mantém só o que você publicou (e a UI de criar/editar já existente).

### 7. Email + Inbox interna

- Trocar remetente/destinatário visível para **furryslifeinc@gmail.com** nos textos/avisos da UI.
- Formulário de contato do site **deixa de enviar email** — grava em nova tabela `contact_inbox` (nome, email, assunto, mensagem, lido, respondido).
- Nova aba **Inbox** no painel de staff (CEO/Admin + cargo "Atendimento"): listar, marcar como lido, arquivar, responder por email (opcional, via fila já existente).
- Mantém a infra de email para auth/notificações; só o contato público muda de canal.

---

## Detalhes técnicos

```text
Novas tabelas
  user_subsidiary_roles(user_id, subsidiary, role, granted_by, granted_at)
  osint_case_nodes(investigation_id, node_type, label, data jsonb, pos_x, pos_y)
  osint_case_edges(investigation_id, source_node, target_node, label)
  aircare_units, aircare_readings, aircare_filter_maintenance
  cond_incidents, cond_packages, cond_announcements
  college_grades, college_attendance, college_exam_schedule
  contact_inbox(name, email, subject, body, status, replied_at)

Funções
  has_sub_role(_user_id, _sub, _role)  -- SECURITY DEFINER
  ajustar policies das tabelas existentes para usar has_sub_role quando relevante

Frontend
  bun add @xyflow/react  (já instalado)
  novo /aircare e /aircare/staff
  novo /staff/users e /staff/inbox
  refator agency.staff.tsx (Buscar simplificado + Casos + Mapa Mental)
  data migration: DELETE FROM news WHERE created_by <> '<seu user_id>'
```

### Ordem de execução
1. Migrações (cargos por subsidiária, mapa mental, AirCare, painéis extra, inbox).
2. Backend: server functions para criar/excluir usuários, inbox, AirCare.
3. UI: gestão de usuários, inbox, AirCare (site + painel), mapa mental, busca simplificada.
4. Polimento visual dos mini sites existentes.
5. Limpeza de notícias e ajustes de email.

### Pontos que preciso confirmar
- **Senha mínima** ao criar usuário manualmente: posso usar 8 caracteres + exigir troca no 1º login? (sim/não)
- **Reply na inbox**: respondo pelo painel via fila de email existente (sai de `notify.furrys.life`) — ok?
- **Notícias**: confirmo deletar tudo que não tem `created_by = seu user_id`. Se nunca houve coluna `created_by`, apago todas — confirma?
