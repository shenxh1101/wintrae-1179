import { OperationLog, SDKConfig } from '../types';
import { generateId } from '../utils';

export class Logger {
  private config: SDKConfig;

  constructor(config: SDKConfig) {
    this.config = config;
  }

  async log(data: Omit<OperationLog, 'id' | 'createTime'>): Promise<void> {
    const log: OperationLog = {
      ...data,
      id: generateId('log_'),
      createTime: Date.now(),
    };

    if (this.config.logCallback) {
      try {
        await this.config.logCallback(log);
      } catch (e) {
        console.error('[MemberGrowthSDK] logCallback error:', e);
      }
    }

    if (this.config.storage) {
      try {
        await this.config.storage.addOperationLog(log);
      } catch (e) {
        console.error('[MemberGrowthSDK] storage.addOperationLog error:', e);
      }
    }
  }

  logSync(data: Omit<OperationLog, 'id' | 'createTime'>): void {
    const log: OperationLog = {
      ...data,
      id: generateId('log_'),
      createTime: Date.now(),
    };

    if (this.config.logCallback) {
      try {
        const result = this.config.logCallback(log);
        if (result && typeof (result as Promise<void>).catch === 'function') {
          (result as Promise<void>).catch(e =>
            console.error('[MemberGrowthSDK] logCallback error:', e)
          );
        }
      } catch (e) {
        console.error('[MemberGrowthSDK] logCallback error:', e);
      }
    }

    if (this.config.storage) {
      try {
        this.config.storage.addOperationLog(log);
      } catch (e) {
        console.error('[MemberGrowthSDK] storage.addOperationLog error:', e);
      }
    }
  }
}
