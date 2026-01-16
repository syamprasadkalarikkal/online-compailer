import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const execPromise = promisify(exec);

const TEMP_DIR = path.join(process.cwd(), 'temp');
const TIMEOUT = 10000;

const languageConfig = {
  python: {
    image: 'python-runner',
    extension: 'py',
    command: (filename) => `python /app/code/${filename}`
  },
  javascript: {
    image: 'node-runner',
    extension: 'js',
    command: (filename) => `node /app/code/${filename}`
  },
  typescript: {
    image: 'node-runner',
    extension: 'ts',
    command: (filename) => `ts-node /app/code/${filename}`
  },
  java: {
    image: 'java-runner',
    extension: 'java',
    command: (filename) => `javac /app/code/${filename} && java -cp /app/code Main`
  },
  cpp: {
    image: 'cpp-runner',
    extension: 'cpp',
    command: (filename) => `g++ -o /app/code/program /app/code/${filename} && /app/code/program`
  },
  c: {
    image: 'cpp-runner',
    extension: 'c',
    command: (filename) => `gcc -o /app/code/program /app/code/${filename} && /app/code/program`
  },
  go: {
    image: 'golang:1.21-alpine',
    extension: 'go',
    command: (filename) => `go run /app/code/${filename}`
  },
  rust: {
    image: 'rust:1.75-alpine',
    extension: 'rs',
    command: (filename) => `rustc /app/code/${filename} -o /app/code/program && /app/code/program`
  },
  php: {
    image: 'php:8.2-cli-alpine',
    extension: 'php',
    command: (filename) => `php /app/code/${filename}`
  }
};

function normalizePath(filepath) {
  let normalized = filepath.replace(/\\/g, '/');
  
  if (process.platform === 'win32' && /^[A-Za-z]:/.test(normalized)) {
    normalized = '/' + normalized.charAt(0).toLowerCase() + normalized.substring(2);
  }
  
  return normalized;
}

