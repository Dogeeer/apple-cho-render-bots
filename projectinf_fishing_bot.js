const mineflayer = require('mineflayer');
const { SocksClient } = require('socks');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { Vec3 } = require('vec3');
const fs = require('fs');
const path = require('path');
const { createHostFailover } = require('./host_failover');
const util = require('util');

loadEnvFile(path.join(__dirname, '.env.fishing'));
loadEnvFile(path.join(__dirname, '.env.proxy-test'));

const LOG_FILE = path.join(__dirname, 'bot_fishing.log');
const LOG_TO_FILE = !/^true$/i.test(process.env.DISABLE_FILE_LOGS || 'false');
const LOG_PREFIX = process.env.BOT_LOG_PREFIX ? `[${process.env.BOT_LOG_PREFIX}] ` : '';
const originalConsoleLog = console.log.bind(console);
const originalConsoleError = console.error.bind(console);

console.log = (...args) => {
  const line = args.map(value => {
    if (typeof value === 'string') return value;
    if (value instanceof Error) return value.stack || value.message;
    try {
      return JSON.stringify(value);
    } catch {
      return util.inspect(value, { depth: 6, colors: false, breakLength: Infinity });
    }
  }).join(' ');

  const stampedLine = `${LOG_PREFIX}[${new Date().toISOString()}] ${line}`;
  originalConsoleLog(stampedLine);
  if (LOG_TO_FILE) fs.appendFileSync(LOG_FILE, `${stampedLine}\n`, 'utf8');
};

console.error = (...args) => {
  console.log(...args);
};

const CONFIG = {
  HOST: 'projectinf.net',
  PORT: 25565,
  USERNAME: 'ChoPayLac',
  VERSION: process.env.FISHING_MC_VERSION || process.env.MC_VERSION || '1.21.4',
  PASSWORD: process.env.CHO_MC_PASSWORD || process.env.MC_PASSWORD || '',
  PROXY_URL: process.env.FISHING_PROXY_URL || process.env.MC_PROXY_URL || '',

  NPC_IDS: ['CIT-71fefc940afc'],
  NPC_NAMES: ['cit'],
  PROFILE_SLOT: 10,
  NPC_CLICK_ATTEMPTS: 6,
  NPC_CLICK_RETRY_MS: 1000,

  START_AFTER_PROFILE_MS: 8000,
  RECONNECT_DELAY_MS: 15000,
  ALREADY_CONNECTED_RETRY_MS: 60000,
  INTERNAL_ERROR_RETRY_MS: 60000,
  RECONNECT_JITTER_MS: 5000,

  FISHING_SPOT_ENABLED: !/^false$/i.test(process.env.FISHING_SPOT_ENABLED || 'true'),
  FISHING_SPOT: new Vec3(
    Number(process.env.FISHING_SPOT_X || -638.3),
    Number(process.env.FISHING_SPOT_Y || 87),
    Number(process.env.FISHING_SPOT_Z || -754.7),
  ),
  FISHING_SPOT_RADIUS: Number(process.env.FISHING_SPOT_RADIUS || 1.2),
  FISHING_SPOT_START_RADIUS: Number(process.env.FISHING_SPOT_START_RADIUS || 0.35),
  FISHING_SPOT_RETURN_RADIUS: Number(process.env.FISHING_SPOT_RETURN_RADIUS || 0.25),
  FISHING_SPOT_RETURN_TIMEOUT_MS: Number(process.env.FISHING_SPOT_RETURN_TIMEOUT_MS || 15000),
  FISHING_RETRACT_WHILE_RETURNING_MS: Number(process.env.FISHING_RETRACT_WHILE_RETURNING_MS || 350),
  FISHING_WATER_TARGET_ENABLED: !/^false$/i.test(process.env.FISHING_WATER_TARGET_ENABLED || 'true'),
  FISHING_WATER_TARGET: optionalVec3('FISHING_WATER_TARGET'),
  FISHING_WATER_SCAN_RADIUS: Number(process.env.FISHING_WATER_SCAN_RADIUS || 7),
  FISHING_WATER_SCAN_Y_BELOW: Number(process.env.FISHING_WATER_SCAN_Y_BELOW || 4),
  FISHING_WATER_SCAN_Y_ABOVE: Number(process.env.FISHING_WATER_SCAN_Y_ABOVE || 2),
  FISHING_WATER_AIM_Y_OFFSET: Number(process.env.FISHING_WATER_AIM_Y_OFFSET || 0.25),
  FISHING_AIM_MODE: normalizeText(process.env.FISHING_AIM_MODE || 'water'),
  FISHING_BOBBER_SCAN_RADIUS: Number(process.env.FISHING_BOBBER_SCAN_RADIUS || 3.5),

  FISHING_ROD_NAMES: ['fishing_rod'],
  // Ported from Wurst7 AutoFish's sound-mode idea: only accept splash
  // sounds close to our bobber, so nearby players' bites are ignored.
  BITE_DETECTION_MODE: process.env.FISHING_BITE_MODE || 'hybrid',
  VALID_BITE_RANGE: Number(process.env.FISHING_VALID_BITE_RANGE || 1.5),
  DEBUG_BITE_PACKETS: /^true$/i.test(process.env.FISHING_DEBUG_BITE_PACKETS || 'false'),
  CATCH_DELAY_TICKS: Number(process.env.FISHING_CATCH_DELAY_TICKS || 0),
  RETRY_DELAY_TICKS: Number(process.env.FISHING_RETRY_DELAY_TICKS || 15),
  PATIENCE_SECONDS: Number(process.env.FISHING_PATIENCE_SECONDS || 60),
  MIN_BITE_AGE_MS: Number(process.env.FISHING_MIN_BITE_AGE_MS || 2500),
  REEL_SPAM_ENABLED: !/^false$/i.test(process.env.FISHING_REEL_SPAM_ENABLED || 'true'),
  REEL_SPAM_MS: Number(process.env.FISHING_REEL_SPAM_MS || 2200),
  REEL_SPAM_INTERVAL_MS: Number(process.env.FISHING_REEL_SPAM_INTERVAL_MS || 170),
  REEL_MIN_CLICKS: Number(process.env.FISHING_REEL_MIN_CLICKS || 1),
  REEL_STOP_ON_BOBBER_GONE: !/^false$/i.test(process.env.FISHING_REEL_STOP_ON_BOBBER_GONE || 'true'),
  REEL_STOP_ON_INVENTORY_CHANGE: !/^false$/i.test(process.env.FISHING_REEL_STOP_ON_INVENTORY_CHANGE || 'true'),
  REEL_SKIP_IF_ALREADY_GONE: !/^false$/i.test(process.env.FISHING_REEL_SKIP_IF_ALREADY_GONE || 'true'),
  POST_REEL_COOLDOWN_MS: Number(process.env.FISHING_POST_REEL_COOLDOWN_MS || 900),
  LOOP_PAUSE_MS: Number(process.env.FISHING_LOOP_PAUSE_MS || ticksToMs(process.env.FISHING_RETRY_DELAY_TICKS || 14)),
  NO_ROD_RETRY_MS: 10000,

  AUTOTRASH_ENABLED: !/^false$/i.test(process.env.FISHING_AUTOTRASH_ENABLED || 'true'),
  AUTOTRASH_INTERVAL_MS: Number(process.env.FISHING_AUTOTRASH_INTERVAL_MS || 60 * 1000),
  AUTOTRASH_FIRST_DELAY_MS: 20 * 1000,
  TRASH_OPEN_TIMEOUT_MS: 5000,
  TRASH_SHIFT_CLICK_DELAY_MS: 50,
  TRASH_MAX_SHIFT_CLICKS_PER_TICK: 5,
  TARGET_TRASH_NAMES: parseNameList(
    process.env.FISHING_AUTOTRASH_NAMES,
    ['luon tuoi song', 'ca ro phi'],
  ),
  TARGET_TRASH_ITEM_NAMES: parseNameList(process.env.FISHING_AUTOTRASH_ITEM_NAMES, []),
};

