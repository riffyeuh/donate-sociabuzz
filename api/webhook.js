import { Redis } from '@upstash/redis';

// Koneksi ke Upstash
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  // --- BAGIAN 1: MENERIMA DARI SOCIABUZZ (Metode POST) ---
  if (req.method === 'POST') {
    try {
      const data = req.body;

      // Cek apakah data valid (Format Sociabuzz)
      // Sociabuzz mengirim: message, amount, sender_name, dll
      if (!data || !data.amount) {
        return res.status(400).json({ error: 'Data tidak valid' });
      }

      // Rapikan data untuk Roblox
      const payload = {
        username: data.sender_name || "Seseorang",
        amount: parseInt(data.amount) || 0, // Pastikan angka
        message: data.message || "Tidak ada pesan",
        id: Date.now() // ID unik sederhana
      };

      // Masukkan ke antrean (List) di Redis bernama 'donasi_queue'
      await redis.lpush('donasi_queue', JSON.stringify(payload));

      return res.status(200).json({ status: 'Masuk antrean', data: payload });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Gagal menyimpan data' });
    }
  }

  // --- BAGIAN 2: DIKIRIM KE ROBLOX (Metode GET) ---
  if (req.method === 'GET') {
    // Ambil data paling lama dari antrean (FIFO - First In First Out)
    // RPOP akan menghapus data dari Redis setelah diambil, jadi tidak akan double
    const dataString = await redis.rpop('donasi_queue');

    if (!dataString) {
      // Jika kosong, kirim null agar Roblox tau tidak ada donasi baru
      return res.status(200).json(null);
    }

    // Kirim data donasi ke Roblox
    return res.status(200).json(JSON.parse(dataString));
  }

  // Jika metode lain
  return res.status(405).json({ error: 'Method not allowed' });
}