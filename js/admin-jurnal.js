/* ==========================================================================
   SMAN 2 KARANGANYAR - ADMIN PANEL JURNAL KBM (SPLIT READ/WRITE EDITION)
   ========================================================================== */

let currentUserSession = null;

const PRESET_MAPEL_SMADA = [
    "Pendidikan Agama Islam", "Pendidikan Agama Kristen", "Pendidikan Agama Katolik",
    "Pendidikan Agama Hindu", "Pendidikan Agama Buddha", "Pendidikan Agama Konghucu",
    "PPKn", "Bahasa Indonesia", "Matematika", "Fisika", "Kimia", "Biologi",
    "Sosiologi", "Ekonomi", "Sejarah", "Geografi", "Bahasa Inggris", "PJOK",
    "Informatika", "Seni Rupa", "Seni Musik", "Seni Teater", "Seni Tari",
    "Matematika Lanjut", "Fisika Tk Lanjut", "Kimia Tk Lanjut", "Biologi Tk Lanjut",
    "Ekonomi Tk Lanjut", "Sosiologi Tk Lanjut", "Geografi Tk Lanjut", "Sejarah Tk Lanjut", "Antropologi"
];

const HARI_PIKET_LIST = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

let globalJurnalRecords = [];
let globalGuruList = [];
let masterJamAdmin = {};
let activeSelectedJam = 1;

// ============================================================================
// 1. VERIFIKASI SESI & OTORITAS ADMIN JURNAL
// ============================================================================
(function verifikasiAdminJurnal() {
    const ssoUrl = typeof PORTAL_SSO_URL !== 'undefined'
        ? PORTAL_SSO_URL
        : 'https://yhanedy.github.io/presensi-smandakra/index.html';

    const urlParams = new URLSearchParams(window.location.search);
    const ssoToken = urlParams.get('sso_token');

    if (ssoToken) {
        try {
            const decodedUser = JSON.parse(atob(decodeURIComponent(ssoToken)));
            if (decodedUser.t && (Date.now() - decodedUser.t > 120000)) {
                alert("Token SSO telah kadaluwarsa. Silakan login ulang.");
                window.location.replace(ssoUrl);
                return;
            }
            const formattedUser = {
                username: decodedUser.u || decodedUser.username,
                nama: decodedUser.n || decodedUser.nama,
                role: decodedUser.r || decodedUser.role,
                token: decodedUser.token || ''
            };
            localStorage.setItem('smada_user', JSON.stringify(formattedUser));
            if (formattedUser.token) localStorage.setItem('smada_token', formattedUser.token);
            currentUserSession = formattedUser;
            window.history.replaceState({}, document.title, window.location.pathname);
        } catch (e) {
            console.error("Token SSO Error:", e);
        }
    }

    const rawUser = localStorage.getItem('smada_user');
    if (rawUser && rawUser !== "null" && rawUser !== "undefined") {
        try {
            currentUserSession = JSON.parse(rawUser);
            const r = String(currentUserSession.role || '').toLowerCase().trim();
            const isAllowed = r === 'admin' || r === 'superadmin' || r === 'super_admin' || r === 'jurnal_admin' || r.includes('admin') || r.includes('jurnal');
            if (!currentUserSession.username || !isAllowed) {
                alert("Akses Ditolak! Anda tidak memiliki otoritas Administrator Jurnal.");
                window.location.replace('jurnal.html');
                return;
            }
            return;
        } catch (e) {
            localStorage.removeItem('smada_user');
        }
    }

    alert("Akses Terbatas! Silakan login melalui Portal SSO Presensi.");
    window.location.replace(ssoUrl);
})();

// ============================================================================
// 2. INISIALISASI HALAMAN
// ============================================================================
async function initHalamanAdminJurnal() {
    const todayWib = typeof getTanggalWIB === 'function'
        ? getTanggalWIB()
        : new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date());

    const inputTgl = document.getElementById('filterTanggalKbm');
    if (inputTgl) inputTgl.value = todayWib;

    renderAdminRoleSwitcher();
    await pastikanTabelPengaturan();
    await muatMasterJamAdmin();
    initJamGridFilter();
    await muatDeteksiBelumKbm();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHalamanAdminJurnal);
} else {
    initHalamanAdminJurnal();
}

