"use strict"

// build-layers runs the npm install and prune commands on
// the layers/src folders, compresses the results and moves
// them into the layers/build folder

const archiver = require('archiver');
const fs = require("fs");
const fse = require("fs-extra");
const process = require("child_process");

function zipDirectory(source, archivedName, out) {
    const archive = archiver('zip', { zlib: { level: 9 }});
    const stream = fs.createWriteStream(out);

    return new Promise((resolve, reject) => {
        archive
            .directory(source, archivedName)
            .on('error', err => reject(err))
            .pipe(stream)
        ;

        stream.on('close', () => resolve());
        archive.finalize();
    });
}

console.log('building layers...')

// ensure layers directory created
fs.mkdirSync('layers/src', {recursive: true});
fs.rmdirSync('layers/build', { recursive: true })

// get layers' src directories
let srcdirs = fs.readdirSync('layers/src', { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)

for (let i in srcdirs) {
    let layer = srcdirs[i];
    console.log(`\nprocessing ${layer}...`);

    let layerSrcPath = `layers/src/${layer}`
    let layerBuildPath = `layers/build/${layer}/nodejs`

    fs.mkdirSync(layerBuildPath, { recursive: true });

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

    zipDirectory(`layers/build/${layer}/nodejs`, 'nodejs', `layers/build/${layer}/${layer}.zip`)
    .then(() => {
        console.log(`${layer} folder compressed successfully`);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
}

console.log('layer builds completed.')
