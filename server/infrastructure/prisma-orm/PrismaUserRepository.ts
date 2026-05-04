import { prisma } from './prismaClient';
import { User, UserRole } from '../../../domain/entities/User';
import { IUserRepository } from '../../application/repositories/IUserRepository';

export class PrismaUserRepository implements IUserRepository {
	async findById(id: string): Promise<User | null> {
		const row = await prisma.user.findUnique({ where: { id } });
		if (!row) return null;
		return {
			id: row.id,
			email: row.email,
			name: row.name,
			image: row.image,
			role: row.role as UserRole,
			emailVerified: row.emailVerified,
			createdAt: row.createdAt,
		};
	}

	async deleteById(id: string): Promise<void> {
		await prisma.user.delete({ where: { id } });
	}
}
