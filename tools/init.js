const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');
const readline = require('readline');

const repoBaseUrl = 'https://raw.githubusercontent.com/therightstuff/aws-cdk-js-dev-guide/main/';

function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }));
}

function fetchFile(relativePath) {
    return new Promise((resolve, reject) => {
        const url = `${repoBaseUrl}${relativePath}`;
        https.get(url, (res) => {
            if (res.statusCode !== 200) {
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
    const projectName = await askQuestion('Enter project name: ');
    if (!projectName) {
        console.error('Project name is required.');
        process.exit(1);
    }

    const certStackAnswer = await askQuestion('Use certificate stack? (y/n): ');
    const useCertStack = certStackAnswer.toLowerCase().startsWith('y');
    const projectDir = path.resolve(process.cwd(), projectName);

    console.log(`Initializing project ${projectName}...`);

    if (fs.existsSync(projectDir)) {
        console.error(`Directory ${projectName} already exists.`);
        process.exit(1);
    }

    fs.mkdirSync(projectDir);
    process.chdir(projectDir);

    console.log('Running cdk init...');
    execSync('npx cdk init app --language typescript', { stdio: 'inherit' });

    console.log('Copying tools...');
    fs.mkdirSync('tools', { recursive: true });
    const tools = ['build-layers.js', 'package-upgrade.js', 'persistent-shell.js'];
    for (const tool of tools) {
        const content = await fetchFile(`tools/${tool}`);
        fs.writeFileSync(`tools/${tool}`, content);
    }

    console.log('Copying configurations...');
    const configs = ['tsconfig.json', 'eslint.config.js', '.prettierrc'];
    for (const config of configs) {
        try {
            const content = await fetchFile(config);
            fs.writeFileSync(config, content);
        } catch {
            console.warn(`Could not fetch ${config}, skipping.`);
        }
    }

    console.log('Setting up lib folder...');
    const stacksJson = {
        "dev-us": {
            "description": "sample dev stack in us-east-1",
            "region": "us-east-1",
            "account": "{{AWS_ACCOUNT_NO}}",
            ...(useCertStack ? {
                "corsOrigin": "*",
                "domainName": "example.com",
                "subdomainNames": ["www"],
                "isNakedDomainTarget": true
            } : {})
        }
    };
    fs.writeFileSync('lib/stacks.json', JSON.stringify(stacksJson, null, 4));

    const stackFile = fs.readdirSync('lib').find(f => f.endsWith('-stack.ts'));
    if (stackFile) {
        let stackContent = fs.readFileSync(`lib/${stackFile}`, 'utf8');
        // Modify constructor to accept options
        stackContent = stackContent.replace(
            /constructor\s*\(([^)]*)\)\s*{/,
            'constructor($1, options: any) {'
        );
        fs.writeFileSync(`lib/${stackFile}`, stackContent);
    }

    if (useCertStack) {
        const certStackContent = await fetchFile('lib/certificate-stack.ts');
        fs.writeFileSync('lib/certificate-stack.ts', certStackContent);
    }

    const wrappedErrorContent = await fetchFile('lib/utils.ts');
    fs.writeFileSync('lib/utils.ts', wrappedErrorContent);

    console.log('Setting up bin folder...');
    const loadSensitiveJsonContent = await fetchFile('bin/load-sensitive-json.ts');
    fs.writeFileSync('bin/load-sensitive-json.ts', loadSensitiveJsonContent);

    const binFile = fs.readdirSync('bin').find(f => f.endsWith('.ts') && !f.includes('load-sensitive-json'));
    if (binFile) {
        let binContent = fs.readFileSync(`bin/${binFile}`, 'utf8');

        // Add imports
        const imports = [
            `import { loadSensitiveJson } from './load-sensitive-json';`,
            `import * as fs from 'fs';`,
            `import * as path from 'path';`
        ];
        if (useCertStack) {
            imports.push(`import { CertificateStack } from '../lib/certificate-stack';`);
        }

        binContent = imports.join('\n') + '\n' + binContent;

        // Replace instantiation
        // e.g. my-project-stack
        const classNameMatch = binContent.match(/new\s+(\w+)\s*\(/);
        const className = classNameMatch ? classNameMatch[1] : 'MyStack';

        const replacement = `
const config = loadSensitiveJson(path.join(__dirname, '../lib/stacks.json'));
Object.keys(config).forEach(envName => {
    const options = config[envName];
    const env = { account: options.account, region: options.region };

    ${useCertStack ? `
    const certStack = new CertificateStack(app, \`CertificateStack-\${envName}\`, {
        env,
        domainName: options.domainName,
        subdomainNames: options.subdomainNames,
        isNakedDomainTarget: options.isNakedDomainTarget
    });
    ` : ''}

    new ${className}(app, \`${className}-\${envName}\`, {
        env,
        ...options,
        ${useCertStack ? 'certificate: certStack.certificate,' : ''}
        ${useCertStack ? 'hostedZone: certStack.hostedZone,' : ''}
    }, options);
});
`;
        // Remove original instantiation
        binContent = binContent.replace(/new\s+\w+\s*\([^;]+;\s*/, '');
        binContent += replacement;

        fs.writeFileSync(`bin/${binFile}`, binContent);
    }

    console.log('Setting up layers...');
    fs.mkdirSync('layers/build', { recursive: true });
    fs.mkdirSync('layers/src/sample-layer/sample-layer', { recursive: true });

    const layerFiles = [
        'layers/src/sample-layer/package.json',
        'layers/src/sample-layer/requirements.txt',
        'layers/src/sample-layer/sample-layer/utils.mjs'
    ];

    for (const file of layerFiles) {
        const content = await fetchFile(file);
        const dest = file; // Structure matches
        fs.writeFileSync(dest, content);
    }

    console.log('Setting up handlers...');
    fs.mkdirSync('handlers/simple', { recursive: true });
    const handlerContent = await fetchFile('handlers/simple/index.mjs');
    fs.writeFileSync('handlers/simple/index.mjs', handlerContent);

    console.log('Done! Project initialized.');
    console.log(`cd ${projectName}`);
    console.log('npm install');
}

main().catch(console.error);
