import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import readline from 'node:readline';

const SKIP_PYTHON_PUBLISH = process.env.SKIP_PYTHON_PUBLISH === '1';
const SKIP_VSCODE_PUBLISH = process.env.SKIP_VSCODE_PUBLISH === '1';
const BUILD_LOCAL_BACKEND = process.env.BUILD_LOCAL_BACKEND === '1';
const RUN_POST_RELEASE_VERIFY = process.env.RUN_POST_RELEASE_VERIFY !== '0';
const RECONCILE_VSCODE_ON_VERSION_MATCH = process.env.RECONCILE_VSCODE_ON_VERSION_MATCH !== '0';
const RELEASE_ENV = 'PERSONA_COUNSEL_RELEASE';
const ALLOW_STABLE_RELEASE = false;
const EXPECTED_PYTHON_REPOSITORY = ALLOW_STABLE_RELEASE ? 'pypi' : 'testpypi';
const PYTHON_REPOSITORY = process.env.PYTHON_REPOSITORY || EXPECTED_PYTHON_REPOSITORY;
const VSCE_PUBLISH_PRE_RELEASE = !ALLOW_STABLE_RELEASE;
const STABLE_SIGNING_REQUIRED_ENV = [
  'APPLE_CODESIGN_IDENTITY',
  'APPLE_NOTARY_KEYCHAIN_PROFILE',
];
const USE_COLOR = process.stdout.isTTY && process.env.NO_COLOR !== '1';
const PYPROJECT_PATH = path.join(process.cwd(), 'pyproject.toml');
const EXTENSION_DIR = path.join(process.cwd(), 'extension');
const EXTENSION_PACKAGE_PATH = path.join(EXTENSION_DIR, 'package.json');
const RELEASE_STATE_PATH = path.join(process.cwd(), '.release-state.local.json');
const RELEASE_LEDGER_DIR = path.join(process.cwd(), 'releases');
const RELEASE_LEDGER_PATH = path.join(RELEASE_LEDGER_DIR, 'history.jsonl');
const RELEASE_LATEST_PATH = path.join(RELEASE_LEDGER_DIR, 'latest.json');
const RELEASE_TOOLS_VENV = path.join(os.tmpdir(), 'persona-counsel-release-tools-venv');
const LEGACY_RELEASE_TOOLS_VENV = '.release-tools-venv';

