import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
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

      await redis.lpush('donasi_queue', payload);
      // Mencatat total donasi ke leaderboard 'top_donors'
      await redis.zincrby('top_donors', amount, username);
      
      return res.status(200).json({ status: 'Ok' });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'GET' && req.query.type === 'leaderboard') {
    try {
      // Ambil Top 10
      const topData = await redis.zrange('top_donors', 0, 9, { rev: true, withScores: true });
      return res.status(200).json(topData);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }
}
