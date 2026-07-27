import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  CreditCard, Plus, Lock, Unlock, Trash2, Eye, Loader2, Check, Receipt,
  ShoppingBag, Sliders, Copy, CalendarClock,
} from "lucide-react";
import { LpAlert, LpEmpty, LpSheet, LpSpinner } from "@/components/lifepay/ui";
import { formatBRL, parseBRLToCents } from "@/lib/lifepay-perms";
import {
  loadCards, createCard, cardAction, setCardLimit, loadInvoices, loadInstallments,
  loadPurchases, createPurchase, payInvoice, newIdempotencyKey,
  INSTALLMENT_OPTIONS, INVOICE_STATUS_LABEL,
  type LifePayAccount, type LifePayCard, type LifePayInvoice, type LifePayPurchase,
} from "@/lib/lifepay-client";
import { lifepayRevealCard, lifepayVerifySecret } from "@/lib/lifepay.functions";

const fmtDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR");
const fmtMonth = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

type Props = { userId: string; account: LifePayAccount; refresh: () => Promise<void> };

/* ================================================================== *
 * Confirmação de identidade (senha ou PIN)                            *
 * ================================================================== */

function ConfirmSheet({
  open, onClose, title, description, busy, error, onConfirm,
}: {
  open: boolean; onClose: () => void; title: string; description: string;
  busy: boolean; error: string | null;
  onConfirm: (method: "password" | "pin", value: string) => void;
}) {
  const [method, setMethod] = useState<"password" | "pin">("password");
  const [secret, setSecret] = useState("");
  useEffect(() => { if (!open) setSecret(""); }, [open]);
  return (
    <LpSheet open={open} onClose={() => !busy && onClose()} title={title}>
      <div className="space-y-4">
        <p className="text-sm lp-muted">{description}</p>
        <div className="flex gap-2">
          <button onClick={() => setMethod("password")} className={`lp-btn flex-1 ${method === "password" ? "lp-btn-primary" : "lp-btn-soft"}`}>Senha</button>
          <button onClick={() => setMethod("pin")} className={`lp-btn flex-1 ${method === "pin" ? "lp-btn-primary" : "lp-btn-soft"}`}>PIN</button>
        </div>
        <div>
          <label className="lp-label">{method === "password" ? "Sua senha" : "Seu PIN"}</label>
          <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)}
            className="lp-input" inputMode={method === "pin" ? "numeric" : undefined} autoComplete="off" />
        </div>
        {error && <LpAlert>{error}</LpAlert>}
        <button onClick={() => onConfirm(method, secret)} disabled={busy || !secret} className="lp-btn lp-btn-primary w-full py-3">
          {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Processando...</> : "Confirmar"}
        </button>
        <p className="text-center text-[11px] lp-muted">Você pode usar a senha da conta ou o PIN cadastrado.</p>
      </div>
    </LpSheet>
  );
}

/* ================================================================== *
 * Cartões                                                             *
 * ================================================================== */

