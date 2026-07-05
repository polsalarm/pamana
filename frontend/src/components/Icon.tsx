/** Material Symbols icon. `fill` for the solid variant. */
export function Icon({
  name,
  className = '',
  fill = false,
}: {
  name: string
  className?: string
  fill?: boolean
}) {
  return (
    <span className={`material-symbols-outlined ${fill ? 'fill' : ''} ${className}`}>
      {name}
    </span>
  )
}
