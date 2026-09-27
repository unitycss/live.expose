import { put, del, list } from '@vercel/blob';
import crypto from 'crypto';

const MANIFEST_PATH = 'live-expose/manifest.json';

async function getManifest() {
  try {
    const { blobs } = await list({ prefix: MANIFEST_PATH });
    const found = blobs.find((b) => b.pathname === MANIFEST_PATH);
    if (!found) return [];
    const res = await fetch(found.url, { cache: 'no-store' });
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.error('getManifest failed', err);
    return [];
  }
}

async function saveManifest(items) {
  await put(MANIFEST_PATH, JSON.stringify(items), {
    access: 'public',
    contentType: 'application/json',
    allowOverwrite: true,
  });
}

function checkOwner(req) {
  if (!process.env.OWNER_KEY) return false;
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(/(?:^|;\s*)le_session=([^;]+)/);
  if (!match) return false;

  const token = decodeURIComponent(match[1]);
  const dotIndex = token.lastIndexOf('.');
  if (dotIndex === -1) return false;

  const payload = token.slice(0, dotIndex);
  const sig = token.slice(dotIndex + 1);
  const expected = crypto.createHmac('sha256', process.env.OWNER_KEY).update(payload).digest('hex');

  const sigBuf = Buffer.from(sig, 'hex');
  const expBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return false;

  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

  return true;
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const items = await getManifest();
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(items);
  }

  if (!checkOwner(req)) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  if (req.method === 'POST') {
    const { name, category, fileBase64, fileType } = req.body || {};
    if (!fileBase64) return res.status(400).json({ error: 'missing file' });

    const buffer = Buffer.from(fileBase64, 'base64');
    if (buffer.length > 4 * 1024 * 1024) {
      return res.status(413).json({ error: 'file too large (4MB limit)' });
    }

    const id = 'img_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const ext = (fileType && fileType.split('/')[1]) || 'jpg';

    const blob = await put(`live-expose/images/${id}.${ext}`, buffer, {
      access: 'public',
      contentType: fileType || 'image/jpeg',
    });

    const record = {
      id,
      url: blob.url,
      name: (name || 'Untitled').trim(),
      category: (category || 'uncategorized').trim().toLowerCase(),
      createdAt: Date.now(),
    };

    const items = await getManifest();
    items.unshift(record);
    await saveManifest(items);

    return res.status(200).json(record);
  }

  if (req.method === 'DELETE') {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'missing id' });

    const items = await getManifest();
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) return res.status(404).json({ error: 'not found' });

    const [removed] = items.splice(idx, 1);
    try {
      await del(removed.url);
    } catch (err) {
      console.error('blob delete failed', err);
    }
    await saveManifest(items);

    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).json({ error: 'method not allowed' });
}
