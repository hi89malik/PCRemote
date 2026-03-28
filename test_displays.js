const { screen } = require('@nut-tree-fork/nut-js');

async function test() {
    console.log("Screen properties and methods:");
    console.log(Object.keys(screen));

    try {
        const width = await screen.width();
        const height = await screen.height();
        console.log("Primary width and height:", width, height);
    } catch (e) { console.error(e); }
}

test();
