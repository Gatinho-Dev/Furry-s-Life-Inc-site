import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { LifePayTheme, LifePayMark, DISCLOSURE } from "@/components/lifepay/ui";

export const Route = createFileRoute("/lifepay/sobre")({
  head: () => ({
    meta: [
      { title: "Sobre o LifePay — Furry's Life Inc." },
      { name: "description", content: "Entenda o que é o LifePay, como ele funciona dentro da Furry's Life Inc. e quais recursos a conta oferece." },
      { property: "og:title", content: "Sobre o LifePay" },
      { property: "og:description", content: "A plataforma financeira interna do ecossistema Furry's Life Inc." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Sobre,
});

function Sobre() {
  return (
    <LifePayTheme>
      <div className="mx-auto max-w-3xl px-5 py-10">
        <Link to="/lifepay" className="inline-flex items-center gap-1.5 text-sm lp-muted hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <div className="mt-8"><LifePayMark size={32} /></div>
        <h1 className="mt-6 text-3xl font-bold tracking-tight">Sobre o LifePay</h1>
        <div className="mt-6 space-y-5 text-sm lp-muted">
          <p>
            O LifePay é a plataforma financeira interna da Furry's Life Inc. Ele centraliza o saldo das contas internas,
            as transferências entre usuários, as chaves de recebimento, o cartão virtual usado nas compras do
            ecossistema, as faturas e o histórico completo de movimentações.
          </p>
          <p>
            As contas são criadas exclusivamente por administradores autorizados no painel staff. Cada usuário acessa
            somente os próprios dados, e toda operação sensível exige confirmação por senha, PIN ou biometria do
            dispositivo.
          </p>
          <p>
            Todas as validações — saldo, limite, status da conta, permissões e método de autenticação — acontecem no
            servidor. As transferências são atômicas: ou são registradas por completo, ou nada é alterado.
          </p>
          <p className="rounded-2xl border px-4 py-3" style={{ borderColor: "var(--lp-line-2)" }}>{DISCLOSURE}</p>
        </div>
        <div className="mt-8 flex gap-3">
          <Link to="/lifepay/termos" className="lp-btn lp-btn-ghost">Termos de uso</Link>
          <Link to="/lifepay/privacidade" className="lp-btn lp-btn-ghost">Privacidade</Link>
        </div>
      </div>
    </LifePayTheme>
  );
}
