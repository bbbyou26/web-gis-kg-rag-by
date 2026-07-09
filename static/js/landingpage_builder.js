const actorId = window.unique_id || "{{ unique_id }}";
let rawData = window.landing_page_data || `{{ landing_page_data|safe }}`;

// Fallback if data is empty
if (rawData === "None" || rawData.trim() === "" || rawData.trim() === "[]") {
  rawData = "[]";
}

let isEditMode = false;
let elements = [];
let selectedElementId = null;
let originalScrollTop = null;

// Undo/Redo History Stacks
let undoStack = [];
let redoStack = [];
const MAX_HISTORY_LIMIT = 50;

const defaultCarouselImages = [];
let carouselIntervals = {};

// Drag status
let isDragging = false;
let dragStartX, dragStartY;
let dragStartLeft, dragStartTop;
let dragEl = null;

// Resize status
let isResizing = false;
let resizeStartX, resizeStartY;
let resizeStartWidth, resizeStartHeight;
let resizeEl = null;

const canvas = document.getElementById("canvas");

// Parse data awal
try {
  if (rawData !== "[]") {
    const parsed = JSON.parse(rawData);
    if (parsed.elements) {
      elements = parsed.elements;
    } else if (Array.isArray(parsed)) {
      elements = parsed;
    }

    // Restore Background Style jika ada
    if (parsed.background) {
      const bgTypeSelect = document.getElementById("bgType");
      if (bgTypeSelect) {
        bgTypeSelect.value = parsed.background.type || "color";

        // Restore custom height if present
        if (parsed.background.canvasHeight) {
          window.canvasHeight = parsed.background.canvasHeight;
          const heightInput = document.getElementById("canvasHeightInput");
          if (heightInput) heightInput.value = window.canvasHeight;
        }

        if (parsed.background.type === "color") {
          canvas.style.background = parsed.background.style;
          document.getElementById("bgSolidColor").value =
            parsed.background.color || "#f2f7f9";
          adjustCanvasHeight();
        } else if (parsed.background.type === "gradient") {
          canvas.style.background = parsed.background.style;
          adjustCanvasHeight();
        } else if (parsed.background.type === "image") {
          window.bgImageSrc = parsed.background.imageSrc || "";
          window.bgImageOpacity = parsed.background.opacity !== undefined ? parsed.background.opacity : 1.0;

          if (window.bgImageSrc) {
            const tempImg = new Image();
            tempImg.onload = function () {
              window.bgImageWidth = tempImg.width;
              window.bgImageHeight = tempImg.height;
              adjustCanvasHeight();
            };
            tempImg.src = window.bgImageSrc;
          } else {
            adjustCanvasHeight();
          }
          updateBgStyle();
        }
      }
    }
  } else {
    canvas.style.background = "#f2f7f9";
  }
} catch (e) {
  console.error("Gagal meload data awal:", e);
  canvas.style.background = "#f2f7f9";
}

// Update name and photo automatically from business actor data
if (elements && elements.length > 0) {
  if (window.actorName) {
    const titleEl = elements.find(el => el.type === "title");
    if (titleEl) {
      titleEl.content = window.actorName;
    }
  }
  if (window.actorFoto) {
    const imgEl = elements.find(el => el.type === "image");
    if (imgEl) {
      imgEl.imageSrc = window.actorFoto;
    }
  }
}

// Jika kosong, masukkan template awal yang indah agar tidak kosong
if (elements.length === 0) {
  elements = [
    {
      id: "el-" + Math.random().toString(36).substr(2, 9),
      type: "title",
      content: window.actorName || "{{ name }}",
      style: {
        top: "8%",
        left: "5%",
        width: "90%",
        height: "auto",
        color: "#2c5d6b",
        fontSize: "26px",
        fontWeight: "800",
        textAlign: "center",
        zIndex: "10",
      },
    },
    {
      id: "el-" + Math.random().toString(36).substr(2, 9),
      type: "text",
      content:
        "Selamat datang di halaman kami! Temukan berbagai layanan dan produk terbaik yang kami sediakan khusus untuk Anda.",
      style: {
        top: "18%",
        left: "8%",
        width: "84%",
        height: "auto",
        color: "#7a8a94",
        fontSize: "14px",
        fontWeight: "400",
        textAlign: "center",
        zIndex: "10",
      },
    },
    {
      id: "el-" + Math.random().toString(36).substr(2, 9),
      type: "shape",
      style: {
        top: "32%",
        left: "8%",
        width: "84%",
        height: "220px",
        backgroundColor: "rgba(255, 255, 255, 0.75)",
        borderRadius: "16px",
        borderStyle: "solid",
        borderColor: "rgba(56, 160, 196, 0.2)",
        borderWidth: "1.5px",
        backdropFilter: "blur(8px)",
        zIndex: "2",
      },
    },
    {
      id: "el-" + Math.random().toString(36).substr(2, 9),
      type: "image",
      imageSrc: window.actorFoto || "",
      style: {
        top: "35%",
        left: "14%",
        width: "72%",
        height: "155px",
        borderRadius: "12px",
        objectFit: "cover",
        zIndex: "5",
      },
    },
    {
      id: "el-" + Math.random().toString(36).substr(2, 9),
      type: "button",
      content: "Hubungi Kami Via WhatsApp",
      url: "https://wa.me/#",
      style: {
        top: "78%",
        left: "12%",
        width: "76%",
        height: "46px",
        backgroundColor: "#38a0c4",
        color: "#ffffff",
        borderRadius: "12px",
        zIndex: "10",
      },
    },
  ];
}

function convertPercentagesToPixels() {
  const canvasH = 800; // default height
  elements.forEach(item => {
    if (!item.parentId && item.style && item.style.top && typeof item.style.top === "string" && item.style.top.endsWith('%')) {
      const pct = parseFloat(item.style.top);
      if (!isNaN(pct)) {
        item.style.top = `${Math.round((pct / 100) * canvasH)}px`;
      }
    }
  });
}

// Convert percentages of top coordinate to pixel values to prevent relative shifting when canvas height grows
convertPercentagesToPixels();

// Inisialisasi Canvas
renderCanvas();

// Initial history state
pushHistory();

function renderCanvas() {
  canvas.innerHTML = "";

  // Clear existing autoplay intervals
  Object.keys(carouselIntervals).forEach(key => {
    clearInterval(carouselIntervals[key]);
  });
  carouselIntervals = {};

  // Build relationships
  const rootElements = elements.filter(item => !item.parentId || !elements.some(p => p.id === item.parentId));

  function renderElement(item, parentDom) {
    const div = document.createElement("div");
    div.className = "builder-element";
    div.id = item.id;
    div.dataset.type = item.type;

    // Apply layout positions
    if (item.parentId) {
      div.style.position = "relative";
      div.style.left = "auto";
      div.style.top = "auto";
      div.style.width = item.style.width || "100%";
      div.style.height = item.style.height || "auto";
      if (item.style.alignSelf) div.style.alignSelf = item.style.alignSelf;
      if (item.style.margin) div.style.margin = item.style.margin;
    } else {
      div.style.position = "absolute";
      div.style.left = item.style.left || "10%";
      div.style.top = item.style.top || "80px";
      div.style.width = item.style.width || "80%";
      div.style.height = item.style.height || "auto";
    }
    div.style.zIndex = item.style.zIndex || "5";

    // Apply outer-div visual styles (border, shadow, outline)
    ["borderRadius", "borderStyle", "borderColor", "borderWidth", "boxShadow", "outline"].forEach(prop => {
      if (item.style[prop] !== undefined && item.style[prop] !== null && item.style[prop] !== '') {
        div.style[prop] = item.style[prop];
      }
    });

    if (selectedElementId === item.id) {
      div.classList.add("active-element");
    }

    let inner = null;
    if (item.type === "title") {
      inner = document.createElement("h2");
      inner.className = "element-text";
      inner.innerText = item.content;
    } else if (item.type === "text") {
      inner = document.createElement("p");
      inner.className = "element-text";
      inner.innerText = item.content;
    } else if (item.type === "image") {
      inner = document.createElement("img");
      inner.className = "element-image";
      inner.src = item.imageSrc || `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="100%" height="100%" fill="%23f2f7f9"/><circle cx="150" cy="90" r="30" fill="%23bddce7"/><polygon points="80,170 150,110 220,170" fill="%2338a0c4"/><text x="50%" y="150" font-family="sans-serif" font-size="12" fill="%237a8a94" text-anchor="middle">Upload Gambar di Pengaturan</text></svg>`;
    } else if (item.type === "button") {
      inner = document.createElement("a");
      inner.className = "element-button";
      inner.innerText = item.content;
      inner.href = isEditMode ? "javascript:void(0)" : item.url || "#";
      if (!isEditMode && item.url) inner.target = "_blank";
    } else if (item.type === "shape") {
      inner = document.createElement("div");
      inner.className = "element-shape";
    } else if (item.type === "container") {
      inner = document.createElement("div");
      inner.className = "element-container";
    } else if (item.type === "column") {
      inner = document.createElement("div");
      inner.className = "element-column";
    } else if (item.type === "row") {
      inner = document.createElement("div");
      inner.className = "element-row";
    } else if (item.type === "carousel") {
      inner = createCarouselDOM(item);
      startCarouselAutoplay(item);
    } else if (item.type === "media_embed") {
      inner = createMediaEmbedDOM(item);
    }

    if (inner) {
      applyElementStyles(inner, item.style);
      div.appendChild(inner);
    }

    // Add children recursively
    if (["shape", "container", "row", "column"].includes(item.type)) {
      const targetArea = inner || div;
      const children = elements.filter(child => child.parentId === item.id);
      children.forEach(child => {
        renderElement(child, targetArea);
      });

      if (isEditMode && children.length === 0) {
        const placeholder = document.createElement("div");
        placeholder.className = "empty-container-placeholder";
        placeholder.innerText = `Geser komponen ke sini (${item.type === 'shape' ? 'box' : item.type})`;
        targetArea.appendChild(placeholder);
      }
    }

    // Add Resize Handle if edit mode
    const handle = document.createElement("div");
    handle.className = "resize-handle";
    div.appendChild(handle);

    // Mousedown listener for selection/drag
    div.addEventListener("mousedown", (e) => {
      if (!isEditMode) return;
      if (e.target.classList.contains("resize-handle")) return;
      e.stopPropagation();
      selectElement(item.id);

      if (!item.parentId) {
        isDragging = true;
        dragEl = div;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        dragStartLeft = div.offsetLeft;
        dragStartTop = div.offsetTop;
      }
    });

    // Mousedown for resizing
    handle.addEventListener("mousedown", (e) => {
      if (!isEditMode) return;
      e.stopPropagation();
      e.preventDefault();

      isResizing = true;
      resizeEl = div;
      resizeStartX = e.clientX;
      resizeStartY = e.clientY;

      const rect = div.getBoundingClientRect();
      resizeStartWidth = rect.width;
      resizeStartHeight = rect.height;
    });

    // Dragover & Drop events for layout containers
    if (isEditMode && ["shape", "container", "row", "column"].includes(item.type)) {
      div.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.stopPropagation();
        div.classList.add("drag-over-container");
      });

      div.addEventListener("dragleave", (e) => {
        e.preventDefault();
        e.stopPropagation();
        div.classList.remove("drag-over-container");
      });

      div.addEventListener("drop", (e) => {
        e.preventDefault();
        e.stopPropagation();
        div.classList.remove("drag-over-container");

        const type = e.dataTransfer.getData("text/type");
        if (!type) return;

        createNewElement(type, "auto", "auto", item.id);
      });
    }

    parentDom.appendChild(div);
  }

  rootElements.forEach(item => {
    renderElement(item, canvas);
  });

  // Render layers panel if visible
  const layersPanel = document.getElementById("layersPanel");
  if (layersPanel && isEditMode && !layersPanel.classList.contains("hidden")) {
    renderLayersPanelContent();
  }

  // Update background preview
  updateBgStyle();
  adjustCanvasHeight();
}

function applyElementStyles(el, style) {
  if (!style) return;
  // Props that belong on the outer div, NOT the inner element
  const outerDivOnly = ["left", "top", "width", "height", "zIndex",
    "boxShadow", "outline", "gapBottom"];
  Object.keys(style).forEach((key) => {
    if (outerDivOnly.includes(key)) return;
    if (style[key] === null || style[key] === undefined) return;
    el.style[key] = style[key];
  });
}

// Toggle edit mode
function toggleEditMode() {
  if (!window.isAdmin) return;
  isEditMode = !isEditMode;

  const icon = document.getElementById("modeIcon");
  const saveBtn = document.getElementById("btnSave");
  const toolbox = document.getElementById("toolboxRow");
  const drawer = document.getElementById("propertiesDrawer");
  const layersBtn = document.getElementById("btnToggleLayers");
  const layersPanel = document.getElementById("layersPanel");
  const btnPalette = document.getElementById("btnPalette");

  if (isEditMode) {
    // Eye icon (Preview Mode)
    icon.outerHTML = `<svg id="modeIcon" xmlns="http://www.w3.org/2000/svg" xml:space="preserve" width="28" height="28" version="1.1" style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd; width: 28px; height: 28px;" viewBox="0 0 1200 1200" xmlns:xlink="http://www.w3.org/1999/xlink">
     <defs>
      <style type="text/css">
       <![CDATA[
        #modeIcon .vw-str0 {stroke:black;stroke-width:10}
        #modeIcon .vw-str1 {stroke:#C9C7C7;stroke-width:10}
        #modeIcon .vw-fil1 {fill:none}
        #modeIcon .vw-fil2 {fill:#2196F3}
        #modeIcon .vw-fil3 {fill:#4D1F1F}
        #modeIcon .vw-fil0 {fill:#EBE8E8}
        #modeIcon .vw-fil4 {fill:#EBE8E8}
       ]]>
      </style>
     </defs>
     <g id="Layer_x0020_1">
      <metadata id="CorelCorpID_0Corel-Layer"/>
      <path class="vw-fil0 vw-str0" d="M192 647c108,118 260,185 419,185 160,0 312,-67 420,-185 -86,-151 -246,-244 -420,-244 -173,0 -334,93 -419,244z"/>
      <path class="vw-fil1 vw-str0" d="M435 437c-101,148 -91,274 31,376"/>
      <path class="vw-fil1 vw-str0" d="M798 441c81,120 81,241 0,362"/>
      <path class="vw-fil2" d="M608 832c64,0 126,-11 185,-32 78,-118 77,-236 -2,-354 -57,-24 -119,-37 -183,-37 -61,0 -120,11 -174,33 -99,146 -89,270 31,371 46,13 94,19 143,19z"/>
      <ellipse class="vw-fil3 vw-str1" cx="609" cy="620" rx="150" ry="138"/>
      <ellipse class="vw-fil4" cx="545" cy="547" rx="78" ry="72"/>
     </g>
    </svg>`;
    saveBtn.classList.remove("hidden");
    toolbox.classList.remove("hidden");
    canvas.classList.add("editing-active");
    if (layersBtn) layersBtn.classList.remove("hidden");
    if (btnPalette && window.isAdmin) btnPalette.classList.remove("hidden");
    document.getElementById("btnUndo")?.classList.remove("hidden");
    document.getElementById("btnRedo")?.classList.remove("hidden");
  } else {
    // Edit/Pencil icon (Edit Mode)
    icon.outerHTML = `<svg id="modeIcon" xmlns="http://www.w3.org/2000/xlink" xml:space="preserve" width="28" height="28" version="1.1" style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd; width: 28px; height: 28px;" viewBox="0 0 1200 1200" xmlns="http://www.w3.org/2000/svg">
     <defs>
      <style type="text/css">
       <![CDATA[
        #modeIcon .eb-str0 {stroke:#189DC9;stroke-width:20;stroke-dasharray:40.000000 20.000000}
        #modeIcon .eb-fil1 {fill:none}
        #modeIcon .eb-fil3 {fill:#4D4D4D}
        #modeIcon .eb-fil2 {fill:#706C6C}
        #modeIcon .eb-fil6 {fill:#8A8585}
        #modeIcon .eb-fil0 {fill:#95B4BF}
        #modeIcon .eb-fil8 {fill:#B8B6B6}
        #modeIcon .eb-fil4 {fill:#C9C7C7}
        #modeIcon .eb-fil7 {fill:#D6D3D3}
        #modeIcon .eb-fil5 {fill:#DEDEDE}
       ]]>
      </style>
     </defs>
     <g id="Layer_x0020_1">
      <metadata id="CorelCorpID_0Corel-Layer"/>
      <g id="_2643362114304">
       <ellipse class="eb-fil0" cx="564" cy="705" rx="143" ry="58"/>
       <rect class="eb-fil1 eb-str0" x="229" y="338" width="744" height="626"/>
       <g>
        <path class="eb-fil2" d="M831 171c-9,-5 -19,-1 -24,8l-19 42 32 16 20 -42c4,-9 1,-20 -9,-24z"/>
        <polygon class="eb-fil3" points="762,205 605,515 691,559 849,249 "/>
        <polygon class="eb-fil2" points="768,209 610,518 636,532 789,219 "/>
        <polygon class="eb-fil4" points="788,218 777,241 837,272 849,249 "/>
        <polygon class="eb-fil5" points="762,204 750,227 777,241 788,217 "/>
        <path class="eb-fil4" d="M683 243l-140 265c-4,8 -1,18 7,22l7 4 136 -258c-8,-9 -12,-21 -10,-33z"/>
        <path class="eb-fil6" d="M685 232l0 0c10,-20 34,-27 54,-17l16 9 -37 71 -16 -9c-20,-10 -27,-34 -17,-54z"/>
        <polygon class="eb-fil7" points="605,512 553,648 582,661 612,673 691,556 "/>
        <polygon class="eb-fil8" points="612,516 560,652 575,658 638,529 "/>
        <polygon class="eb-fil3" points="554,647 559,676 564,705 589,688 613,672 583,659 "/>
       </g>
      </g>
     </g>
    </svg>`;
    saveBtn.classList.add("hidden");
    toolbox.classList.add("hidden");
    drawer.classList.add("hidden");
    canvas.classList.remove("editing-active");
    if (layersBtn) layersBtn.classList.add("hidden");
    if (layersPanel) layersPanel.classList.add("hidden");
    if (btnPalette) btnPalette.classList.add("hidden");
    document.getElementById("paletteHeaderContainer")?.classList.add("hidden");
    document.getElementById("btnUndo")?.classList.add("hidden");
    document.getElementById("btnRedo")?.classList.add("hidden");
    deselectAll();
  }
  renderCanvas();
}

