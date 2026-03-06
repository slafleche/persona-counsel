import { readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import readline from 'node:readline';

const DIST_TAG = 'latest';
const RELEASE_ENV = 'PERSONA_COUNSEL_RELEASE';
const PACKAGES = [
  { name: 'persona-counsel', dir: 'packages/persona-counsel' },
  { name: 'counsel-cli', dir: 'packages/counsel-cli' },
  { name: '@persona-counsel/core', dir: 'packages/core' },
];

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

const ensureNpmLogin = () => {
  const result = spawnSync('npm', ['whoami'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    console.error(
      '\n✖ Unable to determine npm user (`npm whoami` failed). ' +
        'Run `npm login` and re-run this release script.',
    );
    process.exit(result.status ?? 1);
  }
};

const readPackageVersion = (packageDir) => {
  const pkgPath = path.join(process.cwd(), packageDir, 'package.json');
  const raw = readFileSync(pkgPath, 'utf8');
  const pkg = JSON.parse(raw);
  return pkg.version;
};

const versions = new Set(PACKAGES.map((pkg) => readPackageVersion(pkg.dir)));
if (versions.size !== 1) {
  console.error(
    '\n✖ Package versions are not aligned. Set all package versions equal before release.',
  );
  process.exit(1);
}
const releaseVersion = [...versions][0];

const publishOne = (pkg) => {
  const packagePath = `./${pkg.dir}`;
  runStep(
    `Publishing ${pkg.name}@${releaseVersion}`,
    'npm',
    ['publish', packagePath, '--access', 'public', '--tag', DIST_TAG],
    { env: { ...process.env, [RELEASE_ENV]: '1' } },
  );
};

const main = async () => {
  const isDryRun = process.argv.slice(2).includes('--dry-run');

  ensureNpmLogin();

  if (isDryRun) {
    console.log(
      `\nDry run: would publish ${PACKAGES.map((pkg) => `${pkg.name}@${releaseVersion}`).join(', ')} with dist-tag "${DIST_TAG}".`,
    );
    process.exit(0);
  }

  const confirm = await prompt(
    `Publish ${PACKAGES.length} packages at version ${releaseVersion} to npm? (y/N)`,
    'n',
  );
  if (!/^y(es)?$/i.test(confirm)) {
    console.log('\nRelease cancelled before publishing.');
    process.exit(0);
  }

  PACKAGES.forEach(publishOne);
  console.log('\n✓ Published all namespace packages.');
};

main().catch((error) => {
  console.error('Unexpected release script error:', error);
  process.exit(1);
});
