/* ═══════════════════════════════════════════════════════════
   Kkokki - Digital Rooster
   Frontend Application (SPA)
   ═══════════════════════════════════════════════════════════ */

// ─── Assets ───────────────────────────────────────────────
const ASSETS = {
    bgSunny: '/static/assets/bg_home_sunny_1769947415146.png',
    bgStormy: '/static/assets/bg_home_stormy_delay_1769947430952.png',
    charIdle: '/static/assets/char_kkokki_idle_1769947451923.png',
    charPanic: '/static/assets/char_kkokki_panic_1769947468467.png',
    bgm1: '/static/assets/bgm_1.mp3',
    bgm2: '/static/assets/bgm_2.mp3',
    bgm3: '/static/assets/bgm_3.mp3',
};

// ─── State ────────────────────────────────────────────────
const State = {
    currentScreen: 'map',
    isRunning: false,
    transportMode: 'car',
    selectionMode: 'start',  // 'start' or 'end'
    startCoord: null,
    endCoord: null,
    hasRoutePreview: false,

    // Map objects
    map: null,
    searchMarkers: [],
    routeMarkers: { start: null, end: null },
    routeLines: [],

    // Monitor data (from server)
    latestResult: null,

    // Alarm
    alarmTriggered: false,
    earlyWarningShown: false,
    alarmAudio: null,
    audioContext: null,

    // Wake lock
    wakeLock: null,

    // Timers
    searchTimeout: null,
    pollInterval: null,
    countdownInterval: null,
    bgmPreviewAudio: null,
};

// ─── Settings (persisted to localStorage) ─────────────────
const DEFAULT_SETTINGS = {
    bufferTime: 30,
    prepTime: 30,
    earlyWarning: false,
    urgentAlert: true,
    selectedBGM: 'bgm_1',
};

let Settings = { ...DEFAULT_SETTINGS };

function loadSettings() {
    try {
        const stored = localStorage.getItem('kkokki-settings');
        if (stored) Object.assign(Settings, JSON.parse(stored));
    } catch (e) { /* ignore */ }
}

function saveSettings() {
    localStorage.setItem('kkokki-settings', JSON.stringify(Settings));
}


/* ═══════════════════════════════════════════════════════════
   MODULE: Screen Management
   ═══════════════════════════════════════════════════════════ */

function showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById('screen-' + name);
    if (target) target.classList.add('active');
    State.currentScreen = name;

    // Screen-specific hooks
    if (name === 'map' && State.map) {
        setTimeout(() => State.map.invalidateSize(), 150);
    }
    if (name === 'settings') {
        populateSettingsUI();
    }
    if (name === 'alarm') {
        startAlarmSequence();
    }
    if (name === 'main') {
        updateMainScreen();
    }
}


/* ═══════════════════════════════════════════════════════════
   MODULE: Map
   ═══════════════════════════════════════════════════════════ */

function initMap() {
    State.map = L.map('map', { zoomControl: false });
    State.map.setView([37.5665, 126.9780], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19
    }).addTo(State.map);

    L.control.zoom({ position: 'bottomright' }).addTo(State.map);

    // Fix tile loading
    setTimeout(() => { State.map.invalidateSize(); }, 200);
    setTimeout(() => { State.map.invalidateSize(); }, 500);
    window.addEventListener('resize', () => {
        setTimeout(() => { if (State.map) State.map.invalidateSize(); }, 100);
    });

    // Map click → set location
    State.map.on('click', async (e) => {
        const { lat, lng: lon } = e.latlng;
        const place = { name: 'Selected Location', lat, lon, address: `${lat.toFixed(5)}, ${lon.toFixed(5)}` };
        try {
            const res = await fetch(`/api/reverse-geocode?lat=${lat}&lon=${lon}`);
            const data = await res.json();
            if (data.success) {
                place.name = data.name || 'Selected Location';
                place.address = data.address || place.address;
            }
        } catch (e) { /* use defaults */ }
        selectPlace(place);
    });

    // Close dropdown on map click
    State.map.on('click', () => {
        document.getElementById('searchResults').classList.remove('active');
    });
}

