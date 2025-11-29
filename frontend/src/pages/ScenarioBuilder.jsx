import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

// ScenarioBuilder — polished, production-friendly single-file component
// - Local projection preview (so UI is responsive even if API is slow)
// - Calls callFastAPI('/dc/project', payload) from AuthContext
// - Graceful fallback to local projection on API failure
// - Validation, helpful UI hints, and responsive layout (Tailwind)

function formatMoney(n) {
  if (n == null || Number.isNaN(Number(n))) return "-";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n));
}

function computeProjection({ current_balance, annual_salary, years, contribution_rate, salary_growth, rate_of_return }) {
  // returns array of year objects with yearIndex (1..years), balance, contribution, growth, salary
  let bal = Number(current_balance || 0);
  let salary = Number(annual_salary || 0);
  const contribRate = Number(contribution_rate || 0);
  const salaryGrowth = Number(salary_growth || 0);
  const rate = Number(rate_of_return || 0);
  const out = [];
  for (let i = 1; i <= Math.max(1, Number(years || 1)); i++) {
    const contribution = +(salary * contribRate).toFixed(2);
    const growth = +((bal + contribution) * rate).toFixed(2);
    bal = +((bal + contribution + growth)).toFixed(2);
    out.push({ yearIndex: i, balance: bal, contribution, growth, salary: +salary.toFixed(2) });
    salary = +(salary * (1 + salaryGrowth)).toFixed(2);
  }
  return out;
}

