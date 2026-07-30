import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";

/**
 * Animates a view in on mount, and again whenever `key` changes. Children
 * marked with `data-stagger` follow in sequence.
 *
 * The root element must carry `data-anim`, which CSS uses to hide it before
 * the first paint. These tweens only animate *to* the visible state -- they
 * never set the hidden state themselves, because doing that from an effect
 * allows a frame of fully-rendered content to paint first (and under
 * StrictMode, ctx.revert() between the double-invoked effects restored it,
 * producing a visible flash before the animation ran).
 *
 * gsap.context() reverts every tween on cleanup, so switching views quickly
 * can't leave half-played animations behind.
 */
export function useEnterAnimation<T extends HTMLElement = HTMLDivElement>(
  key?: string | number,
) {
  const ref = useRef<T>(null);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;

    const ctx = gsap.context(() => {
      gsap.to(root, {
        opacity: 1,
        y: 0,
        duration: 0.35,
        ease: "power2.out",
      });

      const staggered = root.querySelectorAll("[data-stagger]");
      if (staggered.length) {
        gsap.to(staggered, {
          opacity: 1,
          y: 0,
          duration: 0.3,
          ease: "power2.out",
          stagger: 0.04,
          delay: 0.08,
        });
      }
    }, root);

    return () => ctx.revert();
  }, [key]);

  return ref;
}