function createPinIcon(label, type) {
    const cls = type === 'start' ? 'pin-start' : 'pin-end';
    const emoji = type === 'start' ? '&#x1F680;' : '&#x1F3C1;';
    return L.divIcon({
        html: `<div class="custom-pin ${cls}">
            <div class="pin-body"><span style="font-size:14px">${emoji}</span></div>
            <div class="pin-label">${label}</div>
        </div>`,
        className: '',
        iconSize: [40, 40],
        iconAnchor: [20, 40]
    });
}

function selectPlace(place) {
    document.getElementById('searchResults').classList.remove('active');
    document.getElementById('searchInput').value = '';

    if (State.selectionMode === 'start') {
        State.startCoord = place;
        document.getElementById('startDisplay').innerText = place.name;
        document.getElementById('startDisplay').classList.remove('empty');
        if (State.routeMarkers.start) State.map.removeLayer(State.routeMarkers.start);
        State.routeMarkers.start = L.marker([place.lat, place.lon], {
            icon: createPinIcon('START', 'start'), zIndexOffset: 1000
        }).addTo(State.map);
        State.map.flyTo([place.lat, place.lon], 15, { duration: 0.5 });
        setSelectionMode('end');
        setTimeout(() => document.getElementById('searchInput').focus(), 600);
    } else {
        State.endCoord = place;
        document.getElementById('endDisplay').innerText = place.name;
        document.getElementById('endDisplay').classList.remove('empty');
        if (State.routeMarkers.end) State.map.removeLayer(State.routeMarkers.end);
        State.routeMarkers.end = L.marker([place.lat, place.lon], {
            icon: createPinIcon('END', 'end'), zIndexOffset: 1000
        }).addTo(State.map);
    }

    // Clear search markers
    State.searchMarkers.forEach(m => State.map.removeLayer(m));
    State.searchMarkers = [];

    // Preview route if both set
    if (State.startCoord && State.endCoord) {
        previewRoute();
        updateStartBtn();
    }

    // Fit bounds when both markers exist
    if (State.routeMarkers.start && State.routeMarkers.end) {
        const bounds = L.latLngBounds();
        bounds.extend(State.routeMarkers.start.getLatLng());
        bounds.extend(State.routeMarkers.end.getLatLng());
        setTimeout(() => State.map.fitBounds(bounds, { padding: [80, 80], maxZoom: 14 }), 300);
    }
}

function setSelectionMode(mode) {
    State.selectionMode = mode;
    State.hasRoutePreview = false;
    document.getElementById('rowStart').classList.toggle('selecting', mode === 'start');
    document.getElementById('rowEnd').classList.toggle('selecting', mode === 'end');

    const indicator = document.getElementById('searchModeIndicator');
    const input = document.getElementById('searchInput');
    if (mode === 'start') {
        indicator.innerText = 'START';
        indicator.className = 'search-mode-indicator mode-start';
        input.placeholder = 'Search start point...';
    } else {
        indicator.innerText = 'DEST';
        indicator.className = 'search-mode-indicator mode-end';
        input.placeholder = 'Search destination...';
    }
}

function updateStartBtn() {
    const btn = document.getElementById('startAdventureBtn');
    btn.disabled = !(State.startCoord && State.endCoord);
}

// ─── Search ───────────────────────────────────────────────

function debounceSearch() {
    clearTimeout(State.searchTimeout);
    State.searchTimeout = setTimeout(performSearch, 500);
}