// Selection
function selectElement(id) {
  const canvasScrollable = getCanvasScrollable();
  if (selectedElementId === null && canvasScrollable) {
    originalScrollTop = canvasScrollable.scrollTop;
  }

  selectedElementId = id;
  document.querySelectorAll(".builder-element").forEach((el) => {
    el.classList.remove("active-element");
  });
  const el = document.getElementById(id);
  if (el) {
    el.classList.add("active-element");
    if (canvasScrollable) {
      setTimeout(() => {
        // Hitung koordinat Y absolut elemen di dalam kanvas secara manual untuk menghindari scrolling window browser
        let totalOffsetTop = 0;
        let current = el;
        while (current && current !== canvasScrollable) {
          totalOffsetTop += current.offsetTop;
          current = current.offsetParent;
        }

        // Tampilkan/Buat elemen spacer kosong dinamis di bawah untuk memicu scrollHeight kanvas
        let spacer = document.getElementById("canvasScrollSpacer");
        if (!spacer) {
          spacer = document.createElement("div");
          spacer.id = "canvasScrollSpacer";
          spacer.style.width = "100%";
          spacer.style.pointerEvents = "none";
          canvasScrollable.appendChild(spacer);
        }

        const drawer = document.getElementById("propertiesDrawer");
        const drawerHeight = drawer ? drawer.offsetHeight : 0;
        const safeDrawerHeight = drawerHeight || 400;

        // Atur tinggi spacer secara dinamis: koordinat elemen + tinggi laci drawer + batas margin
        spacer.style.height = (totalOffsetTop + safeDrawerHeight + 100) + "px";
        spacer.style.display = "block";

        // Terapkan scroll ke atas kanvas saja secara terarah
        if (typeof canvasScrollable.scrollTo === "function") {
          canvasScrollable.scrollTo({
            top: totalOffsetTop,
            behavior: "smooth"
          });
        } else {
          canvasScrollable.scrollTop = totalOffsetTop;
        }
      }, 100);
    }
  }

  // Tampilkan properties drawer
  const drawer = document.getElementById("propertiesDrawer");
  drawer.classList.remove("hidden");
  document.getElementById("drawerTitle").innerText = "Pengaturan Elemen";

  document.getElementById("bgSettingsPanel").classList.add("hidden");
  document.getElementById("elementPropertiesPanel").classList.remove("hidden");

  const data = elements.find((item) => item.id === id);
  if (data) {
    // Sembunyikan semua group khusus
    document.getElementById("groupText").classList.add("hidden");
    document.getElementById("groupImage").classList.add("hidden");
    document.getElementById("groupShape").classList.add("hidden");
    document.getElementById("groupButton").classList.add("hidden");
    const groupCarousel = document.getElementById("groupCarousel");
    if (groupCarousel) groupCarousel.classList.add("hidden");
    const groupRow = document.getElementById("groupRow");
    if (groupRow) groupRow.classList.add("hidden");
    const groupColumn = document.getElementById("groupColumn");
    if (groupColumn) groupColumn.classList.add("hidden");
    const groupMediaEmbed = document.getElementById("groupMediaEmbed");
    if (groupMediaEmbed) groupMediaEmbed.classList.add("hidden");

    // Tampilkan group yang sesuai
    if (data.type === "title" || data.type === "text") {
      document.getElementById("groupText").classList.remove("hidden");
      document.getElementById("groupShape").classList.remove("hidden");
      document.getElementById("propTextContent").value = data.content;
      document.getElementById("propFontSize").value =
        parseInt(data.style.fontSize) || 16;
      document.getElementById("fontSizeVal").innerText =
        parseInt(data.style.fontSize) || 16;
      document.getElementById("propFontWeight").value =
        data.style.fontWeight || "400";
      document.getElementById("propTextColor").value =
        rgbToHex(data.style.color) || "#2c5d6b";
      document.getElementById("propTextColorHex").innerText =
        data.style.color || "#2c5d6b";
      document.getElementById("propTextAlign").value =
        data.style.textAlign || "left";

      // Reset AI Assist panel state
      const suggestionsArea = document.getElementById("aiSuggestionsArea");
      if (suggestionsArea) suggestionsArea.classList.add("hidden");
      const promptInput = document.getElementById("propAiPrompt");
      if (promptInput) promptInput.value = "";
    } else if (data.type === "image") {
      document.getElementById("groupImage").classList.remove("hidden");
      document.getElementById("groupShape").classList.remove("hidden");
      const urlInput = document.getElementById("propImageUrl");
      if (urlInput) urlInput.value = data.imageSrc || "";
      document.getElementById("propObjectFit").value =
        data.style.objectFit || "cover";
    } else if (data.type === "shape" || data.type === "container") {
      document.getElementById("groupShape").classList.remove("hidden");
      document.getElementById("propShapeBlur").value =
        data.style.backdropFilter || "none";
    } else if (data.type === "row") {
      document.getElementById("groupShape").classList.remove("hidden");
      if (groupRow) {
        groupRow.classList.remove("hidden");
        const colChildren = elements.filter(el => el.parentId === data.id && el.type === "column");
        document.getElementById("propRowColumnsCount").value = colChildren.length || 1;
      }
    } else if (data.type === "column") {
      document.getElementById("groupShape").classList.remove("hidden");
      if (groupColumn) {
        groupColumn.classList.remove("hidden");
        document.getElementById("propColumnWidth").value = data.style.width || "100%";
      }
    } else if (data.type === "media_embed") {
      if (groupMediaEmbed) {
        groupMediaEmbed.classList.remove("hidden");
        document.getElementById("propMediaEmbedUrl").value = data.url || "";
      }
    } else if (data.type === "button") {
      document.getElementById("groupButton").classList.remove("hidden");
      document.getElementById("groupShape").classList.remove("hidden");
      document.getElementById("propBtnText").value = data.content;
      document.getElementById("propBtnUrl").value = data.url || "";
      document.getElementById("propBtnTextColor").value =
        rgbToHex(data.style.color) || "#ffffff";
      document.getElementById("propBtnTextColorHex").innerText =
        data.style.color || "#ffffff";
    } else if (data.type === "carousel") {
      if (groupCarousel) {
        groupCarousel.classList.remove("hidden");
        const carouselInput = document.getElementById("propCarouselImages");
        if (carouselInput) carouselInput.value = (data.carouselImages || defaultCarouselImages).join("\n");
        document.getElementById("propCarouselSpeed").value = data.carouselSpeed !== undefined ? data.carouselSpeed : 3;
        renderCarouselThumbnails();
      }
    }

    // ── General fields + sync all sliders ──────────────────────────────────
    loadFillStrokePanel(data);

    // Width slider (existing)
    const wVal = parseInt(data.style.width) || 80;
    document.getElementById("propWidth").value = wVal;
    document.getElementById("widthVal").innerText = wVal;

    // Height slider
    const hVal = data.style.height;
    const hNum = hVal === "auto" ? 100 : (parseInt(hVal) || 100);
    document.getElementById("propHeight").value = hVal === "auto" ? "" : hNum;
    document.getElementById("propHeightSlider").value = Math.min(hNum, 800);
    document.getElementById("heightVal").innerText = hVal === "auto" ? "Auto" : hNum;

    // Top (Posisi Y) slider
    const topPxInput = document.getElementById("propTopPx");
    const topPxSlider = document.getElementById("propTopPxSlider");
    const topPxLabel = document.getElementById("topPxVal");
    if (topPxInput && topPxSlider && topPxLabel) {
      if (!data.parentId) {
        let tpx = 0;
        if (data.style.top && data.style.top.includes('%')) {
          const canvasH = canvas.scrollHeight || canvas.offsetHeight;
          const topPercent = parseFloat(data.style.top) || 0;
          tpx = Math.round((topPercent / 100) * canvasH);
        } else {
          tpx = Math.round(parseFloat(data.style.top)) || 0;
        }
        topPxInput.value = tpx;
        topPxInput.placeholder = "Contoh: 120";
        topPxSlider.value = Math.min(tpx, 2000);
        topPxLabel.innerText = tpx;
      } else {
        topPxInput.value = "";
        topPxInput.placeholder = "(di dalam container)";
        topPxSlider.value = 0;
        topPxLabel.innerText = 0;
      }
    }

    // Gap bottom slider
    const gapVal = parseInt(data.style.gapBottom) || 0;
    const gapBottomInput = document.getElementById("propGapBottom");
    const gapBottomSlider = document.getElementById("propGapBottomSlider");
    const gapBottomLabel = document.getElementById("gapBottomVal");
    if (gapBottomInput) gapBottomInput.value = gapVal;
    if (gapBottomSlider) gapBottomSlider.value = Math.min(gapVal, 200);
    if (gapBottomLabel) gapBottomLabel.innerText = gapVal;

    // Z-Index slider
    const zVal = parseInt(data.style.zIndex) || 5;
    document.getElementById("propZIndex").value = zVal;
    document.getElementById("propZIndexSlider").value = Math.min(zVal, 100);
    document.getElementById("zIndexVal").innerText = zVal;

    // Border fields
    document.getElementById("propBorderRadius").value =
      parseInt(data.style.borderRadius) || 8;
    document.getElementById("propBorderStyle").value =
      data.style.borderStyle || "none";
    document.getElementById("propBorderColor").value =
      rgbToHex(data.style.borderColor) || "#38a0c4";
    document.getElementById("propBorderColorHex").innerText =
      data.style.borderColor || "#38a0c4";
    document.getElementById("propBorderWidth").value =
      parseInt(data.style.borderWidth) || 1;

    // Load Alignment options in drawer
    const alignSelect = document.getElementById("propAlignment");
    if (alignSelect) {
      if (data.parentId) {
        alignSelect.value = data.style.alignSelf === "flex-start" ? "left" : data.style.alignSelf === "flex-end" ? "right" : data.style.alignSelf || "left";
      } else {
        const leftVal = parseFloat(data.style.left) || 0;
        const widthVal = parseFloat(data.style.width) || 80;
        const centerTolerance = 2;
        if (Math.abs(leftVal - 0) < centerTolerance) {
          alignSelect.value = "left";
        } else if (Math.abs(leftVal - (100 - widthVal) / 2) < centerTolerance) {
          alignSelect.value = "center";
        } else if (Math.abs(leftVal - (100 - widthVal)) < centerTolerance) {
          alignSelect.value = "right";
        } else {
          alignSelect.value = "left";
        }
      }
    }

    // Load Padding options in drawer
    const padVal = data.style.padding ? parseInt(data.style.padding) : 0;
    const padInput = document.getElementById("propPadding");
    if (padInput) {
      padInput.value = padVal;
      document.getElementById("paddingVal").innerText = padVal;
    }

    toggleBorderColorGroup(data.style.borderStyle || "none");

    // Refresh layers highlight
    const layersPanel = document.getElementById("layersPanel");
    if (layersPanel && !layersPanel.classList.contains("hidden")) {
      renderLayersPanelContent();
    }
  }
}

function deselectAll() {
  selectedElementId = null;
  document.querySelectorAll(".builder-element").forEach((el) => {
    el.classList.remove("active-element");
  });
  document.getElementById("propertiesDrawer").classList.add("hidden");

  // Bersihkan kembali elemen spacer di kanvas saat drawer ditutup
  const spacer = document.getElementById("canvasScrollSpacer");
  if (spacer) {
    spacer.style.display = "none";
    spacer.style.height = "0px";
  }

  const canvasScrollable = getCanvasScrollable();
  if (canvasScrollable) {
    // Kembalikan posisi scroll kanvas ke posisi awal sebelum melakukan edit
    if (originalScrollTop !== null) {
      if (typeof canvasScrollable.scrollTo === "function") {
        canvasScrollable.scrollTo({
          top: originalScrollTop,
          behavior: "smooth"
        });
      } else {
        canvasScrollable.scrollTop = originalScrollTop;
      }
      originalScrollTop = null;
    }
  }
}


// Click outside to deselect
canvas.addEventListener("click", (e) => {
  if (e.target === canvas) {
    deselectAll();
  }
});

// OPEN BG SETTINGS PANEL
function openBgSettings() {
  deselectAll();
  const drawer = document.getElementById("propertiesDrawer");
  drawer.classList.remove("hidden");
  document.getElementById("drawerTitle").innerText = "Latar Belakang";
  document.getElementById("bgSettingsPanel").classList.remove("hidden");
  document.getElementById("elementPropertiesPanel").classList.add("hidden");
}

// SNAP GUIDE HELPER
const SNAP_THRESHOLD = 10; // px

function showSnapGuide(topPx) {
  const guide = document.getElementById("snapGuideLine");
  if (!guide) return;
  guide.style.top = topPx + "px";
  guide.style.display = "block";
  // re-trigger animation
  guide.style.animation = "none";
  guide.offsetHeight; // reflow
  guide.style.animation = "";
}

function hideSnapGuide() {
  const guide = document.getElementById("snapGuideLine");
  if (guide) guide.style.display = "none";
}

function getCanvasScrollable() {
  return document.querySelector(".canvas-workspace") || document.getElementById("canvas");
}

// Get all root elements' bottom edges in px (excluding the dragged element)
function getSnapEdges(excludeId) {
  const canvasRect = canvas.getBoundingClientRect();
  const scrollTop = getCanvasScrollable().scrollTop || 0;
  const edges = [];
  elements.forEach(item => {
    if (item.id === excludeId || item.parentId) return;
    const el = document.getElementById(item.id);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const bottomPx = r.bottom - canvasRect.top + scrollTop;
    const topPx = r.top - canvasRect.top + scrollTop;
    edges.push({ id: item.id, top: topPx, bottom: bottomPx });
  });
  return edges;
}

