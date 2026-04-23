import { auth } from '../../../auth';
import { IAuthContext, AuthenticatedUser } from '../../application/ports/IAuthContext';

export class NextAuthContext implements IAuthContext {
	async getUser(): Promise<AuthenticatedUser | null> {
		const session = await auth();
		if (!session?.user?.id) return null;
		return {
			id: session.user.id,
			email: session.user.email ?? '',
			role: (session.user.role as 'USER' | 'ADMIN') ?? 'USER',
		};
	}

	async requireUser(): Promise<AuthenticatedUser> {
		const user = await this.getUser();
		if (!user) throw new Error('unauthenticated');
		return user;
	}

	async requireAdmin(): Promise<AuthenticatedUser> {
		const user = await this.requireUser();
		if (user.role !== 'ADMIN') throw new Error('forbidden');
		return user;
	}
}
