import axios from 'axios';
import { createWriteStream } from 'node:fs';
import { rm, stat } from 'node:fs/promises';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export class DownloadSizeLimitError extends Error {}

export const downloadFileToPath = async (
  fileUrls: string[],
  destination: string,
  maxBytes = Number.POSITIVE_INFINITY,
  signal?: AbortSignal,
): Promise<number> => {
  let lastError: unknown;

  for (const fileUrl of fileUrls.filter(Boolean)) {
    let responseStream: Readable | undefined;
    try {
      const response = await axios.get<Readable>(fileUrl, {
        responseType: 'stream',
        maxRedirects: 5,
        timeout: 30000,
        signal,
        validateStatus: (status) => status >= 200 && status < 300,
      });
      responseStream = response.data;
      let downloadedBytes = 0;
      const sizeLimit = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          downloadedBytes += chunk.length;
          if (downloadedBytes > maxBytes) {
            callback(new DownloadSizeLimitError('Submission file exceeds the ZIP export size limit.'));
            return;
          }
          callback(null, chunk);
        },
      });
      const destinationStream = createWriteStream(destination, { flags: 'wx' });
      if (signal) {
        await pipeline(responseStream, sizeLimit, destinationStream, { signal });
      } else {
        await pipeline(responseStream, sizeLimit, destinationStream);
      }

      const downloadedFile = await stat(destination);
      if (downloadedFile.size > 0) return downloadedFile.size;
      throw new Error('Cloudinary returned an empty file.');
    } catch (error) {
      responseStream?.destroy();
      await rm(destination, { force: true });
      if (signal?.aborted || error instanceof DownloadSizeLimitError) throw error;
      lastError = error;
    }
  }

  throw lastError || new Error('No Cloudinary download URL is available.');
};
