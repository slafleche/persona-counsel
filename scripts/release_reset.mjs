import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const RELEASE_STATE_PATH = path.join(ROOT, '.release-state.local.json');
const RELEASE_LATEST_PATH = path.join(ROOT, 'releases', 'latest.json');
const PYPROJECT_PATH = path.join(ROOT, 'pyproject.toml');
const EXTENSION_PACKAGE_PATH = path.join(ROOT, 'extension', 'package.json');

const readJson = (filePath) => JSON.parse(readFileSync(filePath, 'utf8'));

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
    throw new Error('Could not update [project].version in pyproject.toml.');
  }

  const normalized = `${nextLines.join('\n')}\n`.replace(/\n+$/g, '\n');
  writeFileSync(PYPROJECT_PATH, normalized, 'utf8');
};

const writeExtensionVersion = (nextVersion) => {
  const pkg = readJson(EXTENSION_PACKAGE_PATH);
  pkg.version = nextVersion;
  writeFileSync(EXTENSION_PACKAGE_PATH, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
};

const currentVersions = () => {
  const pyRaw = readFileSync(PYPROJECT_PATH, 'utf8');
  const pyMatch = pyRaw.match(/^version\s*=\s*"([^"]+)"\s*$/m);
  if (!pyMatch) {
    throw new Error('Could not read pyproject version.');
  }
  const ext = readJson(EXTENSION_PACKAGE_PATH);
  return { pythonVersion: pyMatch[1], vscodeVersion: String(ext.version || '').trim() };
};

const main = () => {
  const before = currentVersions();
  let target = null;

  if (existsSync(RELEASE_LATEST_PATH)) {
    const latest = readJson(RELEASE_LATEST_PATH);
    if (typeof latest.pythonVersion === 'string' && typeof latest.vscodeVersion === 'string') {
      target = {
        pythonVersion: latest.pythonVersion,
        vscodeVersion: latest.vscodeVersion,
      };
    }
  }

  if (target) {
    writePythonVersion(target.pythonVersion);
    writeExtensionVersion(target.vscodeVersion);
    console.log(
      `release-reset: versions reset to latest published pair: python=${target.pythonVersion}, vscode=${target.vscodeVersion}`,
    );
  } else {
    console.log(
      'release-reset: releases/latest.json not found; versions left unchanged.',
    );
  }

  if (existsSync(RELEASE_STATE_PATH)) {
    unlinkSync(RELEASE_STATE_PATH);
    console.log('release-reset: removed .release-state.local.json');
  } else {
    console.log('release-reset: no .release-state.local.json to remove');
  }

  const after = currentVersions();
  console.log(
    `release-reset: current versions: python=${after.pythonVersion}, vscode=${after.vscodeVersion}`,
  );
  if (
    before.pythonVersion === after.pythonVersion
    && before.vscodeVersion === after.vscodeVersion
    && !target
  ) {
    console.log('release-reset: nothing changed.');
  }
};

main();
