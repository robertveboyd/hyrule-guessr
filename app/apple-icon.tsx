import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          background: "#0c1118",
        }}
      >
        <svg width="140" height="140" viewBox="0 0 32 32">
          <polygon fill="#e0a01a" points="16,3.876 9,16 23,16" />
          <polygon fill="#e0a01a" points="9,16 2,28.124 16,28.124" />
          <polygon fill="#e0a01a" points="23,16 16,28.124 30,28.124" />
        </svg>
      </div>
    ),
    size,
  );
}
