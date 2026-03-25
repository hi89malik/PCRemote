const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { exec } = require('child_process');
const { keyboard, Key, mouse, Point, Button } = require('@nut-tree-fork/nut-js');
const path = require('path');
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

io.on('connection', (socket) => {
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