if (!CONFIG.PASSWORD) {
  throw new Error('Missing CHO_MC_PASSWORD or MC_PASSWORD environment variable.');
}

function parseNameList(value, fallback) {
  const source = value ? String(value).split(/[|,\n]/g) : fallback;
  return source
    .map(normalizeText)
    .filter(Boolean);
}

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;

  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    value = value.replace(/^["']|["']$/g, '');

    if (!(key in process.env)) process.env[key] = value;
  }
}

const hostFailover = createHostFailover({
  primaryHost: CONFIG.HOST,
  log: message => console.log(message),
});

let bot = null;
let loginDone = false;
let npcFound = false;
let profileSelected = false;
let fishingRunning = false;
let trashRunning = false;
let autoTrashInterval = null;
let autoTrashFirstTimer = null;
let afterProfileTimer = null;
let reconnectTimer = null;
let lastNpcMissingLogAt = 0;
let lastNoRodLogAt = 0;
let botSessionId = 0;
let shuttingDown = false;
let lastKickText = '';
let loginFallbackTimer = null;
let lastProtocolWarningAt = 0;
let lastReelAt = 0;
let lastSpotReturnLogAt = 0;
let lastWaterTargetLogAt = 0;
let fishingLoopSession = 0;
let cancelActiveFish = null;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function optionalNumber(key) {
  const raw = process.env[key];
  if (raw === undefined || raw === null || String(raw).trim() === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function optionalVec3(prefix) {
  const x = optionalNumber(`${prefix}_X`);
  const y = optionalNumber(`${prefix}_Y`);
  const z = optionalNumber(`${prefix}_Z`);
  if (x === null || y === null || z === null) return null;
  return new Vec3(x, y, z);
}

function isPartialProtocolReadError(err) {
  const text = `${err && err.name ? err.name : ''}\n${err && err.message ? err.message : ''}\n${err && err.stack ? err.stack : ''}`;
  return text.includes('PartialReadError')
    && text.includes('Unexpected buffer end while reading VarInt');
}

function handleProcessError(kind, err) {
  if (isPartialProtocolReadError(err)) {
    const now = Date.now();
    if (now - lastProtocolWarningAt > 30000) {
      lastProtocolWarningAt = now;
      console.log(`[BOT] Protocol warning ignored (${kind}): entity metadata packet could not be decoded cleanly. Current MC version=${CONFIG.VERSION}. If kicks continue, try changing FISHING_MC_VERSION in .env.fishing.`);
    }
    return;
  }

  console.log(`[BOT] ${kind}:`, err);
}

process.on('uncaughtException', err => {
  handleProcessError('uncaughtException', err);
});

process.on('unhandledRejection', err => {
  handleProcessError('unhandledRejection', err);
});

function resetState() {
  loginDone = false;
  npcFound = false;
  profileSelected = false;
  fishingRunning = false;
  trashRunning = false;
  lastNpcMissingLogAt = 0;
  lastNoRodLogAt = 0;

  if (autoTrashInterval) {
    clearInterval(autoTrashInterval);
    autoTrashInterval = null;
  }

  if (autoTrashFirstTimer) {
    clearTimeout(autoTrashFirstTimer);
    autoTrashFirstTimer = null;
  }

  if (afterProfileTimer) {
    clearTimeout(afterProfileTimer);
    afterProfileTimer = null;
  }

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  fishingLoopSession += 1;

  if (cancelActiveFish) {
    const cancel = cancelActiveFish;
    cancelActiveFish = null;
    cancel();
  }

  if (loginFallbackTimer) {
    clearTimeout(loginFallbackTimer);
    loginFallbackTimer = null;
  }
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function flattenTextComponent(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(flattenTextComponent).join(' ');
  if (typeof value !== 'object') return String(value);

  if (Object.prototype.hasOwnProperty.call(value, 'value')) {
    return flattenTextComponent(value.value);
  }

  let out = '';
  if (value.text !== undefined) out += flattenTextComponent(value.text);
  if (value.translate !== undefined) out += ` ${flattenTextComponent(value.translate)}`;
  if (Array.isArray(value.extra)) {
    for (const part of value.extra) out += ` ${flattenTextComponent(part)}`;
  }
  if (out.trim()) return out;

  return Object.values(value).map(flattenTextComponent).filter(Boolean).join(' ');
}

function parsePossibleJsonText(value) {
  if (value && typeof value === 'object') return flattenTextComponent(value);
  const raw = String(value || '');
  if (!raw.startsWith('{') && !raw.startsWith('[')) return raw;

  try {
    return flattenTextComponent(JSON.parse(raw));
  } catch {
    return raw;
  }
}

function collectNbtStrings(value, out = [], depth = 0) {
  if (value == null || depth > 8 || out.length > 80) return out;

  if (typeof value === 'string') {
    out.push(parsePossibleJsonText(value));
    return out;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectNbtStrings(item, out, depth + 1);
    return out;
  }

  if (typeof value === 'object') {
    if (Object.prototype.hasOwnProperty.call(value, 'value')) {
      collectNbtStrings(value.value, out, depth + 1);
    }

    for (const key of Object.keys(value)) {
      if (key !== 'value' && key !== 'type') collectNbtStrings(value[key], out, depth + 1);
    }
  }

  return out;
}

function collectTextLikeStrings(value, out = [], depth = 0, seen = new Set()) {
  if (value == null || depth > 6 || out.length > 80) return out;
  if (typeof value === 'string') {
    out.push(parsePossibleJsonText(value));
    return out;
  }
  if (typeof value !== 'object') return out;
  if (seen.has(value)) return out;
  seen.add(value);

  const componentText = flattenTextComponent(value);
  if (componentText) out.push(componentText);

  if (Array.isArray(value)) {
    for (const item of value) collectTextLikeStrings(item, out, depth + 1, seen);
    return out;
  }

  for (const key of Object.getOwnPropertyNames(value)) {
    collectTextLikeStrings(value[key], out, depth + 1, seen);
  }
  return out;
}

function itemSearchTexts(item) {
  if (!item) return [];
  return [
    item.displayName,
    item.name,
    ...collectTextLikeStrings(item.customName),
    ...collectTextLikeStrings(item.components),
    ...collectNbtStrings(item.nbt),
  ]
    .filter(Boolean)
    .map(normalizeText)
    .filter(Boolean);
}

function itemDisplayName(item) {
  if (!item) return 'unknown';
  const texts = itemSearchTexts(item);
  const customTarget = texts.find(text =>
    CONFIG.TARGET_TRASH_NAMES.some(target => text === target || text.includes(target)),
  );
  return customTarget || item.displayName || item.customName || item.name || 'unknown';
}

function isTrashItem(item) {
  if (item && CONFIG.TARGET_TRASH_ITEM_NAMES.includes(normalizeText(item.name))) {
    return true;
  }

  const texts = itemSearchTexts(item);
  return CONFIG.TARGET_TRASH_NAMES.some(target =>
    texts.some(text => text === target || text.includes(target)),
  );
}

function isFishingRod(item) {
  if (!item) return false;
  if (CONFIG.FISHING_ROD_NAMES.includes(item.name)) return true;
  const texts = itemSearchTexts(item);
  return texts.some(text => text.includes('fishing rod') || text.includes('can cau'));
}

function summarizeItems(items) {
  const counts = new Map();
  for (const item of items) {
    const name = itemDisplayName(item);
    counts.set(name, (counts.get(name) || 0) + item.count);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, count]) => `${name} x${count}`)
    .join(' | ');
}

function logInventory(reason) {
  if (!bot || !bot.inventory) return;
  const counts = new Map();
  for (const item of bot.inventory.items()) {
    const name = itemDisplayName(item);
    counts.set(name, (counts.get(name) || 0) + item.count);
  }
  const entries = [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, count]) => `${name} x${count}`);
  console.log(`[INV] ${reason}: ${entries.length ? entries.join(' | ') : 'empty'}`);
}

