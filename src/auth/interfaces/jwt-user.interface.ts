export interface JwtUser {
  id: string;
  email: string;
  role: "ADMIN" | "AGENCY" | "SHOP";
}