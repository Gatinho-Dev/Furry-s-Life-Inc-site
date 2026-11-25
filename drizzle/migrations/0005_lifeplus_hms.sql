-- helpers
CREATE OR REPLACE FUNCTION public.lp_access(_uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_subsidiary_access(_uid,'lifeplus') OR public.is_ceo_or_admin(_uid)
$$;

CREATE TABLE public.lp_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  full_name text NOT NULL,
  photo_url text,
  username text,
  role text NOT NULL DEFAULT 'medico' CHECK (role IN ('administrador','diretor','medico','enfermeiro','recepcionista','farmaceutico','tecnico','administrativo')),
  specialty text,
  registry text,
  uf text,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','inativo','ferias')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.lp_role(_uid uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN public.is_ceo_or_admin(_uid) THEN 'administrador'
    ELSE (SELECT role FROM lp_staff WHERE user_id = _uid AND status <> 'inativo') END
$$;
CREATE OR REPLACE FUNCTION public.lp_has(_uid uuid, _roles text[]) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.lp_access(_uid) AND (public.is_ceo_or_admin(_uid) OR COALESCE(public.lp_role(_uid) = ANY(_roles), false))
$$;
REVOKE EXECUTE ON FUNCTION public.lp_access(uuid), public.lp_role(uuid), public.lp_has(uuid,text[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.lp_access(uuid), public.lp_role(uuid), public.lp_has(uuid,text[]) TO authenticated;

CREATE TABLE public.lp_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  name text NOT NULL DEFAULT 'Life+',
  logo_url text,
  address text DEFAULT 'Av. Life+, 1000 — Cidade RP',
  phone text DEFAULT '(00) 0000-0000',
  cnpj text DEFAULT '00.000.000/0001-00 (fictício)',
  director text,
  technical_lead text,
  accent text NOT NULL DEFAULT '#0e5ea8',
  specialties text[] NOT NULL DEFAULT ARRAY['Clínica Geral','Cardiologia','Neurologia','Ortopedia','Pediatria','Emergência','Psiquiatria','Dermatologia','Ginecologia','Cirurgia Geral'],
  sectors text[] NOT NULL DEFAULT ARRAY['Emergência','Enfermaria','UTI','Centro Cirúrgico','Pediatria'],
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.lp_settings (id) VALUES (1);

-- patients
CREATE SEQUENCE IF NOT EXISTS public.lp_patient_seq;
ALTER TABLE public.lp_patients
  ADD COLUMN code text,
  ADD COLUMN photo_url text,
  ADD COLUMN nickname text,
  ADD COLUMN phone text,
  ADD COLUMN email text,
  ADD COLUMN address text,
  ADD COLUMN conditions text,
  ADD COLUMN medications text,
  ADD COLUMN medical_notes text,
  ADD COLUMN archived_at timestamptz;
UPDATE public.lp_patients SET code = 'LIFE-' || lpad(nextval('public.lp_patient_seq')::text, 6, '0') WHERE code IS NULL;
ALTER TABLE public.lp_patients ALTER COLUMN code SET DEFAULT 'LIFE-' || lpad(nextval('public.lp_patient_seq')::text, 6, '0');
CREATE UNIQUE INDEX lp_patients_code_idx ON public.lp_patients(code);

ALTER TABLE public.lp_beds ADD COLUMN room text, ADD COLUMN status text NOT NULL DEFAULT 'disponivel';

ALTER TABLE public.lp_exams
  ADD COLUMN category text NOT NULL DEFAULT 'Laboratoriais',
  ADD COLUMN staff_id uuid REFERENCES public.lp_staff(id) ON DELETE SET NULL,
  ADD COLUMN justification text,
  ADD COLUMN scheduled_for timestamptz,
  ADD COLUMN attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN notes text;

CREATE TABLE public.lp_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL DEFAULT 'ATD-' || upper(substr(md5(gen_random_uuid()::text),1,8)),
  patient_id uuid NOT NULL REFERENCES public.lp_patients(id) ON DELETE CASCADE,
  staff_id uuid REFERENCES public.lp_staff(id) ON DELETE SET NULL,
  specialty text,
  starts_at timestamptz NOT NULL,
  duration_min int NOT NULL DEFAULT 30,
  reason text,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('baixa','normal','alta','urgente')),
  status text NOT NULL DEFAULT 'agendada' CHECK (status IN ('agendada','confirmada','aguardando','em_atendimento','concluida','cancelada','nao_compareceu')),
  checked_in_at timestamptz, started_at timestamptz, finished_at timestamptz,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.lp_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.lp_patients(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.lp_appointments(id) ON DELETE SET NULL,
  staff_id uuid REFERENCES public.lp_staff(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('anamnese','evolucao','sinais','avaliacao','diagnostico','conduta','observacao','correcao')),
  specialty text,
  body text NOT NULL DEFAULT '',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  corrects uuid REFERENCES public.lp_records(id),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.lp_diagnosis_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  category text,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.lp_diagnosis_catalog (code, name, category) VALUES
 ('RP-A01','Gripe comum','Infeccioso'),('RP-A02','Infecção bacteriana leve','Infeccioso'),('RP-C10','Arritmia cardíaca','Cardiológico'),
 ('RP-C20','Hipertensão arterial','Cardiológico'),('RP-N05','Enxaqueca','Neurológico'),('RP-N12','Concussão','Neurológico'),
 ('RP-T01','Fratura de membro superior','Trauma'),('RP-T02','Fratura de membro inferior','Trauma'),('RP-T10','Ferimento por arma branca','Trauma'),
 ('RP-T11','Ferimento por arma de fogo','Trauma'),('RP-R03','Crise asmática','Respiratório'),('RP-G04','Gastroenterite','Digestivo'),
 ('RP-P01','Crise de ansiedade','Psiquiátrico'),('RP-D02','Dermatite alérgica','Dermatológico'),('RP-I01','Intoxicação','Toxicológico');

CREATE SEQUENCE IF NOT EXISTS public.lp_doc_seq;
CREATE TABLE public.lp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  name text NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  header text NOT NULL DEFAULT '',
  footer text NOT NULL DEFAULT '',
  accent text NOT NULL DEFAULT '#0e5ea8',
  font text NOT NULL DEFAULT 'serif',
  margin_mm int NOT NULL DEFAULT 20,
  logo_url text,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.lp_templates (kind, name, title, body) VALUES
('atestado','Atestado Life+','ATESTADO MÉDICO','Atesto, para os devidos fins, que o(a) paciente {{paciente.nome}} ({{paciente.codigo}}), {{paciente.idade}}, esteve sob meus cuidados nesta data, necessitando de afastamento de suas atividades por {{documento.dias}} dia(s), de {{documento.inicio}} a {{documento.fim}}.

{{documento.texto}}'),
('receita','Receita Life+','RECEITUÁRIO','Paciente: {{paciente.nome}} — {{paciente.codigo}}
Convênio: {{paciente.convenio}}

{{documento.medicamentos}}

Orientações: {{documento.texto}}'),
('declaracao','Declaração Life+','DECLARAÇÃO DE COMPARECIMENTO','Declaro que {{paciente.nome}} ({{paciente.codigo}}) compareceu a esta instituição em {{documento.data_emissao}}, no horário de {{documento.horario}}, para atendimento médico.

{{documento.texto}}'),
('exames','Solicitação de exames Life+','SOLICITAÇÃO DE EXAMES','Solicito para {{paciente.nome}} ({{paciente.codigo}}) a realização dos seguintes exames:

{{documento.texto}}'),
('encaminhamento','Encaminhamento Life+','ENCAMINHAMENTO MÉDICO','Encaminho o(a) paciente {{paciente.nome}} ({{paciente.codigo}}), {{paciente.idade}}, para avaliação.

{{documento.texto}}'),
('relatorio','Relatório médico Life+','RELATÓRIO MÉDICO','Paciente: {{paciente.nome}} — {{paciente.codigo}} — {{paciente.idade}}
Tipo sanguíneo: {{paciente.tipo_sanguineo}}

{{documento.texto}}'),
('laudo','Laudo Life+','LAUDO MÉDICO','Paciente: {{paciente.nome}} — {{paciente.codigo}}

{{documento.texto}}'),
('alta','Alta hospitalar Life+','RELATÓRIO DE ALTA HOSPITALAR','Paciente {{paciente.nome}} ({{paciente.codigo}}) recebe alta hospitalar nesta data.

{{documento.texto}}');

CREATE TABLE public.lp_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL DEFAULT 'DOC-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.lp_doc_seq')::text, 6, '0'),
  kind text NOT NULL,
  template_id uuid REFERENCES public.lp_templates(id) ON DELETE SET NULL,
  patient_id uuid REFERENCES public.lp_patients(id) ON DELETE CASCADE,
  staff_id uuid REFERENCES public.lp_staff(id) ON DELETE SET NULL,
  title text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  body text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','finalizado','cancelado')),
  finalized_at timestamptz,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX lp_documents_code_idx ON public.lp_documents(code);

CREATE TABLE public.lp_medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  active_ingredient text,
  concentration text,
  presentation text,
  manufacturer text,
  stock int NOT NULL DEFAULT 0,
  min_stock int NOT NULL DEFAULT 10,
  lot text,
  expires_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.lp_medications (name, active_ingredient, concentration, presentation, manufacturer, stock, lot, expires_on) VALUES
('Lifedol','Paracetamolina','500 mg','Comprimido','LifeFarma',200,'LF-001','2028-12-31'),
('Ibulife','Ibuprolina','400 mg','Comprimido','LifeFarma',150,'LF-002','2028-06-30'),
('Amoxilife','Amoxilina RP','500 mg','Cápsula','Sanklech Labs',80,'SK-104','2027-10-31'),
('Cardiozen','Cardiolol','25 mg','Comprimido','Santa Tereza Pharma',60,'ST-220','2028-03-31'),
('Calmaplus','Serenidil','10 mg','Comprimido','LifeFarma',8,'LF-310','2027-08-31'),
('Soro Life+','Solução salina RP','0,9%','Bolsa 500 ml','LifeFarma',40,'LF-500','2029-01-31');

CREATE TABLE public.lp_stock_moves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id uuid NOT NULL REFERENCES public.lp_medications(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('entrada','saida')),
  qty int NOT NULL CHECK (qty > 0),
  note text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.lp_admissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.lp_patients(id) ON DELETE CASCADE,
  staff_id uuid REFERENCES public.lp_staff(id) ON DELETE SET NULL,
  bed_id uuid REFERENCES public.lp_beds(id) ON DELETE SET NULL,
  sector text,
  reason text,
  admitted_at timestamptz NOT NULL DEFAULT now(),
  discharged_at timestamptz,
  discharge_notes text,
  status text NOT NULL DEFAULT 'internado' CHECK (status IN ('internado','alta','transferido','obito')),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.lp_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor uuid,
  table_name text NOT NULL,
  row_id text,
  action text NOT NULL,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lp_staff, public.lp_settings, public.lp_appointments, public.lp_records, public.lp_diagnosis_catalog,
  public.lp_templates, public.lp_documents, public.lp_medications, public.lp_stock_moves, public.lp_admissions TO authenticated;
GRANT SELECT ON public.lp_audit TO authenticated;
GRANT ALL ON public.lp_staff, public.lp_settings, public.lp_appointments, public.lp_records, public.lp_diagnosis_catalog,
  public.lp_templates, public.lp_documents, public.lp_medications, public.lp_stock_moves, public.lp_admissions, public.lp_audit TO service_role;
GRANT USAGE ON SEQUENCE public.lp_patient_seq, public.lp_doc_seq TO authenticated;

ALTER TABLE public.lp_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lp_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lp_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lp_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lp_diagnosis_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lp_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lp_medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lp_stock_moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lp_admissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lp_audit ENABLE ROW LEVEL SECURITY;

-- read for all Life+ staff
CREATE POLICY lp_read ON public.lp_staff FOR SELECT TO authenticated USING (public.lp_access(auth.uid()));
CREATE POLICY lp_read ON public.lp_settings FOR SELECT TO authenticated USING (public.lp_access(auth.uid()));
CREATE POLICY lp_read ON public.lp_appointments FOR SELECT TO authenticated USING (public.lp_access(auth.uid()));
CREATE POLICY lp_read ON public.lp_records FOR SELECT TO authenticated USING (public.lp_access(auth.uid()));
CREATE POLICY lp_read ON public.lp_diagnosis_catalog FOR SELECT TO authenticated USING (public.lp_access(auth.uid()));
CREATE POLICY lp_read ON public.lp_templates FOR SELECT TO authenticated USING (public.lp_access(auth.uid()));
CREATE POLICY lp_read ON public.lp_documents FOR SELECT TO authenticated USING (public.lp_access(auth.uid()));
CREATE POLICY lp_read ON public.lp_medications FOR SELECT TO authenticated USING (public.lp_access(auth.uid()));
CREATE POLICY lp_read ON public.lp_stock_moves FOR SELECT TO authenticated USING (public.lp_access(auth.uid()));
CREATE POLICY lp_read ON public.lp_admissions FOR SELECT TO authenticated USING (public.lp_access(auth.uid()));
CREATE POLICY lp_read ON public.lp_audit FOR SELECT TO authenticated USING (public.lp_has(auth.uid(), ARRAY['administrador','diretor']));

-- admin/diretor manage team, settings, templates
CREATE POLICY lp_write ON public.lp_staff FOR ALL TO authenticated USING (public.lp_has(auth.uid(), ARRAY['administrador','diretor'])) WITH CHECK (public.lp_has(auth.uid(), ARRAY['administrador','diretor']));
CREATE POLICY lp_write ON public.lp_settings FOR UPDATE TO authenticated USING (public.lp_has(auth.uid(), ARRAY['administrador','diretor'])) WITH CHECK (public.lp_has(auth.uid(), ARRAY['administrador','diretor']));
CREATE POLICY lp_write ON public.lp_templates FOR ALL TO authenticated USING (public.lp_has(auth.uid(), ARRAY['administrador','diretor','medico'])) WITH CHECK (public.lp_has(auth.uid(), ARRAY['administrador','diretor','medico']));
CREATE POLICY lp_write ON public.lp_diagnosis_catalog FOR ALL TO authenticated USING (public.lp_has(auth.uid(), ARRAY['administrador','diretor','medico'])) WITH CHECK (public.lp_has(auth.uid(), ARRAY['administrador','diretor','medico']));
-- appointments: reception + clinical
CREATE POLICY lp_write ON public.lp_appointments FOR ALL TO authenticated USING (public.lp_has(auth.uid(), ARRAY['administrador','diretor','medico','enfermeiro','recepcionista','administrativo'])) WITH CHECK (public.lp_has(auth.uid(), ARRAY['administrador','diretor','medico','enfermeiro','recepcionista','administrativo']));
-- records: insert only (immutable history), clinical roles
CREATE POLICY lp_insert ON public.lp_records FOR INSERT TO authenticated WITH CHECK (public.lp_has(auth.uid(), ARRAY['administrador','diretor','medico','enfermeiro','tecnico']));
-- documents: clinical roles create/edit; finalize guarded by trigger
CREATE POLICY lp_write ON public.lp_documents FOR ALL TO authenticated USING (public.lp_has(auth.uid(), ARRAY['administrador','diretor','medico','enfermeiro'])) WITH CHECK (public.lp_has(auth.uid(), ARRAY['administrador','diretor','medico','enfermeiro']));
-- pharmacy
CREATE POLICY lp_write ON public.lp_medications FOR ALL TO authenticated USING (public.lp_has(auth.uid(), ARRAY['administrador','diretor','farmaceutico'])) WITH CHECK (public.lp_has(auth.uid(), ARRAY['administrador','diretor','farmaceutico']));
CREATE POLICY lp_insert ON public.lp_stock_moves FOR INSERT TO authenticated WITH CHECK (public.lp_has(auth.uid(), ARRAY['administrador','diretor','farmaceutico','enfermeiro']));
-- admissions
CREATE POLICY lp_write ON public.lp_admissions FOR ALL TO authenticated USING (public.lp_has(auth.uid(), ARRAY['administrador','diretor','medico','enfermeiro'])) WITH CHECK (public.lp_has(auth.uid(), ARRAY['administrador','diretor','medico','enfermeiro']));

-- triggers
CREATE TRIGGER lp_touch BEFORE UPDATE ON public.lp_staff FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER lp_touch BEFORE UPDATE ON public.lp_appointments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER lp_touch BEFORE UPDATE ON public.lp_templates FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER lp_touch BEFORE UPDATE ON public.lp_medications FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER lp_touch BEFORE UPDATE ON public.lp_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.lp_doc_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'finalizado' AND NOT (NEW.status = 'cancelado' AND NEW.body = OLD.body AND NEW.data = OLD.data) THEN
      RAISE EXCEPTION 'Documento finalizado não pode ser editado';
    END IF;
    IF OLD.status = 'cancelado' THEN RAISE EXCEPTION 'Documento cancelado não pode ser alterado'; END IF;
    NEW.code := OLD.code;
  END IF;
  IF NEW.status = 'finalizado' AND (TG_OP = 'INSERT' OR OLD.status <> 'finalizado') THEN
    IF NOT public.lp_has(auth.uid(), ARRAY['administrador','diretor','medico']) THEN
      RAISE EXCEPTION 'Somente médicos ou diretores podem finalizar documentos';
    END IF;
    NEW.finalized_at := now();
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER lp_doc_guard BEFORE INSERT OR UPDATE ON public.lp_documents FOR EACH ROW EXECUTE FUNCTION public.lp_doc_guard();

CREATE OR REPLACE FUNCTION public.lp_stock_apply() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cur int;
BEGIN
  SELECT stock INTO cur FROM lp_medications WHERE id = NEW.medication_id FOR UPDATE;
  IF NEW.kind = 'saida' AND cur < NEW.qty THEN RAISE EXCEPTION 'Estoque insuficiente'; END IF;
  UPDATE lp_medications SET stock = stock + CASE WHEN NEW.kind = 'entrada' THEN NEW.qty ELSE -NEW.qty END WHERE id = NEW.medication_id;
  RETURN NEW;
END $$;
CREATE TRIGGER lp_stock_apply AFTER INSERT ON public.lp_stock_moves FOR EACH ROW EXECUTE FUNCTION public.lp_stock_apply();

CREATE OR REPLACE FUNCTION public.lp_audit_log() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO lp_audit (actor, table_name, row_id, action, before_data, after_data)
  VALUES (auth.uid(), TG_TABLE_NAME,
    COALESCE((CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END)->>'id', ''),
    lower(TG_OP),
    CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END);
  RETURN COALESCE(NEW, OLD);
END $$;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['lp_patients','lp_staff','lp_settings','lp_appointments','lp_records','lp_templates','lp_documents','lp_medications','lp_stock_moves','lp_admissions','lp_exams','lp_beds'] LOOP
    EXECUTE format('CREATE TRIGGER lp_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.lp_audit_log()', t);
  END LOOP;
END $$;

-- patients: only admin/diretor can delete
DROP POLICY IF EXISTS "lifeplus staff" ON public.lp_patients;
CREATE POLICY lp_read ON public.lp_patients FOR SELECT TO authenticated USING (public.lp_access(auth.uid()));
CREATE POLICY lp_insert ON public.lp_patients FOR INSERT TO authenticated WITH CHECK (public.lp_access(auth.uid()));
CREATE POLICY lp_update ON public.lp_patients FOR UPDATE TO authenticated USING (public.lp_access(auth.uid())) WITH CHECK (public.lp_access(auth.uid()));
CREATE POLICY lp_delete ON public.lp_patients FOR DELETE TO authenticated USING (public.lp_has(auth.uid(), ARRAY['administrador','diretor']) OR is_simulated);