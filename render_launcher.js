'use strict';

const http = require('http');
const path = require('path');
const { fork } = require('child_process');

const PORT = Number(process.env.PORT || 10000);
const CHILD_HEAP_MB = Math.max(128, Number(process.env.BOT_HEAP_MB || 180));
const RESTART_BASE_MS = 5000;
const RESTART_MAX_MS = 60000;
const STABLE_RUNTIME_MS = 5 * 60 * 1000;

const hasApplePassword = Boolean(process.env.APPLE_MC_PASSWORD || process.env.MC_PASSWORD);
const hasChoPassword = Boolean(process.env.CHO_MC_PASSWORD || process.env.MC_PASSWORD);
if (!hasApplePassword || !hasChoPassword) {
  throw new Error('Set MC_PASSWORD, or set both APPLE_MC_PASSWORD and CHO_MC_PASSWORD.');
}

const botSpecs = [
  { name: 'ApplePayLac', script: 'projectinf_fishing_bot_apple.js' },
  { name: 'ChoPayLac', script: 'projectinf_fishing_bot.js' },
];

const states = new Map();
let shuttingDown = false;

function publicState(state) {
  return {
    status: state.status,
    pid: state.child?.pid || null,
    restarts: state.restarts,
    uptimeSeconds: state.startedAt ? Math.floor((Date.now() - state.startedAt) / 1000) : 0,
    nextRestartAt: state.nextRestartAt || null,
  };
}

function startBot(spec) {
  if (shuttingDown) return;

  const previous = states.get(spec.name) || { restarts: 0, shortFailures: 0 };
  const state = {
    ...previous,
    status: 'starting',
    startedAt: Date.now(),
    nextRestartAt: null,
    child: null,
  };
  states.set(spec.name, state);

  const child = fork(path.join(__dirname, spec.script), [], {
    cwd: __dirname,
    execArgv: [`--max-old-space-size=${CHILD_HEAP_MB}`],
    env: {
      ...process.env,
      BOT_LOG_PREFIX: spec.name,
      DISABLE_FILE_LOGS: 'true',
      FISHING_PROXY_URL: '',
      APPLE_FISHING_PROXY_URL: '',
      MC_PROXY_URL: '',
    },
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
  });

  state.child = child;
  state.status = 'running';
  console.log(`[LAUNCHER] Started ${spec.name} (pid=${child.pid}, heap=${CHILD_HEAP_MB}MB).`);

  child.once('error', error => {
    console.error(`[LAUNCHER] ${spec.name} process error:`, error.message);
  });

  child.once('exit', (code, signal) => {
    const runtime = Date.now() - state.startedAt;
    state.child = null;
    state.status = shuttingDown ? 'stopped' : 'restarting';

    if (shuttingDown) return;

    state.restarts += 1;
    state.shortFailures = runtime >= STABLE_RUNTIME_MS ? 0 : state.shortFailures + 1;
    const delay = Math.min(RESTART_MAX_MS, RESTART_BASE_MS * (2 ** Math.min(state.shortFailures, 4)));
    state.nextRestartAt = new Date(Date.now() + delay).toISOString();
    console.error(`[LAUNCHER] ${spec.name} exited (code=${code}, signal=${signal}). Restarting in ${delay}ms.`);
    setTimeout(() => startBot(spec), delay).unref();
  });
}

const server = http.createServer((request, response) => {
  const payload = {
    service: 'online',
    uptimeSeconds: Math.floor(process.uptime()),
    bots: Object.fromEntries([...states.entries()].map(([name, state]) => [name, publicState(state)])),
  };

  response.statusCode = 200;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader('cache-control', 'no-store');
  response.end(`${JSON.stringify(payload)}\n`);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[LAUNCHER] Health server listening on 0.0.0.0:${PORT}.`);
});

for (const spec of botSpecs) startBot(spec);

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[LAUNCHER] Received ${signal}; stopping bots.`);

  server.close();
  for (const state of states.values()) {
    state.status = 'stopping';
    if (state.child && !state.child.killed) state.child.kill('SIGTERM');
  }

  const forceExit = setTimeout(() => process.exit(0), 10000);
  forceExit.unref();

  Promise.all([...states.values()].map(state => new Promise(resolve => {
    if (!state.child) return resolve();
    state.child.once('exit', resolve);
  }))).then(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
