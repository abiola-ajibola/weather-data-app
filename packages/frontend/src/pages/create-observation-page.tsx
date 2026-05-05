import { useMemo } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { createObservation, fetchStations } from '@/lib/api'

const schema = z.object({
  stationId: z.string().min(3),
  stationName: z.string().min(2),
  date: z.string().min(10),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  elevationM: z.string().optional(),
  prcp: z.string().optional(),
  tmax: z.string().optional(),
  tmin: z.string().optional(),
  tavg: z.string().optional(),
  datx: z.string().optional(),
  datn: z.string().optional(),
  dapr: z.string().optional(),
  dwpr: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

const toNumberOrNull = (value: string | undefined): number | null => {
  if (!value || value.trim().length === 0) {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export const CreateObservationPage = () => {
  const navigate = useNavigate()
  const createMutation = useMutation({
    mutationFn: createObservation,
    onSuccess: (result) => {
      navigate(`/stations/${encodeURIComponent(result.item.stationId)}`)
    },
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      stationId: '',
      stationName: '',
      date: new Date().toISOString().slice(0, 10),
      latitude: '',
      longitude: '',
      elevationM: '',
      prcp: '',
      tmax: '',
      tmin: '',
      tavg: '',
      datx: '',
      datn: '',
      dapr: '',
      dwpr: '',
    },
  })

  const stationQueryValue = form.watch('stationId') // !check for performance

  const stationsQuery = useQuery({
    queryKey: ['station-autocomplete', stationQueryValue],
    enabled: stationQueryValue.trim().length > 1,
    queryFn: () => fetchStations(stationQueryValue.trim()),
  })

  const stationExists = useMemo(() => {
    return (stationsQuery.data?.items ?? []).some(
      (station) => station.stationId === stationQueryValue.trim(),
    )
  }, [stationQueryValue, stationsQuery.data?.items])

  return (
    <section className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Create Weather Data Row</CardTitle>
          <p className="text-sm text-muted-foreground">
            If the station ID is new, the app will create the station record for you.
          </p>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={form.handleSubmit(async (values) => {
              if (!stationExists) {
                const proceed = window.confirm(
                  `Station ${values.stationId} does not exist yet. Create a new station with this ID?`,
                )
                if (!proceed) {
                  return
                }
              }

              await createMutation.mutateAsync({
                stationId: values.stationId.trim(),
                stationName: values.stationName.trim(),
                date: values.date,
                latitude: toNumberOrNull(values.latitude),
                longitude: toNumberOrNull(values.longitude),
                elevationM: toNumberOrNull(values.elevationM),
                prcp: toNumberOrNull(values.prcp),
                prcpAttributes: null,
                tmax: toNumberOrNull(values.tmax),
                tmaxAttributes: null,
                tmin: toNumberOrNull(values.tmin),
                tminAttributes: null,
                dapr: toNumberOrNull(values.dapr),
                daprAttributes: null,
                datn: toNumberOrNull(values.datn),
                datnAttributes: null,
                datx: toNumberOrNull(values.datx),
                datxAttributes: null,
                dwpr: toNumberOrNull(values.dwpr),
                dwprAttributes: null,
                mdpr: null,
                mdprAttributes: null,
                mdtn: null,
                mdtnAttributes: null,
                mdtx: null,
                mdtxAttributes: null,
                tavg: toNumberOrNull(values.tavg),
                tavgAttributes: null,
              })
            })}
          >
            <label className="space-y-1">
              <span className="text-sm font-semibold">Station ID</span>
              <Input {...form.register('stationId')} list="station-id-suggestions" />
              <datalist id="station-id-suggestions">
                {(stationsQuery.data?.items ?? []).map((station) => (
                  <option key={station.stationId} value={station.stationId} />
                ))}
              </datalist>
            </label>

            <label className="space-y-1">
              <span className="text-sm font-semibold">Station Name</span>
              <Input {...form.register('stationName')} />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-semibold">Date</span>
              <Input type="date" {...form.register('date')} />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-semibold">Latitude</span>
              <Input type="number" step="0.0001" {...form.register('latitude')} />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-semibold">Longitude</span>
              <Input type="number" step="0.0001" {...form.register('longitude')} />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-semibold">Elevation (m)</span>
              <Input type="number" step="0.1" {...form.register('elevationM')} />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-semibold">Precipitation</span>
              <Input type="number" step="0.1" {...form.register('prcp')} />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-semibold">Tmax</span>
              <Input type="number" step="0.1" {...form.register('tmax')} />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-semibold">Tmin</span>
              <Input type="number" step="0.1" {...form.register('tmin')} />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-semibold">Tavg</span>
              <Input type="number" step="0.1" {...form.register('tavg')} />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-semibold">Datx</span>
              <Input type="number" step="0.1" {...form.register('datx')} />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-semibold">Datn</span>
              <Input type="number" step="0.1" {...form.register('datn')} />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-semibold">Dapr</span>
              <Input type="number" {...form.register('dapr')} />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-semibold">Dwpr</span>
              <Input type="number" {...form.register('dwpr')} />
            </label>

            <div className="md:col-span-2 mt-2 flex items-center gap-2">
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Saving...' : 'Create row'}
              </Button>
              {!stationExists && stationQueryValue.trim().length > 0 ? (
                <p className="text-sm text-amber-700">
                  This station ID is not currently in the database. You will be asked to confirm creation.
                </p>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>
    </section>
  )
}
