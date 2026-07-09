/**
 * Global Javascript for Landing Page (Beranda)
 * Handles: Header scroll effect, mobile menu toggle, smooth scroll, and interactive RAG Simulator.
 */

document.addEventListener('DOMContentLoaded', () => {
    initHeaderScroll();
    initMobileMenu();
    initSmoothScroll();
    initRAGSimulator();
    initBuilderSimulator();
    initBufferingSimulator();
    initTypewriterEffect();
    initSimulatorToggles();
});

/**
 * 1. HEADER SCROLL EFFECT
 * Add active styling/shadow to header when page is scrolled down
 */
function initHeaderScroll() {
    const header = document.getElementById('header');
    if (!header) return;

    const checkScroll = () => {
        if (window.scrollY > 30) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    };

    window.addEventListener('scroll', checkScroll);
    checkScroll(); // Check initially
}

/**
 * 2. MOBILE MENU TOGGLE
 * Open/close mobile menu using hamburger icon
 */
function initMobileMenu() {
    const menuToggle = document.getElementById('menu-toggle');
    const navMenu = document.getElementById('nav-menu');
    if (!menuToggle || !navMenu) return;

    menuToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        menuToggle.classList.toggle('active');
        navMenu.classList.toggle('active');
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!navMenu.contains(e.target) && !menuToggle.contains(e.target)) {
            menuToggle.classList.remove('active');
            navMenu.classList.remove('active');
        }
    });
}

/**
 * 3. SMOOTH SCROLL FOR LINKS
 * Add smooth scroll for anchor links and auto-close mobile menu
 */