// DRAGGING & RESIZING EVENTS ON DOCUMENT
document.addEventListener("mousemove", (e) => {
  if (isDragging && dragEl) {
    const canvasRect = canvas.getBoundingClientRect();
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;

    // Hitung posisi baru langsung dalam px
    let rawTopPx = dragStartTop + dy;
    let rawLeftPx = dragStartLeft + dx;

    // Snap logic: periksa apakah batas bawah komponen lain berada di dekatnya
    let snapped = false;
    const edges = getSnapEdges(dragEl.id);
    const gapBottom = parseInt((elements.find(i => i.id === dragEl.id) || {}).style?.gapBottom) || 0;
    for (const edge of edges) {
      const targetTopPx = edge.bottom + gapBottom;
      if (Math.abs(rawTopPx - targetTopPx) <= SNAP_THRESHOLD) {
        rawTopPx = targetTopPx;
        snapped = true;
        showSnapGuide(edge.bottom);
        break;
      }
      // Snap ke batas atas
      if (Math.abs(rawTopPx - edge.top) <= SNAP_THRESHOLD) {
        rawTopPx = edge.top;
        snapped = true;
        showSnapGuide(edge.top);
        break;
      }
    }
    if (!snapped) hideSnapGuide();

    // Ubah kiri ke persentase agar responsif, top tetap px untuk tinggi dinamis stabil
    const newLeftPercent = Math.max(0, Math.min(100, (rawLeftPx / canvasRect.width) * 100));

    dragEl.style.left = `${newLeftPercent.toFixed(2)}%`;
    dragEl.style.top = `${rawTopPx.toFixed(0)}px`;

    const data = elements.find((item) => item.id === dragEl.id);
    if (data) {
      data.style.left = dragEl.style.left;
      data.style.top = dragEl.style.top;
    }

    // Update propTopPx di drawer
    const topPxInput = document.getElementById("propTopPx");
    if (topPxInput && selectedElementId === dragEl.id) {
      topPxInput.value = Math.round(rawTopPx);
    }

    // Sesuaikan tinggi kanvas secara dinamis saat digeser agar tidak mentok
    adjustCanvasHeight();
  } else if (isResizing && resizeEl) {
    const rect = canvas.getBoundingClientRect();
    const dx = e.clientX - resizeStartX;
    const dy = e.clientY - resizeStartY;

    const newWidthPx = resizeStartWidth + dx;
    const newHeightPx = resizeStartHeight + dy;

    const newWidthPercent = (newWidthPx / rect.width) * 100;

    const clampedWidth = Math.max(5, Math.min(100, newWidthPercent));
    resizeEl.style.width = `${clampedWidth.toFixed(2)}%`;
    resizeEl.style.height = `${Math.max(15, newHeightPx)}px`;

    const data = elements.find((item) => item.id === resizeEl.id);
    if (data) {
      data.style.width = resizeEl.style.width;
      data.style.height = resizeEl.style.height;
    }

    // Update input fields in drawer if it's currently selected
    if (selectedElementId === resizeEl.id) {
      document.getElementById("propWidth").value = parseInt(clampedWidth);
      document.getElementById("widthVal").innerText = parseInt(clampedWidth);
      document.getElementById("propHeight").value = Math.max(15, newHeightPx);
    }
  }
});

document.addEventListener("mouseup", () => {
  if (isDragging || isResizing) {
    pushHistory();
  }
  isDragging = false;
  isResizing = false;
  dragEl = null;
  resizeEl = null;
  hideSnapGuide();
});

// HTML5 DRAG AND DROP FROM TOOLBOX
document.querySelectorAll('.toolbox-chip[draggable="true"]').forEach((item) => {
  item.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/type", item.dataset.type);
  });
});

canvas.addEventListener("dragover", (e) => {
  e.preventDefault();
});

canvas.addEventListener("drop", (e) => {
  e.preventDefault();
  if (!isEditMode) return;

  const type = e.dataTransfer.getData("text/type");
  if (!type) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const left = (x / rect.width) * 100;
  const top = y; // Pass absolute Y pixel distance

  createNewElement(type, left, top);
});

function createNewElement(type, left = 10, top = 30, parentId = null) {
  const id = "el-" + Math.random().toString(36).substr(2, 9);

  const isTitle = type === "title";
  const isBtn = type === "button";
  const defaultWidth = parentId ? "100%" : (isTitle ? "90%" : (isBtn ? "76%" : "80%"));
  const defaultLeft = parentId ? "auto" : `${((100 - parseFloat(defaultWidth)) / 2).toFixed(2)}%`;

  let newElement = {
    id: id,
    type: type,
    parentId: parentId,
    content:
      type === "button"
        ? "Hubungi WhatsApp"
        : type === "title"
          ? "Judul Baru"
          : "Masukkan penjelasan lengkap tentang produk atau layanan usaha Anda di sini...",
    style: {
      top: parentId ? "auto" : (typeof top === "number" ? (top <= 100 ? `${Math.round((top / 100) * 800)}px` : `${Math.round(top)}px`) : top),
      left: defaultLeft,
      width: defaultWidth,
      height: "auto",
      zIndex: "5",
      borderRadius: "8px",
    },
  };

  if (type === "title") {
    newElement.style.color = "#2c5d6b";
    newElement.style.fontSize = "24px";
    newElement.style.fontWeight = "700";
    newElement.style.textAlign = "center";
  } else if (type === "text") {
    newElement.style.color = "#7a8a94";
    newElement.style.fontSize = "14px";
    newElement.style.fontWeight = "400";
    newElement.style.textAlign = "left";
  } else if (type === "image") {
    newElement.imageSrc = "";
    newElement.style.height = "150px";
    newElement.style.objectFit = "cover";
  } else if (type === "shape") {
    newElement.style.backgroundColor = "rgba(56, 160, 196, 0.1)";
    newElement.style.height = "100px";
    newElement.style.borderStyle = "solid";
    newElement.style.borderColor = "rgba(56, 160, 196, 0.2)";
    newElement.style.borderWidth = "1px";
  } else if (type === "container") {
    newElement.style.backgroundColor = "rgba(255, 255, 255, 0.8)";
    newElement.style.height = "120px";
    newElement.style.borderStyle = "dashed";
    newElement.style.borderColor = "rgba(56, 160, 196, 0.3)";
    newElement.style.borderWidth = "2px";
    newElement.style.padding = "10px";
  } else if (type === "column") {
    newElement.style.backgroundColor = "rgba(255, 255, 255, 0.5)";
    newElement.style.height = "auto";
    newElement.style.padding = "10px";
    newElement.style.borderStyle = "solid";
    newElement.style.borderColor = "rgba(56, 160, 196, 0.1)";
    newElement.style.borderWidth = "1px";
  } else if (type === "row") {
    newElement.style.backgroundColor = "rgba(255, 255, 255, 0.5)";
    newElement.style.height = "auto";
    newElement.style.padding = "10px";
    newElement.style.borderStyle = "solid";
    newElement.style.borderColor = "rgba(56, 160, 196, 0.1)";
    newElement.style.borderWidth = "1px";

    // Default to contain 1 column initially so dropping items works right away
    setTimeout(() => {
      selectElement(id);
      updateRowColumnsCount(1);
    }, 50);
  } else if (type === "carousel") {
    newElement.carouselImages = [...defaultCarouselImages];
    newElement.carouselSpeed = 3;
    newElement.carouselActiveIndex = 0;
    newElement.style.height = "200px";
    newElement.style.borderRadius = "12px";
  } else if (type === "button") {
    newElement.url = "https://wa.me/#";
    newElement.style.backgroundColor = "#38a0c4";
    newElement.style.color = "#ffffff";
    newElement.style.height = "45px";
    newElement.style.textAlign = "center";
  } else if (type === "media_embed") {
    newElement.url = "";
    newElement.style.height = "250px";
    newElement.style.borderRadius = "12px";
  }

  elements.push(newElement);
  renderCanvas();
  selectElement(id);
  pushHistory();
}

// UPDATE SELECTED ELEMENT PROPERTIES
function updateSelectedElementContent() {
  const data = elements.find((item) => item.id === selectedElementId);
  if (!data) return;

  const input =
    data.type === "button"
      ? document.getElementById("propBtnText")
      : document.getElementById("propTextContent");
  data.content = input.value;

  const div = document.getElementById(selectedElementId);
  if (div) {
    const inner = div.firstElementChild;
    if (inner) inner.innerText = data.content;
  }
  adjustCanvasHeight();
  pushHistoryDebounced();
}

function updateSelectedElementStyle(key, val) {
  const data = elements.find((item) => item.id === selectedElementId);
  if (!data) return;

  data.style[key] = val;

  // Auto-center root elements if width is changed
  if (key === "width" && !data.parentId) {
    const wVal = parseFloat(val);
    if (!isNaN(wVal)) {
      const leftVal = `${((100 - wVal) / 2).toFixed(2)}%`;
      data.style.left = leftVal;
      const div = document.getElementById(selectedElementId);
      if (div) div.style.left = leftVal;
    }
  }

  // Update Hex labels in panel
  if (key === "color" && data.type === "button")
    document.getElementById("propBtnTextColorHex").innerText = val;
  else if (key === "color")
    document.getElementById("propTextColorHex").innerText = val;
  else if (key === "backgroundColor" && data.type === "button")
    document.getElementById("propBtnBgHex").innerText = val;
  else if (key === "backgroundColor")
    document.getElementById("propShapeBgHex").innerText = val;
  else if (key === "borderColor")
    document.getElementById("propBorderColorHex").innerText = val;

  if (key === "borderStyle") toggleBorderColorGroup(val);

  // Re-apply to canvas
  const div = document.getElementById(selectedElementId);
  if (div) {
    if (
      [
        "width",
        "height",
        "zIndex",
        "borderRadius",
        "borderStyle",
        "borderColor",
        "borderWidth",
        "padding",
        "boxShadow",
        "outline",
      ].includes(key)
    ) {
      div.style[key] = val;
    }
    const inner = div.firstElementChild;
    if (inner) {
      applyElementStyles(inner, data.style);
    }
  }
  pushHistoryDebounced();
}

function updateSelectedElementBlur(val) {
  const data = elements.find((item) => item.id === selectedElementId);
  if (!data) return;

  if (val === "none") {
    delete data.style.backdropFilter;
    delete data.style.webkitBackdropFilter;
  } else {
    data.style.backdropFilter = val;
    data.style.webkitBackdropFilter = val;
  }

  const div = document.getElementById(selectedElementId);
  if (div) {
    const inner = div.firstElementChild;
    if (inner) {
      inner.style.backdropFilter = val;
      inner.style.webkitBackdropFilter = val;
    }
  }
}

function updateSelectedElementImageSrc(val) {
  const data = elements.find((item) => item.id === selectedElementId);
  if (!data || data.type !== "image") return;

  data.imageSrc = val;
  const div = document.getElementById(selectedElementId);
  if (div) {
    const img = div.firstElementChild;
    if (img) img.src = val;
  }
}

function updateSelectedElementLink(val) {
  const data = elements.find((item) => item.id === selectedElementId);
  if (!data || data.type !== "button") return;
  data.url = val;
}

// UPLOAD LOCAL IMAGE AND CONVERT TO BASE64
function uploadElementImage(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    updateSelectedElementImageSrc(e.target.result);
    const urlInput = document.getElementById("propImageUrl");
    if (urlInput) urlInput.value = "Image Base64 Data Loaded";
  };
  reader.readAsDataURL(file);
}

function toggleBorderColorGroup(style) {
  const group = document.getElementById("borderColorGroup");
  if (style === "none") {
    group.classList.add("hidden");
  } else {
    group.classList.remove("hidden");
  }
}

// DELETE SELECTED ELEMENT
function deleteSelectedElement() {
  if (!selectedElementId) return;
  deleteElementById(selectedElementId);
}

// BACKGROUND STYLE MANAGEMENT
function updateBgStyle() {
  const type = document.getElementById("bgType").value;
  const solidGroup = document.getElementById("solidBgGroup");
  const gradGroup = document.getElementById("gradientBgGroup");
  const imageGroup = document.getElementById("imageBgGroup");

  let bgOverlay = document.getElementById("canvasBgImageOverlay");
  if (bgOverlay) {
    bgOverlay.style.display = "none";
  }

  if (type === "color") {
    solidGroup.classList.remove("hidden");
    gradGroup.classList.add("hidden");
    if (imageGroup) imageGroup.classList.add("hidden");
    canvas.style.backgroundImage = "none";
    const color = document.getElementById("bgSolidColor").value;
    document.getElementById("bgSolidHex").innerText = color;
    canvas.style.background = color;
  } else if (type === "gradient") {
    solidGroup.classList.add("hidden");
    gradGroup.classList.remove("hidden");
    if (imageGroup) imageGroup.classList.add("hidden");
    canvas.style.backgroundImage = "none";
  } else if (type === "image") {
    solidGroup.classList.add("hidden");
    gradGroup.classList.add("hidden");
    if (imageGroup) imageGroup.classList.remove("hidden");
    const opacity = window.bgImageOpacity !== undefined ? window.bgImageOpacity : 1.0;
    if (window.bgImageSrc) {
      canvas.style.backgroundImage = `linear-gradient(rgba(242, 247, 249, ${1 - opacity}), rgba(242, 247, 249, ${1 - opacity})), url(${window.bgImageSrc})`;
      canvas.style.backgroundSize = "cover";
      canvas.style.backgroundPosition = "center";
      canvas.style.backgroundRepeat = "no-repeat";
    } else {
      canvas.style.backgroundImage = "none";
      canvas.style.background = "#f2f7f9";
    }
  }
}

function setPresetGradient(grad) {
  canvas.style.background = grad;
  pushHistory();
}

