window.userPermissions = [];

// Global references for location confirmation
let draggingMarker = null;
let lastMarkerPos = null;

// Funsi untuk membuat icon actor
function createActorIcon(iconUrl) {
  return L.icon({
    iconUrl: iconUrl,
    iconSize: [50, 50],
    iconAnchor: [25, 25],
    popupAnchor: [0, -25]
  });
}

// Simpan semua marker yang aktif di map
window.actorMarkers = []; // global so it can be filtered

// Ambil semua gambar actor
const actorImages = document.querySelectorAll(".actor-main img");

actorImages.forEach((img) => {
  img.addEventListener("click", (e) => {
    const actorDiv = img.closest(".actor-main");
    const actorId = actorDiv.id;

    // Biarkan aktorLokasi diproses oleh draw_lokasi.js
    if (actorId === "aktorLokasi") return;

    e.stopPropagation();

    let iconUrl = "";
    if (actorId === "aktorUsaha") iconUrl = "/static/image/actor/usaha.svg";

    if (!iconUrl) return;

    if (!window.isAdmin) {
      showToast("Hanya Admin yang bisa membuat aktor.", "error");
      return;
    }

    const uniqueId = Math.random().toString(36).substr(2, 6).toUpperCase();
    const marker = L.marker(map.getCenter(), {
      icon: createActorIcon(iconUrl),
      draggable: true,
    }).addTo(map);

    marker.actorType = actorId;
    marker.uniqueId = uniqueId;
    window.actorMarkers.push(marker);

    // Initial content
    const actorName = actorDiv.querySelector("span").innerText.replace(/[\n\r]/g, ' ').trim();
    marker.actorData = {
      "Nama Usaha": actorName,
      "Nama": actorName,
      "Notes": "",
      "Catatan": "",
      "Deskripsi": ""
    };

    marker.bindPopup(() => getPopupContent(marker.actorData, marker.actorType, marker.uniqueId));
    window.saveToNeo4j(marker); // REAL TIME SAVE ON CREATION

    // Drag events
    marker.on('dragstart', function (e) {
      lastMarkerPos = marker.getLatLng();
    });

    marker.on('dragend', function (e) {
      draggingMarker = marker;
      document.getElementById('locationOverlay').classList.remove('hidden');
      updateMarkerCoords(marker);
    });

    // Update coords when popup opens
    marker.on('popupopen', () => updateMarkerCoords(marker));

    updateMarkerCoords(marker);
  });
});

window.getPopupContent = function (data, actorId, uniqueId = '') {
  const actorName = data["Nama"] || data["Nama Usaha"] || data["nama"] || "Aktor Tanpa Nama";
  const photo = data["Foto Visual Path"] || '';
  const notes = data["Notes"] || data["Catatan"] || data["catatan"] || '';
  const description = data["Deskripsi"] || data["deskripsi"] || '';
  const showTestBtn = (actorId === "aktorUsaha");

  const photoHtml = photo ? `
    <div class="actor-photo-container" onclick="window.openPhotoModal(this.querySelector('img').src)" style="cursor: pointer;">
       <img src="${photo}" class="actor-overview-photo" alt="Photo" />
    </div>` : '';

  const notesHtml = notes ? `
    <div class="actor-notes-card collapsed" onclick="window.toggleNotes(this)">
       <div class="notes-header">
         <img src="/static/image/icon/edit.svg" class="notes-icon">
         <span>Notes</span>
         <i class="notes-toggle-icon">▼</i>
       </div>
       <div class="notes-text">${notes}</div>
    </div>` : '';

  const canEdit = window.isAdmin || (window.userPermissions && window.userPermissions.includes(uniqueId));
  const isIzinkanAksesChecked = localStorage.getItem('izinkanAksesChecked') === 'true';

  return `
    <div class="actor-popup" data-actor-id="${actorId}" data-unique-id="${uniqueId}">
      <div class="actor-popup-header">
        ${actorName}
        <span class="actor-popup-details-icon">?</span>
      </div>
      <div class="actor-popup-body">
        ${description ? `<div class="actor-popup-content">${description}</div>` : ''}
        ${photoHtml}
        ${notesHtml}

        ${actorId !== 'aktorLokasi' ? `
        <div class="actor-location-wrapper-minimal">
          <div class="loc-row">
            <span class="actor-coord">Menghubungkan...</span>
          </div>
          <div class="loc-row address-row">
            <span class="actor-address">Mencari alamat...</span>
          </div>
        </div>` : ''}
      </div>
      <div class="actor-popup-actions">
        <button class="actor-btn view-actor" onclick="window.location.href='/landing_page_builder.html?actor_id=${uniqueId}'"><img src="/static/image/icon/view.svg" class="emoji-img"></button>
        ${(isIzinkanAksesChecked && !window.isAdmin && (!window.userPermissions || !window.userPermissions.includes(uniqueId))) ? `
        <button class="actor-btn request-permission" onclick="window.requestPermission('${uniqueId}', '${actorName.replace(/'/g, "\\'")}')"><img src="/static/image/icon/access.svg" class="emoji-img" title="Minta Akses"></button>
        ` : ''}
        ${canEdit ? `
        <button class="actor-btn edit-actor" onclick="openEditOverlay('${actorId}', '${uniqueId}')"><img src="/static/image/icon/edit.svg" class="emoji-img"></button>
        ` : ''}
        ${window.isAdmin ? `
        <button class="actor-btn delete-actor" onclick="window.deleteMarker(this)"><img src="/static/image/icon/delete.svg" class="emoji-img"></button>
        ` : ''}
      </div>
    </div>
    `;
}

