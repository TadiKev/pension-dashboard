import React, { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";   // icons (already included in Vite template if not I can send setup)

export default function ThemeToggle() {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains("dark")
  );

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [dark]);

  return (
    <button
      onClick={() => setDark((d) => !d)}
      className="
        p-2
        rounded-xl
        transition
        duration-300
        bg-gray-200
        dark:bg-gray-800
        hover:bg-gray-300
        dark:hover:bg-gray-700
        text-gray-800
        dark:text-gray-100
        flex
        items-center
        gap-2
      "
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
      {dark ? "Light Mode" : "Dark Mode"}
    </button>
  );
}
