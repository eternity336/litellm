import React, { useState, useEffect, useCallback } from "react";
import { Palette, Plus, Pencil, Trash2, Download, Copy, Check, X } from "lucide-react";
import { CopyToClipboard } from "react-copy-to-clipboard";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UiLoadingSpinner } from "@/components/ui/ui-loading-spinner";
import { ColorPicker } from "@/components/ui/color-picker";
import { useTheme, themeToCss, type UITheme } from "@/contexts/ThemeContext";
import { BUILTIN_THEMES, mergeThemes } from "@/lib/builtinThemes";
import { getProxyBaseUrl, getGlobalLitellmHeaderName } from "@/components/networking";
import { isProxyAdminRole } from "@/utils/roles";
import { toast } from "@/lib/toast";

interface UIThemeSettingsProps {
  userID: string | null;
  userRole: string | null;
  accessToken: string | null;
}

interface ColorVar {
  key: string;
  label: string;
}

const THEME_VAR_OPTIONS: ColorVar[] = [
  { key: "background", label: "Background" },
  { key: "foreground", label: "Text" },
  { key: "card", label: "Card" },
  { key: "card-foreground", label: "Card Text" },
  { key: "popover", label: "Popover" },
  { key: "popover-foreground", label: "Popover Text" },
  { key: "primary", label: "Primary" },
  { key: "primary-foreground", label: "Primary Text" },
  { key: "secondary", label: "Secondary" },
  { key: "secondary-foreground", label: "Secondary Text" },
  { key: "muted", label: "Muted" },
  { key: "muted-foreground", label: "Muted Text" },
  { key: "accent", label: "Accent" },
  { key: "accent-foreground", label: "Accent Text" },
  { key: "destructive", label: "Destructive" },
  { key: "destructive-foreground", label: "Destructive Text" },
  { key: "success", label: "Success" },
  { key: "success-foreground", label: "Success Text" },
  { key: "warning", label: "Warning" },
  { key: "warning-foreground", label: "Warning Text" },
  { key: "info", label: "Info" },
  { key: "info-foreground", label: "Info Text" },
  { key: "border", label: "Border" },
  { key: "input", label: "Input" },
  { key: "ring", label: "Ring" },
  { key: "chart-1", label: "Chart 1" },
  { key: "chart-2", label: "Chart 2" },
  { key: "chart-3", label: "Chart 3" },
  { key: "chart-4", label: "Chart 4" },
  { key: "chart-5", label: "Chart 5" },
];

interface ThemeEditorState {
  open: boolean;
  draftName: string;
  draftColors: Record<string, string>;
  editingOriginalName: string | null;
}

const CLOSED_EDITOR: ThemeEditorState = { open: false, draftName: "", draftColors: {}, editingOriginalName: null };

const safeFilename = (name: string) => name.replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/^-+|-+$/g, "") || "theme";

