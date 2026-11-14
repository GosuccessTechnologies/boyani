'use client';

/**
 * FILE UPLOADER v2 — drag & drop + browse + URL import + client-side
 * compression (canvas resize + jpeg quality) + live upload progress %.
 * DEVELOPER-MANUAL §6.5 · Instruction 9 (progress bar in percentages).
 */

import * as React from 'react';
import { UploadCloud, Link2, X, ImageIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiUpload } from '@/lib/client-api';
import { toast } from 'sonner';

interface FileUploaderProps {
  value?: string;
  onChange: (url: string) => void;
  module?: string;
  accept?: string;
  label?: string;
  compress?: boolean;
  maxWidth?: number;
  quality?: number;
  className?: string;
  /** Compact height variant for inline forms */
  compact?: boolean;
}

async function compressImage(file: File, maxWidth = 1200, quality = 0.82): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') return file;
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxWidth / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(file);
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) return resolve(file);
          const ext = blob.type.includes('png') ? 'png' : 'jpg';
          const base = file.name.replace(/\.[^.]+$/, '');
          resolve(new File([blob], `${base}-compressed.${ext}`, { type: blob.type }));
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

/** Upload with live progress events (XHR because fetch has no upload progress). */
function uploadWithProgress(file: File, moduleName: string, onProgress: (pct: number) => void): Promise<{ url: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append('file', file);
    form.append('category', moduleName);
    xhr.open('POST', '/api/upload');
    const token = typeof window !== 'undefined' ? localStorage.getItem('boyani-auth') : null;
    let bearer = '';
    try { bearer = token ? JSON.parse(token)?.state?.token || '' : ''; } catch { /* ignore */ }
    if (bearer) xhr.setRequestHeader('Authorization', `Bearer ${bearer}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && data.url) {
          onProgress(100);
          resolve(data);
        } else reject(new Error(data.error || `Upload failed (${xhr.status})`));
      } catch { reject(new Error('Upload failed')); }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(form);
  });
}

export function FileUploader({
  value, onChange, module = 'GENERAL', accept = 'image/*', label = 'Upload image or file',
  compress = true, maxWidth = 1200, quality = 0.82, className, compact,
}: FileUploaderProps) {
  const [dragging, setDragging] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [showUrl, setShowUrl] = React.useState(false);
  const [urlInput, setUrlInput] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    setProgress(0);
    try {
      const finalFile = compress ? await compressImage(file, maxWidth, quality) : file;
      const res = await uploadWithProgress(finalFile, module, setProgress);
      onChange(res.url);
      toast.success('File uploaded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(0), 800);
    }
  };

  const importUrl = async () => {
    if (!/^https?:\/\/.+/.test(urlInput)) {
      toast.error('Enter a valid image/file URL (https://...)');
      return;
    }
    onChange(urlInput);
    setShowUrl(false);
    setUrlInput('');
    toast.success('Image link added');
  };

  return (
    <div className={className}>
      <div
        className={`relative rounded-xl border-2 border-dashed ${compact ? 'p-2.5' : 'p-4'} text-center transition-colors cursor-pointer
          ${dragging ? 'border-[var(--mc-primary)] bg-[var(--mc-primary-light)]' : 'border-[var(--mc-divider)] hover:border-[var(--mc-primary)]'}`}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2 py-3 w-full max-w-xs mx-auto">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--mc-primary)]" />
            <p className="text-sm text-muted-foreground">Uploading & compressing…</p>
            {/* Progress bar in percentages */}
            <div className="w-full h-2.5 rounded-full bg-[var(--mc-divider)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-200"
                style={{ width: `${progress}%`, background: 'linear-gradient(90deg, var(--mc-primary), var(--mc-tertiary))' }}
              />
            </div>
            <p className="text-xs font-bold text-[var(--mc-primary)]">{progress}%</p>
          </div>
        ) : value ? (
          <div className="relative inline-block">
            {value.match(/\.(png|jpe?g|webp|gif|svg)$/i) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={value} alt="preview" className="max-h-36 rounded-lg mx-auto" />
            ) : (
              <div className="flex items-center gap-2 justify-center py-3 text-sm text-muted-foreground">
                <ImageIcon className="h-5 w-5" /> {value.split('/').pop()}
              </div>
            )}
            <button
              type="button"
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-600 text-white flex items-center justify-center"
              onClick={e => { e.stopPropagation(); onChange(''); }}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 py-3">
            <UploadCloud className="h-8 w-8 text-[var(--mc-primary)]" />
            <p className="text-sm font-medium">{label}</p>
            <p className="text-xs text-muted-foreground">Drag & drop, click to browse</p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 mt-2">
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1 text-xs"
          onClick={e => { e.stopPropagation(); setShowUrl(s => !s); }}>
          <Link2 className="h-3.5 w-3.5" /> Import from URL
        </Button>
        {compress && <span className="text-[11px] text-muted-foreground">Auto-compressed to ≤{maxWidth}px</span>}
      </div>

      {showUrl && (
        <div className="flex items-center gap-2 mt-2">
          <Input
            className="mc-input h-9"
            placeholder="https://example.com/image.jpg"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
          />
          <Button type="button" size="sm" className="h-9" onClick={importUrl}>Use URL</Button>
        </div>
      )}
    </div>
  );
}
