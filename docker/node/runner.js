const fs = require('fs');
const path = require('path');
const { VM } = require('vm2');

const codeDir = '/app/code';

function main() {
  try {
    if (!fs.existsSync(codeDir)) {
      console.error('Error: Code directory not found');
      process.exit(1);
    }

    const files = fs.readdirSync(codeDir);
    const jsFiles = files.filter(f => f.endsWith('.js'));

    if (jsFiles.length === 0) {
      console.error('Error: No JavaScript file found');
      process.exit(1);
    }

    const codeFile = path.join(codeDir, jsFiles[0]);
    const code = fs.readFileSync(codeFile, 'utf8');

    const vm = new VM({
      timeout: 5000,
      sandbox: {
        console: console
      }
    });

    vm.run(code);

  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();