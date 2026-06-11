const fs = require('fs');
const path = require('path');

const wwwDir = path.join(__dirname, 'www');

console.log('Cleaning www directory...');
if (fs.existsSync(wwwDir)) {
  fs.rmSync(wwwDir, { recursive: true, force: true });
}
fs.mkdirSync(wwwDir);

// Helper to copy recursively
function copyRecursive(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach((child) => {
      copyRecursive(path.join(src, child), path.join(dest, child));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

// Copy top-level static files
const filesToCopy = ['index.html', 'manifest.json', 'sw.js', 'icon-512.png'];
console.log('Copying static files...');
filesToCopy.forEach(f => {
  if (fs.existsSync(f)) {
    fs.copyFileSync(f, path.join(wwwDir, f));
  } else {
    console.warn(`Warning: File ${f} not found!`);
  }
});

// Copy directories
const dirsToCopy = ['css', 'js'];
console.log('Copying resource directories...');
dirsToCopy.forEach(d => {
  if (fs.existsSync(d)) {
    copyRecursive(d, path.join(wwwDir, d));
  } else {
    console.warn(`Warning: Directory ${d} not found!`);
  }
});

console.log('Build completed successfully! Assets ready in www/');
