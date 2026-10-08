const escapeAttribute = value => String(value).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const IMAGE_SIZES = Object.freeze({
  grid: '(max-width: 700px) calc(100vw - 36px), (max-width: 1000px) calc((100vw - 84px) / 2), (max-width: 1536px) calc((100vw - 132px) / 2), 702px',
  article: '(max-width: 700px) calc(100vw - 36px), (max-width: 1000px) calc(100vw - 48px), (max-width: 1096px) calc(100vw - 96px), 1000px',
  hero: '(max-width: 700px) calc(100vw - 36px), (max-width: 1000px) calc((100vw - 48px) * 1.2 / 2.2), (max-width: 1536px) calc((100vw - 96px) * 1.55 / 2.55), 876px'
});
export function validateImageVariants(image) {
  if (image.variants === undefined) return;
  if (!Array.isArray(image.variants) || !image.variants.length || image.variants.length > 10) throw new Error('Invalid responsive image variants');
  const widths=new Set();
  for (const variant of image.variants) {
    if (typeof variant.src !== 'string' || /[\s,"'<>]/.test(variant.src)) throw new Error('Unsafe responsive image URL');
    const url=new URL(variant.src,'https://www.folkly.com');
    const local=/^\/assets\/[a-z0-9-]+\.(?:jpg|jpeg|webp|avif)$/.test(variant.src);
    if (!local && !(url.protocol==='https:' && ['thumb.wikimedia.org','upload.wikimedia.org'].includes(url.hostname) && !url.username && !url.password)) throw new Error('Unsupported responsive image host');
    if (!Number.isSafeInteger(variant.width) || variant.width<1 || variant.width>image.width || widths.has(variant.width) || !Number.isSafeInteger(variant.height) || variant.height<1) throw new Error('Invalid responsive image dimensions');
    if (Math.abs(variant.height-variant.width*image.height/image.width)>2) throw new Error('Responsive image aspect ratio differs from original');
    if (!Number.isSafeInteger(variant.bytes) || variant.bytes<1 || !/^[a-f0-9]{64}$/.test(variant.sha256 || '')) throw new Error('Missing responsive image download evidence');
    widths.add(variant.width);
  }
}
export function responsiveAttributes(image, context) {
  if (!image.variants?.length) return '';
  if (!(context in IMAGE_SIZES)) throw new Error('Unknown image display context');
  const candidates=new Map(image.variants.map(variant=>[variant.width,variant.src]));
  // Preserve the original fallback as the largest candidate; never invent an upscale.
  candidates.set(image.width,image.src);
  const srcset=[...candidates].sort((a,b)=>a[0]-b[0]).map(([width,src])=>`${src} ${width}w`).join(', ');
  return ` srcset="${escapeAttribute(srcset)}" sizes="${escapeAttribute(IMAGE_SIZES[context])}"`;
}
export function applyResponsiveImages(html, items, route) {
  const images=new Map(items.filter(item=>item.image).map(item=>[item.image.src,item.image]));
  return html.replace(/<img\b[^>]*>/g, tag=>{
    const raw=tag.match(/\bsrc="([^"]*)"/)?.[1];
    if (!raw) return tag;
    const source=raw.replaceAll('&amp;','&');
    const normalized=source.startsWith('assets/')?`/${source}`:source;
    const image=images.get(normalized);
    if (!image) return tag;
    const context=tag.includes('loading="lazy"')?'grid':route==='/'?'hero':'article';
    let updated=tag.replace(/\s+(?:srcset|sizes|width|height|decoding)="[^"]*"/g,'');
    const attributes=` width="${image.width}" height="${image.height}" decoding="async"${responsiveAttributes(image,context)}`;
    updated=updated.replace(/\s*\/?>(?=$)/,`${attributes}>`);
    return updated;
  });
}