function isAlreadyConnectedReason(value) {
  return normalizeText(parsePossibleJsonText(value)).includes('already connected to this proxy');
}

function isInternalConnectionError(value) {
  return normalizeText(parsePossibleJsonText(value)).includes('an internal error occurred in your connection');
}

function isLoginRateLimited(value) {
  return normalizeText(parsePossibleJsonText(value)).includes('logging in too fast');
}

function reconnectDelayWithJitter(baseDelayMs) {
  return baseDelayMs + Math.floor(Math.random() * (CONFIG.RECONNECT_JITTER_MS + 1));
}

function isLoginSuccessMessage(message) {
  const text = normalizeText(message);
  return text.includes('dang nhap thanh cong') || text.includes('login successful');
}

function parseSocks5Proxy(proxyUrl) {
  if (!proxyUrl) return null;

  const normalized = proxyUrl.includes('://') ? proxyUrl : `socks5://${proxyUrl}`;
  const url = new URL(normalized);
  if (!['socks5:', 'socks:'].includes(url.protocol)) {
    throw new Error(`Unsupported proxy protocol "${url.protocol}". Use socks5://host:port`);
  }

  return {
    host: url.hostname,
    port: Number(url.port || 1080),
    type: 5,
    userId: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
  };
}

function buildBotOptions() {
  const proxy = parseSocks5Proxy(CONFIG.PROXY_URL);
  hostFailover.beginAttempt();
  const connectionHost = hostFailover.currentHost();
  const options = {
    username: CONFIG.USERNAME,
    version: CONFIG.VERSION,
  };

  if (!proxy) {
    options.host = connectionHost;
    options.port = CONFIG.PORT;
    return options;
  }

  options.fakeHost = CONFIG.HOST;
  options.connect = client => {
    SocksClient.createConnection({
      proxy,
      command: 'connect',
      destination: {
        host: connectionHost,
        port: CONFIG.PORT,
      },
      timeout: 15000,
    }, (error, info) => {
      if (error) {
        client.emit('error', error);
        return;
      }

      client.setSocket(info.socket);
      client.emit('connect');
    });
  };

  console.log(`[BOT] SOCKS5 proxy enabled: ${proxy.host}:${proxy.port}`);
  return options;
}

