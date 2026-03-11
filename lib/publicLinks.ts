export type PublicLink = {
  label: string;
  href: string;
};

export type PublicFooterLink = PublicLink & {
  group: "product" | "support" | "legal";
};

export const PUBLIC_NAV_LINKS: PublicLink[] = [
  { label: "System Preview", href: "/demo" },
  { label: "Capability Spec", href: "/pricing" },
  { label: "Release", href: "/release" },
  { label: "Operator", href: "/operator" },
  { label: "Support", href: "/support" },
  { label: "Privacy", href: "/privacy" },
  { label: "Refund", href: "/refund" },
  { label: "Terms", href: "/terms" },
];

export const PUBLIC_FOOTER_LINKS: PublicFooterLink[] = [
  { label: "Capability Spec", href: "/pricing", group: "product" },
  { label: "Release", href: "/release", group: "product" },
  { label: "Operator", href: "/operator", group: "product" },
  { label: "Status", href: "/status", group: "product" },
  { label: "Support", href: "/support", group: "support" },
  { label: "Security", href: "/security", group: "support" },
  { label: "Privacy", href: "/privacy", group: "legal" },
  { label: "Refund", href: "/refund", group: "legal" },
  { label: "Terms", href: "/terms", group: "legal" },
];
