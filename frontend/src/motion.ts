import { useLayoutEffect, useRef } from "react";

const timing = { duration: 190, easing: "cubic-bezier(0.2, 0, 0, 1)" };
export const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Animate explicit view changes, not resource object identities. Polling preserves
// focus, form values and the selected card without repeatedly fading the screen.
export function useContentMotion<T extends HTMLElement>(change: string) {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element?.animate || reducedMotion()) return;
    const animation = element.animate([{ opacity: 0.45 }, { opacity: 1 }], timing);
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const stop = () => {
      if (preference.matches) animation.cancel();
    };
    preference.addEventListener("change", stop);
    return () => {
      animation.cancel();
      preference.removeEventListener("change", stop);
    };
  }, [change]);
  return ref;
}

export function useModalMotion(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null);
  const animation = useRef<Animation | null>(null);
  const overflow = useRef<string | null>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    animation.current?.cancel();
    const close = () => {
      element.close();
      if (overflow.current !== null) document.body.style.overflow = overflow.current;
      overflow.current = null;
    };
    if (open) {
      if (!element.open) {
        overflow.current = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        element.showModal();
      }
      if (element.animate && !reducedMotion())
        animation.current = element.animate(
          [
            { opacity: 0, transform: "translateY(6px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
          timing,
        );
    } else if (element.open) {
      if (!element.animate || reducedMotion()) close();
      else {
        animation.current = element.animate(
          [
            { opacity: 1, transform: "translateY(0)" },
            { opacity: 0, transform: "translateY(4px)" },
          ],
          { ...timing, duration: 140, fill: "forwards" },
        );
        // Cancellation on a rapid reopen cannot close the reopened modal.
        animation.current.onfinish = close;
      }
    }
    return () => {
      animation.current?.cancel();
    };
  }, [open]);
  useLayoutEffect(() => {
    const element = ref.current;
    return () => {
      animation.current?.cancel();
      element?.close();
      if (overflow.current !== null) document.body.style.overflow = overflow.current;
      overflow.current = null;
    };
  }, []);
  return ref;
}
