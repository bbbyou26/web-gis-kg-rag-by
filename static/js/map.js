// Toggle profile wrapper saat klik tombol topbar
document.getElementById("profile").addEventListener("click", () => {
  document.getElementById("profileWrapper").classList.toggle("active");
});

document.addEventListener("click", (event) => {
  const profileWrapper = document.getElementById("profileWrapper");
  const profileButton = document.getElementById("profile");

  // Jika profile-wrapper aktif
  if (profileWrapper.classList.contains("active")) {
    // Jika klik bukan di dalam profile-wrapper dan bukan tombol profile
    if (
      !profileWrapper.contains(event.target) &&
      event.target !== profileButton
    ) {
      profileWrapper.classList.remove("active"); // tutup panel
    }
  }
});
// CLUSTER FUNCTIONALITY
const clusterTool = document.getElementById("clusterTool");
const clusterOptions = document.getElementById("clusterOptions");
const clusterText = document.getElementById("clusterText");
const clusterMain = document.getElementById("clusterMain");

// Aturan zoom berdasarkan opsi
const zoomLevels = {
  "RT / RW": 19,
  Kelurahan: 16,
  Kecamatan: 13,
  "Kabupaten / Kota": 11,
};

// Lokasi contoh pusat wilayah masing-masing (lat,lng)
const wilayahCenters = {
  "RT / RW": [-1.2071059, 116.9774142],
  Kelurahan: [-1.2071059, 116.9774142],
  Kecamatan: [-1.2071059, 116.9774142],
  "Kabupaten / Kota": [-1.2071059, 116.9774142],
};
// Fungsi deteksi lokasi user otomatis (Requirement: Auto sesuai user berada dimana)
function initUserLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const userLoc = [latitude, longitude];

        // Update semua level wilayah dengan lokasi user saat ini
        Object.keys(wilayahCenters).forEach((key) => {
          wilayahCenters[key] = userLoc;
        });

        // Update view map jika tidak sedang mencari aktor tertentu
        const params = new URLSearchParams(window.location.search);
        if (!params.get("find_actor")) {
          map.setView(userLoc, zoomLevels["Kabupaten / Kota"]);
        }

        console.log("Location detected and updated:", userLoc);
      },
      (err) => {
        console.warn("Geolocation access denied or failed:", err.message);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  }
}
// Fungsi untuk update clusterText otomatis berdasarkan zoom
function updateClusterByZoom(zoom) {
  let wilayah = "";
  if (zoom >= 18) wilayah = "RT / RW";
  else if (zoom >= 15) wilayah = "Kelurahan";
  else if (zoom >= 12) wilayah = "Kecamatan";
  else wilayah = "Kabupaten / Kota";

  clusterText.textContent = wilayah;
}

clusterTool.addEventListener("click", (e) => {
  e.stopPropagation();
  clusterOptions.style.display =
    clusterOptions.style.display === "block" ? "none" : "block";
});

document.querySelectorAll(".cluster-option").forEach((option) => {
  option.addEventListener("click", (e) => {
    e.stopPropagation();
    const selected = option.textContent;
    clusterText.textContent = selected;
    clusterOptions.style.display = "none";

    // Zoom map sesuai opsi
    const center = wilayahCenters[selected];
    const zoom = zoomLevels[selected];
    if (center && zoom) {
      map.setView(center, zoom);
    }
  });
});

clusterMain.addEventListener("click", () => {
  console.log("fungsi lain di kiri jalan");
});

document.addEventListener("click", () => {
  clusterOptions.style.display = "none";
});

// Leaflet map
const map = L.map("map", {
  zoomControl: false,
  minZoom: 10,
  maxZoom: 20,
  zoomSnap: 0, // Disable snapping entirely to prevent calculation-based gaps
  zoomDelta: 1,
});

// Atur default ke Kabupaten/Kota
const defaultOption = "Kabupaten / Kota";
map.setView(wilayahCenters[defaultOption], zoomLevels[defaultOption]);

// SATELIT LAYER (custom class)
const satelitLayer = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  {
    maxZoom: 20,
    maxNativeZoom: 18, // ESRI native limit, will upscale for 19-20
    detectRetina: true,
    className: "map-satelit",
    attribution:
      "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics",
  },
);

// default map biasa (optional)
const normalLayer = L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  { maxZoom: 20, maxNativeZoom: 19 }
);

// load awal
normalLayer.addTo(map);

let isSatelit = false;

document.getElementById("toggleMap").onclick = () => {
  if (!isSatelit) {
    map.removeLayer(normalLayer);
    satelitLayer.addTo(map);
    isSatelit = true;
  } else {
    map.removeLayer(satelitLayer);
    normalLayer.addTo(map);
    isSatelit = false;
  }
};

// Nonaktifkan zoom dengan scroll/gesture agar tidak bisa zoom sembarangan
map.scrollWheelZoom.disable();
map.touchZoom.disable();
map.doubleClickZoom.disable();
map.boxZoom.disable();
map.keyboard.disable();

// UPDATE clusterText otomatis saat zoom dengan tombol kontrol
map.on("zoomend", () => {
  const currentZoom = map.getZoom();
  updateClusterByZoom(currentZoom);
});

