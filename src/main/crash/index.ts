import { crashReporter, app } from 'electron';
import { join } from 'path';

export function setupCrashReporter(): void {
  crashReporter.start({
    productName: 'Electron Vue App',
    companyName: 'Your Company',
    submitURL: '',
    uploadToServer: false,
  });

  console.log('崩溃报告已初始化');
  console.log(`崩溃日志路径: ${join(app.getPath('userData'), 'crashes')}`);
}

export function getCrashReports(): string[] {
  return [];
}
