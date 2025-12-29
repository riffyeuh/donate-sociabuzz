import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  // 1. TERIMA DATA (POST)
  if (req.method === 'POST') {
    try {
      const data = req.body;
      const username = data.sender_name || "Seseorang";
      const amount = parseInt(data.amount) || 0;

      const payload = JSON.stringify({
        username: username,
        amount: amount,
        message: data.message || "Pesan donasi"
      });

      // Simpan untuk Notifikasi
      await redis.lpush('donasi_queue', payload);
      
      // Simpan ke Papan Peringkat (Sorted Set)
      // Perintah ini akan menambah total donasi jika orangnya sama
      await redis.zincrby('top_donors', amount, username);
      
      return res.status(200).json({ status: 'Ok' });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // 2. AMBIL DATA UNTUK NOTIFIKASI (GET - Digunakan script lama kamu)
  if (req.method === 'GET' && !req.query.type) {
    try {
      const dataString = await redis.rpop('donasi_queue');
      if (!dataString) return res.status(200).json(null);
      return res.status(200).send(dataString);
    } catch (e) {
      return res.status(200).json(null);
    }
  }

  // 3. AMBIL DATA UNTUK PAPAN TOP DONOR (GET ?type=leaderboard)
  if (req.method === 'GET' && req.query.type === 'leaderboard') {
    try {
      // Ambil Top 10 besar
      const topData = await redis.zrange('top_donors', 0, 9, { rev: true, withScores: true });
      return res.status(200).json(topData);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }
}
