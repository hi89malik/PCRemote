// PC Remote Frontend Script

// Ensure we know the API base
const API_BASE = window.location.origin;

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
const socket = io();
const trackpad = document.getElementById('trackpad');

let lastTouchPos = null;
let touchStartTime = 0;
let moved = false;
let totalMovement = 0;
let initialTouches = 0;
const SENSITIVITY = 1.8;

trackpad.addEventListener('touchstart', (e) => {
    e.preventDefault();
    initialTouches = e.touches.length;
    lastTouchPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    touchStartTime = Date.now();
    moved = false;
    totalMovement = 0;
}, { passive: false });

trackpad.addEventListener('touchmove', (e) => {
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

trackpad.addEventListener('touchend', (e) => {
    e.preventDefault();
    const duration = Date.now() - touchStartTime;
    // Tap to click
    if (!moved && duration < 250) {
        if (initialTouches === 1) sendMouseClick('left');
        else if (initialTouches === 2) sendMouseClick('right');
    }
    if (e.touches.length === 0) lastTouchPos = null;
}, { passive: false });

function sendMouseClick(button, double = false) {
    if (navigator.vibrate) navigator.vibrate(20);
}
