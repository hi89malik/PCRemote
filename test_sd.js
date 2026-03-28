const screenshot = require('screenshot-desktop');

async function test() {
    try {
        const displays = await screenshot.listDisplays();
        console.log("Found displays:", displays);
        
        console.time("Capture Primary");
        await screenshot({ format: 'jpg' });
        console.timeEnd("Capture Primary");
        
        if (displays.length > 1) {
            console.time("Capture Secondary");
            const buf = await screenshot({ screen: displays[1].id, format: 'jpg' });
            console.timeEnd("Capture Secondary");
            console.log("Secondary size:", buf.length);
        }
    } catch(e) {
        console.error("Test failed", e);
    }
}
test();
