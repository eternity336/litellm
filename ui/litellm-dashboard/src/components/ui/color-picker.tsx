"use client";

import * as React from "react";

import { cn } from "@/lib/cva.config";

interface Hsl {
  h: number;
  s: number;
  l: number;
}

function hexToHsl(hex: string): Hsl {
  let raw = hex.replace("#", "");
  if (raw.length === 3) raw = raw.split("").map((c) => c + c).join("");
  if (raw.length !== 6) return { h: 0, s: 0, l: 0 };
  const r = parseInt(raw.slice(0, 2), 16) / 255;
  const g = parseInt(raw.slice(2, 4), 16) / 255;
  const b = parseInt(raw.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h =
      max === r
        ? (g - b) / d + (g < b ? 6 : 0)
        : max === g
          ? (b - r) / d + 2
          : (r - g) / d + 4;
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
  const sn = s / 100;
  const ln = l / 100;
  const a = sn * Math.min(ln, 1 - ln);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    const value = ln - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * value).toString(16).padStart(2, "0");
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

type Surface = "sl" | "hue" | "lightness";

interface ColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
  id?: string;
  label?: string;
  className?: string;
}

const ColorPicker = React.forwardRef<HTMLDivElement, ColorPickerProps>(
  ({ value, onChange, id, label, className }, ref) => {
    const [draft, setDraft] = React.useState(value);
    const { h, s, l } = hexToHsl(value);

    React.useEffect(() => {
      setDraft(value);
    }, [value]);

    const position = (event: React.PointerEvent, surface: Surface) => {
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      const x = clamp01((event.clientX - rect.left) / rect.width);
      const y = clamp01((event.clientY - rect.top) / rect.height);
      if (surface === "sl") onChange(hslToHex(h, x * 100, 100 - y * 100));
      else if (surface === "hue") onChange(hslToHex(x * 360, s, l));
      else onChange(hslToHex(h, s, 100 - y * 100));
    };

    const handleDown = (surface: Surface) => (event: React.PointerEvent) => {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      position(event, surface);
    };
    const handleMove = (surface: Surface) => (event: React.PointerEvent) => {
      if (event.buttons === 1) position(event, surface);
    };

    const commitDraft = () => {
      const normalized = draft.trim().startsWith("#") ? draft.trim() : `#${draft.trim()}`;
      if (/^#[0-9a-fA-F]{6}$/.test(normalized)) {
        onChange(normalized);
        setDraft(normalized);
      } else {
        setDraft(value);
      }
    };

    return (
      <div ref={ref} data-slot="color-picker" className={cn("w-40 select-none", className)}>
        <div
          role="slider"
          aria-label={label ? `${label} saturation and lightness` : "Saturation and lightness"}
          aria-valuenow={Math.round(l)}
          tabIndex={0}
          className="relative h-28 w-full cursor-crosshair touch-none rounded-md border"
          style={{
            backgroundColor: `hsl(${h}, 100%, 50%)`,
            backgroundImage:
              "linear-gradient(to right, #fff, transparent), linear-gradient(to top, #000, transparent)",
          }}
          onPointerDown={handleDown("sl")}
          onPointerMove={handleMove("sl")}
        >
          <span
            className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
            style={{ left: `${s}%`, top: `${100 - l}%`, backgroundColor: value }}
          />
        </div>

        <div
          role="slider"
          aria-label={label ? `${label} hue` : "Hue"}
          tabIndex={0}
          className="mt-2 h-3 w-full cursor-pointer touch-none rounded-full border"
          style={{
            backgroundImage:
              "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)",
          }}
          onPointerDown={handleDown("hue")}
          onPointerMove={handleMove("hue")}
        >
          <span
            className="pointer-events-none absolute h-4 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white shadow"
            style={{ left: `${(h / 360) * 100}%`, top: "50%", backgroundColor: hslToHex(h, 100, 50) }}
          />
        </div>

        <div
          role="slider"
          aria-label={label ? `${label} lightness` : "Lightness"}
          tabIndex={0}
          className="mt-2 h-3 w-full cursor-pointer touch-none rounded-full border"
          style={{ backgroundImage: `linear-gradient(to top, #000, hsl(${h}, ${s}%, 50%), #fff)` }}
          onPointerDown={handleDown("lightness")}
          onPointerMove={handleMove("lightness")}
        >
          <span
            className="pointer-events-none absolute h-4 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white shadow"
            style={{ left: `${100 - l}%`, top: "50%", backgroundColor: value }}
          />
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span className="h-5 w-5 shrink-0 rounded border" style={{ backgroundColor: value }} />
          <input
            id={id}
            aria-label={label ? `${label} hex value` : "Hex value"}
            className="h-7 w-full rounded border bg-transparent px-2 text-xs font-mono"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitDraft();
            }}
          />
        </div>
      </div>
    );
  },
);
ColorPicker.displayName = "ColorPicker";

export { ColorPicker, hexToHsl, hslToHex };
