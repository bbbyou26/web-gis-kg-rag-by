
// PROFILE LOGIC
(function () {
    const keluarBtn = document.getElementById('Keluar');
    if (keluarBtn) {
        keluarBtn.addEventListener('click', () => {
            window.location.href = '/logout';
        });
    }

    const profilBtn = document.getElementById('Profil');
    if (profilBtn) {
        profilBtn.addEventListener('click', () => {
            document.getElementById('profileEditOverlay').classList.remove('hidden');
            document.getElementById('profileWrapper').classList.remove('active');
        });
    }

    window.previewProfilePhoto = function (event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                document.getElementById('profilePreviewImg').src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    };

    const saveBtn = document.getElementById('saveProfileBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const name = document.getElementById('profileNameInput').value;
            const file = document.getElementById('profileFileInput').files[0];

            const formData = new FormData();
            formData.append('nama', name);
            if (file) formData.append('foto', file);

            saveBtn.disabled = true;
            saveBtn.innerText = "Menyimpan...";

            try {
                const res = await fetch('/api/user/update', {
                    method: 'POST',
                    body: formData
                });
                const json = await res.json();
                if (json.success) {
                    const newImgSrc = document.getElementById('profilePreviewImg').src;
                    document.querySelectorAll('.open-profile img, #imgProfile img').forEach(img => {
                        img.src = newImgSrc;
                    });
                    document.querySelectorAll('.nama').forEach(el => {
                        el.innerText = name;
                    });

                    document.getElementById('profileEditOverlay').classList.add('hidden');
                    if (typeof showToast === 'function') showToast("Profil diperbarui!", "success");
                } else {
                    alert("Gagal update profil: " + (json.error || "Unknown error"));
                }
            } catch (err) {
                console.error(err);
                alert("Terjadi kesalahan koneksi.");
            } finally {
                saveBtn.disabled = false;
                saveBtn.innerText = "Simpan Perubahan";
            }
        });
    }

    // Toggle Izinkan Akses checkbox state persistence
    const toggleIzinkanAkses = document.getElementById('toggleIzinkanAkses');
    if (toggleIzinkanAkses) {
        const savedState = localStorage.getItem('izinkanAksesChecked') === 'true';
        toggleIzinkanAkses.checked = savedState;

        toggleIzinkanAkses.addEventListener('change', (e) => {
            localStorage.setItem('izinkanAksesChecked', e.target.checked);
            if (typeof showToast === 'function') {
                showToast(e.target.checked ? "Izinkan Akses diaktifkan" : "Izinkan Akses dinonaktifkan", "info");
            }
        });
    }

    // Admin Overlay Logic
    window.togglePermissionOverlay = function () {
        const overlay = document.getElementById('permissionOverlay');
        if (!overlay) return;

        if (overlay.classList.contains('hidden')) {
            overlay.classList.remove('hidden');
            window.fetchPermissionRequests();
        } else {
            overlay.classList.add('hidden');
        }
    };

    window.fetchPermissionRequests = async function () {
        const container = document.getElementById('permissionRequestsList');
        if (!container) return;

        container.innerHTML = '<div style="text-align: center; color: #7a8a94; padding: 20px;">Memuat permintaan...</div>';

        try {
            const res = await fetch('/api/permission/requests');
            const data = await res.json();

            if (!data.requests || data.requests.length === 0) {
                container.innerHTML = '<div style="text-align: center; color: #7a8a94; padding: 20px;">Tidak ada permintaan akses baru.</div>';
                return;
            }

            container.innerHTML = data.requests.map(req => {
                const fotoSrc = req.foto ? `data:image/*;base64,${req.foto}` : '/static/image/icon/view.svg';
                return `
                    <div class="permission-request-card" id="req-${req.nama_akun}-${req.actor_id}">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="width: 45px; height: 45px; border-radius: 50%; overflow: hidden; background: #38a0c4; flex-shrink: 0; border: 1.5px solid #8d98e0;">
                                <img src="${fotoSrc}" style="width: 100%; height: 100%; object-fit: cover;" alt="Profile" />
                            </div>
                            <div style="display: flex; flex-direction: column; min-width: 0; flex: 1;">
                                <span style="font-size: 14px; font-weight: 700; color: #2c5d6b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${req.nama}</span>
                                <span style="font-size: 11px; color: #7a8a94;">@${req.nama_akun} &bull; ${req.tanggal}</span>
                            </div>
                        </div>
                        <div style="background: #fafcfd; border: 1px solid #eef2f4; border-radius: 10px; padding: 8px 12px; display: flex; flex-direction: column; gap: 2px;">
                            <span style="font-size: 11px; color: #7a8a94; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Aktor Marker</span>
                            <span style="font-size: 13px; font-weight: 600; color: #333;">${req.actor_name}</span>
                            <span style="font-size: 11px; color: #38a0c4; font-weight: 500;">ID: ${req.actor_id}</span>
                        </div>
                        <button class="btn-confirm-permission" onclick="window.confirmPermission('${req.nama_akun}', '${req.actor_id}', this)">Konfirmasi</button>
                    </div>
                `;
            }).join('');
        } catch (err) {
            console.error(err);
            container.innerHTML = '<div style="text-align: center; color: #ff6b6b; padding: 20px;">Gagal memuat permintaan.</div>';
        }
    };

    window.confirmPermission = async function (username, actorId, btn) {
        btn.disabled = true;
        btn.innerText = "Mengonfirmasi...";

        try {
            const res = await fetch('/api/permission/approve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nama_akun: username, actor_id: actorId })
            });
            const data = await res.json();

            if (data.success) {
                btn.innerText = "✓ Dikonfirmasi";
                btn.style.background = "#2ecc71";
                btn.style.boxShadow = "none";
                if (typeof showToast === 'function') {
                    showToast("Akses izin disetujui!", "success");
                }

                setTimeout(() => {
                    const card = document.getElementById(`req-${username}-${actorId}`);
                    if (card) {
                        card.style.transition = "all 0.4s ease";
                        card.style.opacity = "0";
                        card.style.transform = "scale(0.9)";
                        setTimeout(() => {
                            card.remove();
                            const container = document.getElementById('permissionRequestsList');
                            if (container && container.children.length === 0) {
                                container.innerHTML = '<div style="text-align: center; color: #7a8a94; padding: 20px;">Tidak ada permintaan akses baru.</div>';
                            }
                        }, 400);
                    }
                }, 800);
            } else {
                btn.disabled = false;
                btn.innerText = "Konfirmasi";
                if (typeof showToast === 'function') {
                    showToast("Gagal mengonfirmasi: " + (data.error || "error"), "error");
                }
            }
        } catch (err) {
            btn.disabled = false;
            btn.innerText = "Konfirmasi";
            console.error(err);
            if (typeof showToast === 'function') {
                showToast("Terjadi kesalahan koneksi.", "error");
            }
        }
    };
})();
