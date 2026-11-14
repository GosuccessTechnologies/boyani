'use client';

/**
 * FRONT DESK — COMMUNICATION (Instruction 27)
 * Two tabs (SMS | Email) with:
 *  · provider status banner (Africa's Talking / SMTP credentials from /api/company)
 *  · compose PremiumModal — audience selector (Individual / Patients / Admitted /
 *    Walk-in pharmacy / CSV import / Appointments / Custom), live recipient preview,
 *    template picker, SMS textarea with char counter + segment estimate,
 *    email RichTextEditor
 *  · history table with status chips (SENT green, QUEUED amber, FAILED red),
 *    filters (status, audience, date range, search) and a retry action
 */

import * as React from 'react';
import {
  MessageSquareText, Mail, Send, Users, BedDouble, ShoppingBag, CalendarClock,
  FileUp, ListPlus, UserPlus, Trash2, RefreshCcw, Eye, Loader2, CheckCircle2,
  AlertTriangle, Wand2, ChevronLeft, ChevronRight, Search,
} from 'lucide-react';
import { StatCard } from '@/components/shared/StatCard';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { RichTextEditor } from '@/components/shared/RichTextEditor';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet, apiPost, apiPut, parseCsvTemplate } from '@/lib/client-api';
import { toast } from 'sonner';
import { Field, McInput, McSelect, McTextarea, PageHeading, SkeletonCards, fmtDateTime } from '@/app/ops/_lib';

// ── Types ───────────────────────────────────────────────────────────────────

interface Recipient { name: string; phone: string; email: string; }

interface HistoryMessage {
  id: string;
  channel: 'sms' | 'email';
  recipient: string;
  recipientName: string;
  subject: string;
  message: string;
  audience: string;
  status: string;
  provider: string;
  providerRef: string;
  sentByName: string;
  createdAt: string;
}

interface MessageTemplate {
  id: string;
  name: string;
  channels: string[];
  subject: string;
  body: string;
}

const AUDIENCE_OPTIONS = [
  { value: 'INDIVIDUAL', label: 'Individual — specific recipients', icon: <UserPlus className="h-3.5 w-3.5" /> },
  { value: 'PATIENTS', label: 'All Patients (with contact)', icon: <Users className="h-3.5 w-3.5" /> },
  { value: 'ADMITTED', label: 'Admitted Patients', icon: <BedDouble className="h-3.5 w-3.5" /> },
  { value: 'WALKIN', label: 'Walk-in Pharmacy Customers', icon: <ShoppingBag className="h-3.5 w-3.5" /> },
  { value: 'CSV', label: 'CSV Import', icon: <FileUp className="h-3.5 w-3.5" /> },
  { value: 'APPOINTMENTS', label: 'Patients with Appointments', icon: <CalendarClock className="h-3.5 w-3.5" /> },
  { value: 'CUSTOM', label: 'Custom List (paste)', icon: <ListPlus className="h-3.5 w-3.5" /> },
];
const SERVER_AUDIENCES = ['PATIENTS', 'ADMITTED', 'WALKIN', 'APPOINTMENTS'];

const AUDIENCE_LABEL: Record<string, string> = Object.fromEntries(AUDIENCE_OPTIONS.map(o => [o.value, o.label.split(' — ')[0].split(' (')[0]]));

/** Status chip with mandated tones: SENT green, QUEUED amber, FAILED red. */
function MessageStatusChip({ status }: { status: string }) {
  const tone =
    status === 'SENT' || status === 'DELIVERED' ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
    : status === 'QUEUED' ? 'bg-amber-100 text-amber-700 border-amber-200'
    : status === 'FAILED' ? 'bg-red-100 text-red-700 border-red-200'
    : 'bg-slate-100 text-slate-600 border-slate-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${tone}`}>
      {status}
    </span>
  );
}

/** CSV rows → recipients (flexible header matching). */
function mapCsvRows(rows: Array<Record<string, string>>): Recipient[] {
  const pick = (row: Record<string, string>, keys: string[]) => {
    for (const k of keys) {
      const found = Object.keys(row).find(h => h.toLowerCase().trim() === k);
      if (found && row[found]) return row[found].trim();
    }
    return '';
  };
  return rows
    .map(r => ({
      name: pick(r, ['name', 'full name', 'fullname', 'customer', 'client']),
      phone: pick(r, ['phone', 'mobile', 'telephone', 'tel', 'phone number', 'msisdn']),
      email: pick(r, ['email', 'e-mail', 'email address', 'mail']),
    }))
    .filter(r => !!r.phone || !!r.email);
}

