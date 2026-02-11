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
    bgm_1: '/static/assets/alarm_custom.mp3',
    bgm_2: '/static/assets/bgm_2.mp3',
    bgm_3: '/static/assets/bgm_3.mp3',
};

// ─── State ────────────────────────────────────────────────
const State = {
    currentScreen: 'map',
    previousScreen: 'map',
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
    // Route lines managed via MapLibre sources/layers

    // Monitor data (from server)
    latestResult: null,

    // Alarm
    alarmTriggered: false,
    earlyWarningShown: false,
    wakeCountdownStartedPositive: false,  // True once we've seen seconds_until_wake > 0
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
    prepTime: 30,
    bufferTime: 30,
    checkCount: 5,
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
    State.previousScreen = State.currentScreen;
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById('screen-' + name);
    if (target) target.classList.add('active');
    State.currentScreen = name;

    // Screen-specific hooks
    if (name === 'map' && State.map) {
        setTimeout(() => State.map.resize(), 100);
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
    State.map = new maplibregl.Map({
        container: 'map',
        style: {
            version: 8,
            sources: {
                'carto-voyager': {
                    type: 'raster',
                    tiles: [
                        'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
                        'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
                        'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
                        'https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png'
                    ],
                    tileSize: 256,
                    attribution: '&copy; <a href="https://carto.com/">CARTO</a>'
                }
            },
            layers: [{
                id: 'carto-voyager-layer',
                type: 'raster',
                source: 'carto-voyager',
                minzoom: 0,
                maxzoom: 19
            }]
        },
        center: [126.9780, 37.5665],
        zoom: 13
    });

    State.map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

    // Map click → set location
    State.map.on('click', async (e) => {
        const lat = e.lngLat.lat;
        const lon = e.lngLat.lng;
        const place = { name: 'Selected Location', lat, lon, address: `${lat.toFixed(5)}, ${lon.toFixed(5)}` };
        try {
            const res = await fetch(`/api/reverse-geocode?lat=${lat}&lon=${lon}`);
            const data = await res.json();
            if (data.success) {
                place.name = data.name || 'Selected Location';
                place.address = data.address || place.address;
            }
        } catch (err) { /* use defaults */ }
        selectPlace(place);
        document.getElementById('searchResults').classList.remove('active');
    });
}

function createPinElement(label, type) {
    const cls = type === 'start' ? 'pin-start' : 'pin-end';
    const emoji = type === 'start' ? '\u{1F680}' : '\u{1F3C1}';
    const el = document.createElement('div');
    el.className = `custom-pin ${cls}`;
    el.innerHTML = `<div class="pin-body"><span style="font-size:14px">${emoji}</span></div><div class="pin-label">${label}</div>`;
    return el;
}

function selectPlace(place) {
    document.getElementById('searchResults').classList.remove('active');
    document.getElementById('searchInput').value = '';

    if (State.selectionMode === 'start') {
        State.startCoord = place;
        document.getElementById('startDisplay').innerText = place.name;
        document.getElementById('startDisplay').classList.remove('empty');
        if (State.routeMarkers.start) State.routeMarkers.start.remove();
        State.routeMarkers.start = new maplibregl.Marker({ element: createPinElement('START', 'start') })
            .setLngLat([place.lon, place.lat])
            .addTo(State.map);
        State.map.flyTo({ center: [place.lon, place.lat], zoom: 15, duration: 500 });
        setSelectionMode('end');
        setTimeout(() => document.getElementById('searchInput').focus(), 600);
    } else {
        State.endCoord = place;
        document.getElementById('endDisplay').innerText = place.name;
        document.getElementById('endDisplay').classList.remove('empty');
        if (State.routeMarkers.end) State.routeMarkers.end.remove();
        State.routeMarkers.end = new maplibregl.Marker({ element: createPinElement('END', 'end') })
            .setLngLat([place.lon, place.lat])
            .addTo(State.map);
    }

    // Clear search markers
    State.searchMarkers.forEach(m => m.remove());
    State.searchMarkers = [];

    // Preview route if both set
    if (State.startCoord && State.endCoord) {
        previewRoute();
        updateStartBtn();
    }

    // Fit bounds when both markers exist
    if (State.routeMarkers.start && State.routeMarkers.end) {
        const bounds = new maplibregl.LngLatBounds();
        bounds.extend(State.routeMarkers.start.getLngLat());
        bounds.extend(State.routeMarkers.end.getLngLat());
        setTimeout(() => State.map.fitBounds(bounds, { padding: 80, maxZoom: 14 }), 300);
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

    State.searchMarkers.forEach(m => m.remove());
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
        const bounds = new maplibregl.LngLatBounds();

        data.results.forEach((place, i) => {
            // Map marker
            const el = document.createElement('div');
            el.className = 'custom-pin search-result-pin';
            el.innerHTML = `<div class="pin-body pin-search"><span class="pin-number">${i + 1}</span></div>`;
            el.style.cursor = 'pointer';
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                selectPlace(place);
                State.map.flyTo({ center: [place.lon, place.lat], zoom: 16 });
            });
            const marker = new maplibregl.Marker({ element: el })
                .setLngLat([place.lon, place.lat])
                .addTo(State.map);
            State.searchMarkers.push(marker);
            bounds.extend([place.lon, place.lat]);

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
            item.addEventListener('click', () => {
                selectPlace(place);
                State.map.flyTo({ center: [place.lon, place.lat], zoom: 16 });
            });
            resultList.appendChild(item);
        });

        if (State.routeMarkers.start) bounds.extend(State.routeMarkers.start.getLngLat());
        if (State.routeMarkers.end) bounds.extend(State.routeMarkers.end.getLngLat());
        if (!bounds.isEmpty()) State.map.fitBounds(bounds, { padding: { top: 50, bottom: 200, left: 50, right: 50 } });

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
    removeRouteLines();

    if (!coordinates || coordinates.length === 0 || mode === 'transit') {
        drawFallbackLine();
        return;
    }

    // TMap returns [lon, lat] — MapLibre also uses [lng, lat], no flip needed
    const geojson = {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates }
    };

    State.map.addSource('route', { type: 'geojson', data: geojson });

    // Shadow line
    State.map.addLayer({
        id: 'route-shadow',
        type: 'line',
        source: 'route',
        paint: { 'line-color': '#000', 'line-width': 7, 'line-opacity': 0.4 }
    });

    // Main line
    State.map.addLayer({
        id: 'route-main',
        type: 'line',
        source: 'route',
        paint: { 'line-color': '#eea02b', 'line-width': 4, 'line-opacity': 0.9 },
        layout: { 'line-cap': 'round', 'line-join': 'round' }
    });
}

