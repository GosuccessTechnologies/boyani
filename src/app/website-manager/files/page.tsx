'use client';

/**
 * FILE MANAGER v2 (Instruction 12) — premium GRID layout:
 * each file is a responsive card with a footer hero section containing
 * Preview · Copy URL · Download · Edit Metadata · Delete actions.
 * Bottom pagination, mobile-friendly grid (2→3→4→5 cols).
 */

import * as React from 'react';
import {
  FolderOpen, FileText, Copy, Trash2, CalendarDays, Layers,
  Check, Loader2, Search, Folder, Eye, Download, Pencil, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { StatCard } from '@/components/shared/StatCard';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet, apiPut, apiDelete } from '@/lib/client-api';
import { toast } from 'sonner';
import { fmtDate, fileSize, Field, FormSection, ConfirmModal, PageHeading, McInput } from '@/app/ops/_lib';

interface FileRecord {
  id: string; fileName: string; originalName: string; url: string;
  mimeType: string; size: number; module: string; uploadedById: string;
  folder: string; createdAt: string;
}
interface FilesResp {
  files: FileRecord[]; total: number; page: number; perPage: number; totalPages: number;
  moduleGroups: Array<{ name: string; count: number }>;
  dateGroups: string[];
}

export default function FilesPage() {
  const [files, setFiles] = React.useState<FileRecord[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);

  const [moduleGroups, setModuleGroups] = React.useState<Array<{ name: string; count: number }>>([]);
  const [dateGroups, setDateGroups] = React.useState<string[]>([]);

  const [activeModule, setActiveModule] = React.useState('');
  const [activeDate, setActiveDate] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [appliedSearch, setAppliedSearch] = React.useState('');

  const [copiedId, setCopiedId] = React.useState('');

  const [previewing, setPreviewing] = React.useState<FileRecord | null>(null);
  const [editing, setEditing] = React.useState<FileRecord | null>(null);
  const [editDraft, setEditDraft] = React.useState({ originalName: '', module: '', folder: '' });
  const [editBusy, setEditBusy] = React.useState(false);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<FileRecord | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);

  const load = React.useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(p), perPage: '20' });
      if (activeModule) q.set('module', activeModule);
      if (activeDate) q.set('date', activeDate);
      if (appliedSearch) q.set('search', appliedSearch);
      const res = await apiGet<FilesResp>(`/api/files?${q.toString()}`);
      setFiles(res.files || []);
      setTotal(res.total || 0);
      setPage(res.page || 1);
      setTotalPages(res.totalPages || 1);
      setModuleGroups(res.moduleGroups || []);
      setDateGroups(res.dateGroups || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load files');
    } finally {
      setLoading(false);
    }
  }, [activeModule, activeDate, appliedSearch]);

  React.useEffect(() => { load(1); }, [load]);

  const copyUrl = async (f: FileRecord) => {
    try {
      await navigator.clipboard.writeText(f.url.startsWith('http') ? f.url : `${window.location.origin}${f.url}`);
      setCopiedId(f.id);
      toast.success('File URL copied to clipboard');
      setTimeout(() => setCopiedId(''), 2000);
    } catch {
      toast.error('Clipboard unavailable — open preview to copy manually');
    }
  };

  const downloadFile = (f: FileRecord) => {
    const a = document.createElement('a');
    a.href = f.url;
    a.download = f.originalName || f.fileName;
    a.target = '_blank';
    a.rel = 'noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const openEdit = (f: FileRecord) => {
    setEditing(f);
    setEditDraft({ originalName: f.originalName, module: f.module, folder: f.folder });
  };

  const saveEdit = async () => {
    if (!editing) return;
    setEditBusy(true);
    try {
      const res = await apiPut<{ message: string }>('/api/files', { id: editing.id, ...editDraft });
      toast.success(res.message || 'Metadata updated');
      setEditing(null);
      load(page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setEditBusy(false);
    }
  };

  const doDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      const res = await apiDelete<{ message: string }>(`/api/files?id=${deleting.id}`);
      toast.success(res.message || 'File record removed');
      setConfirmOpen(false);
      setDeleting(null);
      load(page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeleteBusy(false);
    }
  };

  const isImage = (f: FileRecord) => /^image\//.test(f.mimeType || '') || /\.(png|jpe?g|webp|gif|svg)$/i.test(f.url);

  const totalSize = files.reduce((s, f) => s + (f.size || 0), 0);

  // Compact page number strip for bottom pagination
  const pageNumbers = React.useMemo(() => {
    const list: number[] = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, start + 4);
    for (let i = start; i <= end; i++) list.push(i);
    return list;
  }, [page, totalPages]);

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<FolderOpen className="h-5 w-5" />}
        title="File Manager"
        subtitle="Every upload from every module — premium card grid with previews, downloads and metadata"
      />

      {loading && files.length === 0 ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}</div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Files" value={total} icon={<FolderOpen className="h-5 w-5" />} accent="primary" />
          <StatCard label="Modules" value={moduleGroups.length} icon={<Layers className="h-5 w-5" />} accent="secondary" />
          <StatCard label="This Page" value={fileSize(totalSize)} icon={<FileText className="h-5 w-5" />} accent="tertiary" hint={`${files.length} file(s)`} />
          <StatCard label="Dates" value={dateGroups.length} icon={<CalendarDays className="h-5 w-5" />} accent="success" hint="upload days" />
        </div>
      )}

      {/* Filters */}
      <div className="rounded-xl border bg-white p-4 space-y-3 no-print">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mr-1"><Folder className="h-3.5 w-3.5" /> Module:</span>
          <button
            onClick={() => setActiveModule('')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${!activeModule ? 'bg-[var(--mc-primary)] text-white border-transparent' : 'bg-white text-[var(--mc-text-secondary)] border-[var(--mc-divider)] hover:bg-[var(--mc-primary-light)]'}`}
          >
            All ({moduleGroups.reduce((s, g) => s + g.count, 0)})
          </button>
          {moduleGroups.map(g => (
            <button
              key={g.name}
              onClick={() => setActiveModule(g.name)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors whitespace-nowrap ${activeModule === g.name ? 'bg-[var(--mc-primary)] text-white border-transparent' : 'bg-white text-[var(--mc-text-secondary)] border-[var(--mc-divider)] hover:bg-[var(--mc-primary-light)]'}`}
            >
              {g.name} ({g.count})
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <Field icon={<CalendarDays className="h-3.5 w-3.5" />} label="Upload Date">
            <select
              className="mc-input h-9 w-48 rounded-lg text-sm"
              value={activeDate}
              onChange={e => setActiveDate(e.target.value)}
            >
              <option value="">— all dates —</option>
              {dateGroups.map(d => <option key={d} value={d}>{fmtDate(d)}</option>)}
            </select>
          </Field>
          <Field icon={<Search className="h-3.5 w-3.5" />} label="Search">
            <div className="flex items-center gap-2">
              <McInput value={search} onChange={e => setSearch(e.target.value)} placeholder="File name…" />
              <Button size="sm" className="h-9" onClick={() => setAppliedSearch(search.trim())}>Find</Button>
            </div>
          </Field>
        </div>
      </div>

      {/* Premium file cards grid — responsive: 1 col mobile → 5 cols 2xl */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
        </div>
      ) : files.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-[var(--mc-divider)] rounded-2xl">
          <FolderOpen className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-semibold">No files match the current filters</p>
          <p className="text-sm text-muted-foreground mt-1">Uploads from every module automatically appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {files.map(f => (
            <div key={f.id} className="group rounded-2xl border border-[var(--mc-divider)] bg-white overflow-hidden flex flex-col shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all">
              {/* Preview area */}
              <button
                type="button"
                className="relative h-36 w-full bg-slate-100 block overflow-hidden"
                onClick={() => setPreviewing(f)}
                title="Click to preview"
              >
                {isImage(f) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.url} alt={f.originalName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-1.5">
                    <FileText className="h-9 w-9" />
                    <span className="text-[10px] font-bold uppercase">{(f.mimeType || f.url.split('.').pop() || 'file').split('/')[1] || 'file'}</span>
                  </div>
                )}
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur text-white text-[10px] font-bold">{f.module}</span>
                <span className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity h-9 w-9 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                    <Eye className="h-4 w-4 text-[var(--mc-primary-dark)]" />
                  </span>
                </span>
              </button>

              {/* Body */}
              <div className="p-3.5 pb-2 flex-1 min-w-0">
                <p className="text-sm font-bold text-[var(--mc-text-primary)] truncate" title={f.originalName}>{f.originalName}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{fileSize(f.size)} · {fmtDate(f.createdAt)}</p>
                <p className="text-[10px] text-muted-foreground truncate mt-0.5" title={f.url}>{f.folder !== '/' ? `${f.folder} · ` : ''}{f.fileName}</p>
              </div>

              {/* FOOTER HERO — actions on every card */}
              <div className="border-t border-[var(--mc-divider)] bg-[var(--mc-bg-card)] px-2.5 py-2.5">
                <div className="grid grid-cols-5 gap-1">
                  <button type="button" title="Preview" className="mc-action-btn mc-action-view !w-full !h-8 !rounded-lg" onClick={() => setPreviewing(f)}>
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" title="Copy URL" className="mc-action-btn !w-full !h-8 !rounded-lg" style={{ background: copiedId === f.id ? '#16a34a' : '#0891b2' }} onClick={() => copyUrl(f)}>
                    {copiedId === f.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                  <button type="button" title="Download" className="mc-action-btn mc-action-download !w-full !h-8 !rounded-lg" onClick={() => downloadFile(f)}>
                    <Download className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" title="Edit metadata" className="mc-action-btn mc-action-edit !w-full !h-8 !rounded-lg" onClick={() => openEdit(f)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" title="Delete" className="mc-action-btn mc-action-delete !w-full !h-8 !rounded-lg" onClick={() => { setDeleting(f); setConfirmOpen(true); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex justify-center gap-2 mt-1.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <span>Preview</span><span>URL</span><span>Save</span><span>Edit</span><span>Del</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* BOTTOM PAGINATION */}
      <div className="rounded-xl border bg-white px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 no-print">
        <span className="text-sm text-muted-foreground">
          Showing <b>{files.length}</b> of <b>{total}</b> file{total !== 1 ? 's' : ''} · page {page} of {totalPages || 1}
        </span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-9 gap-1" disabled={page <= 1 || loading} onClick={() => load(page - 1)}>
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          {pageNumbers.map(n => (
            <button
              key={n}
              onClick={() => load(n)}
              disabled={loading}
              className={`h-9 w-9 rounded-lg text-sm font-bold transition-colors ${n === page ? 'bg-[var(--mc-primary)] text-white shadow' : 'text-[var(--mc-text-secondary)] hover:bg-[var(--mc-primary-light)]'}`}
            >
              {n}
            </button>
          ))}
          {totalPages > pageNumbers[pageNumbers.length - 1] && <span className="px-1 text-muted-foreground">…</span>}
          <Button variant="outline" size="sm" className="h-9 gap-1" disabled={page >= totalPages || loading} onClick={() => load(page + 1)}>
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-[var(--mc-primary)]" />}
      </div>

      {/* Preview modal */}
      <PremiumModal
        open={!!previewing} onOpenChange={o => !o && setPreviewing(null)} size="xl"
        title={previewing?.originalName || 'File preview'}
        icon={<Eye className="h-5 w-5" />}
        description={previewing ? `${previewing.module} · ${fileSize(previewing.size)} · ${fmtDate(previewing.createdAt)}` : ''}
        footerNote="Use Copy URL to embed this file anywhere"
        secondaryLabel="Close"
        extraFooter={
          previewing && (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => copyUrl(previewing)}>{copiedId === previewing.id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />} Copy URL</Button>
              <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => downloadFile(previewing)}><Download className="h-3.5 w-3.5" /> Download</Button>
            </div>
          )
        }
      >
        {previewing && (isImage(previewing) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewing.url} alt={previewing.originalName} className="max-h-[65vh] w-auto mx-auto rounded-xl shadow-lg" />
        ) : (
          <div className="text-center py-10">
            <FileText className="h-14 w-14 mx-auto text-muted-foreground mb-3" />
            <p className="font-semibold">{previewing.originalName}</p>
            <p className="text-xs text-muted-foreground mt-1">{previewing.mimeType} · {fileSize(previewing.size)}</p>
            <a href={previewing.url} target="_blank" rel="noreferrer" className="inline-block mt-4 text-sm font-bold text-[var(--mc-primary)] hover:underline">Open in new tab →</a>
          </div>
        ))}
        {previewing && (
          <div className="mt-4 rounded-lg bg-[var(--mc-bg-card)] border border-[var(--mc-divider)] p-3">
            <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">URL</p>
            <p className="text-xs font-mono break-all text-[var(--mc-text-secondary)]">{previewing.url}</p>
          </div>
        )}
      </PremiumModal>

      {/* Edit metadata modal */}
      <PremiumModal
        open={!!editing} onOpenChange={o => !o && setEditing(null)} size="md"
        title="Edit File Metadata"
        icon={<Pencil className="h-5 w-5" />}
        description={editing ? editing.fileName : ''}
        footerNote="Metadata helps organize the library — the stored file is unchanged"
        submitLabel="Save Metadata" onSubmit={saveEdit} submitting={editBusy} secondaryLabel="Cancel"
      >
        <FormSection n={1} title="Metadata">
          <Field icon={<FileText className="h-3.5 w-3.5" />} label="Display Name">
            <McInput value={editDraft.originalName} onChange={e => setEditDraft(d => ({ ...d, originalName: e.target.value }))} />
          </Field>
          <Field icon={<Folder className="h-3.5 w-3.5" />} label="Module / Category">
            <McInput value={editDraft.module} onChange={e => setEditDraft(d => ({ ...d, module: e.target.value }))} placeholder="WEBSITE / NEWS / GALLERY / DOCS…" />
          </Field>
          <Field icon={<Folder className="h-3.5 w-3.5" />} label="Folder">
            <McInput value={editDraft.folder} onChange={e => setEditDraft(d => ({ ...d, folder: e.target.value }))} placeholder="/ or /banners" />
          </Field>
        </FormSection>
      </PremiumModal>

      <ConfirmModal
        open={confirmOpen} onOpenChange={setConfirmOpen}
        title="Delete File Record"
        message={deleting ? `Remove the file record for "${deleting.originalName}"? The stored file itself is kept on disk.` : ''}
        onConfirm={doDelete} submitting={deleteBusy}
      />
    </div>
  );
}
