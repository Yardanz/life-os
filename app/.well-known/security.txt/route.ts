const DEFAULT_CONTACT = "mailto:security@example.com";

function buildSecurityTxt(): string {
  const contactEmail = process.env.SECURITY_CONTACT_EMAIL?.trim();
  const contact = contactEmail ? `mailto:${contactEmail}` : DEFAULT_CONTACT;
  const expires = new Date();
  expires.setUTCFullYear(expires.getUTCFullYear() + 1);

  return `Contact: ${contact}\nExpires: ${expires.toISOString()}\n`;
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
