import 'dotenv/config';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '../prisma/generated/prisma/client.js';

const pooled = process.env.DATABASE_URL;
const direct = process.env.DIRECT_URL;

console.log('Pooled host:', new URL(pooled).host);
console.log('Direct host:', new URL(direct).host);

async function listTables(label, connectionString) {
	const adapter = new PrismaNeon({ connectionString });
	const client = new PrismaClient({ adapter });
	try {
		const rows = await client.$queryRawUnsafe(
			"SELECT current_database()::text AS db, current_schema()::text AS schema, tablename::text AS tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
		);
		console.log(`\n[${label}] db=${rows[0]?.db} schema=${rows[0]?.schema}`);
		console.log(`[${label}] tables:`, rows.map(r => r.tablename).join(', ') || '(none)');
	} catch (e) {
		console.error(`[${label}] ERROR`, e.message);
	} finally {
		await client.$disconnect();
	}
}

await listTables('pooled (DATABASE_URL)', pooled);
await listTables('direct (DIRECT_URL)', direct);

const adapter = new PrismaNeon({ connectionString: pooled });
const client = new PrismaClient({ adapter });
const ext = await client.$queryRawUnsafe(
	"SELECT extname::text AS name, extversion::text AS version FROM pg_extension"
);
console.log('\nextensions:', ext);
const mig = await client.$queryRawUnsafe(
	"SELECT migration_name::text, finished_at, applied_steps_count, logs FROM _prisma_migrations"
);
console.log('migrations:', mig);
await client.$disconnect();