function initSmoothScroll() {
    const links = document.querySelectorAll('a[href^="#"]');
    const menuToggle = document.getElementById('menu-toggle');
    const navMenu = document.getElementById('nav-menu');

    links.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;

            const targetSection = document.querySelector(targetId);
            if (targetSection) {
                // Close mobile menu if open
                if (menuToggle && navMenu) {
                    menuToggle.classList.remove('active');
                    navMenu.classList.remove('active');
                }

                // Scroll to section with offset for header
                const headerHeight = document.getElementById('header')?.offsetHeight || 80;
                const targetPosition = targetSection.offsetTop - headerHeight;

                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

/**
 * 4. INTERACTIVE RAG SIMULATOR
 * Simulates a chatbot answering UMKM queries using Retrieval-Augmented Generation 
 * and shows RAGAS evaluation metrics dynamically.
 */
function initRAGSimulator() {
    const questions = document.querySelectorAll('.sim-question-btn');
    const chatMessages = document.getElementById('sim-chat-messages');
    if (!questions.length || !chatMessages) return;

    // Mock answers map
    const mockDatabase = {
        q1: {
            question: "Tunjukkan persebaran UMKM Kuliner di Kecamatan Coblong.",
            answer: `
               Ditemukan <strong>142 pelaku UMKM Kuliner</strong> terdaftar di wilayah Kecamatan Coblong.<br><br>
               <ul>
                 <li><strong>Belimbing</strong>: 58 usaha (Didominasi Kafe & Resto Kopi)</li>
                 <li><strong>Sadang Serang</strong>: 44 usaha (Didominasi Warung Makan & Kedai Kelontong)</li>
                 <li><strong>Sekeloa</strong>: 40 usaha (Didominasi Jasa Katering & Makanan Ringan)</li>
               </ul><br>
               Sistem telah memetakan kluster kepadatan usaha kuliner untuk membantu Anda melihat titik konsentrasi persaingan pasar secara geospasial.`,
            ragas: {
                faithfulness: 0.96,
                answer_relevance: 0.98,
                context_precision: 0.94
            }
        },
        q2: {
            question: "Bagaimana hubungan rantai pasok antara Pengrajin Kayu dan Toko Mebel?",
            answer: `
               Berdasarkan relasi antar entitas bisnis di wilayah tersebut:<br><br>
               <ul>
                 <li><strong>Pengrajin Kayu (Hulu)</strong> mensuplai bahan baku mentah (Kayu Jati/Mahoni bersertifikat) ke <strong>3 Distributor Utama</strong>.</li>
                 <li><strong>Distributor Utama</strong> mendistribusikan kayu olahan setengah jadi ke <strong>8 Toko Mebel Lokal</strong> di area industri kreatif.</li>
                 <li>Terdeteksi <strong>potensi kolaborasi baru</strong>: 2 Pengrajin Kayu di Kelurahan Cihapit memiliki sisa limbah serutan kayu yang bisa dialokasikan untuk <strong>UMKM Kerajinan Tangan Souvenir</strong> terdekat.</li>
               </ul><br>
               Sinergi rantai pasok ini meminimalkan biaya logistik hingga <strong>15%</strong> melalui pemetaan rute terdekat.`,
            ragas: {
                faithfulness: 0.93,
                answer_relevance: 0.95,
                context_precision: 0.91
            }
        },
        q3: {
            question: "Di mana potensi celah bisnis retail yang belum tergarap di Kelurahan Belimbing?",
            answer: `
               Analisis menunjukkan ketidakseimbangan pasokan dan permintaan di beberapa sektor retail Kelurahan Belimbing:<br><br>
               <ul>
                 <li><strong>Kepadatan Kafe Kopi</strong>: Sangat Tinggi (Indeks Persaingan: 0.89). *Tidak direkomendasikan untuk wirausahawan baru*.</li>
                 <li><strong>Celah Retail Terbuka</strong>: Minimarket Bahan Organik & Sayur Segar Harian. Indeks kebutuhan warga di area Belimbing atas mencapai <strong>0.78</strong>, namun penyedia lokal terdekat berjarak >2.5 km.</li>
                 <li><strong>Rekomendasi Lokasi</strong>: Sepanjang Jl. Belimbing Pojok bagian barat untuk menangkap pasar residensial padat penduduk.</li>
               </ul>`,
            ragas: {
                faithfulness: 0.95,
                answer_relevance: 0.92,
                context_precision: 0.96
            }
        }
    };

    questions.forEach(btn => {
        btn.addEventListener('click', () => {
            const qKey = btn.getAttribute('data-question');
            const data = mockDatabase[qKey];
            if (!data) return;

            // 1. Disable buttons during simulation
            questions.forEach(b => b.classList.add('disabled'));

            // 2. Append User Message
            appendMessage('user', data.question);

            // 3. Append Loading Indicator
            const loadingId = appendLoading();

            // 4. Scroll to bottom
            chatMessages.scrollTop = chatMessages.scrollHeight;

            // 5. Simulate network/AI delay
            setTimeout(() => {
                // Remove loading
                const loadingElement = document.getElementById(loadingId);
                if (loadingElement) loadingElement.remove();

                // Append Bot Answer
                appendMessage('bot', data.answer, data.ragas);

                // Scroll to bottom again
                chatMessages.scrollTop = chatMessages.scrollHeight;

                // Re-enable buttons
                questions.forEach(b => b.classList.remove('disabled'));
            }, 1200);
        });
    });

    function appendMessage(sender, text, ragasData = null) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `sim-message ${sender}`;

        let innerHTML = `<div class="sim-bubble">${text}</div>`;

        // If RAGAS metrics are available, add a styled evaluation card below the answer
        if (ragasData) {
            innerHTML += `
        <div class="ragas-card">
          <div class="ragas-title">Evaluasi Framework RAGAS</div>
          <div class="ragas-metrics">
            <div class="metric">
              <span class="metric-label">Faithfulness (Akurasi Fakta)</span>
              <div class="metric-bar-container">
                <div class="metric-bar" style="width: ${ragasData.faithfulness * 100}%"></div>
              </div>
              <span class="metric-value">${ragasData.faithfulness.toFixed(2)}</span>
            </div>
            <div class="metric">
              <span class="metric-label">Answer Relevance (Relevansi Jawaban)</span>
              <div class="metric-bar-container">
                <div class="metric-bar" style="width: ${ragasData.answer_relevance * 100}%"></div>
              </div>
              <span class="metric-value">${ragasData.answer_relevance.toFixed(2)}</span>
            </div>
          </div>
          <div class="ragas-footer">Respons Terverifikasi Bebas Halusinasi</div>
        </div>
      `;
        }

        messageDiv.innerHTML = innerHTML;
        chatMessages.appendChild(messageDiv);
    }

    function appendLoading() {
        const loadingId = 'loading-' + Date.now();
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'sim-message bot loading-msg';
        loadingDiv.id = loadingId;
        loadingDiv.innerHTML = `
      <div class="sim-bubble">
        <span class="dot-loader"></span>
        <span class="dot-loader"></span>
        <span class="dot-loader"></span>
      </div>
    `;
        chatMessages.appendChild(loadingDiv);
        return loadingId;
    }
}

/**
 * 5. INTERACTIVE LANDING PAGE BUILDER SIMULATOR
 * Dynamically updates the preview screen based on dropdown selection and theme dot clicks.
 */
function initBuilderSimulator() {
    const selectProfile = document.getElementById('builder-select-profile');
    const themeDots = document.querySelectorAll('.theme-dot');
    const previewTitle = document.getElementById('preview-title');
    const previewSector = document.getElementById('preview-sector');
    const previewDesc = document.getElementById('preview-desc');
    const previewBanner = document.getElementById('preview-banner');
    const previewUrl = document.querySelector('.preview-url');
    const previewBtnVisit = document.getElementById('preview-btn-visit');

    if (!selectProfile || !previewTitle || !previewSector || !previewDesc || !previewBanner) return;

    const profileData = {
        kopi: {
            title: "Kopi Cantik Belimbing",
            sector: "Kuliner - Kafe Kopi",
            desc: "Kopi arabika pilihan dengan cita rasa autentik, tersedia dalam seduhan manual dan kemasan bubuk untuk dinikmati kapan saja.",
            url: "2211080.id/kopidicantik"
        },
        mebel: {
            title: "Mebel Jati Abadi",
            sector: "Manufaktur - Kerajinan Kayu",
            desc: "Penyedia furnitur jati berkualitas tinggi langsung dari pengrajin terpercaya dengan ketahanan produk hingga puluhan tahun.",
            url: "2211080.id/mebeljatiabadi"
        },
        kerajinan: {
            title: "Kerajinan Bambu Jaya",
            sector: "Industri Kreatif - Anyaman",
            desc: "Produk kerajinan anyaman bambu ramah lingkungan berkualitas ekspor untuk memperindah ruang interior hunian modern Anda.",
            url: "2211080.id/bambujaya"
        }
    };

    const themeConfig = {
        blue: {
            gradient: "linear-gradient(135deg, var(--primary), var(--secondary))",
            color: "#38a0c4"
        },
        green: {
            gradient: "linear-gradient(135deg, #2ed573, #20bf6b)",
            color: "#20bf6b"
        },
        orange: {
            gradient: "linear-gradient(135deg, #ffa502, #ff7f50)",
            color: "#ffa502"
        }
    };

    const applyTheme = (theme) => {
        const config = themeConfig[theme];
        if (config) {
            previewBanner.style.background = config.gradient;
            previewTitle.style.color = config.color;
            previewSector.style.color = config.color;
            if (previewBtnVisit) {
                previewBtnVisit.style.background = config.gradient;
                previewBtnVisit.style.borderColor = "transparent";
            }
        }
    };

    // Update profile texts
    selectProfile.addEventListener('change', () => {
        const val = selectProfile.value;
        const data = profileData[val];
        if (data) {
            previewTitle.textContent = data.title;
            previewSector.textContent = data.sector;
            previewDesc.textContent = data.desc;
            if (previewUrl) previewUrl.textContent = data.url;
        }
    });

    // Update theme colors
    themeDots.forEach(dot => {
        dot.addEventListener('click', () => {
            // Remove active from others
            themeDots.forEach(d => d.classList.remove('active'));
            dot.classList.add('active');

            const theme = dot.getAttribute('data-theme');
            applyTheme(theme);
        });
    });

    // Apply initial theme based on active dot in HTML
    const activeDot = document.querySelector('.theme-dot.active');
    if (activeDot) {
        const initialTheme = activeDot.getAttribute('data-theme');
        applyTheme(initialTheme);
    }
}

/**
 * 6. INTERACTIVE SPATIAL BUFFERING SIMULATOR
 * Simulates a geospasial buffering search circle expanding/shrinking.
 */
function initBufferingSimulator() {
    const radiusBtns = document.querySelectorAll('.radius-btn');
    const bufferOverlay = document.getElementById('buffer-overlay');
    const statRadius = document.getElementById('stat-radius');
    const statCount = document.getElementById('stat-count');
    const statList = document.getElementById('stat-list');
    const competitorPins = document.querySelectorAll('.competitor-pin');

    if (!radiusBtns.length || !bufferOverlay || !statRadius || !statCount || !statList) return;

    const bufferConfig = {
        '500': {
            size: '60px',
            radiusText: '500 meter',
            countText: '1 Usaha',
            listText: 'Kopi Cantik Belimbing',
            visibleCount: 1
        },
        '1000': {
            size: '110px',
            radiusText: '1000 meter',
            countText: '3 Usaha',
            listText: 'Kopi Cantik Belimbing, Kopi Senja, Mebel Jati Abadi',
            visibleCount: 3
        },
        '1500': {
            size: '160px',
            radiusText: '1500 meter',
            countText: '4 Usaha',
            listText: 'Kopi Cantik Belimbing, Kopi Senja, Mebel Jati Abadi, Kerajinan Bambu',
            visibleCount: 4
        }
    };

    // Helper to update pins visibility
    const updatePins = (visibleCount) => {
        competitorPins.forEach((pin, index) => {
            if (index < visibleCount) {
                pin.classList.add('visible');
            } else {
                pin.classList.remove('visible');
            }
        });
    };

    // Initial update
    updatePins(1);
    if (competitorPins[0]) competitorPins[0].classList.add('visible');

    radiusBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Toggle active classes
            radiusBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const rad = btn.getAttribute('data-radius');
            const config = bufferConfig[rad];

            if (config) {
                // Grow/shrink overlay
                bufferOverlay.style.width = config.size;
                bufferOverlay.style.height = config.size;

                // Update stats
                statRadius.textContent = config.radiusText;
                statCount.textContent = config.countText;
                statList.textContent = config.listText;

                // Show relevant competitor pins
                updatePins(config.visibleCount);
            }
        });
    });
}