async function performSearch() {
    const query = document.getElementById('searchInput').value.trim();
    const resultList = document.getElementById('searchResults');

    State.searchMarkers.forEach(m => State.map.removeLayer(m));
    State.searchMarkers = [];

    if (!query || query.length < 2) {
        resultList.innerHTML = '<div class="search-hint">Type a place name to search</div>';
        resultList.classList.add('active');
        return;
    }

    resultList.innerHTML = '<div class="search-loading">Searching...</div>';
    resultList.classList.add('active');

    try {
        const res = await fetch(`/api/search?keyword=${encodeURIComponent(query)}`);
        const data = await res.json();

        if (!data.results || data.results.length === 0) {
            resultList.innerHTML = '<div class="search-no-results">No results found</div>';
            return;
        }

        resultList.innerHTML = '';
        const bounds = L.latLngBounds();

        data.results.forEach((place, i) => {
            // Map marker
            const icon = L.divIcon({
                html: `<div class="custom-pin search-result-pin"><div class="pin-body pin-search"><span class="pin-number">${i + 1}</span></div></div>`,
                className: '', iconSize: [30, 30], iconAnchor: [15, 30]
            });
            const marker = L.marker([place.lat, place.lon], { icon }).addTo(State.map);
            marker.on('click', () => { selectPlace(place); State.map.setView([place.lat, place.lon], 16); });
            State.searchMarkers.push(marker);
            bounds.extend([place.lat, place.lon]);

            // Dropdown item
            const item = document.createElement('div');
            item.className = 'search-item';
            item.innerHTML = `
                <span class="item-number">${i + 1}</span>
                <div class="item-content">
                    <strong>${highlightMatch(place.name, query)}</strong>
                    <small>${place.address || ''}</small>
                </div>
                <span class="item-select-hint">${State.selectionMode === 'start' ? 'START' : 'DEST'}</span>
            `;
            item.addEventListener('click', () => { selectPlace(place); State.map.setView([place.lat, place.lon], 16); });
            resultList.appendChild(item);
        });

        if (State.routeMarkers.start) bounds.extend(State.routeMarkers.start.getLatLng());
        if (State.routeMarkers.end) bounds.extend(State.routeMarkers.end.getLatLng());
        if (bounds.isValid()) State.map.fitBounds(bounds, { padding: [50, 200] });

    } catch (err) {
        resultList.innerHTML = '<div class="search-no-results">Search error</div>';
    }
}

function highlightMatch(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
}

// ─── Route Preview ────────────────────────────────────────

async function previewRoute() {
    if (!State.startCoord || !State.endCoord) return;

    document.getElementById('statusText').innerText = 'Calculating route...';

    try {
        const res = await fetch('/api/route', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                start: State.startCoord,
                end: State.endCoord,
                transport: State.transportMode
            })
        });
        const data = await res.json();

        if (data.success && data.route) {
            const route = data.route;
            let msg = '';
            if (route.mode === 'transit') {
                msg = `${route.minutes}min`;
                if (route.fare) msg += ` | ${route.fare.toLocaleString()}won`;
                if (route.transfers !== undefined) msg += ` | ${route.transfers} transfers`;
                if (route.path_type) msg += ` (${route.path_type})`;
            } else if (route.mode === 'walk') {
                msg = `${route.minutes}min | ${route.distance}km`;
            } else {
                msg = `${route.minutes}min | ${route.distance}km`;
            }
            document.getElementById('statusText').innerText = msg;
            State.hasRoutePreview = true;

            // Draw polyline on map
            drawRoutePolyline(route.coordinates, route.mode);
        } else {
            document.getElementById('statusText').innerText = data.error || 'Route calculation failed';
            State.hasRoutePreview = false;
            drawFallbackLine();
        }
    } catch (err) {
        document.getElementById('statusText').innerText = 'Route calculation error';
        State.hasRoutePreview = false;
        drawFallbackLine();
    }
}

function drawRoutePolyline(coordinates, mode) {
    // Remove old lines
    State.routeLines.forEach(l => State.map.removeLayer(l));
    State.routeLines = [];

    if (!coordinates || coordinates.length === 0 || mode === 'transit') {
        drawFallbackLine();
        return;
    }

    // TMap returns [lon, lat] pairs — Leaflet needs [lat, lon]
    const latLngs = coordinates.map(c => [c[1], c[0]]);

    // Shadow line
    const shadow = L.polyline(latLngs, {
        color: '#000', weight: 7, opacity: 0.4
    }).addTo(State.map);
    State.routeLines.push(shadow);

    // Main line
    const main = L.polyline(latLngs, {
        color: '#eea02b', weight: 4, opacity: 0.9, lineCap: 'round', lineJoin: 'round'
    }).addTo(State.map);
    State.routeLines.push(main);
}

