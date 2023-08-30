"use strict"

// build-layers copies layers/src folder contents into layer/build, then runs
// the npm install and prune commands

const fs = require("fs");
const fse = require("fs-extra");
const path = require("path");
const spawn = require("child_process");
const { checksumDirectory } = require("simple-recursive-checksum");
const { getPersistentShell } = require("./persistent-shell");

const LAYER_SRC_PATH = path.resolve('layers/src');
const LAYER_BUILD_PATH = path.resolve('layers/build');

function getValidSubDirectories(path) {
    return fs.readdirSync(path, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
}

async function processLayer(layer) {
    console.log(`processing layer ${layer}...`);

    const layerSrcPath = path.join(LAYER_SRC_PATH, layer);

    const isWindowsPlatform = process.platform === "win32";

    const packageJsonExists = fs.existsSync(path.join(layerSrcPath, 'package.json'));
    const packageLockExists = fs.existsSync(path.join(layerSrcPath, 'package-lock.json'));
    const setupPyExists = fs.existsSync(path.join(layerSrcPath ,'setup.py'));
    const requirementsTxtExists = fs.existsSync(path.join(layerSrcPath, 'requirements.txt'));

    const isNodeJsLayer = packageJsonExists || packageLockExists;
    const isPythonLayer = setupPyExists || requirementsTxtExists;
    if (!isNodeJsLayer && !isPythonLayer) {
        console.log(`unable to identify supported runtime for layer ${layer}, skipping...`);
        return;
    }
    const layerBuildPath = path.join(LAYER_BUILD_PATH, layer);

    const hash = await checksumDirectory(layerSrcPath, 'md5');

    // if the hash matches the hash in the build directory, skip this layer
    const buildHashFile = `${layerBuildPath}.md5`;
    const buildHash = fs.existsSync(buildHashFile) ?
        fs.readFileSync(buildHashFile, { encoding: 'utf8' }).trim()
        : null;

    if (hash == buildHash) {
        console.log(`skipping ${layer}, no changes detected...\n`);
    } else {
        // delete the build hash file if it exists
        if (buildHash) {
            fs.unlinkSync(buildHashFile);
        }

        console.log(`(re)creating build directory...`);
        fs.rmSync(layerBuildPath, { recursive: true, force: true });

        if (isNodeJsLayer) {
            const nodeJsContentsPath = path.join(layerBuildPath, 'nodejs');
            // (re)create the nodejs folder
            fs.mkdirSync(nodeJsContentsPath, { recursive: true });
            // copy everything except the node_modules
            const srcContents = fs.readdirSync(layerSrcPath, { withFileTypes: true })
                .filter(dirent => dirent.name != "node_modules")
                .map(dirent => dirent.name)
            for (const file of srcContents) {
                fse.copySync(
                    path.join(layerSrcPath, file),
                    path.join(nodeJsContentsPath, file)
                );
            }

            console.log("installing npm dependencies...");
            const npmCommand = packageLockExists ? 'ci' : 'install';
            spawn.execSync(`npm ${npmCommand}`, { cwd: nodeJsContentsPath });
        }

        if (isPythonLayer) {
            const pythonContentsPath = path.join(layerBuildPath, 'python');
            fs.mkdirSync(pythonContentsPath, { recursive: true });

            // NOTE: depending on your Windows configuration, you may have
            //       to use "python" instead of "python3"
            console.log("recreating virtual environment...");
            const shell = getPersistentShell();
            shell.execCmd(`cd ${layerSrcPath}`);
            shell.execCmd(`python3 -m venv venv`);
            const activateScript = isWindowsPlatform ?
                path.join("venv","Scripts","activate.bat")
                : ". venv/bin/activate";
            shell.execCmd(activateScript);

            // install dependencies
            shell.execCmd(`python3 -m pip install --upgrade pip`);
            if (setupPyExists) {
                fse.copySync(
                    path.join(layerSrcPath, "setup.py"),
                    path.join(pythonContentsPath, "setup.py")
                );
                shell.execCmd(`python3 -m pip install --target ${pythonContentsPath} --upgrade .`);
            }
            if (requirementsTxtExists) {
                fse.copySync(
                    path.join(layerSrcPath, "requirements.txt"),
                    path.join(pythonContentsPath, "requirements.txt")
                );
                shell.execCmd(`python3 -m pip install --target ${pythonContentsPath} --upgrade -r requirements.txt`);
            }

            // remove virtual environment to preserve original hash
            // use shell commands and not fs.rm because the venv
            // folder is locked and fm.rs fails silently
            console.log(`removing virtual environment from source path...`);
            if (isWindowsPlatform) {
                shell.execCmd(`rmdir /s /q venv`);
            } else {
                shell.execCmd(`rm -rf venv`);
            }

            shell.execCmd(`exit`);
            // uncomment the following to debug:
            // console.log(await shell.finalResult);
        }

        console.log(`writing hash to ${buildHashFile}...`);
        fs.writeFileSync(buildHashFile, hash, { encoding: 'utf8' });

        console.log(`${layer} folder build complete\n`);
    }
}

async function processLayers() {
    const srcDirs = getValidSubDirectories(LAYER_SRC_PATH);

    for (let layer of srcDirs) {
        await processLayer(layer);
    }
}

async function removeObsoleteBuildDirectories() {
    const srcDirs = getValidSubDirectories(LAYER_SRC_PATH);
    const buildDirs = getValidSubDirectories(LAYER_BUILD_PATH);

    console.log(`deleting previous build directories that don't have matching source directories...\n`);
    for (const buildDir of buildDirs) {
        if (!srcDirs.includes(buildDir)) {
            console.log(`deleting ${buildDir}...`);
            const layerBuildPath = path.join(LAYER_BUILD_PATH, buildDir);
            fs.rmSync(layerBuildPath, { recursive: true, force: true });
            const buildHashFile = `${layerBuildPath}.md5`;
            if (fs.existsSync(buildHashFile)) {
                fs.unlinkSync(buildHashFile);
            }
        }
    }
}

async function main() {
    console.log('building layers...\n')

    // ensure layers directories exist
    fs.mkdirSync(LAYER_SRC_PATH, {recursive: true});
    fs.mkdirSync(LAYER_BUILD_PATH, {recursive: true});

    await removeObsoleteBuildDirectories();

    await processLayers();
}

main().then(()=>{
    console.log('layer builds completed.\n');
});
