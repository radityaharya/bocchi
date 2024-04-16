import { PrismaClient } from '@prisma/client';
// import logger from './logger';

const prisma = new PrismaClient();

export async function setAttachmentMetadata(
  messageId: string,
  metadata: string,
) {
  console.log(`Setting metadata for messageId: ${messageId}`);
  const newMetadata = await prisma.analyzedAttachmentMetadata.create({
    data: {
      messageId,
      metadata,
    },
  });
  return newMetadata;
}

export async function getAnalyzedAttachmentMetadataByMessageId(
  messageId: string,
) {
  console.log(`Finding metadata for messageId: ${messageId}`);
  const metadata = await prisma.analyzedAttachmentMetadata.findFirst({
    where: { messageId },
  });

  console.log(`metadata: ${metadata}`);
  return metadata;
}