async function pastikanTabelPengaturan() {
    try {
        await queryTurso(`CREATE TABLE IF NOT EXISTS jam_pelajaran (jam_ke INTEGER PRIMARY KEY, jam_mulai TEXT NOT NULL, jam_selesai TEXT NOT NULL)`, []);
        await queryTurso(`CREATE TABLE IF NOT EXISTS jadwal_piket (hari TEXT PRIMARY KEY, nama_piket TEXT DEFAULT '')`, []);
    } catch (_) {}
}

function logoutAdmin() {
    const ssoUrl = typeof PORTAL_SSO_URL !== 'undefined'
        ? PORTAL_SSO_URL
        : 'https://yhanedy.github.io/presensi-smandakra/index.html';
    localStorage.removeItem('smada_user');
    localStorage.removeItem('smada_token');
    window.location.replace(ssoUrl);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function normalizeKelas(val) {
    return String(val || '').replace(/\s+/g, ' ').trim();
}

// ============================================================================
// 3. NAVIGASI LINTAS ROLE (SSO SWITCHER)
// ============================================================================
function renderAdminRoleSwitcher() {
    const container = document.getElementById('adminRoleSwitcherDropdown');
    if (!container || !currentUserSession || typeof getRoleMenuItems !== 'function') return;

    const menus = getRoleMenuItems(currentUserSession);
    container.innerHTML = menus.map(m => {
        const href = m.external && typeof buildSsoTargetUrl === 'function'
            ? buildSsoTargetUrl(m.url, currentUserSession)
            : m.url;
        return `
            <a href="${href}" class="flex items-center gap-2.5 px-3.5 py-2.5 text-slate-800 hover:bg-blue-50 hover:text-blue-950 font-bold transition">
                <i class="fa-solid ${m.icon} w-4 text-center text-blue-900"></i>
                <span>${escapeHtml(m.label)}</span>
            </a>
        `;
    }).join('');
}

function toggleAdminRoleMenu() {
    const dd = document.getElementById('adminRoleSwitcherDropdown');
    if (dd) dd.classList.toggle('hidden');
}

document.addEventListener('click', (e) => {
    const wrapper = document.getElementById('adminRoleSwitcherWrapper');
    const dd = document.getElementById('adminRoleSwitcherDropdown');
    if (wrapper && dd && !wrapper.contains(e.target)) {
        dd.classList.add('hidden');
    }
});

// ============================================================================
// 4. NAVIGASI SUB-TAB & DETEKSI KELAS KOSONG (READ DARI SUPABASE)
// ============================================================================
function switchSubTab(subId) {
    document.querySelectorAll('.admin-subcontent').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(subId);
    if (target) target.classList.remove('hidden');

    document.querySelectorAll('.subtab-btn').forEach(b => {
        b.className = "subtab-btn px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-black transition cursor-pointer whitespace-nowrap";
    });
    const activeBtn = document.getElementById('btn-' + subId);
    if (activeBtn) {
        activeBtn.className = "subtab-btn px-4 py-2.5 rounded-xl bg-blue-950 text-white font-black shadow-sm transition cursor-pointer whitespace-nowrap";
    }

    if (subId === 'admBelumKbm') muatDeteksiBelumKbm();
    if (subId === 'admPlotting') muatAdminPlottingGuru();
    if (subId === 'admJadwalPengaturan') muatTabPengaturanJamDanPiket();
}

async function muatMasterJamAdmin() {
    try {
        const rows = await queryTurso('SELECT jam_ke, jam_mulai, jam_selesai FROM jam_pelajaran ORDER BY jam_ke ASC', []);
        masterJamAdmin = {};
        (rows || []).forEach(r => {
            masterJamAdmin[Number(r.jam_ke)] = {
                mulai: String(r.jam_mulai || '').trim(),
                selesai: String(r.jam_selesai || '').trim()
            };
        });
    } catch (_) {
        masterJamAdmin = {};
    }
}

function initJamGridFilter() {
    const container = document.getElementById('grid-filter-jam');
    if (!container) return;
    container.innerHTML = '';

    for (let i = 1; i <= 10; i++) {
        const slot = masterJamAdmin[i];
        const subText = slot && slot.mulai && slot.selesai ? `${slot.mulai}-${slot.selesai}` : '';
        const isActive = i === activeSelectedJam;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = isActive
            ? "py-2 px-1 font-black rounded-xl text-xs bg-blue-950 text-yellow-300 border-2 border-yellow-400 shadow-md transition cursor-pointer flex flex-col items-center"
            : "py-2 px-1 font-black rounded-xl text-xs bg-white text-slate-800 border-2 border-slate-300 hover:bg-yellow-100 transition cursor-pointer flex flex-col items-center";
        btn.innerHTML = `<span>Jam ${i}</span>${subText ? `<span class="text-[9px] font-mono ${isActive ? 'text-yellow-100' : 'text-slate-500'}">${subText}</span>` : ''}`;
        btn.onclick = () => pilihJamFilter(i);
        container.appendChild(btn);
    }
}

function pilihJamFilter(jamNumber) {
    activeSelectedJam = jamNumber;
    initJamGridFilter();
    muatDeteksiBelumKbm();
}

async function muatDeteksiBelumKbm() {
    const container = document.getElementById('grid-status-kelas');
    const tglSelected = document.getElementById('filterTanggalKbm')?.value;
    if (!container) return;

    container.innerHTML = '<p class="col-span-full text-xs text-slate-400 font-bold py-8 text-center"><i class="fa-solid fa-spinner fa-spin"></i> Memuat status KBM kelas...</p>';
    try {
        const [kelasData, allRecordsToday] = await Promise.all([
            queryTurso("SELECT DISTINCT kelas FROM siswa WHERE kelas IS NOT NULL AND TRIM(kelas) != '' ORDER BY kelas ASC", []),
            queryTurso("SELECT * FROM jurnal_kbm WHERE SUBSTRING(created_at, 1, 10) = ?", [tglSelected])
        ]);

        const unikKelas = [...new Set((kelasData || []).map(k => normalizeKelas(k.kelas)).filter(Boolean))]
            .sort((a, b) => a.localeCompare(b, 'id', { numeric: true }));

        globalJurnalRecords = (allRecordsToday || []).filter(j => {
            const jamArr = String(j.jam_ke || '').split(',').map(s => s.trim());
            return jamArr.includes(String(activeSelectedJam));
        });

        if (unikKelas.length === 0) {
            container.innerHTML = '<p class="col-span-full text-xs text-red-500 font-bold text-center">Data kelas tidak ditemukan di tabel siswa.</p>';
            return;
        }

        container.innerHTML = unikKelas.map(namaKelasClean => {
            const recordKbm = globalJurnalRecords.find(j => normalizeKelas(j.kelas).toUpperCase() === namaKelasClean.toUpperCase());
            const isTerisi = !!recordKbm;
            return `
                <div onclick="bukaModalDetailKelas('${escapeHtml(namaKelasClean)}', '${activeSelectedJam}', '${tglSelected}')"
                     class="p-3.5 rounded-2xl border-2 text-center transition cursor-pointer hover:scale-105 shadow-sm ${
                        isTerisi ? 'bg-gradient-to-br from-blue-950 to-indigo-900 border-blue-950 text-white hover:shadow-blue-900/30' : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100'
                     }">
                    <span class="block font-black text-sm sm:text-base tracking-wide">${escapeHtml(namaKelasClean)}</span>
                    <span class="block text-[11px] font-black uppercase mt-1 ${isTerisi ? 'text-yellow-300' : 'text-slate-400'}">
                        ${isTerisi ? '<i class="fa-solid fa-circle-check"></i> Terisi' : 'KOSONG'}
                    </span>
                </div>
            `;
        }).join('');
    } catch (err) {
        container.innerHTML = `<p class="col-span-full text-xs text-red-500 font-bold text-center">Error: ${escapeHtml(err.message)}</p>`;
    }
}

function formatTanggalIndo(dateStr) {
    if (!dateStr) return "-";
    const parts = String(dateStr).split('-').map(Number);
    if (parts.length !== 3) return dateStr;
    const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
    return dateObj.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function bukaModalDetailKelas(namaKelas, jamKe, tglStr) {
    const recordKbm = globalJurnalRecords.find(j => normalizeKelas(j.kelas).toUpperCase() === normalizeKelas(namaKelas).toUpperCase());
    const slot = masterJamAdmin[Number(jamKe)];
    const waktuInfo = slot && slot.mulai && slot.selesai ? ` (${slot.mulai} - ${slot.selesai})` : '';

    document.getElementById('modalDetailKelasJudul').innerText = `Jurnal KBM Kelas ${namaKelas}`;
    document.getElementById('modalDetailKelasSub').innerText = `${formatTanggalIndo(tglStr)} | Jam Ke-${jamKe}${waktuInfo}`;
    const contentModal = document.getElementById('modalDetailKelasContent');

    if (recordKbm) {
        contentModal.innerHTML = `
            <div class="bg-blue-50 p-3 rounded-2xl border border-blue-200 space-y-2">
                <div><span class="block text-[10px] font-black uppercase text-blue-900">Guru Pengampu</span><span class="font-black text-slate-900 text-sm"><i class="fa-solid fa-user text-blue-950"></i> ${escapeHtml(recordKbm.nama_guru)}</span></div>
                <div><span class="block text-[10px] font-black uppercase text-blue-900">Mata Pelajaran</span><span class="font-extrabold text-blue-950 text-xs">${escapeHtml(recordKbm.mapel)}</span></div>
                <div><span class="block text-[10px] font-black uppercase text-blue-900">Uraian Materi / Kegiatan</span><p class="font-medium text-slate-700 text-xs bg-white p-2.5 rounded-xl border border-blue-100">${escapeHtml(recordKbm.materi)}</p></div>
                <div><span class="block text-[10px] font-black uppercase text-blue-900">Siswa Tidak Hadir</span><span class="font-bold text-red-700 text-xs block bg-red-50 p-2 rounded-xl border border-red-200">${escapeHtml(recordKbm.absensi || 'Nihil (Hadir Semua)')}</span></div>
                ${recordKbm.foto_url ? `<div class="pt-1"><span class="block text-[10px] font-black uppercase text-blue-900 mb-1">Foto Kegiatan KBM</span><a href="${escapeHtml(recordKbm.foto_url)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl transition shadow"><i class="fa-solid fa-image"></i> Lihat Foto Google Drive</a></div>` : '<span class="text-slate-400 font-semibold italic text-[11px]">Tanpa lampiran foto.</span>'}
            </div>
        `;
    } else {
        contentModal.innerHTML = `
            <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center space-y-2">
                <i class="fa-solid fa-folder-open text-slate-300 text-3xl"></i>
                <p class="font-black text-slate-700 text-xs">Belum Ada Pengisian Jurnal KBM</p>
                <p class="text-[11px] text-slate-400 font-medium">Guru mata pelajaran belum menginput jurnal mengajar untuk kelas <b>${escapeHtml(namaKelas)}</b> pada Jam Ke-${jamKe}.</p>
            </div>
        `;
    }
    document.getElementById('modalDetailKelasKbm').classList.remove('hidden');
}

function tutupModalDetailKelas() {
    document.getElementById('modalDetailKelasKbm').classList.add('hidden');
}

// ============================================================================
// 5. PLOTTING MAPEL GURU (READ SUPABASE, WRITE TURSO)
// ============================================================================
async function muatAdminPlottingGuru() {
    const tbody = document.getElementById('tabel-adm-plotting');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-400 font-bold"><i class="fa-solid fa-spinner fa-spin"></i> Memuat data guru...</td></tr>';
    try {
        const [usersRows, lastLogRows] = await Promise.all([
            queryTurso('SELECT username, nama, role, mapel FROM users ORDER BY nama ASC', []),
            queryTurso('SELECT username_guru, MAX(created_at) AS terakhir_akses FROM jurnal_kbm GROUP BY username_guru', []).catch(() => [])
        ]);

        const lastAccessMap = {};
        (lastLogRows || []).forEach(r => {
            if (r.username_guru) lastAccessMap[String(r.username_guru).toLowerCase()] = r.terakhir_akses;
        });

        globalGuruList = (usersRows || []).map(u => ({
            ...u,
            terakhir_akses: lastAccessMap[String(u.username || '').toLowerCase()] || ''
        }));

        if (globalGuruList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-400 font-bold">Data guru tidak ditemukan.</td></tr>';
            return;
        }

        tbody.innerHTML = globalGuruList.map((g, index) => `
            <tr class="hover:bg-blue-50/50 border-b transition">
                <td class="p-3 font-mono font-bold text-slate-700">${escapeHtml(g.username)}</td>
                <td class="p-3 font-black text-slate-900">${escapeHtml(g.nama)}</td>
                <td class="p-3 text-blue-950 font-extrabold">${g.mapel ? escapeHtml(g.mapel) : '<span class="text-slate-400 font-normal italic">Belum di-set</span>'}</td>
                <td class="p-3 text-center font-bold text-xs ${g.terakhir_akses ? 'text-emerald-700' : 'text-slate-400'}">${g.terakhir_akses ? `<i class="fa-solid fa-clock text-emerald-600 mr-1"></i> ${escapeHtml(g.terakhir_akses)}` : '-'}</td>
                <td class="p-3 text-center">
                    <button onclick="bukaModalEditMapelByIndex(${index})" class="bg-blue-950 hover:bg-blue-900 text-white px-3 py-1.5 rounded-xl text-xs font-black shadow transition flex items-center gap-1 mx-auto cursor-pointer"><i class="fa-solid fa-pen-to-square text-yellow-300"></i> Set Mapel</button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-red-500 font-bold">Error: ${escapeHtml(err.message)}</td></tr>`;
    }
}

function bukaModalEditMapelByIndex(index) {
    const guru = globalGuruList[index];
    if (!guru) return;
    document.getElementById('edit-mapel-guru-username').value = guru.username;
    document.getElementById('edit-mapel-guru-nama').textContent = `${guru.nama} (${guru.username})`;
    const container = document.getElementById('container-checkbox-mapel');
    const activeMapelArr = (guru.mapel || '').split(',').map(m => m.trim());
    container.innerHTML = PRESET_MAPEL_SMADA.map(m => `
        <label class="flex items-center gap-2 cursor-pointer hover:bg-slate-100 p-1 rounded-lg transition">
            <input type="checkbox" value="${escapeHtml(m)}" ${activeMapelArr.includes(m) ? 'checked' : ''} class="cb-mapel-item rounded text-blue-900 w-4 h-4">
            <span class="text-slate-800">${escapeHtml(m)}</span>
        </label>
    `).join('');
    document.getElementById('modalEditMapelGuru').classList.remove('hidden');
}

function tutupModalEditMapel() {
    document.getElementById('modalEditMapelGuru').classList.add('hidden');
}

async function simpanPlottingMapelGuru() {
    const username = document.getElementById('edit-mapel-guru-username').value;
    const checkedMapel = Array.from(document.querySelectorAll('.cb-mapel-item:checked')).map(cb => cb.value);
    const mapelStr = checkedMapel.join(', ');
    try {
        await queryTurso('UPDATE users SET mapel = ? WHERE username = ?', [mapelStr, username]);
        alert("Plotting mapel guru berhasil diperbarui!");
        tutupModalEditMapel();
        muatAdminPlottingGuru();
    } catch (err) {
        alert("Gagal update mapel: " + err.message);
    }
}

// ============================================================================
// 6. PENGATURAN 10 JAM PELAJARAN & JADWAL GURU PIKET (WRITE KE TURSO)
// ============================================================================
async function muatTabPengaturanJamDanPiket() {
    await muatMasterJamAdmin();
    renderFormJamPelajaran();

    const [piketRows, guruRows] = await Promise.all([
        queryTurso('SELECT hari, nama_piket FROM jadwal_piket', []).catch(() => []),
        queryTurso('SELECT nama, username FROM users ORDER BY nama ASC', []).catch(() => [])
    ]);

    const piketMap = {};
    (piketRows || []).forEach(r => {
        piketMap[String(r.hari || '').trim()] = String(r.nama_piket || '').trim();
    });

    renderFormJadwalPiket(piketMap);

    const selectQuick = document.getElementById('quickNamaGuruPiket');
    if (selectQuick) {
        selectQuick.innerHTML = '<option value="">-- Pilih Nama Guru --</option>' +
            (guruRows || []).map(g => `<option value="${escapeHtml(g.nama)}">${escapeHtml(g.nama)}</option>`).join('');
    }
}

function renderFormJamPelajaran() {
    const container = document.getElementById('containerInputJamPelajaran');
    if (!container) return;
    let html = '';
    for (let i = 1; i <= 10; i++) {
        const slot = masterJamAdmin[i] || { mulai: '', selesai: '' };
        html += `
            <div class="flex items-center justify-between gap-3 bg-white border border-slate-200 px-3.5 py-2 rounded-xl">
                <span class="font-black text-xs text-blue-950 w-20">Jam ${i} :</span>
                <div class="flex items-center gap-2 flex-1 justify-end">
                    <input type="time" id="jam-mulai-${i}" value="${escapeHtml(slot.mulai)}" class="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 bg-slate-50 focus:border-blue-600 outline-none">
                    <span class="font-black text-slate-400">-</span>
                    <input type="time" id="jam-selesai-${i}" value="${escapeHtml(slot.selesai)}" class="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 bg-slate-50 focus:border-blue-600 outline-none">
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
}

async function simpanSemuaJamPelajaran() {
    const btn = document.getElementById('btnSimpanJam');
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...`;

    try {
        for (let i = 1; i <= 10; i++) {
            const mulai = document.getElementById(`jam-mulai-${i}`)?.value.trim() || '';
            const selesai = document.getElementById(`jam-selesai-${i}`)?.value.trim() || '';
            await queryTurso(
                `INSERT INTO jam_pelajaran (jam_ke, jam_mulai, jam_selesai)
                 VALUES (?, ?, ?)
                 ON CONFLICT (jam_ke) DO UPDATE SET
                 jam_mulai = excluded.jam_mulai,
                 jam_selesai = excluded.jam_selesai`,
                [i, mulai, selesai]
            );
        }
        await muatMasterJamAdmin();
        initJamGridFilter();
        alert("Pengaturan 10 Jam Pembelajaran berhasil disimpan!");
    } catch (err) {
        alert("Gagal menyimpan jam pembelajaran: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-floppy-disk text-yellow-300"></i> Simpan Jam`;
    }
}

function renderFormJadwalPiket(piketMap) {
    const container = document.getElementById('containerInputJadwalPiket');
    if (!container) return;
    container.innerHTML = HARI_PIKET_LIST.map(hari => `
        <div class="bg-white border border-slate-200 p-3 rounded-xl space-y-1.5">
            <label class="block text-xs font-black text-blue-950 uppercase">${hari}</label>
            <textarea id="input-piket-${hari}" rows="2" placeholder="Contoh: Drs. Budi Santoso, Siti Aminah, S.Pd."
                class="w-full border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-800 bg-slate-50 focus:bg-white focus:border-blue-600 outline-none">${escapeHtml(piketMap[hari] || '')}</textarea>
        </div>
    `).join('');
}

function tambahGuruKeJadwalPiket() {
    const hari = document.getElementById('quickHariPiket')?.value;
    const namaGuru = document.getElementById('quickNamaGuruPiket')?.value.trim();
    if (!hari || !namaGuru) return;

    const textarea = document.getElementById(`input-piket-${hari}`);
    if (!textarea) return;
    const existing = textarea.value.split(/\r?\n|,/).map(s => s.trim()).filter(Boolean);
    if (!existing.includes(namaGuru)) {
        existing.push(namaGuru);
        textarea.value = existing.join(', ');
    }
}

async function simpanSemuaJadwalPiket() {
    const btn = document.getElementById('btnSimpanPiket');
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...`;

    try {
        for (const hari of HARI_PIKET_LIST) {
            const rawVal = document.getElementById(`input-piket-${hari}`)?.value || '';
            const cleaned = rawVal.split(/\r?\n|,/).map(s => s.trim()).filter(Boolean).join(', ');
            await queryTurso(
                `INSERT INTO jadwal_piket (hari, nama_piket)
                 VALUES (?, ?)
                 ON CONFLICT (hari) DO UPDATE SET
                 nama_piket = excluded.nama_piket`,
                [hari, cleaned]
            );
        }
        alert("Jadwal Guru Piket Harian berhasil disimpan!");
    } catch (err) {
        alert("Gagal menyimpan jadwal piket: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-floppy-disk text-yellow-300"></i> Simpan Piket`;
    }
}