const ANSI = {
  reset: '\u001b[0m',
  dim: '\u001b[2m',
  cyan: '\u001b[36m',
  green: '\u001b[32m',
  red: '\u001b[31m',
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

const formatPromptQuestion = (question, defaultValue = '') => {
  const normalizedDefault = String(defaultValue || '').toLowerCase();
  const isYesNo = normalizedDefault === 'y' || normalizedDefault === 'n';
  if (!isYesNo || !USE_COLOR) {
    return question;
  }

  const yesTone = normalizedDefault === 'y' ? 'green' : 'red';
  const noTone = normalizedDefault === 'n' ? 'green' : 'red';
  const yes = color('y', yesTone);
  const no = color('N', noTone);

  return question.replace(/\(y\/N\)/g, `(${yes}/${no})`);
};

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

const runGit = (args) => spawnSync('git', args, {
  encoding: 'utf8',
  shell: process.platform === 'win32',
});

const ensureCleanRepoOrThrow = () => {
  const status = runGit(['status', '--porcelain']);
  if (status.status !== 0) {
    const message = status.stderr?.trim() || 'Unable to read git status.';
    throw new StepError(`Could not verify clean git working tree: ${message}`);
  }
  const output = (status.stdout || '').trim();
  if (output.length > 0) {
    throw new StepError(
      'Release requires a clean repository (no staged, unstaged, or untracked files).',
    );
  }
};

const getCurrentHeadSha = () => {
  const result = runGit(['rev-parse', 'HEAD']);
  if (result.status !== 0) {
    const message = result.stderr?.trim() || 'Unable to resolve HEAD.';
    throw new StepError(`Could not resolve current git HEAD: ${message}`);
  }
  return (result.stdout || '').trim();
};

const ensureReleaseTag = (canonicalVersion, expectedHeadSha) => {
  const tagName = `release/${canonicalVersion}`;
  const ref = `refs/tags/${tagName}`;
  const exists = runGit(['show-ref', '--verify', '--quiet', ref]).status === 0;

  if (!exists) {
    const create = runGit(['tag', tagName]);
    if (create.status !== 0) {
      const message = create.stderr?.trim() || `Could not create tag ${tagName}.`;
      throw new StepError(message);
    }
    return { tagName, created: true };
  }

  const tagShaResult = runGit(['rev-list', '-n', '1', tagName]);
  if (tagShaResult.status !== 0) {
    const message = tagShaResult.stderr?.trim() || `Could not resolve existing tag ${tagName}.`;
    throw new StepError(message);
  }
  const tagSha = (tagShaResult.stdout || '').trim();
  if (tagSha !== expectedHeadSha) {
    throw new StepError(
      `Release tag ${tagName} already exists on ${tagSha}, not current HEAD ${expectedHeadSha}.`,
    );
  }
  return { tagName, created: false };
};

const prompt = (question, defaultValue = '') =>
  new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const renderedQuestion = formatPromptQuestion(question, defaultValue);
    rl.question(`${renderedQuestion} `, (answer) => {
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

const readExtensionIdentity = () => {
  const raw = readFileSync(EXTENSION_PACKAGE_PATH, 'utf8');
  const data = JSON.parse(raw);
  const publisher = String(data.publisher || '').trim();
  const name = String(data.name || '').trim();
  if (!publisher || !name) {
    throw new StepError('Missing publisher/name in extension/package.json.');
  }
  return `${publisher}.${name}`;
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

  const normalized = `${nextLines.join('\n')}\n`.replace(/\n+$/g, '\n');
  writeFileSync(PYPROJECT_PATH, normalized, 'utf8');
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

const parseVsCodeStableVersion = (version) => {
  const match = String(version).match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    return null;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
};

const makePythonPrereleaseVersion = ({ major, minor, patch, label, prerelease }) => {
  const marker = label === 'alpha' ? 'a' : label === 'beta' ? 'b' : 'rc';
  return `${major}.${minor}.${patch}${marker}${prerelease}`;
};

const makeVsCodePrereleaseVersion = ({ major, minor, patch, label, prerelease }) =>
  `${major}.${minor}.${patch}-${label}.${prerelease}`;

const makeVsCodeMarketplacePrereleaseVersion = ({ major, minor, prerelease }) =>
  `${major}.${minor}.${prerelease}`;

const makeCanonicalPrereleaseVersion = ({ major, minor, patch, label, prerelease }) =>
  `${major}.${minor}.${patch}-${label}.${prerelease}`;

const parseCanonicalPrereleaseVersion = (version) => {
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

const readReleaseState = () => {
  if (!existsSync(RELEASE_STATE_PATH)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(RELEASE_STATE_PATH, 'utf8'));
    if (
      !parsed
      || typeof parsed !== 'object'
      || typeof parsed.canonicalVersion !== 'string'
      || typeof parsed.pythonVersion !== 'string'
      || typeof parsed.vscodeVersion !== 'string'
      || typeof parsed.status !== 'string'
    ) {
      throw new StepError(`Invalid release state format in ${RELEASE_STATE_PATH}.`);
    }

    if (!parseCanonicalPrereleaseVersion(parsed.canonicalVersion)) {
      throw new StepError(
        `Invalid canonicalVersion in ${RELEASE_STATE_PATH}: ${parsed.canonicalVersion}`,
      );
    }

    if (
      parsed.vsixTargets !== undefined
      && (
        !Array.isArray(parsed.vsixTargets)
        || parsed.vsixTargets.some((value) => typeof value !== 'string')
      )
    ) {
      throw new StepError(`Invalid vsixTargets in ${RELEASE_STATE_PATH}.`);
    }

    return parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new StepError(`Could not read release state ${RELEASE_STATE_PATH}: ${message}`);
  }
};

const writeReleaseState = (state) => {
  writeFileSync(RELEASE_STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
};

const isActiveReleaseState = (state) => state?.status === 'in_progress' || state?.status === 'failed';

const targetChannelKey = (target) => `vscode_${String(target).replace(/[^a-zA-Z0-9]+/g, '_')}`;
const getChannelStatus = (state, key) => state?.channels?.[key] || 'pending';
const deriveVsixTargetsFromState = (state) => (
  Object.keys(state?.channels || {})
    .filter((key) => key.startsWith('vscode_'))
    .map((key) => key.slice('vscode_'.length).replace(/_/g, '-'))
);

const buildReleaseState = ({
  canonicalVersion,
  pythonVersion,
  vscodeVersion,
  vsixTargets,
}) => {
  const channels = {};
  channels.python = SKIP_PYTHON_PUBLISH ? 'skipped' : 'pending';
  for (const target of vsixTargets) {
    channels[targetChannelKey(target)] = SKIP_VSCODE_PUBLISH ? 'skipped' : 'pending';
  }
  return {
    canonicalVersion,
    pythonVersion,
    vscodeVersion,
    vsixTargets,
    status: 'in_progress',
    channels,
    lastError: '',
    updatedAt: new Date().toISOString(),
  };
};

const markChannel = (state, key, value) => {
  state.channels = state.channels || {};
  state.channels[key] = value;
  state.updatedAt = new Date().toISOString();
  writeReleaseState(state);
};

const ensureSynchronizedCurrentVersions = (pythonVersion, vscodeVersion) => {
  const py = parsePythonPrereleaseVersion(pythonVersion);
  const vsPrerelease = parseVsCodePrereleaseVersion(vscodeVersion);
  const vsStable = parseVsCodeStableVersion(vscodeVersion);

  if (!py || (!vsPrerelease && !vsStable)) {
    throw new StepError(
      `Unsupported prerelease format for synchronized release:\n` +
      `- pyproject.toml version: ${pythonVersion}\n` +
      `- extension/package.json version: ${vscodeVersion}\n` +
      'Expected formats: X.Y.ZaN / X.Y.ZbN / X.Y.ZrcN and one of:\n' +
      '- X.Y.Z-alpha.N / X.Y.Z-beta.N / X.Y.Z-rc.N (legacy)\n' +
      '- X.Y.N (Marketplace prerelease-compatible)',
    );
  }

  if (vsPrerelease) {
    if (
      py.major !== vsPrerelease.major ||
      py.minor !== vsPrerelease.minor ||
      py.patch !== vsPrerelease.patch ||
      py.label !== vsPrerelease.label ||
      py.prerelease !== vsPrerelease.prerelease
    ) {
      throw new StepError(
        `Version mismatch between Python and extension:\n` +
        `- python: ${pythonVersion}\n` +
        `- vscode: ${vscodeVersion}\n` +
        'These must represent the same prerelease build.',
      );
    }
  } else if (vsStable) {
    if (
      py.major !== vsStable.major ||
      py.minor !== vsStable.minor ||
      py.prerelease !== vsStable.patch
    ) {
      throw new StepError(
        `Version mismatch between Python and extension:\n` +
        `- python: ${pythonVersion}\n` +
        `- vscode: ${vscodeVersion}\n` +
        'Expected extension patch number to match Python prerelease number (X.Y.N).',
      );
    }
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
  if (!parseVsCodePrereleaseVersion(vscodeVersion) && !parseVsCodeStableVersion(vscodeVersion)) {
    throw new StepError(
      `Stable VS Code extension version blocked by prerelease lock: ${vscodeVersion}. ` +
      'Use a prerelease-compatible version (legacy X.Y.Z-alpha.N or Marketplace-compatible X.Y.N), or set ALLOW_STABLE_RELEASE=true in scripts/release.mjs.',
    );
  }
};

const enforceStableSigningGuardrails = () => {
  if (!ALLOW_STABLE_RELEASE) {
    return;
  }

  const missing = STABLE_SIGNING_REQUIRED_ENV.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    throw new StepError(
      `Stable release requires signing/notarization env vars: ${missing.join(', ')}.`,
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
  const rawVersion = String(version).trim();
  const escapedVersion = rawVersion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const versionPattern = new RegExp(`-${escapedVersion}(?:[-+.]|\\.tar\\.gz|\\.whl)`);
  const files = readdirSync(distDir)
    .filter((name) => name.endsWith('.whl') || name.endsWith('.tar.gz'))
    .filter((name) => versionPattern.test(name))
    .map((name) => path.join('dist', name));
  if (files.length === 0) {
    throw new StepError(`No Python distribution files found under dist/ for version ${version}.`);
  }
  return files;
};

const backendBinaryFilenameForTarget = (target) => (
  String(target).startsWith('win32-') ? 'counsel.exe' : 'counsel'
);

const hasLocalBackendArtifact = (target) => {
  const filename = backendBinaryFilenameForTarget(target);
  const artifactPath = path.join(
    process.cwd(),
    'build',
    'vscode-backend-artifacts',
    target,
    filename,
  );
  return existsSync(artifactPath);
};

const getMissingBackendTargets = ({ targets, allowBuildLocal }) => {
  const localBuildTarget = allowBuildLocal ? detectLocalVsixTarget() : '';
  return (targets || []).filter((target) => {
    if (target === localBuildTarget) {
      return false;
    }
    return !hasLocalBackendArtifact(target);
  });
};

const detectLocalVsixTarget = () => {
  const arch = process.arch;
  if (process.platform === 'darwin' && (arch === 'arm64' || arch === 'x64')) {
    return `darwin-${arch}`;
  }
  if (process.platform === 'linux' && arch === 'x64') {
    return 'linux-x64';
  }
  if (process.platform === 'win32' && arch === 'x64') {
    return 'win32-x64';
  }
  return '';
};

const ensureVsixArtifactsReady = ({ targets, allowBuildLocal }) => {
  if (!targets || targets.length === 0) {
    return;
  }

  const localBuildTarget = allowBuildLocal ? detectLocalVsixTarget() : '';
  const missingTargets = getMissingBackendTargets({ targets, allowBuildLocal });

  if (missingTargets.length > 0) {
    const lines = [
      'Missing backend targets before release publish:',
      ...missingTargets.map((target) => `  - ${target}`),
      '',
      'Expected layout:',
      '  build/vscode-backend-artifacts/<platform>-<arch>/counsel(.exe)',
    ];
    if (allowBuildLocal && localBuildTarget) {
      lines.push('', `Note: BUILD_LOCAL_BACKEND=1 can build local target ${localBuildTarget}.`);
    }
    throw new StepError(lines.join('\n'));
  }
};

const releaseModeLabel = () => {
  if (!SKIP_PYTHON_PUBLISH && !SKIP_VSCODE_PUBLISH) {
    return 'full';
  }
  if (!SKIP_PYTHON_PUBLISH && SKIP_VSCODE_PUBLISH) {
    return 'python-only';
  }
  if (SKIP_PYTHON_PUBLISH && !SKIP_VSCODE_PUBLISH) {
    return 'vscode-only';
  }
  return 'dry-channels';
};

const appendReleaseLedger = ({
  canonicalVersion,
  pythonVersion,
  vscodeVersion,
  channels,
  vsixTargets,
}) => {
  mkdirSync(RELEASE_LEDGER_DIR, { recursive: true });
  const entry = {
    canonicalVersion,
    pythonVersion,
    vscodeVersion,
    mode: releaseModeLabel(),
    vsixTargets,
    channels,
    commit: getCurrentHeadSha(),
    timestamp: new Date().toISOString(),
  };
  appendFileSync(RELEASE_LEDGER_PATH, `${JSON.stringify(entry)}\n`, 'utf8');
};

const writeReleaseLatest = ({
  canonicalVersion,
  pythonVersion,
  vscodeVersion,
  channels,
  vsixTargets,
  tagName,
  commit,
}) => {
  mkdirSync(RELEASE_LEDGER_DIR, { recursive: true });
  const payload = {
    canonicalVersion,
    pythonVersion,
    vscodeVersion,
    mode: releaseModeLabel(),
    vsixTargets,
    channels,
    tag: tagName,
    commit,
    timestamp: new Date().toISOString(),
    status: 'published',
  };
  writeFileSync(RELEASE_LATEST_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
};

const hasStagedChanges = () => {
  const staged = runGit(['diff', '--cached', '--name-only']);
  if (staged.status !== 0) {
    const message = staged.stderr?.trim() || 'Unable to inspect staged changes.';
    throw new StepError(message);
  }
  return Boolean((staged.stdout || '').trim());
};

const autoCommitAndPushRelease = ({ canonicalVersion, pythonVersion, vscodeVersion, tagName }) => {
  runStep('Stage release tracking files', 'git', ['add', '-A']);
  if (!hasStagedChanges()) {
    console.log('\n> No new release-tracking git changes to commit.');
  } else {
    const commitMessage = `chore(release): publish ${canonicalVersion} (python ${pythonVersion}, vscode ${vscodeVersion})`;
    runStep('Commit release tracking update', 'git', ['commit', '-m', commitMessage]);
  }
  runStep('Push release commit', 'git', ['push', 'origin', 'HEAD']);
  runStep('Push release tag', 'git', ['push', 'origin', tagName]);
};

const publishVsixToMarketplace = (vsixPath) => {
  const publishArgs = ['--yes', '@vscode/vsce', 'publish', '--packagePath', vsixPath];
  if (VSCE_PUBLISH_PRE_RELEASE) {
    publishArgs.push('--pre-release');
  }
  runStep(
    `Publishing VS Code extension ${path.basename(vsixPath)}`,
    'npx',
    publishArgs,
    { env: { ...process.env, [RELEASE_ENV]: '1' } },
  );
};

const fetchMarketplaceExtensionVersion = (extensionId) => {
  const result = spawnSync('npx', ['--yes', '@vscode/vsce', 'show', extensionId], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim();
    console.warn(
      `\n! Resume reconcile skipped: unable to read marketplace version for ${extensionId}${detail ? ` (${detail.split('\n').pop()})` : ''}`,
    );
    return '';
  }

  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  const match = output.match(/^\s*Version:\s*([^\s]+)\s*$/m);
  return match ? String(match[1]).trim() : '';
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

const printReleasePlan = ({
  bumpType,
  canonicalVersion,
  currentPythonVersion,
  nextPythonVersion,
  currentExtensionVersion,
  nextExtensionVersion,
  pythonRepository,
  vsixTargets,
  pendingVsixTargets,
  runVsixTargets,
  pendingPython,
  pythonChannelStatus,
  finalizedVsixTargets,
  isDryRun,
  isCheckOnly,
  isResuming,
}) => {
  const heading = isDryRun
    ? '\nRelease dry run plan:'
    : (isCheckOnly ? '\nRelease preflight check plan:' : '\nRelease plan:');
  console.log(heading);
  if (isResuming) {
    console.log(`- run mode: ${fmtHint('finalizing existing release (.release-state.local.json)')}`);
  } else {
    console.log(`- run mode: ${fmtHint('creating a new release')}`);
  }
  console.log(`- canonical version: ${fmtNextVersion(canonicalVersion)}`);
  console.log(
    `- version bump (${bumpType}): python ${fmtVersion(currentPythonVersion)} -> ${fmtNextVersion(nextPythonVersion)}, ` +
    `vscode ${fmtVersion(currentExtensionVersion)} -> ${fmtNextVersion(nextExtensionVersion)}`,
  );
  if (isResuming) {
    console.log(`- release state: ${fmtHint('resume reserved version from .release-state.local.json')}`);
  }
  console.log(`- python package: persona-counsel@${fmtNextVersion(nextPythonVersion)} -> ${pythonRepository}`);
  console.log(`- vscode extension: persona-counsel-vscode@${fmtNextVersion(nextExtensionVersion)} -> VS Code Marketplace`);
  console.log(`- vsix targets: ${vsixTargets.join(', ')}`);
  if (isResuming) {
    console.log(`- finalized python channel: ${pythonChannelStatus}`);
    console.log(`- finalized vscode targets: ${finalizedVsixTargets.length > 0 ? finalizedVsixTargets.join(', ') : 'none yet'}`);
    console.log(`- pending python publish: ${pendingPython ? 'yes' : 'no (already successful)'}`);
    console.log(`- pending vscode targets: ${pendingVsixTargets.length > 0 ? pendingVsixTargets.join(', ') : 'none (all already successful)'}`);
    if (!SKIP_VSCODE_PUBLISH && pendingVsixTargets.length > 0) {
      console.log(`- vscode targets this run: ${runVsixTargets.join(', ')}`);
    }
  }
  console.log(
    `- vscode marketplace channel: ${VSCE_PUBLISH_PRE_RELEASE ? 'pre-release (--pre-release)' : 'stable'}`,
  );
  if (BUILD_LOCAL_BACKEND) {
    console.log(`- backend packaging: include local target build (${fmtHint('BUILD_LOCAL_BACKEND=1')})`);
  }
  if (SKIP_PYTHON_PUBLISH) {
    console.log(`- python publishing skipped (${fmtHint('SKIP_PYTHON_PUBLISH=1')})`);
  }
  if (SKIP_VSCODE_PUBLISH) {
    console.log(`- vscode publishing skipped (${fmtHint('SKIP_VSCODE_PUBLISH=1')})`);
  }
  if (!RUN_POST_RELEASE_VERIFY) {
    console.log(`- post-release verification skipped (${fmtHint('RUN_POST_RELEASE_VERIFY=0')})`);
  }
  if (isCheckOnly) {
    console.log(`- execution mode: ${fmtHint('check-only (no version bump, no publish)')}`);
  }
  if (!ALLOW_STABLE_RELEASE) {
    console.log(`- stable release lock: ${fmtHint('ON')} (flip ALLOW_STABLE_RELEASE=true to disable)`);
  } else {
    console.log(
      `- stable release guardrails: signing/notarization required (${STABLE_SIGNING_REQUIRED_ENV.join(', ')})`,
    );
  }
};

const main = async () => {
  const cliArgs = process.argv.slice(2);
  const isDryRun = cliArgs.includes('--dry-run');
  const isCheckOnly = cliArgs.includes('--check-only');
  let releasePython = 'python3';
  let rollbackState = null;
  let releaseState = null;

  try {
    if (PYTHON_REPOSITORY !== EXPECTED_PYTHON_REPOSITORY) {
      throw new StepError(
        `Python repository policy mismatch: ALLOW_STABLE_RELEASE=${ALLOW_STABLE_RELEASE} requires ` +
        `${EXPECTED_PYTHON_REPOSITORY}, but got ${PYTHON_REPOSITORY}.`,
      );
    }

    if (!isDryRun) {
      ensureCleanRepoOrThrow();
    }

    const currentPythonVersion = readPythonVersion();
    const currentExtensionVersion = readJsonVersion(EXTENSION_PACKAGE_PATH);
    const extensionId = readExtensionIdentity();
    const currentParsed = ensureSynchronizedCurrentVersions(
      currentPythonVersion,
      currentExtensionVersion,
    );
    const existingReleaseState = readReleaseState();
    const resumingRelease = isActiveReleaseState(existingReleaseState);

    enforcePrereleaseOnly(currentPythonVersion, currentExtensionVersion);
    enforceStableSigningGuardrails();

    const bumpType = resumingRelease
      ? 'resume'
      : (isDryRun ? defaultBumpType() : await chooseBumpType());

    let nextPythonVersion = '';
    let nextExtensionVersion = '';
    let canonicalVersion = '';
    if (resumingRelease) {
      nextPythonVersion = existingReleaseState.pythonVersion;
      nextExtensionVersion = existingReleaseState.vscodeVersion;
      canonicalVersion = existingReleaseState.canonicalVersion;
      ensureSynchronizedCurrentVersions(nextPythonVersion, nextExtensionVersion);
    } else {
      const nextParsed = bumpType === 'prerelease'
        ? bumpPrereleaseOnly(currentParsed)
        : bumpBaseVersion(currentParsed, bumpType);
      nextPythonVersion = makePythonPrereleaseVersion(nextParsed);
      nextExtensionVersion = ALLOW_STABLE_RELEASE
        ? makeVsCodePrereleaseVersion(nextParsed)
        : makeVsCodeMarketplacePrereleaseVersion(nextParsed);
      canonicalVersion = makeCanonicalPrereleaseVersion(nextParsed);
    }

    const requestedVsixTargets = readVsixTargets();
    const stateVsixTargets = Array.isArray(existingReleaseState?.vsixTargets)
      ? existingReleaseState.vsixTargets
      : deriveVsixTargetsFromState(existingReleaseState);
    const vsixTargets = resumingRelease
      ? (stateVsixTargets && stateVsixTargets.length > 0 ? stateVsixTargets : requestedVsixTargets)
      : requestedVsixTargets;

    if (!isDryRun && !isCheckOnly && !resumingRelease && !SKIP_VSCODE_PUBLISH) {
      let missingBeforePlan = getMissingBackendTargets({
        targets: vsixTargets,
        allowBuildLocal: BUILD_LOCAL_BACKEND,
      });
      if (missingBeforePlan.length > 0) {
        console.log(
          `\n> Backend matrix status before release plan: missing ${missingBeforePlan.join(', ')}`,
        );
        const buildNow = await prompt(
          'Generate local backend artifact now with ./scripts/build_vscode_backend.sh? (y/N)',
          'y',
        );
        if (/^y(es)?$/i.test(buildNow)) {
          runStep('Build local backend artifact', './scripts/build_vscode_backend.sh', []);
          missingBeforePlan = getMissingBackendTargets({
            targets: vsixTargets,
            allowBuildLocal: BUILD_LOCAL_BACKEND,
          });
        }
        if (missingBeforePlan.length > 0) {
          console.log(
            `> Backend matrix still missing before release plan: ${missingBeforePlan.join(', ')}`,
          );
          console.log(
            '> Provide those artifacts under build/vscode-backend-artifacts/<platform>-<arch>/counsel(.exe) before publish.',
          );
        } else {
          console.log('> Backend matrix check before release plan: all selected targets available.');
        }
      }
    }
    releaseState = resumingRelease
      ? {
        ...existingReleaseState,
        vsixTargets,
        status: 'in_progress',
        channels: existingReleaseState.channels || {},
        lastError: '',
        updatedAt: new Date().toISOString(),
      }
      : buildReleaseState({
        canonicalVersion,
        pythonVersion: nextPythonVersion,
        vscodeVersion: nextExtensionVersion,
        vsixTargets,
      });
    const pendingPython = !SKIP_PYTHON_PUBLISH && getChannelStatus(releaseState, 'python') !== 'success';
    let pendingVsixTargets = SKIP_VSCODE_PUBLISH
      ? []
      : vsixTargets.filter((target) => getChannelStatus(releaseState, targetChannelKey(target)) !== 'success');
    if (
      !isDryRun
      && resumingRelease
      && RECONCILE_VSCODE_ON_VERSION_MATCH
      && !SKIP_VSCODE_PUBLISH
      && pendingVsixTargets.length > 0
    ) {
      const marketplaceVersion = fetchMarketplaceExtensionVersion(extensionId);
      if (marketplaceVersion && marketplaceVersion === nextExtensionVersion) {
        console.log(
          `\n> Resume reconcile: marketplace shows ${nextExtensionVersion}; marking pending VS Code targets as successful: ${pendingVsixTargets.join(', ')}`,
        );
        pendingVsixTargets.forEach((target) => {
          markChannel(releaseState, targetChannelKey(target), 'success');
        });
        pendingVsixTargets = [];
      }
    }
    const pythonChannelStatus = getChannelStatus(releaseState, 'python');
    const finalizedVsixTargets = SKIP_VSCODE_PUBLISH
      ? []
      : vsixTargets.filter((target) => getChannelStatus(releaseState, targetChannelKey(target)) === 'success');
    let runVsixTargets = pendingVsixTargets;
    if (
      resumingRelease
      && !SKIP_VSCODE_PUBLISH
      && !process.env.PACKAGE_TARGETS?.trim()
      && pendingVsixTargets.length > 0
    ) {
      const availablePendingTargets = pendingVsixTargets.filter((target) => hasLocalBackendArtifact(target));
      if (availablePendingTargets.length > 0 && availablePendingTargets.length < pendingVsixTargets.length) {
        runVsixTargets = availablePendingTargets;
        console.log(
          `\n> Resume mode: auto-selecting locally available pending VSIX targets: ${runVsixTargets.join(', ')}`,
        );
      }
    }
    const requiredTargets = runVsixTargets.length > 0
      ? (process.env.REQUIRED_TARGETS?.trim() || runVsixTargets.join(' '))
      : '';
    const vsixFiles = runVsixTargets.map((target) => `extension/persona-counsel-vscode-${target}.vsix`);

    printReleasePlan({
      bumpType,
      canonicalVersion,
      currentPythonVersion,
      nextPythonVersion,
      currentExtensionVersion,
      nextExtensionVersion,
      pythonRepository: PYTHON_REPOSITORY,
      vsixTargets,
      pendingVsixTargets,
      runVsixTargets,
      pendingPython,
      pythonChannelStatus,
      finalizedVsixTargets,
      isDryRun,
      isCheckOnly,
      isResuming: resumingRelease,
    });

    if (isDryRun) {
      process.exit(0);
    }

    if (isCheckOnly) {
      if (!SKIP_VSCODE_PUBLISH && pendingVsixTargets.length > 0) {
        ensureVsixArtifactsReady({
          targets: runVsixTargets,
          allowBuildLocal: BUILD_LOCAL_BACKEND,
        });
        if (!process.env.VSCE_PAT) {
          throw new StepError(
            'Preflight failed: missing VSCE_PAT for pending VS Code publish targets.',
          );
        }
      }

      if (!SKIP_PYTHON_PUBLISH && pendingPython) {
        const hasTwinePassword = Boolean(process.env.TWINE_PASSWORD?.trim());
        const hasPypiToken = Boolean(process.env.PYPI_API_TOKEN?.trim());
        if (!hasTwinePassword && !hasPypiToken) {
          throw new StepError(
            'Preflight failed: missing Python publish credentials (set TWINE_PASSWORD or PYPI_API_TOKEN).',
          );
        }
      }

      console.log('\n✓ Release preflight check passed. No changes made.');
      process.exit(0);
    }

    const confirm = await prompt(
      `Publish synchronized release ${fmtNextVersion(nextPythonVersion)} / ${fmtNextVersion(nextExtensionVersion)}? (y/N)`,
      'n',
    );
    if (!/^y(es)?$/i.test(confirm)) {
      console.log('\nRelease cancelled before version bump.');
      process.exit(0);
    }

    if (!SKIP_VSCODE_PUBLISH && pendingVsixTargets.length > 0) {
      ensureVsixArtifactsReady({
        targets: runVsixTargets,
        allowBuildLocal: BUILD_LOCAL_BACKEND,
      });
    }

    rollbackState = {
      pythonVersion: currentPythonVersion,
      vscodeVersion: currentExtensionVersion,
    };
    writeReleaseState(releaseState);

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

    if (pendingPython) {
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
      markChannel(releaseState, 'python', 'success');
    } else if (!SKIP_PYTHON_PUBLISH) {
      console.log('\n> Skipping Python publish (already successful in current release state)');
    }

    if (!SKIP_VSCODE_PUBLISH && pendingVsixTargets.length > 0) {
      if (!process.env.VSCE_PAT) {
        throw new StepError('Missing VSCE_PAT. Set VSCE_PAT with a VS Code Marketplace PAT before publishing.');
      }

      if (runVsixTargets.length === 0) {
        throw new StepError(
          'No pending VSIX targets selected for this run. Set PACKAGE_TARGETS explicitly, or build backend artifacts first.',
        );
      }

      const releaseVsixArgs = BUILD_LOCAL_BACKEND
        ? ['./scripts/release_vscode_extension.sh', '--build-local']
        : ['./scripts/release_vscode_extension.sh'];

      runStep(
        `Package VS Code extension (${runVsixTargets.join(', ')})`,
        releaseVsixArgs[0],
        releaseVsixArgs.slice(1),
        {
          env: {
            ...process.env,
            PACKAGE_TARGETS: runVsixTargets.join(' '),
            REQUIRED_TARGETS: requiredTargets,
            VSCE_PRE_RELEASE: VSCE_PUBLISH_PRE_RELEASE ? '1' : '0',
            [RELEASE_ENV]: '1',
          },
        },
      );

      vsixFiles.forEach((vsixFile, idx) => {
        publishVsixToMarketplace(vsixFile);
        markChannel(releaseState, targetChannelKey(runVsixTargets[idx]), 'success');
      });
    } else if (!SKIP_VSCODE_PUBLISH) {
      console.log('\n> Skipping VS Code publish (all selected targets already successful in current release state)');
    }

    if (RUN_POST_RELEASE_VERIFY && !SKIP_VSCODE_PUBLISH) {
      runStep(
        'Post-release verification',
        './scripts/post_release_verify.sh',
        [],
        {
          env: {
            ...process.env,
            PYTHON_REPOSITORY,
            VERIFY_PYTHON: SKIP_PYTHON_PUBLISH
              ? '0'
              : (getChannelStatus(releaseState, 'python') === 'success' ? '1' : '0'),
            EXTENSION_ID: extensionId,
            [RELEASE_ENV]: '1',
          },
        },
      );
    } else if (RUN_POST_RELEASE_VERIFY) {
      console.log('\n> Post-release verification skipped (VS Code publish step disabled)');
    }

    const requiredChannelKeys = [];
    if (!SKIP_PYTHON_PUBLISH) {
      requiredChannelKeys.push('python');
    }
    if (!SKIP_VSCODE_PUBLISH) {
      requiredChannelKeys.push(...vsixTargets.map((target) => targetChannelKey(target)));
    }

    const allRequiredSuccessful = requiredChannelKeys.every(
      (key) => getChannelStatus(releaseState, key) === 'success',
    );
    if (!allRequiredSuccessful) {
      releaseState.status = 'in_progress';
      releaseState.lastError = '';
      releaseState.updatedAt = new Date().toISOString();
      writeReleaseState(releaseState);
      throw new StepError(
        'Release is not finalized: one or more required channels are still pending.',
      );
    }

    // Publishing is complete at this point; subsequent failures should not roll versions back.
    rollbackState = null;

    const headSha = getCurrentHeadSha();
    const { tagName, created } = ensureReleaseTag(canonicalVersion, headSha);
    appendReleaseLedger({
      canonicalVersion,
      pythonVersion: nextPythonVersion,
      vscodeVersion: nextExtensionVersion,
      channels: releaseState.channels || {},
      vsixTargets,
    });
    writeReleaseLatest({
      canonicalVersion,
      pythonVersion: nextPythonVersion,
      vscodeVersion: nextExtensionVersion,
      channels: releaseState.channels || {},
      vsixTargets,
      tagName,
      commit: headSha,
    });

    releaseState.status = 'complete';
    releaseState.lastError = '';
    releaseState.updatedAt = new Date().toISOString();
    writeReleaseState(releaseState);
    if (existsSync(RELEASE_STATE_PATH)) {
      unlinkSync(RELEASE_STATE_PATH);
    }

    autoCommitAndPushRelease({
      canonicalVersion,
      pythonVersion: nextPythonVersion,
      vscodeVersion: nextExtensionVersion,
      tagName,
    });

    console.log(`\n> Release tag: ${tagName}${created ? ' (created)' : ' (already on HEAD)'}`);
    console.log(`> Ledger: ${path.relative(process.cwd(), RELEASE_LEDGER_PATH)}`);
    console.log(`> Latest: ${path.relative(process.cwd(), RELEASE_LATEST_PATH)}`);

    console.log('\n✓ Release publish flow completed.');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (releaseState) {
      releaseState.status = 'failed';
      releaseState.lastError = message;
      releaseState.updatedAt = new Date().toISOString();
      writeReleaseState(releaseState);
    }

    try {
      rollbackVersions(rollbackState);
    } catch (rollbackError) {
      const message = rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
      console.error(`\n✖ Rollback failed: ${message}`);
    }

    const exitCode = error instanceof StepError ? error.exitCode : 1;
    cleanupLegacyReleaseVenv();
    console.error(`\n✖ ${message}`);
    process.exit(exitCode);
  }
};

main();
