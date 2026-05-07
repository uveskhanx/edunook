// Cloudinary secure signed upload utility
// Uses Next.js server actions to sign requests securely
import { publicEnv } from './public-env';

const CLOUD_NAME = publicEnv.cloudinaryCloudName || '';
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const ALLOWED_VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
const ALLOWED_FILE_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 250 * 1024 * 1024;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

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
    throw new Error('Cloudinary uploads are not configured.');
  }

  const isVideo = file.type.startsWith('video/');
  const isImage = file.type.startsWith('image/');
  if (isImage && (!ALLOWED_IMAGE_TYPES.has(file.type) || file.size > MAX_IMAGE_BYTES)) {
    throw new Error('Image uploads must be JPEG, PNG, WebP, or GIF and under 10 MB.');
  }
  if (isVideo && (!ALLOWED_VIDEO_TYPES.has(file.type) || file.size > MAX_VIDEO_BYTES)) {
    throw new Error('Video uploads must be MP4, WebM, or MOV and under 250 MB.');
  }
  if (!isImage && !isVideo && (!ALLOWED_FILE_TYPES.has(file.type) || file.size > MAX_FILE_BYTES)) {
    throw new Error('File uploads must be PDF, text, Word, or PowerPoint files under 25 MB.');
  }
  if (!/^edunook(\/[a-z0-9_-]+)*$/i.test(folder)) {
    throw new Error('Invalid upload folder.');
  }

  // 1. Prepare parameters for signing
  const timestamp = Math.round(new Date().getTime() / 1000);
  const paramsToSign = {
    timestamp,
    folder,
  };

  // 2. Get signature from the Next.js API route (keeps the Secret Key safe on the server)
  const { getCloudinarySignatureAction } = await import('./client-actions');
  const { signature, apiKey } = await getCloudinarySignatureAction({ data: { paramsToSign } });

  if (!apiKey) {
    throw new Error('Cloudinary API Key not returned from server. Check CLOUDINARY_API_KEY in .env');
  }

  // 3. Prepare form data for upload
  const resourceType = isVideo ? 'video' : isImage ? 'image' : 'raw';
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
