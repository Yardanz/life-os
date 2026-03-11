import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px",
          background:
            "linear-gradient(135deg, #070b10 0%, #0b1220 45%, #0f1f35 100%)",
          color: "#e4e4e7",
          fontFamily: "Arial, Helvetica, sans-serif",
          border: "1px solid rgba(34, 211, 238, 0.24)",
        }}
      >
        <div
          style={{
            fontSize: 24,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: "rgba(161, 161, 170, 0.92)",
          }}
        >
          LIFE OS
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div
            style={{
              fontSize: 68,
              lineHeight: 1.05,
              fontWeight: 700,
              color: "#f4f4f5",
              maxWidth: "95%",
            }}
          >
            Operator System
          </div>
          <div
            style={{
              fontSize: 30,
              lineHeight: 1.2,
              color: "#a1a1aa",
              maxWidth: "92%",
            }}
          >
            Trajectory control, diagnostics, and anti-chaos operations.
          </div>
        </div>

        <div
          style={{
            fontSize: 22,
            letterSpacing: "0.08em",
            color: "rgba(103, 232, 249, 0.92)",
          }}
        >
          life-os-tau-five.vercel.app
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