export default function ScenarioBuilder() {
  const navigate = useNavigate();
  const { callFastAPI } = useAuth();

  const [form, setForm] = useState({
    current_balance: "1000.00",
    annual_salary: "50000.00",
    years: 10,
    contribution_rate: "0.10",
    salary_growth: "0.03",
    rate_of_return: "0.05",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [touched, setTouched] = useState({});

  // Local preview projection (fast UI feedback)
  const preview = useMemo(() => {
    return computeProjection({
      current_balance: form.current_balance,
      annual_salary: form.annual_salary,
      years: form.years,
      contribution_rate: form.contribution_rate,
      salary_growth: form.salary_growth,
      rate_of_return: form.rate_of_return,
    });
  }, [form]);

  useEffect(() => {
    // clear error when user edits form
    if (error) setError(null);
  }, [form]);

  function updateField(path, value) {
    // path: top-level key or nested like 'assumptions.contribution_rate' (we use flat fields)
    setForm((prev) => ({ ...prev, [path]: value }));
  }

  function validate() {
    const errs = {};
    if (Number.isNaN(Number(form.current_balance)) || Number(form.current_balance) < 0) errs.current_balance = "Enter a valid non-negative number";
    if (Number.isNaN(Number(form.annual_salary)) || Number(form.annual_salary) < 0) errs.annual_salary = "Enter a valid non-negative number";
    if (!Number.isInteger(Number(form.years)) || Number(form.years) <= 0) errs.years = "Years must be a positive integer";
    ["contribution_rate", "salary_growth", "rate_of_return"].forEach((k) => {
      if (Number.isNaN(Number(form[k]))) errs[k] = "Enter a valid decimal (e.g. 0.05 for 5%)";
    });
    return errs;
  }

  async function submit(e) {
    e.preventDefault();
    setTouched({ current_balance: true, annual_salary: true, years: true, contribution_rate: true, salary_growth: true, rate_of_return: true });
    const errs = validate();
    if (Object.keys(errs).length) {
      setError("Please fix validation errors above.");
      return;
    }

    setLoading(true);
    setError(null);

    const payload = {
      current_balance: form.current_balance,
      annual_salary: form.annual_salary,
      years: Number(form.years),
      assumptions: { contribution_rate: form.contribution_rate, salary_growth: form.salary_growth, rate_of_return: form.rate_of_return },
    };

    try {
      // call FastAPI through AuthContext helper
      const resp = await callFastAPI("/dc/project", payload);
      // if callFastAPI returns a native Response (fetch) or axios-like — handle both
      let data;
      if (!resp) throw new Error("No response from API");

      if (typeof resp.ok !== "undefined") {
        // fetch Response
        data = await resp.json().catch(() => null);
        if (!resp.ok) throw new Error(data ? JSON.stringify(data) : `Request failed (${resp.status})`);
      } else if (resp.data) {
        // axios style
        data = resp.data;
      } else {
        data = resp;
      }

      // success — store and navigate
      try {
        sessionStorage.setItem("last_projection", JSON.stringify(data));
      } catch (e) {
        // ignore storage issues
      }
      setLoading(false);
      navigate("/results");
    } catch (apiErr) {
      // API failed — show helpful message and fallback to local preview
      const msg = apiErr?.message || String(apiErr);
      setError("API call failed — using local preview. (" + msg + ")");
      // store the preview as fallback payload so /results still has something
      try {
        sessionStorage.setItem("last_projection", JSON.stringify({ projection: preview, allocations: [], transactions: [] }));
      } catch (e) {}
      setLoading(false);
      navigate("/results");
    }
  }

  const validation = validate();

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="bg-white/70 backdrop-blur rounded-xl shadow-md p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Scenario Builder</h2>
            <p className="text-sm text-gray-500 mt-1">Build a projection scenario — instant preview and production-ready API call with graceful fallback.</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-400">Pro Mode</div>
            <div className="text-sm font-medium text-green-600">Ready to run</div>
          </div>
        </div>

        <form onSubmit={submit} className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Inputs */}
          <div className="space-y-3">
            <label className="block text-sm font-medium">Current balance</label>
            <input
              inputMode="decimal"
              value={form.current_balance}
              onChange={(e) => updateField("current_balance", e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, current_balance: true }))}
              className={`w-full p-3 border rounded-md shadow-sm focus:ring-2 focus:ring-green-200 ${touched.current_balance && validation.current_balance ? "border-red-300" : "border-gray-200"}`}
            />
            {touched.current_balance && validation.current_balance && <div className="text-xs text-red-500">{validation.current_balance}</div>}

            <label className="block text-sm font-medium mt-3">Annual salary</label>
            <input
              inputMode="decimal"
              value={form.annual_salary}
              onChange={(e) => updateField("annual_salary", e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, annual_salary: true }))}
              className={`w-full p-3 border rounded-md shadow-sm focus:ring-2 focus:ring-green-200 ${touched.annual_salary && validation.annual_salary ? "border-red-300" : "border-gray-200"}`}
            />
            {touched.annual_salary && validation.annual_salary && <div className="text-xs text-red-500">{validation.annual_salary}</div>}

            <label className="block text-sm font-medium mt-3">Years</label>
            <input
              type="number"
              value={form.years}
              min={1}
              onChange={(e) => updateField("years", e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, years: true }))}
              className={`w-full p-3 border rounded-md shadow-sm focus:ring-2 focus:ring-green-200 ${touched.years && validation.years ? "border-red-300" : "border-gray-200"}`}
            />
            {touched.years && validation.years && <div className="text-xs text-red-500">{validation.years}</div>}
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium">Contribution rate (decimal)</label>
            <input
              inputMode="decimal"
              value={form.contribution_rate}
              onChange={(e) => updateField("contribution_rate", e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, contribution_rate: true }))}
              className={`w-full p-3 border rounded-md shadow-sm focus:ring-2 focus:ring-green-200 ${touched.contribution_rate && validation.contribution_rate ? "border-red-300" : "border-gray-200"}`}
            />
            {touched.contribution_rate && validation.contribution_rate && <div className="text-xs text-red-500">{validation.contribution_rate}</div>}

            <label className="block text-sm font-medium mt-3">Salary growth (decimal)</label>
            <input
              inputMode="decimal"
              value={form.salary_growth}
              onChange={(e) => updateField("salary_growth", e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, salary_growth: true }))}
              className={`w-full p-3 border rounded-md shadow-sm focus:ring-2 focus:ring-green-200 ${touched.salary_growth && validation.salary_growth ? "border-red-300" : "border-gray-200"}`}
            />
            {touched.salary_growth && validation.salary_growth && <div className="text-xs text-red-500">{validation.salary_growth}</div>}

            <label className="block text-sm font-medium mt-3">Rate of return (decimal)</label>
            <input
              inputMode="decimal"
              value={form.rate_of_return}
              onChange={(e) => updateField("rate_of_return", e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, rate_of_return: true }))}
              className={`w-full p-3 border rounded-md shadow-sm focus:ring-2 focus:ring-green-200 ${touched.rate_of_return && validation.rate_of_return ? "border-red-300" : "border-gray-200"}`}
            />
            {touched.rate_of_return && validation.rate_of_return && <div className="text-xs text-red-500">{validation.rate_of_return}</div>}
          </div>

          {/* actions + preview */}
          <div className="md:col-span-2 mt-2 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md shadow hover:bg-green-700 disabled:opacity-60"
              >
                {loading ? "Running…" : "Run projection"}
              </button>

              <button
                type="button"
                onClick={() => {
                  // quick reset to sensible defaults
                  setForm({ current_balance: "1000.00", annual_salary: "50000.00", years: 10, contribution_rate: "0.10", salary_growth: "0.03", rate_of_return: "0.05" });
                  setTouched({});
                  setError(null);
                }}
                className="px-3 py-2 border rounded-md text-sm"
              >
                Reset
              </button>

              <button
                type="button"
                onClick={() => {
                  // quick save scenario to localStorage as named snapshot
                  const name = prompt("Save scenario as (name):", "My Scenario");
                  if (!name) return;
                  try {
                    const snapshots = JSON.parse(localStorage.getItem("scenario_snapshots") || "{}");
                    snapshots[name] = { created: Date.now(), form };
                    localStorage.setItem("scenario_snapshots", JSON.stringify(snapshots));
                    alert("Saved scenario: " + name);
                  } catch (e) {
                    alert("Unable to save scenario: " + e);
                  }
                }}
                className="px-3 py-2 border rounded-md text-sm"
              >
                Save
              </button>

              <div className="text-sm text-gray-500">Preview uses local calculation immediately. API result will replace on success.</div>
            </div>

            <div className="text-right text-sm">
              <div className="font-medium">Projected balance (end)</div>
              <div className="text-lg font-semibold">{formatMoney(preview.length ? preview[preview.length - 1].balance : 0)}</div>
            </div>
          </div>

          {/* small preview table */}
          <div className="md:col-span-2 mt-4">
            <div className="rounded-md border bg-gray-50 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium">Preview (first 5 years)</div>
                <div className="text-xs text-gray-500">Client-side estimate</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500">
                      <th className="py-1">Year</th>
                      <th className="py-1">Salary</th>
                      <th className="py-1">Contribution</th>
                      <th className="py-1">Growth</th>
                      <th className="py-1">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 5).map((r) => (
                      <tr key={r.yearIndex} className="border-t">
                        <td className="py-2">{r.yearIndex}</td>
                        <td className="py-2">{formatMoney(r.salary)}</td>
                        <td className="py-2">{formatMoney(r.contribution)}</td>
                        <td className="py-2">{formatMoney(r.growth)}</td>
                        <td className="py-2 font-medium">{formatMoney(r.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {error && (
            <div className="md:col-span-2 text-sm text-red-600">{error}</div>
          )}
        </form>
      </div>
    </div>
  );
}
