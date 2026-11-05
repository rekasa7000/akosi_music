import Image from "next/image";
import { cn } from "@/lib/utils";

const SIZES = {
  default: "h-11 sm:h-12",
  lg: "h-20 sm:h-24",
} as const;

export function AkosiWordmark({
  className,
  size = "default",
  priority = false,
}: {
  className?: string;
  size?: "default" | "lg";
  priority?: boolean;
}) {
  return (
    <span className={cn("inline-flex w-fit items-center", SIZES[size], className)}>
      <Image
        src="/logo-black.png"
        alt="akosi.music"
        width={3100}
        height={1875}
        priority={priority}
        className="block h-full w-auto dark:hidden"
      />
      <Image
        src="/logo-white.png"
        alt="akosi.music"
        width={3100}
        height={1875}
        priority={priority}
        className="hidden h-full w-auto dark:block"
      />
    </span>
  );
}