function setupMovement() {
  const mcData = require('minecraft-data')(bot.version);
  const movements = new Movements(bot, mcData);
  movements.canDig = false;
  movements.allow1by1towers = false;
  movements.allowParkour = true;
  bot.pathfinder.setMovements(movements);
}

function clearMovement() {
  if (!bot) return;
  for (const key of ['forward', 'back', 'left', 'right', 'jump', 'sprint', 'sneak']) {
    bot.setControlState(key, false);
  }
  if (bot.pathfinder) bot.pathfinder.setGoal(null);
}

function distanceToFishingSpot() {
  if (!bot || !bot.entity || !CONFIG.FISHING_SPOT) return Infinity;
  return bot.entity.position.distanceTo(CONFIG.FISHING_SPOT);
}

async function retractBobberIfPresent() {
  if (!bot || !bot.entity || bot.currentWindow) return false;
  const bobberId = getBobberEntityId();
  if (!bobberId) return false;
  bot.activateItem();
  lastReelAt = Date.now();
  await sleep(500);
  return true;
}

async function ensureFishingSpot() {
  if (!CONFIG.FISHING_SPOT_ENABLED || !bot || !bot.entity || !bot.pathfinder) return true;
  const distance = distanceToFishingSpot();
  if (distance <= CONFIG.FISHING_SPOT_START_RADIUS) return true;

  const now = Date.now();
  if (now - lastSpotReturnLogAt > 30000) {
    lastSpotReturnLogAt = now;
    console.log(`[FISH] Returning to exact fishing spot (${distance.toFixed(2)} blocks away).`);
  }

  await retractBobberIfPresent();

  bot.pathfinder.setGoal(new goals.GoalNear(
    CONFIG.FISHING_SPOT.x,
    CONFIG.FISHING_SPOT.y,
    CONFIG.FISHING_SPOT.z,
    CONFIG.FISHING_SPOT_RETURN_RADIUS,
  ));

  const retractTimer = setInterval(() => {
    retractBobberIfPresent().catch(err => console.log('[FISH] Retract while returning failed:', err.message));
  }, CONFIG.FISHING_RETRACT_WHILE_RETURNING_MS);
  await waitForGoalOrTimeout(CONFIG.FISHING_SPOT_RETURN_TIMEOUT_MS);
  clearInterval(retractTimer);
  clearMovement();

  return distanceToFishingSpot() <= CONFIG.FISHING_SPOT_START_RADIUS;
}

function isWaterBlock(block) {
  return block && typeof block.name === 'string' && block.name.includes('water');
}

function getConfiguredWaterBlock() {
  if (!CONFIG.FISHING_WATER_TARGET || !bot) return null;
  return bot.blockAt(CONFIG.FISHING_WATER_TARGET.floored());
}

function findFishingWaterBlock() {
  if (!bot || !bot.entity) return null;

  const configured = getConfiguredWaterBlock();
  if (isWaterBlock(configured)) return configured;

  const range = Math.max(1, Math.floor(CONFIG.FISHING_WATER_SCAN_RADIUS));
  const below = Math.max(0, Math.floor(CONFIG.FISHING_WATER_SCAN_Y_BELOW));
  const above = Math.max(0, Math.floor(CONFIG.FISHING_WATER_SCAN_Y_ABOVE));
  const base = bot.entity.position.floored();
  let best = null;
  let bestDistance = Infinity;

  for (let y = base.y - below; y <= base.y + above; y += 1) {
    for (let x = base.x - range; x <= base.x + range; x += 1) {
      for (let z = base.z - range; z <= base.z + range; z += 1) {
        const block = bot.blockAt(new Vec3(x, y, z));
        if (!isWaterBlock(block)) continue;
        const distance = block.position.offset(0.5, 0.5, 0.5).distanceTo(bot.entity.position);
        if (distance < bestDistance) {
          best = block;
          bestDistance = distance;
        }
      }
    }
  }

  return best;
}

async function aimAtFishingWater() {
  if (!CONFIG.FISHING_WATER_TARGET_ENABLED || !bot || !bot.entity) return true;

  if (CONFIG.FISHING_AIM_MODE === 'down') {
    await bot.lookAt(bot.entity.position.offset(0, -1, 0), true);
    return true;
  }

  const water = findFishingWaterBlock();
  if (!water) {
    const now = Date.now();
    if (now - lastWaterTargetLogAt > 10000) {
      lastWaterTargetLogAt = now;
      console.log('[FISH] Waiting for water target near fishing spot...');
    }
    return false;
  }

  await bot.lookAt(water.position.offset(0.5, CONFIG.FISHING_WATER_AIM_Y_OFFSET, 0.5), true);
  return true;
}

function scheduleReconnect(delayMs = CONFIG.RECONNECT_DELAY_MS) {
  if (shuttingDown || reconnectTimer) return;
  resetState();
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    createBot();
  }, delayMs);
}

