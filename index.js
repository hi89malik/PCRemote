require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { exec } = require('child_process');
const { keyboard, Key, mouse, Point, Button } = require('@nut-tree-fork/nut-js');
const screenshot = require('screenshot-desktop');
const path = require('path');
const os = require('os');
const fs = require('fs');
const loudness = require('loudness');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const AUTH_USER = process.env.REMOTE_USERNAME || 'admin';
const AUTH_PASS = process.env.REMOTE_PASSWORD || 'admin';
const VALID_TOKEN = Buffer.from(`${AUTH_USER}:${AUTH_PASS}`).toString('base64');

let displays = [];
screenshot.listDisplays().then(d => { displays = d; }).catch(console.error);

app.use('/api', (req, res, next) => {
    if (req.path === '/login') return next();
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Basic ${VALID_TOKEN}`) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    next();
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === AUTH_USER && password === AUTH_PASS) {
        res.json({ success: true, token: `Basic ${VALID_TOKEN}` });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

// Media & Volume Endpoints
app.get('/api/volume', async (req, res) => {
    try {
        const vol = await loudness.getVolume();
        res.json({ success: true, volume: vol });
    } catch(e) {
        res.status(500).json({ success: false, message: 'Failed to get volume' });
    }
});

app.post('/api/volume', async (req, res) => {
    try {
        const { level } = req.body;
        if (typeof level === 'number' && level >= 0 && level <= 100) {
            await loudness.setVolume(level);
            res.json({ success: true });
        } else {
            res.status(400).json({ success: false, message: 'Invalid volume level' });
        }
    } catch(e) {
        res.status(500).json({ success: false, message: 'Failed to set volume' });
    }
});

app.post('/api/media', async (req, res) => {
    try {
        const { action } = req.body;
        if (action === 'play') await keyboard.type(Key.AudioPlay);
        else if (action === 'next') await keyboard.type(Key.AudioNext);
        else if (action === 'prev') await keyboard.type(Key.AudioPrev);
        else if (action === 'mute') {
            const muted = await loudness.getMuted();
            await loudness.setMuted(!muted);
        }
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ success: false, message: 'Media action failed' });
    }
});

// Task Manager Endpoints
app.get('/api/tasks', (req, res) => {
    try {
        const ps = `Get-Process | Where-Object {$_.MainWindowTitle} | Select-Object Id, ProcessName, MainWindowTitle, WorkingSet | ConvertTo-Json -Compress`;
        const out = exec(`powershell -NoProfile -Command "${ps}"`, { encoding: 'utf8' }, (error, stdout, stderr) => {
            if (error) {
                return res.status(500).json({ success: false, message: 'Failed to fetch tasks', error: error.message });
            }
            let tasks = [];
            if (stdout.trim()) {
                const parsed = JSON.parse(stdout);
                tasks = Array.isArray(parsed) ? parsed : [parsed];
            }
            res.json({ success: true, tasks: tasks });
        });
    } catch(e) {
        res.status(500).json({ success: false, message: 'Failed to execute query', error: e.message });
    }
});

app.post('/api/kill', (req, res) => {
    try {
        const { pid } = req.body;
        if (pid) {
            process.kill(pid, 'SIGKILL');
            res.json({ success: true });
        } else {
            res.status(400).json({ success: false, message: 'No PID provided' });
        }
    } catch(e) {
        res.status(500).json({ success: false, message: 'Failed to kill process', error: e.message });
    }
});

// File Explorer Endpoints
app.get('/api/files', (req, res) => {
    try {
        const rootDir = os.homedir();
        let targetDir = req.query.dir || rootDir;
        targetDir = path.resolve(targetDir);

        if (!targetDir.startsWith(rootDir)) {
            return res.status(403).json({ success: false, message: 'Access denied outside home directory.' });
        }
        if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
            return res.status(404).json({ success: false, message: 'Directory not found.' });
        }

        const items = fs.readdirSync(targetDir);
        const fileList = items.map(item => {
            try {
                const itemPath = path.join(targetDir, item);
                const stat = fs.statSync(itemPath);
                return {
                    name: item,
                    isDirectory: stat.isDirectory(),
                    size: stat.size,
                    path: itemPath
                };
            } catch (e) { return null; }
        }).filter(Boolean).sort((a, b) => {
            if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
            return a.isDirectory ? -1 : 1;
        });

        const parentDir = targetDir === rootDir ? null : path.dirname(targetDir);
        res.json({ success: true, currentPath: targetDir, parentPath: parentDir, items: fileList });
    } catch(e) {
        res.status(500).json({ success: false, message: 'File system error', error: e.message });
    }
});

app.get('/api/download', (req, res) => {
    try {
        const rootDir = os.homedir();
        const targetFile = path.resolve(req.query.file || '');

        if (!targetFile.startsWith(rootDir)) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }
        if (!fs.existsSync(targetFile) || !fs.statSync(targetFile).isFile()) {
            return res.status(404).json({ success: false, message: 'File not found.' });
        }

        res.download(targetFile);
    } catch(e) {
        res.status(500).json({ success: false, message: 'Download error', error: e.message });
    }
});

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const devName in interfaces) {
        const iface = interfaces[devName];
        for (let i = 0; i < iface.length; i++) {
            const alias = iface[i];
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                return alias.address;
            }
        }
    }
    return '127.0.0.1';
}

io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (token === `Basic ${VALID_TOKEN}`) {
        next();
    } else {
        next(new Error('Authentication error'));
    }
});

io.on('connection', (socket) => {
    let streamInterval = null;
    let activeDisplayId = displays.length > 0 ? displays[0].id : undefined;

    socket.emit('displays_info', displays.map(d => ({ Width: d.width, Height: d.height })));

    socket.on('switch_monitor', (index) => {
        if (displays[index]) {
            activeDisplayId = displays[index].id;
        }
    });

    socket.on('start_stream', () => {
        if (streamInterval) return;
        streamInterval = setInterval(async () => {
            try {
                const imgBuffer = await screenshot({ screen: activeDisplayId, format: 'jpg' });
                socket.emit('screen_frame', imgBuffer.toString('base64'));
            } catch (err) {}
        }, 150); // ~6-7 FPS to be safer on bandwidth
    });

    socket.on('stop_stream', () => {
        if (streamInterval) {
            clearInterval(streamInterval);
            streamInterval = null;
        }
    });

    socket.on('disconnect', () => {
        if (streamInterval) {
            clearInterval(streamInterval);
        }
    });

    socket.on('mouse_move', async (data) => {
        try {
            const { dx, dy } = data;
            const currentObj = await mouse.getPosition();
            const x = currentObj.x + dx;
            const y = currentObj.y + dy;
            await mouse.setPosition(new Point(x, y));
        } catch(e) {}
    });

    socket.on('mouse_click', async (data) => {
        try {
            const { button, double } = data;
            const nutBtn = button === 'right' ? Button.RIGHT : Button.LEFT;
            if (double) {
                await mouse.doubleClick(nutBtn);
            } else {
                await mouse.click(nutBtn);
            }
        } catch(e) {}
    });
    
    socket.on('mouse_scroll', async (data) => {
        try {
            const { dir, amount } = data;
            const scaled = Math.abs(amount) * 2.0;
            if (dir === 'up') await mouse.scrollUp(scaled);
            else await mouse.scrollDown(scaled);
        } catch(e) {}
    });
});

app.post('/api/type', async (req, res) => {
    try {
        const { text } = req.body;
        if (text) {
            keyboard.config.autoDelayMs = 0;
            await new Promise(r => setTimeout(r, 50)); 
            await keyboard.type(text);
            res.json({ success: true, message: 'Typed text successfully.' });
        } else {
            res.status(400).json({ success: false, message: 'No text provided.' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Typing error', error: error.message });
    }
});

app.post('/api/key', async (req, res) => {
    try {
        const { key } = req.body;
        const nutKey = Key[key];
        if (nutKey !== undefined) {
             await keyboard.pressKey(nutKey);
             await keyboard.releaseKey(nutKey);
             res.json({ success: true, message: `Pressed ${key}` });
        } else {
             res.status(400).json({ success: false, message: 'Invalid key' });
        }
    } catch (error) {
         res.status(500).json({ success: false, message: 'Key error', error: error.message });
    }
});

app.post('/api/power', (req, res) => {
    const { action } = req.body;
    try {
        if (action === 'shutdown') {
            exec('shutdown /s /t 0');
            res.json({ success: true, message: 'Shutting down...' });
        } else if (action === 'restart') {
            exec('shutdown /r /t 0');
            res.json({ success: true, message: 'Restarting...' });
        } else if (action === 'sleep') {
            exec('rundll32.exe powrprof.dll,SetSuspendState 0,1,0');
            res.json({ success: true, message: 'Going to sleep...' });
        } else if (action === 'test') {
            exec('notepad'); 
            res.json({ success: true, message: 'Test successful, opened Notepad.' });
        } else if (action === 'ping') {
            res.json({ success: true, message: 'pong' });
        } else {
            res.status(400).json({ success: false, message: 'Invalid action.' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Execution error', error: error.message });
    }
});

server.listen(PORT, '0.0.0.0', () => {
    const ip = getLocalIP();
    console.log(`===========================================`);
    console.log(`PC Remote Server is running!`);
    console.log(`Access the app on your phone at:`);
    console.log(`http://${ip}:${PORT}`);
    console.log(`===========================================`);
});
