import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from './server/infrastructure/prisma-orm/prismaClient';
import authConfig from './auth.config';

export const { handlers, auth, signIn, signOut } = NextAuth({
	adapter: PrismaAdapter(prisma),
	...authConfig,
});
