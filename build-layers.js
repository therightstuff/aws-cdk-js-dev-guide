"use strict"

// build-layers runs the npm install and prune commands on
// the layers/src folders, compresses the results and moves
// them into the layers/build folder

const fs = require("fs");
const fse = require("fs-extra");
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

    console.log(`removing existing build folder...`);
    fse.removeSync(layerBuildPath);
    fs.mkdirSync(layerBuildPath, {recursive: true});

    // copy everything except the package-lock file and node_modules
    let srcContents = fs.readdirSync(layerSrcPath, { withFileTypes: true })
        .filter(dirent => {
            return !(
                dirent.name == "node_modules" ||
                dirent.name == "package-lock.json"
            )
        })
        .map(dirent => dirent.name)
    for (let i in srcContents) {
        let file = srcContents[i];
        fse.copySync(`${layerSrcPath}/${file}`, `${layerBuildPath}/${file}`);
    }


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