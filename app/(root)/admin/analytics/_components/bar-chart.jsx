"use client";

import { useEffect, useRef, useState } from "react";

const PAD = { top: 12, right: 8, bottom: 26, left: 32 };

// Four equal steps, each a round integer just above a quarter of the max.
function niceMax(v) {
  if (v <= 4) return 4;
  const raw = v / 4;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]
    .map((m) => m * p)
    .find((x) => Number.isInteger(x) && x >= raw);
  return step * 4;
}

// Rounded top corners only, so the bar stays anchored to the baseline.
function topRounded(x, y, w, h, r) {
  r = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export default function BarChart({ data, keys, height = 240, unitLabel }) {
  const wrap = useRef(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setWidth(Math.max(160, Math.floor(e.contentRect.width))),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const totals = data.map((d) => keys.reduce((s, k) => s + (d[k.key] || 0), 0));
  const max = niceMax(Math.max(0, ...totals));
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const slot = innerW / Math.max(1, data.length);
  const barW = Math.max(3, Math.min(36, slot * 0.62));
  const yOf = (v) => PAD.top + innerH - (v / max) * innerH;
  const every = Math.ceil(data.length / Math.max(1, Math.floor(innerW / 34)));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));

  const h = hover != null ? data[hover] : null;
  const tipLeft = hover != null ? PAD.left + slot * hover + slot / 2 : 0;

  return (
    <div
      ref={wrap}
      className="relative w-full select-none"
      style={{ minHeight: height }}
      onTouchEnd={() => setTimeout(() => setHover(null), 2500)}
    >
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={unitLabel}>
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={yOf(t)}
                y2={yOf(t)}
                stroke="var(--viz-grid)"
                strokeWidth="1"
              />
              <text
                x={PAD.left - 6}
                y={yOf(t)}
                dy="0.32em"
                textAnchor="end"
                className="fill-[var(--viz-muted)] text-[11px]"
              >
                {t}
              </text>
            </g>
          ))}

          {data.map((d, i) => {
            const x = PAD.left + slot * i + (slot - barW) / 2;
            let acc = 0;
            const segs = keys
              .map((k) => ({ k, v: d[k.key] || 0 }))
              .filter((s) => s.v > 0);
            return (
              <g key={i} opacity={hover != null && hover !== i ? 0.45 : 1}>
                {segs.map((s, j) => {
                  const y0 = yOf(acc);
                  acc += s.v;
                  const y1 = yOf(acc);
                  const gap = j < segs.length - 1 ? 2 : 0;
                  const hgt = Math.max(0, y0 - y1 - gap);
                  const yy = y1 + gap;
                  return j === segs.length - 1 ? (
                    <path
                      key={s.k.key}
                      d={topRounded(x, yy - gap, barW, hgt + gap, 4)}
                      fill={s.k.color}
                    />
                  ) : (
                    <rect
                      key={s.k.key}
                      x={x}
                      y={yy}
                      width={barW}
                      height={hgt}
                      fill={s.k.color}
                    />
                  );
                })}
                {i % every === 0 && (
                  <text
                    x={x + barW / 2}
                    y={height - 8}
                    textAnchor="middle"
                    className={`text-[11px] ${d.future ? "fill-[var(--viz-faint)]" : "fill-[var(--viz-muted)]"}`}
                  >
                    {d.label}
                  </text>
                )}
                <rect
                  x={PAD.left + slot * i}
                  y={PAD.top}
                  width={slot}
                  height={innerH}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onTouchStart={() => setHover(i)}
                />
              </g>
            );
          })}
          <line
            x1={PAD.left}
            x2={width - PAD.right}
            y1={yOf(0)}
            y2={yOf(0)}
            stroke="var(--viz-axis)"
            strokeWidth="1"
          />
        </svg>
      )}

      {h && width > 0 && (
        <div
          className="pointer-events-none absolute top-0 z-10 min-w-[150px] rounded-lg border border-[var(--viz-grid)] bg-white px-3 py-2 text-xs shadow-lg"
          style={{
            left: Math.min(Math.max(tipLeft, 80), width - 80),
            transform: "translateX(-50%)",
          }}
        >
          <p className="mb-1 font-semibold text-[#0D060C]">
            {h.tipLabel || h.label}
          </p>
          {keys.map((k) => (
            <p
              key={k.key}
              className="flex items-center justify-between gap-4 text-[#3A3D42]"
            >
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block size-2 rounded-full"
                  style={{ background: k.color }}
                />
                {k.label}
              </span>
              <span className="font-medium tabular-nums text-[#0D060C]">
                {h[k.key] || 0}
              </span>
            </p>
          ))}
          {keys.length > 1 && unitLabel && (
            <p className="mt-1 border-t border-[var(--viz-grid)] pt-1 text-[#3A3D42]">
              {unitLabel}:{" "}
              <span className="font-medium text-[#0D060C]">{h.total}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