function escapeShellCommand(command) {
  return command.replace(/'/g, "'\\''");
}

async function ensureTempDir(language) {
  const langDir = path.join(TEMP_DIR, language);
  try {
    await fs.mkdir(langDir, { recursive: true });
  } catch (error) {
    console.error(`Error creating temp directory: ${error.message}`);
    throw error;
  }
  return langDir;
}

async function writeCodeFile(language, code) {
  const sessionId = crypto.randomUUID();
  const config = languageConfig[language];
  
  if (!config) {
    throw new Error(`Unsupported language: ${language}`);
  }

  const langDir = await ensureTempDir(language);
  const filename = language === 'java' ? 'Main.java' : `code_${sessionId}.${config.extension}`;
  const filepath = path.join(langDir, filename);

  await fs.writeFile(filepath, code, 'utf8');
  
  return { filepath, filename, sessionId };
}

async function cleanupFile(filepath) {
  try {
    await fs.unlink(filepath);
    
    const dir = path.dirname(filepath);
    const ext = path.extname(filepath);
    
    if (ext === '.cpp' || ext === '.c') {
      try {
        await fs.unlink(path.join(dir, 'program'));
      } catch {}
    }
    
    if (ext === '.java') {
      try {
        await fs.unlink(path.join(dir, 'Main.class'));
      } catch {}
    }
  } catch (error) {
    console.error(`Error cleaning up file: ${error.message}`);
  }
}

// NEW: Execute with stdin support using spawn
async function executeInDockerWithInput(language, code, stdin = '') {
  const startTime = Date.now();
  let filepath = null;

  try {
    const { filepath: tempFilepath, filename } = await writeCodeFile(language, code);
    filepath = tempFilepath;

    const config = languageConfig[language];
    const containerName = `code-exec-${crypto.randomUUID()}`;
    
    const normalizedPath = normalizePath(path.dirname(filepath));
    const volumeMount = `${normalizedPath}:/app/code`;
    
    const command = config.command(filename);
    const escapedCommand = escapeShellCommand(command);
    
    // Docker command with interactive flag
    const dockerArgs = [
      'run',
      '--rm',
      '-i', // Interactive mode for stdin
      '--name', containerName,
      '--memory=256m',
      '--cpus=0.5',
      '--network=none',
      '-v', volumeMount,
      config.image,
      'sh', '-c', escapedCommand
    ];

    return new Promise((resolve) => {
      const dockerProcess = spawn('docker', dockerArgs, {
        timeout: TIMEOUT
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timeoutId = setTimeout(() => {
        timedOut = true;
        dockerProcess.kill();
      }, TIMEOUT);

      // Send stdin if provided
      if (stdin) {
        dockerProcess.stdin.write(stdin);
      }
      dockerProcess.stdin.end();

      dockerProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      dockerProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      dockerProcess.on('close', (code) => {
        clearTimeout(timeoutId);
        const executionTime = Date.now() - startTime;

        if (timedOut) {
          resolve({
            success: false,
            output: '',
            error: `Execution timeout (exceeded ${TIMEOUT}ms)`,
            executionTime
          });
        } else if (code === 0) {
          resolve({
            success: true,
            output: stdout || 'Code executed successfully',
            error: null,
            executionTime
          });
        } else {
          resolve({
            success: false,
            output: stdout,
            error: stderr || `Process exited with code ${code}`,
            executionTime
          });
        }
      });

      dockerProcess.on('error', (error) => {
        clearTimeout(timeoutId);
        const executionTime = Date.now() - startTime;
        
        resolve({
          success: false,
          output: '',
          error: error.code === 'ENOENT' ? 'Docker is not installed or not running' : error.message,
          executionTime
        });
      });
    });

  } catch (error) {
    const executionTime = Date.now() - startTime;
    
    return {
      success: false,
      output: '',
      error: error.message,
      executionTime
    };

  } finally {
    if (filepath) {
      await cleanupFile(filepath);
    }
  }
}

// Keep the old function for backward compatibility
async function executeInDocker(language, code, stdin = '') {
  // If stdin is provided, use the new method
  if (stdin) {
    return executeInDockerWithInput(language, code, stdin);
  }

  const startTime = Date.now();
  let filepath = null;

  try {
    const { filepath: tempFilepath, filename } = await writeCodeFile(language, code);
    filepath = tempFilepath;

    const config = languageConfig[language];
    const containerName = `code-exec-${crypto.randomUUID()}`;
    
    const normalizedPath = normalizePath(path.dirname(filepath));
    const volumeMount = `${normalizedPath}:/app/code`;
    
    const command = config.command(filename);
    const escapedCommand = escapeShellCommand(command);
    
    const dockerCommand = `docker run --rm --name ${containerName} --memory=256m --cpus=0.5 --network=none -v "${volumeMount}" ${config.image} sh -c '${escapedCommand}'`;

    console.log('Executing Docker command:', dockerCommand);

    const execOptions = {
      timeout: TIMEOUT,
      maxBuffer: 1024 * 1024,
      shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh'
    };

    const { stdout, stderr } = await execPromise(dockerCommand, execOptions);

    const executionTime = Date.now() - startTime;

    return {
      success: true,
      output: stdout || stderr || 'Code executed successfully',
      error: null,
      executionTime
    };

  } catch (error) {
    const executionTime = Date.now() - startTime;
    
    let errorMessage = 'Execution failed';
    
    if (error.killed) {
      errorMessage = `Execution timeout (exceeded ${TIMEOUT}ms)`;
    } else if (error.code === 'ENOENT') {
      errorMessage = 'Docker is not installed or not running';
    } else if (error.stderr) {
      errorMessage = error.stderr;
    } else {
      errorMessage = error.message;
    }

    console.error('Docker execution error:', errorMessage);

    return {
      success: false,
      output: '',
      error: errorMessage,
      executionTime
    };

  } finally {
    if (filepath) {
      await cleanupFile(filepath);
    }
  }
}

async function checkDockerAvailability() {
  try {
    await execPromise('docker --version');
    const { stdout } = await execPromise('docker info');
    return true;
  } catch (error) {
    console.error('Docker availability check failed:', error.message);
    return false;
  }
}

async function buildDockerImages() {
  const languages = ['python', 'node', 'java', 'cpp'];
  
  for (const lang of languages) {
    const imageName = `${lang}-runner`;
    
    try {
      console.log(`Building Docker image for ${lang}...`);
      const dockerfilePath = path.join(process.cwd(), 'docker', lang);
      await execPromise(`docker build -t ${imageName} "${dockerfilePath}"`);
      console.log(`Successfully built ${imageName}`);
    } catch (error) {
      console.error(`Failed to build ${imageName}: ${error.message}`);
    }
  }
}

async function testDockerSetup() {
  try {
    const isAvailable = await checkDockerAvailability();
    if (!isAvailable) {
      throw new Error('Docker is not available');
    }
    
    const testCode = 'print("Docker setup is working!")';
    const result = await executeInDocker('python', testCode);
    
    if (result.success) {
      console.log('✓ Docker setup test passed');
      return true;
    } else {
      console.error('✗ Docker setup test failed:', result.error);
      return false;
    }
  } catch (error) {
    console.error('✗ Docker setup test failed:', error.message);
    return false;
  }
}

export { 
  executeInDocker, 
  checkDockerAvailability, 
  buildDockerImages, 
  testDockerSetup,
  languageConfig 
};