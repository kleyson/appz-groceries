import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDarkMode } from "./useDarkMode";

describe("useDarkMode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.classList.remove("dark");
    localStorage.clear();
  });

  it("should initialize with system theme by default", () => {
    const { result } = renderHook(() => useDarkMode());

    expect(result.current.theme).toBe("system");
  });

  it("should read theme from localStorage", () => {
    vi.mocked(localStorage.getItem).mockReturnValue("dark");

    const { result } = renderHook(() => useDarkMode());

    expect(result.current.theme).toBe("dark");
  });

  it("should toggle between light and dark when theme is not system", () => {
    vi.mocked(localStorage.getItem).mockReturnValue("light");

    const { result } = renderHook(() => useDarkMode());

    expect(result.current.isDark).toBe(false);

    act(() => {
      result.current.toggle();
    });

    expect(result.current.theme).toBe("dark");
    expect(result.current.isDark).toBe(true);
  });

  it("should toggle from system to dark", () => {
    vi.mocked(localStorage.getItem).mockReturnValue("system");

    const { result } = renderHook(() => useDarkMode());

    act(() => {
      result.current.toggle();
    });

    expect(result.current.theme).toBe("dark");
  });

  it("should set specific theme", () => {
    const { result } = renderHook(() => useDarkMode());

    act(() => {
      result.current.setTheme("dark");
    });

    expect(result.current.theme).toBe("dark");
    expect(localStorage.setItem).toHaveBeenCalledWith("theme", "dark");
  });

  it("should add dark class to document when dark theme", () => {
    vi.mocked(localStorage.getItem).mockReturnValue("dark");

    renderHook(() => useDarkMode());

    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("should remove dark class when light theme", () => {
    document.documentElement.classList.add("dark");
    vi.mocked(localStorage.getItem).mockReturnValue("light");

    renderHook(() => useDarkMode());

    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
