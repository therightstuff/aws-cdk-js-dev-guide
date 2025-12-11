const fs = require('fs');
const path = require('path');
const https = require('https');

const repoBaseUrl = 'https://raw.githubusercontent.com/therightstuff/aws-cdk-js-dev-guide/main/';

const filesToCheck = [
    'tools/build-layers.js',
    'tools/package-upgrade.js',
    'tools/persistent-shell.js',
    'tsconfig.json',
    'eslint.config.js',
    '.prettierrc',
    'lib/certificate-stack.ts',
    'lib/utils.ts',
    'bin/load-sensitive-json.ts',
    'layers/src/sample-layer/package.json',
    'layers/src/sample-layer/requirements.txt',
    'layers/src/sample-layer/sample-layer/utils.mjs',
    'handlers/simple/index.mjs'
];

function fetchFile(relativePath) {
    return new Promise((resolve, reject) => {
        const url = `${repoBaseUrl}${relativePath}`;
        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                // If file doesn't exist on remote (e.g. .prettierrc might not), return null
                if (res.statusCode === 404) {
                    resolve(null);
                    return;
                }
                reject(new Error(`Failed to fetch ${relativePath}: ${res.statusCode}`));
                return;
            }
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function main() {
    console.log('Generating diff report...');
    console.log('-------------------------');

    for (const file of filesToCheck) {
        const localPath = path.resolve(process.cwd(), file);

        if (!fs.existsSync(localPath)) {
            console.log(`[MISSING] ${file} (Local file not found)`);
            continue;
        }

        try {
            const remoteContent = await fetchFile(file);

            if (remoteContent === null) {
                console.log(`[LOCAL ONLY] ${file} (Not found in remote repo)`);
                continue;
            }

            const localContent = fs.readFileSync(localPath, 'utf8');

            // Normalize line endings
            const normalizedLocal = localContent.replace(/\r\n/g, '\n');
            const normalizedRemote = remoteContent.replace(/\r\n/g, '\n');

            if (normalizedLocal === normalizedRemote) {
                console.log(`[MATCH] ${file}`);
            } else {
                console.log(`[DIFF] ${file} (Content differs)`);
            }

        } catch (e) {
            console.error(`[ERROR] ${file}: ${e.message}`);
        }
    }

    console.log('-------------------------');
    console.log('Done.');
}

main().catch(console.error);
