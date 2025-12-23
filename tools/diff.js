#!/usr/bin/env node

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');

const { askQuestion } = require('./utils');

const repoBaseUrl = 'https://raw.githubusercontent.com/therightstuff/aws-cdk-js-dev-guide/main/';
const yesAnswers = new Set(['y', 'yes']);

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

async function handleDiff({file, diffContent, outputMode, quiet, allDiffs}) {
    if (outputMode === 'stdout') {
        if (!quiet) {
            console.log(`git diff: \n${diffContent}`);
            console.log();
        }
    } else if (outputMode === 'multiple') {
        const diffFilePath = path.resolve(process.cwd(), `diff-${path.basename(file)}.patch`);
        fs.writeFileSync(diffFilePath, `${diffContent}\n\n`, 'utf8');
        console.log(`  Diff exported to: ${diffFilePath}`);
    } else if (outputMode === 'single') {
        allDiffs.push(`--- ${file} ---`, diffContent, '');
    }
}

async function handleOverwrite({file, localPath, remoteContent}) {
    const answer = await askQuestion(`Do you want to copy remote file ${file} to ${localPath}? (y/N): `);
    if (yesAnswers.has(answer.toLowerCase())) {
        fs.writeFileSync(localPath, remoteContent, 'utf8');
        console.log(`  Copied ${file} to ${localPath}`);
    }
}

async function generateDiffReport({outputMode, quiet, allDiffs}) {
    console.log('Generating diff report...');
    console.log('-------------------------');

    for (const file of filesToCheck) {
        const localPath = path.resolve(process.cwd(), file);

        if (!fs.existsSync(localPath)) {
            console.log(`[MISSING] ${file} (Local file not found)`);

            const remoteContent = await fetchFile(file);
            if (remoteContent === null) {
                console.warn(`  Remote file also not found: ${file}`);
                continue;
            }

            await handleOverwrite({file, localPath, remoteContent});

            continue;
        }

        try {
            const remoteContent = await fetchFile(file);

            if (remoteContent === null) {
                console.log(`[LOCAL ONLY] ${file} (Not found in remote repo)`);
                continue;
            }

            const localContent = fs.readFileSync(localPath, 'utf8');

            const localHash = execSync('git hash-object -w --stdin', { input: localContent }).toString().trim();
            const remoteHash = execSync('git hash-object -w --stdin', { input: remoteContent }).toString().trim();
            const diffContent = execSync(`git diff ${remoteHash} ${localHash} --word-diff`).toString();

            if (diffContent.length == 0) {
                console.log(`[MATCH] ${file}`);
            } else {
                console.log(`[DIFF] ${file} (Content differs)`);

                await handleDiff({file, diffContent, outputMode, quiet, allDiffs});

                await handleOverwrite({file, localPath, remoteContent});
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
}

async function main() {
    const args = new Set(process.argv.slice(2));
    if (args.has('-h') || args.has('--help')) {
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

    let outputMode = 'stdout';
    if (args.has('--single')) {
        outputMode = 'single';
    } else if (args.has('--multiple')) {
        outputMode = 'multiple';
    }
    const quiet = args.has('-q') || args.has('--quiet');
    const allDiffs = [];

    await generateDiffReport({outputMode, quiet, allDiffs});
}

main().catch(err => {
    console.error(err);
    process.exit(1);
}).then(() => {
    process.exit(0);
});
