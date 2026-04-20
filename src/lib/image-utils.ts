/**
 * Optimizes Cloudinary URLs with automatic format & quality transformations.
 * This reduces image payload by ~60-80% by serving WebP/AVIF where supported.
 * 
 * @param url - Original Cloudinary URL
 * @param width - Optional resize width
 * @returns Optimized URL with f_auto,q_auto transformations
 */
export function optimizeCloudinaryUrl(url: string | null | undefined, width?: number): string {
  if (!url) return '';
  
  // Only transform Cloudinary URLs
  if (!url.includes('res.cloudinary.com')) return url;
  
  // Don't double-transform
  if (url.includes('f_auto') || url.includes('q_auto')) return url;
  
  // Insert transformations before /upload/
  const parts = url.split('/upload/');
  if (parts.length !== 2) return url;
  
  const transforms = width 
    ? `f_auto,q_auto,w_${width},c_limit` 
    : 'f_auto,q_auto';
  
  return `${parts[0]}/upload/${transforms}/${parts[1]}`;
}