// SAVE TO SERVER NEO4J
function saveLandingPage() {
  const type = document.getElementById("bgType").value;
  let bgStyle = "";
  if (type === "color") {
    bgStyle = document.getElementById("bgSolidColor").value;
  } else if (type === "gradient") {
    bgStyle = canvas.style.background;
  }

  const payload = {
    elements: elements,
    background: {
      type: type,
      color: type === "color" ? bgStyle : "",
      style: bgStyle,
      imageSrc: type === "image" ? window.bgImageSrc : "",
      opacity: type === "image" ? window.bgImageOpacity : 1.0,
      canvasHeight: window.canvasHeight || ""
    },
  };

  fetch(`/api/actor/${actorId}/landing/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ landing_page_data: JSON.stringify(payload) }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.success) {
        const toast = document.getElementById("toast");
        toast.classList.add("show");
        setTimeout(() => toast.classList.remove("show"), 3000);
      }
    })
    .catch((err) => {
      console.error(err);
      alert("Gagal menyimpan desain.");
    });
}

// HELPER: Convert RGB value to HEX
function rgbToHex(rgb) {
  if (!rgb) return "#ffffff";
  if (rgb.startsWith("#")) return rgb;

  const match = rgb.match(
    /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/,
  );
  if (!match) return "#ffffff";

  const r = parseInt(match[1]).toString(16).padStart(2, "0");
  const g = parseInt(match[2]).toString(16).padStart(2, "0");
  const b = parseInt(match[3]).toString(16).padStart(2, "0");

  return `#${r}${g}${b}`;
}

// LAYER SYSTEM PANEL LOGIC
function toggleLayersPanel() {
  const panel = document.getElementById("layersPanel");
  if (!panel) return;
  panel.classList.toggle("hidden");

  if (!panel.classList.contains("hidden")) {
    renderLayersPanelContent();
  }
}

function renderLayersPanelContent() {
  const container = document.getElementById("layersContent");
  if (!container) return;
  container.innerHTML = "";

  if (elements.length === 0) {
    container.innerHTML = `<div class="empty-layers-msg">Belum ada komponen di canvas.</div>`;
    return;
  }

  // Group elements by parentId
  const childrenMap = {};
  elements.forEach(item => {
    if (item.parentId) {
      if (!childrenMap[item.parentId]) childrenMap[item.parentId] = [];
      childrenMap[item.parentId].push(item);
    }
  });

  const rootElements = elements.filter(item => !item.parentId || !elements.some(p => p.id === item.parentId));

  function createLayerItem(item, depth = 0) {
    const div = document.createElement("div");
    div.className = `layer-item ${selectedElementId === item.id ? "active" : ""}`;
    div.style.paddingLeft = `${depth * 16 + 10}px`;

    // Type label and content summary
    let typeName = item.type.toUpperCase();
    if (item.type === "title") typeName = "Judul";
    else if (item.type === "text") typeName = "Paragraf";
    else if (item.type === "shape") typeName = "Box";
    else if (item.type === "container") typeName = "Kontainer";
    else if (item.type === "column") typeName = "Kolom";
    else if (item.type === "row") typeName = "Baris";
    else if (item.type === "carousel") typeName = "Carousel";
    else if (item.type === "button") typeName = "Tombol";
    else if (item.type === "image") typeName = "Gambar";

    let labelText = `<strong>[${typeName}]</strong>`;
    if (item.content && item.type !== "column" && item.type !== "row" && item.type !== "container") {
      const truncated = item.content.length > 15 ? item.content.substr(0, 12) + "..." : item.content;
      labelText += ` - "${truncated}"`;
    } else {
      labelText += ` (${item.id.substr(3, 4)})`;
    }

    const info = document.createElement("span");
    info.className = "layer-info";
    info.innerHTML = labelText;
    div.appendChild(info);

    // Hover highlight
    div.addEventListener("mouseenter", () => {
      const el = document.getElementById(item.id);
      if (el) el.classList.add("highlight-element");
    });
    div.addEventListener("mouseleave", () => {
      const el = document.getElementById(item.id);
      if (el) el.classList.remove("highlight-element");
    });

    // Select on click
    div.addEventListener("click", (e) => {
      e.stopPropagation();
      selectElement(item.id);
    });

    // Action buttons container
    const actions = document.createElement("div");
    actions.className = "layer-actions-row";

    // Parent migration dropdown
    const selectParent = document.createElement("select");
    selectParent.className = "layer-parent-select";
    selectParent.title = "Pindah Parent";

    const optNone = document.createElement("option");
    optNone.value = "";
    optNone.text = "Canvas Utama";
    if (!item.parentId) optNone.selected = true;
    selectParent.appendChild(optNone);

    elements.forEach(other => {
      if (other.id !== item.id && ["shape", "container", "row", "column"].includes(other.type)) {
        let isDescendant = false;
        let checkParent = other.parentId;
        while (checkParent) {
          if (checkParent === item.id) {
            isDescendant = true;
            break;
          }
          const pEl = elements.find(x => x.id === checkParent);
          checkParent = pEl ? pEl.parentId : null;
        }

        if (!isDescendant) {
          const opt = document.createElement("option");
          opt.value = other.id;
          let otherType = other.type.toUpperCase();
          if (other.type === "shape") otherType = "Box";
          else if (other.type === "container") otherType = "Kontainer";
          else if (other.type === "column") otherType = "Kolom";
          else if (other.type === "row") otherType = "Baris";
          opt.text = `${otherType} (${other.id.substr(3, 4)})`;
          if (item.parentId === other.id) opt.selected = true;
          selectParent.appendChild(opt);
        }
      }
    });

    selectParent.addEventListener("change", (e) => {
      e.stopPropagation();
      const newParentId = e.target.value || null;
      changeElementParent(item.id, newParentId);
    });
    actions.appendChild(selectParent);

    // Delete button
    const delBtn = document.createElement("button");
    delBtn.className = "layer-del-btn";
    delBtn.innerHTML = `
      <img src="/static/image/icon/delete.svg" style="width: 16px; height: 16px;" alt="Hapus">
    `;
    delBtn.title = "Hapus";
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteElementById(item.id);
    });
    actions.appendChild(delBtn);

    div.appendChild(actions);
    container.appendChild(div);

    // Render children recursively
    const children = childrenMap[item.id] || [];
    children.forEach(child => {
      createLayerItem(child, depth + 1);
    });
  }

  rootElements.forEach(item => {
    createLayerItem(item, 0);
  });
}

function changeElementParent(elementId, newParentId) {
  const data = elements.find(item => item.id === elementId);
  if (!data) return;

  data.parentId = newParentId;

  if (!newParentId) {
    data.style.position = "absolute";
    data.style.left = "10%";
    data.style.top = "120px";
    data.style.width = "80%";
    data.style.height = "auto";
  } else {
    data.style.position = "relative";
    data.style.left = "auto";
    data.style.top = "auto";
    data.style.width = "100%";
    data.style.height = "auto";
  }

  renderCanvas();
  pushHistory();
}

function deleteElementById(elementId) {
  elements = elements.filter(item => item.id !== elementId);
  elements.forEach(item => {
    if (item.parentId === elementId) {
      item.parentId = null;
      item.style.position = "absolute";
      item.style.left = "10%";
      item.style.top = "120px";
      item.style.width = "80%";
      item.style.height = "auto";
    }
  });

  if (selectedElementId === elementId) {
    deselectAll();
    renderCanvas();
  } else {
    renderCanvas();
  }
  pushHistory();
}

// UPDATE TOP POSITION IN PX
function updateSelectedElementTopPx(val) {
  const data = elements.find(item => item.id === selectedElementId);
  if (!data || data.parentId) return;

  const px = parseInt(val);
  if (isNaN(px)) return;

  data.style.top = `${px}px`;

  const div = document.getElementById(selectedElementId);
  if (div) div.style.top = data.style.top;

  adjustCanvasHeight();
}

// UPDATE GAP BOTTOM (stored in style, used during snap)
function updateSelectedElementGapBottom(val) {
  const data = elements.find(item => item.id === selectedElementId);
  if (!data) return;
  data.style.gapBottom = val;
}

// SNAP ELEMENT BELOW THE NEAREST ELEMENT ABOVE IT
function snapElementBelowPrevious() {
  const data = elements.find(item => item.id === selectedElementId);
  if (!data || data.parentId) return;

  const canvasH = canvas.scrollHeight || canvas.offsetHeight;
  const canvasRect = canvas.getBoundingClientRect();
  const scrollTop = getCanvasScrollable().scrollTop || 0;

  let currentTopPx = 0;
  if (data.style.top && data.style.top.includes('%')) {
    const currentTopPct = parseFloat(data.style.top) || 0;
    currentTopPx = (currentTopPct / 100) * canvasH;
  } else {
    currentTopPx = parseFloat(data.style.top) || 0;
  }

  // Find the element whose bottom edge is closest above this element
  let closestBottom = null;
  let closestDist = Infinity;

  elements.forEach(item => {
    if (item.id === data.id || item.parentId) return;
    const el = document.getElementById(item.id);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const bottomPx = r.bottom - canvasRect.top + scrollTop;
    const dist = currentTopPx - bottomPx;
    // Only consider elements above the current top
    if (dist >= -4 && dist < closestDist) {
      closestDist = dist;
      closestBottom = bottomPx;
    }
  });

  if (closestBottom === null) {
    // No element above — snap to 0
    closestBottom = 0;
  }

  const gapBottom = parseInt(data.style.gapBottom) || 0;
  const newTopPx = closestBottom + gapBottom;

  data.style.top = `${newTopPx}px`;
  const div = document.getElementById(selectedElementId);
  if (div) div.style.top = data.style.top;

  // Update input
  const topPxInput = document.getElementById("propTopPx");
  if (topPxInput) topPxInput.value = Math.round(newTopPx);

  // Flash guide
  showSnapGuide(closestBottom);
  setTimeout(hideSnapGuide, 600);
  adjustCanvasHeight();
  pushHistory();
}

// PROPERTIES HANDLERS FOR ALIGNMENT AND PADDING
function updateSelectedElementAlignment(val) {
  const data = elements.find(item => item.id === selectedElementId);
  if (!data) return;

  if (data.parentId) {
    // Inside flex container: set alignSelf
    let flexVal = "stretch";
    if (val === "left") flexVal = "flex-start";
    else if (val === "center") flexVal = "center";
    else if (val === "right") flexVal = "flex-end";

    data.style.alignSelf = flexVal;
    const div = document.getElementById(selectedElementId);
    if (div) div.style.alignSelf = flexVal;
  } else {
    // Canvas root: update left absolute position coordinate based on width
    const width = parseFloat(data.style.width) || 80;
    let newLeft = "10%";
    if (val === "left") {
      newLeft = "0%";
    } else if (val === "center") {
      newLeft = `${((100 - width) / 2).toFixed(2)}%`;
    } else if (val === "right") {
      newLeft = `${(100 - width).toFixed(2)}%`;
    } else if (val === "stretch") {
      newLeft = "0%";
      data.style.width = "100%";
      const widthInput = document.getElementById("propWidth");
      if (widthInput) {
        widthInput.value = 100;
        document.getElementById("widthVal").innerText = 100;
      }
      const div = document.getElementById(selectedElementId);
      if (div) div.style.width = "100%";
    }
    data.style.left = newLeft;
    const div = document.getElementById(selectedElementId);
    if (div) div.style.left = newLeft;
  }

  // Refresh layer panel parent choices in case layout renders
  const layersPanel = document.getElementById("layersPanel");
  if (layersPanel && !layersPanel.classList.contains("hidden")) {
    renderLayersPanelContent();
  }
  pushHistory();
}