function createBot() {
  resetState();
  lastKickText = '';

  const sessionId = ++botSessionId;
  console.log(`[BOT] Connecting attempt ${sessionId}: ${CONFIG.HOST}:${CONFIG.PORT} (MC ${CONFIG.VERSION}).`);
  const connectWatchdog = setTimeout(() => {
    console.error('[BOT] No spawn within 30s; restarting process through launcher.');
    process.exit(1);
  }, 30000);
  const currentBot = mineflayer.createBot(buildBotOptions());
  bot = currentBot;
  currentBot.loadPlugin(pathfinder);

  currentBot._client.on('add_resource_pack', data => {
    if (currentBot !== bot || sessionId !== botSessionId) return;
    currentBot._client.write('resource_pack_receive', {
      uuid: data.uuid,
      result: 1,
    });
  });

  currentBot.once('spawn', () => {
    clearTimeout(connectWatchdog);
    if (currentBot !== bot || sessionId !== botSessionId) return;
    setupMovement();
    console.log('[BOT] Spawned. Logging in...');

    setTimeout(() => {
      if (currentBot !== bot || sessionId !== botSessionId || !bot || !bot.entity) return;
      currentBot.chat(`/login ${CONFIG.PASSWORD}`);

      loginFallbackTimer = setTimeout(() => {
        if (currentBot !== bot || sessionId !== botSessionId || loginDone) return;
        console.log('[BOT] Login success message not seen, continuing by timeout...');
        markLoginDoneAndClickNpc();
      }, 12000);
    }, 2000);
  });

  currentBot.on('messagestr', message => {
    if (currentBot !== bot || sessionId !== botSessionId || loginDone) return;
    if (!isLoginSuccessMessage(message)) return;

    console.log('[BOT] Login confirmed by chat.');
    markLoginDoneAndClickNpc();
  });

  currentBot.on('windowOpen', window => {
    if (currentBot !== bot || sessionId !== botSessionId) return;
    if (!profileSelected) console.log(`[GUI] Opened: ${window.title}`);
  });

  currentBot.on('kicked', reason => {
    if (currentBot !== bot || sessionId !== botSessionId) return;
    lastKickText = parsePossibleJsonText(reason);
    console.log('[BOT] Kicked:', reason);
  });

  currentBot.on('error', err => {
    if (currentBot !== bot || sessionId !== botSessionId) return;
    hostFailover.handleConnectErrorBeforeLogin({
      loginDone,
      disconnect: () => currentBot.end(),
    });
    console.log('[BOT] Error:', err.message);
  });

  currentBot.on('end', reason => {
    clearTimeout(connectWatchdog);
    if (currentBot !== bot || sessionId !== botSessionId || shuttingDown) return;
    if (!loginDone) hostFailover.markConnectFailureBeforeLogin();
    const disconnectText = lastKickText || reason;
    const retryMs = isAlreadyConnectedReason(disconnectText)
      ? CONFIG.ALREADY_CONNECTED_RETRY_MS
      : isInternalConnectionError(disconnectText) || isLoginRateLimited(disconnectText)
        ? CONFIG.INTERNAL_ERROR_RETRY_MS
        : CONFIG.RECONNECT_DELAY_MS;
    const retryWithJitterMs = reconnectDelayWithJitter(retryMs);
    console.log(`[BOT] Disconnected: ${reason || 'unknown'}. Reconnecting in ${Math.round(retryWithJitterMs / 1000)}s...`);
    scheduleReconnect(retryWithJitterMs);
  });
}

function markLoginDoneAndClickNpc() {
  if (loginDone) return;
  loginDone = true;

  hostFailover.markConnected();

  if (loginFallbackTimer) {
    clearTimeout(loginFallbackTimer);
    loginFallbackTimer = null;
  }

  setTimeout(findAndClickNPC, 2500);
}

function getNPC() {
  if (!bot || !bot.entities) return null;
  const byId = Object.values(bot.entities).find(entity =>
    entity && CONFIG.NPC_IDS.some(id => normalizeText(entity.username || entity.name || entity.displayName || '').includes(normalizeText(id))),
  );
  if (byId) return byId;

  return Object.values(bot.entities)
    .filter(entity => entity && entity.position)
    .find(entity => {
      const text = normalizeText(`${entity.username || ''} ${entity.name || ''} ${entity.displayName || ''}`);
      return CONFIG.NPC_NAMES.some(name => text.includes(name));
    }) || null;
}

function findAndClickNPC() {
  if (!bot || !loginDone || npcFound) return;

  const npc = getNPC();
  if (!npc) {
    const now = Date.now();
    if (now - lastNpcMissingLogAt > 60000) {
      console.log('[NPC] Waiting for CIT...');
      lastNpcMissingLogAt = now;
    }
    setTimeout(findAndClickNPC, 2000);
    return;
  }

  moveAndClickNPC(npc).catch(err => {
    console.log('[NPC] Click failed:', err.message);
    npcFound = false;
    setTimeout(findAndClickNPC, 3000);
  });
}

async function moveAndClickNPC(npc) {
  bot.pathfinder.setGoal(new goals.GoalNear(npc.position.x, npc.position.y, npc.position.z, 2));
  await waitForGoalOrTimeout(12000);

  const window = await clickNpcUntilWindow(npc.id);
  if (!window) {
    throw new Error(`Profile menu did not open after ${CONFIG.NPC_CLICK_ATTEMPTS} direct clicks`);
  }

  npcFound = true;
  console.log('[NPC] Clicked CIT.');
  await chooseProfileSlot(window);
}

async function clickNpcUntilWindow(npcId, attempts = CONFIG.NPC_CLICK_ATTEMPTS, retryMs = CONFIG.NPC_CLICK_RETRY_MS) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const fresh = bot && bot.entities ? bot.entities[npcId] : null;
    if (!fresh) throw new Error('NPC disappeared');
    await bot.lookAt(fresh.position.offset(0, 1.6, 0), true);
    bot._client.write('use_entity', { target: fresh.id, mouse: 0, hand: 0, sneaking: false });
    const window = await waitForWindow(retryMs);
    if (window) return window;
  }
  return null;
}

function waitForGoalOrTimeout(timeoutMs) {
  return new Promise(resolve => {
    const done = () => {
      clearTimeout(timer);
      bot.removeListener('goal_reached', done);
      resolve();
    };
    const timer = setTimeout(done, timeoutMs);
    bot.once('goal_reached', done);
  });
}

async function waitForWindow(timeoutMs) {
  if (bot.currentWindow) return bot.currentWindow;
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      bot.removeListener('windowOpen', onOpen);
      resolve(null);
    }, timeoutMs);

    function onOpen(window) {
      clearTimeout(timer);
      resolve(window);
    }

    bot.once('windowOpen', onOpen);
  });
}

