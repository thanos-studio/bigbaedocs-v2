'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** Matches --g-t-exit in graphite.css. */
const EXIT_MS = 160;

/**
 * Delays removal so an unmounting element can play its exit animation.
 *
 * React unmounts synchronously, so `items.filter(...)` rips the node out of the
 * DOM with no chance to animate. This marks the item as leaving, lets CSS run,
 * then performs the real removal.
 *
 * ```tsx
 * const { isLeaving, leave } = useLeaving<string>();
 *
 * {items.map((item) => (
 *   <div
 *     key={item.id}
 *     className="g-pop-in g-leave"
 *     data-leaving={isLeaving(item.id)}
 *   >
 *     {item.label}
 *     <button onClick={() => leave(item.id, () => remove(item.id))}>x</button>
 *   </div>
 * ))}
 * ```
 *
 * Keep `key` stable and independent of the leaving flag. Folding state into the
 * key (`key={`${id}-${leaving}`}`) remounts the node and kills the animation.
 *
 * @param duration Exit duration in ms. Must be >= the CSS transition, or the
 *                 node is removed mid-animation and the element appears to jump.
 */
export function useLeaving<T extends string | number>(duration: number = EXIT_MS) {
  const [leaving, setLeaving] = useState<T[]>([]);
  const timers = useRef(new Map<T, ReturnType<typeof setTimeout>>());

  // Without this, unmounting mid-flight leaves a timer that calls setState on a
  // dead component and silently drops the caller's cleanup.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const isLeaving = useCallback((id: T) => leaving.includes(id), [leaving]);

  const leave = useCallback(
    (id: T, remove: () => void) => {
      // Guard against double-clicks: a second call would queue a second removal.
      if (timers.current.has(id)) return;

      setLeaving((prev) => (prev.includes(id) ? prev : [...prev, id]));

      const timer = setTimeout(() => {
        timers.current.delete(id);
        remove();
        setLeaving((prev) => prev.filter((item) => item !== id));
      }, duration);

      timers.current.set(id, timer);
    },
    [duration],
  );

  /** Abort a pending exit - for an undo affordance inside the exit window. */
  const cancel = useCallback((id: T) => {
    const timer = timers.current.get(id);
    if (!timer) return;
    clearTimeout(timer);
    timers.current.delete(id);
    setLeaving((prev) => prev.filter((item) => item !== id));
  }, []);

  return { isLeaving, leave, cancel, leavingIds: leaving };
}

/**
 * Single-element variant, for one panel or banner rather than a list.
 *
 * ```tsx
 * const { visible, mounted, hide } = useLeavingOne(open);
 * return mounted ? (
 *   <div className="g-fade-up g-leave" data-leaving={!visible}>...</div>
 * ) : null;
 * ```
 */
export function useLeavingOne(open: boolean, duration: number = EXIT_MS) {
  const [seen, setSeen] = useState(open);
  const [exiting, setExiting] = useState(false);

  // React's "adjust state when a prop changes" pattern. In an effect instead,
  // the extra render lands after the exit has already begun.
  if (seen !== open) {
    setSeen(open);
    setExiting(!open);
  }

  useEffect(() => {
    if (!exiting) return;
    const timer = setTimeout(() => setExiting(false), duration);
    return () => clearTimeout(timer);
  }, [exiting, duration]);

  return {
    /** Drive `data-leaving={!visible}`. */
    visible: open,
    /** Render nothing when false. */
    mounted: open || exiting,
  };
}
