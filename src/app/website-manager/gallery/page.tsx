'use client';

/**
 * GALLERY — albums manager. Album cards (cover, title, description, photo
 * count) + album create/edit modal + photo add modal (imageUrl FileUploader,
 * title, caption, displayOrder) + photos grid with delete inside an album
 * detail modal. Data: /api/gallery (auth list returns photos as ids only —
 * full photos fetched via ?id=).
 */

import * as React from 'react';
import {
  Image as ImageIcon, Type, AlignLeft, Layers, Camera, Trash2, Plus, Pencil,
  ArrowUpDown, CaptionsIcon, Loader2, EyeOff,
} from 'lucide-react';
import { PremiumModal } from '@/components/shared/PremiumModal';
import { StatCard } from '@/components/shared/StatCard';
import { FileUploader } from '@/components/shared/FileUploader';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/client-api';
import { toast } from 'sonner';
import { Field, FormSection, ConfirmModal, PageHeading, McInput, McTextarea } from '@/app/ops/_lib';

interface Photo { id: string; albumId: string; title: string; imageUrl: string; caption: string; displayOrder: number }
interface Album {
  id: string; title: string; slug: string; description: string; coverImageUrl: string;
  displayOrder: number; isPublic: boolean;
  photos: Array<Photo | { id: string }>; // auth list returns ids only
}
interface AlbumFull extends Omit<Album, 'photos'> { photos: Photo[] }

