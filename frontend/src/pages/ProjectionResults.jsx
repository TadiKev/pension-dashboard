// src/pages/ProjectionResults.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import html2canvas from "html2canvas";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

/* ---------- Helpers (same as before) ---------- */
function formatMoney(n) {
  if (n == null || Number.isNaN(Number(n))) return "-";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n));
}

function normalizeProjection(raw) {
  if (!raw) return null;
  let data = raw;
  if (typeof raw === "string") {
    try { data = JSON.parse(raw); } catch (e) { return null; }
  }

  if (data.annual_balances && Array.isArray(data.annual_balances)) {
    const annual = data.annual_balances.map((r, i) => ({
      year: r.year ?? (r.y ?? i + 1),
      salary: Number(r.salary ?? r.annual_salary ?? 0),
      contribution: Number(r.contribution ?? r.contributions ?? 0),
      balance: Number(r.balance ?? r.final_balance ?? 0),
    }));
    return {
      initial_balance: Number(data.initial_balance ?? annual[0]?.balance ?? 0),
      final_balance: Number(data.final_balance ?? annual[annual.length - 1]?.balance ?? 0),
      annual_balances: annual,
      raw: data,
    };
  }

  if (data.projection && Array.isArray(data.projection)) {
    const annual = data.projection.map((r, i) => ({
      year: r.year ?? i + 1,
      salary: Number(r.salary ?? 0),
      contribution: Number(r.contribution ?? 0),
      balance: Number(r.balance ?? r.final_balance ?? 0),
    }));
    return {
      initial_balance: Number(data.initial_balance ?? annual[0]?.balance ?? 0),
      final_balance: Number(data.final_balance ?? annual[annual.length - 1]?.balance ?? 0),
      annual_balances: annual,
      raw: data,
    };
  }

  if (Array.isArray(data) && data.length > 0 && (data[0].balance || data[0].year || data[0].y)) {
    const annual = data.map((r, i) => ({
      year: r.year ?? r.y ?? i + 1,
      salary: Number(r.salary ?? 0),
      contribution: Number(r.contribution ?? r.contributions ?? 0),
      balance: Number(r.balance ?? r.final_balance ?? 0),
    }));
    return {
      initial_balance: Number(annual[0]?.balance ?? 0),
      final_balance: Number(annual[annual.length - 1]?.balance ?? 0),
      annual_balances: annual,
      raw: data,
    };
  }

  if (data.initial_balance !== undefined && data.annual_balances && Array.isArray(data.annual_balances)) {
    return {
      initial_balance: Number(data.initial_balance ?? 0),
      final_balance: Number(data.final_balance ?? data.annual_balances[data.annual_balances.length - 1]?.balance ?? 0),
      annual_balances: data.annual_balances.map((r, i) => ({
        year: r.year ?? i + 1,
        salary: Number(r.salary ?? 0),
        contribution: Number(r.contribution ?? 0),
        balance: Number(r.balance ?? 0),
      })),
      raw: data,
    };
  }

  return null;
}

