export interface SessionUser {
  id: string;
  email: string;
  role: "owner" | "admin" | "viewer";
}
