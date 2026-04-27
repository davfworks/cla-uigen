import { renderHook, act } from "@testing-library/react";
import { describe, test, expect, vi, beforeEach } from "vitest";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

import { useAuth } from "@/hooks/use-auth";
import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";

const mockSignIn = signInAction as ReturnType<typeof vi.fn>;
const mockSignUp = signUpAction as ReturnType<typeof vi.fn>;
const mockGetAnonWorkData = getAnonWorkData as ReturnType<typeof vi.fn>;
const mockClearAnonWork = clearAnonWork as ReturnType<typeof vi.fn>;
const mockGetProjects = getProjects as ReturnType<typeof vi.fn>;
const mockCreateProject = createProject as ReturnType<typeof vi.fn>;

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    test("isLoading starts as false", () => {
      const { result } = renderHook(() => useAuth());
      expect(result.current.isLoading).toBe(false);
    });

    test("exposes signIn, signUp, and isLoading", () => {
      const { result } = renderHook(() => useAuth());
      expect(typeof result.current.signIn).toBe("function");
      expect(typeof result.current.signUp).toBe("function");
      expect(typeof result.current.isLoading).toBe("boolean");
    });
  });

  describe("signIn", () => {
    test("calls signInAction with the provided credentials", async () => {
      mockSignIn.mockResolvedValue({ success: false, error: "Invalid credentials" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(mockSignIn).toHaveBeenCalledOnce();
      expect(mockSignIn).toHaveBeenCalledWith("user@example.com", "password123");
    });

    test("returns the result from signInAction", async () => {
      const authResult = { success: false, error: "Invalid credentials" };
      mockSignIn.mockResolvedValue(authResult);

      const { result } = renderHook(() => useAuth());

      let returnValue: unknown;
      await act(async () => {
        returnValue = await result.current.signIn("user@example.com", "wrong");
      });

      expect(returnValue).toEqual(authResult);
    });

    test("sets isLoading to true while the request is in-flight", async () => {
      let resolveSignIn: (v: unknown) => void;
      mockSignIn.mockReturnValue(new Promise((r) => { resolveSignIn = r; }));

      const { result } = renderHook(() => useAuth());
      expect(result.current.isLoading).toBe(false);

      act(() => { void result.current.signIn("user@example.com", "password"); });
      expect(result.current.isLoading).toBe(true);

      await act(async () => { resolveSignIn!({ success: false }); });
      expect(result.current.isLoading).toBe(false);
    });

    test("resets isLoading to false after signInAction resolves", async () => {
      mockSignIn.mockResolvedValue({ success: false, error: "error" });

      const { result } = renderHook(() => useAuth());
      await act(async () => { await result.current.signIn("user@example.com", "pass"); });

      expect(result.current.isLoading).toBe(false);
    });

    test("resets isLoading to false even when signInAction throws", async () => {
      mockSignIn.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "pass").catch(() => {});
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("does not navigate when sign-in fails", async () => {
      mockSignIn.mockResolvedValue({ success: false, error: "Invalid credentials" });

      const { result } = renderHook(() => useAuth());
      await act(async () => { await result.current.signIn("user@example.com", "wrong"); });

      expect(mockPush).not.toHaveBeenCalled();
      expect(mockGetProjects).not.toHaveBeenCalled();
      expect(mockCreateProject).not.toHaveBeenCalled();
    });

    test("redirects to the most recent project when there is no anon work", async () => {
      mockSignIn.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(null);
      mockGetProjects.mockResolvedValue([{ id: "project-1" }, { id: "project-2" }]);

      const { result } = renderHook(() => useAuth());
      await act(async () => { await result.current.signIn("user@example.com", "pass"); });

      expect(mockPush).toHaveBeenCalledWith("/project-1");
    });

    test("creates a new project and redirects when the user has no existing projects", async () => {
      mockSignIn.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(null);
      mockGetProjects.mockResolvedValue([]);
      mockCreateProject.mockResolvedValue({ id: "new-project-55" });

      const { result } = renderHook(() => useAuth());
      await act(async () => { await result.current.signIn("user@example.com", "pass"); });

      expect(mockCreateProject).toHaveBeenCalledWith(expect.objectContaining({
        messages: [],
        data: {},
      }));
      expect(mockPush).toHaveBeenCalledWith("/new-project-55");
    });

    test("migrates anon work into a new project on successful sign-in", async () => {
      const anonMessages = [{ role: "user", content: "Build a button" }];
      const anonFsData = { "/": { type: "directory" }, "/App.tsx": { type: "file" } };

      mockSignIn.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue({ messages: anonMessages, fileSystemData: anonFsData });
      mockCreateProject.mockResolvedValue({ id: "migrated-project" });

      const { result } = renderHook(() => useAuth());
      await act(async () => { await result.current.signIn("user@example.com", "pass"); });

      expect(mockCreateProject).toHaveBeenCalledWith(expect.objectContaining({
        messages: anonMessages,
        data: anonFsData,
      }));
      expect(mockClearAnonWork).toHaveBeenCalled();
      expect(mockGetProjects).not.toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/migrated-project");
    });

    test("skips anon work migration when the messages array is empty", async () => {
      mockSignIn.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue({ messages: [], fileSystemData: {} });
      mockGetProjects.mockResolvedValue([{ id: "existing-project" }]);

      const { result } = renderHook(() => useAuth());
      await act(async () => { await result.current.signIn("user@example.com", "pass"); });

      expect(mockClearAnonWork).not.toHaveBeenCalled();
      expect(mockCreateProject).not.toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/existing-project");
    });
  });

  describe("signUp", () => {
    test("calls signUpAction with the provided credentials", async () => {
      mockSignUp.mockResolvedValue({ success: false, error: "Email already registered" });

      const { result } = renderHook(() => useAuth());
      await act(async () => { await result.current.signUp("new@example.com", "password123"); });

      expect(mockSignUp).toHaveBeenCalledOnce();
      expect(mockSignUp).toHaveBeenCalledWith("new@example.com", "password123");
    });

    test("returns the result from signUpAction", async () => {
      const authResult = { success: false, error: "Email already registered" };
      mockSignUp.mockResolvedValue(authResult);

      const { result } = renderHook(() => useAuth());
      let returnValue: unknown;
      await act(async () => {
        returnValue = await result.current.signUp("existing@example.com", "pass");
      });

      expect(returnValue).toEqual(authResult);
    });

    test("sets isLoading to true while the request is in-flight", async () => {
      let resolveSignUp: (v: unknown) => void;
      mockSignUp.mockReturnValue(new Promise((r) => { resolveSignUp = r; }));

      const { result } = renderHook(() => useAuth());
      expect(result.current.isLoading).toBe(false);

      act(() => { void result.current.signUp("new@example.com", "password"); });
      expect(result.current.isLoading).toBe(true);

      await act(async () => { resolveSignUp!({ success: false }); });
      expect(result.current.isLoading).toBe(false);
    });

    test("resets isLoading to false even when signUpAction throws", async () => {
      mockSignUp.mockRejectedValue(new Error("Server error"));

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("new@example.com", "pass").catch(() => {});
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("does not navigate when sign-up fails", async () => {
      mockSignUp.mockResolvedValue({ success: false, error: "Email already registered" });

      const { result } = renderHook(() => useAuth());
      await act(async () => { await result.current.signUp("existing@example.com", "pass"); });

      expect(mockPush).not.toHaveBeenCalled();
      expect(mockCreateProject).not.toHaveBeenCalled();
    });

    test("redirects to the most recent project after successful sign-up with no anon work", async () => {
      mockSignUp.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(null);
      mockGetProjects.mockResolvedValue([{ id: "project-abc" }]);

      const { result } = renderHook(() => useAuth());
      await act(async () => { await result.current.signUp("new@example.com", "pass"); });

      expect(mockPush).toHaveBeenCalledWith("/project-abc");
    });

    test("creates a new project after sign-up when no projects exist", async () => {
      mockSignUp.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(null);
      mockGetProjects.mockResolvedValue([]);
      mockCreateProject.mockResolvedValue({ id: "fresh-project" });

      const { result } = renderHook(() => useAuth());
      await act(async () => { await result.current.signUp("new@example.com", "pass"); });

      expect(mockCreateProject).toHaveBeenCalledWith(expect.objectContaining({
        messages: [],
        data: {},
      }));
      expect(mockPush).toHaveBeenCalledWith("/fresh-project");
    });

    test("migrates anon work into a new project on successful sign-up", async () => {
      const anonMessages = [{ role: "user", content: "Create a form" }];
      const anonFsData = { "/": { type: "directory" } };

      mockSignUp.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue({ messages: anonMessages, fileSystemData: anonFsData });
      mockCreateProject.mockResolvedValue({ id: "anon-migrated" });

      const { result } = renderHook(() => useAuth());
      await act(async () => { await result.current.signUp("new@example.com", "pass"); });

      expect(mockCreateProject).toHaveBeenCalledWith(expect.objectContaining({
        messages: anonMessages,
        data: anonFsData,
      }));
      expect(mockClearAnonWork).toHaveBeenCalled();
      expect(mockGetProjects).not.toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/anon-migrated");
    });

    test("skips anon work migration when messages array is empty after sign-up", async () => {
      mockSignUp.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue({ messages: [], fileSystemData: {} });
      mockGetProjects.mockResolvedValue([{ id: "existing" }]);

      const { result } = renderHook(() => useAuth());
      await act(async () => { await result.current.signUp("new@example.com", "pass"); });

      expect(mockClearAnonWork).not.toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/existing");
    });
  });
});