// Custom zoom control
const CustomZoom = L.Control.extend({
  options: { position: "bottomright" },
  onAdd: function (map) {
    const container = L.DomUtil.create("div", "custom-zoom");

    // Tombol +
    const zoomIn = L.DomUtil.create("div", "zoom-btn", container);
    zoomIn.innerHTML = "+";
    zoomIn.onclick = () => map.setZoom(map.getZoom() + 1);

    // Tombol -
    const zoomOut = L.DomUtil.create("div", "zoom-btn", container);
    zoomOut.innerHTML = "−";
    zoomOut.onclick = () => map.setZoom(map.getZoom() - 1);

    return container;
  },
});
map.addControl(new CustomZoom());

document.getElementById("zoomIn").onclick = () =>
  map.setZoom(map.getZoom() + 1);
document.getElementById("zoomOut").onclick = () =>
  map.setZoom(map.getZoom() - 1);

async function updateActorLocation(marker) {
  const latlng = marker.getLatLng();
  const lat = latlng.lat.toFixed(6);
  const lng = latlng.lng.toFixed(6);

  const popupEl = marker.getPopup()?.getElement();
  if (!popupEl) return;

  // Update koordinat
  const coordEl = popupEl.querySelector(".actor-coord");
  if (coordEl) {
    coordEl.textContent = `Koordinat: ${lat}, ${lng}`;
  }

  // Update alamat (reverse geocode)
  const addressEl = popupEl.querySelector(".actor-address");
  if (!addressEl) return;

  addressEl.textContent = "Mencari alamat...";

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
      {
        headers: {
          Accept: "application/json",
        },
      },
    );

    const data = await response.json();

    if (data && data.display_name) {
      addressEl.textContent = data.display_name;
    } else {
      addressEl.textContent = "Alamat tidak ditemukan";
    }
  } catch (err) {
    addressEl.textContent = "Gagal memuat alamat";
    console.error(err);
  }
}

async function geocodeNearest(query) {
  const center = map.getCenter();

  // ===== STEP 1: LOCAL SEARCH =====
  const bounds = map.getBounds();
  const localViewbox = [
    bounds.getWest(),
    bounds.getNorth(),
    bounds.getEast(),
    bounds.getSouth(),
  ].join(",");

  let url =
    `https://nominatim.openstreetmap.org/search?` +
    `q=${encodeURIComponent(query)}` +
    `&format=jsonv2` +
    `&limit=10` +
    `&viewbox=${localViewbox}` +
    `&bounded=1` +
    `&countrycodes=id`;

  let data = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "LeafletApp/1.0",
    },
  }).then((r) => r.json());

  // ===== STEP 2: GLOBAL INDONESIA =====
  if (!data.length) {
    url =
      `https://nominatim.openstreetmap.org/search?` +
      `q=${encodeURIComponent(query)}` +
      `&format=jsonv2` +
      `&limit=10` +
      `&countrycodes=id`;

    data = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "LeafletApp/1.0",
      },
    }).then((r) => r.json());
  }

  if (!data.length) return null;

  // ===== PICK NEAREST =====
  let best = data[0];
  let minDist = map.distance(center, [best.lat, best.lon]);

  for (let i = 1; i < data.length; i++) {
    const d = map.distance(center, [data[i].lat, data[i].lon]);
    if (d < minDist) {
      minDist = d;
      best = data[i];
    }
  }

  return {
    lat: +best.lat,
    lng: +best.lon,
    display_name: best.display_name,
  };
}

// ACTOR FINDER (Point 3) — retry until markers are loaded
function checkUrlParams(retriesLeft) {
  if (retriesLeft === undefined) retriesLeft = 6; // max ~3s total
  const params = new URLSearchParams(window.location.search);
  const findActor = params.get('find_actor');
  if (!findActor) return;

  const targetId = decodeURIComponent(findActor).toUpperCase();

  if (window.actorMarkers && window.actorMarkers.length > 0) {
    // Try match by uniqueId first
    let marker = window.actorMarkers.find(m => m.uniqueId && m.uniqueId === targetId);

    // Fallback: search in popup content
    if (!marker) {
      marker = window.actorMarkers.find(m => {
        try {
          const content = m.getPopup && m.getPopup() && m.getPopup().getContent();
          return content && content.includes(targetId);
        } catch (e) { return false; }
      });
    }

    if (marker) {
      const center = marker.getLatLng
        ? marker.getLatLng()
        : (marker.getBounds ? marker.getBounds().getCenter() : null);
      if (center) {
        map.setView(center, 19);
        setTimeout(() => marker.openPopup(), 300);
      }
      return; // found, done
    }
  }

  // Retry if markers haven't loaded yet
  if (retriesLeft > 0) {
    setTimeout(() => checkUrlParams(retriesLeft - 1), 500);
  }
}

// Attach to load
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(checkUrlParams, 500);
  initUserLocation(); // Deteksi lokasi pengguna otomatis setelah login
});

document.getElementById("searchBtn").onclick = async () => {
  const q = document.getElementById("searching").value.trim();
  if (!q) return;

  const result = await geocodeNearest(q);
  if (!result) {
    alert("Lokasi tidak ditemukan!");
    return;
  }

  const searchIcon = L.divIcon({
    html: `<img src="/static/image/icon/pin-map.svg" class="marker-pin-animated" style="width:50px; height:50px;">`,
    iconSize: [50, 50],
    iconAnchor: [25, 50],
    popupAnchor: [0, -45],
    className: ''
  });

  L.marker([result.lat, result.lng], { icon: searchIcon })
    .addTo(map)
    .bindPopup(result.display_name, { className: 'search-result-popup' })
    .openPopup();

  map.setView([result.lat, result.lng], 15);
};


