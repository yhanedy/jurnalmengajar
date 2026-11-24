// =========================================================================
// KONFIGURASI API GATEWAY CLOUDFLARE WORKER (SPLIT READ/WRITE EDITION)
// =========================================================================
const API_WORKER_URL = "https://smada-api-gateway.yhanedy.workers.dev/api/query";
const PORTAL_UTAMA_BASE = "https://yhanedy.github.io/presensi-smandakra";
const PORTAL_SSO_URL = `${PORTAL_UTAMA_BASE}/index.html`;

async function queryTurso(sql, params = []) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    let token = localStorage.getItem('smada_token') || '';
    if (!token) {
        const userSession = localStorage.getItem('smada_user');
        if (userSession) {
            try {
                const user = JSON.parse(userSession);
                token = user.token || '';
            } catch (_) {}
        }
    }

    try {
        const response = await fetch(API_WORKER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({ sql, params }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            if (response.status === 401) {
                alert("Sesi Anda telah berakhir. Silakan login ulang.");
                localStorage.removeItem('smada_user');
                localStorage.removeItem('smada_token');
                window.location.replace(PORTAL_SSO_URL);
                return [];
            }
            const errJson = await response.json().catch(() => ({}));
            throw new Error(errJson.error || `Server Error (${response.status})`);
        }

        const data = await response.json().catch(() => ({}));
        if (data && data.success === false && data.error) {
            throw new Error(data.error);
        }

        if (Array.isArray(data)) return data;
        if (data.rows && Array.isArray(data.rows)) return data.rows;
        if (data.results && Array.isArray(data.results)) return data.results;
        if (data.data && Array.isArray(data.data)) return data.data;
        return [];
    } catch (err) {
        clearTimeout(timeoutId);
        console.error("Gagal terhubung ke API Backend:", err);
        if (err.name === 'AbortError') throw new Error("Koneksi terputus (Timeout). Sinyal internet lemah.");
        if (err.message && err.message.includes('Failed to fetch')) throw new Error("Gagal terhubung ke server.");
        throw err;
    }
}

const apiQuery = queryTurso;

// =========================================================================
// HELPER WAKTU WIB & NAVIGASI LINTAS ROLE (SSO)
// =========================================================================
function getTanggalWIB() {
    try {
        return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date());
    } catch (_) {
        const wib = new Date(Date.now() + 7 * 60 * 60 * 1000);
        return `${wib.getUTCFullYear()}-${String(wib.getUTCMonth() + 1).padStart(2, '0')}-${String(wib.getUTCDate()).padStart(2, '0')}`;
    }
}

function getJamWIB() {
    try {
        return new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Jakarta',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        }).format(new Date());
    } catch (_) {
        const now = new Date();
        return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    }
}

function getNamaHariIndo(dateStr) {
    const hariArr = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const parts = String(dateStr || getTanggalWIB()).split('-');
    if (parts.length !== 3) return 'Senin';
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return hariArr[d.getDay()] || 'Senin';
}

function buildSsoTargetUrl(targetUrl, sessionUser) {
    if (!sessionUser) return targetUrl;
    try {
        const payload = {
            u: sessionUser.username,
            n: sessionUser.nama,
            r: sessionUser.role,
            token: sessionUser.token || localStorage.getItem('smada_token') || '',
            t: Date.now()
        };
        const encoded = encodeURIComponent(btoa(JSON.stringify(payload)));
        const sep = targetUrl.includes('?') ? '&' : '?';
        return `${targetUrl}${sep}sso_token=${encoded}`;
    } catch (_) {
        return targetUrl;
    }
}

function getRoleMenuItems(sessionUser) {
    const r = String(sessionUser?.role || '').toLowerCase();
    const items = [];

    if (r.includes('admin') || r.includes('superadmin') || r.includes('super_admin')) {
        items.push({ label: 'Admin Presensi', icon: 'fa-sliders', url: `${PORTAL_UTAMA_BASE}/admin.html`, external: true });
        items.push({ label: 'Admin Jurnal', icon: 'fa-user-shield', url: 'admin-jurnal.html', external: false });
        items.push({ label: 'Pos Guru Piket', icon: 'fa-clipboard-user', url: `${PORTAL_UTAMA_BASE}/piket.html`, external: true });
        items.push({ label: 'Portal Guru BK', icon: 'fa-user-doctor', url: `${PORTAL_UTAMA_BASE}/bk.html`, external: true });
    } else {
        if (r.includes('piket')) {
            items.push({ label: 'Pos Guru Piket', icon: 'fa-clipboard-user', url: `${PORTAL_UTAMA_BASE}/piket.html`, external: true });
        }
        if (r.includes('bk')) {
            items.push({ label: 'Portal Guru BK', icon: 'fa-user-doctor', url: `${PORTAL_UTAMA_BASE}/bk.html`, external: true });
        }
        if (r.includes('jurnal')) {
            items.push({ label: 'Admin Jurnal', icon: 'fa-user-shield', url: 'admin-jurnal.html', external: false });
        }
    }

    items.push({ label: 'Jurnal Mengajar', icon: 'fa-book-open', url: 'jurnal.html', external: false });
    items.push({ label: 'Beranda Portal SSO', icon: 'fa-house', url: `${PORTAL_UTAMA_BASE}/index.html`, external: true });
    return items;
}
