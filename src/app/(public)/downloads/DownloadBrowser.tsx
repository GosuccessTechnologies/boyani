'use client';

/**
 * DOWNLOADS BROWSER — category filter chips + document grid.
 */

import * as React from 'react';
import { Download, FileText, FileSpreadsheet, FileImage, FileArchive, FileType2, HardDriveDownload } from 'lucide-react';

export interface PublicDownload {
  id: string;
  title: string;
  description: string;
  fileUrl: string;
  fileExt: string;
  fileSize: number;
  category: string;
  downloadCount: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  GENERAL: 'General',
  FORMS: 'Forms',
  REPORTS: 'Reports',
  POLICIES: 'Policies',
  BROCHURES: 'Brochures',
  TENDER_DOCS: 'Tender Documents',
};

const EXT_META: Record<string, { icon: typeof FileText; color: string }> = {
  pdf: { icon: FileText, color: 'bg-red-50 text-red-600' },
  doc: { icon: FileText, color: 'bg-blue-50 text-blue-600' },
  docx: { icon: FileText, color: 'bg-blue-50 text-blue-600' },
  xls: { icon: FileSpreadsheet, color: 'bg-green-50 text-green-600' },
  xlsx: { icon: FileSpreadsheet, color: 'bg-green-50 text-green-600' },
  csv: { icon: FileSpreadsheet, color: 'bg-green-50 text-green-600' },
  jpg: { icon: FileImage, color: 'bg-purple-50 text-purple-600' },
  jpeg: { icon: FileImage, color: 'bg-purple-50 text-purple-600' },
  png: { icon: FileImage, color: 'bg-purple-50 text-purple-600' },
  zip: { icon: FileArchive, color: 'bg-amber-50 text-amber-600' },
};

const formatSize = (bytes: number) => {
  if (!bytes) return '';
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

export default function DownloadBrowser({ downloads }: { downloads: PublicDownload[] }) {
  const [category, setCategory] = React.useState('');

  const categories = React.useMemo(() => [...new Set(downloads.map(d => d.category))], [downloads]);
  const filtered = category ? downloads.filter(d => d.category === category) : downloads;

  if (!downloads.length) {
    return (
      <p className="rounded-2xl border border-dashed border-[var(--mc-divider)] bg-white p-12 text-center text-[var(--mc-text-secondary)]">
        No downloads published yet — check back soon.
      </p>
    );
  }

  return (
    <div>
      {/* Category chips */}
      <div className="flex flex-wrap gap-2 mb-8">
        <button
          onClick={() => setCategory('')}
          className={`rounded-full px-4 py-2 text-xs font-bold border transition-colors ${!category ? 'mc-gradient-primary text-white border-transparent shadow' : 'border-[var(--mc-divider)] bg-white text-[var(--mc-text-secondary)] hover:border-[var(--mc-primary)] hover:text-[var(--mc-primary)]'}`}
        >
          All ({downloads.length})
        </button>
        {categories.map(c => (
          <button
            key={c}
            onClick={() => setCategory(category === c ? '' : c)}
            className={`rounded-full px-4 py-2 text-xs font-bold border transition-colors ${category === c ? 'mc-gradient-primary text-white border-transparent shadow' : 'border-[var(--mc-divider)] bg-white text-[var(--mc-text-secondary)] hover:border-[var(--mc-primary)] hover:text-[var(--mc-primary)]'}`}
          >
            {CATEGORY_LABELS[c] || c.replaceAll('_', ' ')} ({downloads.filter(d => d.category === c).length})
          </button>
        ))}
      </div>

      {/* Download cards grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map(d => {
          const ext = (d.fileExt || 'file').toLowerCase();
          const meta = EXT_META[ext] || { icon: FileType2, color: 'bg-slate-100 text-slate-600' };
          const size = formatSize(d.fileSize);
          return (
            <div key={d.id} className="group rounded-2xl border border-[var(--mc-divider)] bg-white p-5 hover:shadow-lg hover:border-[var(--mc-primary)] transition-all flex flex-col">
              <div className="flex items-start gap-4">
                <span className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${meta.color}`}>
                  <meta.icon className="h-6 w-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-extrabold text-[var(--mc-text-primary)] leading-snug">{d.title}</h3>
                  <p className="text-xs font-semibold text-[var(--mc-text-muted)] mt-1 uppercase tracking-wide">
                    {CATEGORY_LABELS[d.category] || d.category.replaceAll('_', ' ')} · {ext.toUpperCase()}{size ? ` · ${size}` : ''}
                  </p>
                </div>
              </div>
              {d.description && <p className="text-sm text-[var(--mc-text-secondary)] mt-3 line-clamp-2">{d.description}</p>}
              <div className="mt-auto pt-4 flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-xs text-[var(--mc-text-muted)] font-semibold">
                  <HardDriveDownload className="h-3.5 w-3.5" /> {Number(d.downloadCount).toLocaleString('en-KE')} downloads
                </span>
                <a
                  href={d.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full mc-gradient-primary text-white px-4 py-2 text-xs font-bold shadow hover:-translate-y-0.5 transition-transform"
                >
                  <Download className="h-3.5 w-3.5" /> Download
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="rounded-2xl border border-dashed border-[var(--mc-divider)] bg-white p-10 text-center text-[var(--mc-text-secondary)]">
          No documents in this category.
        </p>
      )}
    </div>
  );
}
