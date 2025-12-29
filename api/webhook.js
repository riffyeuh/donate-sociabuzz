import { Redis } from '@upstash/redis';
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const data = req.body;
    const payload = JSON.stringify({
      username: data.sender_name || "Seseorang",
      amount: parseInt(data.amount) || 0,
      message: data.message || "Pesan donasi"
    });
    await redis.lpush('donasi_queue', payload);
    return res.status(200).json({ status: 'Ok' });
  }

  if (req.method === 'GET') {
    // KUNCI PEMBERSIH ANTREAN: rpop akan mengambil DAN menghapus data dari Upstash
    const dataString = await redis.rpop('donasi_queue');
    return res.status(200).send(dataString || null);
  }
}
