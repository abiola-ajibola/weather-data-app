import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { AppShell } from '@/components/weather/app-shell'
import { AuthPage } from '@/pages/auth-page'
import { CreateObservationPage } from '@/pages/create-observation-page'
import { EditObservationPage } from '@/pages/edit-observation-page'
import { HomePage } from '@/pages/home-page'
import { StationPage } from '@/pages/station-page'

const NotFoundPage = () => (
  <section className="rounded-2xl border border-border/70 bg-card/80 p-8">
    <h1 className="text-2xl font-bold">Page not found</h1>
    <p className="mt-2 text-muted-foreground">
      The route you requested does not exist.
    </p>
  </section>
)

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/stations/:stationId" element={<StationPage />} />
          <Route path="/observations/new" element={<CreateObservationPage />} />
          <Route
            path="/observations/:id/edit"
            element={<EditObservationPage />}
          />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
