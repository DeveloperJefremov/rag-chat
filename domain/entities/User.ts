export type UserRole = 'USER' | 'ADMIN';

export interface User {
	id: string;
	email: string;
	name: string | null;
	image: string | null;
	role: UserRole;
	emailVerified: Date | null;
	createdAt: Date;
}