async function chooseProfileSlot(openWindow = null) {
  const sessionId = botSessionId;
  const window = openWindow || await waitForWindow(15000);
  if (sessionId !== botSessionId || !bot || !bot.entity) return;
  if (!window) {
    console.log('[GUI] Profile menu did not open.');
    return;
  }

  await sleep(700);
  if (sessionId !== botSessionId || !bot || !bot.entity) return;
  await bot.clickWindow(CONFIG.PROFILE_SLOT, 0, 0);
  profileSelected = true;
  console.log(`[GUI] Selected first profile slot ${CONFIG.PROFILE_SLOT}.`);

  afterProfileTimer = setTimeout(() => {
    afterProfileTimer = null;
    if (sessionId !== botSessionId || !bot || !bot.entity || !profileSelected) return;
    logInventory('after profile');
    if (CONFIG.AUTOTRASH_ENABLED) startAutoTrash();
    startFishingLoop(sessionId);
  }, CONFIG.START_AFTER_PROFILE_MS);
}

function startAutoTrash() {
  if (autoTrashInterval || !bot) return;
  const sessionId = botSessionId;

  autoTrashFirstTimer = setTimeout(() => {
    autoTrashFirstTimer = null;
    if (sessionId !== botSessionId || !bot || !bot.entity) return;
    runAutoTrashPass().catch(err => console.log('[TRASH] Failed:', err.message));
  }, CONFIG.AUTOTRASH_FIRST_DELAY_MS);

  autoTrashInterval = setInterval(() => {
    if (sessionId !== botSessionId || !bot || !bot.entity) return;
    runAutoTrashPass().catch(err => console.log('[TRASH] Failed:', err.message));
  }, CONFIG.AUTOTRASH_INTERVAL_MS);
}

async function runAutoTrashPass() {
  if (!bot || !bot.entity || trashRunning || bot.currentWindow) return;

  const inventoryTargets = bot.inventory.items().filter(isTrashItem);
  if (inventoryTargets.length === 0) return;

  console.log(`[TRASH] Targets: ${summarizeItems(inventoryTargets)}`);
  trashRunning = true;
  clearMovement();

  try {
    bot.chat('/trash');
    const trashWindow = await waitForWindow(CONFIG.TRASH_OPEN_TIMEOUT_MS);
    if (!trashWindow) {
      console.log('[TRASH] /trash did not open.');
      return;
    }

    await sleep(400);
    const moved = await moveTrashItemsFromCurrentWindow();
    if (bot.currentWindow) bot.closeWindow(bot.currentWindow);
    if (moved > 0) {
      console.log(`[TRASH] Moved ${moved} fish stack(s).`);
      logInventory('after trash');
    }
  } finally {
    trashRunning = false;
  }
}

async function moveTrashItemsFromCurrentWindow() {
  const window = bot.currentWindow;
  if (!window) return 0;

  const start = Number.isInteger(window.inventoryStart)
    ? window.inventoryStart
    : Math.max(0, window.slots.length - 36);
  const end = Number.isInteger(window.inventoryEnd)
    ? window.inventoryEnd
    : window.slots.length;

  let moved = 0;
  while (true) {
    let clicksThisBatch = 0;
    for (let slot = start; slot < end && clicksThisBatch < CONFIG.TRASH_MAX_SHIFT_CLICKS_PER_TICK; slot += 1) {
      const item = window.slots[slot];
      if (!isTrashItem(item)) continue;
      await bot.clickWindow(slot, 0, 1);
      clicksThisBatch += 1;
      moved += 1;
      await sleep(CONFIG.TRASH_SHIFT_CLICK_DELAY_MS);
    }
    if (clicksThisBatch === 0) break;
    await sleep(50);
  }
  return moved;
}

async function equipFishingRod() {
  if (!bot || !bot.inventory) return false;

  const held = bot.heldItem;
  if (isFishingRod(held)) return true;

  const rod = bot.inventory.items().find(isFishingRod);
  if (!rod) {
    const now = Date.now();
    if (now - lastNoRodLogAt > 60000) {
      console.log('[FISH] Waiting for fishing rod in inventory...');
      lastNoRodLogAt = now;
    }
    return false;
  }

  await bot.equip(rod, 'hand');
  console.log(`[FISH] Holding ${rod.displayName || rod.name}.`);
  return true;
}

function getBobberEntityId(targetBot = bot) {
  if (!targetBot || !targetBot.entity || !targetBot.entities) return null;
  let best = null;
  let bestDistance = Infinity;

  for (const e of Object.values(targetBot.entities)) {
    if (!e || !e.position) continue;
    const name = normalizeText(`${e.name || ''} ${e.displayName || ''}`);
    const isBobber = name.includes('fishing bobber') || name.includes('fishing_bobber');
    if (!isBobber) continue;

    const distance = e.position.distanceTo(targetBot.entity.position);
    if (distance > CONFIG.FISHING_BOBBER_SCAN_RADIUS || distance >= bestDistance) continue;
    best = e;
    bestDistance = distance;
  }

  return best ? best.id : null;
}

function isBiteParticle(packet, bobberEntity) {
  if (!bobberEntity || !bobberEntity.position) return false;
  const pos = bobberEntity.position;
  const amount = packet.amount ?? packet.particles ?? 0;
  const particleName = normalizeText(packet.particle && packet.particle.type ? packet.particle.type : '');
  const particleId = packet.particleId;
  const registry = bot.registry || {};
  const fishingId = registry.particlesByName && registry.particlesByName.fishing && registry.particlesByName.fishing.id;
  const bubbleId = registry.particlesByName && registry.particlesByName.bubble && registry.particlesByName.bubble.id;
  const isFishingParticle = particleName.includes('fishing') || particleName.includes('bubble') || particleId === fishingId || particleId === bubbleId;
  if (!isFishingParticle || amount !== 6) return false;

  const x = Number(packet.x);
  const z = Number(packet.z);
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  return new Vec3(x, pos.y, z).distanceTo(pos) <= 1.35;
}

