'use client';
import { Fragment } from 'react';
import { CitationDto } from '@/shared/dtos/CitationDto';

interface Props {
	text: string;
	animate: boolean;
	citations?: CitationDto[];
}

type Segment =
	| { kind: 'text'; value: string }
	| { kind: 'bold'; value: string }
	| { kind: 'code'; value: string }
	| { kind: 'cite'; index: number; raw: string };

const SEGMENT_RE = /(\*\*[^*]+\*\*|`[^`]+`|\[\d+\])/g;

function parseSegments(text: string): Segment[] {
	const parts = text.split(SEGMENT_RE);
	return parts.map(p => {
		if (p.startsWith('**') && p.endsWith('**')) {
			return { kind: 'bold' as const, value: p.slice(2, -2) };
		}
		if (p.startsWith('`') && p.endsWith('`')) {
			return { kind: 'code' as const, value: p.slice(1, -1) };
		}
		const citeMatch = /^\[(\d+)\]$/.exec(p);
		if (citeMatch) {
			return { kind: 'cite' as const, index: Number(citeMatch[1]), raw: p };
		}
		return { kind: 'text' as const, value: p };
	});
}

function splitTokens(value: string): string[] {
	const matches = value.match(/(\s+|\S+)/g);
	return matches ?? [];
}

function renderTokens(value: string, animate: boolean, keyPrefix: string) {
	if (!animate) return value;
	const tokens = splitTokens(value);
	return tokens.map((tok, i) =>
		/^\s+$/.test(tok) ? (
			<Fragment key={`${keyPrefix}-${i}`}>{tok}</Fragment>
		) : (
			<span key={`${keyPrefix}-${i}`} className='token-in'>
				{tok}
			</span>
		),
	);
}

function CiteChip({ name, animate }: { name: string; animate: boolean }) {
	return (
		<span className={animate ? 'token-in' : undefined} style={{ display: 'inline-block' }}>
			<span
				className='border-cobalt-700/30 bg-cobalt-700/8 text-cobalt-800 mx-0.5 inline-flex items-center rounded-full border px-1.5 py-px align-baseline font-mono text-[10px] font-medium tracking-[0.02em]'
				title={name}
			>
				{name}
			</span>
		</span>
	);
}

export function StreamingText({ text, animate, citations }: Props) {
	const segments = parseSegments(text);
	return (
		<>
			{segments.map((seg, i) => {
				if (seg.kind === 'bold') {
					return <strong key={i}>{renderTokens(seg.value, animate, `b${i}`)}</strong>;
				}
				if (seg.kind === 'code') {
					return (
						<code
							key={i}
							className='text-cobalt-700 rounded-[3px] bg-[rgba(26,46,92,0.08)] px-1.5 py-px font-mono text-[0.88em]'
						>
							{renderTokens(seg.value, animate, `c${i}`)}
						</code>
					);
				}
				if (seg.kind === 'cite') {
					const cite = citations?.[seg.index - 1];
					if (!cite) {
						return <Fragment key={i}>{renderTokens(seg.raw, animate, `r${i}`)}</Fragment>;
					}
					return <CiteChip key={i} name={cite.documentName} animate={animate} />;
				}
				return <Fragment key={i}>{renderTokens(seg.value, animate, `t${i}`)}</Fragment>;
			})}
		</>
	);
}
