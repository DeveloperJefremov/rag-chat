import { NextResponse } from 'next/server';
import {
	ingestionService,
	chatSessionRepo,
	documentRepo,
	sessionService,
} from '@/server/infrastructure/http/container';
import { FileType } from '@/domain/value-objects/FileType';
import { ChunkingStrategy } from '@/domain/value-objects/ChunkingStrategy';
import { MAX_FILE_SIZE_MB, SUPPORTED_FILE_TYPES } from '@/shared/config/constants';
import { verifyFileSignature } from '@/shared/lib/fileSignature';
import { withAuth } from '@/shared/http/withAuth';

const EXT_TO_FILE_TYPE: Record<string, FileType> = {
	pdf: 'PDF',
	txt: 'TXT',
	docx: 'DOCX',
};

export const POST = withAuth(async (req, { user }) => {
	const formData = await req.formData();
	const file = formData.get('file') as File | null;
	const attachToSession = (formData.get('attachToSession') as string | null) || undefined;
	const chunkingStrategy =
		(formData.get('chunkingStrategy') as ChunkingStrategy | null) ?? 'RECURSIVE';

	if (!file) {
		return NextResponse.json({ error: 'no_file' }, { status: 400 });
	}

	if (attachToSession) {
		const session = await chatSessionRepo.findById(attachToSession, user.id);
		if (!session) {
			return NextResponse.json({ error: 'session_not_found' }, { status: 404 });
		}
		const attachedCount = await documentRepo.countAttached(attachToSession);
		await sessionService.validateAttachedLimit(user.role, attachedCount);
	}

	const docCount = await documentRepo.countByUser(user.id);
	await sessionService.validateDocumentsLimit(user.id, user.role, docCount);

	const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
	if (!SUPPORTED_FILE_TYPES.includes(ext as (typeof SUPPORTED_FILE_TYPES)[number])) {
		return NextResponse.json(
			{ error: 'unsupported_file_type', supported: SUPPORTED_FILE_TYPES },
			{ status: 400 },
		);
	}

	const sizeMB = file.size / (1024 * 1024);
	if (sizeMB > MAX_FILE_SIZE_MB) {
		return NextResponse.json({ error: 'file_too_large', maxMB: MAX_FILE_SIZE_MB }, { status: 400 });
	}

	const buffer = Buffer.from(await file.arrayBuffer());
	const fileType = EXT_TO_FILE_TYPE[ext];

	if (!verifyFileSignature(buffer, fileType)) {
		return NextResponse.json(
			{ error: 'file_signature_mismatch', expected: fileType },
			{ status: 400 },
		);
	}

	const result = await ingestionService.ingest({
		buffer,
		fileName: file.name,
		fileType,
		userId: user.id,
		chunkingStrategy,
		attachToSession,
	});

	return NextResponse.json(result, { status: 201 });
}, 'ingest');
