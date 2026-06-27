import './shared-ui.css'

interface ProgressBarProps {
  value: number // 0-100
  height?: number
  color?: string
  animated?: boolean
}

export function ProgressBar({
  value,
  height = 6,
  color,
  animated = true,
}: ProgressBarProps) {
  // Clamp value between 0 and 100
  const clampedValue = Math.min(Math.max(value, 0), 100)

  const progressStyle: React.CSSProperties = {
    width: `${clampedValue}%`,
    ...(color ? { backgroundColor: color } : {}),
  }

  return (
    <div
      className="progress-bar-rail"
      style={{ height }}
      role="progressbar"
      aria-valuenow={clampedValue}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`progress-bar-fill${animated ? ' progress-bar-fill--animated' : ''}`}
        style={progressStyle}
      />
    </div>
  )
}
export default ProgressBar
