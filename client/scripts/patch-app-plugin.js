import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const target = path.join(__dirname, '..', 'node_modules', '@capacitor', 'app', 'ios', 'Sources', 'AppPlugin', 'AppPlugin.swift');

if (fs.existsSync(target)) {
  let content = fs.readFileSync(target, 'utf8');
  if (content.includes('call.reject("Unable to get App Info")')) {
    content = content.replace('call.reject("Unable to get App Info")', 'call.resolve([:])');
    fs.writeFileSync(target, content, 'utf8');
    console.log('Successfully patched AppPlugin.swift for iOS compilation');
  } else {
    console.log('AppPlugin.swift already patched or pattern not found');
  }
} else {
  console.log('AppPlugin.swift does not exist at:', target);
}
