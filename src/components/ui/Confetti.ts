interface Particle {
  x: number
  y: number
  size: number
  color: string
  speedX: number
  speedY: number
  rotation: number
  rotationSpeed: number
}

const COLORS = ['#F5C518', '#34A853', '#4285F4', '#EA4335', '#FF7F50', '#DA70D6']

/**
 * Triggers a beautiful HTML5 canvas-based confetti celebration burst.
 * Avoids any npm dependencies, rendering particles directly on a temporary overlay canvas.
 */
export function triggerConfetti(intensity: 'season' | 'show' = 'season') {
  const canvas = document.createElement('canvas')
  canvas.style.position = 'fixed'
  canvas.style.inset = '0'
  canvas.style.pointerEvents = 'none'
  canvas.style.zIndex = '9999'
  document.body.appendChild(canvas)

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    document.body.removeChild(canvas)
    return
  }
  const context = ctx

  // Adjust to device resolution
  const dpr = window.devicePixelRatio || 1
  const resize = () => {
    canvas.width = window.innerWidth * dpr
    canvas.height = window.innerHeight * dpr
    context.scale(dpr, dpr)
  }
  resize()

  const particles: Particle[] = []
  const count = intensity === 'show' ? 140 : 60

  // Generate particles originating from left & right corners or center
  for (let i = 0; i < count; i++) {
    const isLeft = Math.random() > 0.5
    particles.push({
      x: isLeft ? 0 : window.innerWidth,
      y: window.innerHeight * 0.8,
      size: Math.random() * 8 + 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
      speedX: (isLeft ? 1 : -1) * (Math.random() * 12 + 6),
      speedY: -(Math.random() * 18 + 12),
      rotation: Math.random() * 360,
      rotationSpeed: Math.random() * 10 - 5,
    })
  }

  let frameId = 0
  const gravity = 0.55
  const drag = 0.98

  function animate() {
    context.clearRect(0, 0, canvas.width, canvas.height)
    let alive = false

    for (const p of particles) {
      p.speedY += gravity
      p.speedX *= drag
      p.speedY *= drag
      p.x += p.speedX
      p.y += p.speedY
      p.rotation += p.rotationSpeed

      // Fade/draw particle as a small colored rectangle
      if (p.y < window.innerHeight && p.x > -20 && p.x < window.innerWidth + 20) {
        alive = true
        context.save()
        context.translate(p.x, p.y)
        context.rotate((p.rotation * Math.PI) / 180)
        context.fillStyle = p.color
        context.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
        context.restore()
      }
    }

    if (alive) {
      frameId = requestAnimationFrame(animate)
    } else {
      cancelAnimationFrame(frameId)
      if (document.body.contains(canvas)) {
        document.body.removeChild(canvas)
      }
    }
  }

  animate()
}
