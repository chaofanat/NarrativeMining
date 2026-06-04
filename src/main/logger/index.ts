import log from 'electron-log';
import { app } from 'electron';
import { join } from 'path';

export function setupLogger(): typeof log {
  log.transports.file.resolvePathFn = () => {
    return join(app.getPath('userData'), 'logs', 'main.log');
  };

  log.transports.file.level = 'info';
  log.transports.console.level = 'debug';

  log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
  log.transports.console.format = '[{h}:{i}:{s}.{ms}] [{level}] {text}';

  log.transports.file.maxSize = 10 * 1024 * 1024;

  log.info('日志系统已初始化');
  log.info(`应用版本: ${app.getVersion()}`);

  return log;
}

export type Logger = typeof log;
