'use client';

/**
 * PAYMENT INTEGRATIONS — Instruction 28.
 *
 * Three cards on GET/PUT /api/payments-integration (secrets masked server-side
 * to their last 4 chars; an empty edit keeps the stored value):
 *  (a) Direct M-Pesa (Daraja STK Push) — enable toggle, environment, consumer
 *      key/secret, shortcode, passkey, callback URL ({APP_URL} hint prefilled).
 *  (b) PesaPal (M-Pesa push + POS card checkout) — enable toggle, environment,
 *      consumer key/secret, IPN URL.
 *  (c) POS Activation — pos_payment_active_method (CASH_ONLY / MPESA_ONLY /
 *      PESAPAL_ONLY / BOTH) + explanation: activated methods automatically
 *      appear at Cashier POS and Pharmacy POS during payment.
 */

import * as React from 'react';
import {
  CreditCard, Smartphone, Landmark, Store, Save, Pencil, X, Link2, ShieldCheck,
  KeyRound, Webhook, Globe, CheckCircle2, AlertCircle, Loader2,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet, apiPut } from '@/lib/client-api';
import { toast } from 'sonner';
import { Field, PageHeading, McInput } from '../_lib';

type PosMethod = 'CASH_ONLY' | 'MPESA_ONLY' | 'PESAPAL_ONLY' | 'BOTH';

interface IntegrationConfig {
  mpesa_enabled: string;
  mpesa_environment: string;
  mpesa_consumer_key: string;
  mpesa_consumer_secret: string; // masked ••••1234
  mpesa_shortcode: string;
  mpesa_passkey: string;         // masked ••••1234
  mpesa_callback_url: string;
  pesapal_enabled: string;
  pesapal_environment: string;
  pesapal_consumer_key: string;
  pesapal_consumer_secret: string; // masked ••••1234
  pesapal_ipn_url: string;
  pos_payment_active_method: PosMethod;
}

interface IntegrationStatus {
  mpesa: { enabled: boolean; credentialsSet: boolean; ready: boolean };
  pesapal: { enabled: boolean; credentialsSet: boolean; ready: boolean };
  pos: { cash: boolean; mpesa: boolean; pesapal: boolean; activeMethod: PosMethod };
}

const POS_METHOD_OPTIONS: Array<{ value: PosMethod; label: string; hint: string }> = [
  { value: 'CASH_ONLY', label: 'Cash only', hint: 'Cash only at POS — digital options hidden' },
  { value: 'MPESA_ONLY', label: 'M-Pesa only', hint: 'STK push only at POS' },
  { value: 'PESAPAL_ONLY', label: 'PesaPal card only', hint: 'Card checkout only at POS' },
  { value: 'BOTH', label: 'All methods (cash + M-Pesa + card)', hint: 'Show all activated methods' },
];

const SECRET_KEYS = ['mpesa_consumer_secret', 'mpesa_passkey', 'pesapal_consumer_secret'] as const;
type SecretKey = typeof SECRET_KEYS[number];

interface SecretState { masked: string; editing: boolean; draft: string }

