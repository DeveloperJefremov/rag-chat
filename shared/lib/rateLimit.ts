import { IP_RATE_LIMIT_RPM } from '../config/constants';

interface RateLimitEntry {
	count: number;
	resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

export function checkIpRateLimit(ip: string): { allowed: boolean; remaining: number } {
	const now = Date.now();
	const windowMs = 60 * 1000;

	const entry = store.get(ip);

	if (!entry || now > entry.resetAt) {
		store.set(ip, { count: 1, resetAt: now + windowMs });
		return { allowed: true, remaining: IP_RATE_LIMIT_RPM - 1 };
	}

	if (entry.count >= IP_RATE_LIMIT_RPM) {
		return { allowed: false, remaining: 0 };
	}

	entry.count += 1;
	return { allowed: true, remaining: IP_RATE_LIMIT_RPM - entry.count };
}
