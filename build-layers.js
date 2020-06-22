"use strict"

// build-layers runs the npm install and prune commands on
// the layers/src folders, compresses the results and moves
// them into the layers/build folder

const fs = require("fs");
const process = require("child_process");

// get layers' src directories
let srcdirs = fs.readdirSync('layers/src', { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)

for (let i in srcdirs) {
    let layer = srcdirs[i];
    console.log(`processing ${layer}...`);

    let layerSrcPath = `layers/src/${layer}`
    let layerBuildPath = `layers/build/${layer}/nodejs`

    fs.mkdirSync(layerBuildPath, {recursive: true});

    fs.copyFileSync(`${layerSrcPath}/package.json`, `${layerBuildPath}/package.json`);

    console.log("installing npm dependencies...");
    process.execSync('npm install', { cwd: layerBuildPath });
    console.log("pruning unused npm modules...");
    process.execSync('npm prune', { cwd: layerBuildPath });

    console.log("removing package-lock.json...");
    fs.unlinkSync(`${layerBuildPath}/package-lock.json`);

    console.log("creating layer archive...");
    process.execSync(`zip -r ${layer}.zip .`, { cwd: `layers/build/${layer}` });
}

console.log('layer builds completed.')