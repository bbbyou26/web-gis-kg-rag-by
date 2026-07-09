let isDrawingLokasi = false;
let currentPoints = [];
let tempLine = null;
let tempPoints = [];
let drawingHistory = [];
let drawingRedo = [];

// Cache Elements Globally (Instant access)
const drawLokasiBtn = document.getElementById('aktorLokasi');
const controlsContainer = document.querySelector('.controls-left');
const undoBtn = document.getElementById('undo-btn');
const redoBtn = document.getElementById('redo-btn');
const cancelBtn = document.getElementById('cancel-btn');
const drawModeBtn = document.getElementById('draw-mode-btn');
const panModeBtn = document.getElementById('pan-mode-btn');

if (drawLokasiBtn) {
    drawLokasiBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!window.isAdmin) {
            if (typeof showToast === 'function') {
                showToast("Hanya Admin yang bisa menggambar lokasi.", "error");
            } else {
                alert("Hanya Admin yang bisa menggambar lokasi.");
            }
            return;
        }

        if (!isDrawingLokasi) {
            startDrawingLokasi();
        } else {
            finishDrawingLokasi();
        }
    });
}

function startDrawingLokasi() {
    isDrawingLokasi = true;
    currentPoints = [];
    drawingHistory = [];
    drawingRedo = [];

    // UI Updates - Direct style manipulation for speed
    if (controlsContainer) controlsContainer.style.display = 'flex';
    if (undoBtn) undoBtn.disabled = true;
    if (redoBtn) redoBtn.disabled = true;
    if (cancelBtn) cancelBtn.style.display = 'flex';

    // Batch disable interactions
    setDrawingInteraction(true);

    // Direct event attachment
    map.on('click', handleMapClick);
    map.on('mousemove', handleMapMouseMove);
}

function setDrawingInteraction(active) {
    if (active) {
        map.dragging.disable();
        map.touchZoom.disable();
        map.doubleClickZoom.disable();
        map.scrollWheelZoom.disable();
        map.getContainer().classList.add('drawing-mode');
        if (drawModeBtn) drawModeBtn.classList.add('active');
        if (panModeBtn) panModeBtn.classList.remove('active');
    } else {
        map.dragging.enable();
        map.touchZoom.enable();
        map.doubleClickZoom.enable();
        map.scrollWheelZoom.enable();
        map.getContainer().classList.remove('drawing-mode');
        if (drawModeBtn) drawModeBtn.classList.remove('active');
        if (panModeBtn) panModeBtn.classList.add('active');
    }
}

if (drawModeBtn) drawModeBtn.onclick = (e) => {
    e.stopPropagation();
    setDrawingInteraction(true);
};

if (panModeBtn) panModeBtn.onclick = (e) => {
    e.stopPropagation();
    setDrawingInteraction(false);
};

function handleMapClick(e) {
    if (!isDrawingLokasi) return;

    const latlng = e.latlng;

    // Check for closure
    if (currentPoints.length >= 3) {
        const firstPt = currentPoints[0];
        const dist = map.latLngToContainerPoint(latlng).distanceTo(map.latLngToContainerPoint(firstPt));
        if (dist < 20) {
            finishDrawingLokasi();
            return;
        }
    }

    drawingHistory.push(JSON.stringify(currentPoints));
    currentPoints.push(latlng);
    updateDrawingUI();
}

function handleMapMouseMove(e) {
    if (!isDrawingLokasi || currentPoints.length === 0) return;

    if (tempLine) map.removeLayer(tempLine);

    tempLine = L.polyline([currentPoints[currentPoints.length - 1], e.latlng], {
        color: '#007bff',
        dashArray: '5, 5',
        weight: 2
    }).addTo(map);
}

function updateDrawingUI() {
    // Clear old layers
    if (tempPoints.length > 0) tempPoints.forEach(p => map.removeLayer(p));
    if (tempLine) map.removeLayer(tempLine);
    tempPoints = [];

    if (currentPoints.length >= 2) {
        const poly = L.polyline(currentPoints, { color: '#007bff', weight: 3 });
        poly.addTo(map);
        tempPoints.push(poly);
    }

    currentPoints.forEach((pt, index) => {
        const marker = L.circleMarker(pt, {
            radius: 5,
            fillColor: index === 0 ? '#28a745' : 'white',
            color: '#333',
            weight: 1,
            fillOpacity: 1
        }).addTo(map);
        tempPoints.push(marker);
    });

    if (undoBtn) undoBtn.disabled = currentPoints.length === 0;
    if (redoBtn) redoBtn.disabled = drawingRedo.length === 0;
}

function finishDrawingLokasi() {
    if (currentPoints.length < 3) return;

    const polygon = L.polygon([...currentPoints], {
        color: '#8d98e0',
        fillColor: '#8d98e0',
        fillOpacity: 0.3
    }).addTo(map);

    polygon.actorType = 'aktorLokasi';
    polygon.uniqueId = Math.random().toString(36).substr(2, 6).toUpperCase();
    if (!window.actorMarkers) window.actorMarkers = [];
    window.actorMarkers.push(polygon);

    setupPolygonInteractions(polygon);
    resetDrawingMode();

    if (typeof openEditOverlay === 'function') openEditOverlay('aktorLokasi', polygon.uniqueId);
}

