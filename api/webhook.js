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

      // Sesuaikan variabelnya (Bagi-bagi biasanya pakai 'donator_name' atau 'name')
      const payload = JSON.stringify({
        username: data.donator_name || data.name || "Seseorang",
        amount: parseInt(data.amount) || 0,
        message: data.message || "Terima kasih!"
      });

      await redis.lpush('donasi_queue', payload);
      await redis.zincrby('top_donors', parseInt(data.amount) || 0, data.donator_name || data.name || "Seseorang");

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
