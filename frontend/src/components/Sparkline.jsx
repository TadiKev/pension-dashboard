// src/components/Sparkline.jsx
import React, { useMemo, useRef, useState, useLayoutEffect } from "react";
import { ResponsiveContainer, AreaChart, Area } from "recharts";

/**
 * Sparkline
 * - data: array of numbers OR array of objects with {value}
 * - height: px (default 36)
 */
export default function Sparkline({ data = [], height = 36, color = "#10B981" }) {
  const containerRef = useRef(null);
  const [sizeValid, setSizeValid] = useState(false);

  // Normalize numeric arrays to objects Recharts expects
  const normalized = useMemo(() => {
    if (!Array.isArray(data)) return [];
    return data.map((d) =>
      typeof d === "number" ? { value: d } : d && d.value !== undefined ? d : { value: Number(d) || 0 }
    );
  }, [data]);

  // check container size synchronously after DOM changes (useLayoutEffect)
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) {
      setSizeValid(false);
      return;
    }

    function check() {
      const rect = el.getBoundingClientRect();
      // require positive width & height
      setSizeValid(rect.width > 0 && rect.height > 0);
    }

    // initial
    check();

    // also observe resize for dynamic layout changes
    let ro;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(check);
      ro.observe(el);
    } else {
      // fallback
      window.addEventListener("resize", check);
    }

    return () => {
      if (ro) ro.disconnect();
      else window.removeEventListener("resize", check);
    };
  }, [normalized, height]);

  // If no data, keep an invisible fallback of correct height so layout doesn't collapse
  const containerStyle = { minWidth: 0, minHeight: height, height };

  if (!normalized.length) {
    return <div ref={containerRef} style={containerStyle} className="w-full" aria-hidden="true" />;
  }

  return (
    <div ref={containerRef} style={containerStyle} className="w-full">
      {sizeValid ? (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={normalized} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <Area dataKey="value" stroke={color} fill={color} fillOpacity={0.12} strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        // placeholder (prevents Recharts trying to render immediately)
        <div style={{ width: "100%", height: "100%" }} />
      )}
    </div>
  );
}
