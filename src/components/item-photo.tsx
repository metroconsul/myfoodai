import { ImageIcon } from "lucide-react";
import { useSignedUrl } from "@/hooks/use-signed-url";
import { cn } from "@/lib/utils";

export function ItemPhoto({
  path,
  alt,
  className,
}: {
  path?: string | null;
  alt: string;
  className?: string;
}) {
  const url = useSignedUrl("item-photos", path);
  return (
    <span
      className={cn(
        "flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-[12px] border-2 border-foreground bg-secondary text-muted-foreground",
        className,
      )}
    >
      {url ? (
        <img src={url} alt={alt} loading="lazy" className="size-full object-cover" />
      ) : (
        <ImageIcon className="size-5" aria-hidden />
      )}
    </span>
  );
}
