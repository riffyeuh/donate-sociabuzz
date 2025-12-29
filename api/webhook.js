import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  // --- 1. MENERIMA DONASI BARU (POST) ---
  if (req.method === 'POST') {
    try {
      const data = req.body;
      const payload = JSON.stringify({
        username: data.sender_name || "Seseorang",
        amount: parseInt(data.amount) || 0,
        message: data.message || "Terima kasih!"
      });

      // Simpan ke antrean notifikasi & update skor papan peringkat
      await redis.lpush('donasi_queue', payload);
      await redis.zincrby('top_donors', parseInt(data.amount), data.sender_name || "Seseorang");
      
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
}
