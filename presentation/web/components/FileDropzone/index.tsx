'use client';
import clsx from 'clsx';
import { ChangeEvent, DragEvent, useRef, useState } from 'react';

const ACCEPTED = '.pdf,.txt,.docx';
const MAX_MB = 10;

interface FileDropzoneProps {
	onFile: (file: File) => void;
	disabled?: boolean;
	uploading?: boolean;
	progress?: number;
}

export function FileDropzone({
	onFile,
	disabled = false,
	uploading = false,
	progress = 0,
}: FileDropzoneProps) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [dragging, setDragging] = useState(false);
	const [validationError, setValidationError] = useState<string | null>(null);

	const validate = (file: File): string | null => {
		const ext = file.name.split('.').pop()?.toLowerCase();
		if (!['pdf', 'txt', 'docx'].includes(ext ?? '')) {
			return 'Only PDF, TXT, and DOCX files are supported.';
		}
		if (file.size > MAX_MB * 1024 * 1024) {
			return `File must be smaller than ${MAX_MB} MB.`;
		}
		return null;
	};

	const handleFile = (file: File) => {
		const err = validate(file);
		if (err) {
			setValidationError(err);
			return;
		}
		setValidationError(null);
		onFile(file);
	};

	const handleDrop = (e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setDragging(false);
		const file = e.dataTransfer.files[0];
		if (file) handleFile(file);
	};

	const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) handleFile(file);
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
			<input
				ref={inputRef}
				type='file'
				accept={ACCEPTED}
				onChange={handleChange}
				className='hidden'
			/>
			{uploading ? (
				<>
					<div className='border-powder-200 border-t-cobalt-700 h-9 w-9 animate-[spin_0.8s_linear_infinite] rounded-full border-[3px]' />
					<div className='text-cobalt-800 text-[13px] font-medium'>Indexing…</div>
					<div className='bg-powder-200 h-1 w-[180px] overflow-hidden rounded-[2px]'>
						<div
							className='bg-terracotta-500 h-full rounded-[2px] transition-[width] duration-200'
							style={{ width: `${progress}%` }}
						/>
					</div>
					<div className='text-smoke font-mono text-[10px] tracking-[0.1em]'>
						{progress}% · chunking · embedding
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
							PDF · TXT · DOCX — up to {MAX_MB} MB
						</div>
					</div>
					{validationError && (
						<div className='text-terracotta-600 font-mono text-[10px] tracking-[0.08em]'>
							{validationError}
						</div>
					)}
				</>
			)}
		</div>
	);
}
