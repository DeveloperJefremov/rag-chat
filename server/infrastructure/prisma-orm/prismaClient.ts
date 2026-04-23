import { neonConfig, Pool } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '../../../prisma/generated/prisma';

function createPrismaClient() {
	if (process.env.NODE_ENV !== 'production') {
		neonConfig.wsProxy = (host: string) => `${host}/v1`;
		neonConfig.useSecureWebSocket = false;
		neonConfig.pipelineTLS = false;
		neonConfig.pipelineConnect = false;
	}

	const pool = new Pool({ connectionString: process.env.DATABASE_URL });
	const adapter = new PrismaNeon(pool as unknown as ConstructorParameters<typeof PrismaNeon>[0]);
	return new PrismaClient({
		adapter,
		log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
	});
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