/**
 * 7. TYPEWRITER EFFECT WITH INTERVAL REPEAT (10-12s)
 */
function initTypewriterEffect() {
    const targets = [
        { selector: '.hero-content h1', text: 'Membangun Ekosistem UMKM Berbasis Data untuk Mendorong Pertumbuhan Ekonomi Lokal' },
        { selector: '.tentang-intro h2', text: 'Pentingnya Digitalisasi & Integrasi UMKM' },
        { selector: '.uji-coba-intro h2', text: 'Solusi yang Ditawarkan' },
        { selector: '#dampak h2', text: 'Dampak Nyata Untuk Setiap Pemangku Kepentingan' },
        { selector: '.research-title', text: 'RANCANG BANGUN APLIKASI WEB GIS BERBASIS KNOWLEDGE GRAPH DAN RETRIEVAL-AUGMENTED GENERATION (RAG) UNTUK PEMETAAN DAN VISUALISASI LINGKUNGAN USAHA LOKAL' },
        { selector: '.profile-name', text: 'Bayu Dwi Prasetyo' },
        { selector: '.section-title-wrapper h2', text: 'Proyek Utama' }
    ];

    targets.forEach(item => {
        const element = document.querySelector(item.selector);
        if (!element) return;

        const text = item.text;
        
        // Setup inner DOM structure
        element.innerHTML = '';
        const contentSpan = document.createElement('span');
        contentSpan.className = 'typewriter-content';
        const cursorSpan = document.createElement('span');
        cursorSpan.className = 'typewriter-cursor';
        cursorSpan.textContent = '|';
        element.appendChild(contentSpan);
        element.appendChild(cursorSpan);

        let typingActive = false;

        const type = () => {
            if (typingActive) return;
            typingActive = true;
            contentSpan.textContent = '';
            cursorSpan.style.opacity = '1';
            let index = 0;
            
            const interval = setInterval(() => {
                if (index < text.length) {
                    contentSpan.textContent += text.charAt(index);
                    index++;
                } else {
                    clearInterval(interval);
                    cursorSpan.style.opacity = '0';
                    typingActive = false;
                    
                    // Repeat after 11 seconds (10-12s interval)
                    setTimeout(type, 11000);
                }
            }, 80); // 80ms per character
        };

        type();
    });
}

/**
 * 8. SIMULATOR TABS / TOGGLES
 */
function initSimulatorToggles() {
    const selectors = document.querySelectorAll('.sim-selector-card');
    const cards = document.querySelectorAll('.simulator-card');

    if (!selectors.length || !cards.length) return;

    selectors.forEach(selector => {
        selector.addEventListener('click', () => {
            const targetId = selector.getAttribute('data-target');
            const targetCard = document.getElementById(targetId);

            if (selector.classList.contains('active')) {
                // If it is active, close/hide it
                selector.classList.remove('active');
                if (targetCard) targetCard.classList.remove('active');
            } else {
                // Remove active classes from all selectors and cards
                selectors.forEach(s => s.classList.remove('active'));
                cards.forEach(c => c.classList.remove('active'));

                // Activate clicked target
                selector.classList.add('active');
                if (targetCard) {
                    targetCard.classList.add('active');
                    
                    // Smooth scroll to the simulator card
                    setTimeout(() => {
                        targetCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }, 100);
                }
            }
        });
    });
}

