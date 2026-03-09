import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
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
const PYPROJECT_PATH = path.join(process.cwd(), 'pyproject.toml');
const EXTENSION_DIR = path.join(process.cwd(), 'extension');
const EXTENSION_PACKAGE_PATH = path.join(EXTENSION_DIR, 'package.json');
const RELEASE_TOOLS_VENV = path.join(os.tmpdir(), 'persona-counsel-release-tools-venv');
const LEGACY_RELEASE_TOOLS_VENV = '.release-tools-venv';

const ANSI = {
  reset: '\u001b[0m',
  dim: '\u001b[2m',
  cyan: '\u001b[36m',
  green: '\u001b[32m',
};

class StepError extends Error {
  constructor(message, exitCode = 1) {
    super(message);
    this.exitCode = exitCode;
  }
}

const color = (value, tone) => (USE_COLOR ? `${ANSI[tone]}${value}${ANSI.reset}` : value);
const fmtVersion = (version) => color(version, 'cyan');
const fmtNextVersion = (version) => color(version, 'green');
const fmtHint = (value) => color(value, 'dim');

const cleanupLegacyReleaseVenv = () => {
  if (!existsSync(LEGACY_RELEASE_TOOLS_VENV)) {
    return;
  }
  try {
    rmSync(LEGACY_RELEASE_TOOLS_VENV, { recursive: true, force: true });
    console.log(`\n> Cleanup: removed legacy ${LEGACY_RELEASE_TOOLS_VENV}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`\n! Cleanup warning: could not remove ${LEGACY_RELEASE_TOOLS_VENV}: ${message}`);
  }
};

const runStep = (label, command, args, options = {}) => {
  console.log(`\n> ${label}`);
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  });
  if (result.status !== 0) {
    throw new StepError(`${label} failed`, result.status ?? 1);
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

const getVenvPythonPath = () =>
  process.platform === 'win32'
    ? path.join(RELEASE_TOOLS_VENV, 'Scripts', 'python.exe')
    : path.join(RELEASE_TOOLS_VENV, 'bin', 'python');

const readJsonVersion = (filePath) => {
  const raw = readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);
  return String(data.version || '').trim();
};

const readPythonVersion = () => {
  const raw = readFileSync(PYPROJECT_PATH, 'utf8');
  const match = raw.match(/^version\s*=\s*"([^"]+)"\s*$/m);
  if (!match) {
    throw new StepError('Could not read [project].version from pyproject.toml.');
  }
  return match[1];
};

const writePythonVersion = (nextVersion) => {
  const raw = readFileSync(PYPROJECT_PATH, 'utf8');
  const lines = raw.split(/\r?\n/);
  let inProject = false;
  let replaced = false;

  const nextLines = lines.map((line) => {
    const sectionMatch = line.match(/^\s*\[([^\]]+)\]\s*$/);
    if (sectionMatch) {
      inProject = sectionMatch[1] === 'project';
      return line;
    }

    if (inProject && /^\s*version\s*=\s*"[^"]+"\s*$/.test(line)) {
      replaced = true;
      return `version = "${nextVersion}"`;
    }

    return line;
  });

  if (!replaced) {
    throw new StepError('Unable to update [project].version in pyproject.toml.');
  }

  writeFileSync(PYPROJECT_PATH, `${nextLines.join('\n')}\n`, 'utf8');
};

const setExtensionVersion = (nextVersion) => {
  runStep(
    `Sync extension version to ${nextVersion}`,
    'npm',
    ['version', nextVersion, '--no-git-tag-version', '--allow-same-version'],
    { cwd: EXTENSION_DIR },
  );
};

const parsePythonPrereleaseVersion = (version) => {
  const match = String(version).match(/^(\d+)\.(\d+)\.(\d+)(a|b|rc)(\d+)$/i);
  if (!match) {
    return null;
  }
  const marker = match[4].toLowerCase();
  const label = marker === 'a' ? 'alpha' : marker === 'b' ? 'beta' : 'rc';
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    label,
    prerelease: Number(match[5]),
  };
};

const parseVsCodePrereleaseVersion = (version) => {
  const match = String(version).match(/^(\d+)\.(\d+)\.(\d+)-(alpha|beta|rc)\.(\d+)$/i);
  if (!match) {
    return null;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    label: match[4].toLowerCase(),
    prerelease: Number(match[5]),
  };
};

const makePythonPrereleaseVersion = ({ major, minor, patch, label, prerelease }) => {
  const marker = label === 'alpha' ? 'a' : label === 'beta' ? 'b' : 'rc';
  return `${major}.${minor}.${patch}${marker}${prerelease}`;
};

const makeVsCodePrereleaseVersion = ({ major, minor, patch, label, prerelease }) =>
  `${major}.${minor}.${patch}-${label}.${prerelease}`;

const ensureSynchronizedCurrentVersions = (pythonVersion, vscodeVersion) => {
  const py = parsePythonPrereleaseVersion(pythonVersion);
  const vs = parseVsCodePrereleaseVersion(vscodeVersion);

  if (!py || !vs) {
    throw new StepError(
      `Unsupported prerelease format for synchronized release:\n` +
      `- pyproject.toml version: ${pythonVersion}\n` +
      `- extension/package.json version: ${vscodeVersion}\n` +
      'Expected formats: X.Y.ZaN / X.Y.ZbN / X.Y.ZrcN and X.Y.Z-alpha.N / X.Y.Z-beta.N / X.Y.Z-rc.N',
    );
  }

  if (
    py.major !== vs.major ||
    py.minor !== vs.minor ||
    py.patch !== vs.patch ||
    py.label !== vs.label ||
    py.prerelease !== vs.prerelease
  ) {
    throw new StepError(
      `Version mismatch between Python and extension:\n` +
      `- python: ${pythonVersion}\n` +
      `- vscode: ${vscodeVersion}\n` +
      'These must represent the same prerelease build.',
    );
  }

  return py;
};

const bumpBaseVersion = (parsed, bumpType) => {
  if (bumpType === 'patch') {
    return { ...parsed, patch: parsed.patch + 1, prerelease: 1 };
  }
  if (bumpType === 'minor') {
    return { ...parsed, minor: parsed.minor + 1, patch: 0, prerelease: 1 };
  }
  if (bumpType === 'major') {
    return { ...parsed, major: parsed.major + 1, minor: 0, patch: 0, prerelease: 1 };
  }
  throw new StepError(`Unsupported bump type: ${bumpType}`);
};

const bumpPrereleaseOnly = (parsed) => ({
  ...parsed,
  prerelease: parsed.prerelease + 1,
});

const chooseBumpType = async () => {
  if (!ALLOW_STABLE_RELEASE) {
    const choice = await prompt('Prerelease lock is ON. Increment prerelease number? (y/N)', 'y');
    if (!/^y(es)?$/i.test(choice)) {
      throw new StepError('Release cancelled before version bump.');
    }
    return 'prerelease';
  }

  let bumpType = '';
  while (!bumpType) {
    const choice = await prompt('Select version bump: (p)atch / (m)inor / (M)ajor', 'p');
    const normalized = choice.toLowerCase();
    if (choice === 'M' || normalized === 'major') {
      bumpType = 'major';
    } else if (normalized === 'm' || normalized === 'minor') {
      bumpType = 'minor';
    } else if (normalized === 'p' || normalized === 'patch') {
      bumpType = 'patch';
    } else {
      console.log('Unrecognized choice. Please enter "p", "m", "M", "minor", "major", or press Enter for patch.');
    }
  }
  return bumpType;
};

const defaultBumpType = () => (ALLOW_STABLE_RELEASE ? 'patch' : 'prerelease');

const isPythonPrereleaseVersion = (version) => /(a|b|rc)\d+|\.dev\d+/i.test(version);
const isVsCodePrereleaseVersion = (version) => /-/.test(version);

const enforcePrereleaseOnly = (pythonVersion, vscodeVersion) => {
  if (ALLOW_STABLE_RELEASE) {
    return;
  }
  if (!isPythonPrereleaseVersion(pythonVersion)) {
    throw new StepError(
      `Stable Python version blocked by prerelease lock: ${pythonVersion}. ` +
      'Use a prerelease version (for example 0.1.0a1) or set ALLOW_STABLE_RELEASE=true in scripts/release.mjs.',
    );
  }
  if (!isVsCodePrereleaseVersion(vscodeVersion)) {
    throw new StepError(
      `Stable VS Code extension version blocked by prerelease lock: ${vscodeVersion}. ` +
      'Use a prerelease semver (for example 0.1.0-alpha.1) or set ALLOW_STABLE_RELEASE=true in scripts/release.mjs.',
    );
  }
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

const collectPythonDistFiles = (version) => {
  const distDir = path.join(process.cwd(), 'dist');
  const normalized = String(version).replace(/\./g, '_');
  const files = readdirSync(distDir)
    .filter((name) => name.endsWith('.whl') || name.endsWith('.tar.gz'))
    .filter((name) => name.includes(normalized))
    .map((name) => path.join('dist', name));
  if (files.length === 0) {
    throw new StepError(`No Python distribution files found under dist/ for version ${version}.`);
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

const rollbackVersions = (rollbackState) => {
  if (!rollbackState) {
    return;
  }
  console.log('\n> Rolling back local versions after failure');
  writePythonVersion(rollbackState.pythonVersion);
  setExtensionVersion(rollbackState.vscodeVersion);
  console.log(
    `✓ Rolled back to python=${rollbackState.pythonVersion} and vscode=${rollbackState.vscodeVersion}`,
  );
};

const main = async () => {
  const isDryRun = process.argv.slice(2).includes('--dry-run');
  let releasePython = 'python3';
  let rollbackState = null;

  try {
    const currentPythonVersion = readPythonVersion();
    const currentExtensionVersion = readJsonVersion(EXTENSION_PACKAGE_PATH);
    const currentParsed = ensureSynchronizedCurrentVersions(
      currentPythonVersion,
      currentExtensionVersion,
    );

    enforcePrereleaseOnly(currentPythonVersion, currentExtensionVersion);

    const bumpType = isDryRun ? defaultBumpType() : await chooseBumpType();
    const nextParsed = bumpType === 'prerelease'
      ? bumpPrereleaseOnly(currentParsed)
      : bumpBaseVersion(currentParsed, bumpType);
    const nextPythonVersion = makePythonPrereleaseVersion(nextParsed);
    const nextExtensionVersion = makeVsCodePrereleaseVersion(nextParsed);
    const vsixTargets = readVsixTargets();
    const vsixFiles = vsixTargets.map((target) => `extension/persona-counsel-vscode-${target}.vsix`);

    if (isDryRun) {
      console.log('\nRelease dry run plan:');
      console.log(
        `- version bump (${bumpType}): python ${fmtVersion(currentPythonVersion)} -> ${fmtNextVersion(nextPythonVersion)}, ` +
        `vscode ${fmtVersion(currentExtensionVersion)} -> ${fmtNextVersion(nextExtensionVersion)}`,
      );
      console.log(`- python package: persona-counsel@${fmtNextVersion(nextPythonVersion)} -> ${PYTHON_REPOSITORY}`);
      console.log(`- vscode extension: persona-counsel-vscode@${fmtNextVersion(nextExtensionVersion)} -> VS Code Marketplace`);
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

    const confirm = await prompt(
      `Publish synchronized release ${nextPythonVersion} / ${nextExtensionVersion}? (y/N)`,
      'n',
    );
    if (!/^y(es)?$/i.test(confirm)) {
      console.log('\nRelease cancelled before version bump.');
      process.exit(0);
    }

    rollbackState = {
      pythonVersion: currentPythonVersion,
      vscodeVersion: currentExtensionVersion,
    };

    writePythonVersion(nextPythonVersion);
    setExtensionVersion(nextExtensionVersion);

    const verifiedPythonVersion = readPythonVersion();
    const verifiedExtensionVersion = readJsonVersion(EXTENSION_PACKAGE_PATH);
    if (verifiedPythonVersion !== nextPythonVersion || verifiedExtensionVersion !== nextExtensionVersion) {
      throw new StepError(
        `Version mismatch after bump. Expected ${nextPythonVersion} / ${nextExtensionVersion}, ` +
        `found ${verifiedPythonVersion} / ${verifiedExtensionVersion}.`,
      );
    }

    if (!SKIP_PYTHON_PUBLISH) {
      releasePython = ensurePythonReleaseTooling();
      runStep('Build Python distribution', releasePython, ['-m', 'build']);
      const distFiles = collectPythonDistFiles(nextPythonVersion);
      runStep('Check Python distribution metadata', releasePython, ['-m', 'twine', 'check', ...distFiles]);
      runStep(
        `Upload Python package to ${PYTHON_REPOSITORY}`,
        releasePython,
        ['-m', 'twine', 'upload', '--repository', PYTHON_REPOSITORY, ...distFiles],
        { env: { ...process.env, [RELEASE_ENV]: '1' } },
      );
    }

    if (!SKIP_VSCODE_PUBLISH) {
      if (!process.env.VSCE_PAT) {
        throw new StepError('Missing VSCE_PAT. Set VSCE_PAT with a VS Code Marketplace PAT before publishing.');
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
  } catch (error) {
    try {
      rollbackVersions(rollbackState);
    } catch (rollbackError) {
      const message = rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
      console.error(`\n✖ Rollback failed: ${message}`);
    }

    const message = error instanceof Error ? error.message : String(error);
    const exitCode = error instanceof StepError ? error.exitCode : 1;
    cleanupLegacyReleaseVenv();
    console.error(`\n✖ ${message}`);
    process.exit(exitCode);
  }
};

main();
