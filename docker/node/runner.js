const fs = require('fs');
const path = require('path');
const { VM } = require('vm2');

const codeDir = '/app/code';
const EXECUTION_TIMEOUT = 5000; // 5 seconds

/**
 * Main execution function
 * Runs JavaScript code in isolated VM2 sandbox
 */
function main() {
  try {
    // Verify code directory exists
    if (!fs.existsSync(codeDir)) {
      console.error('Code directory not found');
      process.exit(1);
    }

    // Find JavaScript file to execute
    const files = fs.readdirSync(codeDir);
    const jsFiles = files.filter(f => f.endsWith('.js'));
    
    if (jsFiles.length === 0) {
      console.error('No JavaScript file found');
      process.exit(1);
    }

    // Read code from file
    const codeFile = path.join(codeDir, jsFiles[0]);
    const code = fs.readFileSync(codeFile, 'utf8');

    // Create isolated VM with timeout and console access
    const vm = new VM({
      timeout: EXECUTION_TIMEOUT,
      sandbox: {
        console: console
      }
    });

    // Execute code in sandbox
    vm.run(code);

  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();