function drawFallbackLine() {
    State.routeLines.forEach(l => State.map.removeLayer(l));
    State.routeLines = [];

    if (!State.routeMarkers.start || !State.routeMarkers.end) return;
    const s = State.routeMarkers.start.getLatLng();
    const e = State.routeMarkers.end.getLatLng();

    const line = L.polyline([s, e], {
        color: '#eea02b', weight: 4, opacity: 0.8, dashArray: '10,10', lineCap: 'round'
    }).addTo(State.map);
    State.routeLines.push(line);
}

function swapLocations() {
    const temp = State.startCoord;
    State.startCoord = State.endCoord;
    State.endCoord = temp;

    const sd = document.getElementById('startDisplay');
    const ed = document.getElementById('endDisplay');
    const tempText = sd.innerText;
    const tempEmpty = sd.classList.contains('empty');
    sd.innerText = ed.innerText;
    sd.classList.toggle('empty', ed.classList.contains('empty'));
    ed.innerText = tempText;
    ed.classList.toggle('empty', tempEmpty);

    const tempMarker = State.routeMarkers.start;
    State.routeMarkers.start = State.routeMarkers.end;
    State.routeMarkers.end = tempMarker;
    if (State.routeMarkers.start) State.routeMarkers.start.setIcon(createPinIcon('START', 'start'));
    if (State.routeMarkers.end) State.routeMarkers.end.setIcon(createPinIcon('END', 'end'));

    if (State.startCoord && State.endCoord) previewRoute();
}

function setTransportMode(mode) {
    State.transportMode = mode;
    document.querySelectorAll('.transport-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.transport-btn[data-mode="${mode}"]`).classList.add('active');
    if (State.startCoord && State.endCoord) previewRoute();
}


/* ═══════════════════════════════════════════════════════════
   MODULE: Start Adventure / Monitoring Control
   ═══════════════════════════════════════════════════════════ */

async function startAdventure() {
    if (!State.startCoord || !State.endCoord) return;
    const targetTime = document.getElementById('targetTime').value;
    if (!targetTime) return;

    try {
        await fetch('/api/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                start: State.startCoord,
                end: State.endCoord,
                time: targetTime,
                transport: State.transportMode,
                prep_time: Settings.prepTime,
                buffer_time: Settings.bufferTime,
                early_warning: Settings.earlyWarning,
                urgent_alert: Settings.urgentAlert,
            })
        });
        State.isRunning = true;
        State.alarmTriggered = false;
        State.earlyWarningShown = false;
        requestWakeLock();
        showScreen('main');
        updateToggleUI(true);
    } catch (err) {
        console.error('Start error:', err);
    }
}

async function stopMonitoring() {
    try {
        await fetch('/api/stop', { method: 'POST' });
    } catch (e) { /* ignore */ }
    State.isRunning = false;
    State.latestResult = null;
    releaseWakeLock();
    updateToggleUI(false);
    showScreen('map');
}

function updateToggleUI(on) {
    const toggle = document.getElementById('monitorToggle');
    const text = document.getElementById('toggleText');
    if (on) {
        toggle.classList.add('active');
        text.innerText = 'ON';
    } else {
        toggle.classList.remove('active');
        text.innerText = 'OFF';
    }
}


/* ═══════════════════════════════════════════════════════════
   MODULE: Main Monitor Screen
   ═══════════════════════════════════════════════════════════ */

