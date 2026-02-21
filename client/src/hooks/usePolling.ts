import { useEffect, useRef } from 'react';

/*
runs the callback immediately on mount and then repeats every intervalMs.
using a ref for the callback means we always call the latest version
without restarting the interval when the callback reference changes.
*/
export function usePolling(callback: () => void, intervalMs: number): void {
  const savedCallback = useRef(callback);

  // keep the ref in sync with the latest callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // set up the interval once and clean it up on unmount
  useEffect(() => {
    // fire immediately so the first render is not empty
    savedCallback.current();

    const id = setInterval(() => {
      savedCallback.current();
    }, intervalMs);

    return () => clearInterval(id);
  }, [intervalMs]);
}
