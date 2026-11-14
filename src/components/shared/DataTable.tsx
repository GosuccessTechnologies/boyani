'use client';

/**
 * MEDCARE DATATABLE — the canonical table system (DEVELOPER-MANUAL §6.2)
 *
 * Features per instructions:
 *  - Default 4 visible data columns + action column (= 5); column-toggle
 *    expander reveals the rest (session-only, not global)
 *  - Zebra striped rows + alternating column-header backgrounds
 *  - Row numbering + leading checkbox select
 *  - Advanced filters: global search + per-column filter row
 *  - Sortable headers, pagination
 *  - Row action buttons with unique colors (view/edit/delete/print/download)
 *  - Select/filter → export CSV or PDF (one at a time) + print with
 *    facility hero header — content only
 */

import * as React from 'react';
import { ChevronDown, ChevronUp, Filter, Download, Printer, FileText, Table as TableIcon, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { exportCsv } from '@/lib/client-api';

export interface Column<T> {
  key: string;
  header: string;
  /** Default visible (first 4 default-visible columns are shown by default) */
  defaultVisible?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  width?: string;
  align?: 'left' | 'right' | 'center';
  render?: (row: T) => React.ReactNode;
  csvValue?: (row: T) => string | number | null | undefined;
}

export interface ActionBtn {
  icon: React.ReactNode;
  title: string;
  variant: 'view' | 'edit' | 'delete' | 'print' | 'download';
  onClick: (row: any) => void;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  actions?: ActionBtn[];
  rowKey: (row: T) => string;
  title?: string;
  moduleLabel?: string;
  loading?: boolean;
  page?: number;
  perPage?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  onSelectionChange?: (selected: T[]) => void;
  toolbarExtra?: React.ReactNode;
  emptyMessage?: string;
}

export function DataTable<T>({
  data, columns, actions = [], rowKey, title, moduleLabel, loading,
  page = 1, perPage = 10, total, onPageChange, onSelectionChange, toolbarExtra,
  emptyMessage = 'No records found',
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = React.useState<string | null>(null);
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc');
  const [globalSearch, setGlobalSearch] = React.useState('');
  const [columnFilters, setColumnFilters] = React.useState<Record<string, string>>({});
  const [showAllColumns, setShowAllColumns] = React.useState(false);
  const [hiddenKeys, setHiddenKeys] = React.useState<Set<string>>(new Set());
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  // Default-visible columns: explicitly-flagged or first 4
  const defaultKeys = columns.filter(c => c.defaultVisible).map(c => c.key);
  const autoDefault = defaultKeys.length > 0 ? defaultKeys : columns.slice(0, 4).map(c => c.key);
  const visibleKeys = (showAllColumns ? columns.map(c => c.key).filter(k => !hiddenKeys.has(k)) : autoDefault);
  const visibleColumns = columns.filter(c => visibleKeys.includes(c.key));

  const toggleColumnVisibility = (key: string) => {
    const next = new Set(hiddenKeys);
    if (next.has(key)) next.delete(key); else next.add(key);
    setHiddenKeys(next);
  };

  // Filter data client-side
  const filtered = React.useMemo(() => {
    let rows = [...data];
    if (globalSearch.trim()) {
      const q = globalSearch.toLowerCase();
      rows = rows.filter(row =>
        columns.some(col => {
          const v = col.csvValue ? col.csvValue(row) : (row as Record<string, unknown>)[col.key];
          return String(v ?? '').toLowerCase().includes(q);
        })
      );
    }
    for (const [key, value] of Object.entries(columnFilters)) {
      if (!value.trim()) continue;
      const col = columns.find(c => c.key === key);
      const q = value.toLowerCase();
      rows = rows.filter(row => {
        const v = col?.csvValue ? col.csvValue(row) : (row as Record<string, unknown>)[key];
        return String(v ?? '').toLowerCase().includes(q);
      });
    }
    return rows;
  }, [data, globalSearch, columnFilters, columns]);

  // Sort
  const sorted = React.useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find(c => c.key === sortKey);
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = col?.csvValue ? col.csvValue(a) : (a as Record<string, unknown>)[sortKey];
      const vb = col?.csvValue ? col.csvValue(b) : (b as Record<string, unknown>)[sortKey];
      if (va == null) return 1; if (vb == null) return -1;
      const na = Number(va), nb = Number(vb);
      if (!isNaN(na) && !isNaN(nb)) return (na - nb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }, [filtered, sortKey, sortDir, columns]);

  const selectedRows = React.useMemo(
    () => sorted.filter(row => selected.has(rowKey(row))),
    [sorted, selected, rowKey]
  );
  React.useEffect(() => { onSelectionChange?.(selectedRows); /* eslint-disable-next-line */ }, [selectedRows.length]);

  const toggleAll = () => {
    if (selected.size === sorted.length) setSelected(new Set());
    else setSelected(new Set(sorted.map(rowKey)));
  };
  const toggleRow = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key); else next.add(key);
    setSelected(next);
  };

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  // ── Export CSV ──
  const doExportCsv = () => {
    const rows = selectedRows.length ? selectedRows : sorted;
    const headers = visibleColumns.map(c => c.header);
    const values = rows.map(row => visibleColumns.map(c => {
      const v = c.csvValue ? c.csvValue(row) : (row as Record<string, unknown>)[c.key];
      return v == null ? '' : (typeof v === 'number' ? v : String(v));
    }));
    exportCsv(`${(moduleLabel || title || 'export').toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`, headers, values);
  };

  // ── Export PDF (print-to-PDF via new window) ──
  const doExportPdf = async () => {
    const rows = selectedRows.length ? selectedRows : sorted;
    const win = window.open('', '_blank', 'width=900,height=650');
    if (!win) return;
    // Dynamic facility identity from CompanyConfig (Instruction 1)
    const company = await fetch('/api/company').then(r => r.json()).then(d => d.company || {}).catch(() => ({}));
    const facilityName = company.companyName || 'Boyani Health Dispensary';
    const accent = company.themeColor || '#0d9488';
    const ths = visibleColumns.map(c => `<th>${c.header}</th>`).join('');
    const trs = rows.map((row, i) => `<tr>
      <td>${i + 1}</td>
      ${visibleColumns.map(c => {
        const v = c.csvValue ? c.csvValue(row) : (row as Record<string, unknown>)[c.key];
        return `<td>${v ?? ''}</td>`;
      }).join('')}
    </tr>`).join('');
    win.document.write(`<!DOCTYPE html><html><head><title>${title || 'Export'}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
        .hero { text-align: center; border-bottom: 3px solid ${accent}; padding-bottom: 12px; margin-bottom: 16px; }
        .hero h1 { margin: 0; font-size: 22px; color: ${accent}; }
        .hero p { margin: 4px 0; font-size: 12px; color: #64748b; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { background: #134e4a; color: #fff; padding: 8px; text-align: left; }
        td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
        tr:nth-child(even) td { background: #f0fdfa; }
        .meta { font-size: 11px; color: #64748b; margin-bottom: 10px; }
      </style></head><body>
      <div class="hero">
        <h1>${facilityName}</h1>
        <p>${moduleLabel || title || ''} — Generated ${new Date().toLocaleString('en-KE')}</p>
      </div>
      <div class="meta">${rows.length} record(s)${selectedRows.length ? ' (selected rows)' : ''}</div>
      <table><thead><tr><th>#</th>${ths}</tr></thead><tbody>${trs}</tbody></table>
      <script>window.onload = () => setTimeout(() => window.print(), 300)</script>
      </body></html>`);
    win.document.close();
  };

  // ── Print ──
  const doPrint = () => doExportPdf();

  const totalPages = total !== undefined && perPage ? Math.ceil(total / perPage) : 1;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 no-print">
        <div className="relative flex-1 min-w-[200px]">
          <Input
            placeholder="Search all columns..."
            value={globalSearch}
            onChange={e => setGlobalSearch(e.target.value)}
            className="mc-input h-9 pl-8"
          />
          <Filter className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        </div>
        {toolbarExtra}
        {/* Column toggle */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-1"
              title={showAllColumns ? 'Collapse to default columns' : 'Expand all columns (this session only)'}>
              <TableIcon className="h-4 w-4" />
              {showAllColumns ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              <span className="hidden sm:inline">{showAllColumns ? 'Less' : 'Columns'}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56" align="end">
            <p className="text-xs font-semibold mb-2 text-muted-foreground">Column visibility (session only)</p>
            {columns.map(col => (
              <label key={col.key} className="flex items-center gap-2 py-1 text-sm cursor-pointer">
                <Checkbox
                  checked={visibleKeys.includes(col.key)}
                  disabled={!showAllColumns && autoDefault.includes(col.key)}
                  onCheckedChange={() => toggleColumnVisibility(col.key)}
                />
                <span>{col.header}</span>
              </label>
            ))}
            <Button size="sm" variant="outline" className="w-full mt-2"
              onClick={() => { setShowAllColumns(s => !s); setHiddenKeys(new Set()); }}>
              {showAllColumns ? 'Collapse to default' : 'Expand all columns'}
            </Button>
          </PopoverContent>
        </Popover>
        {/* Export + print */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-1">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-44" align="end">
            <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={doExportCsv}>
              <FileText className="h-4 w-4 text-green-600" /> Export CSV
            </Button>
            <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={doExportPdf}>
              <FileText className="h-4 w-4 text-red-600" /> Export PDF
            </Button>
            <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={doPrint}>
              <Printer className="h-4 w-4 text-purple-600" /> Print ({selectedRows.length || sorted.length})
            </Button>
          </PopoverContent>
        </Popover>
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-x-auto bg-white">
        <table className="mc-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <Checkbox checked={selected.size === sorted.length && sorted.length > 0} onCheckedChange={toggleAll} />
              </th>
              <th style={{ width: 44 }}>#</th>
              {visibleColumns.map(col => (
                <th key={col.key} style={{ width: col.width, textAlign: col.align }}>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-[var(--mc-primary)]"
                    onClick={() => col.sortable !== false && handleSort(col.key)}
                  >
                    {col.header}
                    {col.sortable !== false && (sortKey === col.key
                      ? (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)
                      : <ChevronsUpDown className="h-3 w-3 opacity-40" />)}
                  </button>
                </th>
              ))}
              {actions.length > 0 && <th style={{ width: actions.length * 40 }}>Actions</th>}
            </tr>
            {/* Column filter row */}
            <tr>
              <th colSpan={2} />
              {visibleColumns.map(col => (
                <th key={`f-${col.key}`} className="p-1">
                  {col.filterable !== false && (
                    <input
                      className="w-full h-7 text-xs px-2 rounded border border-[var(--mc-divider)] bg-white"
                      placeholder={`Filter ${col.header.toLowerCase()}`}
                      value={columnFilters[col.key] || ''}
                      onChange={e => setColumnFilters(prev => ({ ...prev, [col.key]: e.target.value }))}
                    />
                  )}
                </th>
              ))}
              {actions.length > 0 && <th />}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={visibleColumns.length + 2 + (actions.length ? 1 : 0)} className="text-center py-10 text-muted-foreground">Loading…</td></tr>
            ) : sorted.length === 0 ? (
              <tr><td colSpan={visibleColumns.length + 2 + (actions.length ? 1 : 0)} className="text-center py-10 text-muted-foreground">{emptyMessage}</td></tr>
            ) : (
              sorted.map((row, idx) => {
                const key = rowKey(row);
                return (
                  <tr key={key}>
                    <td><Checkbox checked={selected.has(key)} onCheckedChange={() => toggleRow(key)} /></td>
                    <td className="text-muted-foreground">{(page - 1) * perPage + idx + 1}</td>
                    {visibleColumns.map(col => (
                      <td key={col.key} style={{ textAlign: col.align }}>
                        {col.render
                          ? col.render(row)
                          : String(((row as Record<string, unknown>)[col.key] ?? ''))}
                      </td>
                    ))}
                    {actions.length > 0 && (
                      <td>
                        <div className="flex items-center gap-1">
                          {actions.map((action, ai) => (
                            <button
                              key={ai}
                              type="button"
                              title={action.title}
                              className={`mc-action-btn mc-action-${action.variant}`}
                              onClick={() => action.onClick(row)}
                            >
                              {action.icon}
                            </button>
                          ))}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground no-print">
        <span>
          {selectedRows.length > 0 ? `${selectedRows.length} selected · ` : ''}
          {sorted.length} row(s){total !== undefined ? ` of ${total}` : ''}
        </span>
        {onPageChange && totalPages > 1 && (
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Prev</Button>
            <span className="px-2">Page {page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Next</Button>
          </div>
        )}
      </div>
    </div>
  );
}
