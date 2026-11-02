// KONFIGURASI API GATEWAY CLOUDFLARE WORKER (REPOSITORI JURNAL MENGAJAR)
const API_WORKER_URL = "https://smada-api-gateway.yhanedy.workers.dev/api/query";

/**
 * Fungsi pembantu eksekusi SQL kueri ke Turso via Cloudflare Worker Proxy
 * @param {string} sql - Perintah SQL
 * @param {Array} params - Parameter array untuk query
 */
async function queryTurso(sql, params = []) {
    try {
        const response = await fetch(API_WORKER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sql: sql,
                args: params
            })
        });

        if (!response.ok) {
            const errJson = await response.json().catch(() => ({}));
            throw new Error(errJson.error || `Server Error (${response.status})`);
        }

        return await response.json();
    } catch (err) {
        console.error("Gagal terhubung ke API Backend Serverless:", err);
        throw err;
    }
}
