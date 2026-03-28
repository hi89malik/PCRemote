// PC Remote Frontend Script

// Ensure we know the API base
const API_BASE = window.location.origin;

const originalFetch = window.fetch;
window.fetch = function() {
    let [resource, config ] = arguments;
    if(!config) config = {};
    if(!config.headers) config.headers = {};
    const token = localStorage.getItem('pc_remote_token');
    if (token && resource !== `${API_BASE}/api/login`) {
        config.headers['Authorization'] = token;
    }
    return originalFetch(resource, config);
};

function showToast(message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;
    container.appendChild(toast);
    
    // Remove after 3 seconds
    setTimeout(() => {
        if(container.contains(toast)) {
            container.removeChild(toast);
        }
    }, 3000);
}

async function sendPowerCommand(action) {
    if (action !== 'test' && !confirm(`Are you sure you want to ${action} the PC?`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/power`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action })
        });
        
        const data = await response.json();
        if (data.success) {
            showToast(data.message);
        } else {
            showToast(`Error: ${data.message}`);
        }
    } catch (err) {
        showToast('Network error.');
        console.error(err);
    }
}

async function sendText() {
    const input = document.getElementById('text-input');
    const text = input.value;
    
    if (!text) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/type`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        
        const data = await response.json();
        if (data.success) {
            input.value = ''; // clear on success
            showToast('Text sent');
        } else {
            showToast(`Error: ${data.message}`);
        }
    } catch (err) {
        showToast('Network error.');
    }
}

async function sendKey(key) {
    try {
        // Provide haptic feedback if available
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }

        const response = await fetch(`${API_BASE}/api/key`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key })
        });
        
        const data = await response.json();
        if (!data.success) {
            showToast(`Error: ${data.message}`);
        }
    } catch (err) {
        showToast('Network error.');
    }
}

function checkEnter(e) {
    if (e.key === 'Enter') {
        e.preventDefault(); // prevent form submission or default enter behavior
        sendText();
        // Also send Enter key to PC
        sendKey('Enter');
    }
}

// Check online status periodically (simple ping)
setInterval(async () => {
    try {
        const res = await fetch(`${API_BASE}/api/power`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'ping' })
        });
        const statusEl = document.getElementById('status-indicator');
        if (res.ok || res.status === 400) { // 400 means invalid action but server is alive
            statusEl.innerText = 'Connected';
            statusEl.className = 'status online';
        }
    } catch (e) {
        const statusEl = document.getElementById('status-indicator');
        statusEl.innerText = 'Disconnected';
        statusEl.className = 'status offline';
    }
}, 5000);

// --- Trackpad Logic ---
const socket = io({ autoConnect: false });

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('pc_remote_token');
    if (token) {
        verifyTokenAndInit(token);
    } else {
        showLogin();
    }
});

function showLogin() {
    document.getElementById('login-overlay').style.display = 'flex';
    document.getElementById('app-container').style.display = 'none';
}

function showApp() {
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('app-container').style.display = 'flex';
}

function checkLoginEnter(e) {
    if (e.key === 'Enter') submitLogin();
}

