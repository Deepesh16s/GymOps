import { apiRequest } from "./client";

export interface RepvynUser {
  _id: string;
  name: string;
  email: string;
}

interface LoginResponse {
  message: string;
  token: string;
  user: RepvynUser;
}

export function login(email: string, password: string): Promise<LoginResponse> {
  return apiRequest<LoginResponse>("/auth/login", {
    method: "POST",
    body: { email: email.trim(), password },
    authenticated: false,
  });
}