/* ---------- Component ---------- */
export default function ProjectionResults() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const printableRef = useRef(null);

  const [projection, setProjection] = useState(null);
  const [params, setParams] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    try {
      if (state && (state.projection || state.annual_balances || state.length)) {
        const norm = normalizeProjection(state.projection ?? state);
        setProjection(norm);
        setParams(state.params ?? state?.params ?? null);
      } else {
        const raw = sessionStorage.getItem("last_projection");
        if (raw) {
          const parsed = (() => { try { return JSON.parse(raw); } catch (e) { return raw; } })();
          const norm = normalizeProjection(parsed);
          setProjection(norm);
          try {
            const rawMeta = sessionStorage.getItem("last_projection_params");
            if (rawMeta) setParams(JSON.parse(rawMeta));
          } catch (e) {}
        }
      }
    } finally {
      setLoading(false);
      setTimeout(() => window.dispatchEvent(new Event("resize")), 80);
    }
  }, [state]);

  const series = useMemo(() => {
    if (!projection?.annual_balances) return [];
    return projection.annual_balances.map((y, i) => ({ name: String(y.year ?? i + 1), balance: Number(y.balance ?? 0) }));
  }, [projection]);

  const totalContributions = useMemo(() => (projection?.annual_balances || []).reduce((s, r) => s + (Number(r.contribution || 0) || 0), 0), [projection]);
  const yearsCount = projection?.annual_balances?.length ?? 0;

  const cagr = useMemo(() => {
    if (!projection || yearsCount < 1) return 0;
    const start = Number(projection.initial_balance || projection.annual_balances[0]?.balance || 0);
    const end = Number(projection.final_balance ?? projection.annual_balances[projection.annual_balances.length - 1]?.balance ?? 0);
    if (start <= 0 || end <= 0 || yearsCount === 0) return 0;
    const n = Math.max(1, yearsCount - 1);
    return (Math.pow(end / start, 1 / n) - 1) * 100;
  }, [projection, yearsCount]);

  function downloadJSON() {
    if (!projection) return;
    const blob = new Blob([JSON.stringify(projection.raw ?? projection, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `projection_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportCSV() {
    if (!projection?.annual_balances) return;
    const rows = [["year", "salary", "contribution", "balance"], ...projection.annual_balances.map((r) => [r.year, r.salary ?? "", r.contribution ?? "", r.balance ?? ""])];
    const csv = rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `projection_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyJSON() {
    if (!projection) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(projection.raw ?? projection, null, 2));
      alert("Projection JSON copied to clipboard");
    } catch (e) {
      alert("Copy failed: " + String(e));
    }
  }

  function onPrint() {
    setTimeout(() => window.print(), 120);
  }

  /* ---------- NEW: Export as PNG using html2canvas ---------- */
  async function exportAsPNG() {
    if (!printableRef.current) {
      alert("Nothing to snapshot");
      return;
    }
    try {
      // Increase scale for higher-resolution PNGs
      const canvas = await html2canvas(printableRef.current, {
        useCORS: true,
        scale: 2,
        scrollY: -window.scrollY, // avoid clipping header if scrolled
        allowTaint: false,
      });
      // convert to blob and download
      if (canvas.toBlob) {
        canvas.toBlob((blob) => {
          if (!blob) {
            alert("Export failed");
            return;
          }
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `projection_${new Date().toISOString().slice(0, 10)}.png`;
          a.click();
          URL.revokeObjectURL(url);
        }, "image/png");
      } else {
        // fallback: dataURL
        const url = canvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = url;
        a.download = `projection_${new Date().toISOString().slice(0, 10)}.png`;
        a.click();
      }
    } catch (e) {
      console.error("exportAsPNG error", e);
      alert("Export PNG failed: " + String(e));
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto bg-white p-6 rounded-2xl shadow text-center">
          <div className="text-lg font-medium text-gray-700">Loading projection…</div>
        </div>
      </div>
    );
  }

  if (!projection) {
    return (
      <div className="p-6">
        <div className="max-w-3xl mx-auto bg-white p-6 rounded-2xl shadow">
          <h3 className="text-xl font-semibold text-gray-800">No projection data</h3>
          <p className="text-sm text-gray-500 mt-2">We couldn't find projection data. Create a new scenario or run the projection again.</p>
          <div className="mt-4 flex gap-2">
            <button onClick={() => navigate("/scenario")} className="inline-block bg-green-600 text-white px-4 py-2 rounded-md">New scenario</button>
            <button onClick={() => { window.location.reload(); }} className="px-4 py-2 rounded-md border">Reload</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <style>{`
        @media print {
          @page { size: A4; margin: 20mm; }
          body { -webkit-print-color-adjust: exact; color-adjust: exact; background: #fff !important; }
          .no-print { display: none !important; }
          .printable { box-shadow: none !important; border-radius: 0 !important; }
          .page-break { break-after: page; page-break-after: always; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          .shadow, .rounded-2xl { box-shadow: none !important; background: #fff !important; border-radius: 0 !important; }
        }
      `}</style>

      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Projection results</h1>
            {params ? (
              <p className="text-sm text-gray-500 mt-1">
                Scenario: <span className="font-medium">{params.years ?? yearsCount} years</span> · contribution <span className="font-medium">{(Number(params.contribution_rate || params.contribution || 0) * 100).toFixed(1)}%</span> · r = <span className="font-medium">{(Number(params.rate_of_return || 0) * 100).toFixed(2)}%</span>
              </p>
            ) : (
              <p className="text-sm text-gray-500 mt-1">Saved projection — results below.</p>
            )}
          </div>

          <div className="flex items-center gap-2 no-print">
            <Link to="/scenario" className="px-3 py-2 bg-white border rounded-md text-sm">Edit scenario</Link>
            <button onClick={downloadJSON} className="px-3 py-2 bg-white border rounded-md text-sm">Download JSON</button>
            <button onClick={exportCSV} className="px-3 py-2 bg-green-600 text-white rounded-md text-sm">Export CSV</button>
            <button onClick={copyJSON} className="px-3 py-2 bg-gray-50 border rounded-md text-sm">Copy JSON</button>
            <button onClick={exportAsPNG} className="px-3 py-2 bg-purple-600 text-white rounded-md text-sm">Export PNG</button>
            <button onClick={onPrint} className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm">Print report (Save as PDF)</button>
          </div>
        </header>

        <div ref={printableRef} className="printable bg-white p-6 rounded-2xl shadow">
          <div className="hidden print:block mb-4">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>Your Company / App Name</div>
                <div style={{ fontSize: 11 }}>Portfolio & Projections report</div>
              </div>
              <div style={{ textAlign: "right", fontSize: 11 }}>
                <div>{new Date().toLocaleDateString()}</div>
                <div style={{ marginTop: 8 }}>Confidential — for client use only</div>
              </div>
            </div>
            <hr style={{ marginTop: 10, borderColor: "#e5e7eb" }} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 rounded-md border min-w-0">
              <div className="text-sm text-gray-500">Initial balance</div>
              <div className="mt-1 text-xl font-semibold text-green-700">{formatMoney(projection.initial_balance)}</div>
            </div>

            <div className="p-4 rounded-md border min-w-0">
              <div className="text-sm text-gray-500">Final balance</div>
              <div className="mt-1 text-xl font-semibold text-green-700">{formatMoney(projection.final_balance)}</div>
            </div>

            <div className="p-4 rounded-md border min-w-0">
              <div className="text-sm text-gray-500">Total contributions</div>
              <div className="mt-1 text-xl font-semibold">{formatMoney(totalContributions)}</div>
            </div>

            <div className="p-4 rounded-md border min-w-0">
              <div className="text-sm text-gray-500">Avg annual growth (approx)</div>
              <div className="mt-1 text-xl font-semibold">{isFinite(cagr) ? `${cagr.toFixed(2)}%` : "—"}</div>
            </div>
          </div>

          <section className="mb-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-3">Balance growth</h2>
            <div className="w-full h-[360px]">
              {series.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(v) => formatMoney(v)} />
                    <Tooltip formatter={(v) => formatMoney(v)} />
                    <Line type="monotone" dataKey="balance" stroke="#16a34a" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm text-gray-400">No series data available</div>
              )}
            </div>
          </section>

          <div className="page-break" />

          <section>
            <h3 className="font-semibold text-gray-700 mb-3">Yearly breakdown</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-gray-600">
                  <tr>
                    <th className="py-2 pr-4">Year</th>
                    <th className="py-2 pr-4">Salary</th>
                    <th className="py-2 pr-4">Contribution</th>
                    <th className="py-2 pr-4">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {projection.annual_balances?.map((y, idx) => (
                    <tr key={y.year ?? idx} className="border-t">
                      <td className="py-3 pr-4">{y.year}</td>
                      <td className="py-3 pr-4">{y.salary ? formatMoney(y.salary) : "-"}</td>
                      <td className="py-3 pr-4">{y.contribution ? formatMoney(y.contribution) : "-"}</td>
                      <td className="py-3 pr-4 font-medium text-green-700">{y.balance ? formatMoney(y.balance) : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="page-break" />

          <section className="mt-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Assumptions & notes</h4>
            <div className="text-sm text-gray-600">
              <ul className="list-disc pl-5">
                <li>Projection computed using supplied contribution, salary growth and rate of return assumptions.</li>
                <li>Figures are illustrative and not investment advice.</li>
                <li>Roundings applied for display; download raw JSON for exact values.</li>
              </ul>
            </div>

            <div className="mt-4 text-xs text-gray-500">
              Report generated: {new Date().toLocaleString()}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