function packetSoundName(sound) {
  if (typeof sound === 'string') return sound;
  if (typeof sound === 'number') {
    const byId = bot.registry && bot.registry.soundsById && bot.registry.soundsById[sound];
    return byId ? byId.name || String(byId) : String(sound);
  }
  if (!sound || typeof sound !== 'object') return '';

  if (typeof sound.name === 'string') return sound.name;
  if (typeof sound.soundName === 'string') return sound.soundName;
  if (typeof sound.value === 'string') return sound.value;
  if (typeof sound.value === 'number') return packetSoundName(sound.value);
  if (typeof sound.id === 'number') return packetSoundName(sound.id);

  return '';
}

function isBiteSound(packet, bobberEntity) {
  if (!bobberEntity || !bobberEntity.position) return false;

  const soundName = packetSoundName(packet.sound);
  const soundId = typeof packet.sound === 'number'
    ? packet.sound
    : typeof packet.sound?.value === 'number'
      ? packet.sound.value
      : typeof packet.sound?.id === 'number'
        ? packet.sound.id
        : null;
  const splashId = bot.registry && bot.registry.soundsByName
    && bot.registry.soundsByName['entity.fishing_bobber.splash']
    && bot.registry.soundsByName['entity.fishing_bobber.splash'].id;

  const isSplash = soundName.includes('fishing_bobber.splash')
    || soundName.includes('bobber.splash')
    || soundName === '518'
    || soundId === splashId
    || soundId === 518;
  if (!isSplash) return false;

  const x = Number(packet.x) / 8;
  const z = Number(packet.z) / 8;
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;

  const dx = Math.abs(x - bobberEntity.position.x);
  const dz = Math.abs(z - bobberEntity.position.z);
  return Math.max(dx, dz) <= CONFIG.VALID_BITE_RANGE;
}

function packetPositionNearBobber(packet, bobberEntity) {
  if (!bobberEntity || !bobberEntity.position) return null;

  const rawX = Number(packet.x);
  const rawZ = Number(packet.z);
  if (!Number.isFinite(rawX) || !Number.isFinite(rawZ)) return null;

  const candidates = [
    { x: rawX, z: rawZ },
    { x: rawX / 8, z: rawZ / 8 },
  ];

  for (const candidate of candidates) {
    const dx = Math.abs(candidate.x - bobberEntity.position.x);
    const dz = Math.abs(candidate.z - bobberEntity.position.z);
    if (Math.max(dx, dz) <= CONFIG.VALID_BITE_RANGE + 1) {
      return { ...candidate, dx, dz };
    }
  }

  return null;
}

function debugBitePacket(kind, packet, bobberEntity) {
  if (!CONFIG.DEBUG_BITE_PACKETS) return;
  const near = packetPositionNearBobber(packet, bobberEntity);
  if (!near) return;

  if (kind === 'sound') {
    const soundName = packetSoundName(packet.sound);
    console.log(`[FISH_DEBUG] sound=${soundName || JSON.stringify(packet.sound)} near=${near.dx.toFixed(2)},${near.dz.toFixed(2)} raw=${packet.x},${packet.y},${packet.z}`);
    return;
  }

  const amount = packet.amount ?? packet.particles ?? 0;
  const particleName = normalizeText(packet.particle && packet.particle.type ? packet.particle.type : '');
  console.log(`[FISH_DEBUG] particle=${particleName || packet.particleId || 'unknown'} amount=${amount} near=${near.dx.toFixed(2)},${near.dz.toFixed(2)} raw=${packet.x},${packet.y},${packet.z}`);
}

function ticksToMs(ticks) {
  return Math.max(0, Number(ticks) || 0) * 50;
}

async function reelOnce(targetBot = bot, sessionId = botSessionId) {
  if (targetBot !== bot || sessionId !== botSessionId || !targetBot.entity || targetBot.currentWindow) {
    return { clicks: 0, stop: 'session-ended' };
  }
  targetBot.activateItem();
  lastReelAt = Date.now();
  await sleep(ticksToMs(CONFIG.RETRY_DELAY_TICKS));
  return { clicks: 1, stop: 'single-click' };
}

function inventorySignature(targetBot = bot) {
  if (!targetBot || !targetBot.inventory) return '';
  return targetBot.inventory.items()
    .map(item => `${item.slot}:${item.type}:${item.count}:${item.name}:${item.displayName || ''}`)
    .sort()
    .join('|');
}

async function reelAfterBite(bobberEntityId = null, reason = '', targetBot = bot, sessionId = botSessionId) {
  if (CONFIG.REEL_SKIP_IF_ALREADY_GONE && reason === 'bobber disappeared') {
    lastReelAt = Date.now();
    return { clicks: 0, stop: 'bobber-already-gone' };
  }

  if (!CONFIG.REEL_SPAM_ENABLED) {
    return reelOnce(targetBot, sessionId);
  }

  const beforeInventory = inventorySignature(targetBot);
  const endAt = Date.now() + CONFIG.REEL_SPAM_MS;
  const minClicks = Math.max(1, CONFIG.REEL_MIN_CLICKS);
  let clicks = 0;

  while (Date.now() < endAt && targetBot === bot && sessionId === botSessionId && targetBot.entity && !targetBot.currentWindow) {
    targetBot.activateItem();
    lastReelAt = Date.now();
    clicks += 1;
    await sleep(CONFIG.REEL_SPAM_INTERVAL_MS);

    if (clicks < minClicks) continue;
    if (CONFIG.REEL_STOP_ON_INVENTORY_CHANGE && inventorySignature(targetBot) !== beforeInventory) {
      return { clicks, stop: 'inventory-changed' };
    }
    if (CONFIG.REEL_STOP_ON_BOBBER_GONE && bobberEntityId && !targetBot.entities[bobberEntityId]) {
      return { clicks, stop: 'bobber-gone' };
    }
    if (CONFIG.REEL_STOP_ON_BOBBER_GONE && reason === 'bobber disappeared') {
      return { clicks, stop: 'bobber-disappeared' };
    }
  }

  const stop = targetBot === bot && sessionId === botSessionId ? 'time-cap' : 'session-ended';
  return { clicks, stop };
}

