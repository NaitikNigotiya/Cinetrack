export function PageLoadingFallback() {
  return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg-primary)',
    }}>
      <div className="skeleton" style={{
        width: 48, height: 48, borderRadius: '50%',
      }} />
    </div>
  )
}
