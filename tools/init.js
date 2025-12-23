#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');

const { askQuestion } = require('./utils');

const repoBaseUrl = 'https://raw.githubusercontent.com/therightstuff/aws-cdk-js-dev-guide/main/';

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

    const certStackAnswer = await askQuestion('Use certificate stack? (y/N): ');
    const yesAnswers = ['y', 'yes'];
    const useCertStack = yesAnswers.includes(certStackAnswer.toLowerCase());
    const projectDir = path.resolve(process.cwd(), projectName);

    console.log(`Initializing project ${projectName}...`);

    if (fs.existsSync(projectDir)) {
        console.error(`Directory ${projectName} already exists.`);
        process.exit(1);
    }

    fs.mkdirSync(projectDir);
    process.chdir(projectDir);

    console.log('Running cdk init...');
    execSync('npx cdk init app --language typescript', { stdio: ['ignore', 'inherit', 'inherit'] });

    console.log('Removing test folder...');
    fs.rmSync('test', { recursive: true, force: true });

    console.log('Copying tools...');
    fs.mkdirSync('tools', { recursive: true });
    const tools = [
        'build-layers.js',
        'diff.js',
        'init.js',
        'package-upgrade.js',
        'persistent-shell.js'
    ];
    for (const tool of tools) {
        const content = await fetchFile(`tools/${tool}`);
        fs.writeFileSync(`tools/${tool}`, content);
        fs.chmodSync(`tools/${tool}`, 0o755);
    }

    console.log('Copying README...');
    try {
        let readmeContent = await fetchFile('README.md');
        // Replace the first heading with the project name
        readmeContent = readmeContent.replace(/^#\s+.+$/m, `# ${projectName}`);
        fs.writeFileSync('README.md', readmeContent);
    } catch {
        throw new Error('Could not fetch README.md, aborting.');
    }

    console.log('Copying configurations...');
    const configs = [
        '.env.template',
        '.gitignore',
        '.prettierrc',
        'eslint.config.js',
        'tsconfig.json'
    ];
    for (const config of configs) {
        try {
            const content = await fetchFile(config);
            fs.writeFileSync(config, content);
        } catch {
            throw new Error(`Could not fetch ${config}, aborting.`);
        }
    }

    console.log('Updating package.json...');
    const remotePackageJsonStr = await fetchFile('package.json');
    const remotePackageJson = JSON.parse(remotePackageJsonStr);
    const localPackageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

    // overwrite scripts
    localPackageJson.scripts = remotePackageJson.scripts;

    // overwrite dependencies
    localPackageJson.dependencies = remotePackageJson.dependencies;

    // overwrite devDependencies
    localPackageJson.devDependencies = remotePackageJson.devDependencies;

    fs.writeFileSync('package.json', JSON.stringify(localPackageJson, null, 2));

    if (!useCertStack) {
        console.log('Updating configurations (removing static-website)...');

        if (fs.existsSync('tsconfig.json')) {
            const tsConfig = JSON.parse(fs.readFileSync('tsconfig.json', 'utf8'));
            if (tsConfig.exclude) {
                tsConfig.exclude = tsConfig.exclude.filter(e => e !== 'static-website');
                fs.writeFileSync('tsconfig.json', JSON.stringify(tsConfig, null, 2));
            }
        }

        if (fs.existsSync('eslint.config.js')) {
            let eslintConfig = fs.readFileSync('eslint.config.js', 'utf8');
            eslintConfig = eslintConfig.replace(/'static-website\/\*\*',?\s*/g, '');
            fs.writeFileSync('eslint.config.js', eslintConfig);
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
            'constructor($1, customOptions?: any) {'
        );
        // Inject customOptions initialization
        stackContent = stackContent.replace(
            /super\s*\(\s*scope,\s*id\s*(,[^)]*)?\);/,
            'super(scope, id$1);\n    customOptions = customOptions ?? {};'
        );
        fs.writeFileSync(`lib/${stackFile}`, stackContent);
    }

    let stackClassName = 'AwsStack';
    let stackImportPath = '../lib/aws-cdk-js-dev-guide-stack';
    const binFile = fs.readdirSync('bin').find(f => f.endsWith('.ts') && !f.includes('load-sensitive-json'));

    if (binFile) {
        const originalBinContent = fs.readFileSync(`bin/${binFile}`, 'utf8');
        const stackImportMatch = originalBinContent.match(/import\s+\{\s*(\w+)\s*\}\s+from\s+'(\.\.\/lib\/[^']+)';/);
        if (stackImportMatch) {
            stackClassName = stackImportMatch[1];
            stackImportPath = stackImportMatch[2];
        }
    } else {
        throw new Error('No valid bin file found.');
    }

    if (useCertStack) {
        const certStackContent = await fetchFile('lib/certificate-stack.ts');
        fs.writeFileSync('lib/certificate-stack.ts', certStackContent);

        console.log('Setting up static website...');
        fs.mkdirSync('static-website/js', { recursive: true });
        fs.mkdirSync('static-website/subdirectory', { recursive: true });

        const staticWebsiteLibFile = 'lib/static-website.ts';

        const staticWebsiteFiles = [
            staticWebsiteLibFile,
            'static-website/error-403.html',
            'static-website/error-404.html',
            'static-website/index.html',
            'static-website/js/sample.js',
            'static-website/subdirectory/index.html'
        ];

        for (const file of staticWebsiteFiles) {
            let content = await fetchFile(file);
            if (file === staticWebsiteLibFile) {
                 const libImportPath = stackImportPath.replace('../lib/', './');
                 content = content.replace(
                    /import\s+\{\s*AwsStack\s*\}\s+from\s+"[^"]+";/,
                    `import { ${stackClassName} } from "${libImportPath}";`
                );
                content = content.replace(/AwsStack/g, stackClassName);
            }
            fs.writeFileSync(file, content);
        }
    }

    const wrappedErrorContent = await fetchFile('lib/utils.ts');
    fs.writeFileSync('lib/utils.ts', wrappedErrorContent);

    console.log('Setting up bin folder...');
    const loadSensitiveJsonContent = await fetchFile('bin/load-sensitive-json.ts');
    fs.writeFileSync('bin/load-sensitive-json.ts', loadSensitiveJsonContent);

    let newBinContent = await fetchFile('bin/aws-cdk-js-dev-guide.ts');

    // Replace stack import
    newBinContent = newBinContent.replace(
        /import\s+\{\s*AwsStack\s*\}\s+from\s+'\.\.\/lib\/aws-cdk-js-dev-guide-stack';/,
        `import { ${stackClassName} } from '${stackImportPath}';`
    );

    // Replace stack class usage
    newBinContent = newBinContent.replace(/new\s+AwsStack\s*\(/g, `new ${stackClassName}(`);

    // Replace stack name prefix
    newBinContent = newBinContent.replace(/`AwsStack-/g, `\`${stackClassName}-`);

    if (!useCertStack) {
        // Remove CertificateStack import
        newBinContent = newBinContent.replace(/import\s+\{\s*CertificateStack\s*\}\s+from\s+'\.\.\/lib\/certificate-stack';\n/, '');

        // Remove CertificateStack logic block, identified by the comments // CERTIFICATE-STACK-START and // CERTIFICATE-STACK-END
        newBinContent = newBinContent.replace(
            /\s*\/\/ CERTIFICATE-STACK-START[\s\S]*?\/\/ CERTIFICATE-STACK-END\s*/,
            '\n\n    '
        );

        // Remove the crossRegionReferences flag setting
        newBinContent = newBinContent.replace(
            /\s*\/\/ if the stack requires a certificate[\s\S]*?crossRegionReferences = true;\s*}/,
            '\n\n    '
        );
    } else {
        // replace if (stack.domainName && stack.resources.includes("static-website")) { with only a check for the domain name
        newBinContent = newBinContent.replace(
            /if\s*\(stack\.domainName\s.*/,
            'if (stack.domainName) {'
        );
    }

    fs.writeFileSync(`bin/${binFile}`, newBinContent);

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

    console.log('Running npm install...');
    // Ignore stdin so npm doesn't try to read from the curl pipe
    execSync('npm install', { stdio: ['ignore', 'inherit', 'inherit'] });

    console.log('Done! Project initialized.');
}

main().catch(err => {
    console.error(err);
    process.exit(1);
}).then(() => {
    process.exit(0);
});