export default function PaymentIntegrationsPage() {
  const [cfg, setCfg] = React.useState<IntegrationConfig | null>(null);
  const [status, setStatus] = React.useState<IntegrationStatus | null>(null);
  const [secrets, setSecrets] = React.useState<Record<SecretKey, SecretState>>({
    mpesa_consumer_secret: { masked: '', editing: false, draft: '' },
    mpesa_passkey: { masked: '', editing: false, draft: '' },
    pesapal_consumer_secret: { masked: '', editing: false, draft: '' },
  });
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState<'mpesa' | 'pesapal' | 'pos' | null>(null);
  const [origin, setOrigin] = React.useState('');

  const load = React.useCallback(async () => {
    try {
      const res = await apiGet<{ config: IntegrationConfig; status: IntegrationStatus }>('/api/payments-integration');
      setCfg(res.config);
      setStatus(res.status);
      setSecrets({
        mpesa_consumer_secret: { masked: res.config.mpesa_consumer_secret, editing: false, draft: '' },
        mpesa_passkey: { masked: res.config.mpesa_passkey, editing: false, draft: '' },
        pesapal_consumer_secret: { masked: res.config.pesapal_consumer_secret, editing: false, draft: '' },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load payment integrations');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    setOrigin(window.location.origin);
    load();
  }, [load]);

  const set = <K extends keyof IntegrationConfig>(key: K, value: IntegrationConfig[K]) => {
    setCfg(c => (c ? { ...c, [key]: value } : c));
  };

  const editSecret = (key: SecretKey, editing: boolean) => {
    setSecrets(s => ({ ...s, [key]: { ...s[key], editing, draft: '' } }));
  };
  const draftSecret = (key: SecretKey, value: string) => {
    setSecrets(s => ({ ...s, [key]: { ...s[key], draft: value } }));
  };

  /** PUT one card's settings — secret drafts included only when typed. */
  const saveCard = async (card: 'mpesa' | 'pesapal' | 'pos') => {
    if (!cfg) return;
    setSaving(card);
    try {
      const settings: Record<string, string> = {};
      if (card === 'mpesa') {
        settings.mpesa_enabled = cfg.mpesa_enabled;
        settings.mpesa_environment = cfg.mpesa_environment;
        settings.mpesa_consumer_key = cfg.mpesa_consumer_key;
        settings.mpesa_shortcode = cfg.mpesa_shortcode;
        settings.mpesa_callback_url = cfg.mpesa_callback_url;
        for (const k of ['mpesa_consumer_secret', 'mpesa_passkey'] as SecretKey[]) {
          if (secrets[k].editing && secrets[k].draft.trim()) settings[k] = secrets[k].draft.trim();
        }
      } else if (card === 'pesapal') {
        settings.pesapal_enabled = cfg.pesapal_enabled;
        settings.pesapal_environment = cfg.pesapal_environment;
        settings.pesapal_consumer_key = cfg.pesapal_consumer_key;
        settings.pesapal_ipn_url = cfg.pesapal_ipn_url;
        if (secrets.pesapal_consumer_secret.editing && secrets.pesapal_consumer_secret.draft.trim()) {
          settings.pesapal_consumer_secret = secrets.pesapal_consumer_secret.draft.trim();
        }
      } else {
        settings.pos_payment_active_method = cfg.pos_payment_active_method;
      }
      const res = await apiPut<{ updated: number; changed: string[] }>('/api/payments-integration', { settings });
      toast.success(
        res.updated > 0
          ? `${card === 'pos' ? 'POS activation' : card === 'mpesa' ? 'M-Pesa (Daraja)' : 'PesaPal'} settings saved (${res.updated} key${res.updated === 1 ? '' : 's'})`
          : 'Saved — nothing to change'
      );
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save settings');
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-72 rounded-xl" />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Skeleton className="h-[420px] rounded-xl" />
          <Skeleton className="h-[420px] rounded-xl" />
        </div>
        <Skeleton className="h-56 rounded-xl" />
      </div>
    );
  }

  if (!cfg || !status) {
    return <div className="rounded-xl border bg-white p-10 text-center text-muted-foreground">Payment integrations unavailable.</div>;
  }

  const defaultCallback = `${origin || '{APP_URL}'}/api/payments-integration?action=mpesa-callback`;

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<CreditCard className="h-5 w-5" />}
        title="Payment Integrations"
        subtitle="M-Pesa Daraja STK Push + PesaPal card checkout credentials, and which payment methods are activated at the POS"
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
        {/* ── (a) Direct M-Pesa (Daraja) ── */}
        <section className="rounded-xl border bg-white p-5 space-y-4">
          <header className="flex items-start gap-3">
            <span className="h-10 w-10 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: 'linear-gradient(135deg, #10b981 0%, #047857 100%)' }}>
              <Smartphone className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-extrabold text-[var(--mc-text-primary)] flex flex-wrap items-center gap-2">
                Direct M-Pesa (Daraja)
                <CredBadge credentialsSet={status.mpesa.credentialsSet} enabled={status.mpesa.enabled} />
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                STK Push — the customer&apos;s phone pops the M-Pesa PIN prompt at the counter (sandbox / production).
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 pt-1">
              <Switch
                checked={cfg.mpesa_enabled === 'true'}
                onCheckedChange={v => set('mpesa_enabled', v ? 'true' : 'false')}
              />
              <span className="text-[11px] font-semibold text-muted-foreground">{cfg.mpesa_enabled === 'true' ? 'Enabled' : 'Disabled'}</span>
            </div>
          </header>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field icon={<Globe className="h-3.5 w-3.5" />} label="Environment">
              <Select value={cfg.mpesa_environment} onValueChange={v => set('mpesa_environment', v)}>
                <SelectTrigger className="mc-input h-9 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox (test)</SelectItem>
                  <SelectItem value="production">Production (live)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field icon={<Store className="h-3.5 w-3.5" />} label="Business Shortcode (Paybill / Till)">
              <McInput value={cfg.mpesa_shortcode} onChange={e => set('mpesa_shortcode', e.target.value)} placeholder="e.g. 174379" />
            </Field>
            <Field icon={<KeyRound className="h-3.5 w-3.5" />} label="Consumer Key" className="sm:col-span-2">
              <McInput value={cfg.mpesa_consumer_key} onChange={e => set('mpesa_consumer_key', e.target.value)} placeholder="Daraja app consumer key" />
            </Field>

            <SecretRow
              label="Consumer Secret"
              state={secrets.mpesa_consumer_secret}
              onEdit={v => editSecret('mpesa_consumer_secret', v)}
              onDraft={v => draftSecret('mpesa_consumer_secret', v)}
            />
            <SecretRow
              label="Passkey (Lipa na M-Pesa)"
              state={secrets.mpesa_passkey}
              onEdit={v => editSecret('mpesa_passkey', v)}
              onDraft={v => draftSecret('mpesa_passkey', v)}
            />

            <Field
              icon={<Link2 className="h-3.5 w-3.5" />}
              label="Callback URL"
              className="sm:col-span-2"
              hint={`Daraja posts the payment result here — default ${defaultCallback}`}
            >
              <div className="flex gap-2">
                <McInput
                  value={cfg.mpesa_callback_url}
                  onChange={e => set('mpesa_callback_url', e.target.value)}
                  placeholder={defaultCallback}
                />
                <Button
                  type="button" variant="outline" size="sm" className="h-9 shrink-0 gap-1"
                  onClick={() => set('mpesa_callback_url', defaultCallback)}
                  title="Use the default callback URL for this deployment"
                >
                  <Webhook className="h-3.5 w-3.5" /> Use default
                </Button>
              </div>
            </Field>
          </div>

          <div className="flex items-center justify-end pt-2 border-t border-[var(--mc-divider)]">
            <Button size="sm" className="gap-1" onClick={() => saveCard('mpesa')} disabled={saving !== null}>
              {saving === 'mpesa' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving === 'mpesa' ? 'Saving…' : 'Save M-Pesa Settings'}
            </Button>
          </div>
        </section>

        {/* ── (b) PesaPal ── */}
        <section className="rounded-xl border bg-white p-5 space-y-4">
          <header className="flex items-start gap-3">
            <span className="h-10 w-10 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)' }}>
              <Landmark className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-extrabold text-[var(--mc-text-primary)] flex flex-wrap items-center gap-2">
                PesaPal
                <CredBadge credentialsSet={status.pesapal.credentialsSet} enabled={status.pesapal.enabled} />
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                M-Pesa push + POS card checkout — opens a secure PesaPal card page for the customer.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 pt-1">
              <Switch
                checked={cfg.pesapal_enabled === 'true'}
                onCheckedChange={v => set('pesapal_enabled', v ? 'true' : 'false')}
              />
              <span className="text-[11px] font-semibold text-muted-foreground">{cfg.pesapal_enabled === 'true' ? 'Enabled' : 'Disabled'}</span>
            </div>
          </header>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field icon={<Globe className="h-3.5 w-3.5" />} label="Environment">
              <Select value={cfg.pesapal_environment} onValueChange={v => set('pesapal_environment', v)}>
                <SelectTrigger className="mc-input h-9 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox (demo — cyb.pesapal.com)</SelectItem>
                  <SelectItem value="production">Production (live — pay.pesapal.com)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field icon={<KeyRound className="h-3.5 w-3.5" />} label="Consumer Key">
              <McInput value={cfg.pesapal_consumer_key} onChange={e => set('pesapal_consumer_key', e.target.value)} placeholder="PesaPal v3 consumer key" />
            </Field>
            <SecretRow
              label="Consumer Secret"
              state={secrets.pesapal_consumer_secret}
              onEdit={v => editSecret('pesapal_consumer_secret', v)}
              onDraft={v => draftSecret('pesapal_consumer_secret', v)}
            />
            <Field
              icon={<Webhook className="h-3.5 w-3.5" />}
              label="IPN URL"
              hint="PesaPal Instant Payment Notification endpoint — registered automatically on first order"
            >
              <McInput value={cfg.pesapal_ipn_url} onChange={e => set('pesapal_ipn_url', e.target.value)} placeholder={`${origin || '{APP_URL}'}/api/payments-integration?action=pesapal-ipn`} />
            </Field>
          </div>

          <div className="flex items-center justify-end pt-2 border-t border-[var(--mc-divider)]">
            <Button size="sm" className="gap-1" onClick={() => saveCard('pesapal')} disabled={saving !== null}>
              {saving === 'pesapal' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving === 'pesapal' ? 'Saving…' : 'Save PesaPal Settings'}
            </Button>
          </div>
        </section>
      </div>

      {/* ── (c) POS Activation ── */}
      <section className="rounded-xl border bg-white p-5 space-y-4">
        <header className="flex items-start gap-3">
          <span className="h-10 w-10 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)' }}>
            <Store className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-extrabold text-[var(--mc-text-primary)]">POS Activation</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Activated methods automatically appear at Cashier POS and Pharmacy POS during payment.
            </p>
          </div>
          <Button size="sm" className="gap-1 shrink-0" onClick={() => saveCard('pos')} disabled={saving !== null}>
            {saving === 'pos' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving === 'pos' ? 'Saving…' : 'Save Activation'}
          </Button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Field icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Active payment method at POS">
            <Select value={cfg.pos_payment_active_method} onValueChange={v => set('pos_payment_active_method', v as PosMethod)}>
              <SelectTrigger className="mc-input h-9 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {POS_METHOD_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              {POS_METHOD_OPTIONS.find(o => o.value === cfg.pos_payment_active_method)?.hint}
              {cfg.pos_payment_active_method === 'BOTH' && ' — cash plus every integration with credentials set.'}
            </p>
          </Field>

          {/* live snapshot of what the POS sees right now */}
          <div className="rounded-xl border border-[var(--mc-divider)] bg-[var(--mc-bg-card)] p-3 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--mc-text-secondary)]">Currently active at POS</p>
            <div className="flex flex-wrap gap-1.5">
              <LiveChip label="Cash" active={status.pos.cash} />
              <LiveChip label="M-Pesa STK Push" active={status.pos.mpesa} />
              <LiveChip label="Card (PesaPal)" active={status.pos.pesapal} />
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {status.pos.mpesa ? 'M-Pesa STK push is live — the cashier sends the prompt to the customer\'s phone. ' : !status.mpesa.credentialsSet ? 'M-Pesa awaiting credentials above. ' : 'M-Pesa credentials set but not selected/enabled. '}
              {status.pos.pesapal ? 'PesaPal card checkout is live.' : !status.pesapal.credentialsSet ? 'PesaPal awaiting credentials above.' : 'PesaPal credentials set but not selected/enabled.'}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

/** Credentials status badge — set (emerald) / awaiting (amber), dimmed when disabled. */
function CredBadge({ credentialsSet, enabled }: { credentialsSet: boolean; enabled: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold whitespace-nowrap ${
        credentialsSet
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : 'bg-amber-50 text-amber-700 border-amber-200'
      } ${!enabled ? 'opacity-60' : ''}`}
    >
      {credentialsSet
        ? <><CheckCircle2 className="h-3 w-3" /> Credentials set</>
        : <><AlertCircle className="h-3 w-3" /> Awaiting credentials</>}
    </span>
  );
}

/** Masked secret input (••••1234) with an Edit pencil — empty edit keeps the stored value. */
function SecretRow({ label, state, onEdit, onDraft }: {
  label: string;
  state: SecretState;
  onEdit: (editing: boolean) => void;
  onDraft: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--mc-text-secondary)]">
        <KeyRound className="h-3.5 w-3.5 text-[var(--mc-primary)]" />{label}
      </label>
      <div className="flex gap-2">
        <McInput
          type={state.editing ? 'text' : 'password'}
          autoComplete="new-password"
          value={state.editing ? state.draft : state.masked}
          onChange={e => onDraft(e.target.value)}
          placeholder={state.editing ? 'Paste the new secret…' : state.masked ? '' : 'Not set — paste secret'}
          readOnly={!state.editing}
          className={state.editing ? 'font-mono' : 'tracking-widest'}
        />
        {state.editing ? (
          <>
            <Button
              type="button" variant="outline" size="sm" className="h-9 shrink-0 gap-1"
              onClick={() => onEdit(false)}
              title="Keep the stored secret"
            >
              <X className="h-3.5 w-3.5" /> Cancel
            </Button>
          </>
        ) : (
          <Button
            type="button" variant="outline" size="sm" className="h-9 shrink-0 gap-1"
            onClick={() => onEdit(true)}
            title="Replace the stored secret"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        {state.editing
          ? 'Leave empty and cancel to keep the current secret — new secrets save with the card.'
          : state.masked ? `Stored securely — ${state.masked}` : 'No secret stored yet.'}
      </p>
    </div>
  );
}

/** Green/gray chip showing whether a method is live at the POS. */
function LiveChip({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-bold ${
        active
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : 'bg-slate-50 text-slate-400 border-slate-200'
      }`}
    >
      {active ? <CheckCircle2 className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
      {label}
    </span>
  );
}