async function fishOnce() {
  const currentBot = bot;
  const sessionId = botSessionId;
  let bobberEntityId = getBobberEntityId(currentBot);
  if (!bobberEntityId) {
    const aimed = await aimAtFishingWater();
    if (!aimed) throw new Error('water target not found');
  }

  const adoptedExistingBobber = !!bobberEntityId;
  let finished = false;

  return new Promise((resolve, reject) => {
    let timeout = null;
    const castAt = adoptedExistingBobber
      ? Date.now() - CONFIG.MIN_BITE_AGE_MS
      : Date.now();
    const cleanup = () => {
      if (timeout) clearTimeout(timeout);
      currentBot._client.removeListener('spawn_entity', onSpawnEntity);
      currentBot._client.removeListener('world_particles', onParticles);
      currentBot._client.removeListener('sound_effect', onSoundEffect);
      currentBot._client.removeListener('entity_destroy', onEntityDestroy);
      if (cancelActiveFish === cancel) cancelActiveFish = null;
    };

    const cancel = () => {
      if (finished) return;
      finished = true;
      cleanup();
      resolve(null);
    };

    const finish = async reason => {
      if (finished) return;
      if (currentBot !== bot || sessionId !== botSessionId || !currentBot.entity) {
        cancel();
        return;
      }
      finished = true;
      cleanup();
      try {
        const catchDelayMs = ticksToMs(CONFIG.CATCH_DELAY_TICKS);
        if (catchDelayMs > 0) await sleep(catchDelayMs);
        const reel = await reelAfterBite(bobberEntityId || getBobberEntityId(currentBot), reason, currentBot, sessionId);
        resolve({ reason, ...reel });
      } catch (err) {
        reject(err);
      }
    };

    cancelActiveFish = cancel;
    timeout = setTimeout(() => {
      finish('patience timeout');
    }, Math.max(10, CONFIG.PATIENCE_SECONDS) * 1000);

    const onSpawnEntity = packet => {
      const bobberId = currentBot.registry.entitiesByName.fishing_bobber && currentBot.registry.entitiesByName.fishing_bobber.id;
      if (bobberId && packet.type === bobberId && !bobberEntityId) {
        bobberEntityId = packet.entityId;
      }
    };

    const onParticles = packet => {
      if (!['hybrid', 'particle'].includes(CONFIG.BITE_DETECTION_MODE)) return;
      if (Date.now() - castAt < CONFIG.MIN_BITE_AGE_MS) return;
      const id = bobberEntityId || getBobberEntityId(currentBot);
      const bobberEntity = id ? currentBot.entities[id] : null;
      debugBitePacket('particle', packet, bobberEntity);
      if (!isBiteParticle(packet, bobberEntity)) return;
      finish('bite particle');
    };

    const onSoundEffect = packet => {
      if (!['hybrid', 'sound'].includes(CONFIG.BITE_DETECTION_MODE)) return;
      if (Date.now() - castAt < CONFIG.MIN_BITE_AGE_MS) return;
      const id = bobberEntityId || getBobberEntityId(currentBot);
      const bobberEntity = id ? currentBot.entities[id] : null;
      debugBitePacket('sound', packet, bobberEntity);
      if (!isBiteSound(packet, bobberEntity)) return;
      finish('bite sound');
    };

    const onEntityDestroy = packet => {
      if (!bobberEntityId) return;
      if (packet.entityIds && packet.entityIds.includes(bobberEntityId)) {
        if (!adoptedExistingBobber && Date.now() - castAt < CONFIG.MIN_BITE_AGE_MS) {
          cleanup();
          finished = true;
          reject(new Error('bobber disappeared too early'));
          return;
        }
        finish('bobber disappeared');
      }
    };

    currentBot._client.on('spawn_entity', onSpawnEntity);
    currentBot._client.on('world_particles', onParticles);
    currentBot._client.on('sound_effect', onSoundEffect);
    currentBot._client.on('entity_destroy', onEntityDestroy);
    if (!bobberEntityId) {
      currentBot.activateItem();
    }
  });
}

function startFishingLoop(sessionId = botSessionId) {
  if (fishingRunning || !bot) return;
  fishingRunning = true;
  const loopSession = ++fishingLoopSession;
  console.log('[FISH] Started.');

  (async () => {
    while (fishingRunning && bot && bot.entity && sessionId === botSessionId && loopSession === fishingLoopSession) {
      try {
        if (trashRunning || bot.currentWindow) {
          await sleep(500);
          continue;
        }

        const atSpot = await ensureFishingSpot();
        if (!atSpot) {
          await sleep(1000);
          continue;
        }

        const hasRod = await equipFishingRod();
        if (!hasRod) {
          await sleep(CONFIG.NO_ROD_RETRY_MS);
          continue;
        }

        const reelCooldownLeft = CONFIG.POST_REEL_COOLDOWN_MS - (Date.now() - lastReelAt);
        if (reelCooldownLeft > 0 && !getBobberEntityId()) {
          await sleep(reelCooldownLeft);
        }

        const result = await fishOnce();
        if (!result || !fishingRunning || sessionId !== botSessionId || loopSession !== fishingLoopSession) break;
        console.log(`[FISH] Reel: ${result.reason} | clicks=${result.clicks} | stop=${result.stop}`);
        await sleep(CONFIG.LOOP_PAUSE_MS);
      } catch (err) {
        if (!fishingRunning || sessionId !== botSessionId || loopSession !== fishingLoopSession) break;
        console.log(`[FISH] Retry: ${err.message}`);
        await sleep(Math.max(1200, ticksToMs(CONFIG.RETRY_DELAY_TICKS)));
      }
    }
  })().catch(err => console.log('[FISH] Loop failed:', err.message));
}

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[BOT] Stopping (${signal})...`);
  fishingRunning = false;
  resetState();
  clearMovement();
  if (bot) bot.quit();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

createBot();
