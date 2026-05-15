// Dynamic favicon — italic "e" in Instrument Serif (the same font used
// for "with receipts." in the hero), rendered in verify-green on the
// canvas dark background. Next.js picks this up automatically.

import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

// Cache the rendered icon at the edge so we only fetch the font once.
export const revalidate = false;

const FONT_URL =
  "https://fonts.gstatic.com/s/instrumentserif/v5/jizHRFtNs2ka5fXjeivQ4LroWlx-6zATiw.ttf";

export default async function Icon() {
  const fontData = await fetch(FONT_URL).then((r) => r.arrayBuffer());

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#060607",
          color: "#34e89e",
          fontFamily: "InstrumentSerif",
          fontStyle: "italic",
          fontSize: 72,
          lineHeight: 1,
          // Nudge upward — the italic "e" sits low in its em-box.
          paddingBottom: 6,
        }}
      >
        e
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "InstrumentSerif",
          data: fontData,
          style: "italic",
          weight: 400,
        },
      ],
    },
  );
}
