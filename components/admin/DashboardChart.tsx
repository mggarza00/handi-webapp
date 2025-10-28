"use client";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export default function DashboardChart({ data }: { data: Array<{ date: string; requests: number }> }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: 6, right: 6, top: 10, bottom: 0 }}>
          <defs>
            <linearGradient id="colorReq" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} tickMargin={8} />
          <YAxis tick={{ fontSize: 12 }} tickMargin={6} />
          <Tooltip />
          <Area type="monotone" dataKey="requests" stroke="#16a34a" strokeWidth={2} fillOpacity={1} fill="url(#colorReq)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

