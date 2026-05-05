import { KeyRound, PlusSquare, Radar, SunMedium } from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { clearApiKey, getApiKey } from '@/lib/api'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', label: 'Dashboard', icon: Radar },
  { to: '/observations/new', label: 'Create Data', icon: PlusSquare },
  { to: '/auth', label: 'Auth & API Keys', icon: KeyRound },
]

export const AppShell = () => {
  const hasApiKey = getApiKey().length > 0

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(20,99,86,0.18),transparent_35%),linear-gradient(165deg,#f3f8f7_0%,#edf4f1_45%,#f9f6ef_100%)] text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/75 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <Link to="/" className="inline-flex items-center gap-2 text-lg font-bold">
            <span className="rounded-lg bg-primary p-1.5 text-primary-foreground">
              <SunMedium className="size-4" />
            </span>
            Weather Data Atlas
          </Link>

          <nav className="ml-auto flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition',
                      isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                    )
                  }
                >
                  <Icon className="size-4" />
                  {item.label}
                </NavLink>
              )
            })}
          </nav>

          <div className="ml-auto inline-flex items-center gap-2 sm:ml-0">
            <Badge>{hasApiKey ? 'API key loaded' : 'API key missing'}</Badge>
            {hasApiKey ? (
              <Button
                variant="ghost"
                onClick={() => {
                  clearApiKey()
                  window.location.reload()
                }}
              >
                Sign out
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
