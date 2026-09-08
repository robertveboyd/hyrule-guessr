"use client";

import { useState } from "react";
import Image from "next/image";

export function StillFrame({
  src,
  onError,
}: {
  src: string;
  onError?: () => void;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (failedSrc === src) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center bg-black px-4 text-center text-sm text-muted-foreground">
        Still failed to load. The round is still running.
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-0 w-full flex-1 bg-black">
      <Image
        src={src}
        alt="Practice still"
        fill
        priority
        sizes="100vw"
        className="object-contain"
        onError={() => {
          setFailedSrc(src);
          onError?.();
        }}
      />
    </div>
  );
}
