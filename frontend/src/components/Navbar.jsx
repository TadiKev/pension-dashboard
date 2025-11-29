// src/components/Navbar.jsx
import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Navbar() {
  const { profile, logout } = useAuth();

  return (
    <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link to="/" className="text-lg font-bold text-green-700 dark:text-green-300">Pension Dashboard</Link>
          <Link to="/scenario" className="text-sm text-gray-600 dark:text-gray-300">Scenario</Link>
          <Link to="/results" className="text-sm text-gray-600 dark:text-gray-300">Results</Link>
          <Link to="/upload" className="text-sm text-gray-600 dark:text-gray-300">Batch Upload</Link>
        </div>

        <div className="flex items-center space-x-4">
          {profile ? (
            <>
              <div className="text-sm text-gray-700 dark:text-gray-200">{profile.username}</div>
              {profile.is_talent_verify && <Link to="/admin" className="text-sm text-gray-600 dark:text-gray-300">Admin</Link>}
              <button onClick={logout} className="px-3 py-1 rounded bg-gray-100 dark:bg-gray-700 text-sm">Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm text-gray-600 dark:text-gray-300">Login</Link>
              <Link to="/signup" className="text-sm text-gray-600 dark:text-gray-300">Signup</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
