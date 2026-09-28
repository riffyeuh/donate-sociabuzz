import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Token rahasia: wajib dikirim tiap request (kecuali bisa dimatikan darurat).
// Cara kirim: header "Authorization: Bearer <token>" ATAU query "?token=<token>".
// Token asli disimpan di Vercel env `WEBHOOK_SECRET`, JANGAN hardcode di sini.
function isAuthorized(req) {
  const expected = process.env.WEBHOOK_SECRET;
  if (!expected) return true; // darurat: env belum dipasang -> terima semua (log warning)
  const header = req.headers.authorization || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : null;
  const query = req.query.token || null;
  return bearer === expected || query === expected;
}

// Ambil field pertama yang ada dari daftar nama kemungkinan.
// Platform donasi beda-beda nama field-nya (BagiBagi, SociaBuzz, Saweria, dll).
function pick(data, names) {
  if (!data || typeof data !== 'object') return undefined;
  for (const n of names) {
    const v = data[n];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  // Coba juga satu level nested (mis. data.data.nama)
  for (const key of Object.keys(data)) {
    const v = data[key];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const found = pick(v, names);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

const NAME_FIELDS = ["donator_name", "name", "supporter_name", "supporter", "from_name",
  "donor_name", "donatur", "donor", "nama", "username", "display_name"];
const AMOUNT_FIELDS = ["amount_raw", "amount", "gross_amount", "nominal", "price",
  "quantity", "total", "jumlah", "value"];
const MESSAGE_FIELDS = ["message", "pesan", "supporter_message", "note", "comment",
  "description", "msg", "support_message"];

export default async function handler(req, res) {
  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!process.env.WEBHOOK_SECRET) {
    console.warn('[webhook] WEBHOOK_SECRET belum dipasang — auth nonaktif!');
  }

  // --- 1. MENERIMA DONASI BARU (POST) ---
  if (req.method === 'POST') {
    try {
      const data = req.body;
      const username = String(pick(data, NAME_FIELDS) || "Seseorang").slice(0, 100);
      const amount = parseInt(pick(data, AMOUNT_FIELDS)) || 0;
      const message = String(pick(data, MESSAGE_FIELDS) || "Terima kasih!").slice(0, 500);

      const payload = JSON.stringify({ username, amount, message });

      await redis.lpush('donasi_queue', payload);
      await redis.zincrby('top_donors', amount, username);

      return res.status(200).json({ status: 'Ok' });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // --- 2. LOGIKA MENGAMBIL DATA (GET) ---
  if (req.method === 'GET') {
    // Jalur A: Ambil data Papan Peringkat (?type=leaderboard)
    if (req.query.type === 'leaderboard') {
      const topData = await redis.zrange('top_donors', 0, 9, { rev: true, withScores: true });
      return res.status(200).json(topData);
    }

    // Jalur B: Ambil data Notifikasi (Tanpa query)
    const dataString = await redis.rpop('donasi_queue');
    if (!dataString) return res.status(200).json(null);
    return res.status(200).send(dataString);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
