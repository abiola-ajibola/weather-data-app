import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

type TopStation = {
  stationId: string
  stationName: string
  maxTmax: number
}

type ConditionSlice = {
  condition: string
  percentage: number
}

type DashboardChartsProps = {
  topStations: TopStation[]
  conditionBreakdown: ConditionSlice[]
}

const pieColors = ['#146356', '#f59e0b', '#0f766e', '#e76f51', '#3f88c5']

export const DashboardCharts = ({
  topStations,
  conditionBreakdown,
}: DashboardChartsProps) => (
  <section className="grid gap-5 lg:grid-cols-2">
    <Card>
      <CardHeader>
        <CardTitle>Top 10 Max Temperatures</CardTitle>
        <CardDescription>
          Stations with the highest max temperature values for the selected range.
        </CardDescription>
      </CardHeader>
      <CardContent className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={topStations} margin={{ top: 16, right: 10, left: 0, bottom: 80 }}>
            <CartesianGrid strokeDasharray="4 4" vertical={false} />
            <XAxis
              dataKey="stationName"
              angle={-35}
              textAnchor="end"
              interval={0}
              height={90}
            />
            <YAxis
              label={{
                value: 'Temperature',
                angle: -90,
                position: 'insideLeft',
              }}
            />
            <Tooltip />
            <Bar dataKey="maxTmax" fill="#146356" radius={[8, 8, 2, 2]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>Weather Condition Mix</CardTitle>
        <CardDescription>
          Aggregate daily percentage across selected top stations.
        </CardDescription>
      </CardHeader>
      <CardContent className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={conditionBreakdown}
              dataKey="percentage"
              nameKey="condition"
              outerRadius={120}
              innerRadius={54}
              paddingAngle={3}
              label={(slice) =>
                `${String(slice.name ?? '')} ${Number(slice.percent ?? 0).toFixed(0)}%`
              }
            >
              {conditionBreakdown.map((entry, index) => (
                <Cell
                  key={entry.condition}
                  fill={pieColors[index % pieColors.length]}
                />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  </section>
)
