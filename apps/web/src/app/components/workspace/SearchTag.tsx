import { Link } from "react-router";

type SearchTagProps = {
  tag: string;
  className?: string;
  to?: string;
};

export default function SearchTag({ tag, className = "", to }: SearchTagProps) {
  const label = tag.replace(/^#+/, "").trim();
  const href = to ?? `/workspace/search?tag=${encodeURIComponent(label)}`;

  return (
    <Link className={`ns-related-tag ${className}`} to={href} aria-label={`Найти похожее: ${label}`}>
      #{label}
    </Link>
  );
}
