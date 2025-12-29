import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  // --- BAGIAN TERIMA DATA (POST) ---
  if (req.method === 'POST') {
    try {
      const data = req.body;
      const payload = {
        username: data.sender_name || "Seseorang",
        amount: parseInt(data.amount) || 0,
        message: data.message || "Pesan donasi",
        id: Date.now()
      };

      // KUNCI SUKSES: Pakai JSON.stringify agar tidak jadi [object Object]
      await redis.lpush('donasi_queue', JSON.stringify(payload));
      
      return res.status(200).json({ status: 'Sukses masuk antrean', data: payload });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // --- BAGIAN KIRIM KE ROBLOX (GET) ---
  if (req.method === 'GET') {
    try {
      const dataString = await redis.rpop('donasi_queue');
      
      if (!dataString) {
        return res.status(200).json(null); 
      }

      // Karena tadi sudah di-stringify, sekarang kita parse balik
      return res.status(200).json(JSON.parse(dataString));
    } catch (error) {
      console.error(error);
      return res.status(200).json({ error_debug: true, message: "Data rusak, dilewati." });
    }
  }
}
