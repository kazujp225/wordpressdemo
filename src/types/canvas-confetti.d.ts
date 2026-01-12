// canvas-confetti の型定義
// TODO: 本番実装時に @types/canvas-confetti をインストール

declare module 'canvas-confetti' {
  interface Options {
    particleCount?: number;
    angle?: number;
    spread?: number;
    startVelocity?: number;
    decay?: number;
    gravity?: number;
    drift?: number;
    ticks?: number;
    origin?: {
      x?: number;
      y?: number;
    };
    colors?: string[];
    shapes?: ('square' | 'circle' | 'star')[];
    scalar?: number;
    zIndex?: number;
    disableForReducedMotion?: boolean;
  }

  interface ConfettiFunction {
    (options?: Options): Promise<null>;
    reset: () => void;
    create: (
      canvas: HTMLCanvasElement,
      globalOptions?: { resize?: boolean; useWorker?: boolean }
    ) => ConfettiFunction;
  }

  const confetti: ConfettiFunction;
  export default confetti;
}
