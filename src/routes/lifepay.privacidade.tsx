import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { LifePayTheme, LifePayMark, DISCLOSURE } from "@/components/lifepay/ui";

export const Route = createFileRoute("/lifepay/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de privacidade — LifePay" },
      { name: "description", content: "Como o LifePay trata dados da conta, registros de acesso e dados biométricos usados na autenticação." },
      { property: "og:title", content: "Política de privacidade do LifePay" },
      { property: "og:description", content: "Tratamento de dados da conta, acessos e biometria no LifePay." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Privacidade,
});

const SECTIONS: { t: string; p: string[] }[] = [
  { t: "1. Dados tratados", p: [
    "Dados cadastrais (nome, e-mail), dados financeiros internos (saldo, limite, movimentações, faturas), chaves LifePay, registros de acesso e registros de auditoria.",
    DISCLOSURE,
  ] },
  { t: "2. Finalidade", p: [
    "Os dados são usados para operar a conta, autenticar o titular, prevenir uso indevido e manter o histórico exigido pelas regras internas da Furry's Life Inc.",
  ] },
  { t: "3. Acesso", p: [
    "Cada titular acessa apenas os próprios dados. Administradores só acessam informações quando possuem a permissão específica, e todo acesso administrativo relevante é registrado na auditoria.",
  ] },
  { t: "4. Autenticação e biometria", p: [
    "A biometria é opcional. Quando o dispositivo oferece suporte (Face ID, Windows Hello, biometria do Android, passkeys), a verificação ocorre no próprio dispositivo e o LifePay não recebe nem armazena imagens do rosto.",
    "Quando for utilizada a câmera, as imagens são processadas apenas durante a verificação. Fotografias e vídeos completos não são armazenados de forma permanente.",
    "Nenhum administrador consegue visualizar, baixar, copiar ou exportar dados biométricos. No painel administrativo aparecem apenas status, método, data de ativação e último uso.",
  ] },
  { t: "5. Seus controles", p: [
    "O titular pode consultar o consentimento, desativar a biometria, excluir os dados biométricos, consultar e encerrar sessões e consultar o histórico de segurança na área de privacidade da conta.",
    "A exclusão dos dados biométricos exige confirmação por senha e mantém o acesso por senha funcionando normalmente.",
  ] },
  { t: "6. Retenção", p: [
    "Movimentações financeiras e registros de auditoria são mantidos para fins de histórico e conferência interna. Credenciais biométricas revogadas são removidas.",
  ] },
];

function Privacidade() {
  return (
    <LifePayTheme>
      <div className="mx-auto max-w-3xl px-5 py-10">
        <Link to="/lifepay" className="inline-flex items-center gap-1.5 text-sm lp-muted hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <div className="mt-8"><LifePayMark size={32} /></div>
        <h1 className="mt-6 text-3xl font-bold tracking-tight">Política de privacidade</h1>
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
