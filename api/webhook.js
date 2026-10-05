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
    console.log('BODY:', JSON.stringify(data));
    console.log('HEADERS:', JSON.stringify(req.headers));

    // BagiBagi kirim 'donator_name' / 'name'; tes via reqbin boleh pakai 'username'.
    const donorName = data.donator_name || data.name || data.username || "Seseorang";
    const amount = parseInt(data.amount) || 0;
    const payload = JSON.stringify({
      username: donorName,
      amount: amount,
      message: data.message || "Terima kasih!"
    });

    await redis.lpush('donasi_queue', payload);
    await redis.zincrby('top_donors', amount, donorName);

    return res.status(200).json({ status: 'Ok' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

  // --- 2. LOGIKA MENGAMBIL DATA (GET) ---
  if (req.method === 'GET') {
    // Jalur A: Ambil data Papan Peringkat (?type=leaderboard)
    if (req.query.type === 'leaderboard') {
      const topData = await redis.zrange('top_donors', 0, 29, { rev: true, withScores: true });
      return res.status(200).json(topData);
    }

    // Jalur B: Ambil data Notifikasi (Tanpa query)
    const dataString = await redis.rpop('donasi_queue');
    if (!dataString) return res.status(200).json(null);
    return res.status(200).send(dataString);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
