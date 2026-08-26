const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

let level = LEVELS[process.env.LOG_LEVEL || 'info'] || 20;

export function setLevel(l) {
  level = LEVELS[l] || 20;
}

function write(lvl, message, meta) {
  if (LEVELS[lvl] < level) return;
  const line = {
    ts: new Date().toISOString(),
    level: lvl,
    message,
    ...(meta ? { ...meta } : {}),
  };
  const text = JSON.stringify(line);
  if (lvl === 'error') process.stderr.write(text + '\n');
  else process.stdout.write(text + '\n');
}

export const logger = {
  debug: (m, meta) => write('debug', m, meta),
  info: (m, meta) => write('info', m, meta),
  warn: (m, meta) => write('warn', m, meta),
  error: (m, meta) => write('error', m, meta),
};

export function logEvent(message, meta) {
  logger.info(message, meta);
}
