export type PublicLink = {
  label: string;
  href: string;
};

export const PUBLIC_NAV_LINKS: PublicLink[] = [
  { label: "System Preview", href: "/demo" },
  { label: "Capability Spec", href: "/pricing" },
  { label: "Release", href: "/release" },
  { label: "Operator", href: "/operator" },
  { label: "Support", href: "/support" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
];

export const PUBLIC_FOOTER_LINKS: PublicLink[] = [
  { label: "Release", href: "/release" },
  { label: "Operator", href: "/operator" },
  { label: "Support", href: "/support" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Security", href: "/.well-known/security.txt" },
  { label: "Status", href: "/status" },
];
