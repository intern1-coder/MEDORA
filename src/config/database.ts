import { PrismaClient } from '@prisma/client';
import { env } from './env';

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

export const prisma =
  globalThis.prismaGlobal ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
  });

if (env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma;
}

export async function checkDatabaseConnection(): Promise<{ isConnected: boolean; message?: string }> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { isConnected: true };
  } catch (err: unknown) {
    const error = err as Error;
    return { isConnected: false, message: error.message };
  }
}
