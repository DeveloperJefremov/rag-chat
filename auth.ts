import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from './server/infrastructure/prisma-orm/prismaClient';

declare module 'next-auth' {
	interface Session {
		user: {
			id: string;
			email: string;
			name: string | null;
			image: string | null;
			role: 'USER' | 'ADMIN';
		};
	}

	interface User {
		role?: 'USER' | 'ADMIN';
	}
}

export const { handlers, auth, signIn, signOut } = NextAuth({
	adapter: PrismaAdapter(prisma),
	providers: [
		Google({
			clientId: process.env.AUTH_GOOGLE_ID!,
			clientSecret: process.env.AUTH_GOOGLE_SECRET!,
		}),
	],
	session: { strategy: 'jwt' },
	callbacks: {
		jwt({ token, user }) {
			if (user) {
				token.id = user.id;
				token.role = (user as { role?: string }).role ?? 'USER';
			}
			return token;
		},
		session({ session, token }) {
			if (token && session.user) {
				session.user.id = token.id as string;
				session.user.role = (token.role as 'USER' | 'ADMIN') ?? 'USER';
			}
			return session;
		},
	},
	pages: {
		signIn: '/signin',
	},
});
