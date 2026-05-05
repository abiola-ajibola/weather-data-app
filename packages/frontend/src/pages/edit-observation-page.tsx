import { useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { fetchObservationById, updateObservation } from '@/lib/api'

const schema = z.object({
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

export const EditObservationPage = () => {
  const navigate = useNavigate()
  const params = useParams()
  const id = params.id ?? ''

  const observationQuery = useQuery({
    queryKey: ['observation', id],
    enabled: id.length > 0,
    queryFn: () => fetchObservationById(id),
  })

  const updateMutation = useMutation({
    mutationFn: (values: FormValues) =>
      updateObservation(id, {
        date: values.date,
        latitude: toNumberOrNull(values.latitude),
        longitude: toNumberOrNull(values.longitude),
        elevationM: toNumberOrNull(values.elevationM),
        prcp: toNumberOrNull(values.prcp),
        tmax: toNumberOrNull(values.tmax),
        tmin: toNumberOrNull(values.tmin),
        tavg: toNumberOrNull(values.tavg),
        datx: toNumberOrNull(values.datx),
        datn: toNumberOrNull(values.datn),
        dapr: toNumberOrNull(values.dapr),
        dwpr: toNumberOrNull(values.dwpr),
      }),
    onSuccess: () => {
      const stationId = observationQuery.data?.item.stationId
      navigate(stationId ? `/stations/${encodeURIComponent(stationId)}` : '/')
    },
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: '',
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

  useEffect(() => {
    const item = observationQuery.data?.item

    if (!item) {
      return
    }

    form.reset({
      date: item.date.slice(0, 10),
      latitude: item.latitude?.toString() ?? '',
      longitude: item.longitude?.toString() ?? '',
      elevationM: item.elevationM?.toString() ?? '',
      prcp: item.prcp?.toString() ?? '',
      tmax: item.tmax?.toString() ?? '',
      tmin: item.tmin?.toString() ?? '',
      tavg: item.tavg?.toString() ?? '',
      datx: item.datx?.toString() ?? '',
      datn: item.datn?.toString() ?? '',
      dapr: item.dapr?.toString() ?? '',
      dwpr: item.dwpr?.toString() ?? '',
    })
  }, [form, observationQuery.data?.item])

  const item = observationQuery.data?.item

  return (
    <section className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Edit Weather Row</CardTitle>
          {item ? (
            <p className="text-sm text-muted-foreground">
              Station ID <strong>{item.stationId}</strong> and station name are fixed and cannot be changed.
            </p>
          ) : null}
          <Link to="/" className="text-sm font-semibold text-primary hover:underline">
            Back to dashboard
          </Link>
        </CardHeader>
        <CardContent>
          {item ? (
            <form
              className="grid gap-3 md:grid-cols-2"
              onSubmit={form.handleSubmit(async (values) => {
                await updateMutation.mutateAsync(values)
              })}
            >
              <label className="space-y-1">
                <span className="text-sm font-semibold">Station ID</span>
                <Input disabled value={item.stationId} />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-semibold">Station Name</span>
                <Input disabled value={item.stationName} />
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

              <div className="md:col-span-2 mt-2">
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Saving...' : 'Save changes'}
                </Button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">Loading weather row...</p>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