window.requestPermission = function (actorId, actorName) {
  fetch('/api/permission/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actor_id: actorId, actor_name: actorName })
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        if (typeof showToast === 'function') {
          showToast("admin akan menyetujui permintaan anda", "info");
        } else {
          alert("admin akan menyetujui permintaan anda");
        }
      } else {
        if (typeof showToast === 'function') {
          showToast("Gagal meminta akses: " + (data.error || "error"), "error");
        }
      }
    })
    .catch(err => {
      console.error(err);
      if (typeof showToast === 'function') {
        showToast("Gagal meminta akses.", "error");
      }
    });
};

window.toggleNotes = function (card) {
  card.classList.toggle('collapsed');
};

window.openPhotoModal = function (src) {
  const overlay = document.getElementById('photoOverlay');
  const img = document.getElementById('fullPhoto');
  if (overlay && img && src) {
    img.src = src;
    overlay.classList.remove('hidden');
  }
};

window.updateMarkerCoords = async function (marker) {
  const ll = marker.getLatLng();
  const popup = marker.getPopup();
  if (!popup) return;

  const updateUI = (coords, address) => {
    const el = popup.getElement();
    if (el) {
      if (coords) {
        const coordDiv = el.querySelector('.actor-coord');
        if (coordDiv) coordDiv.innerText = coords;
      }
      if (address) {
        const addressDiv = el.querySelector('.actor-address');
        if (addressDiv) addressDiv.innerText = address;
      }
    }
  };

  updateUI(`${ll.lat.toFixed(6)}, ${ll.lng.toFixed(6)}`, null);

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${ll.lat}&lon=${ll.lng}`);
    const data = await res.json();
    const address = data.display_name || "Alamat tidak ditemukan";
    if (marker.actorData) marker.actorData.address = address;
    updateUI(null, address);
  } catch (e) {
    console.error("Geocoding failed:", e);
  }
};

// Global functions for moderator.html
window.confirmLocation = function () {
  document.getElementById('locationOverlay').classList.add('hidden');
  updateMarkerCoords(draggingMarker);
  if (draggingMarker) window.saveToNeo4j(draggingMarker); // REAL TIME SAVE ON DRAG CONFIRM
  draggingMarker = null;
};

window.closeLocation = function () {
  if (draggingMarker && lastMarkerPos) {
    draggingMarker.setLatLng(lastMarkerPos);
  }
  document.getElementById('locationOverlay').classList.add('hidden');
  draggingMarker = null;
};

window.pendingDeleteBtn = null; // Changed to global window object

window.deleteMarker = function (btn) {
  window.pendingDeleteBtn = btn;
  document.getElementById('deleteConfirmOverlay').classList.remove('hidden');
};

window.confirmDeleteMarker = function () {
  if (window.pendingDeleteBtn) {
    const actorPopup = window.pendingDeleteBtn.closest('.actor-popup');
    const uniqueId = actorPopup.dataset.uniqueId;

    // Find marker associated with this popup
    const marker = window.actorMarkers.find(m => m.uniqueId === uniqueId);

    if (marker) {
      map.removeLayer(marker);
      window.actorMarkers = window.actorMarkers.filter(m => m !== marker);

      // Request 4 Delete Permanen Neo4j
      fetch('/api/actor/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: uniqueId })
      }).then(res => res.json()).then(data => {
        showToast("Aktor berhasil dihapus dari Neo4j.", "info");
      }).catch(err => {
        console.error(err);
        showToast("Gagal hapus di Neo4j.", "error");
      });
    }
    window.pendingDeleteBtn = null;
  }
  document.getElementById('deleteConfirmOverlay').classList.add('hidden');
};

window.cancelDeleteMarker = function () {
  pendingDeleteBtn = null;
  document.getElementById('deleteConfirmOverlay').classList.add('hidden');
};

// EDIT OVERLAYS LOGIC
window.openEditOverlay = function (type, uniqueId = '') {
  const canEdit = window.isAdmin || (window.userPermissions && window.userPermissions.includes(uniqueId));
  if (!canEdit) {
    showToast("Hanya Admin yang bisa mengedit aktor.", "error");
    return;
  }
  let overlayId = "";
  if (type === "aktorUsaha") overlayId = "editUsahaOverlay";
  if (type === "aktorLokasi") overlayId = "editLokasiOverlay";

  const overlay = document.getElementById(overlayId);
  if (overlay) {
    overlay.classList.add("active");

    // Store the marker being edited
    let targetMarker = null;
    if (uniqueId) {
      targetMarker = window.actorMarkers.find(m => m.uniqueId === uniqueId);
    } else {
      const openPopup = map._popup;
      if (openPopup && openPopup._source && (openPopup._source.actorType === type || type === "aktorLokasi")) {
        targetMarker = openPopup._source;
      }
    }

    if (targetMarker) {
      window.editingMarker = targetMarker;

      const card = overlay.querySelector(".edit-card");
      card.querySelectorAll("input:not([type='file']), textarea, select").forEach(i => { if (i.type !== 'color') i.value = ""; });
      const preview = card.querySelector(".preview img");
      if (preview) {
        preview.src = "";
        preview.parentElement.style.display = "none";
      }

      // Populate fields from actorData if exists
      if (window.editingMarker.actorData) {
        const data = window.editingMarker.actorData;
        const card = overlay.querySelector(".edit-card");
        const inputs = card.querySelectorAll("input:not([type='file']), textarea, select");
        inputs.forEach((input) => {
          const label =
            input.previousElementSibling?.innerText ||
            input.placeholder ||
            input.id;
          if (data[label] !== undefined) {
            input.value = data[label];
            // Trigger change for selects (like Jenis)
            if (input.tagName === 'SELECT') {
              input.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }
        });

        // Populate preview image if exists
        const preview = card.querySelector(".preview img");
        if (preview && data["Foto Visual Path"]) {
          preview.src = data["Foto Visual Path"];
          preview.parentElement.style.display = "block";
        }
      }

      // Special handling for Lokasi
      if (type === "aktorLokasi") {
        const colorInput = overlay.querySelector(".color-input");
        if (colorInput) {
          if (window.editingMarker.actorData && window.editingMarker.actorData["Warna"]) {
            colorInput.value = window.editingMarker.actorData["Warna"];
          } else if (window.editingMarker.options.color) {
            colorInput.value = window.editingMarker.options.color;
          }
          colorInput.addEventListener('input', function (e) {
            const newColor = e.target.value;
            window.editingMarker.setStyle({ color: newColor, fillColor: newColor });
            window.editingMarker.options.color = newColor;
          });

          colorInput.addEventListener('change', function (e) {
            if (!window.editingMarker.actorData) window.editingMarker.actorData = {};
            window.editingMarker.actorData["Warna"] = e.target.value;
            window.saveToNeo4j(window.editingMarker);
          });
        }

        // Show Coordinate Container and fill it (Restore: mistakenly removed previously)
        const coordsContainer = document.getElementById('polygonCoordsContainer');
        if (coordsContainer) {
          coordsContainer.classList.remove('hidden');
          updatePolygonCoordsUI(window.editingMarker);
        }
      }

      // Real-time Name sync to Popup (Requirement: "kalo NAMA DIGANTI MAKA OTOMATIS TERGANTI SEPERTI MILIK AKTOR LOKASI")
      const nameInput = [...overlay.querySelectorAll("textarea, input")].find(i =>
        (i.previousElementSibling?.innerText || i.placeholder || "").includes("Nama")
      );
      if (nameInput) {
        const targetMarkerRef = window.editingMarker; // FIX: Capture specific marker to avoid cross-contamination
        nameInput.oninput = (e) => {
          const newName = e.target.value;
          if (targetMarkerRef && targetMarkerRef.actorData) {
            // Update all potential name variants so getPopupContent stays fresh
            targetMarkerRef.actorData["Nama"] = newName;
            targetMarkerRef.actorData["Nama Usaha"] = newName;
            targetMarkerRef.actorData["Nama Lokasi"] = newName;
          }
          const popup = targetMarkerRef.getPopup();
          if (popup) {
            targetMarkerRef.setPopupContent(getPopupContent(targetMarkerRef.actorData, targetMarkerRef.actorType, targetMarkerRef.uniqueId));
          }
        };
      }
    }

    // Custom UI initialization has been moved above to ensure fields exist before hydration.
  }
};

window.updatePolygonCoordsUI = function (polygon) {
  const coordsList = document.getElementById('coordsList');
  if (!coordsList || !(polygon instanceof L.Polygon)) return;

  const latlngs = polygon.getLatLngs()[0];
  coordsList.innerHTML = latlngs.map((ll, idx) => `
    <div class="coord-item">
      <span>${idx + 1}.</span>
      <input type="text" value="${ll.lat.toFixed(6)}" readonly>
      <input type="text" value="${ll.lng.toFixed(6)}" readonly>
    </div>
  `).join('');
};

window.closeEditOverlay = function (el) {
  el.closest('.edit-overlay').classList.remove('active');
  window.editingMarker = null;

  // Also hide polygon coords container if it was shown
  const coordsContainer = document.getElementById('polygonCoordsContainer');
  if (coordsContainer) coordsContainer.classList.add('hidden');
};

window.saveToNeo4j = function (marker) {
  if (!marker || !marker.actorData) return;
  const latlng = marker.getLatLng ? marker.getLatLng() : { lat: 0, lng: 0 };
  const rawCoords = marker.getLatLngs ? marker.getLatLngs()[0].map(ll => ({ lat: ll.lat, lng: ll.lng })) : null;

  marker.actorData["rawCoords"] = rawCoords;

  const payload = {
    ...marker.actorData,
    id: marker.uniqueId,
    type: marker.actorType || "aktorLokasi",
    name: marker.actorData["Nama"] || marker.actorData["Nama Usaha"] || marker.actorData["Nama Lokasi"] || "Unknown",
    lat: latlng.lat,
    lng: latlng.lng
  };

  fetch('/api/actor/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .then(res => res.json())
    .then(data => console.log("Real-time Neo4j sync successful"))
    .catch(err => console.error("Real-time Neo4j sync failed:", err));
};

// COMPREHENSIVE SAVE LOGIC (Requirement 5)
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('btn-save')) {
    if (!window.editingMarker) return;

    const overlay = e.target.closest('.edit-overlay');
    if (!overlay) return;

    // Save common data
    const card = overlay.querySelector('.edit-card');
    const actorData = {
      ...(window.editingMarker.actorData || {}),
      timestamp: new Date().toISOString()
    };

    // Extract all inputs for the specific type
    const inputs = card.querySelectorAll('input:not([type="file"]), textarea, select');
    // Clear list arrays logic
    card.querySelectorAll('.list-container').forEach(lc => {
      const secLabel = lc.previousElementSibling?.innerText;
      if (secLabel) actorData[secLabel] = [];
    });

    inputs.forEach(input => {
      let label = input.previousElementSibling?.innerText || input.placeholder || input.id;
      if (!label) return;
      label = label.trim();

      const inList = input.closest('.list-container');
      if (inList) {
        const secLabel = inList.previousElementSibling?.innerText;
        if (secLabel && input.value.trim()) {
          if (!actorData[secLabel]) actorData[secLabel] = [];
          actorData[secLabel].push(input.value.trim());
        }
      } else {
        actorData[label] = input.value;
      }
    });

    // Handle Photo khusus
    const previewDiv = card.querySelector('.preview');
    const previewImg = previewDiv?.querySelector('img');
    if (previewImg && previewImg.src.startsWith('data:image')) {
      actorData["Foto Visual Path"] = previewImg.src;
    }

    // Save to the marker object
    window.editingMarker.actorData = actorData;

    // Apply color if it's a polygon or circle (Aktor Lokasi)
    if (actorData["Warna"] && window.editingMarker.setStyle) {
      window.editingMarker.setStyle({ color: actorData["Warna"], fillColor: actorData["Warna"] });
      window.editingMarker.options.color = actorData["Warna"];
    }

    // Update Popup Content (Full Refresh to match new structure)
    const popup = window.editingMarker.getPopup();
    if (popup) {
      window.editingMarker.setPopupContent(getPopupContent(actorData, window.editingMarker.actorType || "aktorLokasi", window.editingMarker.uniqueId));
      updateMarkerCoords(window.editingMarker);
    }

    // Panggil helper yang sudah terabstraksi!
    window.saveToNeo4j(window.editingMarker);
    showToast("Tersimpan permanen ke Knowledge Graph Neo4j", "info");

    overlay.classList.remove('active');
    window.editingMarker = null;
  }
});

window.previewImageEdit = function (event, previewId) {
  const reader = new FileReader();
  const previewDiv = document.getElementById(previewId);
  const img = previewDiv.querySelector('img');

  reader.onload = function (e) {
    img.src = e.target.result;
    previewDiv.style.display = "block";
  };
  reader.readAsDataURL(event.target.files[0]);
};




// Format Populasi
document.addEventListener('blur', (e) => {
  if (e.target.classList.contains('input-populasi')) {
    let val = e.target.value.replace(/\D/g, "");
    if (val) e.target.value = val + " orang";
  }
}, true);

document.addEventListener('focus', (e) => {
  if (e.target.classList.contains('input-populasi')) {
    e.target.value = e.target.value.replace(" orang", "");
  }
}, true);

// ACTOR SWITCH FILTERING (Requirement 4)
document.querySelectorAll(".actor-switch img").forEach(icon => {
  icon.addEventListener("click", () => {
    const targetType = icon.getAttribute("data-target");

    // Request 4: "hanya akan menampilkan data masing-masing marker ikon"
    // This means when we switch to "aktorUsaha", only "Usaha" markers should be visible.

    window.actorMarkers.forEach(marker => {
      if (marker.actorType === targetType) {
        if (!map.hasLayer(marker)) marker.addTo(map);
      } else {
        if (map.hasLayer(marker)) map.removeLayer(marker);
      }
    });

    // Also update the UI as before (if needed, but main HTML already has partial logic)
    // The main HTML already handles showing/hiding the large actor buttons.
  });
});


function showToast(msg, type = "info") {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = "toast " + type;
  toast.innerHTML = "<span>" + msg + "</span>";
  container.appendChild(toast);
  setTimeout(() => toast.classList.add("active"), 10);
  setTimeout(() => {
    toast.classList.remove("active");
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

window.addEventListener('load', () => {
  // Load user permissions first
  fetch('/api/user/permissions')
    .then(res => res.json())
    .then(data => {
      window.userPermissions = data.permissions || [];
    })
    .catch(err => {
      console.error("Gagal memuat izin user:", err);
      window.userPermissions = [];
    })
    .finally(() => {
      // Tunggu sejenak memastikan Leaflet 'map' sudah diinisialisasi di app.js
      setTimeout(() => {
        fetch('/api/actors')
          .then(res => res.json())
          .then(data => {
            if (!data.actors) return;
            data.actors.forEach(rec => {
              const type = rec.type;
              const aData = rec.raw_data || {};

              if (type === 'aktorLokasi' && aData.rawCoords) {
                // Restore Polygon
                const latlngs = aData.rawCoords.map(c => [c.lat, c.lng]);
                const warna = aData["Warna"] || '#8d98e0';
                const polygon = L.polygon(latlngs, {
                  color: warna,
                  fillColor: warna,
                  fillOpacity: 0.3
                });

                polygon.actorType = type;
                polygon.uniqueId = rec.id;
                polygon.actorData = aData;

                if (typeof setupPolygonInteractions === 'function') {
                  setupPolygonInteractions(polygon, true);
                } else {
                  polygon.bindPopup(() => getPopupContent(polygon.actorData, polygon.actorType, polygon.uniqueId));
                  polygon.on('popupopen', () => updateMarkerCoords ? updateMarkerCoords(polygon) : null);
                }
                window.actorMarkers.push(polygon);

                // Tampilkan hanya jika switch aktif cocok
                const activeSwitch = document.querySelector('.actor-main.active');
                if (activeSwitch && activeSwitch.id === type) {
                  polygon.addTo(map);
                }

              } else {
                // Restore Tipe Titik Marker Biasa
                let iconUrl = "";
                if (type === "aktorUsaha") iconUrl = "/static/image/actor/usaha.svg";

                if (iconUrl) {
                  const canEdit = window.isAdmin || (window.userPermissions && window.userPermissions.includes(rec.id));
                  const marker = L.marker([rec.lat, rec.lng], {
                    icon: createActorIcon(iconUrl),
                    draggable: canEdit,
                  });

                  marker.actorType = type;
                  marker.uniqueId = rec.id;
                  marker.actorData = aData;

                  marker.bindPopup(() => getPopupContent(marker.actorData, marker.actorType, marker.uniqueId));

                  let dragStartPos = null;
                  marker.on('dragstart', function (e) {
                    dragStartPos = e.target.getLatLng();
                  });

                  marker.on('dragend', function (e) {
                    if (map.latLngToContainerPoint(dragStartPos).distanceTo(map.latLngToContainerPoint(e.target.getLatLng())) > 5) {
                      const overlay = document.getElementById('locationOverlay');
                      if (overlay) overlay.classList.remove('hidden');
                      window.draggingMarker = marker;
                      window.lastMarkerPos = dragStartPos;
                    }
                    if (typeof updateMarkerCoords === 'function') updateMarkerCoords(marker);
                  });

                  marker.on('popupopen', () => typeof updateMarkerCoords === 'function' ? updateMarkerCoords(marker) : null);
                  window.actorMarkers.push(marker);

                  // Tampilkan hanya jika switch aktif cocok
                  const activeSwitch = document.querySelector('.actor-main.active');
                  if (activeSwitch && activeSwitch.id === type) {
                    marker.addTo(map);
                  }
                }
              }
            });
          })
          .catch(e => console.error("Gagal meload aktor dari Neo4j:", e));
      }, 1000);
    });
});

window.jumpToActor = function (id) {
  const marker = (window.actorMarkers || []).find(m => m.uniqueId === id);
  if (marker) {
    // Jika marker tidak ada di map (masih tersembunyi karena switch), paksa tampilkan
    if (!map.hasLayer(marker)) {
      const targetSwitch = marker.actorType;
      const switchImg = document.querySelector(`.actor-switch img[data-target="${targetSwitch}"]`);
      if (switchImg) switchImg.click();
    }

    const pos = marker.getLatLng ? marker.getLatLng() : marker.getBounds().getCenter();
    map.flyTo(pos, 18);
    setTimeout(() => marker.openPopup(), 500);
  }
};
