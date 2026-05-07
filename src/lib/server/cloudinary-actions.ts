import { z } from 'zod';
import { createHash } from 'crypto';

const signatureSchema = z.object({
  paramsToSign: z.object({
    timestamp: z.number().int().positive(),
    folder: z.string().min(7).max(120).regex(/^edunook(\/[a-z0-9_-]+)*$/i, 'Invalid upload folder'),
  }),
});

export async function getCloudinarySignatureAction({ data }: { data: unknown }) {
    const { paramsToSign } = signatureSchema.parse(data);
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!apiSecret) {
      throw new Error('CLOUDINARY_API_SECRET is not configured on the server.');
    }
    if (!process.env.CLOUDINARY_API_KEY) {
      throw new Error('CLOUDINARY_API_KEY is not configured on the server.');
    }

    const now = Math.round(Date.now() / 1000);
    if (Math.abs(now - paramsToSign.timestamp) > 300) {
      throw new Error('Upload signature request expired.');
    }

    // 1. Sort the parameters alphabetically by key
    const sortedKeys = Object.keys(paramsToSign).sort() as Array<keyof typeof paramsToSign>;
    
    // 2. Create the string to sign: key1=value1&key2=value2...API_SECRET
    const stringToSign = sortedKeys
      .map(key => `${key}=${paramsToSign[key]}`)
      .join('&') + apiSecret;

    // 3. Generate SHA-1 hash
    const signature = createHash('sha1').update(stringToSign).digest('hex');

    return {
      signature,
      timestamp: paramsToSign.timestamp,
      apiKey: process.env.CLOUDINARY_API_KEY,
    };
}
