import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import readline from 'node:readline';

const PYTHON_REPOSITORY = process.env.PYTHON_REPOSITORY || 'pypi';
const SKIP_PYTHON_PUBLISH = process.env.SKIP_PYTHON_PUBLISH === '1';
const SKIP_VSCODE_PUBLISH = process.env.SKIP_VSCODE_PUBLISH === '1';
const BUILD_LOCAL_BACKEND = process.env.BUILD_LOCAL_BACKEND === '1';
const RELEASE_ENV = 'PERSONA_COUNSEL_RELEASE';
const ALLOW_STABLE_RELEASE = false;
const USE_COLOR = process.stdout.isTTY && process.env.NO_COLOR !== '1';
const ANSI = {
  reset: '\u001b[0m',
  dim: '\u001b[2m',
  cyan: '\u001b[36m',
};

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

const color = (value, tone) => (USE_COLOR ? `${ANSI[tone]}${value}${ANSI.reset}` : value);
const fmtVersion = (version) => color(version, 'cyan');
const fmtHint = (value) => color(value, 'dim');
const RELEASE_TOOLS_VENV = '.release-tools-venv';

const getVenvPythonPath = () =>
  process.platform === 'win32'
    ? path.join(RELEASE_TOOLS_VENV, 'Scripts', 'python.exe')
    : path.join(RELEASE_TOOLS_VENV, 'bin', 'python');

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

const ensurePythonReleaseTooling = () => {
  const venvPython = getVenvPythonPath();
  runStep('Create/refresh local release venv', 'python3', ['-m', 'venv', RELEASE_TOOLS_VENV]);
  runStep(
    'Install Python release tooling (build, twine)',
    venvPython,
    ['-m', 'pip', 'install', '--upgrade', 'pip', 'build', 'twine'],
  );
  return venvPython;
};

const isPythonPrereleaseVersion = (version) => /(a|b|rc)\d+|\.dev\d+/i.test(version);
const isVsCodePrereleaseVersion = (version) => /-/.test(version);

const enforcePrereleaseOnly = (pythonVersion, vscodeVersion) => {
  if (ALLOW_STABLE_RELEASE) {
    return;
  }
  if (!isPythonPrereleaseVersion(pythonVersion)) {
    console.error(
      `\n✖ Stable Python version blocked by prerelease lock: ${pythonVersion}. ` +
      'Use a prerelease version (for example 0.1.0a1) or set ALLOW_STABLE_RELEASE=true in scripts/release.mjs.',
    );
    process.exit(1);
  }
  if (!isVsCodePrereleaseVersion(vscodeVersion)) {
    console.error(
      `\n✖ Stable VS Code extension version blocked by prerelease lock: ${vscodeVersion}. ` +
      'Use a prerelease semver (for example 0.1.0-alpha.1) or set ALLOW_STABLE_RELEASE=true in scripts/release.mjs.',
    );
    process.exit(1);
  }
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
  const publishArgs = ['--yes', '@vscode/vsce', 'publish', '--packagePath', vsixPath];
  if (!ALLOW_STABLE_RELEASE) {
    publishArgs.push('--pre-release');
  }
  runStep(
    `Publishing VS Code extension ${path.basename(vsixPath)}`,
    'npx',
    publishArgs,
    { env: { ...process.env, [RELEASE_ENV]: '1' } },
  );
};

const pythonVersion = readPythonVersion();
const extensionVersion = readJsonVersion('extension/package.json');
const vsixTargets = readVsixTargets();
const vsixFiles = vsixTargets.map((target) => `extension/persona-counsel-vscode-${target}.vsix`);
enforcePrereleaseOnly(pythonVersion, extensionVersion);

const main = async () => {
  const isDryRun = process.argv.slice(2).includes('--dry-run');
  let releasePython = 'python3';

  if (isDryRun) {
    console.log('\nRelease dry run plan:');
    console.log(
      `- python package: persona-counsel@${fmtVersion(pythonVersion)} -> ${PYTHON_REPOSITORY}`,
    );
    console.log(
      `- vscode extension: persona-counsel-vscode@${fmtVersion(extensionVersion)} -> VS Code Marketplace`,
    );
    console.log(`- vsix targets: ${vsixTargets.join(', ')}`);
    if (BUILD_LOCAL_BACKEND) {
      console.log(`- backend packaging: include local target build (${fmtHint('BUILD_LOCAL_BACKEND=1')})`);
    }
    if (SKIP_PYTHON_PUBLISH) {
      console.log(`- python publishing skipped (${fmtHint('SKIP_PYTHON_PUBLISH=1')})`);
    }
    if (SKIP_VSCODE_PUBLISH) {
      console.log(`- vscode publishing skipped (${fmtHint('SKIP_VSCODE_PUBLISH=1')})`);
    }
    if (!ALLOW_STABLE_RELEASE) {
      console.log(`- stable release lock: ${fmtHint('ON')} (flip ALLOW_STABLE_RELEASE=true to disable)`);
    }
    process.exit(0);
  }

  if (!SKIP_PYTHON_PUBLISH) {
    releasePython = ensurePythonReleaseTooling();
    runStep('Build Python distribution', releasePython, ['-m', 'build']);
    const distFiles = collectPythonDistFiles();
    runStep(
      'Check Python distribution metadata',
      releasePython,
      ['-m', 'twine', 'check', ...distFiles],
    );
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
      releasePython,
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
