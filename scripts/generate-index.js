import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const toolsDir = path.resolve(__dirname, '../src/tools');
const docsDir = path.resolve(__dirname, '../docs');
const tools = fs.readdirSync(toolsDir).filter(file => fs.statSync(path.join(toolsDir, file)).isDirectory());

const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tool List</title>
</head>
<body>
  <h1>Tool List</h1>
  <ul>
    ${tools.map(tool => `<li><a href="./${tool}/">${tool}</a></li>`).join('')}
  </ul>
</body>
</html>
`;

if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir);
}

fs.writeFileSync(path.join(docsDir, 'index.html'), html);

console.log('index.html generated successfully!');