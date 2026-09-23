import { useEffect, useRef, useState } from 'react'

/**
 * Animates a number from its previous value to `target` over `duration`ms
 * using an ease-out curve, instead of snapping straight to the new value.
 * Skips the animation (jumps straight to `target`) under
 * `prefers-reduced-motion`. Every path updates state from inside a
 * `requestAnimationFrame` callback, never synchronously in the effect
 * body, so a settled value still reaches the screen within a frame
 * without tripping the "no setState directly in an effect" rule.
 */
export function useCountUp(target: number, duration = 600): number {
  const [value, setValue] = useState(target)
  const fromRef = useRef(target)

  useEffect(() => {
    const from = fromRef.current
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (prefersReducedMotion || from === target) {
      const id = requestAnimationFrame(() => {
        setValue(target)
        fromRef.current = target
      })
      return () => cancelAnimationFrame(id)
    }

    const start = performance.now()
    const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t))

    let rafId = requestAnimationFrame(function tick(now: number) {
      const t = Math.min(1, (now - start) / duration)
      setValue(Math.round(from + (target - from) * easeOutExpo(t)))
      if (t < 1) {
        rafId = requestAnimationFrame(tick)
      } else {
        fromRef.current = target
      }
    })

    return () => cancelAnimationFrame(rafId)
  }, [target, duration])

  return value
}
