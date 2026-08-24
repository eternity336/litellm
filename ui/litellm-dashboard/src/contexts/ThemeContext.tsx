import React, { createContext, useCallback, useContext, useState, useEffect, ReactNode } from "react";
import { getProxyBaseUrl } from "@/components/networking";
import { BUILTIN_THEMES, mergeThemes } from "@/lib/builtinThemes";

const _BLOCK_RE = /(?::root|\.dark)\s*\{([^}]*)\}/g;
const _DECL_RE = /^--([\w-]+)\s*:\s*(\S[^;]*)$/;

export interface UITheme {
  name: string;
  palette: {
    colors: Record<string, string>;
  };
}

const ACTIVE_THEME_STORAGE_KEY = "litellm-active-theme";

// A named theme is a single flat palette applied to both :root and .dark, so it
// renders identically under the light/dark toggle.
export function themeToCss(theme: UITheme): string {
  const decls = Object.entries(theme.palette?.colors ?? {})
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => `--${key}: ${value}`)
    .join("; ");
  if (!decls) return "";
  return `:root { ${decls}; }\n.dark { ${decls}; }`;
}

function sanitizeThemeCss(css: string): string | null {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "").trim();
  if (!stripped || stripped.includes("@") || /\burl\s*\(/i.test(stripped)) return null;
  if (stripped.replace(_BLOCK_RE, "").trim()) return null;
  const parts: string[] = [];
  for (const m of stripped.matchAll(_BLOCK_RE)) {
    const selector = m[0].split("{")[0].trim();
    const decls = m[1].split(";").map((d) => d.trim()).filter(Boolean);
    const safe: string[] = [];
    for (const decl of decls) {
      const dm = decl.match(_DECL_RE);
      if (dm) safe.push(`--${dm[1]}: ${dm[2].trim()}`);
    }
    if (safe.length) parts.push(`${selector} { ${safe.join("; ")}; }`);
  }
  return parts.length ? parts.join("\n") : null;
}

interface ThemeContextType {
  logoUrl: string | null;
  setLogoUrl: (url: string | null) => void;
  logoUrlDark: string | null;
  setLogoUrlDark: (url: string | null) => void;
  faviconUrl: string | null;
  setFaviconUrl: (url: string | null) => void;
  customThemeCss: string | null;
  setCustomThemeCss: (css: string | null) => void;
  themes: UITheme[];
  setThemes: (themes: UITheme[]) => void;
  activeThemeId: string | null;
  setActiveThemeId: (id: string | null) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
  accessToken?: string | null;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children, accessToken }) => {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUrlDark, setLogoUrlDark] = useState<string | null>(null);
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null);
  const [customThemeCss, setCustomThemeCss] = useState<string | null>(null);
  const [themes, setThemes] = useState<UITheme[]>([]);
  const [activeThemeId, setActiveThemeIdState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(ACTIVE_THEME_STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const setActiveThemeId = useCallback((id: string | null) => {
    setActiveThemeIdState(id);
    try {
      if (id) window.localStorage.setItem(ACTIVE_THEME_STORAGE_KEY, id);
      else window.localStorage.removeItem(ACTIVE_THEME_STORAGE_KEY);
    } catch {
      // localStorage can be unavailable (private mode); the in-memory selection still works.
    }
  }, []);

  useEffect(() => {
    const loadThemeSettings = async () => {
      try {
        const proxyBaseUrl = getProxyBaseUrl();
        const url = proxyBaseUrl ? `${proxyBaseUrl}/get/ui_theme_settings` : "/get/ui_theme_settings";
        const response = await fetch(url, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.values?.logo_url) {
            setLogoUrl(data.values.logo_url);
          }
          if (data.values?.logo_url_dark) {
            setLogoUrlDark(data.values.logo_url_dark);
          }
          if (data.values?.favicon_url) {
            setFaviconUrl(data.values.favicon_url);
          }
          if (data.values?.custom_theme_css) {
            setCustomThemeCss(sanitizeThemeCss(data.values.custom_theme_css));
          }
          if (Array.isArray(data.values?.themes)) {
            setThemes(data.values.themes);
          }
        }
      } catch (error) {
        console.warn("Failed to load theme settings from backend:", error);
      }
    };

    loadThemeSettings();
  }, []);

  useEffect(() => {
    if (faviconUrl) {
      const existingLinks = document.querySelectorAll("link[rel*='icon']");
      if (existingLinks.length > 0) {
        existingLinks.forEach((link) => {
          (link as HTMLLinkElement).href = faviconUrl;
        });
      } else {
        const link = document.createElement("link");
        link.rel = "icon";
        link.href = faviconUrl;
        document.head.appendChild(link);
      }
    }
  }, [faviconUrl]);

  useEffect(() => {
    const existing = document.getElementById("litellm-custom-theme");
    const safe = customThemeCss ? sanitizeThemeCss(customThemeCss) : null;
    if (safe) {
      if (existing) {
        existing.textContent = safe;
      } else {
        const style = document.createElement("style");
        style.id = "litellm-custom-theme";
        style.textContent = safe;
        document.head.appendChild(style);
      }
    } else {
      existing?.remove();
    }
  }, [customThemeCss]);

  useEffect(() => {
    const active = mergeThemes(BUILTIN_THEMES, themes).find((t) => t.name === activeThemeId);
    const safe = active ? sanitizeThemeCss(themeToCss(active)) : null;
    const existing = document.getElementById("litellm-active-theme");
    if (safe) {
      if (existing) {
        existing.textContent = safe;
      } else {
        const style = document.createElement("style");
        style.id = "litellm-active-theme";
        style.textContent = safe;
        document.head.appendChild(style);
      }
    } else {
      existing?.remove();
    }
  }, [activeThemeId, themes]);

  return (
    <ThemeContext.Provider
      value={{
        logoUrl,
        setLogoUrl,
        logoUrlDark,
        setLogoUrlDark,
        faviconUrl,
        setFaviconUrl,
        customThemeCss,
        setCustomThemeCss,
        themes,
        setThemes,
        activeThemeId,
        setActiveThemeId,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};
