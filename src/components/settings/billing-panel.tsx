'use client';

// ============================================================
// BillingPanel — Settings → Billing
//
// WAGenie's own subscription: ₹2,500 for one month, paid with
// Razorpay Checkout. This is not the order payments of a business's
// own customers (that is a separate feature with its own keys).
//
// The browser never decides anything about money:
//   1. POST /api/billing/order     — server fixes the amount and asks
//                                    Razorpay for an order.
//   2. Razorpay Checkout opens     — the customer pays on Razorpay.
//   3. POST /api/billing/verify    — server checks the signature and
//                                    asks Razorpay for the payment
//                                    before adding a month.
// Admins and the Owner see the page; only the Owner can pay.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { AlertTriangle, CreditCard, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { formatRupees } from '@/lib/billing/plan';
import { cn } from '@/lib/utils';
import { SettingsPanelHead } from './settings-panel-head';

interface BillingPayment {
  id: string;
  receipt: string;
  amountPaise: number;
  currency: string;
  status: 'created' | 'paid' | 'failed';
  paymentRef: string | null;
  createdAt: string;
  paidAt: string | null;
}

interface BillingStatus {
  plan: { name: string; amountPaise: number; currency: string };
  razorpay: { configured: boolean; testMode: boolean };
  canPay: boolean;
  database: 'ready' | 'migration_missing';
  paidUntil: string | null;
  state: 'active' | 'expired' | 'not_paid';
  payments: BillingPayment[];
}

// What Razorpay Checkout hands back after a successful payment.
interface CheckoutSuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface CheckoutOptions {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill?: { email?: string };
  theme?: { color: string };
  handler: (response: CheckoutSuccess) => void;
  modal?: { ondismiss?: () => void };
}

interface CheckoutInstance {
  open: () => void;
  on: (event: string, callback: () => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: CheckoutOptions) => CheckoutInstance;
  }
}

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

function loadCheckoutScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${CHECKOUT_SRC}"]`,
    );
    const script = existing ?? document.createElement('script');
    script.addEventListener('load', () => resolve(Boolean(window.Razorpay)));
    script.addEventListener('error', () => resolve(false));
    if (!existing) {
      script.src = CHECKOUT_SRC;
      script.async = true;
      document.body.appendChild(script);
    }
  });
}

function StatusPill({ status }: { status: BillingPayment['status'] }) {
  const t = useTranslations('Settings.billing');
  const styles: Record<BillingPayment['status'], string> = {
    paid: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400',
    failed: 'bg-red-500/12 text-red-700 dark:text-red-400',
    created: 'bg-amber-500/12 text-amber-700 dark:text-amber-400',
  };
  const label: Record<BillingPayment['status'], string> = {
    paid: t('paid'),
    failed: t('failed'),
    created: t('pending'),
  };
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium',
        styles[status],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label[status]}
    </span>
  );
}

