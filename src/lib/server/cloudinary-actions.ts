import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { createHash } from 'crypto';

const signatureSchema = z.object({
  paramsToSign: z.record(z.any()),
});

export const getCloudinarySignatureAction = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => signatureSchema.parse(d))
  .handler(async ({ data }) => {
    const { paramsToSign } = data;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!apiSecret) {
      throw new Error('CLOUDINARY_API_SECRET is not configured on the server.');
    }

    // 1. Sort the parameters alphabetically by key
    const sortedKeys = Object.keys(paramsToSign).sort();
    
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
  });
