import * as SecureStore from "expo-secure-store";

// EXPO_PUBLIC_-prefixed vars are inlined at build time by Expo, mirroring the
// web client's VITE_API_URL pattern. Falls back to a LAN-reachable dev default
// so a phone on the same network as the Repvyn API can reach it without env setup;
// override with a real EXPO_PUBLIC_API_URL for anything beyond local dev.
const DEFAULT_API_URL = "http://localhost:5000/api";

export const API_URL = process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL;

export const TOKEN_KEY = "repvyn_auth_token";

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "DELETE" | "PATCH";
  body?: unknown;
  authenticated?: boolean;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, authenticated = true } = options;

  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (authenticated) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await response.json() : null;

  if (!response.ok) {
    throw new ApiError(data?.message || `Request failed (${response.status})`, response.status);
  }

  return data as T;
}
