const path = require('node:path');
const { pathToFileURL } = require('node:url');

const viteArgsByLifecycleEvent = {
  dev: [],
  build: ['build'],
  preview: ['preview'],
};

async function main() {
  const packageJsonPath = process.env.npm_package_json;

  if (!packageJsonPath) {
    throw new Error('npm_package_json is not set. Run this file through an npm script.');
  }

  const projectRoot = path.dirname(packageJsonPath);
  const viteEntry = path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');
  const lifecycleEvent = process.env.npm_lifecycle_event;
  const viteArgs = viteArgsByLifecycleEvent[lifecycleEvent] ?? [];

  process.chdir(projectRoot);
  process.argv = [process.argv[0], viteEntry, ...viteArgs];

  await import(pathToFileURL(viteEntry).href);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
