import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const REGISTER_URL = `${import.meta.env.VITE_API_URL || '/api/v1'}/auth/register/`; // adapt to your backend route

export default function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', email: '', password: '', password2: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [successNote, setSuccessNote] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (form.password !== form.password2) return setError('Passwords do not match.');
    setBusy(true);
    try {
      // NOTE: update REGISTER_URL to match backend. Many projects expose a users endpoint instead.
      const resp = await fetch(REGISTER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: form.username, email: form.email, password: form.password }),
      });

      if (resp.status === 201 || resp.status === 200) {
        setSuccessNote('Account created — please sign in.');
        setTimeout(() => navigate('/login'), 900);
        return;
      }

      const data = await resp.json().catch(() => ({}));
      setError(data.detail || JSON.stringify(data) || 'Failed to create account.');
    } catch (err) {
      setError(err.message || 'Failed to create account.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-green-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white shadow-lg rounded-2xl p-8">
        <h1 className="text-2xl font-bold text-green-800 mb-2">Create account</h1>
        <p className="text-sm text-gray-600 mb-6">Create an account for the Pension Dashboard.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            className="w-full rounded-md border-gray-200 p-2"
            placeholder="Username"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            required
          />
          <input
            className="w-full rounded-md border-gray-200 p-2"
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <input
            className="w-full rounded-md border-gray-200 p-2"
            placeholder="Password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
          <input
            className="w-full rounded-md border-gray-200 p-2"
            placeholder="Confirm password"
            type="password"
            value={form.password2}
            onChange={(e) => setForm({ ...form, password2: e.target.value })}
            required
          />

          {error && <div className="text-red-600 text-sm">{error}</div>}
          {successNote && <div className="text-green-700 text-sm">{successNote}</div>}

          <button disabled={busy} className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-md">
            {busy ? 'Creating…' : 'Create account'}
          </button>

          <div className="text-center text-sm text-gray-600">
            Already have an account? <Link to="/login" className="text-green-600 underline">Sign in</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
