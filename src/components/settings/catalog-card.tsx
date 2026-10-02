'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

import { GatedButton } from '@/components/ui/gated-button';
import { useCan } from '@/hooks/use-can';
import { cn } from '@/lib/utils';

type StatusPayload =
  | { status: 'not_connected' | 'no_waba' }
  | {
      status: 'not_synced' | 'ok';
      catalogId: string | null;
      catalogName: string | null;
      itemCount: number;
      syncedAt: string | null;
    };

type SwitchesState =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'ok'; cartEnabled: boolean | null; catalogVisible: boolean | null }
  | { state: 'unavailable' };

/**
 * Settings → WhatsApp → Catalogue. Shows which Meta catalogue the CRM has
 * copied, a Sync now button, and a read-only check of the shop icon and
 * basket button on the connected number. Plan: docs/catalog-cart-plan.md.
 */
export function CatalogCard() {
  const t = useTranslations('Catalog');
  const canEdit = useCan('edit-settings');

  const [data, setData] = useState<StatusPayload | null>(null);
  const [failed, setFailed] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [switches, setSwitches] = useState<SwitchesState>({ state: 'idle' });

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/catalog');
      if (!res.ok) throw new Error(String(res.status));
      setData((await res.json()) as StatusPayload);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function syncNow() {
    setSyncing(true);
    try {
      const res = await fetch('/api/catalog/sync', { method: 'POST' });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        synced?: boolean;
        itemCount?: number;
      };
      if (!res.ok) {
        toast.error(body.error ?? t('syncFailed'));
        return;
      }
      if (body.synced) toast.success(t('syncDone', { count: body.itemCount ?? 0 }));
      await load();
    } catch {
      toast.error(t('syncFailed'));
    } finally {
      setSyncing(false);
    }
  }

  async function checkSettings() {
    setSwitches({ state: 'loading' });
    try {
      const res = await fetch('/api/catalog/settings');
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as {
        status: string;
        cartEnabled?: boolean | null;
        catalogVisible?: boolean | null;
      };
      if (body.status !== 'ok') throw new Error(body.status);
      setSwitches({
        state: 'ok',
        cartEnabled: body.cartEnabled ?? null,
        catalogVisible: body.catalogVisible ?? null,
      });
    } catch {
      setSwitches({ state: 'unavailable' });
      toast.error(t('checkFailed'));
    }
  }

  // The connection card above already says "not connected".
  if (data?.status === 'not_connected') return null;

  const synced = data && (data.status === 'ok' || data.status === 'not_synced') ? data : null;

  return (
    <section className="space-y-5 rounded-2xl bg-card p-6 shadow-card">
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <ShoppingBag className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-foreground">{t('title')}</h2>
          <p className="text-sm text-muted-foreground">{t('description')}</p>
        </div>
        {synced && (
          <span
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
              synced.status === 'ok'
                ? 'bg-primary-soft text-primary'
                : 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
            )}
          >
            {synced.status === 'ok' ? t('connected') : t('notSynced')}
          </span>
        )}
      </div>

      {failed ? (
        <p className="text-sm text-muted-foreground">{t('loadFailed')}</p>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      ) : data.status === 'no_waba' ? (
        <p className="rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          {t('noWaba')}
        </p>
      ) : synced ? (
        <>
          {synced.status === 'ok' ? (
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t('labelCatalogue')} value={synced.catalogName ?? '-'} />
              <Field label={t('labelId')} value={synced.catalogId ?? '-'} />
              <Field label={t('labelItems')} value={synced.itemCount.toLocaleString()} />
              <Field
                label={t('labelSynced')}
                value={synced.syncedAt ? new Date(synced.syncedAt).toLocaleString() : t('neverSynced')}
              />
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">{t('notSyncedHint')}</p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <GatedButton
              canAct={canEdit}
              gateReason={t('gateSync')}
              onClick={syncNow}
              disabled={syncing}
            >
              {syncing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              {syncing ? t('syncing') : t('syncNow')}
            </GatedButton>
            <span className="text-xs text-muted-foreground">{t('syncHint')}</span>
          </div>
        </>
      ) : null}

      {data && (
        <>
          <div className="h-px bg-border" />
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">{t('switchesTitle')}</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SwitchRow
                label={t('switchIcon')}
                value={switches.state === 'ok' ? switches.catalogVisible : undefined}
                checked={switches.state === 'ok'}
              />
              <SwitchRow
                label={t('switchBasket')}
                value={switches.state === 'ok' ? switches.cartEnabled : undefined}
                checked={switches.state === 'ok'}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <GatedButton
                variant="outline"
                canAct={canEdit}
                gateReason={t('gateCheck')}
                onClick={checkSettings}
                disabled={switches.state === 'loading'}
              >
                {switches.state === 'loading' ? t('checking') : t('checkSettings')}
              </GatedButton>
              <span className="text-xs text-muted-foreground">{t('checkHint')}</span>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card-2 px-4 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-semibold text-foreground" title={value}>
        {value}
      </dd>
    </div>
  );
}

/**
 * One switch as Meta reports it. `checked` says whether we have asked yet;
 * `value` is true, false, or null when Meta did not confirm.
 */
function SwitchRow({
  label,
  value,
  checked,
}: {
  label: string;
  value: boolean | null | undefined;
  checked: boolean;
}) {
  const t = useTranslations('Catalog');
  const on = checked && value === true;
  const text = !checked
    ? t('stateNotChecked')
    : value === true
      ? t('stateOn')
      : value === false
        ? t('stateOff')
        : t('stateUnknown');
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5',
        on
          ? 'border-primary/30 bg-primary-soft'
          : checked
            ? 'border-amber-500/30 bg-amber-500/10'
            : 'border-border bg-card-2',
      )}
    >
      <span className="text-sm font-medium text-foreground">{label}</span>
      <span
        className={cn(
          'text-xs font-semibold',
          on
            ? 'text-primary'
            : checked
              ? 'text-amber-700 dark:text-amber-400'
              : 'text-muted-foreground',
        )}
      >
        {text}
      </span>
    </div>
  );
}
