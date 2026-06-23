/**
 * Adds f_auto,q_auto to Cloudinary image URLs so the CDN converts
 * HEIC/HEIF to a browser-compatible format (WebP or JPEG) on the fly.
 * Non-Cloudinary URLs are returned unchanged.
 */
export const imgUrl = (url, width) => {
  if (!url || !url.includes('cloudinary.com')) return url;
  const transforms = width ? `w_${width}/f_auto,q_auto` : 'f_auto,q_auto';
  return url.replace('/upload/', `/upload/${transforms}/`);
};