function updateMainScreen() {
    if (!State.latestResult) return;
    const r = State.latestResult;

    // Countdown to departure
    const secs = r.seconds_until_departure || 0;
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;

    const timer = document.getElementById('countdownTimer');
    if (h > 0) {
        timer.innerText = `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    } else {
        timer.innerText = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    // ETA
    document.getElementById('etaDisplay').innerText = `CURRENT ETA: ${r.arrival_time || '--:--'}`;

    // Character state
    const scene = document.getElementById('characterScene');
    const bg = document.getElementById('sceneBg');
    const char = document.getElementById('sceneChar');

    if (r.is_late) {
        bg.src = ASSETS.bgStormy;
        char.src = ASSETS.charPanic;
        scene.classList.add('shake');
    } else {
        bg.src = ASSETS.bgSunny;
        char.src = ASSETS.charIdle;
        scene.classList.remove('shake');
    }
}

function updateLogs(logs) {
    const console_ = document.getElementById('logConsole');
    if (!logs || logs.length === 0) return;
    console_.innerHTML = logs.map(l => `<div class="log-entry">${l}</div>`).join('');
    console_.scrollTop = console_.scrollHeight;
}


/* ═══════════════════════════════════════════════════════════
   MODULE: Alarm
   ═══════════════════════════════════════════════════════════ */

function initAudioContext() {
    const unlock = () => {
        if (!State.audioContext) {
            State.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (State.audioContext.state === 'suspended') {
            State.audioContext.resume();
        }
        // Create and play a silent buffer to unlock iOS audio
        const buffer = State.audioContext.createBuffer(1, 1, 22050);
        const source = State.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(State.audioContext.destination);
        source.start(0);
    };
    document.addEventListener('touchstart', unlock, { once: true });
    document.addEventListener('click', unlock, { once: true });
}

function checkAlarmTrigger(data) {
    if (!data.is_running || !data.latest_result) return;
    const r = data.latest_result;

    // Early warning
    if (r.early_warning_active && !State.earlyWarningShown && State.currentScreen !== 'alarm') {
        State.earlyWarningShown = true;
        showEarlyWarning();
    }

    // Main alarm trigger: wake time has been reached (seconds_until_wake === 0)
    if (r.seconds_until_wake === 0 && !State.alarmTriggered) {
        State.alarmTriggered = true;
        showScreen('alarm');
    }
}

function showEarlyWarning() {
    const overlay = document.getElementById('earlyWarningOverlay');
    overlay.classList.add('active');
    // Also play a gentle sound if possible
    try {
        if (State.audioContext) {
            const osc = State.audioContext.createOscillator();
            const gain = State.audioContext.createGain();
            osc.type = 'sine';
            osc.frequency.value = 440;
            gain.gain.value = 0.1;
            osc.connect(gain);
            gain.connect(State.audioContext.destination);
            osc.start();
            setTimeout(() => osc.stop(), 500);
        }
    } catch (e) { /* ignore */ }
}

function dismissEarlyWarning() {
    document.getElementById('earlyWarningOverlay').classList.remove('active');
}

function startAlarmSequence() {
    // Update current time display
    const now = new Date();
    document.getElementById('alarmCurrentTime').innerText =
        now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

    // Play BGM
    playAlarmBGM();

    // Vibrate if supported
    if (navigator.vibrate) {
        const pattern = [500, 200, 500, 200, 500];
        const vibrateLoop = () => {
            if (State.currentScreen === 'alarm') {
                navigator.vibrate(pattern);
                setTimeout(vibrateLoop, 2000);
            }
        };
        vibrateLoop();
    }
}

function playAlarmBGM() {
    stopAlarmBGM();
    const bgmFile = ASSETS[Settings.selectedBGM] || ASSETS.bgm1;
    State.alarmAudio = new Audio(bgmFile);
    State.alarmAudio.loop = true;
    State.alarmAudio.play().catch(() => {
        // Fallback: try with AudioContext
        if (State.audioContext) {
            const osc = State.audioContext.createOscillator();
            const gain = State.audioContext.createGain();
            osc.type = 'square';
            osc.frequency.value = 880;
            gain.gain.value = 0.3;
            osc.connect(gain);
            gain.connect(State.audioContext.destination);
            osc.start();
            State._fallbackOsc = osc;
        }
    });
}

function stopAlarmBGM() {
    if (State.alarmAudio) {
        State.alarmAudio.pause();
        State.alarmAudio.currentTime = 0;
        State.alarmAudio = null;
    }
    if (State._fallbackOsc) {
        try { State._fallbackOsc.stop(); } catch (e) { /* ignore */ }
        State._fallbackOsc = null;
    }
    if (navigator.vibrate) navigator.vibrate(0);
}

function dismissAlarm() {
    stopAlarmBGM();
    State.alarmTriggered = true;  // Prevent re-trigger
    showScreen('main');
}


/* ═══════════════════════════════════════════════════════════
   MODULE: Settings
   ═══════════════════════════════════════════════════════════ */

function populateSettingsUI() {
    const slider = document.getElementById('bufferSlider');
    slider.value = Settings.bufferTime;
    document.getElementById('bufferValue').innerText = Settings.bufferTime;

    document.querySelectorAll('input[name="bgm"]').forEach(r => {
        r.checked = (r.value === Settings.selectedBGM);
        const item = r.closest('.bgm-item');
        if (item) item.classList.toggle('active', r.checked);
    });

    document.getElementById('earlyWarningToggle').checked = Settings.earlyWarning;
    document.getElementById('urgentAlertToggle').checked = Settings.urgentAlert;

    updateWakeTimePreview();
}

function bindSettingsEvents() {
    // Buffer slider
    const slider = document.getElementById('bufferSlider');
    slider.addEventListener('input', () => {
        Settings.bufferTime = parseInt(slider.value);
        document.getElementById('bufferValue').innerText = Settings.bufferTime;
        updateWakeTimePreview();
        saveSettings();
    });

    // BGM radio
    document.querySelectorAll('input[name="bgm"]').forEach(r => {
        r.addEventListener('change', () => {
            Settings.selectedBGM = r.value;
            document.querySelectorAll('.bgm-item').forEach(i => i.classList.remove('active'));
            r.closest('.bgm-item').classList.add('active');
            saveSettings();
        });
    });

    // BGM preview buttons
    document.querySelectorAll('.bgm-preview-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const bgmKey = btn.dataset.bgm;
            previewBGM(bgmKey);
        });
    });

    // Toggles
    document.getElementById('earlyWarningToggle').addEventListener('change', (e) => {
        Settings.earlyWarning = e.target.checked;
        saveSettings();
    });
    document.getElementById('urgentAlertToggle').addEventListener('change', (e) => {
        Settings.urgentAlert = e.target.checked;
        saveSettings();
    });

    // Back button
    document.getElementById('settingsBackBtn').addEventListener('click', () => {
        stopBGMPreview();
        showScreen('main');
    });
}

function updateWakeTimePreview() {
    const targetTime = document.getElementById('targetTime').value;
    if (!targetTime) return;

    const [h, m] = targetTime.split(':').map(Number);
    const arrival = new Date();
    arrival.setHours(h, m, 0, 0);

    // Estimate: subtract ~30min travel + buffer + prep
    const travelEstimate = 30; // Default estimate
    const totalMin = travelEstimate + Settings.bufferTime + Settings.prepTime;
    const wake = new Date(arrival.getTime() - totalMin * 60000);

    const hh = wake.getHours();
    const mm = wake.getMinutes();
    const ampm = hh >= 12 ? 'PM' : 'AM';
    const h12 = hh % 12 || 12;
    document.getElementById('wakeTimePreview').innerText =
        `${String(h12).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${ampm}`;
}

function previewBGM(bgmKey) {
    stopBGMPreview();
    const src = ASSETS[bgmKey] || ASSETS.bgm1;
    State.bgmPreviewAudio = new Audio(src);
    State.bgmPreviewAudio.play().catch(() => {});
    // Auto-stop after 5 seconds
    setTimeout(() => stopBGMPreview(), 5000);
}

function stopBGMPreview() {
    if (State.bgmPreviewAudio) {
        State.bgmPreviewAudio.pause();
        State.bgmPreviewAudio = null;
    }
}


/* ═══════════════════════════════════════════════════════════
   MODULE: Status Polling
   ═══════════════════════════════════════════════════════════ */

async function pollStatus() {
    try {
        const res = await fetch('/api/status');
        const data = await res.json();

        State.isRunning = data.is_running;
        State.latestResult = data.latest_result;

        // Update main screen if visible
        if (State.currentScreen === 'main' && data.is_running) {
            updateMainScreen();
            updateLogs(data.logs);
        }

        // Check alarm trigger
        if (data.is_running) {
            checkAlarmTrigger(data);
        }

        // If monitoring stopped externally
        if (!data.is_running && State.currentScreen === 'main') {
            updateToggleUI(false);
        }

    } catch (e) { /* network error, skip */ }
}

function startPolling() {
    State.pollInterval = setInterval(pollStatus, 2000);
    pollStatus(); // Immediate first check
}

// Local countdown (smooth, between polls)
function startCountdownTick() {
    State.countdownInterval = setInterval(() => {
        if (State.currentScreen !== 'main' || !State.latestResult) return;

        const r = State.latestResult;
        if (r.seconds_until_departure > 0) {
            r.seconds_until_departure = Math.max(0, r.seconds_until_departure - 1);
        }
        if (r.seconds_until_wake > 0) {
            r.seconds_until_wake = Math.max(0, r.seconds_until_wake - 1);
        }

        // Client-side alarm check
        if (r.seconds_until_wake === 0 && !State.alarmTriggered) {
            State.alarmTriggered = true;
            showScreen('alarm');
        }

        updateMainScreen();
    }, 1000);
}


/* ═══════════════════════════════════════════════════════════
   MODULE: Wake Lock
   ═══════════════════════════════════════════════════════════ */

async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            State.wakeLock = await navigator.wakeLock.request('screen');
        }
    } catch (e) { /* not supported or denied */ }
}

function releaseWakeLock() {
    if (State.wakeLock) {
        State.wakeLock.release().catch(() => {});
        State.wakeLock = null;
    }
}

// Re-acquire on visibility change
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && State.isRunning) {
        requestWakeLock();
    }
});


/* ═══════════════════════════════════════════════════════════
   MODULE: Service Worker
   ═══════════════════════════════════════════════════════════ */

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/static/service-worker.js').catch(() => {});
    }
}


/* ═══════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    initMap();
    initAudioContext();
    bindUIEvents();
    bindSettingsEvents();
    startPolling();
    startCountdownTick();
    registerServiceWorker();
    updateStartBtn();
});

function bindUIEvents() {
    // Search
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', debounceSearch);
    searchInput.addEventListener('focus', () => {
        const q = searchInput.value;
        if (!q || q.length < 2) {
            const rl = document.getElementById('searchResults');
            rl.innerHTML = '<div class="search-hint">Type a place name to search</div>';
            rl.classList.add('active');
        }
    });
    searchInput.addEventListener('blur', () => {
        setTimeout(() => {
            const rl = document.getElementById('searchResults');
            if (!rl.matches(':hover')) rl.classList.remove('active');
        }, 200);
    });

    // Route row selection
    document.getElementById('rowStart').addEventListener('click', () => {
        setSelectionMode('start');
        searchInput.focus();
    });
    document.getElementById('rowEnd').addEventListener('click', () => {
        setSelectionMode('end');
        searchInput.focus();
    });

    // Swap
    document.getElementById('swapBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        swapLocations();
    });

    // Transport mode
    document.querySelectorAll('.transport-btn').forEach(btn => {
        btn.addEventListener('click', () => setTransportMode(btn.dataset.mode));
    });

    // Start adventure
    document.getElementById('startAdventureBtn').addEventListener('click', startAdventure);

    // Hamburger menu → settings
    document.getElementById('menuBtn').addEventListener('click', () => showScreen('settings'));

    // Monitor toggle (ON/OFF)
    document.getElementById('monitorToggle').addEventListener('click', () => {
        if (State.isRunning) {
            stopMonitoring();
        }
    });

    // Alarm dismiss
    document.getElementById('alarmDismissBtn').addEventListener('click', dismissAlarm);

    // Early warning dismiss
    document.getElementById('earlyWarningDismiss').addEventListener('click', dismissEarlyWarning);
}