// CAROUSEL COMPONENT HELPERS
function createCarouselDOM(item) {
  const carousel = document.createElement("div");
  carousel.className = "element-carousel";

  const images = item.carouselImages && item.carouselImages.length > 0 ? item.carouselImages : defaultCarouselImages;

  if (images.length === 0) {
    const placeholder = document.createElement("div");
    placeholder.className = "empty-carousel-placeholder";
    placeholder.style.display = "flex";
    placeholder.style.flexDirection = "column";
    placeholder.style.alignItems = "center";
    placeholder.style.justifyContent = "center";
    placeholder.style.height = "100%";
    placeholder.style.background = "#e2edf0";
    placeholder.style.borderRadius = "12px";
    placeholder.style.color = "#7a8a94";
    placeholder.style.fontSize = "13px";
    placeholder.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 8px;">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
      <span>Carousel Kosong (Upload Gambar)</span>
    `;
    carousel.appendChild(placeholder);
    return carousel;
  }

  let activeIndex = item.carouselActiveIndex || 0;
  if (activeIndex >= images.length) activeIndex = 0;

  item.carouselActiveIndex = activeIndex;

  const slidesWrapper = document.createElement("div");
  slidesWrapper.className = "carousel-slides-wrapper";

  images.forEach((src, idx) => {
    const slide = document.createElement("div");
    slide.className = `carousel-slide ${idx === activeIndex ? "active" : ""}`;
    const img = document.createElement("img");
    img.src = src;
    img.className = "carousel-img";
    slide.appendChild(img);
    slidesWrapper.appendChild(slide);
  });
  carousel.appendChild(slidesWrapper);

  // Left arrow
  const prevBtn = document.createElement("button");
  prevBtn.className = "carousel-control prev";
  prevBtn.innerHTML = "&#10094;";
  prevBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    navigateCarousel(item.id, -1);
  });

  // Right arrow
  const nextBtn = document.createElement("button");
  nextBtn.className = "carousel-control next";
  nextBtn.innerHTML = "&#10095;";
  nextBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    navigateCarousel(item.id, 1);
  });

  carousel.appendChild(prevBtn);
  carousel.appendChild(nextBtn);

  // Dots
  const dotsContainer = document.createElement("div");
  dotsContainer.className = "carousel-dots";
  images.forEach((_, idx) => {
    const dot = document.createElement("span");
    dot.className = `carousel-dot ${idx === activeIndex ? "active" : ""}`;
    dot.addEventListener("click", (e) => {
      e.stopPropagation();
      setCarouselActiveIndex(item.id, idx);
    });
    dotsContainer.appendChild(dot);
  });
  carousel.appendChild(dotsContainer);

  return carousel;
}

function navigateCarousel(elementId, direction) {
  const data = elements.find(item => item.id === elementId);
  if (!data) return;

  const images = data.carouselImages && data.carouselImages.length > 0 ? data.carouselImages : defaultCarouselImages;
  let activeIndex = data.carouselActiveIndex || 0;
  activeIndex = (activeIndex + direction + images.length) % images.length;
  data.carouselActiveIndex = activeIndex;

  renderCanvas();
}

function setCarouselActiveIndex(elementId, idx) {
  const data = elements.find(item => item.id === elementId);
  if (!data) return;
  data.carouselActiveIndex = idx;
  renderCanvas();
}

function startCarouselAutoplay(item) {
  if (carouselIntervals[item.id]) {
    clearInterval(carouselIntervals[item.id]);
    delete carouselIntervals[item.id];
  }

  const speed = item.carouselSpeed !== undefined ? parseInt(item.carouselSpeed) : 3;
  if (speed > 0 && !isEditMode) {
    carouselIntervals[item.id] = setInterval(() => {
      const images = item.carouselImages && item.carouselImages.length > 0 ? item.carouselImages : defaultCarouselImages;
      let activeIndex = item.carouselActiveIndex || 0;
      activeIndex = (activeIndex + 1) % images.length;
      item.carouselActiveIndex = activeIndex;

      const div = document.getElementById(item.id);
      if (div) {
        const slides = div.querySelectorAll(".carousel-slide");
        const dots = div.querySelectorAll(".carousel-dot");
        slides.forEach((slide, idx) => {
          if (idx === activeIndex) slide.classList.add("active");
          else slide.classList.remove("active");
        });
        dots.forEach((dot, idx) => {
          if (idx === activeIndex) dot.classList.add("active");
          else dot.classList.remove("active");
        });
      }
    }, speed * 1000);
  }
}

function updateSelectedCarouselImages() {
  const data = elements.find(item => item.id === selectedElementId);
  if (!data || data.type !== "carousel") return;

  const carouselInput = document.getElementById("propCarouselImages");
  if (!carouselInput) return;
  const text = carouselInput.value;
  const urls = text.split("\n").map(line => line.trim()).filter(line => line.length > 0);
  data.carouselImages = urls.length > 0 ? urls : [...defaultCarouselImages];
  data.carouselActiveIndex = 0;

  renderCanvas();
}

function updateSelectedCarouselSpeed(val) {
  const data = elements.find(item => item.id === selectedElementId);
  if (!data || data.type !== "carousel") return;
  data.carouselSpeed = parseInt(val) || 0;

  startCarouselAutoplay(data);
}

// ══════════════════════════════════════════════════════════════
//  FILL & STROKE SYSTEM (Figma-like)
// ══════════════════════════════════════════════════════════════

let currentFillData = null;
let currentStrokeData = null;

// ── Helpers ────────────────────────────────────────────────────
function hexToRgba(hex, alpha) {
  if (!hex || typeof hex !== 'string') return `rgba(56,160,196,${alpha !== undefined ? alpha : 1})`;
  const clean = hex.startsWith('#') ? hex : '#' + hex;
  if (clean.length < 7) return `rgba(56,160,196,${alpha !== undefined ? alpha : 1})`;
  alpha = (alpha !== undefined) ? Math.max(0, Math.min(1, parseFloat(alpha))) : 1;
  const r = parseInt(clean.slice(1, 3), 16);
  const g = parseInt(clean.slice(3, 5), 16);
  const b = parseInt(clean.slice(5, 7), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(56,160,196,${alpha})`;
  return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
}

// ── Defaults ────────────────────────────────────────────────────
function getDefaultFillData(existingStyle, elementType) {
  // For text elements, fill controls text color (not background)
  if (elementType === 'title' || elementType === 'text') {
    const textColor = (existingStyle && rgbToHex(existingStyle.color)) || '#2c5d6b';
    const validColor = (textColor && textColor !== '#ffffff' && textColor !== '#000000') ? textColor : '#2c5d6b';
    // Detect if already using gradient-text
    let type = 'solid';
    if (existingStyle && existingStyle.backgroundClip === 'text' &&
      existingStyle.background && existingStyle.background.includes('gradient')) {
      type = existingStyle.background.includes('radial') ? 'radial' : 'linear';
    }
    return {
      enabled: true, type,
      color: validColor, opacity: 100,
      gradient: {
        angle: 135,
        stops: [
          { position: 0, color: '#38a0c4', opacity: 100 },
          { position: 100, color: '#e040fb', opacity: 100 }
        ]
      }
    };
  }

  // For non-text elements, fill = background color
  let color = '#38a0c4';
  let opacity = 100;
  let type = 'solid';
  if (existingStyle) {
    if (existingStyle.backgroundColor && existingStyle.backgroundColor !== 'transparent') {
      const h = rgbToHex(existingStyle.backgroundColor);
      if (h && h !== '#ffffff') color = h;
      const m = (existingStyle.backgroundColor + '').match(/rgba?\([\d,.\s]+,\s*([\d.]+)\)/);
      if (m) opacity = Math.round(parseFloat(m[1]) * 100);
    }
    if (existingStyle.background && existingStyle.background.includes('gradient')) {
      type = existingStyle.background.includes('radial') ? 'radial' : 'linear';
    }
  }
  return {
    enabled: true, type,
    color, opacity,
    gradient: {
      angle: 135,
      stops: [
        { position: 0, color, opacity: 100 },
        { position: 100, color: '#8d98e0', opacity: 100 }
      ]
    }
  };
}

function getDefaultStrokeData(existingStyle) {
  const hasBorder = existingStyle && existingStyle.borderStyle && existingStyle.borderStyle !== 'none';
  return {
    enabled: !!hasBorder,
    color: (existingStyle && rgbToHex(existingStyle.borderColor)) || '#38a0c4',
    opacity: 100,
    width: (existingStyle && parseInt(existingStyle.borderWidth)) || 1,
    position: 'inside'
  };
}

// ── Load panel from element data ──────────────────────────────
function loadFillStrokePanel(data) {
  if (!data.fillData) data.fillData = getDefaultFillData(data.style, data.type);
  if (!data.strokeData) data.strokeData = getDefaultStrokeData(data.style);
  currentFillData = data.fillData;
  currentStrokeData = data.strokeData;

  // Update context hint for text elements
  const hint = document.getElementById('fillContextHint');
  if (hint) {
    if (data.type === 'title' || data.type === 'text') {
      hint.textContent = 'Untuk teks: Solid = warna teks, Linear/Radial = gradient teks';
      hint.classList.remove('hidden');
    } else {
      hint.classList.add('hidden');
    }
  }

  renderFillPanel();
  renderStrokePanel();
}

// ── Build CSS gradient string ──────────────────────────────────
function buildGradientCss(fd) {
  const g = fd.gradient;
  if (!g || !g.stops || g.stops.length < 2) return 'transparent';
  const sorted = [...g.stops].sort((a, b) => a.position - b.position);
  const stopsCss = sorted.map(s => `${hexToRgba(s.color, s.opacity / 100)} ${s.position}%`).join(', ');
  if (fd.type === 'radial') return `radial-gradient(circle, ${stopsCss})`;
  return `linear-gradient(${g.angle || 135}deg, ${stopsCss})`;
}

// ── Apply fill+stroke to the DOM element ──────────────────────
function applyFillStroke() {
  const data = elements.find(item => item.id === selectedElementId);
  if (!data || !data.fillData || !data.strokeData) return;
  const fd = data.fillData;
  const sd = data.strokeData;
  const div = document.getElementById(selectedElementId);
  if (!div) return;

  const isTextEl = ['title', 'text'].includes(data.type);

  // Pick inner element based on type
  const inner = div.firstElementChild;

  // ── Fill ──────────────────────────────────────────────────────
  if (isTextEl) {
    // Text elements: solid = text color, gradient = background-clip:text trick
    const clearGradText = (el) => {
      el.style.background = '';
      el.style.backgroundClip = '';
      el.style.webkitBackgroundClip = '';
      el.style.webkitTextFillColor = '';
    };
    if (!fd.enabled) {
      data.style.color = 'transparent';
      delete data.style.background;
      delete data.style.backgroundClip;
      delete data.style.webkitBackgroundClip;
      delete data.style.webkitTextFillColor;
      if (inner) {
        inner.style.color = 'transparent';
        clearGradText(inner);
      }
    } else if (fd.type === 'solid') {
      const rgba = hexToRgba(fd.color, fd.opacity / 100);
      data.style.color = rgba;
      delete data.style.background;
      delete data.style.backgroundClip;
      delete data.style.webkitBackgroundClip;
      delete data.style.webkitTextFillColor;
      if (inner) {
        clearGradText(inner);
        inner.style.color = rgba;
      }
    } else {
      // Gradient text (background-clip trick)
      const gradCss = buildGradientCss(fd);
      data.style.background = gradCss;
      data.style.backgroundClip = 'text';
      data.style.webkitBackgroundClip = 'text';
      data.style.webkitTextFillColor = 'transparent';
      delete data.style.color;
      if (inner) {
        inner.style.background = gradCss;
        inner.style.backgroundClip = 'text';
        inner.style.webkitBackgroundClip = 'text';
        inner.style.webkitTextFillColor = 'transparent';
        inner.style.color = 'transparent';
      }
    }
  } else if (data.type === 'image') {
    // Image elements: fill color/gradient goes to background, opacity slider goes to image transparency
    const opacityVal = fd.opacity / 100;
    if (inner) {
      inner.style.opacity = opacityVal;
      if (!fd.enabled) {
        inner.style.background = '';
        inner.style.backgroundColor = 'transparent';
      } else {
        if (fd.type === 'solid') {
          const rgba = hexToRgba(fd.color, 1);
          inner.style.background = '';
          inner.style.backgroundColor = rgba;
        } else {
          const gradCss = buildGradientCss(fd);
          inner.style.backgroundColor = '';
          inner.style.background = gradCss;
        }
      }
    }
    // Update data state
    data.style.opacity = opacityVal;
    if (!fd.enabled) {
      data.style.backgroundColor = 'transparent';
      delete data.style.background;
    } else {
      if (fd.type === 'solid') {
        data.style.backgroundColor = hexToRgba(fd.color, 1);
        delete data.style.background;
      } else {
        data.style.background = buildGradientCss(fd);
        delete data.style.backgroundColor;
      }
    }
  }
  else {
    // Non-text elements: background fill
    if (!fd.enabled) {
      data.style.backgroundColor = 'transparent';
      delete data.style.background;
      if (inner) {
        inner.style.background = '';
        inner.style.backgroundColor = 'transparent';
      }
    } else if (fd.type === 'solid') {
      const rgba = hexToRgba(fd.color, fd.opacity / 100);
      data.style.backgroundColor = rgba;
      delete data.style.background;
      if (inner) {
        inner.style.background = '';
        inner.style.backgroundColor = rgba;
      }
    } else {
      const gradCss = buildGradientCss(fd);
      data.style.background = gradCss;
      delete data.style.backgroundColor;
      if (inner) {
        inner.style.backgroundColor = '';
        inner.style.background = gradCss;
      }
    }
  } // end fill

  // ── Stroke ────────────────────────────────────────────────────
  // Clear previous stroke styles on outer div
  div.style.border = 'none';
  div.style.outline = '';
  div.style.boxShadow = div.style.boxShadow && div.style.boxShadow.includes('inset') ? '' : div.style.boxShadow;
  delete data.style.outline;
  delete data.style.boxShadow;
  data.style.borderStyle = 'none';

  if (sd.enabled) {
    const sRgba = hexToRgba(sd.color, sd.opacity / 100);
    const w = Math.max(1, sd.width || 1);
    const borderStyle = sd.style || 'solid';

    if (sd.position === 'inside') {
      const shadow = `inset 0 0 0 ${w}px ${sRgba}`;
      div.style.boxShadow = shadow;
      div.style.border = 'none';
      data.style.boxShadow = shadow;
      data.style.borderStyle = 'none';
    } else if (sd.position === 'outside') {
      div.style.outline = `${w}px ${borderStyle} ${sRgba}`;
      div.style.border = 'none';
      data.style.outline = `${w}px ${borderStyle} ${sRgba}`;
      data.style.borderStyle = 'none';
    } else { // center
      div.style.border = `${w}px ${borderStyle} ${sRgba}`;
      data.style.borderStyle = borderStyle;
      data.style.borderColor = sRgba;
      data.style.borderWidth = `${w}px`;
    }
  }
  pushHistoryDebounced();
}

// ── Render fill panel state to UI ──────────────────────────────
function renderFillPanel() {
  const fd = currentFillData;
  const body = document.getElementById('fillBodyPanel');
  const eyeBtn = document.getElementById('btnFillToggle');
  if (!fd || !body || !eyeBtn) return;

  eyeBtn.classList.toggle('fs-active', fd.enabled);
  body.classList.toggle('hidden', !fd.enabled);
  if (!fd.enabled) return;

  ['Solid', 'Linear', 'Radial'].forEach(t => {
    const tab = document.getElementById('tab' + t);
    if (tab) tab.classList.toggle('active', fd.type === t.toLowerCase());
  });

  const isSolid = fd.type === 'solid';
  const solidRow = document.getElementById('solidFillRow');
  const solidOp = document.getElementById('solidOpacityRow');
  const gradPanel = document.getElementById('gradientFillPanel');
  const gradAngle = document.getElementById('gradAngleRow');

  if (solidRow) solidRow.classList.toggle('hidden', !isSolid);
  if (solidOp) solidOp.classList.toggle('hidden', !isSolid);
  if (gradPanel) gradPanel.classList.toggle('hidden', isSolid);
  if (gradAngle) gradAngle.classList.toggle('hidden', fd.type !== 'linear');

  if (isSolid) {
    const el = id => document.getElementById(id);
    if (el('fillColorInput')) {
      el('fillColorInput').value = fd.color;
      el('fillColorInput').style.background = hexToRgba(fd.color, fd.opacity / 100);
    }
    if (el('fillHexInput')) el('fillHexInput').value = fd.color.replace('#', '');
    if (el('fillOpacityInput')) el('fillOpacityInput').value = fd.opacity;
    if (el('fillOpacitySlider')) el('fillOpacitySlider').value = fd.opacity;
  } else {
    updateGradientPreview();
    renderGradientStops();
    const g = fd.gradient;
    if (g) {
      const a = g.angle || 135;
      const el = id => document.getElementById(id);
      if (el('gradAngleSlider')) el('gradAngleSlider').value = a;
      if (el('gradAngleInput')) el('gradAngleInput').value = a;
      if (el('gradAngleLbl')) el('gradAngleLbl').innerText = a;
    }
  }
}

function renderStrokePanel() {
  const sd = currentStrokeData;
  const body = document.getElementById('strokeBodyPanel');
  const eyeBtn = document.getElementById('btnStrokeToggle');
  if (!sd || !body || !eyeBtn) return;

  eyeBtn.classList.toggle('fs-active', sd.enabled);
  body.classList.toggle('hidden', !sd.enabled);
  if (!sd.enabled) return;

  const el = id => document.getElementById(id);
  if (el('strokeColorInput')) {
    el('strokeColorInput').value = sd.color;
    el('strokeColorInput').style.background = hexToRgba(sd.color, sd.opacity / 100);
  }
  if (el('strokeHexInput')) el('strokeHexInput').value = sd.color.replace('#', '');
  if (el('strokeOpacityInput')) el('strokeOpacityInput').value = sd.opacity;
  if (el('strokeOpacitySlider')) el('strokeOpacitySlider').value = sd.opacity;
  if (el('strokePositionSelect')) el('strokePositionSelect').value = sd.position || 'inside';
  if (el('propBorderStyle')) el('propBorderStyle').value = sd.style || 'solid';
  if (el('strokeWeightSlider')) el('strokeWeightSlider').value = Math.min(sd.width || 1, 20);
  if (el('strokeWeightInput')) el('strokeWeightInput').value = sd.width || 1;
  if (el('strokeWeightLbl')) el('strokeWeightLbl').innerText = sd.width || 1;
}

function updateGradientPreview() {
  const fd = currentFillData;
  const bar = document.getElementById('gradPreviewBar');
  if (!fd || !fd.gradient || !bar) return;
  bar.style.background = buildGradientCss(fd);

  // Setup click listener once
  if (!bar.dataset.hasListener) {
    bar.dataset.hasListener = "true";
    bar.addEventListener('click', (e) => {
      const rect = bar.getBoundingClientRect();
      const percent = Math.round(((e.clientX - rect.left) / rect.width) * 100);
      addGradientStopAt(percent);
    });
  }
}

function addGradientStopAt(percent) {
  const data = elements.find(i => i.id === selectedElementId);
  if (!data || !data.fillData || !data.fillData.gradient) return;
  const stops = data.fillData.gradient.stops;
  stops.push({ position: percent, color: '#ffffff', opacity: 100 });
  stops.sort((a, b) => a.position - b.position);
  currentFillData = data.fillData;
  updateGradientPreview();
  renderGradientStops();
  applyFillStroke();
}

function renderGradientStops() {
  const fd = currentFillData;
  const list = document.getElementById('gradStopsList');
  if (!fd || !fd.gradient || !list) return;
  list.innerHTML = '';

  fd.gradient.stops.forEach((stop, idx) => {
    const row = document.createElement('div');
    row.className = 'grad-stop-row';
    const canDel = fd.gradient.stops.length > 2;
    row.innerHTML = `
      <input type="number" id="gradStopPos_${idx}" class="fs-pos-input" value="${stop.position}" min="0" max="100"
        oninput="updateStopPosition(${idx}, parseInt(this.value)||0)" />
      <span class="fs-percent-sm">%</span>
      <input type="color" id="gradStopColor_${idx}" class="fs-swatch-input fs-swatch-sm" value="${stop.color}"
        oninput="updateStopColor(${idx}, this.value)" style="background:${hexToRgba(stop.color, stop.opacity / 100)}" />
      <input type="text" id="gradStopHex_${idx}" class="fs-hex-input fs-hex-sm" value="${stop.color.replace('#', '')}" maxlength="6"
        oninput="updateStopHex(${idx}, this.value)" />
      <input type="number" id="gradStopOpacity_${idx}" class="fs-opacity-input" value="${stop.opacity}" min="0" max="100"
        oninput="updateStopOpacity(${idx}, parseInt(this.value)||0)" />
      <span class="fs-percent-sm">%</span>
      ${canDel ? `<button class="fs-del-stop-btn" onclick="removeGradientStop(${idx})">&#8212;</button>` : '<span style="width:22px;flex-shrink:0"></span>'}
    `;
    list.appendChild(row);
  });
}

// ── Fill handlers ──────────────────────────────────────────────
function toggleFillEnabled() {
  const data = elements.find(i => i.id === selectedElementId);
  if (!data || !data.fillData) return;
  data.fillData.enabled = !data.fillData.enabled;
  currentFillData = data.fillData;
  renderFillPanel();
  applyFillStroke();
}

function setFillType(type) {
  const data = elements.find(i => i.id === selectedElementId);
  if (!data || !data.fillData) return;
  data.fillData.type = type;
  currentFillData = data.fillData;
  renderFillPanel();
  applyFillStroke();
}

function onFillSolidColor(hex) {
  const data = elements.find(i => i.id === selectedElementId);
  if (!data || !data.fillData) return;
  data.fillData.color = hex;
  const sw = document.getElementById('fillColorInput');
  const hi = document.getElementById('fillHexInput');
  if (sw) sw.style.background = hexToRgba(hex, data.fillData.opacity / 100);
  if (hi) hi.value = hex.replace('#', '');
  applyFillStroke();
}

function onFillHexText(str) {
  if (str.length === 6 && /^[0-9a-fA-F]{6}$/.test(str)) {
    const hex = '#' + str;
    onFillSolidColor(hex);
    const ci = document.getElementById('fillColorInput');
    if (ci) ci.value = hex;
  }
}

// Menangani transparansi/opacity pada Solid Fill
function onFillOpacity(val) {
  const data = elements.find(i => i.id === selectedElementId);
  if (!data || !data.fillData) return;
  data.fillData.opacity = Math.max(0, Math.min(100, parseInt(val) || 0));
  const sw = document.getElementById('fillColorInput');
  if (sw) sw.style.background = hexToRgba(data.fillData.color, data.fillData.opacity / 100);
  applyFillStroke();
}

function onGradientAngleChange(val) {
  const data = elements.find(i => i.id === selectedElementId);
  if (!data || !data.fillData || !data.fillData.gradient) return;
  data.fillData.gradient.angle = parseInt(val) || 135;
  updateGradientPreview();
  applyFillStroke();
}

function addGradientStop() {
  const data = elements.find(i => i.id === selectedElementId);
  if (!data || !data.fillData || !data.fillData.gradient) return;
  const stops = data.fillData.gradient.stops;
  const sorted = [...stops].sort((a, b) => a.position - b.position);
  // Cari gap terbesar untuk menaruh stop baru di tengahnya
  let bestPos = 50, maxGap = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    const gap = sorted[i + 1].position - sorted[i].position;
    if (gap > maxGap) {
      maxGap = gap;
      bestPos = Math.round((sorted[i].position + sorted[i + 1].position) / 2);
    }
  }
  stops.push({ position: bestPos, color: '#ffffff', opacity: 100 });
  stops.sort((a, b) => a.position - b.position);
  currentFillData = data.fillData;
  updateGradientPreview();
  renderGradientStops();
  applyFillStroke();
}

function removeGradientStop(idx) {
  const data = elements.find(i => i.id === selectedElementId);
  if (!data || !data.fillData || !data.fillData.gradient) return;
  if (data.fillData.gradient.stops.length <= 2) return;
  data.fillData.gradient.stops.splice(idx, 1);
  currentFillData = data.fillData;
  updateGradientPreview();
  renderGradientStops();
  applyFillStroke();
}

// Update posisi stop secara in-place tanpa merusak fokus DOM
function updateStopPosition(idx, val) {
  const data = elements.find(i => i.id === selectedElementId);
  if (!data || !data.fillData || !data.fillData.gradient) return;
  const pos = Math.max(0, Math.min(100, val));
  data.fillData.gradient.stops[idx].position = pos;

  // Update input text secara langsung
  const posInput = document.getElementById(`gradStopPos_${idx}`);
  if (posInput && document.activeElement !== posInput) {
    posInput.value = pos;
  }
  updateGradientPreview();
  applyFillStroke();
}

// Update warna stop secara in-place agar native color picker tetap terbuka
function updateStopColor(idx, hex) {
  const data = elements.find(i => i.id === selectedElementId);
  if (!data || !data.fillData || !data.fillData.gradient) return;
  data.fillData.gradient.stops[idx].color = hex;
  const stop = data.fillData.gradient.stops[idx];

  // Update visual swatch dan hex input secara inline
  const colorInput = document.getElementById(`gradStopColor_${idx}`);
  if (colorInput) {
    colorInput.style.background = hexToRgba(hex, stop.opacity / 100);
    colorInput.value = hex;
  }
  const hexInput = document.getElementById(`gradStopHex_${idx}`);
  if (hexInput && document.activeElement !== hexInput) {
    hexInput.value = hex.replace('#', '');
  }

  updateGradientPreview();
  applyFillStroke();
}

function updateStopHex(idx, str) {
  if (str.length === 6 && /^[0-9a-fA-F]{6}$/.test(str)) {
    const hex = '#' + str;
    const data = elements.find(i => i.id === selectedElementId);
    if (!data || !data.fillData || !data.fillData.gradient) return;
    data.fillData.gradient.stops[idx].color = hex;
    const stop = data.fillData.gradient.stops[idx];

    const colorInput = document.getElementById(`gradStopColor_${idx}`);
    if (colorInput) {
      colorInput.style.background = hexToRgba(hex, stop.opacity / 100);
      colorInput.value = hex;
    }

    updateGradientPreview();
    applyFillStroke();
  }
}

// Update opacity stop secara in-place tanpa merusak fokus DOM
function updateStopOpacity(idx, val) {
  const data = elements.find(i => i.id === selectedElementId);
  if (!data || !data.fillData || !data.fillData.gradient) return;
  const op = Math.max(0, Math.min(100, val));
  data.fillData.gradient.stops[idx].opacity = op;
  const stop = data.fillData.gradient.stops[idx];

  // Update visual swatch background
  const colorInput = document.getElementById(`gradStopColor_${idx}`);
  if (colorInput) {
    colorInput.style.background = hexToRgba(stop.color, op / 100);
  }

  updateGradientPreview();
  applyFillStroke();
}

// ── Stroke handlers ────────────────────────────────────────────
function toggleStrokeEnabled() {
  const data = elements.find(i => i.id === selectedElementId);
  if (!data || !data.strokeData) return;
  data.strokeData.enabled = !data.strokeData.enabled;
  currentStrokeData = data.strokeData;
  renderStrokePanel();
  applyFillStroke();
}

function onStrokeColor(hex) {
  const data = elements.find(i => i.id === selectedElementId);
  if (!data || !data.strokeData) return;
  data.strokeData.color = hex;
  const sw = document.getElementById('strokeColorInput');
  const hi = document.getElementById('strokeHexInput');
  if (sw) sw.style.background = hexToRgba(hex, data.strokeData.opacity / 100);
  if (hi) hi.value = hex.replace('#', '');
  applyFillStroke();
}

function onStrokeHexText(str) {
  if (str.length === 6 && /^[0-9a-fA-F]{6}$/.test(str)) {
    onStrokeColor('#' + str);
    const ci = document.getElementById('strokeColorInput');
    if (ci) ci.value = '#' + str;
  }
}

function onStrokeOpacity(val) {
  const data = elements.find(i => i.id === selectedElementId);
  if (!data || !data.strokeData) return;
  data.strokeData.opacity = Math.max(0, Math.min(100, parseInt(val) || 0));
  const sw = document.getElementById('strokeColorInput');
  if (sw) sw.style.background = hexToRgba(data.strokeData.color, data.strokeData.opacity / 100);
  applyFillStroke();
}

function onStrokeWeight(val) {
  const data = elements.find(i => i.id === selectedElementId);
  if (!data || !data.strokeData) return;
  data.strokeData.width = Math.max(1, parseInt(val) || 1);
  applyFillStroke();
}

function onStrokePositionChange(pos) {
  const data = elements.find(i => i.id === selectedElementId);
  if (!data || !data.strokeData) return;
  data.strokeData.position = pos;
  applyFillStroke();
}

function onStrokeStyleChange(style) {
  const data = elements.find(i => i.id === selectedElementId);
  if (!data || !data.strokeData) return;
  data.strokeData.style = style;
  applyFillStroke();
}

// ==========================================
//  UNDO / REDO HISTORY SYSTEM
// ==========================================

let pushHistoryTimeout = null;
function pushHistoryDebounced() {
  if (pushHistoryTimeout) {
    clearTimeout(pushHistoryTimeout);
  }
  pushHistoryTimeout = setTimeout(() => {
    pushHistory();
  }, 500);
}

function getHistoryState() {
  const bgTypeSelect = document.getElementById("bgType");
  const bgSolidColorInput = document.getElementById("bgSolidColor");
  return {
    elements: JSON.parse(JSON.stringify(elements)),
    background: {
      type: bgTypeSelect ? bgTypeSelect.value : "color",
      style: canvas.style.background || "#f2f7f9",
      color: bgSolidColorInput ? bgSolidColorInput.value : "#f2f7f9"
    }
  };
}

function pushHistory() {
  const state = getHistoryState();
  const stateStr = JSON.stringify(state);

  // Prevent duplicate states consecutively
  if (undoStack.length > 0 && undoStack[undoStack.length - 1] === stateStr) {
    return;
  }

  undoStack.push(stateStr);
  if (undoStack.length > MAX_HISTORY_LIMIT) {
    undoStack.shift();
  }

  // Clear redo stack when a new action is performed
  redoStack = [];
  updateUndoRedoButtons();
}

function undo() {
  if (undoStack.length <= 1) return; // Cannot undo past the initial state

  // Pop the current state and push it to the redo stack
  const currentState = undoStack.pop();
  redoStack.push(currentState);

  // Get the previous state
  const prevStateStr = undoStack[undoStack.length - 1];
  const prevState = JSON.parse(prevStateStr);

  applyHistoryState(prevState);
}

function redo() {
  if (redoStack.length === 0) return;

  // Pop from redo stack and push to undo stack
  const nextStateStr = redoStack.pop();
  undoStack.push(nextStateStr);

  const nextState = JSON.parse(nextStateStr);

  applyHistoryState(nextState);
}

function applyHistoryState(stateObj) {
  elements = stateObj.elements;

  // Re-apply background
  if (stateObj.background) {
    canvas.style.background = stateObj.background.style;
    const bgTypeSelect = document.getElementById("bgType");
    if (bgTypeSelect) {
      bgTypeSelect.value = stateObj.background.type || "color";
      if (stateObj.background.type === "color") {
        const solidColorInput = document.getElementById("bgSolidColor");
        if (solidColorInput) {
          solidColorInput.value = stateObj.background.color || "#f2f7f9";
        }
        const solidHex = document.getElementById("bgSolidHex");
        if (solidHex) {
          solidHex.innerText = stateObj.background.color || "#f2f7f9";
        }
      }
    }
  }

  // If the currently selected element no longer exists in elements, deselect it
  if (selectedElementId && !elements.some(item => item.id === selectedElementId)) {
    deselectAll();
  } else {
    // Re-render and re-select to load correct panel values
    const currentSelectedId = selectedElementId;
    renderCanvas();
    if (currentSelectedId) {
      selectElement(currentSelectedId);
    }
  }

  updateUndoRedoButtons();
}

function updateUndoRedoButtons() {
  const undoBtn = document.getElementById("btnUndo");
  const redoBtn = document.getElementById("btnRedo");

  if (undoBtn) {
    undoBtn.disabled = undoStack.length <= 1;
  }
  if (redoBtn) {
    redoBtn.disabled = redoStack.length === 0;
  }
}

// Global change listener to push history for properties drawer commits
document.addEventListener("change", (e) => {
  const drawer = document.getElementById("propertiesDrawer");
  if (drawer && drawer.contains(e.target)) {
    pushHistory();
  }
});

// Keyboard shortcuts for Undo/Redo
document.addEventListener("keydown", (e) => {
  if (!isEditMode) return;

  // Skip if user is actively typing in a text field
  const isTextInput = (e.target.tagName === "TEXTAREA" || (e.target.tagName === "INPUT" && ["text", "number", "email", "url", "password", "search"].includes(e.target.type)));
  if (isTextInput) return;

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    if (e.shiftKey) {
      redo();
    } else {
      undo();
    }
  }

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
    e.preventDefault();
    redo();
  }
});


// ==============================================================================
// 1. PALETTE TOOLS - EXTRACT DOMINANT COLORS FROM IMAGE
// ==============================================================================
function togglePaletteModal() {
  const container = document.getElementById("paletteHeaderContainer");
  if (container) {
    container.classList.toggle("hidden");

    // Auto-extract actor foto colors if empty
    const swatchesDiv = document.getElementById("paletteHeaderSwatches");
    if (!swatchesDiv.children.length && window.actorFoto) {
      extractColorsFromUrl(window.actorFoto);
    }
  }
}

function extractColorsFromUrl(url) {
  const img = new Image();
  img.onload = function () {
    performExtraction(img);
  };
  if (!url.startsWith("data:")) img.crossOrigin = "Anonymous";
  img.src = url;
}

function handlePaletteImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    const img = new Image();
    img.onload = function () {
      performExtraction(img);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function performExtraction(img) {
  // Resize image to 30x30 to average colors
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = 30;
  canvas.height = 30;
  ctx.drawImage(img, 0, 0, 30, 30);
  const imgData = ctx.getImageData(0, 0, 30, 30).data;

  const colorCounts = {};
  for (let i = 0; i < imgData.length; i += 4) {
    const r = imgData[i];
    const g = imgData[i + 1];
    const b = imgData[i + 2];
    const a = imgData[i + 3];
    if (a < 128) continue; // skip transparent

    const qr = Math.round(r / 16) * 16;
    const qg = Math.round(g / 16) * 16;
    const qb = Math.round(b / 16) * 16;
    const rgbKey = `${qr},${qg},${qb}`;
    colorCounts[rgbKey] = (colorCounts[rgbKey] || 0) + 1;
  }

  const sortedColors = Object.keys(colorCounts).sort((c1, c2) => colorCounts[c2] - colorCounts[c1]);

  const palette = [];
  for (const colStr of sortedColors) {
    const [r, g, b] = colStr.split(',').map(Number);

    let isSimilar = false;
    for (const p of palette) {
      const dist = Math.sqrt((r - p.r) ** 2 + (g - p.g) ** 2 + (b - p.b) ** 2);
      if (dist < 60) {
        isSimilar = true;
        break;
      }
    }

    if (!isSimilar) {
      palette.push({ r, g, b, hex: rgbToHexStr(r, g, b) });
    }

    if (palette.length >= 6) break;
  }

  const container = document.getElementById("paletteHeaderSwatches");
  container.innerHTML = "";
  palette.forEach(color => {
    const swatch = document.createElement("div");
    swatch.style.width = "22px";
    swatch.style.height = "22px";
    swatch.style.background = color.hex;
    swatch.style.borderRadius = "4px";
    swatch.style.cursor = "pointer";
    swatch.style.border = "1px solid rgba(0,0,0,0.2)";
    swatch.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
    swatch.style.transition = "transform 0.15s";
    swatch.title = color.hex.toUpperCase();

    swatch.onmouseenter = () => swatch.style.transform = "scale(1.15)";
    swatch.onmouseleave = () => swatch.style.transform = "scale(1.0)";

    swatch.onclick = () => selectPaletteColor(color.hex);
    container.appendChild(swatch);
  });
}

function rgbToHexStr(r, g, b) {
  return "#" + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }).join("");
}

function getContrastColor(r, g, b) {
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 128) ? "#000000" : "#ffffff";
}

function selectPaletteColor(hex) {
  navigator.clipboard.writeText(hex).then(() => {
    showToastNotification('Warna ' + hex.toUpperCase() + ' disalin ke clipboard!');
  });

  if (selectedElementId) {
    const data = elements.find(el => el.id === selectedElementId);
    if (data) {
      if (data.type === "title" || data.type === "text") {
        updateSelectedElementStyle("color", hex);
        const colInput = document.getElementById("propTextColor");
        if (colInput) colInput.value = hex;
        const hexLbl = document.getElementById("propTextColorHex");
        if (hexLbl) hexLbl.innerText = hex;
      } else if (data.type === "button") {
        updateSelectedElementStyle("backgroundColor", hex);
        const btnColInput = document.getElementById("propBtnTextColor");
        data.style.backgroundColor = hex;
      } else if (data.type === "shape" || data.type === "container" || data.type === "row" || data.type === "column") {
        const fillSolidInput = document.getElementById("fillColorInput");
        if (fillSolidInput) {
          fillSolidInput.value = hex;
          onFillSolidColor(hex);
        }
      }
      renderCanvas();
      pushHistory();
    }
  }
}

function showToastNotification(msg) {
  const toast = document.getElementById("toast");
  if (toast) {
    toast.innerText = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2500);
  }
}


// ==============================================================================
// 2. BACKGROUND REMOVER (rembg) WITH ERASURE / RESTORE BRUSH
// ==============================================================================
let rembgImgOriginal = null;
let rembgImgRemoved = null;
let rembgCanvas = null;
let rembgCtx = null;
let rembgMaskCanvas = null;
let rembgMaskCtx = null;
let rembgTool = 'erase';
let rembgIsDrawing = false;
let rembgLastX = 0;
let rembgLastY = 0;
let rembgHistory = [];
let rembgRedoHistory = [];

function triggerImageRembg() {
  if (!selectedElementId) return;
  const data = elements.find(el => el.id === selectedElementId);
  if (!data || data.type !== 'image') return;
  const imgUrl = data.imageSrc;
  if (!imgUrl) {
    showToastNotification("Silakan upload gambar atau masukkan URL gambar terlebih dahulu.");
    return;
  }

  const modal = document.getElementById("rembgModal");
  modal.classList.remove("hidden");

  document.getElementById("rembgLoadingState").classList.remove("hidden");
  document.getElementById("rembgEditorState").classList.add("hidden");

  fetch('/api/ai/remove_bg', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imgUrl })
  })
    .then(res => res.json())
    .then(resData => {
      if (resData.success && resData.image) {
        initRembgEditor(imgUrl, resData.image);
      } else {
        showToastNotification("Gagal: " + (resData.error || "Error tidak diketahui"));
        closeRembgModal();
      }
    })
    .catch(err => {
      console.error(err);
      showToastNotification("Gagal menghubungi server untuk memproses.");
      closeRembgModal();
    });
}

function initRembgEditor(originalSrc, removedSrc) {
  document.getElementById("rembgLoadingState").classList.add("hidden");
  document.getElementById("rembgEditorState").classList.remove("hidden");

  rembgImgOriginal = new Image();
  rembgImgRemoved = new Image();

  let loadedCount = 0;
  function onImgLoaded() {
    loadedCount++;
    if (loadedCount === 2) {
      setupRembgCanvas();
    }
  }

  rembgImgOriginal.onload = onImgLoaded;
  rembgImgRemoved.onload = onImgLoaded;

  if (!originalSrc.startsWith("data:")) rembgImgOriginal.crossOrigin = "Anonymous";
  if (!removedSrc.startsWith("data:")) rembgImgRemoved.crossOrigin = "Anonymous";

  rembgImgOriginal.src = originalSrc;
  rembgImgRemoved.src = removedSrc;
}

function setupRembgCanvas() {
  rembgCanvas = document.getElementById("rembgCanvas");
  rembgCtx = rembgCanvas.getContext("2d");

  const maxW = 380;
  const aspect = rembgImgOriginal.height / rembgImgOriginal.width;
  rembgCanvas.width = rembgImgOriginal.width > maxW ? maxW : rembgImgOriginal.width;
  rembgCanvas.height = rembgCanvas.width * aspect;

  rembgMaskCanvas = document.createElement("canvas");
  rembgMaskCanvas.width = rembgCanvas.width;
  rembgMaskCanvas.height = rembgCanvas.height;
  rembgMaskCtx = rembgMaskCanvas.getContext("2d");

  rembgMaskCtx.drawImage(rembgImgRemoved, 0, 0, rembgCanvas.width, rembgCanvas.height);

  rembgCanvas.onmousedown = startRembgDraw;
  rembgCanvas.onmousemove = drawRembgStroke;
  window.addEventListener("mouseup", stopRembgDraw);

  // Touch events
  rembgCanvas.ontouchstart = (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent("mousedown", {
      clientX: touch.clientX,
      clientY: touch.clientY
    });
    rembgCanvas.dispatchEvent(mouseEvent);
  };
  rembgCanvas.ontouchmove = (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent("mousemove", {
      clientX: touch.clientX,
      clientY: touch.clientY
    });
    rembgCanvas.dispatchEvent(mouseEvent);
  };
  rembgCanvas.ontouchend = (e) => {
    const mouseEvent = new MouseEvent("mouseup", {});
    window.dispatchEvent(mouseEvent);
  };

  rembgHistory = [];
  rembgRedoHistory = [];
  saveRembgState();
  redrawRembg();
}

function setRembgTool(tool) {
  rembgTool = tool;
  document.getElementById("btnRembgErase").classList.toggle("active", tool === 'erase');
  document.getElementById("btnRembgRestore").classList.toggle("active", tool === 'restore');
}

function startRembgDraw(e) {
  rembgIsDrawing = true;
  const rect = rembgCanvas.getBoundingClientRect();
  rembgLastX = (e.clientX - rect.left) * (rembgCanvas.width / rect.width);
  rembgLastY = (e.clientY - rect.top) * (rembgCanvas.height / rect.height);
}

function drawRembgStroke(e) {
  if (!rembgIsDrawing) return;
  const rect = rembgCanvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (rembgCanvas.width / rect.width);
  const y = (e.clientY - rect.top) * (rembgCanvas.height / rect.height);

  const size = parseInt(document.getElementById("rembgBrushSize").value) || 20;

  rembgMaskCtx.save();
  rembgMaskCtx.lineJoin = "round";
  rembgMaskCtx.lineCap = "round";
  rembgMaskCtx.lineWidth = size;

  if (rembgTool === 'erase') {
    rembgMaskCtx.globalCompositeOperation = 'destination-out';
    rembgMaskCtx.beginPath();
    rembgMaskCtx.moveTo(rembgLastX, rembgLastY);
    rembgMaskCtx.lineTo(x, y);
    rembgMaskCtx.stroke();
  } else {
    rembgMaskCtx.globalCompositeOperation = 'source-over';
    rembgMaskCtx.strokeStyle = "#ffffff";
    rembgMaskCtx.beginPath();
    rembgMaskCtx.moveTo(rembgLastX, rembgLastY);
    rembgMaskCtx.lineTo(x, y);
    rembgMaskCtx.stroke();
  }
  rembgMaskCtx.restore();

  rembgLastX = x;
  rembgLastY = y;
  redrawRembg();
}

function stopRembgDraw() {
  if (rembgIsDrawing) {
    rembgIsDrawing = false;
    saveRembgState();
  }
}

function saveRembgState() {
  const state = rembgMaskCtx.getImageData(0, 0, rembgMaskCanvas.width, rembgMaskCanvas.height);
  rembgHistory.push(state);
  if (rembgHistory.length > 30) rembgHistory.shift();
  rembgRedoHistory = [];
}

function undoRembgBrush() {
  if (rembgHistory.length > 1) {
    const currentState = rembgHistory.pop();
    rembgRedoHistory.push(currentState);
    const previousState = rembgHistory[rembgHistory.length - 1];
    rembgMaskCtx.putImageData(previousState, 0, 0);
    redrawRembg();
  }
}

function redoRembgBrush() {
  if (rembgRedoHistory.length > 0) {
    const nextState = rembgRedoHistory.pop();
    rembgHistory.push(nextState);
    rembgMaskCtx.putImageData(nextState, 0, 0);
    redrawRembg();
  }
}

function resetRembgBrush() {
  rembgMaskCtx.clearRect(0, 0, rembgMaskCanvas.width, rembgMaskCanvas.height);
  rembgMaskCtx.drawImage(rembgImgRemoved, 0, 0, rembgCanvas.width, rembgCanvas.height);
  saveRembgState();
  redrawRembg();
}

function redrawRembg() {
  if (!rembgCanvas) return;
  rembgCtx.clearRect(0, 0, rembgCanvas.width, rembgCanvas.height);

  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = rembgCanvas.width;
  tempCanvas.height = rembgCanvas.height;
  const tempCtx = tempCanvas.getContext("2d");

  tempCtx.drawImage(rembgImgOriginal, 0, 0, tempCanvas.width, tempCanvas.height);
  tempCtx.globalCompositeOperation = 'destination-in';
  tempCtx.drawImage(rembgMaskCanvas, 0, 0, tempCanvas.width, tempCanvas.height);

  rembgCtx.drawImage(tempCanvas, 0, 0);
}

function applyRembgResult() {
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = rembgImgOriginal.naturalWidth;
  exportCanvas.height = rembgImgOriginal.naturalHeight;
  const exportCtx = exportCanvas.getContext("2d");

  exportCtx.drawImage(rembgImgOriginal, 0, 0);
  exportCtx.globalCompositeOperation = 'destination-in';
  exportCtx.drawImage(rembgMaskCanvas, 0, 0, exportCanvas.width, exportCanvas.height);

  const transparentBase64 = exportCanvas.toDataURL("image/png");
  updateSelectedElementImageSrc(transparentBase64);
  const urlInput = document.getElementById("propImageUrl");
  if (urlInput) urlInput.value = transparentBase64;

  closeRembgModal();
}

function closeRembgModal() {
  document.getElementById("rembgModal").classList.add("hidden");
  rembgCanvas = null;
  rembgCtx = null;
  rembgMaskCanvas = null;
  rembgMaskCtx = null;
  window.removeEventListener("mouseup", stopRembgDraw);
}


// ==============================================================================
// 3. BACKGROUND RESIZE, OPACITY & CROP BOX CONTROLS
// ==============================================================================
let bgCropImg = null;
let bgCropCanvas = null;
let bgCropCtx = null;
let bgCropRect = { x: 50, y: 50, w: 200, h: 200 };
let bgCropActiveHandle = null;
let bgCropDragOffset = { x: 0, y: 0 };
const BG_CROP_HANDLE_SIZE = 12;

function uploadBgImage(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    updateBgImageSrc(e.target.result);
    const urlInput = document.getElementById("bgImageUrl");
    if (urlInput) urlInput.value = e.target.result;
  };
  reader.readAsDataURL(file);
}

function updateBgImageSrc(src) {
  const bgType = document.getElementById("bgType").value;
  if (bgType !== 'image') return;

  window.bgImageSrc = src;

  if (src) {
    const tempImg = new Image();
    tempImg.onload = function () {
      window.bgImageWidth = tempImg.width;
      window.bgImageHeight = tempImg.height;

      // Auto adjust canvas height to fit this new image
      setCanvasHeightToFitImage();
    };
    tempImg.src = src;
  }

  const cropBtn = document.getElementById("bgCropBtnRow");
  if (cropBtn) cropBtn.style.display = src ? "block" : "none";

  updateBgStyle();
  pushHistory();
}

function updateBgImageOpacity(val) {
  document.getElementById("bgOpacityVal").innerText = val;
  window.bgImageOpacity = val / 100;
  updateBgStyle();
}

function openBgCropModal() {
  if (!window.bgImageSrc) return;

  const modal = document.getElementById("bgCropModal");
  modal.classList.remove("hidden");

  bgCropCanvas = document.getElementById("bgCropCanvas");
  bgCropCtx = bgCropCanvas.getContext("2d");

  bgCropImg = new Image();
  bgCropImg.onload = function () {
    const maxW = 380;
    const aspect = bgCropImg.height / bgCropImg.width;
    bgCropCanvas.width = bgCropImg.width > maxW ? maxW : bgCropImg.width;
    bgCropCanvas.height = bgCropCanvas.width * aspect;

    const w = bgCropCanvas.width * 0.7;
    const h = bgCropCanvas.height * 0.7;
    bgCropRect = {
      x: (bgCropCanvas.width - w) / 2,
      y: (bgCropCanvas.height - h) / 2,
      w: w,
      h: h
    };

    bgCropCanvas.onmousedown = handleBgCropMouseDown;
    bgCropCanvas.onmousemove = handleBgCropMouseMove;
    window.addEventListener("mouseup", handleBgCropMouseUp);

    // Touch support
    bgCropCanvas.ontouchstart = (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const mouseEvent = new MouseEvent("mousedown", {
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      bgCropCanvas.dispatchEvent(mouseEvent);
    };
    bgCropCanvas.ontouchmove = (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const mouseEvent = new MouseEvent("mousemove", {
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      bgCropCanvas.dispatchEvent(mouseEvent);
    };
    bgCropCanvas.ontouchend = (e) => {
      const mouseEvent = new MouseEvent("mouseup", {});
      window.dispatchEvent(mouseEvent);
    };

    drawBgCrop();
  };
  bgCropImg.src = window.bgImageSrc;
}

function drawBgCrop() {
  if (!bgCropCanvas) return;

  bgCropCtx.clearRect(0, 0, bgCropCanvas.width, bgCropCanvas.height);
  bgCropCtx.drawImage(bgCropImg, 0, 0, bgCropCanvas.width, bgCropCanvas.height);

  bgCropCtx.fillStyle = "rgba(0, 0, 0, 0.6)";
  bgCropCtx.fillRect(0, 0, bgCropCanvas.width, bgCropCanvas.height);

  bgCropCtx.save();
  bgCropCtx.beginPath();
  bgCropCtx.rect(bgCropRect.x, bgCropRect.y, bgCropRect.w, bgCropRect.h);
  bgCropCtx.clip();
  bgCropCtx.drawImage(bgCropImg, 0, 0, bgCropCanvas.width, bgCropCanvas.height);
  bgCropCtx.restore();

  bgCropCtx.strokeStyle = "#38a0c4";
  bgCropCtx.lineWidth = 2;
  bgCropCtx.strokeRect(bgCropRect.x, bgCropRect.y, bgCropRect.w, bgCropRect.h);

  bgCropCtx.fillStyle = "#38a0c4";
  const corners = [
    { x: bgCropRect.x, y: bgCropRect.y },
    { x: bgCropRect.x + bgCropRect.w, y: bgCropRect.y },
    { x: bgCropRect.x, y: bgCropRect.y + bgCropRect.h },
    { x: bgCropRect.x + bgCropRect.w, y: bgCropRect.y + bgCropRect.h }
  ];

  corners.forEach(c => {
    bgCropCtx.beginPath();
    bgCropCtx.arc(c.x, c.y, BG_CROP_HANDLE_SIZE / 2, 0, Math.PI * 2);
    bgCropCtx.fill();
    bgCropCtx.strokeStyle = "#ffffff";
    bgCropCtx.lineWidth = 1.5;
    bgCropCtx.stroke();
  });
}

function handleBgCropMouseDown(e) {
  const rect = bgCropCanvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (bgCropCanvas.width / rect.width);
  const y = (e.clientY - rect.top) * (bgCropCanvas.height / rect.height);

  const halfSz = BG_CROP_HANDLE_SIZE / 2;
  const isNear = (hx, hy) => Math.sqrt((x - hx) ** 2 + (y - hy) ** 2) < halfSz + 10;

  if (isNear(bgCropRect.x, bgCropRect.y)) {
    bgCropActiveHandle = 'TL';
  } else if (isNear(bgCropRect.x + bgCropRect.w, bgCropRect.y)) {
    bgCropActiveHandle = 'TR';
  } else if (isNear(bgCropRect.x, bgCropRect.y + bgCropRect.h)) {
    bgCropActiveHandle = 'BL';
  } else if (isNear(bgCropRect.x + bgCropRect.w, bgCropRect.y + bgCropRect.h)) {
    bgCropActiveHandle = 'BR';
  } else if (x > bgCropRect.x && x < bgCropRect.x + bgCropRect.w && y > bgCropRect.y && y < bgCropRect.y + bgCropRect.h) {
    bgCropActiveHandle = 'move';
    bgCropDragOffset = { x: x - bgCropRect.x, y: y - bgCropRect.y };
  } else {
    bgCropActiveHandle = null;
  }
}

function handleBgCropMouseMove(e) {
  if (!bgCropActiveHandle) return;

  const rect = bgCropCanvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (bgCropCanvas.width / rect.width);
  const y = (e.clientY - rect.top) * (bgCropCanvas.height / rect.height);

  const minSz = 30;

  if (bgCropActiveHandle === 'move') {
    bgCropRect.x = Math.max(0, Math.min(bgCropCanvas.width - bgCropRect.w, x - bgCropDragOffset.x));
    bgCropRect.y = Math.max(0, Math.min(bgCropCanvas.height - bgCropRect.h, y - bgCropDragOffset.y));
  } else if (bgCropActiveHandle === 'TL') {
    const newW = bgCropRect.x + bgCropRect.w - x;
    const newH = bgCropRect.y + bgCropRect.h - y;
    if (newW > minSz) {
      bgCropRect.w = newW;
      bgCropRect.x = x;
    }
    if (newH > minSz) {
      bgCropRect.h = newH;
      bgCropRect.y = y;
    }
  } else if (bgCropActiveHandle === 'TR') {
    const newW = x - bgCropRect.x;
    const newH = bgCropRect.y + bgCropRect.h - y;
    if (newW > minSz) bgCropRect.w = newW;
    if (newH > minSz) {
      bgCropRect.h = newH;
      bgCropRect.y = y;
    }
  } else if (bgCropActiveHandle === 'BL') {
    const newW = bgCropRect.x + bgCropRect.w - x;
    const newH = y - bgCropRect.y;
    if (newW > minSz) {
      bgCropRect.w = newW;
      bgCropRect.x = x;
    }
    if (newH > minSz) bgCropRect.h = newH;
  } else if (bgCropActiveHandle === 'BR') {
    const newW = x - bgCropRect.x;
    const newH = y - bgCropRect.y;
    if (newW > minSz) bgCropRect.w = newW;
    if (newH > minSz) bgCropRect.h = newH;
  }

  drawBgCrop();
}

function handleBgCropMouseUp() {
  bgCropActiveHandle = null;
}

function applyBgCrop() {
  const scale = bgCropImg.naturalWidth / bgCropCanvas.width;

  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = bgCropRect.w * scale;
  exportCanvas.height = bgCropRect.h * scale;
  const exportCtx = exportCanvas.getContext("2d");

  exportCtx.drawImage(
    bgCropImg,
    bgCropRect.x * scale,
    bgCropRect.y * scale,
    bgCropRect.w * scale,
    bgCropRect.h * scale,
    0,
    0,
    exportCanvas.width,
    exportCanvas.height
  );

  const croppedBase64 = exportCanvas.toDataURL("image/png");
  updateBgImageSrc(croppedBase64);

  const urlInput = document.getElementById("bgImageUrl");
  if (urlInput) urlInput.value = croppedBase64;

  closeBgCropModal();
}

function closeBgCropModal() {
  document.getElementById("bgCropModal").classList.add("hidden");
  bgCropCanvas = null;
  bgCropCtx = null;
  window.removeEventListener("mouseup", handleBgCropMouseUp);
}

// CANVAS HEIGHT MANAGEMENT
window.canvasHeight = "";
window.bgImageWidth = null;
window.bgImageHeight = null;

function changeCanvasHeight(val) {
  const v = parseInt(val, 10);
  if (isNaN(v) || v < 100) {
    window.canvasHeight = "";
  } else {
    window.canvasHeight = v;
  }
  adjustCanvasHeight();
}

function setCanvasHeightToFitImage() {
  const canvas = document.getElementById("canvas");
  if (!canvas) return;

  if (window.bgImageSrc && window.bgImageWidth && window.bgImageHeight) {
    const ratio = window.bgImageHeight / window.bgImageWidth;
    const currentWidth = canvas.clientWidth || 450;
    const fitHeight = Math.round(currentWidth * ratio);
    window.canvasHeight = fitHeight;

    const heightInput = document.getElementById("canvasHeightInput");
    if (heightInput) heightInput.value = fitHeight;

    adjustCanvasHeight();
    pushHistory();
  }
}

function resetCanvasHeightToDefault() {
  window.canvasHeight = "";
  const heightInput = document.getElementById("canvasHeightInput");
  if (heightInput) heightInput.value = "";
  adjustCanvasHeight();
  pushHistory();
}

function adjustCanvasHeight() {
  const canvas = document.getElementById("canvas");
  if (!canvas) return;

  // Hitung batas bawah elemen aktual di dalam DOM untuk mencegah terpotong (tenggelam)
  let maxBottom = 600;
  const domElements = canvas.querySelectorAll(".builder-element");
  domElements.forEach(el => {
    // Hanya ukur elemen utama di level root kanvas
    if (el.parentNode !== canvas) return;
    const bottom = el.offsetTop + el.offsetHeight;
    if (bottom > maxBottom) {
      maxBottom = bottom;
    }
  });

  const finalHeight = maxBottom; // Mentok di batas bawah elemen, tanpa ruang kreatif tambahan

  if (window.canvasHeight && window.canvasHeight !== "") {
    // Jika user menentukan tinggi kustom, gunakan tinggi tersebut kecuali konten melebihi tingginya
    const heightNum = parseInt(window.canvasHeight);
    const targetHeight = Math.max(heightNum, finalHeight);
    canvas.style.height = targetHeight + "px";
    canvas.style.minHeight = targetHeight + "px";
  } else {
    // Jika tidak ada tinggi kustom, hitung tinggi dasar latar belakang
    let baseHeight = 600;
    if (window.bgImageSrc && window.bgImageWidth && window.bgImageHeight) {
      const ratio = window.bgImageHeight / window.bgImageWidth;
      const currentWidth = canvas.clientWidth || 450;
      baseHeight = Math.round(currentWidth * ratio);
    }
    const targetHeight = Math.max(baseHeight, finalHeight);
    canvas.style.height = targetHeight + "px";
    canvas.style.minHeight = targetHeight + "px";

    const heightInput = document.getElementById("canvasHeightInput");
    if (heightInput) heightInput.value = targetHeight;
  }
}


// ==============================================================================
// 4. NEW GRID LAYOUT & COLUMN ALLOCATION
// ==============================================================================
function updateRowColumnsCount(count) {
  const data = elements.find(item => item.id === selectedElementId);
  if (!data || data.type !== "row") return;

  const countNum = parseInt(count) || 1;
  let colChildren = elements.filter(el => el.parentId === data.id && el.type === "column");

  if (colChildren.length < countNum) {
    const toAdd = countNum - colChildren.length;
    for (let i = 0; i < toAdd; i++) {
      const colId = "el-" + Math.random().toString(36).substr(2, 9);
      const newCol = {
        id: colId,
        type: "column",
        parentId: data.id,
        content: "",
        style: {
          position: "relative",
          left: "auto",
          top: "auto",
          width: "100%",
          height: "auto",
          padding: "10px",
          backgroundColor: "rgba(255, 255, 255, 0.5)",
          borderStyle: "solid",
          borderColor: "rgba(56, 160, 196, 0.1)",
          borderWidth: "1px",
          borderRadius: "8px",
          zIndex: "5"
        }
      };
      elements.push(newCol);
    }
  } else if (colChildren.length > countNum) {
    const toRemove = colChildren.length - countNum;
    const removedCols = colChildren.slice(countNum);
    removedCols.forEach(col => {
      elements = elements.filter(el => el.id !== col.id);
      elements.forEach(el => {
        if (el.parentId === col.id) {
          el.parentId = null;
          el.style.position = "absolute";
          el.style.left = "10%";
          el.style.top = "160px";
          el.style.width = "80%";
        }
      });
    });
  }

  // Redistribute columns width equally by default
  const finalColChildren = elements.filter(el => el.parentId === data.id && el.type === "column");
  let widthVal = "100%";
  if (countNum === 2) widthVal = "calc(50% - 6px)";
  else if (countNum === 3) widthVal = "calc(33.33% - 8px)";
  else if (countNum === 4) widthVal = "calc(25% - 9px)";

  finalColChildren.forEach(col => {
    col.style.width = widthVal;
  });

  renderCanvas();
  pushHistory();
}

function updateColumnWidth(widthVal) {
  const data = elements.find(item => item.id === selectedElementId);
  if (!data || data.type !== "column") return;

  data.style.width = widthVal;
  const div = document.getElementById(selectedElementId);
  if (div) div.style.width = widthVal;

  renderCanvas();
  pushHistory();
}

// ==============================================================================
// 5. CAROUSEL MULTI-UPLOAD & Kelola Gambar
// ==============================================================================
function uploadCarouselImages(event) {
  const data = elements.find(item => item.id === selectedElementId);
  if (!data || data.type !== "carousel") return;

  const files = event.target.files;
  if (!files || files.length === 0) return;

  let loaded = 0;
  const newImages = [];
  const targetCount = files.length;

  for (let i = 0; i < targetCount; i++) {
    const file = files[i];
    const reader = new FileReader();
    reader.onload = function (e) {
      newImages.push(e.target.result);
      loaded++;
      if (loaded === targetCount) {
        if (!data.carouselImages) data.carouselImages = [...defaultCarouselImages];
        data.carouselImages = data.carouselImages.concat(newImages);
        data.carouselActiveIndex = 0;

        const carouselInput = document.getElementById("propCarouselImages");
        if (carouselInput) carouselInput.value = data.carouselImages.join("\n");
        renderCarouselThumbnails();
        renderCanvas();
        pushHistory();
      }
    };
    reader.readAsDataURL(file);
  }
}

function renderCarouselThumbnails() {
  const data = elements.find(item => item.id === selectedElementId);
  const container = document.getElementById("propCarouselList");
  if (!data || data.type !== "carousel" || !container) return;

  container.innerHTML = "";
  const images = data.carouselImages || defaultCarouselImages;

  images.forEach((src, idx) => {
    const item = document.createElement("div");
    item.className = "carousel-thumb-item";

    const img = document.createElement("img");
    img.src = src;
    img.className = "carousel-thumb-img";
    item.appendChild(img);

    const delBtn = document.createElement("button");
    delBtn.className = "carousel-thumb-del";
    delBtn.innerHTML = "✕";
    delBtn.title = "Hapus Gambar";
    delBtn.onclick = (e) => {
      e.stopPropagation();
      data.carouselImages.splice(idx, 1);
      if (data.carouselImages.length === 0) {
        data.carouselImages = [...defaultCarouselImages];
      }
      data.carouselActiveIndex = 0;
      const carouselInput = document.getElementById("propCarouselImages");
      if (carouselInput) carouselInput.value = data.carouselImages.join("\n");
      renderCarouselThumbnails();
      renderCanvas();
      pushHistory();
    };
    item.appendChild(delBtn);

    container.appendChild(item);
  });
}

// ==============================================================================
// 6. AI MARKETING ASSISTANT
// ==============================================================================
function askAICopywriter() {
  const data = elements.find(item => item.id === selectedElementId);
  if (!data) return;

  const promptInput = document.getElementById("propAiPrompt");
  const prompt = promptInput ? promptInput.value.trim() : "";
  if (!prompt) {
    showToastNotification("Silakan masukkan permintaan promosi atau pertanyaan.");
    return;
  }

  const spinner = document.getElementById("aiAssistSpinner");
  const btnText = document.getElementById("aiAssistBtnText");
  const suggestionsArea = document.getElementById("aiSuggestionsArea");
  const suggestionsContent = document.getElementById("aiSuggestionsContent");

  if (spinner) spinner.classList.remove("hidden");
  if (btnText) btnText.innerText = "Memproses...";
  if (suggestionsArea) suggestionsArea.classList.add("hidden");

  fetch('/api/ai/copywriter_assist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: prompt,
      type: data.type,
      current_content: data.content || ""
    })
  })
    .then(res => res.json())
    .then(resData => {
      if (spinner) spinner.classList.add("hidden");
      if (btnText) btnText.innerText = "Tanya AI Assist";

      if (resData.success && resData.response) {
        if (suggestionsArea && suggestionsContent) {
          let formatted = resData.response;
          formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
          formatted = formatted.replace(/### (.*?)\n/g, '<h3>$1</h3>');
          formatted = formatted.replace(/## (.*?)\n/g, '<h2>$1</h2>');
          formatted = formatted.replace(/# (.*?)\n/g, '<h1>$1</h1>');

          suggestionsContent.innerHTML = formatted;
          suggestionsArea.classList.remove("hidden");
        }
      } else {
        showToastNotification("Gagal: " + (resData.error || "Terjadi kesalahan."));
      }
    })
    .catch(err => {
      if (spinner) spinner.classList.add("hidden");
      if (btnText) btnText.innerText = "Tanya AI Assist";
      console.error(err);
      showToastNotification("Gagal menghubungi asisten AI.");
    });
}

function applyAiSuggestion() {
  const data = elements.find(item => item.id === selectedElementId);
  if (!data) return;

  const contentDiv = document.getElementById("aiSuggestionsContent");
  if (!contentDiv) return;

  const txt = contentDiv.innerText;

  const textInput = document.getElementById("propTextContent");
  if (textInput) {
    textInput.value = txt;
    updateSelectedElementContent();
    showToastNotification("Teks AI diterapkan!");
  }
}

// ==============================================================================
// 7. MEDIA EMBED COMPONENT
// ==============================================================================
function getYouTubeEmbedUrl(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : null;
}

function getMapsEmbedUrl(url) {
  if (!url) return null;
  if (url.includes('google.com/maps/embed') || url.includes('google.com/maps/d/embed')) {
    return url;
  }
  return null;
}

function createMediaEmbedDOM(item) {
  const wrapper = document.createElement("div");
  wrapper.className = "element-media-embed";
  wrapper.style.width = "100%";
  wrapper.style.height = "100%";
  wrapper.style.position = "relative";
  wrapper.style.borderRadius = "inherit";
  wrapper.style.overflow = "hidden";
  wrapper.style.background = "#e2f0f5";

  const url = item.url || "";
  let finalEmbedUrl = url;

  const ytUrl = getYouTubeEmbedUrl(url);
  const isYt = !!ytUrl;
  if (isYt) {
    finalEmbedUrl = ytUrl;
  }

  const mapsUrl = getMapsEmbedUrl(url);
  const isMaps = !!mapsUrl;

  const iframe = document.createElement("iframe");
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "none";
  iframe.setAttribute("allowfullscreen", "");

  if (url) {
    if (isYt || (isMaps && url.includes('embed'))) {
      iframe.src = finalEmbedUrl;
      wrapper.appendChild(iframe);
    } else {
      iframe.src = url;
      const isGoogleMapsLink = url.includes('google.com/maps') || url.includes('maps.app.goo.gl');
      const previewTitle = isGoogleMapsLink ? "Google Maps" : "Kunjungi Situs Web";
      const previewDesc = isGoogleMapsLink ? "Klik untuk melihat lokasi di peta Google Maps" : url;
      const previewIcon = isGoogleMapsLink ? "📍" : "🌐";

      iframe.srcdoc = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;font-family:sans-serif;color:#2c5d6b;background:#f2f7f9;text-align:center;padding:20px;box-sizing:border-box;">
          <div style="font-size:36px;margin-bottom:8px;">${previewIcon}</div>
          <span style="font-size:14px;font-weight:bold;margin-bottom:4px;">${previewTitle}</span>
          <span style="font-size:11px;color:#7a8a94;word-break:break-all;max-width:90%;">${previewDesc}</span>
          <div style="margin-top:12px;padding:6px 14px;background:#38a0c4;color:white;font-size:11px;font-weight:bold;border-radius:6px;box-shadow:0 2px 4px rgba(0,0,0,0.1);">Buka Link Eksternal</div>
        </div>
      `;
      wrapper.appendChild(iframe);
    }
  } else {
    iframe.srcdoc = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;font-family:sans-serif;color:#7a8a94;background:#f2f7f9;text-align:center;padding:10px;box-sizing:border-box;">
        <div style="font-size:24px;margin-bottom:8px;">🌐</div>
        <span style="font-size:12px;font-weight:bold;">Media Embed</span>
        <span style="font-size:10px;margin-top:4px;color:#999;">Masukkan link YouTube, Maps, atau Website di pengaturan</span>
      </div>
    `;
    wrapper.appendChild(iframe);
  }

  const overlay = document.createElement("div");
  overlay.className = "media-embed-overlay";
  overlay.style.position = "absolute";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.zIndex = "3";
  overlay.style.cursor = "pointer";
  overlay.style.background = "transparent";

  if (!isEditMode && url) {
    overlay.addEventListener("click", (e) => {
      e.stopPropagation();
      window.open(url, "_blank");
    });
  }
  wrapper.appendChild(overlay);

  return wrapper;
}

function updateMediaEmbedUrl(val) {
  const data = elements.find(item => item.id === selectedElementId);
  if (!data || data.type !== "media_embed") return;

  data.url = val;
  renderCanvas();
  pushHistoryDebounced();
}



