'use client';

/**
 * FRONT DESK DASHBOARD — /api/communication?stats=1
 * Stat cards (SMS sent/queued, emails, parcels pending, calls today) +
 * recent activity lists (SMS, emails, parcels, calls).
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  MessageSquareText, Mail, Package, PhoneCall, Send, Clock, ArrowRight, Inbox, PhoneOutgoing, PhoneIncoming, PhoneMissed,
} from 'lucide-react';
import { StatCard } from '@/components/shared/StatCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { apiGet } from '@/lib/client-api';
import { toast } from 'sonner';
import { fmtDateTime, PageHeading, SkeletonCards, StatusBadge } from '@/app/clinical/_lib';

interface Stats {
  smsSent: number;
  smsQueued: number;
  smsFailed: number;
  emailSent: number;
  emailQueued: number;
  emailFailed: number;
  callsToday: number;
  parcelsPending: number;
}

interface RecentSms {
  id: string; recipient: string; recipientName: string; status: string; audience: string; createdAt: string; sentByName: string;
}
interface RecentEmail extends RecentSms { subject: string; }
interface RecentParcel {
  id: string; trackingCode: string; type: string; description: string; senderName: string; receiverName: string;
  courier: string; status: string; createdAt: string; handledByName: string;
}
interface RecentCall {
  id: string; direction: string; callerName: string; callerPhone: string; category: string;
  durationSec: number; callTime: string; handledByName: string;
}

interface StatsResponse {
  stats: Stats;
  recentSms: RecentSms[];
  recentEmails: RecentEmail[];
  recentParcels: RecentParcel[];
  recentCalls: RecentCall[];
}

const CallDirectionIcon = ({ direction }: { direction: string }) =>
  direction === 'IN' ? <PhoneIncoming className="h-4 w-4 text-emerald-600" />
  : direction === 'OUT' ? <PhoneOutgoing className="h-4 w-4 text-sky-600" />
  : <PhoneMissed className="h-4 w-4 text-red-600" />;

export default function FrontDeskDashboardPage() {
  const router = useRouter();
  const [data, setData] = React.useState<StatsResponse | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiGet<StatsResponse>('/api/communication?stats=1');
        if (!cancelled) setData(res);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to load front desk dashboard');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const s = data?.stats;

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<PhoneCall className="h-5 w-5" />}
        title="Front Desk Dashboard"
        subtitle="Communication hub — messages, parcels and calls at a glance"
        actions={
          <>
            <Button size="sm" className="gap-1.5" onClick={() => router.push('/frontdesk/communication')}>
              <MessageSquareText className="h-4 w-4" /> Send Message
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => router.push('/frontdesk/calls')}>
              <PhoneCall className="h-4 w-4" /> Log Call
            </Button>
          </>
        }
      />

      {loading ? <SkeletonCards count={5} /> : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          <StatCard label="SMS Sent" value={s?.smsSent ?? 0} icon={<Send className="h-5 w-5" />} accent="success" hint="delivered to provider" onClick={() => router.push('/frontdesk/communication')} />
          <StatCard label="SMS Queued" value={s?.smsQueued ?? 0} icon={<Clock className="h-5 w-5" />} accent="warning" hint={`+${s?.smsFailed ?? 0} failed`} onClick={() => router.push('/frontdesk/communication')} />
          <StatCard label="Emails Sent" value={s?.emailSent ?? 0} icon={<Mail className="h-5 w-5" />} accent="info" hint={`+${s?.emailQueued ?? 0} queued`} onClick={() => router.push('/frontdesk/communication')} />
          <StatCard label="Parcels Pending" value={s?.parcelsPending ?? 0} icon={<Package className="h-5 w-5" />} accent="secondary" hint="awaiting delivery/collection" onClick={() => router.push('/frontdesk/parcels')} />
          <StatCard label="Calls Today" value={s?.callsToday ?? 0} icon={<PhoneCall className="h-5 w-5" />} accent="danger" hint="logged at the desk" onClick={() => router.push('/frontdesk/calls')} />
        </div>
      )}

      {/* Recent activity — 2×2 grid of mini-lists */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Recent SMS */}
        <div className="rounded-xl border bg-white overflow-hidden">
          <div className="flex items-center gap-3 p-4 border-b border-[var(--mc-divider)]">
            <div className="h-9 w-9 rounded-lg mc-gradient-primary flex items-center justify-center text-white shrink-0">
              <MessageSquareText className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-[var(--mc-text-primary)]">Recent SMS</h2>
              <p className="text-[11px] text-muted-foreground">Latest text messages</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => router.push('/frontdesk/communication')}>View all</Button>
          </div>
          {loading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>
          ) : (data?.recentSms.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No SMS sent yet — compose your first broadcast.</p>
          ) : (
            <ul className="divide-y divide-[var(--mc-divider)]">
              {data?.recentSms.map(m => (
                <li key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                  <StatusBadge status={m.status} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--mc-text-primary)] truncate">{m.recipientName || m.recipient}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{m.recipient} · by {m.sentByName || '—'}</p>
                  </div>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">{fmtDateTime(m.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent emails */}
        <div className="rounded-xl border bg-white overflow-hidden">
          <div className="flex items-center gap-3 p-4 border-b border-[var(--mc-divider)]">
            <div className="h-9 w-9 rounded-lg mc-gradient-primary flex items-center justify-center text-white shrink-0">
              <Mail className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-[var(--mc-text-primary)]">Recent Emails</h2>
              <p className="text-[11px] text-muted-foreground">Latest email correspondence</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => router.push('/frontdesk/communication')}>View all</Button>
          </div>
          {loading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>
          ) : (data?.recentEmails.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No emails sent yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--mc-divider)]">
              {data?.recentEmails.map(m => (
                <li key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                  <StatusBadge status={m.status} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--mc-text-primary)] truncate">{m.subject || '(no subject)'}</p>
                    <p className="text-[11px] text-muted-foreground truncate">→ {m.recipient} · by {m.sentByName || '—'}</p>
                  </div>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">{fmtDateTime(m.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent parcels */}
        <div className="rounded-xl border bg-white overflow-hidden">
          <div className="flex items-center gap-3 p-4 border-b border-[var(--mc-divider)]">
            <div className="h-9 w-9 rounded-lg mc-gradient-primary flex items-center justify-center text-white shrink-0">
              <Package className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-[var(--mc-text-primary)]">Recent Parcels</h2>
              <p className="text-[11px] text-muted-foreground">Received & dispatched at the desk</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => router.push('/frontdesk/parcels')}>View all</Button>
          </div>
          {loading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>
          ) : (data?.recentParcels.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No parcels logged yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--mc-divider)]">
              {data?.recentParcels.map(p => (
                <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${p.type === 'RECEIVED' ? 'bg-sky-100 text-sky-700' : 'bg-violet-100 text-violet-700'}`}>
                    <Inbox className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--mc-text-primary)] truncate">
                      <span className="font-mono text-xs">{p.trackingCode}</span>
                      {' '}{p.description || (p.type === 'RECEIVED' ? `from ${p.senderName || '—'}` : `to ${p.receiverName || '—'}`)}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">{p.courier ? `${p.courier} · ` : ''}{p.type === 'RECEIVED' ? 'received' : 'dispatched'} by {p.handledByName || '—'}</p>
                  </div>
                  <StatusBadge status={p.status} />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent calls */}
        <div className="rounded-xl border bg-white overflow-hidden">
          <div className="flex items-center gap-3 p-4 border-b border-[var(--mc-divider)]">
            <div className="h-9 w-9 rounded-lg mc-gradient-primary flex items-center justify-center text-white shrink-0">
              <PhoneCall className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-[var(--mc-text-primary)]">Recent Calls</h2>
              <p className="text-[11px] text-muted-foreground">Latest logged calls</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => router.push('/frontdesk/calls')}>View all</Button>
          </div>
          {loading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>
          ) : (data?.recentCalls.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No calls logged yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--mc-divider)]">
              {data?.recentCalls.map(c => (
                <li key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                  <CallDirectionIcon direction={c.direction} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--mc-text-primary)] truncate">{c.callerName || c.callerPhone || 'Unknown caller'}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{c.callerPhone || '—'} · handled by {c.handledByName || '—'}</p>
                  </div>
                  <StatusBadge status={c.category} />
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">{fmtDateTime(c.callTime)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { label: 'Compose SMS / Email broadcast', href: '/frontdesk/communication', icon: <MessageSquareText className="h-4 w-4" /> },
          { label: 'Receive or dispatch a parcel', href: '/frontdesk/parcels', icon: <Package className="h-4 w-4" /> },
          { label: 'Log a call', href: '/frontdesk/calls', icon: <PhoneCall className="h-4 w-4" /> },
        ].map(q => (
          <button
            key={q.href + q.label}
            onClick={() => router.push(q.href)}
            className="rounded-xl border bg-white p-4 flex items-center gap-3 text-left hover:shadow-md hover:-translate-y-0.5 transition-all"
          >
            <div className="h-9 w-9 rounded-lg mc-gradient-primary flex items-center justify-center text-white shrink-0">{q.icon}</div>
            <span className="text-sm font-semibold text-[var(--mc-text-primary)] flex-1">{q.label}</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  );
}
