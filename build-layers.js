"use strict"

// build-layers copies layers/src folder contents into layer/build, then runs
// the npm install and prune commands

const fs = require("fs");
const fse = require("fs-extra");
const process = require("child_process");
const { checksumDirectory } = require("simple-recursive-checksum");

async function main() {
    console.log('building layers...\n')

    // ensure layers directory created
    fs.mkdirSync('layers/src', {recursive: true});
    fs.mkdirSync('layers/build', {recursive: true});

    console.log(`deleting previous build directories that don't have matching source directories...\n`);
    let srcdirs = fs.readdirSync('layers/src', { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
    let builddirs = fs.readdirSync('layers/build', { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
    for (let i in builddirs) {
        let builddir = builddirs[i];
        if (!srcdirs.includes(builddir)) {
            console.log(`deleting ${builddir}...`);
            fs.rmSync(`layers/build/${builddir}`, { recursive: true, force: true });
        }
    }

    for (let i in srcdirs) {
        let layer = srcdirs[i];
        console.log(`processing layer ${layer}...`);

        let layerSrcPath = `layers/src/${layer}`
        let layerBuildPath = `layers/build/${layer}/nodejs`

        let hash = await checksumDirectory(layerSrcPath, 'md5');

        // if the hash matches the hash in the build directory, skip this layer
        let buildHashFile = `layers/build/${layer}.md5`;
        let buildHash = fs.existsSync(buildHashFile) ? fs.readFileSync(buildHashFile, { encoding: 'utf8' }).trim() : null;

        if (hash == buildHash) {
            console.log(`skipping ${layer}, no changes detected...\n`);
            continue;
        }

        // delete the build hash file if it exists
        if (buildHash) {
            fs.unlinkSync(buildHashFile);
        }

        console.log(`(re)creating build directory...`);
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

        console.log(`writing hash to ${buildHashFile}...`);
        fs.writeFileSync(buildHashFile, hash, { encoding: 'utf8' });

        console.log(`${layer} folder build complete\n`);
    }

    console.log('layer builds completed.\n')
}

main();
