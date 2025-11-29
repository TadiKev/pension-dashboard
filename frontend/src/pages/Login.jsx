// src/pages/Login.jsx
import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [form, setForm] = useState({ username: "", password: "" });
  const { login } = useAuth();
  const nav = useNavigate();
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      await login(form.username, form.password);
      setLoading(false);
      nav("/");
    } catch (e) {
      setLoading(false);
      setErr(String(e));
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-12 p-6 bg-white dark:bg-gray-800 rounded shadow">
      <h2 className="text-2xl font-semibold mb-4">Sign in</h2>
      <form onSubmit={submit} className="space-y-3">
        <input placeholder="username" value={form.username} onChange={(e)=>setForm({...form,username:e.target.value})} className="w-full p-2 border rounded" />
        <input type="password" placeholder="password" value={form.password} onChange={(e)=>setForm({...form,password:e.target.value})} className="w-full p-2 border rounded" />
        <button className="w-full px-4 py-2 bg-green-600 text-white rounded" type="submit" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      {err && <div className="text-red-600 mt-3">{err}</div>}
    </div>
  );
}
