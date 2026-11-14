import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * UNIVERSAL IMAGE/FILE UPLOAD — used by FileUploader everywhere.
 * Accepts multipart/form-data (drag&drop, browse, compressed blobs).
 * Stores under public/uploads/{yyyy}/{mm}/ and journals a FileRecord.
 */
export const runtime = 'nodejs';

const MAX_BYTES = 12 * 1024 * 1024; // 12 MB safety cap
const ALLOWED_EXT: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.avif': 'image/avif',
  '.pdf': 'application/pdf', '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv', '.txt': 'text/plain', '.zip': 'application/zip',
  '.mp4': 'video/mp4', '.mp3': 'audio/mpeg',
};

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const user = auth.user;

  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const category = (form.get('category') as string) || 'general';
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: `File too large (max ${Math.round(MAX_BYTES / 1024 / 1024)}MB)` }, { status: 400 });
    }

    const ext = path.extname(file.name || '').toLowerCase() || '.bin';
    if (!ALLOWED_EXT[ext]) {
      return NextResponse.json({ error: `Unsupported file type: ${ext}` }, { status: 400 });
    }

    const now = new Date();
    const relDir = path.join('uploads', String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, '0'));
    const absDir = path.join(process.cwd(), 'public', relDir);
    await mkdir(absDir, { recursive: true });

    const id = crypto.randomBytes(9).toString('hex');
    const safeName = (file.name || 'upload').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-60);
    const fileName = `${id}-${safeName}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(absDir, fileName), buffer);

    const publicUrl = `/${relDir.split(path.sep).join('/')}/${fileName}`;

    // Journal the upload in the website file manager
    await db.fileRecord.create({
      data: {
        fileName,
        originalName: file.name || 'upload',
        url: publicUrl,
        mimeType: ALLOWED_EXT[ext],
        size: file.size,
        module: (category || 'GENERAL').toUpperCase().slice(0, 30),
        uploadedById: user.id,
      },
    }).catch(() => {/* non-fatal */});

    return NextResponse.json({ url: publicUrl, fileName, size: file.size, type: ALLOWED_EXT[ext] });
  } catch (err: unknown) {
    console.error('upload error', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
