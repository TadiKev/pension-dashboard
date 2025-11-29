// src/pages/Dashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { postFastAPI, postDjango } from "../lib/http";
import { saveAs } from "file-saver";
import KPI from "../components/KPI";
import ChartCard from "../components/ChartCard";
import {
  ResponsiveContainer,
  AreaChart,
  BarChart,
  PieChart,
  Area,
  Bar,
  Pie,
  Cell,
  Tooltip,
  Legend,
  CartesianGrid,
  XAxis,
  YAxis,
  Brush,
  Line,
} from "recharts";

/* Helpers */
function formatMoney(n) {
  if (n == null || Number.isNaN(Number(n))) return "-";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(n));
}

function generateMockData() {
  const years = Array.from({ length: 11 }, (_, i) => 2024 + i);
  let balance = 10000;
  const result = years.map((yr, i) => {
    const contrib = 5000 + i * 200;
    const growth = +(balance * 0.05).toFixed(2);
    balance = +(balance + contrib + growth).toFixed(2);
    return {
      year: String(yr),
      balance,
      contribution: contrib,
      growth,
      salary: 40000 + i * 2000,
    };
  });
  const allocations = [
    { name: "Equities", value: 60 },
    { name: "Bonds", value: 25 },
    { name: "Cash", value: 10 },
    { name: "Other", value: 5 },
  ];
  const transactions = result.slice(0, 5).map((r, idx) => ({
    id: idx + 1,
    date: `${r.year}-06-30`,
    type: "contribution",
    amount: r.contribution,
  }));
  return { projection: result, allocations, transactions };
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [projection, setProjection] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [range, setRange] = useState("all");
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setLoading(true);
      setError(null);

      const payload = {
        current_balance: "10000.00",
        annual_salary: "40000.00",
        years: 10,
        assumptions: { contribution_rate: "0.10", salary_growth: "0.02", rate_of_return: "0.05" },
      };

      // 1) Try FastAPI direct (proxied by Vite to /v1 -> FastAPI)
      try {
        const r = await postFastAPI("/dc/project", payload);
        if (r?.data) {
          const normalized = normalizeResponse(r.data);
          if (normalized && mounted) {
            setProjection(normalized.projection);
            setAllocations(normalized.allocations);
            setTransactions(normalized.transactions);
            setLoading(false);
            // trigger reflow for charts to recalc sizes
            setTimeout(() => window.dispatchEvent(new Event("resize")), 50);
            return;
          }
        }
      } catch (err) {
        console.warn("FastAPI direct error:", err?.status || err?.message || err);
      }

      // 2) Try Django proxy (your Django backend proxies to FastAPI)
      try {
        const r2 = await postDjango("/proxy/dc/project/", payload);
        if (r2?.data) {
          const normalized = normalizeResponse(r2.data);
          if (normalized && mounted) {
            setProjection(normalized.projection);
            setAllocations(normalized.allocations);
            setTransactions(normalized.transactions);
            setLoading(false);
            setTimeout(() => window.dispatchEvent(new Event("resize")), 50);
            return;
          }
        }
      } catch (err2) {
        console.warn("Django proxy error:", err2?.status || err2?.message || err2);
      }

      // 3) final fallback -> mock data
      const mock = generateMockData();
      if (mounted) {
        setProjection(mock.projection);
        setAllocations(mock.allocations);
        setTransactions(mock.transactions);
        setError((prev) => prev ?? "Realtime endpoints unavailable — showing mock data.");
        setLoading(false);
        setTimeout(() => window.dispatchEvent(new Event("resize")), 50);
      }
    }

    function normalizeResponse(respData) {
      if (!respData) return null;
      if (Array.isArray(respData)) {
        return { projection: respData, allocations: respData.allocations || [], transactions: respData.transactions || [] };
      }
      if (respData.annual_balances && Array.isArray(respData.annual_balances)) {
        const proj = respData.annual_balances.map((row) => ({
          year: String(row.year ?? row.y ?? row.period ?? ""),
          balance: Number(row.balance ?? row.final_balance ?? 0),
          contribution: Number(row.contribution ?? row.contributions ?? 0),
          growth: Number(row.growth ?? 0),
          salary: Number(row.salary ?? 0),
        }));
        return { projection: proj, allocations: respData.allocations || [], transactions: respData.transactions || [] };
      }
      if (respData.projection && Array.isArray(respData.projection)) {
        return { projection: respData.projection, allocations: respData.allocations || [], transactions: respData.transactions || [] };
      }
      return null;
    }

    loadData();
    return () => (mounted = false);
  }, []);

  const totalBalance = useMemo(() => {
    if (!projection?.length) return 0;
    return Number(projection[projection.length - 1].balance || 0);
  }, [projection]);

  const avgReturnDelta = useMemo(() => {
    if (!projection || projection.length < 2) return 0;
    const first = Number(projection[0].balance || 0);
    const last = Number(projection[projection.length - 1].balance || 0);
    if (first === 0) return 0;
    return ((last - first) / first) * 100;
  }, [projection]);

  const visibleProjection = useMemo(() => {
    if (!projection) return [];
    if (range === "all") return projection;
    if (range === "5y") return projection.slice(-5);
    if (range === "3y") return projection.slice(-3);
    return projection;
  }, [projection, range]);

  function exportCSV() {
    const rows = [["year", "balance", "contribution", "growth", "salary"], ...projection.map((r) => [r.year, r.balance, r.contribution ?? "", r.growth ?? "", r.salary ?? ""])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, `projection_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Portfolio & Projections</h1>
          <p className="text-sm text-gray-500">Interactive projections and account analytics — polished for demos.</p>
        </div>

        <div className="flex items-center space-x-3">
          <button onClick={exportCSV} className="px-3 py-2 bg-green-600 text-white rounded-md shadow-sm hover:bg-green-700">
            Export CSV
          </button>
          <div className="text-sm text-gray-500">{loading ? "Loading..." : `Updated ${new Date().toLocaleString()}`}</div>
        </div>
      </div>

      {/* KPIs — wrap each KPI in a min-w-0 so flex/grid won't collapse its children */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="min-w-0">
          <KPI title="Projected Balance" value={formatMoney(totalBalance)} delta={avgReturnDelta.toFixed(2)} sparkData={projection.map((p) => p.balance)} />
        </div>
        <div className="min-w-0">
          <KPI title="Average Growth (yr)" value={`${projection.length ? (avgReturnDelta / projection.length).toFixed(2) : "0.00"}%`} delta={(avgReturnDelta / Math.max(1, projection.length)).toFixed(2)} sparkData={projection.map((p) => p.growth ?? 0)} />
        </div>
        <div className="min-w-0">
          <KPI title="Contributions / yr" value={formatMoney(projection.length ? projection.reduce((s, r) => s + (r.contribution || 0), 0) / projection.length : 0)} delta={2.4} sparkData={projection.map((p) => p.contribution ?? 0)} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Projected Balance Over Time"
          subtitle="Interactive projection graph"
          actions={
            <div className="flex items-center space-x-2">
              <button onClick={() => setRange("3y")} className="text-sm px-2 py-1 rounded bg-gray-100 dark:bg-gray-700">3y</button>
              <button onClick={() => setRange("5y")} className="text-sm px-2 py-1 rounded bg-gray-100 dark:bg-gray-700">5y</button>
              <button onClick={() => setRange("all")} className="text-sm px-2 py-1 rounded bg-gray-100 dark:bg-gray-700">All</button>
            </div>
          }
        >
          {/* explicit container with height + min-w-0 -> ensures ResponsiveContainer has valid computed size */}
          <div className="w-full min-w-0 h-[360px]">
            {visibleProjection.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={visibleProjection}>
                  <defs>
                    <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e6e6e6" />
                  <XAxis dataKey="year" />
                  <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => formatMoney(v)} />
                  <Area type="monotone" dataKey="balance" stroke="#10B981" fill="url(#balanceGrad)" strokeWidth={2} />
                  <Line type="monotone" dataKey="contribution" stroke="#2563EB" strokeDasharray="3 3" dot={false} />
                  <Brush dataKey="year" height={30} stroke="#8884d8" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm text-gray-400">No projection data</div>
            )}
          </div>
        </ChartCard>

        <div className="space-y-4">
          <ChartCard title="Contributions vs Growth (annual)" subtitle="Stacked view">
            <div className="w-full min-w-0 h-[220px]">
              {visibleProjection.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={visibleProjection}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" />
                    <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => formatMoney(v)} />
                    <Legend />
                    <Bar dataKey="contribution" stackId="a" fill="#2563EB" />
                    <Bar dataKey="growth" stackId="a" fill="#F59E0B" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm text-gray-400">No chart data</div>
              )}
            </div>
          </ChartCard>

          <ChartCard title="Asset Allocation" subtitle="Current breakdown">
            <div className="flex items-center">
              <div className="w-2/3 h-48 min-w-0">
                {allocations && allocations.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip formatter={(v) => `${v}%`} />
                      <Legend />
                      <Pie data={allocations} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                        {allocations.map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={["#10B981", "#2563EB", "#F59E0B", "#6B7280"][idx % 4]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm text-gray-400">No allocations</div>
                )}
              </div>

              <div className="w-1/3 pl-4 min-w-0">
                {allocations.map((a, i) => (
                  <div key={i} className="flex items-center justify-between py-1">
                    <div className="flex items-center">
                      <span className="inline-block w-3 h-3 mr-2" style={{ background: ["#10B981", "#2563EB", "#F59E0B", "#6B7280"][i % 4] }} />
                      <div className="text-sm">{a.name}</div>
                    </div>
                    <div className="text-sm font-medium">{a.value}%</div>
                  </div>
                ))}
              </div>
            </div>
          </ChartCard>
        </div>
      </div>

      <ChartCard title="Recent Transactions" subtitle="Latest account activity">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="text-sm text-gray-500">
                <th className="p-2">Date</th>
                <th className="p-2">Type</th>
                <th className="p-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-4 text-sm text-gray-500">No transactions</td>
                </tr>
              )}
              {transactions.map((t) => (
                <tr key={t.id || `${t.date}-${t.amount}`} className="border-t">
                  <td className="p-2">{t.date}</td>
                  <td className="p-2">{t.type}</td>
                  <td className="p-2 text-right font-medium">{formatMoney(t.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>

      {error && <div className="text-sm text-red-500">{error}</div>}
    </div>
  );
}
