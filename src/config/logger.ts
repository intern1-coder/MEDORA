import { env } from './env';

type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

const logLevels: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60
};

const currentLevelThreshold = logLevels[env.LOG_LEVEL as LogLevel] || 30;

function formatLog(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  if (logLevels[level] < currentLevelThreshold) {
    return;
  }

  const logEntry = {
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    message,
    ...(meta && Object.keys(meta).length > 0 ? { meta } : {})
  };

  const output = JSON.stringify(logEntry);
  if (level === 'error' || level === 'fatal') {
    // eslint-disable-next-line no-console
    console.error(output);
  } else if (level === 'warn') {
    // eslint-disable-next-line no-console
    console.warn(output);
  } else {
    // eslint-disable-next-line no-console
    console.log(output);
  }
}

export const logger = {
  trace: (message: string, meta?: Record<string, unknown>) => formatLog('trace', message, meta),
  debug: (message: string, meta?: Record<string, unknown>) => formatLog('debug', message, meta),
  info: (message: string, meta?: Record<string, unknown>) => formatLog('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => formatLog('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => formatLog('error', message, meta),
  fatal: (message: string, meta?: Record<string, unknown>) => formatLog('fatal', message, meta)
};
