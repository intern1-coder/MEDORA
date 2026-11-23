import { checkDatabaseConnection } from '../config/database';

export interface HealthStatus {
  status: 'ok' | 'degraded';
  uptime: number;
  timestamp: string;
  version: string;
  database?: {
    connected: boolean;
    error?: string;
  };
}

export async function getHealthStatus(includeDb = false): Promise<HealthStatus> {
  const status: HealthStatus = {
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    version: '0.1.0'
  };

  if (includeDb) {
    const dbCheck = await checkDatabaseConnection();
    status.database = {
      connected: dbCheck.isConnected,
      ...(dbCheck.message ? { error: dbCheck.message } : {})
    };
    if (!dbCheck.isConnected) {
      status.status = 'degraded';
    }
  }

  return status;
}
