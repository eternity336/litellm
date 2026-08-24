import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { toast } from "@/lib/toast";

import UIThemeSettings from "./UIThemeSettings";

const themeStore = vi.hoisted(() => ({
  logoUrl: null as string | null,
  logoUrlDark: null as string | null,
  faviconUrl: null as string | null,
  customThemeCss: null as string | null,
  themes: [] as { name: string; palette: { colors: Record<string, string> } }[],
  activeThemeId: null as string | null,
}));

vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({
    logoUrl: themeStore.logoUrl,
    setLogoUrl: (v: string | null) => {
      themeStore.logoUrl = v;
    },
    logoUrlDark: themeStore.logoUrlDark,
    setLogoUrlDark: (v: string | null) => {
      themeStore.logoUrlDark = v;
    },
    faviconUrl: themeStore.faviconUrl,
    setFaviconUrl: (v: string | null) => {
      themeStore.faviconUrl = v;
    },
    customThemeCss: themeStore.customThemeCss,
    setCustomThemeCss: (v: string | null) => {
      themeStore.customThemeCss = v;
    },
    themes: themeStore.themes,
    setThemes: (t: { name: string; palette: { colors: Record<string, string> } }[]) => {
      themeStore.themes = t;
    },
    activeThemeId: themeStore.activeThemeId,
    setActiveThemeId: (id: string | null) => {
      themeStore.activeThemeId = id;
    },
  }),
  themeToCss: (theme: { name: string; palette: { colors: Record<string, string> } }) => {
    const decls = Object.entries(theme.palette?.colors ?? {})
      .filter(([, v]) => v)
      .map(([k, v]) => `--${k}: ${v}`)
      .join("; ");
    return decls ? `:root { ${decls}; }\n.dark { ${decls}; }` : "";
  },
}));

vi.mock("@/components/networking", () => ({
  getProxyBaseUrl: () => "",
  getGlobalLitellmHeaderName: () => "Authorization",
}));

const LOGO_PLACEHOLDER = "https://example.com/logo.png";
const FAVICON_PLACEHOLDER = "https://example.com/favicon.ico";

const okResponse = (values: Record<string, unknown> = {}) =>
  Promise.resolve({ ok: true, json: () => Promise.resolve({ values }) } as Response);

const fetchMock = vi.fn<typeof fetch>();

const patchCalls = () => fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH");

const bodyOf = (call: Parameters<typeof fetch>) => JSON.parse(String(call[1]?.body));

const renderSettings = (userRole: string, accessToken: string = "sk-test") =>
  render(<UIThemeSettings userID="user-1" userRole={userRole} accessToken={accessToken} />);

