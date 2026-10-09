CREATE TABLE public.lp_beds (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ward text NOT NULL, code text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.lp_patients (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), full_name text NOT NULL, birth_date date, sex text, blood_type text, allergies text, insurance text, complaint text, triage text NOT NULL DEFAULT 'verde', status text NOT NULL DEFAULT 'triagem', bed_id uuid REFERENCES public.lp_beds(id) ON DELETE SET NULL, doctor text, is_simulated boolean NOT NULL DEFAULT false, created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.lp_notes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), patient_id uuid NOT NULL REFERENCES public.lp_patients(id) ON DELETE CASCADE, body text NOT NULL, author text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.lp_vitals (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), patient_id uuid NOT NULL REFERENCES public.lp_patients(id) ON DELETE CASCADE, systolic int, diastolic int, heart_rate int, temperature numeric, spo2 int, measured_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.lp_exams (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), patient_id uuid NOT NULL REFERENCES public.lp_patients(id) ON DELETE CASCADE, kind text NOT NULL, status text NOT NULL DEFAULT 'solicitado', result text, requested_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz);
CREATE TABLE public.lp_prescriptions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), patient_id uuid NOT NULL REFERENCES public.lp_patients(id) ON DELETE CASCADE, medication text NOT NULL, dose text, schedule text, administered_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.lp_shifts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, difficulty text NOT NULL, score int NOT NULL DEFAULT 0, patients_seen int NOT NULL DEFAULT 0, tasks_done int NOT NULL DEFAULT 0, started_at timestamptz NOT NULL DEFAULT now(), ended_at timestamptz);
CREATE TABLE public.lp_shift_tasks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), shift_id uuid REFERENCES public.lp_shifts(id) ON DELETE CASCADE, patient_id uuid REFERENCES public.lp_patients(id) ON DELETE CASCADE, kind text NOT NULL, title text NOT NULL, points int NOT NULL DEFAULT 10, due_at timestamptz, done_at timestamptz, failed boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
DO $$ DECLARE t text; BEGIN
FOREACH t IN ARRAY ARRAY['lp_beds','lp_patients','lp_notes','lp_vitals','lp_exams','lp_prescriptions','lp_shifts','lp_shift_tasks'] LOOP
 EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
 EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
 EXECUTE format('CREATE POLICY "lifeplus staff" ON public.%I FOR ALL TO authenticated USING (public.has_subsidiary_access(auth.uid(),''lifeplus'') OR public.is_ceo_or_admin(auth.uid())) WITH CHECK (public.has_subsidiary_access(auth.uid(),''lifeplus'') OR public.is_ceo_or_admin(auth.uid()))', t);
END LOOP; END $$;
CREATE TRIGGER lp_patients_touch BEFORE UPDATE ON public.lp_patients FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
INSERT INTO public.lp_beds (ward, code) VALUES
('Emergência','EM-01'),('Emergência','EM-02'),('Emergência','EM-03'),('Emergência','EM-04'),('Emergência','EM-05'),('Emergência','EM-06'),
('Enfermaria','EN-101'),('Enfermaria','EN-102'),('Enfermaria','EN-103'),('Enfermaria','EN-104'),('Enfermaria','EN-105'),('Enfermaria','EN-106'),('Enfermaria','EN-107'),('Enfermaria','EN-108'),
('UTI','UTI-01'),('UTI','UTI-02'),('UTI','UTI-03'),('UTI','UTI-04');