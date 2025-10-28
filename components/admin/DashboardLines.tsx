"use client";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

type Point = { date: string; requests: number; payments: number };

export default function DashboardLines({ data }: { data: Point[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: 6, right: 12, top: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} tickMargin={8} />
          <YAxis tick={{ fontSize: 12 }} tickMargin={6} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="requests" stroke="#16a34a" strokeWidth={2} dot={false} name="Solicitudes" />
          <Line type="monotone" dataKey="payments" stroke="#2563eb" strokeWidth={2} dot={false} name="Pagos" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

