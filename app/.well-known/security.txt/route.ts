import { getSupportMailto } from "@/lib/supportContact";

const DEFAULT_CONTACT = getSupportMailto();

function buildSecurityTxt(): string {
  const expires = new Date();
  expires.setUTCFullYear(expires.getUTCFullYear() + 1);

  return `Contact: ${DEFAULT_CONTACT}\nExpires: ${expires.toISOString()}\n`;
}

export async function GET() {
  return new Response(buildSecurityTxt(), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
