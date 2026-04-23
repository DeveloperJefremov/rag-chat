'use client';
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { IngestResponseDto } from '@/shared/dtos/IngestResponseDto';

interface DocumentTableProps {
	documents: IngestResponseDto[];
}

export function DocumentTable({ documents }: DocumentTableProps) {
	const [expandedId, setExpandedId] = useState<string | null>(null);

	if (documents.length === 0) {
		return (
			<div className='text-muted-foreground py-8 text-center text-sm'>
				No documents uploaded yet.
			</div>
		);
	}

	return (
		<div className='overflow-hidden rounded-lg border'>
			<table className='w-full text-sm'>
				<thead className='bg-muted/50'>
					<tr>
						<th className='text-muted-foreground px-4 py-2.5 text-left text-xs font-medium'>
							Name
						</th>
						<th className='text-muted-foreground px-4 py-2.5 text-left text-xs font-medium'>
							Chunks
						</th>
						<th className='text-muted-foreground px-4 py-2.5 text-left text-xs font-medium'>
							Strategy
						</th>
					</tr>
				</thead>
				<tbody className='divide-y'>
					{documents.map(doc => (
						<>
							<tr
								key={doc.documentId}
								className='hover:bg-muted/30 cursor-pointer'
								onClick={() => setExpandedId(expandedId === doc.documentId ? null : doc.documentId)}
							>
								<td className='flex items-center gap-2 px-4 py-3'>
									{expandedId === doc.documentId ? (
										<ChevronDown className='text-muted-foreground h-3.5 w-3.5 shrink-0' />
									) : (
										<ChevronRight className='text-muted-foreground h-3.5 w-3.5 shrink-0' />
									)}
									{doc.name}
								</td>
								<td className='text-muted-foreground px-4 py-3'>{doc.chunkCount}</td>
								<td className='px-4 py-3'>
									<span className='bg-muted rounded px-2 py-0.5 font-mono text-xs'>
										{doc.chunkingStrategy ?? '—'}
									</span>
								</td>
							</tr>
							{expandedId === doc.documentId && (
								<tr key={`${doc.documentId}-detail`}>
									<td colSpan={3} className='bg-muted/20 px-4 py-3'>
										<p className='text-muted-foreground text-xs'>
											Document ID: <code className='font-mono'>{doc.documentId}</code>
											{' · '}
											{doc.chunkCount} chunks indexed.
										</p>
									</td>
								</tr>
							)}
						</>
					))}
				</tbody>
			</table>
		</div>
	);
}
