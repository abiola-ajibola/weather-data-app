import { CloudSun } from 'lucide-react'

import { WeatherDashboard } from '@/features/weather/components/WeatherDashboard'

export default function App() {
  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3 text-muted-foreground">
            <CloudSun className="size-5" />
            <p className="text-xs font-semibold uppercase tracking-[0.24em]">
              Weather Data App
            </p>
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Structured Frontend Foundation
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
            This implementation introduces a feature-based frontend layout with
            typed API access and hooks so future charts, filters, and state
            comparison tools can be added without large refactors.
          </p>
        </section>

        <WeatherDashboard />
      </div>
    </main>
  )
}