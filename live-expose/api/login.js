import crypto from 'crypto';

function sign(payload) {
  const h = crypto.createHmac('sha256', process.env.OWNER_KEY).update(payload).digest('hex');
  return `${payload}.${h}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const { key } = req.body || {};

  if (!process.env.OWNER_KEY || key !== process.env.OWNER_KEY) {
    // Deliberate delay so guessing keys is slow, not free.
    await new Promise((r) => setTimeout(r, 600));
    return res.status(401).json({ error: 'wrong key' });
  }

  const expires = Date.now() + 1000 * 60 * 60 * 12; // 12 hours
  const token = sign(String(expires));

  res.setHeader(
    'Set-Cookie',
    `le_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${60 * 60 * 12}`
  );
  return res.status(200).json({ ok: true });
}
