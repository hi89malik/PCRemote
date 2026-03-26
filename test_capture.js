const { screen, FileType } = require('@nut-tree-fork/nut-js');
const fs = require('fs');
const path = require('path');

async function testCapture() {
    try {
        console.time('capture');
        const img = await screen.grab();
        console.timeEnd('capture');
        
        console.log('Image dimensions:', img.width, 'x', img.height);
        console.log('Color mode:', img.colorMode);
        
        // Let's see if we can convert it to RGB and base64
        console.time('toBase64');
        const buffer = img.data;
        console.timeEnd('toBase64');
        console.log('Buffer length:', buffer.length);
        
    } catch(e) {
        console.error('Error:', e);
    }
}

testCapture();
