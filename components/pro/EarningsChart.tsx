"use client";
import * as React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export type Point = { label: string; amount: number };

export default function EarningsChart({ series }: { series: Point[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={series}
          margin={{ left: 8, right: 8, top: 8, bottom: 8 }}
        >
          <CartesianGrid stroke="#E5E7EB" strokeDasharray="4 4" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: "#6B7280" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "#6B7280" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #E5E7EB",
              boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
            }}
            labelStyle={{ color: "#082877", fontWeight: 600 }}
          />
          <Line
            type="monotone"
            dataKey="amount"
            stroke="#082877"
            strokeWidth={2}
            dot={{ r: 4, fill: "#082877", strokeWidth: 0 }}
            activeDot={{ r: 5, fill: "#082877" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
