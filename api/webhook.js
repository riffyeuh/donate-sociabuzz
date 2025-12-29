import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  // 1. TERIMA DATA DARI SOCIABUZZ (POST)
  if (req.method === 'POST') {
    try {
      const data = req.body;
      const payload = JSON.stringify({
        username: data.sender_name || "Seseorang",
        amount: parseInt(data.amount) || 0,
        message: data.message || "Pesan donasi"
      });

      await redis.lpush('donasi_queue', payload);
      return res.status(200).json({ status: 'Ok' });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // 2. KIRIM DATA KE ROBLOX (GET)
  if (req.method === 'GET') {
    try {
      const dataString = await redis.rpop('donasi_queue');
      if (!dataString) return res.status(200).json(null);
      
      // Kirim apa adanya, jangan di-parse di server agar aman
      return res.status(200).send(dataString);
    } catch (e) {
      return res.status(200).json(null);
    }
  }
}
