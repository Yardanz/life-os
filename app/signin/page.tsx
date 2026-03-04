import { redirect } from "next/navigation";

type SignInPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = (await searchParams) ?? {};
  const callbackUrlRaw = Array.isArray(params.callbackUrl) ? params.callbackUrl[0] : params.callbackUrl;
  const callbackUrl = callbackUrlRaw && callbackUrlRaw.startsWith("/") ? callbackUrlRaw : "/app/live";
  const target = new URL("/", "http://localhost");
  target.searchParams.set("auth", "1");
  target.searchParams.set("callbackUrl", callbackUrl);
  redirect(`${target.pathname}${target.search}`);
}
