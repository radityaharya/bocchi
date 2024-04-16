/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from 'axios';
import fs from 'fs';
import os from 'os';
import path from 'path';
import mime from 'mime-types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Downloads file from the specified URL and saves it as a temporary file.
 * @param url - The URL of the image to download.
 * @returns A promise that resolves to the path of the temporary file, the MIME type, the buffer, and the base64 string.
 * @throws If there is an error while fetching or saving the image.
 */
export async function tempFile(
  url: string,
): Promise<{ path: string; mimeType: string; buffer: Buffer; base64: string }> {
  let response;
  try {
    response = await axios.get(url, { responseType: 'arraybuffer' });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Failed to fetch the file at url: ${url}. Error: ${error.message}`,
      );
    }
    throw error;
  }

  const buffer = response.data;
  const mimeType = response.headers['content-type'];
  const extension = mime.extension(mimeType);

  if (!extension) {
    throw new Error(`Unsupported MIME type: ${mimeType}`);
  }

  const filename = `${uuidv4()}.${extension}`;
  const tempFilePath = path.join(os.tmpdir(), filename);

  try {
    fs.writeFileSync(tempFilePath, buffer);
  } catch (error: any) {
    throw new Error(
      `Failed to write the file at path: ${tempFilePath}. Error: ${error.message}`,
    );
  }

  const base64 = buffer.toString('base64');

  return {
    path: tempFilePath,
    mimeType,
    buffer,
    base64,
  };
}
