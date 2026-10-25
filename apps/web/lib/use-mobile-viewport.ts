"use client";

import { useEffect, useState } from "react";

// Client requirement: this page only renders on a phone-width viewport
// — there's no reliable server-side device signal (User-Agent is
// spoofable and this route has no server component to read it from
// anyway), so width is the actual, checkable thing "mobile device"
// means here. Returns null until mounted so the first render doesn't
// flash the wrong state before window.innerWidth is knowable.
export function useIsMobileViewport(breakpoint = 768): boolean | null {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    function check() {
      setIsMobile(window.innerWidth < breakpoint);
    }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [breakpoint]);

  return isMobile;
}
