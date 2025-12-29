import { Redis } from '@upstash/redis';

// Cek apakah env variable terbaca
if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  console.error("Environment Variables Missing!");
}

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  // --- BAGIAN 1: MENERIMA DARI SOCIABUZZ (POST) ---
  if (req.method === 'POST') {
    try {
      const data = req.body;
      const payload = {
        username: data.sender_name || "Seseorang",
        amount: parseInt(data.amount) || 0,
        message: data.message || "Tidak ada pesan",
        id: Date.now()
      };

      await redis.lpush('donasi_queue', JSON.stringify(payload));
      return res.status(200).json({ status: 'Masuk antrean', data: payload });

    } catch (error) {
      console.error("Error POST:", error);
      return res.status(500).json({ error: 'Gagal simpan: ' + error.message });
    }
  }

  // --- BAGIAN 2: DIKIRIM KE ROBLOX (GET) ---
  if (req.method === 'GET') {
    try {
      // Kita bungkus dalam try-catch agar tahu jika ada error koneksi
      const dataString = await redis.rpop('donasi_queue');

      if (!dataString) {
        return res.status(200).json(null);
      }

      return res.status(200).json(JSON.parse(dataString));

    } catch (error) {
      // PENTING: Jika error, kirim status 200 tapi isinya pesan error
      // supaya bisa terbaca di Output Roblox
      console.error("Error GET:", error);
      return res.status(200).json({ 
        error_debug: true, 
        message: error.message,
        stack: error.stack
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