async function submitLogin() {
    const user = document.getElementById('login-username').value;
    const pass = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');
    
    try {
        const res = await originalFetch(`${API_BASE}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass })
        });
        const data = await res.json();
        if (data.success && data.token) {
            localStorage.setItem('pc_remote_token', data.token);
            errEl.style.display = 'none';
            socket.auth = { token: data.token };
            socket.connect();
            showApp();
        } else {
            errEl.style.display = 'block';
            errEl.innerText = data.message || 'Invalid credentials';
        }
    } catch(e) {
        errEl.style.display = 'block';
        errEl.innerText = 'Network error';
    }
}

async function verifyTokenAndInit(token) {
    try {
        const res = await fetch(`${API_BASE}/api/power`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'ping' })
        });
        if (res.ok || res.status === 400) {
            socket.auth = { token };
            socket.connect();
            showApp();
            loadDirectory();
        } else {
            localStorage.removeItem('pc_remote_token');
            showLogin();
        }
    } catch(e) {
        showLogin();
    }
}

const trackpad = document.getElementById('trackpad');

let lastTouchPos = null;
let touchStartTime = 0;
let moved = false;
let totalMovement = 0;
let initialTouches = 0;
const SENSITIVITY = 1.8;

const bindTrackpad = (el) => {
    el.addEventListener('touchstart', (e) => {
        e.preventDefault();
        initialTouches = e.touches.length;
        lastTouchPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        touchStartTime = Date.now();
        moved = false;
        totalMovement = 0;
    }, { passive: false });

    el.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (e.touches.length === 1 && lastTouchPos) {
            const rawDx = e.touches[0].clientX - lastTouchPos.x;
            const rawDy = e.touches[0].clientY - lastTouchPos.y;
            totalMovement += Math.abs(rawDx) + Math.abs(rawDy);
            
            const dx = rawDx * SENSITIVITY;
            const dy = rawDy * SENSITIVITY;
            socket.emit('mouse_move', { dx, dy });
            if (totalMovement > 15) moved = true; 
            lastTouchPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        } else if (e.touches.length === 2 && lastTouchPos) {
            const dy = (e.touches[0].clientY - lastTouchPos.y);
            totalMovement += Math.abs(dy);
            if (totalMovement > 15) moved = true;
            
            if (dy > 0) socket.emit('mouse_scroll', { dir: 'up', amount: dy });
            else socket.emit('mouse_scroll', { dir: 'down', amount: -dy });
            lastTouchPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
    }, { passive: false });

    el.addEventListener('touchend', (e) => {
        e.preventDefault();
        const duration = Date.now() - touchStartTime;
        // Tap to click
        if (!moved && duration < 250) {
            if (initialTouches === 1) sendMouseClick('left');
            else if (initialTouches === 2) sendMouseClick('right');
        }
        if (e.touches.length === 0) lastTouchPos = null;
    }, { passive: false });
};

bindTrackpad(trackpad);
bindTrackpad(document.getElementById('stream-display'));

function sendMouseClick(button, double = false) {
    if (navigator.vibrate) navigator.vibrate(20);
    socket.emit('mouse_click', { button, double });
}

// --- Screen Stream Logic ---
let isStreaming = false;

function toggleStream() {
    const btn = document.getElementById('stream-toggle-btn');
    const img = document.getElementById('stream-display');
    const placeholder = document.getElementById('stream-placeholder');
    
    if (!isStreaming) {
        socket.emit('start_stream');
        img.style.display = 'block';
        placeholder.style.display = 'none';
        btn.innerText = 'Stop Stream';
        btn.classList.add('btn-danger');
        isStreaming = true;
    } else {
        socket.emit('stop_stream');
        img.style.display = 'none';
        placeholder.style.display = 'block';
        img.src = '';
        btn.innerText = 'Start Stream';
        btn.classList.remove('btn-danger');
        isStreaming = false;
    }
}

function switchDisplay(index) {
    if (socket) socket.emit('switch_monitor', parseInt(index));
}

function enterFullscreen() {
    const container = document.getElementById('stream-display');
    if (container.requestFullscreen) {
        container.requestFullscreen().catch(e => console.error(e));
    } else if (container.webkitRequestFullscreen) {
        container.webkitRequestFullscreen();
    }
}

socket.on('displays_info', (monitors) => {
    const select = document.getElementById('display-selector');
    if (!select) return;
    select.innerHTML = '';
    monitors.forEach((m, i) => {
        const opt = document.createElement('option');
        opt.value = i;
        opt.innerText = `Display ${i + 1} (${m.Width}x${m.Height})`;
        select.appendChild(opt);
    });
});

socket.on('screen_frame', (base64ImageData) => {
    if (isStreaming) {
        const img = document.getElementById('stream-display');
        img.src = 'data:image/jpeg;base64,' + base64ImageData;
    }
});

// --- File Explorer Logic ---
async function loadDirectory(dirPath = '') {
    try {
        const url = dirPath ? `${API_BASE}/api/files?dir=${encodeURIComponent(dirPath)}` : `${API_BASE}/api/files`;
        const res = await originalFetch(url, { headers: { 'Authorization': localStorage.getItem('pc_remote_token') || '' } });
        const data = await res.json();
        if (data.success) {
            renderFileList(data);
        } else {
            showToast(`Error: ${data.message}`);
        }
    } catch(e) {
        showToast('Failed to load file directory.');
    }
}

function renderFileList(data) {
    const listEl = document.getElementById('file-list');
    const pathEl = document.getElementById('file-explorer-path');
    
    pathEl.innerText = data.currentPath || '';
    listEl.innerHTML = '';
    
    if (data.parentPath) {
        const li = document.createElement('li');
        li.className = 'file-item';
        li.innerHTML = `<span class="file-icon">📁</span><span class="file-name">.. (Up)</span>`;
        li.onclick = () => loadDirectory(data.parentPath);
        listEl.appendChild(li);
    }
    
    data.items.forEach(item => {
        const li = document.createElement('li');
        li.className = 'file-item';
        const icon = item.isDirectory ? '📁' : '📄';
        let sizeText = '';
        if (!item.isDirectory) {
            if (item.size > 1024 * 1024 * 1024) sizeText = (item.size / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
            else if (item.size > 1024 * 1024) sizeText = (item.size / (1024 * 1024)).toFixed(1) + ' MB';
            else if (item.size > 1024) sizeText = (item.size / 1024).toFixed(0) + ' KB';
            else sizeText = item.size + ' B';
        }
        
        li.innerHTML = `<span class="file-icon">${icon}</span>
                        <span class="file-name">${item.name}</span>
                        <span class="file-size">${sizeText}</span>`;
        if (item.isDirectory) {
            li.onclick = () => loadDirectory(item.path);
        } else {
            li.onclick = () => downloadFile(item.path, item.name);
        }
        listEl.appendChild(li);
    });
}

async function downloadFile(filePath, fileName) {
    showToast(`Downloading ${fileName}...`);
    try {
        const url = `${API_BASE}/api/download?file=${encodeURIComponent(filePath)}`;
        const res = await originalFetch(url, { headers: { 'Authorization': localStorage.getItem('pc_remote_token') || '' } });
        if (!res.ok) throw new Error('Download failed');
        
        const blob = await res.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = downloadUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            window.URL.revokeObjectURL(downloadUrl);
            document.body.removeChild(a);
        }, 100);
        showToast('Download complete');
    } catch(e) {
        showToast('Error downloading file');
    }
}