/** Parse a pasted custom list — "Name:07…" / "Name,07…" / bare contact per line. */
function parseCustomList(text: string, channel: 'sms' | 'email'): Recipient[] {
  return String(text || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const idx = Math.max(line.indexOf(':'), line.indexOf(','));
      if (idx > 0) {
        const name = line.slice(0, idx).trim();
        const contact = line.slice(idx + 1).trim();
        return channel === 'email'
          ? { name, phone: '', email: contact }
          : { name, phone: contact, email: '' };
      }
      return line.includes('@')
        ? { name: '', phone: '', email: line }
        : { name: '', phone: line, email: '' };
    })
    .filter(r => !!(channel === 'email' ? r.email : r.phone));
}

export default function CommunicationPage() {
  // Tab
  const [tab, setTab] = React.useState<'sms' | 'email'>('sms');

  // Provider status
  const [company, setCompany] = React.useState<Record<string, string> | null>(null);

  // History
  const [messages, setMessages] = React.useState<HistoryMessage[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [retryingId, setRetryingId] = React.useState('');

  // Filters
  const [fStatus, setFStatus] = React.useState('ALL');
  const [fAudience, setFAudience] = React.useState('ALL');
  const [fSearch, setFSearch] = React.useState('');
  const [fDateFrom, setFDateFrom] = React.useState('');
  const [fDateTo, setFDateTo] = React.useState('');

  // Templates
  const [templates, setTemplates] = React.useState<MessageTemplate[]>([]);

  // Compose modal
  const [composeOpen, setComposeOpen] = React.useState(false);
  const [audience, setAudience] = React.useState('PATIENTS');
  const [individualRows, setIndividualRows] = React.useState<Array<Recipient>>([{ name: '', phone: '', email: '' }]);
  const [csvRecipients, setCsvRecipients] = React.useState<Recipient[]>([]);
  const [customText, setCustomText] = React.useState('');
  const [templateId, setTemplateId] = React.useState('custom');
  const [subject, setSubject] = React.useState('');
  const [smsText, setSmsText] = React.useState('');
  const [emailHtml, setEmailHtml] = React.useState('');
  const [previewCount, setPreviewCount] = React.useState<number | null>(null);
  const [previewRecipients, setPreviewRecipients] = React.useState<Recipient[]>([]);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const csvFileRef = React.useRef<HTMLInputElement>(null);

  const wantEmail = tab === 'email';

  // ── Data loading ──
  const loadHistory = React.useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ channel: tab, page: String(p), perPage: '15' });
      if (fStatus !== 'ALL') params.set('status', fStatus);
      if (fAudience !== 'ALL') params.set('audience', fAudience);
      if (fSearch.trim()) params.set('search', fSearch.trim());
      if (fDateFrom) params.set('dateFrom', fDateFrom);
      if (fDateTo) params.set('dateTo', fDateTo);
      const res = await apiGet<{ messages: HistoryMessage[]; total: number; totalPages: number }>(`/api/communication?${params.toString()}`);
      setMessages(res.messages || []);
      setTotal(res.total || 0);
      setTotalPages(res.totalPages || 1);
      setPage(p);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }, [tab, fStatus, fAudience, fSearch, fDateFrom, fDateTo]);

  React.useEffect(() => { loadHistory(1); }, [loadHistory]);

  React.useEffect(() => {
    apiGet<{ templates: MessageTemplate[] }>('/api/communication?templates=1')
      .then(r => setTemplates(r.templates || []))
      .catch(() => {});
    apiGet<{ config: Record<string, string> }>('/api/company')
      .then(r => setCompany(r.config || {}))
      .catch(() => {});
  }, []);

  // Recipient preview for server-resolved audiences
  const fetchPreview = React.useCallback((aud: string, ch: 'sms' | 'email') => {
    if (!SERVER_AUDIENCES.includes(aud)) return;
    setPreviewLoading(true);
    setPreviewCount(null);
    setPreviewRecipients([]);
    apiGet<{ count: number; recipients: Recipient[] }>(`/api/communication?preview=1&audience=${aud}&channel=${ch}`)
      .then(r => { setPreviewCount(r.count); setPreviewRecipients((r.recipients || []).slice(0, 50)); })
      .catch(() => setPreviewCount(0))
      .finally(() => setPreviewLoading(false));
  }, []);

  React.useEffect(() => {
    if (composeOpen) fetchPreview(audience, tab);
  }, [composeOpen, audience, tab, fetchPreview]);

  // ── Derived values ──
  const explicitRecipients: Recipient[] = React.useMemo(() => {
    if (audience === 'INDIVIDUAL') {
      return individualRows.filter(r => (wantEmail ? !!r.email.trim() : !!r.phone.trim()));
    }
    if (audience === 'CSV') return csvRecipients.filter(r => (wantEmail ? !!r.email : !!r.phone));
    if (audience === 'CUSTOM') return parseCustomList(customText, tab);
    return [];
  }, [audience, individualRows, csvRecipients, customText, wantEmail, tab]);

  const recipientCount = SERVER_AUDIENCES.includes(audience)
    ? (previewCount ?? 0)
    : explicitRecipients.length;

  const smsChars = smsText.length;
  const smsSegments = smsChars === 0 ? 0 : Math.ceil(smsChars / 160);

  // Provider status
  const smsProviderName = (company?.sms_provider || 'africastalking') === 'africastalking' ? "Africa's Talking" : (company?.sms_provider || 'SMS provider');
  const smsConfigured = !!(company && company.sms_api_key && company.sms_username);
  const smtpConfigured = !!(company && company.smtp_host);

  // ── Actions ──
  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const t = templates.find(x => x.id === id);
    if (!t || id === 'custom') return;
    setSubject(t.subject || '');
    if (wantEmail) {
      setEmailHtml(t.body ? `<p>${t.body}</p>` : '<p></p>');
    } else {
      setSmsText(t.body || '');
    }
  };

  const openCompose = () => {
    setAudience('PATIENTS');
    setIndividualRows([{ name: '', phone: '', email: '' }]);
    setCsvRecipients([]);
    setCustomText('');
    setTemplateId('custom');
    setSubject('');
    setSmsText('');
    setEmailHtml('<p></p>');
    setPreviewCount(null);
    setPreviewRecipients([]);
    setComposeOpen(true);
  };

  const submitCompose = async () => {
    const message = wantEmail ? emailHtml : smsText;
    if (!message || message === '<p></p>') {
      toast.error('Write a message first');
      return;
    }
    if (wantEmail && !subject.trim()) {
      toast.error('Email subject is required');
      return;
    }
    if (recipientCount === 0) {
      toast.error('No recipients resolved for this audience');
      return;
    }
    setSending(true);
    try {
      const payload: Record<string, unknown> = {
        channel: tab, audience, message, templateId: templateId === 'custom' ? '' : templateId,
      };
      if (wantEmail) payload.subject = subject.trim();
      if (!SERVER_AUDIENCES.includes(audience)) payload.recipients = explicitRecipients;
      const res = await apiPost<{ message: string }>('/api/communication', payload);
      toast.success(res.message || 'Message(s) queued');
      setComposeOpen(false);
      loadHistory(1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const retryMessage = async (m: HistoryMessage) => {
    setRetryingId(m.id);
    try {
      const res = await apiPut<{ message: string }>('/api/communication', { id: m.id, status: 'RETRY', channel: m.channel });
      toast.success(res.message || 'Retry attempted');
      loadHistory(page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Retry failed');
    } finally {
      setRetryingId('');
    }
  };

  const onCsvFile = async (file: File) => {
    try {
      const rows = await parseCsvTemplate(file);
      const mapped = mapCsvRows(rows);
      if (mapped.length === 0) {
        toast.error('No usable rows — CSV needs name/phone/email columns');
        return;
      }
      setCsvRecipients(mapped);
      toast.success(`${mapped.length} recipient(s) imported from CSV`);
    } catch {
      toast.error('Failed to parse CSV file');
    }
  };

  // ── UI ──
  return (
    <div className="space-y-4">
      <PageHeading
        icon={<MessageSquareText className="h-5 w-5" />}
        title="Communication"
        subtitle="SMS broadcasts via Africa's Talking · email via SMTP — audiences, templates and delivery history"
        actions={
          <Button size="sm" className="gap-1.5" onClick={openCompose}>
            <Send className="h-4 w-4" /> Compose {wantEmail ? 'Email' : 'SMS'}
          </Button>
        }
      />

      {/* Provider status banner */}
      <div className={`rounded-xl border p-3.5 flex items-start gap-3 ${wantEmail
        ? (smtpConfigured ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200')
        : (smsConfigured ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200')}`}>
        {wantEmail
          ? (smtpConfigured
              ? <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              : <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />)
          : (smsConfigured
              ? <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              : <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />)}
        <div className="min-w-0 text-sm">
          {wantEmail ? (
            smtpConfigured ? (
              <p className="text-emerald-800">
                <span className="font-semibold">SMTP: configured</span> — outgoing mail will be attempted through <span className="font-mono text-xs">{company?.smtp_host}:{company?.smtp_port || '587'}</span>.
              </p>
            ) : (
              <p className="text-amber-800">
                <span className="font-semibold">SMTP: awaiting credentials</span> (configure in Facility Management → Payment Integrations/Settings). Emails will be queued until then.
              </p>
            )
          ) : (
            smsConfigured ? (
              <p className="text-emerald-800">
                <span className="font-semibold">{smsProviderName}: configured</span>
                {' '}— sender <span className="font-mono text-xs">{company?.sms_sender_id || '(default)'}</span>
                {company?.sms_environment ? ` · ${company.sms_environment} environment` : ''}. SMS delivery will be attempted on send.
              </p>
            ) : (
              <p className="text-amber-800">
                <span className="font-semibold">{smsProviderName}: awaiting credentials</span> (configure in Facility Management → Payment Integrations/Settings). Messages will be queued until then.
              </p>
            )
          )}
        </div>
      </div>

      {/* Channel tabs */}
      <div className="flex items-center gap-2">
        {(['sms', 'email'] as const).map(ch => {
          const active = tab === ch;
          return (
            <button
              key={ch}
              onClick={() => setTab(ch)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                active
                  ? 'bg-[var(--mc-primary)] text-white border-transparent shadow-md'
                  : 'bg-white text-[var(--mc-text-secondary)] border-[var(--mc-divider)] hover:bg-[var(--mc-primary-light)]'
              }`}
            >
              {ch === 'sms' ? <MessageSquareText className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
              {ch === 'sms' ? 'SMS' : 'Email'}
            </button>
          );
        })}
        <span className="text-xs text-muted-foreground ml-1">{total} message(s) in history</span>
      </div>

      {/* Filters */}
      <div className="rounded-xl border bg-white p-3 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
        <Field icon={<Search className="h-3.5 w-3.5" />} label="Search">
          <McInput placeholder="Phone, name, message…" value={fSearch} onChange={e => setFSearch(e.target.value)} />
        </Field>
        <Field icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Status">
          <McSelect value={fStatus} onValueChange={setFStatus} options={[
            { value: 'ALL', label: 'All statuses' },
            { value: 'SENT', label: 'Sent' },
            { value: 'QUEUED', label: 'Queued' },
            { value: 'FAILED', label: 'Failed' },
          ]} />
        </Field>
        <Field icon={<Users className="h-3.5 w-3.5" />} label="Audience">
          <McSelect value={fAudience} onValueChange={setFAudience} options={[
            { value: 'ALL', label: 'All audiences' },
            ...AUDIENCE_OPTIONS.map(o => ({ value: o.value, label: AUDIENCE_LABEL[o.value] })),
          ]} />
        </Field>
        <Field icon={<CalendarClock className="h-3.5 w-3.5" />} label="From date">
          <McInput type="date" value={fDateFrom} onChange={e => setFDateFrom(e.target.value)} />
        </Field>
        <Field icon={<CalendarClock className="h-3.5 w-3.5" />} label="To date">
          <McInput type="date" value={fDateTo} onChange={e => setFDateTo(e.target.value)} />
        </Field>
        <div className="flex items-end gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 h-9" onClick={() => { setFSearch(''); setFStatus('ALL'); setFAudience('ALL'); setFDateFrom(''); setFDateTo(''); }}>
            <RefreshCcw className="h-3.5 w-3.5" /> Reset
          </Button>
        </div>
      </div>

      {/* History table */}
      <div className="rounded-xl border bg-white overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
        ) : messages.length === 0 ? (
          <div className="text-center py-14 px-4">
            <Send className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-semibold text-[var(--mc-text-primary)]">No {wantEmail ? 'emails' : 'SMS'} found</p>
            <p className="text-xs text-muted-foreground mt-1">Compose a {wantEmail ? 'broadcast email' : 'text message'} to get started, or adjust the filters above.</p>
            <Button size="sm" className="mt-4 gap-1.5" onClick={openCompose}><Send className="h-3.5 w-3.5" /> Compose {wantEmail ? 'Email' : 'SMS'}</Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="mc-table">
              <thead>
                <tr>
                  <th style={{ width: 44 }}>#</th>
                  <th>{wantEmail ? 'To' : 'Phone'}</th>
                  <th>Recipient</th>
                  {wantEmail && <th>Subject</th>}
                  <th>Message</th>
                  <th>Audience</th>
                  <th>Status</th>
                  <th>Sent by</th>
                  <th>Date</th>
                  <th style={{ width: 90 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((m, i) => (
                  <tr key={m.id}>
                    <td className="text-muted-foreground">{(page - 1) * 15 + i + 1}</td>
                    <td className="text-sm font-semibold text-[var(--mc-text-primary)] whitespace-nowrap">{m.recipient}</td>
                    <td className="text-sm">{m.recipientName || '—'}</td>
                    {wantEmail && <td className="text-sm max-w-[180px] truncate">{m.subject || '—'}</td>}
                    <td className="text-xs max-w-[220px]">
                      <span className="line-clamp-2 text-muted-foreground">
                        {m.message.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)}
                      </span>
                    </td>
                    <td><span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--mc-primary-light)] text-[var(--mc-primary-dark)] font-semibold whitespace-nowrap">{AUDIENCE_LABEL[m.audience] || m.audience}</span></td>
                    <td>
                      <MessageStatusChip status={m.status} />
                      {m.providerRef && m.status !== 'SENT' && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 max-w-[140px] truncate" title={m.providerRef}>{m.providerRef}</p>
                      )}
                    </td>
                    <td className="text-xs whitespace-nowrap">{m.sentByName || '—'}</td>
                    <td className="text-xs whitespace-nowrap">{fmtDateTime(m.createdAt)}</td>
                    <td>
                      {(m.status === 'FAILED' || m.status === 'QUEUED') ? (
                        <Button
                          size="sm" variant="outline" className="h-7 gap-1 text-xs"
                          disabled={retryingId === m.id}
                          onClick={() => retryMessage(m)}
                        >
                          {retryingId === m.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCcw className="h-3 w-3" />} Retry
                        </Button>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--mc-divider)]">
            <span className="text-xs text-muted-foreground">Page {page} of {totalPages} · {total} message(s)</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-8 gap-1" disabled={page <= 1} onClick={() => loadHistory(page - 1)}>
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </Button>
              <Button size="sm" variant="outline" className="h-8 gap-1" disabled={page >= totalPages} onClick={() => loadHistory(page + 1)}>
                Next <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Compose modal ── */}
      <PremiumModal
        open={composeOpen}
        onOpenChange={setComposeOpen}
        size="xl"
        title={`Compose ${wantEmail ? 'Email' : 'SMS'}`}
        icon={<Send className="h-5 w-5 text-white" />}
        description={`Broadcast to an audience — placeholders {'{patientName}'}, {'{facilityName}'}, {'{date}'} are personalised per recipient at send time.`}
        footerNote={`${recipientCount} recipient(s) · ${wantEmail ? 'SMTP' : "Africa's Talking"}`}
        submitLabel={`Send to ${recipientCount} recipient${recipientCount === 1 ? '' : 's'}`}
        submitIcon={<Send className="h-3.5 w-3.5" />}
        onSubmit={submitCompose}
        submitting={sending}
        submitDisabled={recipientCount === 0}
      >
        <div className="space-y-5">
          {/* Audience */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-[var(--mc-primary)] text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
              <h3 className="text-sm font-bold text-[var(--mc-text-primary)]">Audience & Recipients</h3>
              <div className="flex-1 h-px bg-[var(--mc-divider)]" />
            </div>
            <Field icon={<Users className="h-3.5 w-3.5" />} label="Send to">
              <McSelect value={audience} onValueChange={setAudience} options={AUDIENCE_OPTIONS.map(o => ({ value: o.value, label: o.label }))} />
            </Field>

            {/* Server-resolved audience → live preview */}
            {SERVER_AUDIENCES.includes(audience) && (
              <div className="rounded-xl border border-[var(--mc-divider)] bg-[var(--mc-bg-card)] p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-[var(--mc-primary)]" />
                  {previewLoading ? (
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> Resolving recipients…</span>
                  ) : (
                    <span className="text-xs font-semibold text-[var(--mc-text-primary)]">
                      {previewCount ?? 0} recipient(s) {wantEmail ? 'with email' : 'with phone'}
                    </span>
                  )}
                  <Button size="sm" variant="ghost" className="h-6 ml-auto gap-1 text-[11px]" onClick={() => fetchPreview(audience, tab)}>
                    <RefreshCcw className="h-3 w-3" /> Refresh
                  </Button>
                </div>
                {!previewLoading && previewCount === 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    {audience === 'WALKIN' && wantEmail
                      ? 'Walk-in pharmacy sales only capture phone numbers — switch to SMS for this audience.'
                      : 'No contacts resolved for this audience yet.'}
                  </p>
                )}
                {previewRecipients.length > 0 && (
                  <div className="max-h-28 overflow-y-auto rounded-lg border border-[var(--mc-divider)] divide-y divide-[var(--mc-divider)] bg-white">
                    {previewRecipients.map((r, i) => (
                      <div key={`${r.phone}-${r.email}-${i}`} className="flex items-center gap-2 px-2.5 py-1.5 text-xs">
                        <span className="font-medium text-[var(--mc-text-primary)] truncate flex-1">{r.name || '—'}</span>
                        <span className="text-muted-foreground">{wantEmail ? r.email : r.phone}</span>
                      </div>
                    ))}
                    {(previewCount ?? 0) > previewRecipients.length && (
                      <p className="px-2.5 py-1.5 text-[10px] text-muted-foreground">… and {(previewCount ?? 0) - previewRecipients.length} more</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Individual rows */}
            {audience === 'INDIVIDUAL' && (
              <div className="space-y-2">
                {individualRows.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <McInput
                      className="flex-1" placeholder="Name"
                      value={row.name}
                      onChange={e => setIndividualRows(rows => rows.map((r, i) => i === idx ? { ...r, name: e.target.value } : r))}
                    />
                    <McInput
                      className="flex-1" placeholder={wantEmail ? 'email@example.com' : '07XX XXX XXX'}
                      value={wantEmail ? row.email : row.phone}
                      onChange={e => setIndividualRows(rows => rows.map((r, i) => i === idx
                        ? (wantEmail ? { ...r, email: e.target.value } : { ...r, phone: e.target.value })
                        : r))}
                    />
                    <Button
                      size="sm" variant="outline" className="h-9 px-2.5 shrink-0"
                      disabled={individualRows.length <= 1}
                      onClick={() => setIndividualRows(rows => rows.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-600" />
                    </Button>
                  </div>
                ))}
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setIndividualRows(rows => [...rows, { name: '', phone: '', email: '' }])}>
                  <UserPlus className="h-3.5 w-3.5" /> Add recipient
                </Button>
              </div>
            )}

            {/* CSV import */}
            {audience === 'CSV' && (
              <div className="rounded-xl border border-dashed border-[var(--mc-divider)] p-3 space-y-2 bg-[var(--mc-bg-card)]">
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => csvFileRef.current?.click()}>
                    <FileUp className="h-3.5 w-3.5" /> Import CSV (name, {wantEmail ? 'email' : 'phone'}…)
                  </Button>
                  {csvRecipients.length > 0 && (
                    <Button type="button" variant="outline" size="sm" className="h-8 gap-1 text-xs text-red-700" onClick={() => setCsvRecipients([])}>
                      <Trash2 className="h-3.5 w-3.5" /> Clear {csvRecipients.length}
                    </Button>
                  )}
                  <input
                    ref={csvFileRef} type="file" accept=".csv,text/csv" className="hidden"
                    onChange={async e => {
                      const f = e.target.files?.[0];
                      if (f) await onCsvFile(f);
                      e.target.value = '';
                    }}
                  />
                </div>
                {csvRecipients.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">
                    Upload a CSV with a <span className="font-semibold">{wantEmail ? 'email' : 'phone'}</span> column (a <span className="font-semibold">name</span> column is used for personalisation; headers are matched case-insensitively).
                  </p>
                ) : (
                  <div className="max-h-28 overflow-y-auto rounded-lg border border-[var(--mc-divider)] divide-y divide-[var(--mc-divider)] bg-white">
                    {csvRecipients.slice(0, 50).map((r, i) => (
                      <div key={`${r.phone}-${r.email}-${i}`} className="flex items-center gap-2 px-2.5 py-1.5 text-xs">
                        <span className="font-medium text-[var(--mc-text-primary)] truncate flex-1">{r.name || '—'}</span>
                        <span className="text-muted-foreground">{wantEmail ? r.email : r.phone}</span>
                      </div>
                    ))}
                    {csvRecipients.length > 50 && <p className="px-2.5 py-1.5 text-[10px] text-muted-foreground">… and {csvRecipients.length - 50} more</p>}
                  </div>
                )}
              </div>
            )}

            {/* Custom paste */}
            {audience === 'CUSTOM' && (
              <Field
                icon={<ListPlus className="h-3.5 w-3.5" />}
                label={`Paste ${wantEmail ? 'emails' : 'phone numbers'}`}
                hint="One per line — optional name prefix, e.g. Jane Doe:0722000111"
              >
                <McTextarea
                  rows={5}
                  className="font-mono text-xs"
                  placeholder={wantEmail ? 'jane@mail.com\nJohn Doe:john@mail.com' : '0722000111\nJohn Doe:0733000222'}
                  value={customText}
                  onChange={e => setCustomText(e.target.value)}
                />
              </Field>
            )}
          </section>

          {/* Template */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-[var(--mc-primary)] text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
              <h3 className="text-sm font-bold text-[var(--mc-text-primary)]">Template</h3>
              <div className="flex-1 h-px bg-[var(--mc-divider)]" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field icon={<Wand2 className="h-3.5 w-3.5" />} label="Start from a template" hint="Fills the subject & editor below">
                <McSelect
                  value={templateId}
                  onValueChange={applyTemplate}
                  options={[
                    { value: 'custom', label: 'Custom (blank)' },
                    ...templates.filter(t => t.channels.includes(tab)).map(t => ({ value: t.id, label: t.name })),
                  ]}
                />
              </Field>
              <div className="rounded-xl border border-[var(--mc-divider)] bg-[var(--mc-bg-card)] p-2.5 text-[11px] text-muted-foreground flex items-center">
                <Wand2 className="h-3.5 w-3.5 mr-2 text-[var(--mc-primary)] shrink-0" />
                Placeholders <code className="mx-1 px-1 py-0.5 rounded bg-white border">{'{patientName}'}</code>
                <code className="mx-1 px-1 py-0.5 rounded bg-white border">{'{facilityName}'}</code>
                <code className="px-1 py-0.5 rounded bg-white border">{'{date}'}</code> are replaced per recipient.
              </div>
            </div>
          </section>

          {/* Message */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-[var(--mc-primary)] text-white text-xs font-bold flex items-center justify-center shrink-0">3</span>
              <h3 className="text-sm font-bold text-[var(--mc-text-primary)]">Message</h3>
              <div className="flex-1 h-px bg-[var(--mc-divider)]" />
            </div>

            {wantEmail ? (
              <>
                <Field icon={<Mail className="h-3.5 w-3.5" />} label="Subject">
                  <McInput placeholder="e.g. Appointment reminder" value={subject} onChange={e => setSubject(e.target.value)} />
                </Field>
                <Field icon={<Mail className="h-3.5 w-3.5" />} label="Body (rich text)">
                  <RichTextEditor value={emailHtml} onChange={setEmailHtml} placeholder="Write your email…" minHeight={200} />
                </Field>
              </>
            ) : (
              <Field
                icon={<MessageSquareText className="h-3.5 w-3.5" />}
                label="Message text"
                hint={`1 segment ≈ 160 characters (GSM-7)`}
              >
                <div className="space-y-1.5">
                  <McTextarea rows={5} placeholder="Type your SMS…" value={smsText} onChange={e => setSmsText(e.target.value)} />
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className={`font-semibold ${smsChars > 0 && smsSegments > 3 ? 'text-red-600' : 'text-muted-foreground'}`}>
                      {smsChars} character{smsChars === 1 ? '' : 's'} · {smsSegments} segment{smsSegments === 1 ? '' : 's'}
                    </span>
                    <span className="text-muted-foreground">(billed per segment by the provider)</span>
                  </div>
                </div>
              </Field>
            )}
          </section>
        </div>
      </PremiumModal>
    </div>
  );
}
