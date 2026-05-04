import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '../../../prisma/generated/prisma';

function createPrismaClient() {
	if (!process.env.DATABASE_URL) {
		throw new Error('DATABASE_URL is not set');
	}

	const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
	return new PrismaClient({
		adapter,
		log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
	});
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
