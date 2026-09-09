import { AbsoluteFill, CalculateMetadataFunction, Composition, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

type Props = { accent?: string };

const calculateMetadata: CalculateMetadataFunction<Props> = () => {
  return {};
};

export const MyComposition = () => {
  return (
    <Composition
      id="JustGrooveLogo"
      component={MyComponent}
      durationInFrames={45}
      fps={30}
      width={704}
      height={396}
      defaultProps={{ accent: "#C8FF35" }}
      calculateMetadata={calculateMetadata}
    />
  );
};

export const MyComponent: React.FC<Props> = ({ accent = "#C8FF35" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({ frame, fps, config: { damping: 10, stiffness: 150, mass: 0.6 } });
  const opacity = interpolate(frame, [0, 8, 35, 45], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const blur = interpolate(frame, [0, 14], [16, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rotation = interpolate(frame, [0, 44], [-4, 2]);
  return <AbsoluteFill style={{ backgroundColor: "#080808", alignItems: "center", justifyContent: "center", color: "#F4F4F2", fontFamily: "Arial, sans-serif", opacity }}>
    <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(rgba(200,255,53,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(200,255,53,.08) 1px, transparent 1px)`, backgroundSize: "32px 32px", transform: `scale(${1 + frame / 400})`, opacity: 0.45 }} />
    <div style={{ position: "absolute", width: 270, height: 270, borderRadius: "50%", backgroundColor: accent, opacity: 0.2, filter: `blur(${blur * 2}px)`, transform: `scale(${0.8 + scale * 0.35})` }} />
    <div style={{ position: "relative", transform: `scale(${0.68 + scale * 0.32}) rotate(${rotation}deg)`, filter: `blur(${blur}px)`, textAlign: "center" }}>
      <div style={{ color: accent, fontSize: 102, fontWeight: 900, letterSpacing: -10, lineHeight: 0.8, textShadow: `0 0 24px ${accent}` }}>JG</div>
      <div style={{ marginTop: 24, fontSize: 27, fontWeight: 800, letterSpacing: 7 }}>JUST GROOVE</div>
      <div style={{ marginTop: 13, color: "#A0A09B", fontSize: 10, letterSpacing: 4 }}>MOVE WITH YOUR OWN RHYTHM</div>
    </div>
  </AbsoluteFill>;
};
