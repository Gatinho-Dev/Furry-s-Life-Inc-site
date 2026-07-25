import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { LifePayTheme, LifePayMark, DISCLOSURE } from "@/components/lifepay/ui";

export const Route = createFileRoute("/lifepay/termos")({
  head: () => ({
    meta: [
      { title: "Termos de uso — LifePay" },
      { name: "description", content: "Termos de uso da plataforma financeira interna LifePay, da Furry's Life Inc." },
      { property: "og:title", content: "Termos de uso do LifePay" },
      { property: "og:description", content: "Condições de uso das contas, transferências e cartão LifePay." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Termos,
});

const SECTIONS: { t: string; p: string[] }[] = [
  { t: "1. Sobre a plataforma", p: [
    "O LifePay é um sistema financeiro interno operado pela Furry's Life Inc. para uso dos integrantes do seu ecossistema.",
    DISCLOSURE,
    "As transferências internas podem ser apresentadas na interface como \"Transferência LifePay\" ou \"Pix LifePay\". Este recurso é próprio do LifePay e não possui qualquer integração com o sistema Pix oficial, com bancos, bandeiras de cartão ou instituições financeiras externas.",
  ] },
  { t: "2. Contas", p: [
    "As contas são criadas exclusivamente por administradores autorizados no painel staff. Não existe cadastro público.",
    "Cada e-mail pode estar vinculado a apenas uma conta LifePay. O titular é responsável por manter a senha e o PIN em sigilo.",
    "No primeiro acesso, o titular deve trocar a senha inicial, aceitar estes termos e configurar suas opções de segurança.",
  ] },
  { t: "3. Saldo, limite e cartão", p: [
    "Os valores existem exclusivamente no banco de dados interno do LifePay e não representam moeda com curso legal, aplicação financeira ou crédito bancário.",
    "O cartão LifePay é virtual e serve apenas para compras internas do ecossistema. Não há emissão de cartão físico nem cobrança externa.",
  ] },
  { t: "4. Operações", p: [
    "Transferências, pagamentos de fatura e compras exigem confirmação por senha, PIN ou biometria e são registradas com data, horário, identificador único e método de autenticação.",
    "Operações concluídas não podem ter seus comprovantes alterados. Correções ocorrem por estorno ou ajuste administrativo, sempre registrados na auditoria.",
  ] },
  { t: "5. Uso indevido", p: [
    "É proibido tentar acessar dados de outro usuário, manipular requisições, valores, identificadores ou burlar as validações do sistema.",
    "Contas envolvidas em uso indevido podem ser bloqueadas ou encerradas por um administrador autorizado.",
  ] },
  { t: "6. Alterações", p: [
    "Estes termos podem ser atualizados. Alterações relevantes serão comunicadas dentro da própria plataforma.",
  ] },
];

function Termos() {
  return (
    <LifePayTheme>
      <div className="mx-auto max-w-3xl px-5 py-10">
        <Link to="/lifepay" className="inline-flex items-center gap-1.5 text-sm lp-muted hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <div className="mt-8"><LifePayMark size={32} /></div>
        <h1 className="mt-6 text-3xl font-bold tracking-tight">Termos de uso</h1>
        <div className="mt-8 space-y-8">
          {SECTIONS.map((s) => (
            <section key={s.t}>
              <h2 className="text-base font-semibold">{s.t}</h2>
              <div className="mt-2 space-y-3 text-sm lp-muted">{s.p.map((x) => <p key={x}>{x}</p>)}</div>
            </section>
          ))}
        </div>
        <div className="mt-10 text-xs lp-muted">Última atualização: {new Date().getFullYear()}</div>
      </div>
    </LifePayTheme>
  );
}
