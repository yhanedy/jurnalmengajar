const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Connection string dari Neon DB
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// 1. POST: Simpan Jurnal KBM
app.post('/api/jurnal', async (req, res) => {
  const { nama_guru, mapel, kelas, jam_ke, materi, absensi, foto_url, lokasi_gps, latitude, longitude } = req.body;
  try {
    const query = `
      INSERT INTO jurnal_mengajar (nama_guru, mapel, kelas, jam_ke, materi, absensi, foto_url, lokasi_gps, latitude, longitude)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *;
    `;
    const values = [nama_guru, mapel, kelas, jam_ke, materi, absensi, foto_url, lokasi_gps, latitude, longitude];
    const result = await pool.query(query, values);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Gagal menyimpan ke database Neon' });
  }
});

// 2. GET: Ambil Data Jurnal KBM
app.get('/api/jurnal', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM jurnal_mengajar ORDER BY waktu DESC;');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil data dari database' });
  }
});

// 3. DELETE: Hapus Jurnal
app.delete('/api/jurnal/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM jurnal_mengajar WHERE id = $1;', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menghapus data' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
