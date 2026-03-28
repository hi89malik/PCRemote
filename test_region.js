const { execSync } = require('child_process');
const { screen, Region } = require('@nut-tree-fork/nut-js');

async function test() {
    try {
        const ps = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::AllScreens | Select-Object -ExpandProperty Bounds | ConvertTo-Json`;
        const out = execSync(`powershell -NoProfile -Command "${ps}"`).toString();
        
        let monitors;
        try {
            monitors = JSON.parse(out);
        } catch(e) { console.error("Parse fail", e); return; }
        
        console.log('Monitors:', monitors);
        console.log('Region class:', typeof Region);
        console.log('grabRegion method:', typeof screen.grabRegion);

        const m1 = Array.isArray(monitors) ? monitors[0] : monitors;
        console.log('Grabbing region:', m1.X, m1.Y, m1.Width, m1.Height);
        
        const img = await screen.grabRegion(new Region(Math.max(0, m1.X), Math.max(0, m1.Y), m1.Width, m1.Height));
        console.log('Grabbed width/height:', img.width, img.height);
    } catch(err) {
        console.error('Error:', err);
    }
}
test();
