const fs = require('fs');
const path = require('path');
const https = require('https');

const repoBaseUrl = 'https://raw.githubusercontent.com/therightstuff/aws-cdk-js-dev-guide/main/';

const filesToCheck = [
    'tools/build-layers.js',
    'tools/diff.js',
    'tools/package-upgrade.js',
    'tools/persistent-shell.js',
    'tsconfig.json',
    'eslint.config.js',
    '.prettierrc',
    'lib/certificate-stack.ts',
    'lib/utils.ts',
    'bin/load-sensitive-json.ts'
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
    const args = process.argv.slice(2);
    if (args.includes('-h') || args.includes('--help')) {
        console.log('Usage: node tools/diff.js [options]');
        console.log('');
        console.log('Options:');
        console.log('  -h, --help       Show this help message');
        console.log('  -q, --quiet      Only show summary (match/diff/missing), do not print diffs');
        console.log('  --single         Output diffs to a single file (diffs.patch)');
        console.log('  --multiple       Output diffs to multiple files (diff-<filename>.patch)');
        console.log('');
        console.log('By default, diffs are printed to stdout.');
        process.exit(0);
    }

    const outputMode = args.includes('--single') ? 'single' : (args.includes('--multiple') ? 'multiple' : 'stdout');
    const quiet = args.includes('-q') || args.includes('--quiet');
    const allDiffs = [];

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

                const diffContent = [];
                const localLines = normalizedLocal.split('\n');
                const remoteLines = normalizedRemote.split('\n');
                const maxLines = Math.max(localLines.length, remoteLines.length);
                for (let i = 0; i < maxLines; i++) {
                    const localLine = localLines[i] || '';
                    const remoteLine = remoteLines[i] || '';
                    if (localLine !== remoteLine) {
                        diffContent.push(`- ${localLine}`);
                        diffContent.push(`+ ${remoteLine}`);
                    }
                }

                if (outputMode === 'stdout') {
                    if (!quiet) {
                        console.log(diffContent.join('\n'));
                        console.log('');
                    }
                } else if (outputMode === 'multiple') {
                    const diffFilePath = path.resolve(process.cwd(), `diff-${path.basename(file)}.patch`);
                    fs.writeFileSync(diffFilePath, diffContent.join('\n'), 'utf8');
                    console.log(`  Diff exported to: ${diffFilePath}`);
                } else if (outputMode === 'single') {
                    allDiffs.push(`--- ${file} ---`);
                    allDiffs.push(...diffContent);
                    allDiffs.push('');
                }
            }

        } catch (e) {
            console.error(`[ERROR] ${file}: ${e.message}`);
        }
    }

    if (outputMode === 'single' && allDiffs.length > 0) {
        const diffFilePath = path.resolve(process.cwd(), 'diffs.patch');
        fs.writeFileSync(diffFilePath, allDiffs.join('\n'), 'utf8');
        console.log(`All diffs exported to: ${diffFilePath}`);
    }

    console.log('-------------------------');
    console.log('Done.');
    process.exit(0);
}

main().catch(console.error);
