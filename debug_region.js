const { screen, Region } = require('@nut-tree-fork/nut-js');
const { execSync } = require('child_process');

async function test() {
    try {
        const ps = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::AllScreens | Select-Object -ExpandProperty Bounds | ConvertTo-Json`;
        const out = execSync(`powershell -NoProfile -Command "${ps}"`).toString();
        const monitors = JSON.parse(out);
        console.log('Monitors parsed:', monitors);
        
        for (let i = 0; i < monitors.length; i++) {
            const m = monitors[i];
            console.log(`\nTesting monitor ${i + 1} bounds: X=${m.X}, Y=${m.Y}, W=${m.Width}, H=${m.Height}`);
            try {
                // Mimicking exactly what index.js does
                const region = new Region(Math.max(0, m.X), Math.max(0, m.Y), m.Width, m.Height);
                console.log(`Region to grab: ${region.left}, ${region.top}, ${region.width}, ${region.height}`);
                const img = await screen.grabRegion(region);
                console.log(`Success! Image size: ${img.width}x${img.height}`);
            } catch(e) {
                console.error(`Error on monitor ${i + 1}:`, e);
            }
        }
    } catch(err) {
        console.error('Core error:', err);
    }
}
test();