export function CardsTab({ userId, account, refresh }: Props) {
  const reveal = useServerFn(lifepayRevealCard);
  const [cards, setCards] = useState<LifePayCard[] | null>(null);
  const [purchases, setPurchases] = useState<LifePayPurchase[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, { pan: string; cvv: string; expiry: string; holder: string }>>({});
  const [revealFor, setRevealFor] = useState<string | null>(null);
  const [revealErr, setRevealErr] = useState<string | null>(null);
  const [limitFor, setLimitFor] = useState<LifePayCard | null>(null);
  const [limitText, setLimitText] = useState("");
  const [buyFor, setBuyFor] = useState<LifePayCard | null>(null);

  const reload = useCallback(async () => {
    const [c, p] = await Promise.all([loadCards(userId), loadPurchases(userId, 20)]);
    setCards(c); setPurchases(p);
  }, [userId]);

  useEffect(() => { reload().catch((e) => setErr(e.message)); }, [reload]);

  const available = Math.max(0, account.credit_limit - (((account as any).credit_used ?? 0) as number));

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErr(null);
    try { await fn(); await reload(); await refresh(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Não foi possível concluir."); }
    finally { setBusy(false); }
  };

  const doReveal = async (method: "password" | "pin", value: string) => {
    if (!revealFor) return;
    setBusy(true); setRevealErr(null);
    try {
      const data = await reveal({ data: { card_id: revealFor, method, value } });
      setRevealed((r) => ({ ...r, [revealFor]: data }));
      setRevealFor(null);
    } catch (e) {
      setRevealErr(e instanceof Error ? e.message : "Não foi possível exibir os dados.");
    } finally { setBusy(false); }
  };

  if (cards === null) return <LpSpinner label="Carregando cartões..." />;

  const main = cards.find((c) => !c.is_temporary);
  const temps = cards.filter((c) => c.is_temporary);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cartão LifePay</h1>
        <p className="mt-1 text-sm lp-muted">Cartão virtual interno, limites e cartões temporários.</p>
      </div>

      {err && <LpAlert>{err}</LpAlert>}

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Limite total", formatBRL(account.credit_limit)],
          ["Limite utilizado", formatBRL(((account as any).credit_used ?? 0) as number)],
          ["Limite disponível", formatBRL(available)],
        ].map(([k, v]) => (
          <div key={k} className="lp-card-2 p-4">
            <div className="text-[11px] uppercase tracking-wider lp-muted">{k}</div>
            <div className="mt-1 text-lg font-bold tabular-nums">{v}</div>
          </div>
        ))}
      </div>

      {!main ? (
        <LpEmpty
          icon={<CreditCard className="h-5 w-5 lp-accent" />}
          title="Você ainda não tem cartão"
          hint="Crie seu cartão virtual LifePay para registrar compras internas e acompanhar faturas."
          action={<button disabled={busy} onClick={() => run(() => createCard("LifePay", false))} className="lp-btn lp-btn-primary">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" /> Criar cartão</>}
          </button>}
        />
      ) : (
        <CardBox card={main} revealed={revealed[main.id]}
          onReveal={() => { setRevealErr(null); setRevealFor(main.id); }}
          onHide={() => setRevealed((r) => { const n = { ...r }; delete n[main.id]; return n; })}
          onBlock={() => run(() => cardAction(main.id, main.status === "active" ? "block" : "unblock"))}
          onLimit={() => { setLimitFor(main); setLimitText(((main.card_limit ?? 0) / 100).toFixed(2).replace(".", ",")); }}
          onBuy={() => setBuyFor(main)}
          busy={busy} />
      )}

      {main && (
        <div className="lp-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Cartões temporários</div>
              <p className="text-xs lp-muted">Válidos por 30 dias, ideais para compras pontuais.</p>
            </div>
            <button disabled={busy} onClick={() => run(() => createCard("Temporário", true))} className="lp-btn lp-btn-soft px-3 py-2 text-xs">
              <Plus className="h-3.5 w-3.5" /> Novo
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {temps.length === 0 && <p className="py-4 text-center text-xs lp-muted">Nenhum cartão temporário ativo.</p>}
            {temps.map((c) => (
              <CardBox key={c.id} card={c} compact revealed={revealed[c.id]}
                onReveal={() => { setRevealErr(null); setRevealFor(c.id); }}
                onHide={() => setRevealed((r) => { const n = { ...r }; delete n[c.id]; return n; })}
                onBlock={() => run(() => cardAction(c.id, c.status === "active" ? "block" : "unblock"))}
                onDelete={() => run(() => cardAction(c.id, "delete"))}
                onLimit={() => { setLimitFor(c); setLimitText(((c.card_limit ?? 0) / 100).toFixed(2).replace(".", ",")); }}
                onBuy={() => setBuyFor(c)}
                busy={busy} />
            ))}
          </div>
        </div>
      )}

      <div className="lp-card p-5">
        <div className="text-sm font-semibold">Últimas compras</div>
        {purchases.length === 0 ? (
          <p className="py-6 text-center text-xs lp-muted">Nenhuma compra registrada.</p>
        ) : (
          <ul className="mt-3 divide-y lp-divide text-sm">
            {purchases.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate">{p.merchant}</span>
                  <span className="block text-[11px] lp-muted">
                    {new Date(p.purchased_at).toLocaleDateString("pt-BR")} ·{" "}
                    {p.installments_count > 1 ? `${p.installments_count}x de ${formatBRL(Math.floor(p.amount / p.installments_count))}` : "à vista"}
                  </span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{formatBRL(p.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmSheet open={!!revealFor} onClose={() => setRevealFor(null)} title="Ver dados do cartão"
        description="Por segurança, confirme sua identidade para exibir número e código de segurança."
        busy={busy} error={revealErr} onConfirm={doReveal} />

      <LpSheet open={!!limitFor} onClose={() => !busy && setLimitFor(null)} title="Ajustar limite do cartão">
        <div className="space-y-4">
          <p className="text-sm lp-muted">Limite aprovado da conta: {formatBRL(account.credit_limit)}.</p>
          <div>
            <label className="lp-label">Limite do cartão</label>
            <input inputMode="decimal" value={limitText} onChange={(e) => setLimitText(e.target.value)} className="lp-input" placeholder="0,00" />
          </div>
          {err && <LpAlert>{err}</LpAlert>}
          <button disabled={busy} className="lp-btn lp-btn-primary w-full"
            onClick={async () => {
              const cents = parseBRLToCents(limitText);
              if (!Number.isFinite(cents) || cents < 0) { setErr("Valor inválido."); return; }
              await run(() => setCardLimit(limitFor!.id, cents));
              setLimitFor(null);
            }}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar limite"}
          </button>
        </div>
      </LpSheet>

      <PurchaseSheet card={buyFor} account={account} onClose={() => setBuyFor(null)}
        onDone={async () => { setBuyFor(null); await reload(); await refresh(); }} />
    </div>
  );
}

function CardBox({
  card, revealed, onReveal, onHide, onBlock, onDelete, onLimit, onBuy, busy, compact,
}: {
  card: LifePayCard;
  revealed?: { pan: string; cvv: string; expiry: string; holder: string };
  onReveal: () => void; onHide: () => void; onBlock: () => void; onDelete?: () => void;
  onLimit: () => void; onBuy: () => void; busy: boolean; compact?: boolean;
}) {
  const blocked = card.status !== "active";
  const copy = (t: string) => navigator.clipboard?.writeText(t).catch(() => {});
  return (
    <div className="lp-card overflow-hidden">
      <div className="relative p-5" style={{
        background: "linear-gradient(135deg, #16303C 0%, #101215 60%)",
        opacity: blocked ? 0.6 : 1,
      }}>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider lp-muted">{card.label}</div>
            <div className="mt-0.5 text-xs lp-muted">{card.is_temporary ? "Temporário" : "Principal"} · virtual</div>
          </div>
          <span className={`lp-chip ${blocked ? "lp-chip-bad" : "lp-chip-ok"}`}>{blocked ? "Bloqueado" : "Ativo"}</span>
        </div>
        <div className="mt-6 font-mono text-lg tracking-widest tabular-nums">
          {revealed ? revealed.pan : `•••• •••• •••• ${card.last4}`}
        </div>
        <div className="mt-4 flex items-end justify-between text-xs">
          <div>
            <div className="lp-muted">Titular</div>
            <div className="font-semibold">{card.holder_name}</div>
          </div>
          <div className="text-right">
            <div className="lp-muted">Validade / CVV</div>
            <div className="font-semibold tabular-nums">
              {revealed ? `${revealed.expiry} · ${revealed.cvv}`
                : `${String(card.exp_month).padStart(2, "0")}/${String(card.exp_year).slice(-2)} · •••`}
            </div>
          </div>
        </div>
        {card.expires_at && (
          <div className="mt-3 flex items-center gap-1.5 text-[11px] lp-muted">
            <CalendarClock className="h-3.5 w-3.5" /> Expira em {new Date(card.expires_at).toLocaleDateString("pt-BR")}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-t p-4 lp-divide">
        {revealed ? (
          <>
            <button onClick={onHide} className="lp-btn lp-btn-soft px-3 py-2 text-xs">Ocultar dados</button>
            <button onClick={() => copy(revealed.pan.replace(/\s/g, ""))} className="lp-btn lp-btn-ghost px-3 py-2 text-xs">
              <Copy className="h-3.5 w-3.5" /> Copiar número
            </button>
          </>
        ) : (
          <button onClick={onReveal} className="lp-btn lp-btn-soft px-3 py-2 text-xs"><Eye className="h-3.5 w-3.5" /> Ver dados</button>
        )}
        <button disabled={busy} onClick={onBlock} className="lp-btn lp-btn-ghost px-3 py-2 text-xs">
          {blocked ? <><Unlock className="h-3.5 w-3.5" /> Desbloquear</> : <><Lock className="h-3.5 w-3.5" /> Bloquear</>}
        </button>
        <button disabled={busy} onClick={onLimit} className="lp-btn lp-btn-ghost px-3 py-2 text-xs">
          <Sliders className="h-3.5 w-3.5" /> Limite ({formatBRL(card.card_limit)})
        </button>
        <button disabled={busy || blocked} onClick={onBuy} className="lp-btn lp-btn-primary px-3 py-2 text-xs">
          <ShoppingBag className="h-3.5 w-3.5" /> Nova compra
        </button>
        {onDelete && (
          <button disabled={busy} onClick={onDelete} className="lp-btn lp-btn-danger px-3 py-2 text-xs">
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </button>
        )}
      </div>
      {!compact && (
        <p className="border-t px-4 py-3 text-[11px] lp-muted lp-divide">
          Os dados completos nunca ficam salvos na tela nem no endereço da página — são exibidos apenas após confirmação.
        </p>
      )}
    </div>
  );
}

function PurchaseSheet({
  card, account, onClose, onDone,
}: { card: LifePayCard | null; account: LifePayAccount; onClose: () => void; onDone: () => Promise<void> }) {
  const [merchant, setMerchant] = useState("");
  const [category, setCategory] = useState("geral");
  const [amountText, setAmountText] = useState("");
  const [parcels, setParcels] = useState(1);
  const [step, setStep] = useState<"form" | "review" | "done">("form");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [idem, setIdem] = useState(newIdempotencyKey);

  useEffect(() => {
    if (card) { setMerchant(""); setAmountText(""); setParcels(1); setStep("form"); setErr(null); setIdem(newIdempotencyKey()); }
  }, [card]);

  const amount = parseBRLToCents(amountText);
  const per = Number.isFinite(amount) && amount > 0 ? Math.floor(amount / parcels) : 0;
  const available = Math.max(0, account.credit_limit - (((account as any).credit_used ?? 0) as number));

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      await createPurchase({
        cardId: card!.id, merchant: merchant.trim(), amount, installments: parcels,
        category, idempotencyKey: idem,
      });
      setStep("done");
      await onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Não foi possível registrar a compra.");
    } finally { setBusy(false); }
  };

  return (
    <LpSheet open={!!card} onClose={() => !busy && onClose()} title="Nova compra no cartão">
      {step === "done" ? (
        <div className="space-y-4 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full" style={{ background: "rgba(47,227,194,.15)" }}>
            <Check className="h-6 w-6 lp-accent" />
          </div>
          <div className="text-sm">Compra registrada e limite reservado.</div>
          <button onClick={onClose} className="lp-btn lp-btn-primary w-full">Fechar</button>
        </div>
      ) : step === "review" ? (
        <div className="space-y-4">
          <dl className="divide-y lp-divide text-sm">
            {[
              ["Estabelecimento", merchant.trim()],
              ["Categoria", category],
              ["Valor total", formatBRL(amount)],
              ["Parcelamento", parcels === 1 ? "À vista" : `${parcels}x de ${formatBRL(per)}`],
              ["Cartão", `•••• ${card?.last4}`],
              ["Limite após a compra", formatBRL(Math.max(0, available - amount))],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-2.5">
                <dt className="lp-muted">{k}</dt><dd className="text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          {err && <LpAlert>{err}</LpAlert>}
          <div className="flex gap-2">
            <button disabled={busy} onClick={() => setStep("form")} className="lp-btn lp-btn-ghost flex-1">Voltar</button>
            <button disabled={busy} onClick={submit} className="lp-btn lp-btn-primary flex-1">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar compra"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="lp-label">Estabelecimento</label>
            <input value={merchant} onChange={(e) => setMerchant(e.target.value.slice(0, 60))} className="lp-input" placeholder="Ex.: Furry's Life Studios" />
          </div>
          <div>
            <label className="lp-label">Categoria</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="lp-input">
              {["geral", "alimentação", "transporte", "serviços", "assinaturas", "lazer"].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="lp-label">Valor</label>
            <input inputMode="decimal" value={amountText} onChange={(e) => setAmountText(e.target.value)} className="lp-input text-lg" placeholder="0,00" />
            <p className="mt-2 text-xs lp-muted">Limite disponível: {formatBRL(available)}</p>
          </div>
          <div>
            <label className="lp-label">Parcelamento</label>
            <div className="flex flex-wrap gap-2">
              {INSTALLMENT_OPTIONS.map((n) => (
                <button key={n} onClick={() => setParcels(n)}
                  className={`lp-chip ${parcels === n ? "lp-chip-ok" : "hover:text-white"}`}>
                  {n === 1 ? "À vista" : `${n}x`}
                </button>
              ))}
            </div>
            {parcels > 1 && per > 0 && <p className="mt-2 text-xs lp-muted">{parcels}x de {formatBRL(per)}</p>}
          </div>
          {err && <LpAlert>{err}</LpAlert>}
          <button className="lp-btn lp-btn-primary w-full"
            onClick={() => {
              if (!merchant.trim()) { setErr("Informe o estabelecimento."); return; }
              if (!Number.isFinite(amount) || amount <= 0) { setErr("Informe um valor maior que zero."); return; }
              setErr(null); setStep("review");
            }}>
            Revisar compra
          </button>
        </div>
      )}
    </LpSheet>
  );
}

/* ================================================================== *
 * Faturas                                                             *
 * ================================================================== */

export function InvoicesTab({ userId, account, refresh }: Props) {
  const [invoices, setInvoices] = useState<LifePayInvoice[] | null>(null);
  const [open, setOpen] = useState<LifePayInvoice | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [payFor, setPayFor] = useState<LifePayInvoice | null>(null);
  const [payText, setPayText] = useState("");
  const [payErr, setPayErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setInvoices(await loadInvoices(userId));
  }, [userId]);

  useEffect(() => { reload().catch((e) => setErr(e.message)); }, [reload]);

  useEffect(() => {
    if (!open) { setItems([]); return; }
    loadInstallments(open.id).then(setItems).catch(() => setItems([]));
  }, [open]);

  const current = useMemo(() => (invoices ?? []).find((i) => i.status !== "paid" && i.status !== "canceled") ?? null, [invoices]);

  

  if (invoices === null) return <LpSpinner label="Carregando faturas..." />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Faturas</h1>
        <p className="mt-1 text-sm lp-muted">Fatura atual, próximas e anteriores, com pagamento pelo saldo.</p>
      </div>

      {err && <LpAlert>{err}</LpAlert>}

      {invoices.length === 0 ? (
        <LpEmpty icon={<Receipt className="h-5 w-5 lp-accent" />} title="Nenhuma fatura ainda"
          hint="As faturas aparecem aqui assim que você registrar a primeira compra no cartão." />
      ) : (
        <>
          {current && (
            <div className="lp-card p-6">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider lp-muted">Fatura atual</span>
                <span className="lp-chip">{INVOICE_STATUS_LABEL[current.status] ?? current.status}</span>
              </div>
              <div className="mt-1 text-3xl font-black tabular-nums">{formatBRL(current.total - current.paid)}</div>
              <div className="mt-1 text-xs lp-muted">
                {fmtMonth(current.reference_month)} · fecha {fmtDay(current.closing_date)} · vence {fmtDay(current.due_date)}
              </div>
              {current.paid > 0 && <div className="mt-1 text-xs lp-muted">Já pago: {formatBRL(current.paid)} de {formatBRL(current.total)}</div>}
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="lp-btn lp-btn-primary px-4 py-2 text-xs"
                  disabled={current.total - current.paid <= 0}
                  onClick={() => { setPayErr(null); setPayFor(current); setPayText(((current.total - current.paid) / 100).toFixed(2).replace(".", ",")); }}>
                  Pagar fatura
                </button>
                <button className="lp-btn lp-btn-ghost px-4 py-2 text-xs" onClick={() => setOpen(current)}>Ver detalhes</button>
              </div>
              <p className="mt-3 text-[11px] lp-muted">Saldo disponível: {formatBRL(account.balance)}</p>
            </div>
          )}

          <div className="lp-card p-5">
            <div className="text-sm font-semibold">Todas as faturas</div>
            <ul className="mt-3 divide-y lp-divide text-sm">
              {invoices.map((i) => (
                <li key={i.id}>
                  <button onClick={() => setOpen(i)} className="flex w-full items-center justify-between gap-3 py-3 text-left">
                    <span className="min-w-0">
                      <span className="block truncate capitalize">{fmtMonth(i.reference_month)}</span>
                      <span className="block text-[11px] lp-muted">Vence {fmtDay(i.due_date)} · {INVOICE_STATUS_LABEL[i.status] ?? i.status}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-semibold tabular-nums">{formatBRL(i.total)}</span>
                      {i.paid > 0 && i.paid < i.total && <span className="block text-[11px] lp-muted">pago {formatBRL(i.paid)}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <LpSheet open={!!open} onClose={() => setOpen(null)} title={open ? `Fatura ${fmtMonth(open.reference_month)}` : "Fatura"}>
        {open && (
          <div className="space-y-4">
            <dl className="divide-y lp-divide text-sm">
              {[
                ["Situação", INVOICE_STATUS_LABEL[open.status] ?? open.status],
                ["Fechamento", fmtDay(open.closing_date)],
                ["Vencimento", fmtDay(open.due_date)],
                ["Total", formatBRL(open.total)],
                ["Pago", formatBRL(open.paid)],
                ["Em aberto", formatBRL(open.total - open.paid)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-2.5">
                  <dt className="lp-muted">{k}</dt><dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            <div>
              <div className="lp-label">Lançamentos</div>
              {items.length === 0 ? (
                <p className="py-4 text-center text-xs lp-muted">Nenhum lançamento nesta fatura.</p>
              ) : (
                <ul className="divide-y lp-divide text-sm">
                  {items.map((it) => (
                    <li key={it.id} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="min-w-0">
                        <span className="block truncate">{it.purchase?.merchant ?? "Compra"}</span>
                        <span className="block text-[11px] lp-muted">
                          Parcela {it.number}/{it.total_count} · {it.status === "paid" ? "paga" : "em aberto"}
                        </span>
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums">{formatBRL(it.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {open.total - open.paid > 0 && (
              <button className="lp-btn lp-btn-primary w-full"
                onClick={() => { setPayErr(null); setPayFor(open); setPayText(((open.total - open.paid) / 100).toFixed(2).replace(".", ",")); setOpen(null); }}>
                Pagar fatura
              </button>
            )}
          </div>
        )}
      </LpSheet>

      <PayInvoiceSheet
        invoice={payFor} account={account} onClose={() => setPayFor(null)}
        amountText={payText} setAmountText={setPayText}
        error={payErr} setError={setPayErr} busy={busy} setBusy={setBusy}
        onPaid={async (code) => { setPayFor(null); setReceipt(code); await reload(); await refresh(); }}
      />

      <LpSheet open={!!receipt} onClose={() => setReceipt(null)} title="Pagamento confirmado">
        <div className="space-y-4 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full" style={{ background: "rgba(47,227,194,.15)" }}>
            <Check className="h-6 w-6 lp-accent" />
          </div>
          <div className="text-sm">Fatura paga com o saldo da conta.</div>
          <div className="lp-card-2 p-3 text-xs lp-muted">Comprovante: <span className="font-mono">{receipt}</span></div>
          <button onClick={() => setReceipt(null)} className="lp-btn lp-btn-primary w-full">Fechar</button>
        </div>
      </LpSheet>

    </div>
  );
}

function PayInvoiceSheet({
  invoice, account, onClose, amountText, setAmountText, error, setError, busy, setBusy, onPaid,
}: {
  invoice: LifePayInvoice | null; account: LifePayAccount; onClose: () => void;
  amountText: string; setAmountText: (v: string) => void;
  error: string | null; setError: (v: string | null) => void;
  busy: boolean; setBusy: (v: boolean) => void;
  onPaid: (receiptCode: string) => Promise<void>;
}) {
  const [method, setMethod] = useState<"password" | "pin">("password");
  const [secret, setSecret] = useState("");
  const [idem, setIdem] = useState(newIdempotencyKey);
  const verify = useServerFn(lifepayVerifySecret);

  useEffect(() => { if (invoice) { setSecret(""); setIdem(newIdempotencyKey()); } }, [invoice]);

  const due = invoice ? invoice.total - invoice.paid : 0;
  const amount = parseBRLToCents(amountText);

  const submit = async () => {
    if (!invoice) return;
    if (!Number.isFinite(amount) || amount <= 0) { setError("Informe um valor maior que zero."); return; }
    if (amount > due) { setError("Valor acima do saldo devedor da fatura."); return; }
    if (amount > account.balance) { setError("Saldo insuficiente para este pagamento."); return; }
    setBusy(true); setError(null);
    try {
      await verify({ data: { method, value: secret } });
      const tx = await payInvoice({ invoiceId: invoice.id, amount, authMethod: method, idempotencyKey: idem });
      await onPaid(tx.receipt_code ?? "—");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível pagar a fatura.");
    } finally { setBusy(false); }
  };

  return (
    <LpSheet open={!!invoice} onClose={() => !busy && onClose()} title="Pagar fatura">
      <div className="space-y-4">
        <div className="lp-card-2 p-4 text-sm">
          <div className="flex justify-between"><span className="lp-muted">Em aberto</span><span className="font-semibold">{formatBRL(due)}</span></div>
          <div className="mt-1 flex justify-between"><span className="lp-muted">Saldo</span><span className="font-semibold">{formatBRL(account.balance)}</span></div>
        </div>
        <div>
          <label className="lp-label">Valor do pagamento</label>
          <input inputMode="decimal" value={amountText} onChange={(e) => setAmountText(e.target.value)} className="lp-input text-lg" placeholder="0,00" />
          <div className="mt-2 flex flex-wrap gap-2">
            <button onClick={() => setAmountText((due / 100).toFixed(2).replace(".", ","))} className="lp-chip hover:text-white">Total</button>
            <button onClick={() => setAmountText((Math.floor(due / 2) / 100).toFixed(2).replace(".", ","))} className="lp-chip hover:text-white">Metade</button>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setMethod("password")} className={`lp-btn flex-1 ${method === "password" ? "lp-btn-primary" : "lp-btn-soft"}`}>Senha</button>
          <button onClick={() => setMethod("pin")} className={`lp-btn flex-1 ${method === "pin" ? "lp-btn-primary" : "lp-btn-soft"}`}>PIN</button>
        </div>
        <div>
          <label className="lp-label">{method === "password" ? "Sua senha" : "Seu PIN"}</label>
          <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} className="lp-input"
            inputMode={method === "pin" ? "numeric" : undefined} autoComplete="off" />
        </div>
        {error && <LpAlert>{error}</LpAlert>}
        <button onClick={submit} disabled={busy || !secret} className="lp-btn lp-btn-primary w-full py-3">
          {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Processando...</> : "Confirmar pagamento"}
        </button>
      </div>
    </LpSheet>
  );
}


