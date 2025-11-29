// src/App.jsx
import React, { Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";

// pages
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import ScenarioBuilder from "./pages/ScenarioBuilder";
import ProjectionResults from "./pages/ProjectionResults";
import FileUpload from "./pages/FileUpload";

export default function App() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col">
      {/* Navbar sits outside main so it persists */}
      <Navbar />

      <main className="container mx-auto px-4 py-6 flex-1">
        {/* Suspense in case you lazy-load pages later */}
        <Suspense fallback={<div className="text-center text-gray-500">Loading…</div>}>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            {/* Protected routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/scenario"
              element={
                <ProtectedRoute>
                  <ScenarioBuilder />
                </ProtectedRoute>
              }
            />

            <Route
              path="/results"
              element={
                <ProtectedRoute>
                  <ProjectionResults />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projection-results"
              element={
                <ProtectedRoute>
                  <ProjectionResults />
                </ProtectedRoute>
              }
            />

            <Route
              path="/upload"
              element={
                <ProtectedRoute>
                  <FileUpload />
                </ProtectedRoute>
              }
            />
            <Route
              path="/file-upload"
              element={
                <ProtectedRoute>
                  <FileUpload />
                </ProtectedRoute>
              }
            />

            {/* fallback: send unknown routes to dashboard (protected) */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>

      <footer className="bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 text-center py-4">
        <div className="text-sm text-gray-600 dark:text-gray-300">© {new Date().getFullYear()} Pension Dashboard</div>
      </footer>
    </div>
  );
}
