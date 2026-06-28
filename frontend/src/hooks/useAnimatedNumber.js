import { useEffect, useRef, useState } from 'react'

/** Smoothly tweens a displayed number toward `target` over `duration` ms. */
export function useAnimatedNumber(target, duration = 400) {
  const [value, setValue] = useState(target)
  const frameRef = useRef(null)
  const fromRef = useRef(target)

  useEffect(() => {
    const from = fromRef.current
    const start = performance.now()

    function tick(now) {
      const elapsed = now - start
      const t = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(from + (target - from) * eased)
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = target
      }
    }

    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
  }, [target, duration])

  return value
}
