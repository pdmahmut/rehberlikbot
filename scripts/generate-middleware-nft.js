const fs = require('fs');
const path = require('path');

const manifestPath = path.join('.next', 'server', 'middleware-manifest.json');

if (!fs.existsSync(manifestPath)) {
  console.log('No middleware-manifest.json found, skipping NFT generation');
  process.exit(0);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

if (!manifest.middleware || Object.keys(manifest.middleware).length === 0) {
  console.log('No middleware found in manifest, skipping NFT generation');
  process.exit(0);
}

// Collect all files from all middleware entries
const allFiles = Object.values(manifest.middleware)
  .flatMap(m => m.files || [])
  .map(f => f.replace(/^server\//, ''));

const uniqueFiles = [...new Set(allFiles)];

const nftContent = {
  version: 1,
  files: uniqueFiles
};

const nftPath = path.join('.next', 'server', 'middleware.js.nft.json');
fs.writeFileSync(nftPath, JSON.stringify(nftContent));
console.log('Generated', nftPath, 'with', uniqueFiles.length, 'files:', uniqueFiles);
