import { describe, it, expect, jest } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { EventEmitter } from 'node:events';

const initSource = fs.readFileSync(new URL('../../tools/init.js', import.meta.url), 'utf8');

describe('template initialization', () => {
    it.each([
        ['plain-project', 'n', 'plain-project.ts'],
        ['certificate-project', 'yes', 'certificate-entry.ts'],
    ])('configures tsx for %s and preserves CDK settings', async (projectName, certAnswer, binFile) => {
        const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'cdk-init-test-'));
        let cwd = sandbox;
        const scopedFs = Object.fromEntries([
            'existsSync', 'mkdirSync', 'rmSync', 'writeFileSync', 'readFileSync',
            'chmodSync', 'readdirSync',
        ].map(method => [method, (file, ...args) => fs[method](path.resolve(cwd, file), ...args)]));
        const originalCdk = {
            app: `npx ts-node --prefer-ts-exts bin/${binFile}`,
            context: { 'test:featureFlag': true },
            watch: { include: ['**'], exclude: ['README.md'] },
        };
        const templatePackage = {
            scripts: { build: 'tsc', synth: 'npm run build && cdk synth' },
            dependencies: { tsx: '^4.23.15', typescript: '~7.0.2' },
        };
        const templates = {
            'README.md': '# Template\n',
            'package.json': JSON.stringify(templatePackage),
            'tsconfig.json': JSON.stringify({ exclude: ['node_modules', 'static-website'] }),
            'eslint.config.js': "module.exports = [{ ignores: ['static-website/**'] }];",
            'bin/aws-cdk-js-dev-guide.ts': "import { AwsStack } from '../lib/aws-cdk-js-dev-guide-stack';\n",
        };
        const execSync = jest.fn(command => {
            if (command === 'npx cdk init app --language typescript') {
                for (const dir of ['bin', 'lib', 'test']) scopedFs.mkdirSync(dir);
                scopedFs.writeFileSync('package.json', JSON.stringify({
                    name: projectName,
                    devDependencies: { 'ts-node': '^10.9.2' },
                }));
                scopedFs.writeFileSync('cdk.json', JSON.stringify(originalCdk));
                scopedFs.writeFileSync(`bin/${binFile}`, "import { TestStack } from '../lib/test-stack';\n");
                scopedFs.writeFileSync('lib/test-stack.ts', '');
            } else {
                expect(command).toBe('npm install');
                // Check the launch command is fixed before installing the new dependencies.
                expect(JSON.parse(scopedFs.readFileSync('cdk.json', 'utf8'))).toEqual({
                    ...originalCdk,
                    app: `npx tsx bin/${binFile}`,
                });
            }
        });
        const answers = [projectName, certAnswer];
        const modules = {
            'node:fs': scopedFs,
            'node:path': path,
            'node:child_process': { execSync },
            './utils': { askQuestion: async () => answers.shift() },
            'node:https': {
                get(url, callback) {
                    const relativePath = new URL(url).pathname.split('/main/')[1];
                    const response = new EventEmitter();
                    response.statusCode = 200;
                    callback(response);
                    queueMicrotask(() => {
                        response.emit('data', templates[relativePath] ?? '');
                        response.emit('end');
                    });
                    return new EventEmitter();
                },
            },
        };
        const exit = jest.fn();
        const errors = [];

        try {
            await vm.runInNewContext(initSource, {
                require(name) {
                    if (!(name in modules)) throw new Error(`Unexpected module: ${name}`);
                    return modules[name];
                },
                process: { cwd: () => cwd, chdir: dir => { cwd = dir; }, exit },
                console: { log() {}, error: error => errors.push(error) },
            });
            expect(errors).toEqual([]);
            expect(exit.mock.calls).toEqual([[0]]);
            expect(execSync).toHaveBeenCalledWith('npm install', expect.any(Object));
            const generatedPackage = JSON.parse(scopedFs.readFileSync('package.json', 'utf8'));
            expect(generatedPackage.dependencies).toEqual(templatePackage.dependencies);
            expect(generatedPackage.devDependencies?.['ts-node']).toBeUndefined();
            expect(generatedPackage.scripts).toEqual(templatePackage.scripts);
        } finally {
            fs.rmSync(sandbox, { recursive: true, force: true });
        }
    });
});
