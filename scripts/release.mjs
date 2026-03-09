import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import readline from 'node:readline';

const PYTHON_REPOSITORY = process.env.PYTHON_REPOSITORY || 'pypi';
const SKIP_PYTHON_PUBLISH = process.env.SKIP_PYTHON_PUBLISH === '1';
const SKIP_VSCODE_PUBLISH = process.env.SKIP_VSCODE_PUBLISH === '1';
const BUILD_LOCAL_BACKEND = process.env.BUILD_LOCAL_BACKEND === '1';
const RELEASE_ENV = 'PERSONA_COUNSEL_RELEASE';

const runStep = (label, command, args, options = {}) => {
  console.log(`\n> ${label}`);
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  });
  if (result.status !== 0) {
    console.error(`\n✖ ${label} failed (exit code ${result.status ?? 1})`);
    process.exit(result.status ?? 1);
  }
};

const prompt = (question, defaultValue = '') =>
  new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const suffix = defaultValue ? ` [${defaultValue}]` : '';
    rl.question(`${question}${suffix} `, (answer) => {
      rl.close();
      const normalized = answer.trim();
      resolve(normalized || defaultValue);
    });
  });

const readJsonVersion = (relativePath) => {
  const filePath = path.join(process.cwd(), relativePath);
  const raw = readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);
  return String(data.version || '').trim();
};

const readPythonVersion = () => {
  const pyprojectPath = path.join(process.cwd(), 'pyproject.toml');
  const raw = readFileSync(pyprojectPath, 'utf8');
  const match = raw.match(/^version\s*=\s*"([^"]+)"\s*$/m);
  if (!match) {
    console.error('\n✖ Could not read [project].version from pyproject.toml.');
    process.exit(1);
  }
  return match[1];
};

const readVsixTargets = () => {
  const packageTargetsRaw = process.env.PACKAGE_TARGETS?.trim();
  if (!packageTargetsRaw) {
    return ['darwin-arm64', 'linux-x64', 'win32-x64'];
  }
  return packageTargetsRaw.split(/\s+/).filter(Boolean);
};

const collectPythonDistFiles = () => {
  const distDir = path.join(process.cwd(), 'dist');
  const files = readdirSync(distDir)
    .filter((name) => name.endsWith('.whl') || name.endsWith('.tar.gz'))
    .map((name) => path.join('dist', name));
  if (files.length === 0) {
    console.error('\n✖ No Python distribution files found under dist/.');
    process.exit(1);
  }
  return files;
};

const publishVsixToMarketplace = (vsixPath) => {
  runStep(
    `Publishing VS Code extension ${path.basename(vsixPath)}`,
    'npx',
    ['--yes', '@vscode/vsce', 'publish', '--packagePath', vsixPath],
    { env: { ...process.env, [RELEASE_ENV]: '1' } },
  );
};

const pythonVersion = readPythonVersion();
const extensionVersion = readJsonVersion('extension/package.json');
const vsixTargets = readVsixTargets();
const vsixFiles = vsixTargets.map((target) => `extension/persona-counsel-vscode-${target}.vsix`);

const main = async () => {
  const isDryRun = process.argv.slice(2).includes('--dry-run');

  if (isDryRun) {
    console.log('\nRelease dry run plan:');
    console.log(`- python package: persona-counsel@${pythonVersion} -> ${PYTHON_REPOSITORY}`);
    console.log(`- vscode extension: persona-counsel-vscode@${extensionVersion} -> VS Code Marketplace`);
    console.log(`- vsix targets: ${vsixTargets.join(', ')}`);
    if (BUILD_LOCAL_BACKEND) {
      console.log('- backend packaging: include local target build (BUILD_LOCAL_BACKEND=1)');
    }
    if (SKIP_PYTHON_PUBLISH) {
      console.log('- python publishing skipped (SKIP_PYTHON_PUBLISH=1)');
    }
    if (SKIP_VSCODE_PUBLISH) {
      console.log('- vscode publishing skipped (SKIP_VSCODE_PUBLISH=1)');
    }
    process.exit(0);
  }

  if (!SKIP_PYTHON_PUBLISH) {
    runStep('Build Python distribution', 'python3', ['-m', 'build']);
    const distFiles = collectPythonDistFiles();
    runStep('Check Python distribution metadata', 'python3', ['-m', 'twine', 'check', ...distFiles]);
  }

  const releaseKinds = [];
  if (!SKIP_PYTHON_PUBLISH) {
    releaseKinds.push(`Python package persona-counsel@${pythonVersion} (${PYTHON_REPOSITORY})`);
  }
  if (!SKIP_VSCODE_PUBLISH) {
    releaseKinds.push(`VS Code extension persona-counsel-vscode@${extensionVersion} (${vsixTargets.length} target VSIX files)`);
  }

  if (releaseKinds.length === 0) {
    console.log('\nNothing to release: both SKIP_PYTHON_PUBLISH=1 and SKIP_VSCODE_PUBLISH=1 are set.');
    process.exit(0);
  }

  const confirm = await prompt(`Publish ${releaseKinds.join(' + ')}? (y/N)`, 'n');
  if (!/^y(es)?$/i.test(confirm)) {
    console.log('\nRelease cancelled before publishing.');
    process.exit(0);
  }

  if (!SKIP_PYTHON_PUBLISH) {
    const distFiles = collectPythonDistFiles();
    runStep(
      `Upload Python package to ${PYTHON_REPOSITORY}`,
      'python3',
      ['-m', 'twine', 'upload', '--repository', PYTHON_REPOSITORY, ...distFiles],
      { env: { ...process.env, [RELEASE_ENV]: '1' } },
    );
  }

  if (!SKIP_VSCODE_PUBLISH) {
    if (!process.env.VSCE_PAT) {
      console.error('\n✖ Missing VSCE_PAT. Set VSCE_PAT with a VS Code Marketplace PAT before publishing.');
      process.exit(1);
    }

    const releaseVsixArgs = BUILD_LOCAL_BACKEND
      ? ['./scripts/release_vscode_extension.sh', '--build-local']
      : ['./scripts/release_vscode_extension.sh'];

    runStep(
      `Package VS Code extension (${vsixTargets.join(', ')})`,
      releaseVsixArgs[0],
      releaseVsixArgs.slice(1),
      { env: { ...process.env, PACKAGE_TARGETS: vsixTargets.join(' '), [RELEASE_ENV]: '1' } },
    );

    vsixFiles.forEach((vsixFile) => publishVsixToMarketplace(vsixFile));
  }

  console.log('\n✓ Release publish flow completed.');
};

main().catch((error) => {
  console.error('Unexpected release script error:', error);
  process.exit(1);
});
