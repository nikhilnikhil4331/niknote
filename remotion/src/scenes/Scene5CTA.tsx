import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Img, staticFile } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["700", "900"], subsets: ["latin"] });

export const Scene5CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const titleScale = spring({ frame, fps, config: { damping: 12, stiffness: 80 } });

  const subOpacity = interpolate(frame, [20, 35], [0, 1], { extrapolateRight: "clamp" });

  const ctaOpacity = interpolate(frame, [35, 50], [0, 1], { extrapolateRight: "clamp" });
  const ctaScale = spring({ frame: frame - 35, fps, config: { damping: 10, stiffness: 100 } });

  const urlOpacity = interpolate(frame, [55, 70], [0, 1], { extrapolateRight: "clamp" });
  const urlY = interpolate(spring({ frame: frame - 55, fps, config: { damping: 18 } }), [0, 1], [15, 0]);

  const glowPulse = 0.4 + 0.3 * Math.sin(frame * 0.05);

  /* Shimmer across button */
  const shimmerX = interpolate(frame, [50, 120], [-400, 600], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  /* Logo entrance */
  const logoOpacity = interpolate(frame, [75, 90], [0, 1], { extrapolateRight: "clamp" });
  const logoScale = spring({ frame: frame - 75, fps, config: { damping: 14 } });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", fontFamily }}>
      {/* Big center glow */}
      <div style={{
        position: "absolute",
        width: 1000,
        height: 800,
        borderRadius: "50%",
        background: `radial-gradient(ellipse, rgba(249,115,22,${glowPulse * 0.15}), rgba(236,72,153,${glowPulse * 0.1}) 40%, transparent 70%)`,
        filter: "blur(60px)",
      }} />

      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 0, textAlign: "center" }}>

        {/* Title */}
        <div style={{
          opacity: titleOpacity,
          transform: `scale(${titleScale})`,
          fontSize: 82,
          fontWeight: 900,
          lineHeight: 1.1,
          letterSpacing: -2,
        }}>
          <span style={{ color: "white" }}>Ready to Write</span>
          <br />
          <span style={{
            background: "linear-gradient(135deg, #fb923c, #ec4899, #a855f7)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>Beautifully?</span>
        </div>

        {/* Sub */}
        <div style={{
          opacity: subOpacity,
          marginTop: 20,
          fontSize: 24,
          color: "rgba(255,255,255,0.4)",
          maxWidth: 600,
        }}>
          Join thousands of students who've made their notes smarter, faster, and more personal.
        </div>

        {/* CTA */}
        <div style={{
          opacity: ctaOpacity,
          transform: `scale(${ctaScale})`,
          marginTop: 40,
          position: "relative",
        }}>
          <div style={{
            position: "absolute",
            inset: -24,
            borderRadius: 60,
            background: "linear-gradient(135deg, #fb923c, #ec4899, #a855f7)",
            filter: "blur(35px)",
            opacity: glowPulse * 0.6,
          }} />
          <div style={{
            position: "relative",
            padding: "22px 64px",
            borderRadius: 60,
            background: "linear-gradient(135deg, #fb923c, #ec4899, #a855f7)",
            fontSize: 28,
            fontWeight: 900,
            color: "white",
            overflow: "hidden",
          }}>
            {/* Shimmer */}
            <div style={{
              position: "absolute",
              top: 0,
              left: shimmerX,
              width: 120,
              height: "100%",
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)",
              transform: "skewX(-20deg)",
            }} />
            <span style={{ position: "relative", display: "flex", alignItems: "center", gap: 10 }}>
              Get Started — It's Free
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </span>
          </div>
        </div>

        {/* URL */}
        <div style={{
          opacity: urlOpacity,
          transform: `translateY(${urlY}px)`,
          marginTop: 28,
          fontSize: 20,
          color: "rgba(255,255,255,0.25)",
          fontWeight: 700,
          letterSpacing: 2,
        }}>
          niknote.online
        </div>

        {/* Logo */}
        <div style={{ opacity: logoOpacity, transform: `scale(${logoScale})`, marginTop: 30 }}>
          <Img src={staticFile("images/logo.png")} style={{ height: 50, objectFit: "contain", opacity: 0.5 }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};
