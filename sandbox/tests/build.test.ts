import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { describe, expect, it, beforeAll } from 'vitest';

const sandboxDir = resolve(import.meta.dirname, '..');
const outputDir = resolve(sandboxDir, 'storybook-static');

let buildResult: { exitCode: number; stdout: string; stderr: string };

function runBuild(): Promise<typeof buildResult> {
  return new Promise((resolve) => {
    const proc = spawn('pnpm', ['run', 'build:storybook'], {
      cwd: sandboxDir,
      env: { ...process.env, NODE_ENV: 'production' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({ exitCode: code ?? 1, stdout, stderr });
    });
  });
}

// Run build once before all tests
const buildPromise = runBuild();

describe.skipIf(process.env.SKIP_SANDBOX_TESTS)('sandbox build', () => {
  beforeAll(async () => {
    buildResult = await buildPromise;
  }, 120_000);

  it('build succeeds with exit code 0', () => {
    if (buildResult.exitCode !== 0) {
      console.error('Build stdout:', buildResult.stdout);
      console.error('Build stderr:', buildResult.stderr);
    }
    expect(buildResult.exitCode).toBe(0);
  });

  it('iframe.html exists and contains storybook-root', () => {
    const iframePath = resolve(outputDir, 'iframe.html');
    expect(existsSync(iframePath)).toBe(true);

    const content = readFileSync(iframePath, 'utf-8');
    expect(content).toContain('storybook-root');
  });

  it('index.json exists with story entries', () => {
    const indexPath = resolve(outputDir, 'index.json');
    expect(existsSync(indexPath)).toBe(true);

    const content = JSON.parse(readFileSync(indexPath, 'utf-8'));
    expect(content.entries).toBeDefined();
    expect(Object.keys(content.entries).length).toBeGreaterThan(0);
  });

  it('preview-stats.json exists with modules', () => {
    const statsPath = resolve(outputDir, 'preview-stats.json');
    expect(existsSync(statsPath)).toBe(true);

    const content = JSON.parse(readFileSync(statsPath, 'utf-8'));
    expect(content.modules).toBeDefined();
    expect(content.modules.length).toBeGreaterThan(0);
  });

  it('MDX story is included in index.json', () => {
    const indexPath = resolve(outputDir, 'index.json');
    const content = JSON.parse(readFileSync(indexPath, 'utf-8'));

    const entries = Object.values(content.entries) as any[];
    const mdxEntry = entries.find(
      (entry) => entry.title === 'Example/Introduction' || entry.importPath?.includes('Introduction.mdx')
    );
    expect(mdxEntry).toBeDefined();
  });
});