function removeRouteLines() {
    ['route-main', 'route-shadow'].forEach(id => {
        if (State.map.getLayer(id)) State.map.removeLayer(id);
    });
    if (State.map.getSource('route')) State.map.removeSource('route');
}

function drawFallbackLine() {
    removeRouteLines();

    if (!State.routeMarkers.start || !State.routeMarkers.end) return;
    const s = State.routeMarkers.start.getLngLat();
    const e = State.routeMarkers.end.getLngLat();

    State.map.addSource('route', {
        type: 'geojson',
        data: {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: [[s.lng, s.lat], [e.lng, e.lat]] }
        }
    });

    State.map.addLayer({
        id: 'route-main',
        type: 'line',
        source: 'route',
        paint: { 'line-color': '#eea02b', 'line-width': 4, 'line-opacity': 0.8, 'line-dasharray': [10, 10] },
        layout: { 'line-cap': 'round' }
    });
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

    // Recreate markers with swapped labels
    const startLngLat = State.routeMarkers.start ? State.routeMarkers.start.getLngLat() : null;
    const endLngLat = State.routeMarkers.end ? State.routeMarkers.end.getLngLat() : null;
    if (State.routeMarkers.start) State.routeMarkers.start.remove();
    if (State.routeMarkers.end) State.routeMarkers.end.remove();
    State.routeMarkers.start = null;
    State.routeMarkers.end = null;

    if (endLngLat) {
        State.routeMarkers.start = new maplibregl.Marker({ element: createPinElement('START', 'start') })
            .setLngLat(endLngLat).addTo(State.map);
    }
    if (startLngLat) {
        State.routeMarkers.end = new maplibregl.Marker({ element: createPinElement('END', 'end') })
            .setLngLat(startLngLat).addTo(State.map);
    }

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
                check_count: Settings.checkCount,
                early_warning: Settings.earlyWarning,
                urgent_alert: Settings.urgentAlert,
            })
        });
        State.isRunning = true;
        State.alarmTriggered = false;
        State.earlyWarningShown = false;
        State.wakeCountdownStartedPositive = false;  // Reset alarm transition tracking
        State.latestResult = null;  // Clear stale data from previous run
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

    // Calculate countdown from absolute timestamps (no server dependency)
    const now = Date.now();
    const depMs = r.departure_iso ? new Date(r.departure_iso).getTime() : 0;
    const secs = Math.max(0, Math.floor((depMs - now) / 1000));

    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;

    const timer = document.getElementById('countdownTimer');
    if (h > 0) {
        timer.innerText = `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    } else {
        timer.innerText = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    // Info bar: alarm time, departure time, arrival time
    document.getElementById('infoWake').innerText = r.wake_up_time || '--:--';
    document.getElementById('infoDepart').innerText = r.leave_time || '--:--';
    document.getElementById('infoArrive').innerText = r.arrival_time || '--:--';

    // Scene background state
    const scene = document.getElementById('characterScene');
    const bg = document.getElementById('sceneBg');

    if (r.is_late) {
        bg.src = ASSETS.bgStormy;
        scene.classList.add('shake');
    } else {
        bg.src = ASSETS.bgSunny;
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

    if (!r.wake_up_iso) return;

    const now = Date.now();
    const wakeMs = new Date(r.wake_up_iso).getTime();
    const secsUntilWake = (wakeMs - now) / 1000;

    // Early warning
    if (r.early_warning_active && !State.earlyWarningShown && State.currentScreen !== 'alarm') {
        State.earlyWarningShown = true;
        showEarlyWarning();
    }

    // Track if wake time is in the future (countdown started positive)
    if (secsUntilWake > 0) {
        State.wakeCountdownStartedPositive = true;
    }

    // Alarm fires only when countdown transitions through zero
    if (secsUntilWake <= 0 && State.wakeCountdownStartedPositive && !State.alarmTriggered) {
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
    const bgmFile = ASSETS[Settings.selectedBGM] || ASSETS.bgm_1;
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
    // Prep Time
    const prepSlider = document.getElementById('prepSlider');
    prepSlider.value = Settings.prepTime;
    document.getElementById('prepValue').innerText = Settings.prepTime;

    // Buffer Time
    const slider = document.getElementById('bufferSlider');
    slider.value = Settings.bufferTime;
    document.getElementById('bufferValue').innerText = Settings.bufferTime;

    // Check Count
    const checkSlider = document.getElementById('checkCountSlider');
    checkSlider.value = Settings.checkCount;
    document.getElementById('checkCountValue').innerText = Settings.checkCount;

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
    // Prep Time slider
    const prepSlider = document.getElementById('prepSlider');
    prepSlider.addEventListener('input', () => {
        Settings.prepTime = parseInt(prepSlider.value);
        document.getElementById('prepValue').innerText = Settings.prepTime;
        updateWakeTimePreview();
        saveSettings();
    });

    // Buffer slider
    const slider = document.getElementById('bufferSlider');
    slider.addEventListener('input', () => {
        Settings.bufferTime = parseInt(slider.value);
        document.getElementById('bufferValue').innerText = Settings.bufferTime;
        updateWakeTimePreview();
        saveSettings();
    });

    // Check Count slider
    const checkSlider = document.getElementById('checkCountSlider');
    checkSlider.addEventListener('input', () => {
        Settings.checkCount = parseInt(checkSlider.value);
        document.getElementById('checkCountValue').innerText = Settings.checkCount;
        saveSettings();
    });

    // BGM item selection (click on the row to select)
    document.querySelectorAll('.bgm-item').forEach(item => {
        item.addEventListener('click', (e) => {
            // Don't select if clicking the preview button
            if (e.target.closest('.bgm-preview-btn')) return;
            const radio = item.querySelector('input[type="radio"]');
            if (!radio || radio.disabled) return;
            radio.checked = true;
            Settings.selectedBGM = radio.value;
            document.querySelectorAll('.bgm-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            saveSettings();
        });
    });

    // BGM preview buttons
    document.querySelectorAll('.bgm-preview-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const bgmKey = btn.dataset.bgm;
            toggleBGMPreview(bgmKey, btn);
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

    // Back button - go back to the screen that opened settings
    document.getElementById('settingsBackBtn').addEventListener('click', () => {
        stopBGMPreview();
        const backTo = State.previousScreen === 'settings' ? 'map' : State.previousScreen;
        showScreen(backTo);
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

function toggleBGMPreview(bgmKey, btn) {
    // If already playing, stop it
    if (State.bgmPreviewAudio) {
        stopBGMPreview();
        return;
    }
    const src = ASSETS[bgmKey] || ASSETS.bgm_1;
    State.bgmPreviewAudio = new Audio(src);
    State.bgmPreviewAudio.volume = 1.0;

    // Update button to show stop icon
    if (btn) btn.innerHTML = '&#x25A0;';

    State.bgmPreviewAudio.play().then(() => {
        // Auto-stop after 5 seconds
        State._bgmPreviewTimeout = setTimeout(() => stopBGMPreview(), 5000);
    }).catch((err) => {
        console.warn('BGM preview play failed:', err);
        // Reset button
        if (btn) btn.innerHTML = '&#x25B6;';
        State.bgmPreviewAudio = null;
    });

    State.bgmPreviewAudio.addEventListener('ended', () => stopBGMPreview());
}

function stopBGMPreview() {
    if (State._bgmPreviewTimeout) {
        clearTimeout(State._bgmPreviewTimeout);
        State._bgmPreviewTimeout = null;
    }
    if (State.bgmPreviewAudio) {
        State.bgmPreviewAudio.pause();
        State.bgmPreviewAudio.currentTime = 0;
        State.bgmPreviewAudio = null;
    }
    // Reset all preview buttons back to play icon
    document.querySelectorAll('.bgm-preview-btn').forEach(b => {
        b.innerHTML = '&#x25B6;';
    });
}


/* ═══════════════════════════════════════════════════════════
   MODULE: Status Polling
   ═══════════════════════════════════════════════════════════ */

async function pollStatus() {
    try {
        const res = await fetch('/api/status');
        const data = await res.json();

        State.isRunning = data.is_running;

        // Just store server data directly — timestamps are absolute,
        // client calculates countdown locally, so no oscillation possible
        if (data.latest_result) {
            State.latestResult = data.latest_result;
        }

        // Update main screen if visible
        if (State.currentScreen === 'main' && data.is_running) {
            updateMainScreen();
            updateLogs(data.logs);
        }

        // Check alarm trigger
        if (data.is_running && State.latestResult) {
            checkAlarmTrigger({ is_running: data.is_running, latest_result: State.latestResult });
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

// Local countdown — just re-renders from absolute timestamps every second
function startCountdownTick() {
    State.countdownInterval = setInterval(() => {
        if (State.currentScreen !== 'main' || !State.latestResult) return;

        // Update display (calculates from absolute time internally)
        updateMainScreen();

        // Check alarm from absolute time
        checkAlarmTrigger({ is_running: State.isRunning, latest_result: State.latestResult });
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
    document.getElementById('rowStart').addEventListener('click', (e) => {
        if (e.target.closest('.route-set-btn')) return;
        setSelectionMode('start');
        searchInput.focus();
    });
    document.getElementById('rowEnd').addEventListener('click', (e) => {
        if (e.target.closest('.route-set-btn')) return;
        setSelectionMode('end');
        searchInput.focus();
    });

    // Set location buttons
    document.getElementById('setStartBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        setSelectionMode('start');
        searchInput.focus();
        searchInput.value = '';
        const rl = document.getElementById('searchResults');
        rl.innerHTML = '<div class="search-hint">Search or tap map to set start point</div>';
        rl.classList.add('active');
    });
    document.getElementById('setEndBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        setSelectionMode('end');
        searchInput.focus();
        searchInput.value = '';
        const rl = document.getElementById('searchResults');
        rl.innerHTML = '<div class="search-hint">Search or tap map to set destination</div>';
        rl.classList.add('active');
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

    // Back to map (from main screen)
    document.getElementById('backToMapBtn').addEventListener('click', () => showScreen('map'));

    // Hamburger menu → settings (from main screen)
    document.getElementById('menuBtn').addEventListener('click', () => showScreen('settings'));

    // Settings button on map screen
    document.getElementById('mapSettingsBtn').addEventListener('click', () => showScreen('settings'));

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