describe("UIThemeSettings", () => {
  beforeEach(() => {
    themeStore.logoUrl = null;
    themeStore.logoUrlDark = null;
    themeStore.faviconUrl = null;
    themeStore.customThemeCss = null;
    themeStore.themes = [];
    themeStore.activeThemeId = null;
    vi.clearAllMocks();
    fetchMock.mockImplementation(() => okResponse());
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should render nothing without an access token", () => {
    const { container } = render(<UIThemeSettings userID="user-1" userRole="Admin" accessToken={null} />);

    expect(container).toBeEmptyDOMElement();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("should load the saved logo and favicon urls into the inputs", async () => {
    fetchMock.mockImplementation(() =>
      okResponse({ logo_url: "https://cdn.example.com/logo.svg", favicon_url: "https://cdn.example.com/fav.ico" }),
    );

    renderSettings("Admin");

    await waitFor(() => {
      expect(screen.getByPlaceholderText(LOGO_PLACEHOLDER)).toHaveValue("https://cdn.example.com/logo.svg");
    });
    expect(screen.getByPlaceholderText(FAVICON_PLACEHOLDER)).toHaveValue("https://cdn.example.com/fav.ico");
    expect(themeStore.logoUrl).toBe("https://cdn.example.com/logo.svg");
    expect(themeStore.faviconUrl).toBe("https://cdn.example.com/fav.ico");
  });

  it("should save the entered urls and report success", async () => {
    const user = userEvent.setup();
    renderSettings("Admin");

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    fireEvent.change(screen.getByPlaceholderText(LOGO_PLACEHOLDER), { target: { value: "https://a.test/logo.png" } });
    fireEvent.change(screen.getByPlaceholderText(FAVICON_PLACEHOLDER), { target: { value: "https://a.test/fav.ico" } });
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => expect(patchCalls()).toHaveLength(1));
    expect(bodyOf(patchCalls()[0])).toEqual({
      logo_url: "https://a.test/logo.png",
      logo_url_dark: null,
      favicon_url: "https://a.test/fav.ico",
      custom_theme_css: null,
      themes: [],
    });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Theme settings updated successfully!"));
  });

  it("should clear the inputs and persist nulls when resetting branding", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(() =>
      okResponse({ logo_url: "https://cdn.example.com/logo.svg", favicon_url: "https://cdn.example.com/fav.ico" }),
    );
    themeStore.themes = [{ name: "Ocean", palette: { colors: { primary: "#111111" } } }];

    renderSettings("Admin");

    await waitFor(() => {
      expect(screen.getByPlaceholderText(LOGO_PLACEHOLDER)).toHaveValue("https://cdn.example.com/logo.svg");
    });

    await user.click(screen.getByRole("button", { name: "Reset to Default" }));

    await waitFor(() => expect(patchCalls()).toHaveLength(1));
    expect(bodyOf(patchCalls()[0])).toEqual({
      logo_url: null,
      logo_url_dark: null,
      favicon_url: null,
      custom_theme_css: null,
      themes: [{ name: "Ocean", palette: { colors: { primary: "#111111" } } }],
    });
    expect(screen.getByPlaceholderText(LOGO_PLACEHOLDER)).toHaveValue("");
    expect(screen.getByPlaceholderText(FAVICON_PLACEHOLDER)).toHaveValue("");
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Theme settings reset to default!"));
  });

  it("should surface a backend failure when saving fails", async () => {
    const user = userEvent.setup();
    renderSettings("Admin");

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    fetchMock.mockImplementation(() => Promise.resolve({ ok: false } as Response));

    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => expect(toast.fromError).toHaveBeenCalledWith("Failed to update theme settings"));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("should hide theme management from non-admin users but still show the selector", async () => {
    renderSettings("regular_user");

    await waitFor(() => expect(screen.getByRole("button", { name: "Default" })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "New theme" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save theme" })).not.toBeInTheDocument();
  });

  it("should show the built-in Ocean theme in the selector even when no admin themes exist", async () => {
    renderSettings("regular_user");

    await waitFor(() => expect(screen.getByRole("button", { name: "Ocean" })).toBeInTheDocument());
    expect(themeStore.themes).toEqual([]);
  });

  it("should let an admin create a named theme", async () => {
    const user = userEvent.setup();
    renderSettings("Admin");

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: "New theme" }));
    await user.type(screen.getByPlaceholderText("e.g. Ocean"), "Ocean");
    await user.click(screen.getByRole("button", { name: "Save theme" }));

    await waitFor(() => expect(patchCalls()).toHaveLength(1));
    expect(bodyOf(patchCalls()[0]).themes).toEqual([{ name: "Ocean", palette: { colors: {} } }]);
    expect(themeStore.themes).toEqual([{ name: "Ocean", palette: { colors: {} } }]);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Theme "Ocean" created!'));
    expect(screen.queryByRole("button", { name: "Save theme" })).not.toBeInTheDocument();
  });

  it("should activate a theme in the selector and persist the choice", async () => {
    const user = userEvent.setup();
    themeStore.themes = [{ name: "Ocean", palette: { colors: { primary: "#111111" } } }];

    renderSettings("Admin");

    await user.click(screen.getByRole("button", { name: "Ocean" }));
    expect(themeStore.activeThemeId).toBe("Ocean");

    await user.click(screen.getByRole("button", { name: "Default" }));
    expect(themeStore.activeThemeId).toBeNull();
  });

  it("should delete a theme after confirmation", async () => {
    const user = userEvent.setup();
    themeStore.themes = [{ name: "Ocean", palette: { colors: { primary: "#111111" } } }];
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    renderSettings("Admin");

    await waitFor(() => expect(screen.getByRole("button", { name: "Delete theme" })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Delete theme" }));

    await waitFor(() => expect(patchCalls()).toHaveLength(1));
    expect(bodyOf(patchCalls()[0]).themes).toEqual([]);
    expect(themeStore.themes).toEqual([]);
    expect(confirmSpy).toHaveBeenCalledWith('Delete theme "Ocean"?');
  });
});
