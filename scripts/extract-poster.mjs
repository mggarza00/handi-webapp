#!/usr/bin/env node
// Extract the last frame of the homepage demo video to use as poster
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import ffmpegPath from 'ffmpeg-static';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const root = path.resolve(__dirname, '..');
const input = path.join(root, 'public', 'video', 'Video Demo Handi.mp4');
const outputDir = path.join(root, 'public', 'images');
const output = path.join(outputDir, 'poster.png');

if (!ffmpegPath) {
  console.error('ffmpeg-static not found. Please install it as a dependency.');
  process.exit(1);
}

if (!fs.existsSync(input)) {
  console.error('Input video not found:', input);
  process.exit(1);
}

fs.mkdirSync(outputDir, { recursive: true });

// Use -sseof -0.1 to grab the last frame. -y to overwrite.
const args = ['-y', '-sseof', '-0.1', '-i', input, '-frames:v', '1', '-q:v', '2', output];

console.log('Extracting last frame to', output);
const child = spawn(ffmpegPath, args, { stdio: 'inherit' });

child.on('exit', (code) => {
  if (code === 0) {
    console.log('Poster generated:', output);
  } else {
    console.error('ffmpeg exited with code', code);
    process.exit(code || 1);
  }
});

