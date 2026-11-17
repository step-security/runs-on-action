const childProcess = require('child_process')
const os = require('os')
const process = require('process')
const path = require('path')
const fs = require('fs')
const core = require('@actions/core')
const axios = require('axios')

const ARGS = ''.split(',').filter(arg => arg !== '')
const WINDOWS = 'win32'
const LINUX = 'linux'
const AMD64 = 'x64'
const ARM64 = 'arm64'

async function validateSubscription() {
  let repoPrivate;
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (eventPath && fs.existsSync(eventPath)) {
    const payload = JSON.parse(fs.readFileSync(eventPath, "utf8"));
    repoPrivate = payload?.repository?.private;
  }

  const upstream = 'runs-on/action';
  const action = process.env.GITHUB_ACTION_REPOSITORY;
  const docsUrl = 'https://docs.stepsecurity.io/actions/stepsecurity-maintained-actions';
  core.info('');
  core.info('\u001b[1;36mStepSecurity Maintained Action\u001b[0m');
  core.info(`Secure drop-in replacement for ${upstream}`);
  if (repoPrivate === false) core.info('\u001b[32m\u2713 Free for public repositories\u001b[0m');
  core.info(`\u001b[36mLearn more:\u001b[0m ${docsUrl}`);
  core.info('');
  if (repoPrivate === false) return;
  const serverUrl = process.env.GITHUB_SERVER_URL || 'https://github.com';
  const body = { action: action || '' };
  if (serverUrl !== 'https://github.com') body.ghes_server = serverUrl;
  try {
    await axios.post(
      `https://agent.api.stepsecurity.io/v1/github/${process.env.GITHUB_REPOSITORY}/actions/maintained-actions-subscription`,
      body, { timeout: 3000 }
    );
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 403) {
      core.error(`\u001b[1;31mThis action requires a StepSecurity subscription for private repositories.\u001b[0m`);
      core.error(`\u001b[31mLearn how to enable a subscription: ${docsUrl}\u001b[0m`);
      process.exit(1);
    }
    core.info('Timeout or API not reachable. Continuing to next step.');
  }
}

function chooseBinary() {
    const platform = os.platform()
    const arch = os.arch()

    if (platform === LINUX && arch === AMD64) {
        return `main-linux-amd64`
    }
    if (platform === LINUX && arch === ARM64) {
        return `main-linux-arm64`
    }
    if (platform === WINDOWS && arch === AMD64) {
        return `main-windows-amd64.exe`
    }

    console.error(`Unsupported platform (${platform}) and architecture (${arch})`)
    process.exit(0)
}

async function main() {
    await validateSubscription();
    // Skip all operations if not running on RunsOn runners
    if (!process.env.RUNS_ON_RUNNER_NAME || process.env.RUNS_ON_RUNNER_NAME === '') {
        console.log('This action is only meant to be run on RunsOn (https://runs-on.com) runners, skipping all operations')
        process.exit(0)
    }
    const binary = chooseBinary()
    const mainScript = path.join(__dirname, binary)
    if (os.platform() === WINDOWS) {
        console.log(`Starting ${mainScript} with arguments ${ARGS.join(' ')}`, ARGS.length)
        // runner user has elevated privileges, so we can just run the script directly
        childProcess.execFileSync(mainScript, ARGS, { stdio: 'inherit' })
    } else {
        childProcess.execFileSync(mainScript, ARGS, { stdio: 'inherit' })
    }
    process.exit(0)
}

if (require.main === module) {
    main()
}