export function BillingPanel() {
  const t = useTranslations('Settings.billing');
  const locale = useLocale();
  const { user } = useAuth();

  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState<'opening' | 'confirming' | null>(null);

  const fmtDate = useCallback(
    (iso: string) =>
      new Date(iso).toLocaleDateString(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
    [locale],
  );

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/billing', { cache: 'no-store' });
      if (res.status === 403) {
        setBlocked(true);
        return;
      }
      if (!res.ok) {
        toast.error(t('loadFailed'));
        return;
      }
      setStatus((await res.json()) as BillingStatus);
    } catch {
      toast.error(t('networkError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function confirmPayment(response: CheckoutSuccess) {
    setBusy('confirming');
    try {
      const res = await fetch('/api/billing/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(response),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(body.error ?? t('toastFailed'));
      } else {
        toast.success(t('toastPaid'));
      }
      await load();
    } catch {
      toast.error(t('networkError'));
    } finally {
      setBusy(null);
    }
  }

  async function handlePay() {
    setBusy('opening');
    try {
      const scriptReady = await loadCheckoutScript();
      if (!scriptReady || !window.Razorpay) {
        toast.error(t('scriptFailed'));
        setBusy(null);
        return;
      }

      const res = await fetch('/api/billing/order', { method: 'POST' });
      const order = (await res.json().catch(() => ({}))) as {
        error?: string;
        keyId?: string;
        orderId?: string;
        amountPaise?: number;
        currency?: string;
        name?: string;
        description?: string;
      };
      if (!res.ok || !order.keyId || !order.orderId) {
        toast.error(order.error ?? t('toastError'));
        setBusy(null);
        return;
      }

      const checkout = new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amountPaise ?? 0,
        currency: order.currency ?? 'INR',
        name: order.name ?? 'WAGenie',
        description: order.description ?? '',
        prefill: { email: user?.email ?? undefined },
        theme: { color: '#0b6f35' },
        handler: (response) => {
          void confirmPayment(response);
        },
        modal: { ondismiss: () => setBusy(null) },
      });
      checkout.on('payment.failed', () => {
        toast.error(t('toastFailed'));
        setBusy(null);
      });
      checkout.open();
    } catch {
      toast.error(t('networkError'));
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div>
        <SettingsPanelHead title={t('title')} description={t('description')} />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      </div>
    );
  }

  if (blocked || !status) {
    return (
      <div>
        <SettingsPanelHead title={t('title')} description={t('description')} />
        <p className="text-sm text-muted-foreground">{t('roleBlocked')}</p>
      </div>
    );
  }

  const amount = formatRupees(status.plan.amountPaise);
  const stateLabel =
    status.state === 'active' && status.paidUntil
      ? t('stateActive', { date: fmtDate(status.paidUntil) })
      : status.state === 'expired' && status.paidUntil
        ? t('stateExpired', { date: fmtDate(status.paidUntil) })
        : t('stateNotPaid');
  const stateStyle =
    status.state === 'active'
      ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400'
      : 'bg-amber-500/12 text-amber-700 dark:text-amber-400';

  const setupMissing = status.database !== 'ready' || !status.razorpay.configured;
  const canClickPay = status.canPay && !setupMissing && busy === null;

  return (
    <div>
      <SettingsPanelHead title={t('title')} description={t('description')} />

      <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)] xl:items-start">
        <section className="flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[15px] font-semibold text-foreground">
              {t('planName')}
            </h3>
            <span
              className={cn(
                'inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium',
                stateStyle,
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {stateLabel}
            </span>
          </div>

          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-4xl font-semibold tracking-tight text-foreground">
              {amount}
            </span>
            <span className="text-sm text-muted-foreground">{t('perMonth')}</span>
          </div>

          <div className="flex flex-col gap-1.5 text-[13px]">
            <span className="text-foreground">{t('includes')}</span>
            <span className="text-muted-foreground">{t('accessNote')}</span>
          </div>

          <Button
            type="button"
            className="h-11 w-full text-[15px]"
            disabled={!canClickPay}
            onClick={() => void handlePay()}
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CreditCard className="mr-2 h-4 w-4" />
            )}
            {busy === 'opening'
              ? t('opening')
              : busy === 'confirming'
                ? t('confirming')
                : t('pay', { amount })}
          </Button>

          {status.database !== 'ready' ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {t('migrationMissing')}
            </p>
          ) : !status.razorpay.configured ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {t('notConfigured')}
            </p>
          ) : null}

          {status.razorpay.configured && status.razorpay.testMode ? (
            <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {t('testMode')}
            </div>
          ) : null}

          <p className="text-xs text-muted-foreground">
            {status.canPay ? t('ownerOnly') : `${t('roleBlocked')} ${t('ownerOnly')}`}
          </p>
        </section>

        <section className="min-w-0 rounded-2xl bg-card p-5 shadow-card">
          <h3 className="mb-3 text-[15px] font-semibold text-foreground">
            {t('historyTitle')}
          </h3>

          {status.payments.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">{t('empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">{t('colReceipt')}</th>
                    <th className="py-2 pr-3 font-medium">{t('colDate')}</th>
                    <th className="py-2 pr-3 text-right font-medium">{t('colAmount')}</th>
                    <th className="py-2 pr-3 font-medium">{t('colStatus')}</th>
                    <th className="py-2 font-medium">{t('colPayment')}</th>
                  </tr>
                </thead>
                <tbody>
                  {status.payments.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="py-3 pr-3 font-medium text-foreground">{p.receipt}</td>
                      <td className="py-3 pr-3 text-muted-foreground">
                        {fmtDate(p.paidAt ?? p.createdAt)}
                      </td>
                      <td className="py-3 pr-3 text-right font-medium text-foreground">
                        {formatRupees(p.amountPaise)}
                      </td>
                      <td className="py-3 pr-3">
                        <StatusPill status={p.status} />
                      </td>
                      <td className="py-3 text-muted-foreground">{p.paymentRef ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-3 text-xs text-muted-foreground">{t('historyNote')}</p>
        </section>
      </div>
    </div>
  );
}
