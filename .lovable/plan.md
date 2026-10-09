# Life+ — Mini site + Painel hospitalar + Modo Plantão (minigame)

## O que você vai ter
1. **/lifeplus** — site público da Life+ (saúde, especialidades, unidades, contato), visual clínico em tons de azul-hospital/branco, com cara própria.
2. **/lifeplus/staff** — painel hospitalar completo (só para quem tem acesso à Life+ e CEO/admin):
   - **Visão geral**: leitos ocupados, pacientes internados, exames pendentes, triagem por cor (Manchester: vermelho, laranja, amarelo, verde, azul).
   - **Pacientes**: cadastrar, editar, dar alta, excluir; ficha com dados pessoais, tipo sanguíneo, alergias, convênio, leito, médico responsável, status (triagem, internado, UTI, alta, óbito).
   - **Prontuário**: evoluções/anotações com data e autor; sinais vitais (pressão, frequência cardíaca, temperatura, saturação) com mini gráfico.
   - **Exames**: solicitar (hemograma, raio-X, tomografia, ECG etc.), marcar como coletado/concluído, registrar resultado e anexar laudo em texto.
   - **Prescrições/medicação**: medicamento, dose, horário, marcar como administrado.
   - **Leitos**: mapa de leitos por ala (Emergência, Enfermaria, UTI) com ocupação.
3. **Modo Plantão (minigame)** — botão "Iniciar plantão" no painel:
   - Chegam pacientes automaticamente em intervalos (ex.: a cada 30–90s) com queixa, gravidade e sinais vitais gerados.
   - Gera tarefas para você: triar paciente, pedir exame, ler resultado, medicar, transferir para UTI, dar alta.
   - Pontuação, tempo de espera, pacientes que pioram se ignorados, nível de dificuldade (Tranquilo/Normal/Caos), placar do plantão ao encerrar.
   - Pacientes do minigame ficam marcados como "simulação" e separados dos reais (pode limpar todos com um clique), para não misturar com o cadastro de verdade.

## Detalhes técnicos
- Tabelas novas: `lp_patients`, `lp_notes`, `lp_vitals`, `lp_exams`, `lp_prescriptions`, `lp_beds`, `lp_shift_tasks`, `lp_shifts` (pontuação). Coluna `is_simulated` nos pacientes.
- RLS via `has_subsidiary_access(auth.uid(),'lifeplus')` ou `is_ceo_or_admin`, GRANTs para authenticated/service_role; leitos iniciais via INSERT na migração.
- Motor do minigame no cliente (timer + gerador de casos), gravando pacientes/tarefas reais no banco com `is_simulated=true`; tarefas concluídas atualizam pontuação.
- Rotas: `src/routes/lifeplus.index.tsx`, `src/routes/lifeplus.staff.tsx`, componentes em `src/components/lifeplus/`. Life+ entra nos links do painel staff global.
