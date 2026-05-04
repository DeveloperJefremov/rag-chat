import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { IP_RATE_LIMIT_RPM } from '../config/constants';

let ratelimit: Ratelimit | null = null;
let warned = false;

function getRatelimit(): Ratelimit | null {
	if (ratelimit) return ratelimit;
	const url = process.env.UPSTASH_REDIS_REST_URL;
	const token = process.env.UPSTASH_REDIS_REST_TOKEN;
	if (!url || !token) {
		if (!warned) {
			warned = true;
			// eslint-disable-next-line no-console
			console.warn(
				'[ratelimit] UPSTASH_REDIS_REST_URL/TOKEN not set — IP rate limit is DISABLED. Set both env vars for production.',
			);
		}
		return null;
	}
	ratelimit = new Ratelimit({
		redis: new Redis({ url, token }),
		limiter: Ratelimit.slidingWindow(IP_RATE_LIMIT_RPM, '1 m'),
		analytics: true,
		prefix: 'ratelimit:ip',
	});
	return ratelimit;
}

export async function checkIpRateLimit(
	ip: string,
): Promise<{ allowed: boolean; remaining: number }> {
	const rl = getRatelimit();
	if (!rl) {
		return { allowed: true, remaining: IP_RATE_LIMIT_RPM };
	}
	try {
		const { success, remaining } = await rl.limit(ip);
		return { allowed: success, remaining };
	} catch (err) {
		// eslint-disable-next-line no-console
		console.warn('[ratelimit] upstash check failed, fail-open:', err);
		return { allowed: true, remaining: IP_RATE_LIMIT_RPM };
	}
}
