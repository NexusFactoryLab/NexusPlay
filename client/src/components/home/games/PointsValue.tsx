import { useEffect, useRef, useState } from 'react'

/** Puntos con un "latido" cada vez que cambian, para que se note quién acaba de sumar. */
export function PointsValue({ value }: { value: number }) {
  const previous = useRef(value)
  const [bump, setBump] = useState(0)
  useEffect(() => {
    if (previous.current !== value) {
      previous.current = value
      setBump((current) => current + 1)
    }
  }, [value])
  return (
    <span key={bump} className={bump > 0 ? 'value-bump' : undefined}>
      {value}
    </span>
  )
}
