import axios from 'axios';
import { createWriteStream } from 'node:fs';
import { rm, stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export const downloadFileToPath = async (fileUrls: string[], destination: string): Promise<void> => {
  let lastError: unknown;

  for (const fileUrl of fileUrls.filter(Boolean)) {
    let responseStream: Readable | undefined;
    try {
      const response = await axios.get<Readable>(fileUrl, {
        responseType: 'stream',
        maxRedirects: 5,
        timeout: 30000,
        validateStatus: (status) => status >= 200 && status < 300,
      });
      responseStream = response.data;
      await pipeline(responseStream, createWriteStream(destination, { flags: 'wx' }));

      const downloadedFile = await stat(destination);
      if (downloadedFile.size > 0) return;
      throw new Error('Cloudinary returned an empty file.');
    } catch (error) {
      responseStream?.destroy();
      await rm(destination, { force: true });
      lastError = error;
    }
  }

  throw lastError || new Error('No Cloudinary download URL is available.');
};
