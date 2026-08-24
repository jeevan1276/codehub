const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const isDev = process.argv.includes('--dev');
const outdir = 'dist';

// Ensure outdir exists
if (!fs.existsSync(outdir)) {
  fs.mkdirSync(outdir, { recursive: true });
}

// Ensure icons folder exists in outdir
const iconsOutdir = path.join(outdir, 'icons');
if (!fs.existsSync(iconsOutdir)) {
  fs.mkdirSync(iconsOutdir, { recursive: true });
}

// Background script needs to be ESM for MV3 type: module, or we can just make it IIFE and remove type: module from manifest.
// Let's use IIFE for everything and remove type: module from manifest. It's safer for MV3 and bundle size.
const buildOptions = {
  entryPoints: [
    'background.js',
    'content-codeforces.js',
    'content-atcoder.js',
    'content-leetcode.js',
    'content-leetcode-bridge.js',
    'popup.js',
    'options.js'
  ],
  bundle: true,
  outdir: outdir,
  minify: !isDev,
  sourcemap: isDev,
  target: ['es2020'],
  format: 'iife'
};

// Copy static assets
function copyAssets() {
  const assets = [
    'manifest.json',
    'popup.html',
    'popup.css',
    'options.html',
    'options.css'
  ];

  for (const asset of assets) {
    if (fs.existsSync(asset)) {
      fs.copyFileSync(asset, path.join(outdir, asset));
    }
  }

  // Copy icons
  if (fs.existsSync('icons')) {
    const icons = fs.readdirSync('icons');
    for (const icon of icons) {
      fs.copyFileSync(path.join('icons', icon), path.join(outdir, 'icons', icon));
    }
  }
}

async function build() {
  try {
    await esbuild.build(buildOptions);
    copyAssets();
    console.log('Build completed successfully.');
  } catch (err) {
    console.error('Build failed:', err);
    process.exit(1);
  }
}

build();
