import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FormRenderer } from "@/components/workspace/FormRenderer";
import type { FormRow } from "@/lib/workspace/forms";

export const Route = createFileRoute("/f/$id")({
  head: () => ({
    meta: [
      { title: "Formulário — Life Forms" },
      { name: "description", content: "Responda a este formulário criado com o Life Forms, da Furry's Life." },
      { property: "og:title", content: "Formulário — Life Forms" },
      { property: "og:description", content: "Responda a este formulário criado com o Life Forms." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PublicForm,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function PublicForm() {
  const { id } = Route.useParams();
  const [form, setForm] = useState<FormRow | null | undefined>(undefined);
  const [user, setUser] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      setUser(s.session?.user.id ?? null);
      const { data } = await db.from("forms").select("*").eq("id", id).maybeSingle();
      setForm(data ?? null);
      if (data) document.title = `${data.title} — Life Forms`;
    })();
  }, [id]);

  const shell = (c: React.ReactNode) => (
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-2xl">{c}
        <p className="mt-8 text-center text-xs text-muted-foreground">Criado com <span className="font-semibold">Life Forms</span> · Furry's Life Workspace</p>
      </div>
    </div>
  );
  if (form === undefined) return shell(<div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>);
  if (!form) return shell(
    <div className="rounded-3xl border border-border bg-card p-8 text-center">
      <Lock className="mx-auto h-8 w-8 text-muted-foreground" />
      <h1 className="mt-3 font-display text-xl font-bold">Formulário indisponível</h1>
      <p className="mt-2 text-sm text-muted-foreground">Ele pode ser privado, ainda não ter sido publicado ou ter sido removido.</p>
      {!user && <Link to="/auth" search={{ redirect: `/workspace` }} className="mt-5 inline-block rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">Entrar com Furry ID</Link>}
    </div>,
  );
  if (form.status !== "published" || form.settings?.accepting === false) return shell(
    <div className="rounded-3xl border border-border bg-card p-8 text-center"><h1 className="font-display text-xl font-bold">{form.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Este formulário não está aceitando respostas no momento.</p></div>,
  );
  return shell(
    <FormRenderer title={form.title} description={form.description} fields={form.fields} settings={form.settings}
      onSubmit={async (answers) => {
        const key = `lf-sent-${form.id}`;
        if (form.settings?.oneResponse && localStorage.getItem(key)) throw new Error("Você já respondeu este formulário.");
        const { error } = await db.from("form_responses").insert({ form_id: form.id, answers, respondent_id: user });
        if (error) throw new Error("Não foi possível enviar sua resposta.");
        localStorage.setItem(key, "1");
      }} />,
  );
}
