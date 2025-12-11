const fs = require("fs");
const childProcess = require("child_process");

console.log(`updating cdk project packages`);
childProcess.execSync("npx --yes npm-check-updates -u", {
    stdio: "inherit",
    stderr: "inherit",
});

// get layers' src directories
let srcdirs = fs
    .readdirSync("layers/src", { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

for (let i in srcdirs) {
    let layer = srcdirs[i];
    console.log(`\nupdating packages for layer ${layer}...`);

    let layerSrcPath = `layers/src/${layer}`;
    childProcess.execSync("npx --yes npm-check-updates -u", {
        cwd: layerSrcPath,
        stdio: "inherit",
        stderr: "inherit",
    });
}