function setupPolygonInteractions(polygon, isRestore = false) {
    if (!polygon.actorData) {
        polygon.actorData = {
            "Nama Lokasi": "Lokasi Tergambar",
            "Nama": "Lokasi Tergambar",
            "Notes": "",
            "Catatan": "",
            "Deskripsi": ""
        };
    }

    polygon.bindPopup(() => getPopupContent(polygon.actorData, polygon.actorType, polygon.uniqueId));

    if (!isRestore && window.saveToNeo4j) window.saveToNeo4j(polygon); // REAL TIME SAVE ON CREATION

    // Initial coord update
    updateMarkerCoords(polygon);

    polygon.on('popupopen', () => updateMarkerCoords(polygon));

    let dragData = { isDragging: false, start: null, original: [] };

    polygon.on('mousedown', (e) => {
        if (isDrawingLokasi) return;
        L.DomEvent.stopPropagation(e);
        dragData.isDragging = true;
        dragData.start = e.latlng;
        dragData.original = polygon.getLatLngs()[0].map(ll => L.latLng(ll.lat, ll.lng));
        map.dragging.disable();
    });

    map.on('mousemove', (e) => {
        if (!dragData.isDragging) return;
        const latOffset = e.latlng.lat - dragData.start.lat;
        const lngOffset = e.latlng.lng - dragData.start.lng;
        const newLatLngs = dragData.original.map(ll => L.latLng(ll.lat + latOffset, ll.lng + lngOffset));
        polygon.setLatLngs(newLatLngs);
    });

    map.on('mouseup', (e) => {
        if (dragData.isDragging) {
            dragData.isDragging = false;
            map.dragging.enable();
            if (map.latLngToContainerPoint(dragData.start).distanceTo(map.latLngToContainerPoint(e.latlng)) > 5) {
                const overlay = document.getElementById('locationOverlay');
                if (overlay) overlay.classList.remove('hidden');
                window.draggingMarker = polygon;
                window.lastMarkerPos = dragData.original;

                // Update coordinates UI if edit card is open
                if (window.editingMarker === polygon && typeof updatePolygonCoordsUI === 'function') {
                    updatePolygonCoordsUI(polygon);
                }
            }
        }
    });
}

function resetDrawingMode() {
    isDrawingLokasi = false;
    map.off('click', handleMapClick);
    map.off('mousemove', handleMapMouseMove);
    map.getContainer().classList.remove('drawing-mode');

    map.dragging.enable();
    map.touchZoom.enable();
    map.doubleClickZoom.enable();
    map.scrollWheelZoom.enable();

    if (tempPoints.length > 0) tempPoints.forEach(p => map.removeLayer(p));
    if (tempLine) map.removeLayer(tempLine);

    if (controlsContainer) controlsContainer.style.display = 'none';
    if (cancelBtn) cancelBtn.style.display = 'none';
}

if (undoBtn) undoBtn.onclick = (e) => {
    e.stopPropagation();
    if (drawingHistory.length > 0) {
        drawingRedo.push(JSON.stringify(currentPoints));
        currentPoints = JSON.parse(drawingHistory.pop());
        updateDrawingUI();
    }
};

if (redoBtn) redoBtn.onclick = (e) => {
    e.stopPropagation();
    if (drawingRedo.length > 0) {
        drawingHistory.push(JSON.stringify(currentPoints));
        currentPoints = JSON.parse(drawingRedo.pop());
        updateDrawingUI();
    }
};

if (cancelBtn) cancelBtn.onclick = (e) => {
    e.stopPropagation();
    resetDrawingMode();
};

// Global confirm logic
if (window.confirmLocation) {
    const orig = window.confirmLocation;
    window.confirmLocation = function () {
        if (window.draggingMarker instanceof L.Polygon) {
            document.getElementById('locationOverlay').classList.add('hidden');
            // Sync UI one last time
            if (window.editingMarker === window.draggingMarker && typeof updatePolygonCoordsUI === 'function') {
                updatePolygonCoordsUI(window.draggingMarker);
            }
            window.draggingMarker = null;
        } else orig();
    };
}
if (window.closeLocation) {
    const orig = window.closeLocation;
    window.closeLocation = function () {
        if (window.draggingMarker instanceof L.Polygon) {
            window.draggingMarker.setLatLngs(window.lastMarkerPos);
            document.getElementById('locationOverlay').classList.add('hidden');
            // Sync UI back
            if (window.editingMarker === window.draggingMarker && typeof updatePolygonCoordsUI === 'function') {
                updatePolygonCoordsUI(window.draggingMarker);
            }
            window.draggingMarker = null;
        } else orig();
    };
}

window.deletePolygon = function (btn) {
    // Re-use logic from deleteMarker in popup.js
    window.pendingDeleteBtn = btn;
    document.getElementById('deleteConfirmOverlay').classList.remove('hidden');
};

