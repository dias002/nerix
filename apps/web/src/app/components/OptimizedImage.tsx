import type { ImgHTMLAttributes } from "react";

type OptimizedImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  webpSrc?: string;
  mobileSrc?: string;
  pictureClassName?: string;
};

export default function OptimizedImage({
  src,
  webpSrc,
  mobileSrc,
  pictureClassName,
  loading = "lazy",
  decoding = "async",
  alt = "",
  ...props
}: OptimizedImageProps) {
  if (!src) return null;

  return (
    <picture className={pictureClassName}>
      {mobileSrc ? <source media="(max-width: 767px)" srcSet={mobileSrc} type="image/webp" /> : null}
      <source srcSet={webpSrc ?? toWebpSrc(src)} type="image/webp" />
      <img src={src} alt={alt} loading={loading} decoding={decoding} {...props} />
    </picture>
  );
}

function toWebpSrc(src: string) {
  return src.replace(/\.(jpe?g|png)$/i, ".webp");
}
