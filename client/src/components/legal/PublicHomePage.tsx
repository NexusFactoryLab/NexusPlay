import { Link } from 'react-router-dom'
import { ThemeToggle } from '../ThemeToggle'
import { LogoMark, LogoWordmark } from '../BrandLogo'

export function PublicHomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-bg text-text">
      <header className="flex items-center justify-between px-5 py-5 sm:px-8">
        <span className="flex items-center gap-2.5">
          <LogoMark className="h-9 w-9" />
          <LogoWordmark className="h-5 w-auto" />
        </span>
        <ThemeToggle />
      </header>

      <main className="relative flex flex-1 items-center justify-center overflow-hidden px-5 py-10 text-center sm:px-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 15% 20%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 55%), radial-gradient(circle at 85% 80%, color-mix(in srgb, var(--accent-2) 18%, transparent), transparent 50%)',
          }}
        />

        <div className="relative flex max-w-xl flex-col items-center gap-5">
          <LogoMark className="h-20 w-20" />
          <h1 className="flex justify-center"><LogoWordmark className="h-10 w-auto sm:h-12" /></h1>
          <p className="text-[16px] leading-relaxed">
            Juegos educativos para aprender sobre ciudades sostenibles, pensados para clases,
            profesores y estudiantes.
          </p>
          <Link
            to="/login"
            className="mt-2 rounded-lg px-6 py-3 text-[15px] font-semibold text-white shadow-[0_8px_20px_-8px_var(--accent)] transition-[transform,opacity] hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
          >
            Iniciar sesión
          </Link>
        </div>
      </main>

      <footer className="border-t border-border px-5 py-6 text-center text-[13px] sm:px-8">
        <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
          <Link to="/privacidad" className="hover:text-text-h hover:underline">
            Política de Privacidad
          </Link>
          <span aria-hidden="true">·</span>
          <Link to="/terminos" className="hover:text-text-h hover:underline">
            Términos de Servicio
          </Link>
        </p>
      </footer>
    </div>
  )
}
