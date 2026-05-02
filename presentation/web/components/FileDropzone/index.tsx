'use client';
import clsx from 'clsx';
import { ChangeEvent, DragEvent, useRef, useState } from 'react';
import { BrandInput } from '@/presentation/web/components/ui/BrandInput';

const ACCEPTED = '.pdf,.txt,.docx';
const MAX_MB = 10;

interface FileDropzoneProps {
	onFiles: (files: File[]) => void;
	disabled?: boolean;
	uploading?: boolean;
}

interface RejectedFile {
	name: string;
	reason: string;
}

function validate(file: File): string | null {
	const ext = file.name.split('.').pop()?.toLowerCase();
	if (!['pdf', 'txt', 'docx'].includes(ext ?? '')) {
		return 'unsupported type';
	}
	if (file.size > MAX_MB * 1024 * 1024) {
		return `larger than ${MAX_MB} MB`;
	}
	return null;
}

export function FileDropzone({ onFiles, disabled = false, uploading = false }: FileDropzoneProps) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [dragging, setDragging] = useState(false);
	const [rejected, setRejected] = useState<RejectedFile[]>([]);

	const handleFiles = (list: FileList | null) => {
		if (!list || list.length === 0) return;
		const accepted: File[] = [];
		const errs: RejectedFile[] = [];
		for (const f of Array.from(list)) {
			const err = validate(f);
			if (err) errs.push({ name: f.name, reason: err });
			else accepted.push(f);
		}
		setRejected(errs);
		if (accepted.length > 0) onFiles(accepted);
	};

	const handleDrop = (e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setDragging(false);
		handleFiles(e.dataTransfer.files);
	};

	const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
		handleFiles(e.target.files);
		e.target.value = '';
	};

	return (
		<div
			onDragOver={e => {
				e.preventDefault();
				setDragging(true);
			}}
			onDragLeave={() => setDragging(false)}
			onDrop={handleDrop}
			onClick={() => !disabled && !uploading && inputRef.current?.click()}
			className={clsx(
				'desk:min-h-[160px] desk:p-9 flex min-h-[120px] flex-col items-center justify-center gap-3 rounded-[10px] border-2 border-dashed p-6 transition-[border-color,background]',
				dragging ? 'border-cobalt-500 bg-powder-100' : 'border-powder-300 bg-paper',
				disabled || uploading ? 'cursor-default' : 'cursor-pointer',
				disabled && 'opacity-50',
			)}
		>
			<BrandInput
				ref={inputRef}
				type='file'
				accept={ACCEPTED}
				multiple
				onChange={handleChange}
				className='hidden'
			/>
			{uploading ? (
				<>
					<div className='border-powder-200 border-t-cobalt-700 h-9 w-9 animate-[spin_0.8s_linear_infinite] rounded-full border-[3px]' />
					<div className='text-cobalt-800 text-[13px] font-medium' aria-live='polite'>
						Indexing…
					</div>
					<div
						className='bg-powder-200 progress-indeterminate h-1 w-[180px] rounded-[2px]'
						role='progressbar'
						aria-label='Uploading and indexing'
					/>
					<div className='text-smoke font-mono text-[10px] tracking-[0.1em]'>
						chunking · embedding
					</div>
				</>
			) : (
				<>
					<svg
						width='32'
						height='32'
						viewBox='0 0 24 24'
						fill='none'
						stroke='currentColor'
						strokeWidth='1.5'
						className='text-powder-400'
					>
						<path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' />
						<polyline points='17 8 12 3 7 8' />
						<line x1='12' y1='3' x2='12' y2='15' />
					</svg>
					<div className='text-center'>
						<div className='text-cobalt-800 mb-1 text-sm font-medium'>
							Drop files here, or click to browse
						</div>
						<div className='text-smoke font-mono text-[10px] tracking-[0.1em] uppercase'>
							PDF · TXT · DOCX — up to {MAX_MB} MB · multiple supported
						</div>
					</div>
					{rejected.length > 0 && (
						<ul
							className='text-terracotta-600 flex max-w-full flex-col gap-0.5 font-mono text-[10px] tracking-[0.04em]'
							aria-live='polite'
						>
							{rejected.map(r => (
								<li key={r.name} className='truncate'>
									{r.name} — {r.reason}
								</li>
							))}
						</ul>
					)}
				</>
			)}
		</div>
	);
}
