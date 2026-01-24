import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const execPromise = promisify(exec);

const TEMP_DIR = path.join(process.cwd(), 'temp');
const TIMEOUT = 10000; // 10 seconds

/**
 * Configuration for supported programming languages
 * Defines Docker images, file extensions, and execution commands
 */
const languageConfig = {
  python: {
    image: 'python-runner',
    extension: 'py',
    command: (filename) => `python -u /app/code/${filename}`
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

/**
 * Normalizes file paths for cross-platform compatibility
 * Handles Windows drive letters for Docker volume mounting
 */
function normalizePath(filepath) {
  let normalized = filepath.replace(/\\/g, '/');

  // Convert Windows paths (C:\path) to Docker-compatible format (/c/path)
  if (process.platform === 'win32' && /^[A-Za-z]:/.test(normalized)) {
    normalized = '/' + normalized.charAt(0).toLowerCase() + normalized.substring(2);
  }

  return normalized;
}

/**
 * Escapes shell command for safe execution
 */
function escapeShellCommand(command) {
  return command.replace(/'/g, "'\\''");
}

/**
 * Ensures temp directory exists for the given language
 */
async function ensureTempDir(language) {
  const langDir = path.join(TEMP_DIR, language);
  try {
    await fs.mkdir(langDir, { recursive: true });
  } catch (error) {
    throw new Error('Failed to create temporary directory');
  }
  return langDir;
}

/**
 * Writes code to a temporary file
 * Returns file path and metadata for execution
 */
async function writeCodeFile(language, code) {
  const sessionId = crypto.randomUUID();
  const config = languageConfig[language];

  if (!config) {
    throw new Error(`Unsupported language: ${language}`);
  }

  const langDir = await ensureTempDir(language);

  // Java requires specific filename for public class
  const filename = language === 'java' ? 'Main.java' : `code_${sessionId}.${config.extension}`;
  const filepath = path.join(langDir, filename);

  await fs.writeFile(filepath, code, 'utf8');

  // Copy file to /tmp without spaces for Docker compatibility
  // (symlinks don't work because Docker follows them to the original path with spaces)
  const copyBase = '/tmp/oc-exec';
  const copyPath = path.join(copyBase, language);

  try {
    await fs.mkdir(copyBase, { recursive: true });
    await fs.mkdir(copyPath, { recursive: true });

    // Copy the file to the clean path
    const copyFile = path.join(copyPath, filename);
    await fs.copyFile(filepath, copyFile);

    return { filepath, filename, sessionId, dockerPath: copyPath };
  } catch (error) {
    // If copy fails, fall back to original path
    return { filepath, filename, sessionId, dockerPath: langDir };
  }
}

/**
 * Cleans up temporary files after execution
 * Removes source files and compiled binaries
 */
async function cleanupFile(filepath) {
  try {
    await fs.unlink(filepath);

    const dir = path.dirname(filepath);
    const ext = path.extname(filepath);

    // Clean up compiled binaries for C/C++
    if (ext === '.cpp' || ext === '.c') {
      try {
        await fs.unlink(path.join(dir, 'program'));
      } catch { }
    }

    // Clean up compiled Java class files
    if (ext === '.java') {
      try {
        await fs.unlink(path.join(dir, 'Main.class'));
      } catch { }
    }
  } catch (error) {
    // Silent cleanup - file may already be deleted
  }
}

/**
 * Executes code in Docker container with stdin support
 * Uses spawn for interactive input handling
 */
async function executeInDockerWithInput(language, code, stdin = '') {
  const startTime = Date.now();
  let filepath = null;

  try {
    const { filepath: tempFilepath, filename, dockerPath } = await writeCodeFile(language, code);
    filepath = tempFilepath;

    const config = languageConfig[language];
    const containerName = `code-exec-${crypto.randomUUID()}`;

    // Use copied directory (without spaces) for Docker volume mount
    const normalizedPath = normalizePath(dockerPath);
    const volumeMount = `${normalizedPath}:/app/code:z`;

    const command = config.command(filename);
    const escapedCommand = escapeShellCommand(command);

    // Docker command arguments for interactive execution
    const dockerArgs = [
      'run',
      '--rm',
      '-i', // Interactive mode for stdin
      '--name', containerName,
      '--memory=256m', // Memory limit
      '--cpus=0.5', // CPU limit
      '--network=none', // No network access for security
      '-v', volumeMount,
      config.image,
      'sh', '-c', escapedCommand
    ];

    console.log('[DEBUG] Docker Execution:', {
      filepath,
      dockerPath,
      normalizedPath,
      volumeMount,
      dockerArgs
    });

    return new Promise((resolve) => {
      const dockerProcess = spawn('docker', dockerArgs, {
        timeout: TIMEOUT
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      // Timeout handler
      const timeoutId = setTimeout(() => {
        timedOut = true;
        dockerProcess.kill();
      }, TIMEOUT);

      // Write stdin data to process
      if (stdin) {
        dockerProcess.stdin.write(stdin);
      }
      dockerProcess.stdin.end();

      // Collect stdout
      dockerProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      // Collect stderr
      dockerProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // Handle process completion
      dockerProcess.on('close', (code) => {
        clearTimeout(timeoutId);
        const executionTime = Date.now() - startTime;

        // Combine stdout and stderr for full output visibility
        const fullOutput = stdout + stderr;

        if (timedOut) {
          resolve({
            success: false,
            output: fullOutput,
            error: `Execution timeout (exceeded ${TIMEOUT}ms)`,
            executionTime
          });
        } else if (code === 0) {
          resolve({
            success: true,
            output: fullOutput || 'Code executed successfully',
            error: null,
            executionTime
          });
        } else {
          resolve({
            success: false,
            output: fullOutput,
            error: stderr || `Process exited with code ${code}`,
            executionTime
          });
        }
      });

      // Handle process errors
      dockerProcess.on('error', (error) => {
        clearTimeout(timeoutId);
        const executionTime = Date.now() - startTime;

        resolve({
          success: false,
          output: '',
          error: error.code === 'ENOENT' ? 'Docker is not available' : 'Execution failed',
          executionTime
        });
      });
    });

  } catch (error) {
    const executionTime = Date.now() - startTime;

    return {
      success: false,
      output: '',
      error: error.message || 'Execution failed',
      executionTime
    };

  } finally {
    if (filepath) {
      await cleanupFile(filepath);
    }
  }
}

/**
 * Executes code in isolated Docker container
 * Supports both interactive and non-interactive modes
 */
async function executeInDocker(language, code, stdin = '') {
  // Use interactive mode if stdin is provided
  if (stdin) {
    return executeInDockerWithInput(language, code, stdin);
  }

  const startTime = Date.now();
  let filepath = null;

  try {
    const { filepath: tempFilepath, filename, dockerPath } = await writeCodeFile(language, code);
    filepath = tempFilepath;

    const config = languageConfig[language];
    const containerName = `code-exec-${crypto.randomUUID()}`;

    // Use copied directory (without spaces) for Docker volume mount
    const normalizedPath = normalizePath(dockerPath);
    const volumeMount = `${normalizedPath}:/app/code:z`;

    const command = config.command(filename);
    const escapedCommand = escapeShellCommand(command);

    // Build Docker command with security constraints
    const dockerCommand = `docker run --rm --name ${containerName} --memory=256m --cpus=0.5 --network=none -v "${volumeMount}" ${config.image} sh -c '${escapedCommand}'`;

    const execOptions = {
      timeout: TIMEOUT,
      maxBuffer: 1024 * 1024, // 1MB buffer
      shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh'
    };

    const { stdout, stderr } = await execPromise(dockerCommand, execOptions);

    const executionTime = Date.now() - startTime;

    return {
      success: true,
      output: (stdout + stderr) || 'Code executed successfully',
      error: null,
      executionTime
    };

  } catch (error) {
    const executionTime = Date.now() - startTime;

    let errorMessage = 'Execution failed';

    if (error.killed) {
      errorMessage = `Execution timeout (exceeded ${TIMEOUT}ms)`;
    } else if (error.code === 'ENOENT') {
      errorMessage = 'Docker is not available';
    } else if (error.stderr) {
      errorMessage = error.stderr;
    } else {
      errorMessage = error.message || errorMessage;
    }

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

/**
 * Checks if Docker is installed and running
 */
async function checkDockerAvailability() {
  try {
    await execPromise('docker --version');
    await execPromise('docker info');
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Builds all required Docker images for code execution
 */
async function buildDockerImages() {
  const languages = ['python', 'node', 'java', 'cpp'];

  for (const lang of languages) {
    const imageName = `${lang}-runner`;

    try {
      const dockerfilePath = path.join(process.cwd(), 'docker', lang);
      await execPromise(`docker build -t ${imageName} "${dockerfilePath}"`);
    } catch (error) {
      // Continue building other images even if one fails
    }
  }
}

/**
 * Tests Docker setup with a simple execution
 */
async function testDockerSetup() {
  try {
    const isAvailable = await checkDockerAvailability();
    if (!isAvailable) {
      return false;
    }

    const testCode = 'print("Docker setup is working!")';
    const result = await executeInDocker('python', testCode);

    return result.success;
  } catch (error) {
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