module.exports = async context => {
  if (context.electronPlatformName !== 'win32') return;
  const { pathToFileURL } = require('node:url');
  const path = require('node:path');
  const { slimPackagedResources } = await import(pathToFileURL(path.join(context.packager.projectDir, 'scripts/slim_electron_resources.mjs')).href);
  await slimPackagedResources(context.appOutDir, context.packager.projectDir);
};
