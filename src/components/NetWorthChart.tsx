import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { ProjectionPoint } from '../types';
import { formatCurrency } from '../lib/format';
import { useAppSettings } from '../lib/AppSettingsContext';
import Card from './Card';

interface Props {
  points: ProjectionPoint[];
  retirementAge: number;
}

export default function NetWorthChart({ points, retirementAge }: Props) {
  const { currency } = useAppSettings();
  const data = points.map((p) => ({
    age: p.age,
    nominal: Math.round(p.totalNetWorth),
    real: Math.round(p.totalNetWorthReal),
  }));

  return (
    <Card>
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="font-display text-lg text-ink">Net worth over time</h3>
        <div className="flex items-center gap-4 text-[11px] text-inkfaint font-mono">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-0.5 bg-brass" /> future £
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-0.5 bg-teal border-t border-dashed" /> today's £
          </span>
        </div>
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="nominalFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#B08D57" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#B08D57" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#C9CBB9" vertical={false} />
            <XAxis
              dataKey="age"
              tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono', fill: '#5B6760' }}
              tickFormatter={(v) => `${v}`}
              label={{ value: 'age', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#5B6760' }}
            />
            <YAxis
              tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono', fill: '#5B6760' }}
              tickFormatter={(v) => formatCurrency(v, currency, { compact: true })}
              width={64}
            />
            <Tooltip
              formatter={(value: number, name: string) => [
                formatCurrency(value, currency),
                name === 'nominal' ? 'Future £' : "Today's £",
              ]}
              labelFormatter={(age) => `Age ${age}`}
              contentStyle={{
                background: '#F7F6F1',
                border: '1px solid #C9CBB9',
                borderRadius: 2,
                fontFamily: 'IBM Plex Mono',
                fontSize: 12,
              }}
            />
            <ReferenceLine
              x={retirementAge}
              stroke="#A6493D"
              strokeDasharray="4 4"
              label={{ value: 'retirement', position: 'top', fontSize: 11, fill: '#A6493D' }}
            />
            <Area
              type="monotone"
              dataKey="nominal"
              stroke="#B08D57"
              strokeWidth={2}
              fill="url(#nominalFill)"
            />
            <Line
              type="monotone"
              dataKey="real"
              stroke="#2F5D62"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
