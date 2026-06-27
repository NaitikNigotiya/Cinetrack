import './shared-ui.css'

interface GenrePillsProps {
  genres: string[]
  max?: number
}

export function GenrePills({ genres, max = 3 }: GenrePillsProps) {
  if (genres.length === 0) return null

  const visibleGenres = genres.slice(0, max)
  const remainingCount = genres.length - max

  return (
    <div className="genres-pills-container" role="group" aria-label="Genres">
      {visibleGenres.map((genre) => (
        <span key={genre} className="genre-pill-chip">
          {genre}
        </span>
      ))}
      {remainingCount > 0 && (
        <span className="genre-pill-chip" title={`${remainingCount} more genres`}>
          +{remainingCount} more
        </span>
      )}
    </div>
  )
}
export default GenrePills
