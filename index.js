require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { exec } = require('child_process');
const { keyboard, Key, mouse, Point, Button, screen } = require('@nut-tree-fork/nut-js');
const sharp = require('sharp');
const path = require('path');
const os = require('os');

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

    socket.on('start_stream', () => {
        if (streamInterval) return;
        streamInterval = setInterval(async () => {
            try {
                const img = await screen.grab();
                
                // Swap Blue and Red channels to convert BGRA to RGBA for sharp
                for (let i = 0; i < img.data.length; i += 4) {
                    const b = img.data[i];
                    img.data[i] = img.data[i + 2];
                    img.data[i + 2] = b;
                }

                const jpegBuffer = await sharp(img.data, {
                    raw: { width: img.width, height: img.height, channels: 4 }
                })
                .resize(1024)
                .jpeg({ quality: 50 })
                .toBuffer();
                
                socket.emit('screen_frame', jpegBuffer.toString('base64'));
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
