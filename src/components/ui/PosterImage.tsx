import { useState } from 'react'
import { Film } from 'lucide-react'
import { getImageUrl } from '@/lib/tmdb'
import { useTheme } from '@/contexts/ThemeContext'
import './shared-ui.css'

interface PosterImageProps {
  path: string | null
  size: 'sm' | 'md' | 'lg'
  alt: string
  aspectRatio?: string
}

export function PosterImage({ path, size, alt, aspectRatio = '2/3' }: PosterImageProps) {
  const { theme } = useTheme()
  const [isLoaded, setIsLoaded] = useState(false)
  const [isError, setIsError] = useState(false)

  // Map sizes to TMDb sizes
  const tmdbSize = size === 'sm' ? 'w200' : size === 'md' ? 'w500' : 'original'
  const src = getImageUrl(path, tmdbSize)

  const isDark = theme === 'dark'
  const placeholderClass = `poster-placeholder-centered poster-placeholder-centered--${
    isDark ? 'dark' : 'light'
  }`

  const hasImage = !!path && !isError && !!src

  return (
    <div className="poster-image-container" style={{ aspectRatio }}>
      {hasImage ? (
        <img
          src={src!}
          alt={alt}
          className={`poster-image-el${isLoaded ? ' poster-image-el--loaded' : ''}`}
          loading="lazy"
          onLoad={() => setIsLoaded(true)}
          onError={() => setIsError(true)}
        />
      ) : (
        <div className={placeholderClass}>
          <Film size={size === 'sm' ? 18 : size === 'md' ? 26 : 38} aria-hidden="true" />
        </div>
      )}
    </div>
  )
}
export default PosterImage
