import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CameraOff } from 'lucide-react';

interface FisheyeCameraBackgroundProps {
  isActive: boolean;
}

export const FisheyeCameraBackground: React.FC<FisheyeCameraBackgroundProps> = ({ isActive }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    if (isActive) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isActive]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      setStream(mediaStream);
      setHasPermission(true);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch {
      console.log('Camera permission denied');
      setHasPermission(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
        >
          {/* SVG fisheye distortion filter */}
          <svg className="absolute w-0 h-0">
            <defs>
              <filter id="fisheye-filter">
                {/* Barrel distortion approximation */}
                <feTurbulence
                  type="turbulence"
                  baseFrequency="0.01 0.01"
                  numOctaves="1"
                  seed="2"
                  result="turbulence"
                />
                <feDisplacementMap
                  in="SourceGraphic"
                  in2="turbulence"
                  scale="8"
                  xChannelSelector="R"
                  yChannelSelector="G"
                  result="displaced"
                />
                {/* Radial lens warp using component transfer */}
                <feGaussianBlur in="displaced" stdDeviation="0.5" result="blurred" />
                <feMerge>
                  <feMergeNode in="blurred" />
                </feMerge>
              </filter>
              {/* Vignette for lens edge darkening */}
              <radialGradient id="vignette-gradient" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="transparent" />
                <stop offset="60%" stopColor="transparent" />
                <stop offset="100%" stopColor="rgba(0,0,0,0.7)" />
              </radialGradient>
            </defs>
          </svg>

          {/* Camera feed */}
          {hasPermission !== false ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
                style={{
                  filter: 'url(#fisheye-filter) brightness(0.4) contrast(1.2) saturate(0.6)',
                }}
              />
              {/* Fisheye lens curvature overlay */}
              <div
                className="absolute inset-0"
                style={{
                  background: `
                    radial-gradient(ellipse 120% 120% at 50% 50%, transparent 40%, rgba(0,0,0,0.6) 70%, rgba(0,0,0,0.9) 100%),
                    radial-gradient(circle at 30% 30%, rgba(255,255,255,0.08) 0%, transparent 50%),
                    radial-gradient(circle at 70% 60%, rgba(255,255,255,0.04) 0%, transparent 40%)
                  `,
                }}
              />
              {/* Chrome lens ring effect */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  boxShadow: `
                    inset 0 0 100px rgba(0,0,0,0.5),
                    inset 0 0 200px rgba(0,0,0,0.3),
                    inset 0 0 40px rgba(255,255,255,0.03)
                  `,
                }}
              />
              {/* Subtle scan line effect */}
              <div
                className="absolute inset-0 pointer-events-none opacity-[0.03]"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.5) 2px, rgba(255,255,255,0.5) 4px)',
                }}
              />
            </>
          ) : (
            /* Fallback when camera is denied — animated dark gradient */
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(ellipse at 50% 50%, hsl(220 20% 12%), hsl(220 20% 6%))',
              }}
            />
          )}

          {/* Camera status indicator */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="absolute bottom-4 left-4 z-10 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-xl border border-white/10"
          >
            {hasPermission ? (
              <>
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[10px] text-white/60 font-medium tracking-wider uppercase">
                  Live Mirror
                </span>
              </>
            ) : (
              <>
                <CameraOff className="w-3 h-3 text-white/40" />
                <span className="text-[10px] text-white/40 font-medium">
                  Camera off
                </span>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
