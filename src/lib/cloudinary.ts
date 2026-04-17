// Cloudinary secure signed upload utility
// Uses TanStack Start server functions to sign requests securely

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '';

export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  format: string;
  resource_type: string;
  bytes: number;
}

export async function uploadToCloudinary(
  file: File,
  folder: string = 'edunook'
): Promise<CloudinaryUploadResult> {
  if (!CLOUD_NAME) {
    console.error('[Cloudinary] VITE_CLOUDINARY_CLOUD_NAME is missing from environment.');
    console.log('[Cloudinary] Available env keys:', Object.keys(import.meta.env).filter(k => k.startsWith('VITE_')));
    throw new Error('VITE_CLOUDINARY_CLOUD_NAME is not configured.');
  }

  // 1. Prepare parameters for signing
  const timestamp = Math.round(new Date().getTime() / 1000);
  const paramsToSign = {
    timestamp,
    folder,
  };

  // 2. Get signature from server (keep the Secret Key safe on the server!)
  const { getCloudinarySignatureAction } = await import('./server/cloudinary-actions');
  const { signature, apiKey } = await getCloudinarySignatureAction({ data: { paramsToSign } });

  if (!apiKey) {
    throw new Error('Cloudinary API Key not returned from server. Check CLOUDINARY_API_KEY in .env');
  }

  // 3. Prepare form data for upload
  const isVideo = file.type.startsWith('video/');
  const resourceType = isVideo ? 'video' : 'image';
  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', apiKey);
  formData.append('timestamp', timestamp.toString());
  formData.append('signature', signature);
  formData.append('folder', folder);

  // 4. Execute upload
  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Cloudinary upload failed: ${JSON.stringify(error)}`);
  }

  return response.json();
}