export default function GalleryPage() {
  const [albums, setAlbums] = React.useState<Album[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [albumModal, setAlbumModal] = React.useState(false);
  const [editingAlbum, setEditingAlbum] = React.useState<Album | null>(null);
  const [aForm, setAForm] = React.useState({ title: '', description: '', coverImageUrl: '', displayOrder: '0', isPublic: true });
  const [albumBusy, setAlbumBusy] = React.useState(false);

  const [detail, setDetail] = React.useState<AlbumFull | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);

  const [photoModal, setPhotoModal] = React.useState(false);
  const [pForm, setPForm] = React.useState({ imageUrl: '', title: '', caption: '', displayOrder: '0' });
  const [photoBusy, setPhotoBusy] = React.useState(false);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmMsg, setConfirmMsg] = React.useState('');
  const [confirmAction, setConfirmAction] = React.useState<(() => Promise<void>) | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ albums: Album[] }>('/api/gallery');
      setAlbums(res.albums || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load albums');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const openCreateAlbum = () => {
    setEditingAlbum(null);
    setAForm({ title: '', description: '', coverImageUrl: '', displayOrder: String(albums.length), isPublic: true });
    setAlbumModal(true);
  };
  const openEditAlbum = (a: Album) => {
    setEditingAlbum(a);
    setAForm({
      title: a.title, description: a.description || '', coverImageUrl: a.coverImageUrl || '',
      displayOrder: String(a.displayOrder ?? 0), isPublic: !!a.isPublic,
    });
    setAlbumModal(true);
  };

  const submitAlbum = async () => {
    if (!aForm.title.trim()) { toast.error('Album title is required'); return; }
    setAlbumBusy(true);
    try {
      const payload = {
        title: aForm.title.trim(), description: aForm.description, coverImageUrl: aForm.coverImageUrl,
        displayOrder: aForm.displayOrder, isPublic: aForm.isPublic,
        ...(editingAlbum ? { id: editingAlbum.id } : {}),
      };
      const res = editingAlbum
        ? await apiPut<{ message: string }>('/api/gallery', payload)
        : await apiPost<{ message: string }>('/api/gallery', payload);
      toast.success(res.message || (editingAlbum ? 'Album updated' : 'Album created'));
      setAlbumModal(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save album');
    } finally {
      setAlbumBusy(false);
    }
  };

  const openDetail = async (a: Album) => {
    setDetailLoading(true);
    try {
      const res = await apiGet<{ album: AlbumFull }>(`/api/gallery?id=${a.id}`);
      setDetail(res.album);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to open album');
    } finally {
      setDetailLoading(false);
    }
  };

  const openAddPhoto = () => {
    if (!detail) return;
    setPForm({ imageUrl: '', title: '', caption: '', displayOrder: String(detail.photos.length) });
    setPhotoModal(true);
  };

  const submitPhoto = async () => {
    if (!detail || !pForm.imageUrl.trim()) { toast.error('Photo image is required'); return; }
    setPhotoBusy(true);
    try {
      const res = await apiPost<{ message: string }>('/api/gallery', {
        albumId: detail.id,
        photo: { imageUrl: pForm.imageUrl.trim(), title: pForm.title, caption: pForm.caption, displayOrder: pForm.displayOrder },
      });
      toast.success(res.message || 'Photo added');
      setPhotoModal(false);
      await openDetail(detail); // refresh grid
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add photo');
    } finally {
      setPhotoBusy(false);
    }
  };

  const deletePhoto = (p: Photo) => {
    setConfirmMsg('Remove this photo from the album?');
    setConfirmAction(async () => {
      await apiDelete(`/api/gallery?photoId=${p.id}`);
      toast.success('Photo deleted');
      if (detail) await openDetail(detail);
      load();
    });
    setConfirmOpen(true);
  };

  const deleteAlbum = (a: Album) => {
    setConfirmMsg(`Delete album "${a.title}" and ALL its photos?`);
    setConfirmAction(async () => {
      await apiDelete(`/api/gallery?id=${a.id}`);
      toast.success('Album deleted');
      setDetail(null);
      load();
    });
    setConfirmOpen(true);
  };

  const runConfirm = async () => {
    if (!confirmAction) return;
    setBusy(true);
    try {
      await confirmAction();
      setConfirmOpen(false);
      setConfirmAction(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Operation failed');
    } finally {
      setBusy(false);
    }
  };

  const photoCount = (a: Album) => a.photos?.length || 0;
  const totalPhotos = albums.reduce((s, a) => s + photoCount(a), 0);

  return (
    <div className="space-y-4">
      <PageHeading
        icon={<ImageIcon className="h-5 w-5" />}
        title="Gallery Albums"
        subtitle="Photo albums for the public gallery — covers, captions & ordering"
        actions={<Button size="sm" className="gap-1" onClick={openCreateAlbum}><Plus className="h-4 w-4" /> New Album</Button>}
      />

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)}</div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Albums" value={albums.length} icon={<ImageIcon className="h-5 w-5" />} accent="primary" />
            <StatCard label="Photos" value={totalPhotos} icon={<Camera className="h-5 w-5" />} accent="secondary" />
            <StatCard label="Public" value={albums.filter(a => a.isPublic).length} icon={<Layers className="h-5 w-5" />} accent="success" />
            <StatCard label="Private" value={albums.filter(a => !a.isPublic).length} icon={<EyeOff className="h-5 w-5" />} accent="warning" />
          </div>

          {albums.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No albums yet — create your first photo album.</p>}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {albums.map(a => (
              <div key={a.id} className={`rounded-xl border bg-white overflow-hidden flex flex-col ${a.isPublic ? '' : 'opacity-75'}`}>
                <div className="h-36 bg-slate-100 relative cursor-pointer" onClick={() => openDetail(a)}>
                  {a.coverImageUrl ? (
                     
                    <img src={a.coverImageUrl} alt={a.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400"><ImageIcon className="h-8 w-8" /></div>
                  )}
                  <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px] font-bold">{photoCount(a)} photos</span>
                  {!a.isPublic && <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px] font-bold">hidden</span>}
                </div>
                <div className="p-3 flex-1 flex flex-col gap-2">
                  <h3 className="text-sm font-bold text-[var(--mc-text-primary)] truncate">{a.title}</h3>
                  <p className="text-[11px] text-muted-foreground line-clamp-2 flex-1">{a.description || 'No description'}</p>
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1 flex-1" onClick={() => openDetail(a)}>
                      <Camera className="h-3 w-3" /> Photos
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0" title="Edit album" onClick={() => openEditAlbum(a)}><Pencil className="h-3 w-3" /></Button>
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-red-600 hover:bg-red-50" title="Delete album" onClick={() => deleteAlbum(a)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Album form modal */}
      <PremiumModal
        open={albumModal} onOpenChange={setAlbumModal} size="md"
        title={editingAlbum ? `Edit Album — ${editingAlbum.title}` : 'New Album'}
        icon={<ImageIcon className="h-5 w-5" />}
        description="Albums group photos into stories on the public gallery"
        footerNote="Slug auto-generated from the title"
        submitLabel={editingAlbum ? 'Update Album' : 'Create Album'}
        onSubmit={submitAlbum} submitting={albumBusy} secondaryLabel="Cancel"
      >
        <div className="space-y-5">
          <FormSection n={1} title="Album">
            <Field icon={<Type className="h-3.5 w-3.5" />} label="Title">
              <McInput value={aForm.title} onChange={e => setAForm(f => ({ ...f, title: e.target.value }))} placeholder="New Maternity Wing" />
            </Field>
            <Field icon={<ArrowUpDown className="h-3.5 w-3.5" />} label="Display Order">
              <McInput type="number" value={aForm.displayOrder} onChange={e => setAForm(f => ({ ...f, displayOrder: e.target.value }))} />
            </Field>
            <Field icon={<AlignLeft className="h-3.5 w-3.5" />} label="Description" className="sm:col-span-2">
              <McTextarea value={aForm.description} onChange={e => setAForm(f => ({ ...f, description: e.target.value }))} placeholder="A look inside our newly opened wing" />
            </Field>
            <Field icon={<ImageIcon className="h-3.5 w-3.5" />} label="Cover Image" className="sm:col-span-2">
              <FileUploader value={aForm.coverImageUrl} onChange={url => setAForm(f => ({ ...f, coverImageUrl: url }))} module="GALLERY" label="Upload album cover" />
            </Field>
            <label className="flex items-center gap-3 rounded-xl border border-[var(--mc-divider)] bg-[var(--mc-bg-card)] px-3 py-2.5 cursor-pointer sm:col-span-2">
              <Switch checked={aForm.isPublic} onCheckedChange={c => setAForm(f => ({ ...f, isPublic: c }))} />
              <span className="text-sm text-[var(--mc-text-secondary)]">Public (visible on website)</span>
            </label>
          </FormSection>
        </div>
      </PremiumModal>

      {/* Album detail + photos grid */}
      <PremiumModal
        open={!!detail} onOpenChange={o => { if (!o) setDetail(null); }} size="xl"
        title={detail ? `Album — ${detail.title}` : ''}
        icon={<Camera className="h-5 w-5" />}
        description={detail ? `${detail.photos.length} photo(s)${detail.description ? ` · ${detail.description}` : ''}` : ''}
        footerNote="Click any photo's trash button to remove it"
        submitLabel="Add Photo"
        submitIcon={<Plus className="h-4 w-4" />}
        onSubmit={openAddPhoto}
        secondaryLabel="Close"
      >
        {detailLoading || !detail ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground gap-2"><Loader2 className="h-5 w-5 animate-spin" /> Loading photos…</div>
        ) : detail.photos.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No photos in this album yet — add the first one.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {detail.photos.map(p => (
              <div key={p.id} className="rounded-lg border overflow-hidden bg-white group">
                <div className="h-28 bg-slate-100 relative">
                  { }
                  <img src={p.imageUrl} alt={p.title || 'photo'} className="w-full h-full object-cover" />
                  <button
                    className="absolute top-1 right-1 h-6 w-6 rounded-full bg-red-600 text-white flex items-center justify-center opacity-90 hover:opacity-100"
                    title="Delete photo"
                    onClick={() => deletePhoto(p)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                  <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px] font-bold">#{p.displayOrder}</span>
                </div>
                <div className="p-2">
                  <p className="text-xs font-semibold text-[var(--mc-text-primary)] truncate">{p.title || 'Untitled'}</p>
                  {p.caption && <p className="text-[10px] text-muted-foreground line-clamp-2">{p.caption}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </PremiumModal>

      {/* Add photo modal */}
      <PremiumModal
        open={photoModal} onOpenChange={setPhotoModal} size="md"
        title={detail ? `Add Photo — ${detail.title}` : ''}
        icon={<Camera className="h-5 w-5" />}
        description="Upload or link a photo, then title & caption it"
        footerNote="Photos display in ascending display order"
        submitLabel="Add Photo"
        onSubmit={submitPhoto} submitting={photoBusy} secondaryLabel="Cancel"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field icon={<ImageIcon className="h-3.5 w-3.5" />} label="Photo" className="sm:col-span-2">
            <FileUploader value={pForm.imageUrl} onChange={url => setPForm(f => ({ ...f, imageUrl: url }))} module="GALLERY" label="Upload photo" />
          </Field>
          <Field icon={<Type className="h-3.5 w-3.5" />} label="Title">
            <McInput value={pForm.title} onChange={e => setPForm(f => ({ ...f, title: e.target.value }))} placeholder="Neonatal ICU" />
          </Field>
          <Field icon={<ArrowUpDown className="h-3.5 w-3.5" />} label="Display Order">
            <McInput type="number" value={pForm.displayOrder} onChange={e => setPForm(f => ({ ...f, displayOrder: e.target.value }))} />
          </Field>
          <Field icon={<CaptionsIcon className="h-3.5 w-3.5" />} label="Caption" className="sm:col-span-2">
            <McTextarea value={pForm.caption} onChange={e => setPForm(f => ({ ...f, caption: e.target.value }))} placeholder="Our neonatal team at work" />
          </Field>
        </div>
      </PremiumModal>

      <ConfirmModal
        open={confirmOpen} onOpenChange={o => { if (!o) { setConfirmOpen(false); setConfirmAction(null); } }}
        title="Confirm Deletion"
        message={confirmMsg}
        onConfirm={runConfirm} submitting={busy}
      />
    </div>
  );
}
