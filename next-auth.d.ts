import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      plan?: "FREE" | "PRO";
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