const UIThemeSettings: React.FC<UIThemeSettingsProps> = ({ userRole, accessToken }) => {
  const {
    logoUrl,
    setLogoUrl,
    logoUrlDark,
    setLogoUrlDark,
    faviconUrl,
    setFaviconUrl,
    customThemeCss,
    themes,
    setThemes,
    activeThemeId,
    setActiveThemeId,
  } = useTheme();

  const isAdmin = isProxyAdminRole(userRole ?? "");

  const allThemes = mergeThemes(BUILTIN_THEMES, themes);

  const [logoUrlInput, setLogoUrlInput] = useState<string>("");
  const [logoUrlDarkInput, setLogoUrlDarkInput] = useState<string>("");
  const [faviconUrlInput, setFaviconUrlInput] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [editor, setEditor] = useState<ThemeEditorState>(CLOSED_EDITOR);

  useEffect(() => {
    if (!accessToken) return;
    const loadBranding = async () => {
      try {
        const proxyBaseUrl = getProxyBaseUrl();
        const url = proxyBaseUrl ? `${proxyBaseUrl}/get/ui_theme_settings` : "/get/ui_theme_settings";
        const response = await fetch(url, {
          method: "GET",
          headers: {
            [getGlobalLitellmHeaderName()]: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        });
        if (response.ok) {
          const data = await response.json();
          setLogoUrlInput(data.values?.logo_url || "");
          setLogoUrlDarkInput(data.values?.logo_url_dark || "");
          setFaviconUrlInput(data.values?.favicon_url || "");
          setLogoUrl(data.values?.logo_url || null);
          setLogoUrlDark(data.values?.logo_url_dark || null);
          setFaviconUrl(data.values?.favicon_url || null);
        }
      } catch (error) {
        console.error("Error loading branding settings:", error);
      }
    };
    loadBranding();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- context setters are stable per-provider
  }, [accessToken]);

  const patchSettings = useCallback(
    async (body: Record<string, unknown>) => {
      const proxyBaseUrl = getProxyBaseUrl();
      const url = proxyBaseUrl ? `${proxyBaseUrl}/update/ui_theme_settings` : "/update/ui_theme_settings";
      const response = await fetch(url, {
        method: "PATCH",
        headers: {
          [getGlobalLitellmHeaderName()]: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error("Failed to update settings");
    },
    [accessToken],
  );

  const handleSaveBranding = async () => {
    setLoading(true);
    try {
      await patchSettings({
        logo_url: logoUrlInput || null,
        logo_url_dark: logoUrlDarkInput || null,
        favicon_url: faviconUrlInput || null,
        custom_theme_css: customThemeCss,
        themes,
      });
      setLogoUrl(logoUrlInput || null);
      setLogoUrlDark(logoUrlDarkInput || null);
      setFaviconUrl(faviconUrlInput || null);
      toast.success("Theme settings updated successfully!");
    } catch (error) {
      console.error("Error updating theme settings:", error);
      toast.fromError("Failed to update theme settings");
    } finally {
      setLoading(false);
    }
  };

  const handleResetBranding = async () => {
    setLogoUrlInput("");
    setLogoUrlDarkInput("");
    setFaviconUrlInput("");
    setLogoUrl(null);
    setLogoUrlDark(null);
    setFaviconUrl(null);
    setLoading(true);
    try {
      await patchSettings({
        logo_url: null,
        logo_url_dark: null,
        favicon_url: null,
        custom_theme_css: null,
        themes,
      });
      toast.success("Theme settings reset to default!");
    } catch (error) {
      console.error("Error resetting theme settings:", error);
      toast.fromError("Failed to reset theme settings");
    } finally {
      setLoading(false);
    }
  };

  const openNewTheme = () => {
    setEditor({ open: true, draftName: "", draftColors: {}, editingOriginalName: null });
  };

  const openEditTheme = (theme: UITheme) => {
    setEditor({
      open: true,
      draftName: theme.name,
      draftColors: { ...theme.palette.colors },
      editingOriginalName: theme.name,
    });
  };

  const updateDraftColor = (key: string, value: string) => {
    setEditor((prev) => ({ ...prev, draftColors: { ...prev.draftColors, [key]: value } }));
  };

  const handleSaveTheme = async () => {
    const name = editor.draftName.trim();
    if (!name) {
      toast.error("Theme name is required");
      return;
    }
    const duplicate = themes.some(
      (t) => t.name.toLowerCase() === name.toLowerCase() && t.name !== editor.editingOriginalName,
    );
    if (duplicate) {
      toast.error("A theme with that name already exists");
      return;
    }
    const colors = Object.fromEntries(
      THEME_VAR_OPTIONS.map((v) => [v.key, editor.draftColors[v.key] ?? ""]).filter(([, value]) => value),
    );
    const nextThemes = [...themes.filter((t) => t.name !== editor.editingOriginalName), { name, palette: { colors } }];
    setLoading(true);
    try {
      await patchSettings({
        logo_url: logoUrl,
        logo_url_dark: logoUrlDark,
        favicon_url: faviconUrl,
        custom_theme_css: customThemeCss,
        themes: nextThemes,
      });
      setThemes(nextThemes);
      setEditor(CLOSED_EDITOR);
      toast.success(editor.editingOriginalName === null ? `Theme "${name}" created!` : `Theme "${name}" updated!`);
    } catch (error) {
      console.error("Error saving theme:", error);
      toast.fromError("Failed to save theme");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTheme = async (name: string) => {
    if (!window.confirm(`Delete theme "${name}"?`)) return;
    const nextThemes = themes.filter((t) => t.name !== name);
    setLoading(true);
    try {
      await patchSettings({
        logo_url: logoUrl,
        logo_url_dark: logoUrlDark,
        favicon_url: faviconUrl,
        custom_theme_css: customThemeCss,
        themes: nextThemes,
      });
      setThemes(nextThemes);
      if (activeThemeId === name) setActiveThemeId(null);
      toast.success(`Theme "${name}" deleted`);
    } catch (error) {
      console.error("Error deleting theme:", error);
      toast.fromError("Failed to delete theme");
    } finally {
      setLoading(false);
    }
  };

  const exportThemeDownload = (theme: UITheme) => {
    const css = themeToCss(theme);
    const blob = new Blob([css], { type: "text/css" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${safeFilename(theme.name)}.css`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const themeSwatches = (theme: UITheme) => Object.values(theme.palette?.colors ?? {}).filter(Boolean).slice(0, 6);

  if (!accessToken) {
    return null;
  }

  return (
    <div className="w-full mx-auto max-w-4xl px-6 py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-bold">Themes</h1>
        <p className="text-sm text-muted-foreground">Pick a theme to personalize your dashboard, and manage your logo and favicon.</p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="size-4" />
              Choose a theme
            </CardTitle>
            <CardDescription>
              Themes apply to the whole dashboard. Your choice is saved to this browser.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveThemeId(null)}
                className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                  activeThemeId === null
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-muted"
                }`}
              >
                Default
              </button>
              {allThemes.map((theme) => (
                <button
                  key={theme.name}
                  type="button"
                  onClick={() => setActiveThemeId(theme.name)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    activeThemeId === theme.name
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <span className="flex -space-x-1">
                    {themeSwatches(theme).map((color, i) => (
                      <span key={i} className="h-3 w-3 rounded-full border border-background" style={{ backgroundColor: color }} />
                    ))}
                  </span>
                  {theme.name}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="size-4" />
                Manage themes
              </CardTitle>
              <CardDescription>Create, edit, and export named color themes.</CardDescription>
              <CardAction>
                <Button size="sm" variant="outline" onClick={openNewTheme} disabled={loading}>
                  <Plus className="size-3.5 mr-1.5" />
                  New theme
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {themes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No themes yet. Create one to get started.</p>
              ) : (
                <ul className="divide-y">
                  {themes.map((theme) => {
                    const css = themeToCss(theme);
                    return (
                      <li key={theme.name} className="flex flex-wrap items-center justify-between gap-3 py-3">
                        <div className="flex items-center gap-2">
                          <span className="flex -space-x-1">
                            {themeSwatches(theme).map((color, i) => (
                              <span key={i} className="h-3.5 w-3.5 rounded-full border border-background" style={{ backgroundColor: color }} />
                            ))}
                          </span>
                          <span className="text-sm font-medium">{theme.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="icon-sm" variant="ghost" onClick={() => openEditTheme(theme)} title="Edit theme" disabled={loading}>
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => exportThemeDownload(theme)}
                            title="Download theme CSS"
                            disabled={loading}
                          >
                            <Download className="size-3.5" />
                          </Button>
                          <CopyToClipboard text={css} onCopy={() => toast.success(`Copied "${theme.name}" CSS to clipboard`)}>
                            <Button size="icon-sm" variant="ghost" title="Copy theme CSS" disabled={loading}>
                              <Copy className="size-3.5" />
                            </Button>
                          </CopyToClipboard>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => handleDeleteTheme(theme.name)}
                            title="Delete theme"
                            disabled={loading}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {editor.open && (
                <div className="mt-4 rounded-lg border p-4">
                  <h3 className="mb-3 text-sm font-semibold">
                    {editor.editingOriginalName === null ? "New theme" : `Edit: ${editor.editingOriginalName}`}
                  </h3>
                  <div className="mb-4 flex items-end gap-2">
                    <div className="flex-1">
                      <Label htmlFor="theme-name" className="mb-1 text-xs">Name</Label>
                      <Input
                        id="theme-name"
                        value={editor.draftName}
                        maxLength={64}
                        placeholder="e.g. Ocean"
                        onChange={(e) => setEditor((prev) => ({ ...prev, draftName: e.target.value }))}
                      />
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setEditor(CLOSED_EDITOR)}>
                      <X className="size-3.5 mr-1.5" />
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSaveTheme} disabled={loading}>
                      {loading && <UiLoadingSpinner className="size-3.5" />}
                      <Check className="size-3.5 mr-1.5" />
                      Save theme
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {THEME_VAR_OPTIONS.map((v) => (
                      <div key={v.key} className="rounded-lg border p-2">
                        <div className="mb-1.5 flex items-center justify-between">
                          <Label htmlFor={`theme-color-${v.key}`} className="text-xs font-medium">{v.label}</Label>
                          {editor.draftColors[v.key] && (
                            <button
                              type="button"
                              className="text-xs text-muted-foreground hover:text-foreground"
                              onClick={() => updateDraftColor(v.key, "")}
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        <ColorPicker
                          id={`theme-color-${v.key}`}
                          label={v.label}
                          value={editor.draftColors[v.key] || "#888888"}
                          onChange={(hex) => updateDraftColor(v.key, hex)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Logo &amp; Favicon</CardTitle>
            <CardDescription>Set a custom logo and favicon for the dashboard.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="ui-theme-logo-url" className="mb-2 text-xs">Custom Logo (light)</Label>
                <Input
                  id="ui-theme-logo-url"
                  placeholder="https://example.com/logo.png"
                  value={logoUrlInput}
                  onChange={(event) => setLogoUrlInput(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="ui-theme-logo-url-dark" className="mb-2 text-xs">Custom Logo (dark)</Label>
                <Input
                  id="ui-theme-logo-url-dark"
                  placeholder="https://example.com/logo-dark.png"
                  value={logoUrlDarkInput}
                  onChange={(event) => setLogoUrlDarkInput(event.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="ui-theme-favicon-url" className="mb-2 text-xs">Custom Favicon</Label>
                <Input
                  id="ui-theme-favicon-url"
                  placeholder="https://example.com/favicon.ico"
                  value={faviconUrlInput}
                  onChange={(event) => setFaviconUrlInput(event.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button onClick={handleSaveBranding} disabled={loading}>
            {loading && <UiLoadingSpinner className="size-4" />}
            Save Changes
          </Button>
          <Button variant="outline" onClick={handleResetBranding} disabled={loading}>
            {loading && <UiLoadingSpinner className="size-4" />}
            Reset to Default
          </Button>
        </div>
      </div>
    </div>
  );
};

export default UIThemeSettings;
