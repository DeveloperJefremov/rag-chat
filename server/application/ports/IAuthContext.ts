export type AuthUserRole = 'USER' | 'ADMIN';

export interface AuthenticatedUser {
	id: string;
	email: string;
	role: AuthUserRole;
}

export interface IAuthContext {
	getUser(): Promise<AuthenticatedUser | null>;
	requireUser(): Promise<AuthenticatedUser>;
	requireAdmin(): Promise<AuthenticatedUser>;
}
