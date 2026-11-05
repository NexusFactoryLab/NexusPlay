import { Link } from 'react-router-dom'
import { LogoWordmark } from './BrandLogo'
import { RegisterForm } from './RegisterForm'

type RegisterPageProps = {
  onSwitchToLogin: () => void
}

export function RegisterPage({ onSwitchToLogin }: RegisterPageProps) {
  return (
    <main className="relative flex h-svh max-h-svh min-h-0 flex-col items-center justify-center gap-3 overflow-hidden p-5 sm:p-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 15% 20%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 55%), radial-gradient(circle at 85% 80%, color-mix(in srgb, var(--accent-2) 18%, transparent), transparent 50%)',
        }}
      />

      <div
        className="relative w-full max-w-[420px] rounded-2xl border border-border bg-surface p-6 text-left shadow-[var(--shadow)] sm:p-8"
        style={{ boxShadow: 'var(--shadow), var(--glow)' }}
      >
        <header className="mb-5 text-center">
          <div className="flex justify-center"><LogoWordmark className="h-10 w-auto" /></div>
          <h1 className="mt-3 mb-1.5 text-[26px] tracking-tight text-text-h">Crea tu cuenta</h1>
          <p className="text-[15px]">Únete a NexusPlay y empieza a jugar.</p>
        </header>

        <RegisterForm />

        <footer className="mt-5 border-t border-border pt-3.5 text-center">
          <p className="text-[13px] leading-snug">
            ¿Ya tienes cuenta?{' '}
            <button
              type="button"
              className="font-medium text-accent hover:underline"
              onClick={onSwitchToLogin}
            >
              Inicia sesión
            </button>
          </p>
        </footer>
      </div>

      <footer className="relative shrink-0 text-center text-[13px]">
        <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
          <Link to="/inicio" className="hover:text-text-h hover:underline">
            Inicio
          </Link>
          <span aria-hidden="true">·</span>
          <Link to="/privacidad" className="hover:text-text-h hover:underline">
            Política de Privacidad
          </Link>
          <span aria-hidden="true">·</span>
          <Link to="/terminos" className="hover:text-text-h hover:underline">
            Términos de Servicio
          </Link>
        </p>
      </footer>
    </main>
  )
}
