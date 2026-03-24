"use client";

import { useState, useRef, useEffect, useCallback, lazy, Suspense } from "react";

// Dynamically import PixiSandbox to avoid SSR issues
const PixiSandbox = lazy(() => import("./components/PixiSandbox"));

// Fal Logo SVG component
const FalLogo = ({ className = "", size = 32 }: { className?: string; size?: number }) => (
  <svg 
    viewBox="0 0 624 624" 
    fill="currentColor" 
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    className={className}
  >
    <path fillRule="evenodd" clipRule="evenodd" d="M402.365 0C413.17 0.000231771 421.824 8.79229 422.858 19.5596C432.087 115.528 508.461 191.904 604.442 201.124C615.198 202.161 624 210.821 624 221.638V402.362C624 413.179 615.198 421.839 604.442 422.876C508.461 432.096 432.087 508.472 422.858 604.44C421.824 615.208 413.17 624 402.365 624H221.635C210.83 624 202.176 615.208 201.142 604.44C191.913 508.472 115.538 432.096 19.5576 422.876C8.80183 421.839 0 413.179 0 402.362V221.638C0 210.821 8.80183 202.161 19.5576 201.124C115.538 191.904 191.913 115.528 201.142 19.5596C202.176 8.79215 210.83 0 221.635 0H402.365ZM312 124C208.17 124 124 208.17 124 312C124 415.83 208.17 500 312 500C415.83 500 500 415.83 500 312C500 208.17 415.83 124 312 124Z"/>
  </svg>
);

// Fal Spinner component
const FalSpinner = ({ size = 48 }: { size?: number }) => (
  <FalLogo className="fal-spinner" size={size} />
);

type Step = 1 | 2 | 3 | 4 | 5 | 6;

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Frame {
  dataUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
  // Bounding box of actual content (non-transparent pixels) within this frame
  contentBounds: BoundingBox;
}

interface SpriteArchiveEntry {
  id: string;
  name: string;
  createdAt: number;
  characterImageUrl: string | null;
  walkFrames: Frame[];
  dodgeFrames: Frame[];
  attackFrames: Frame[];
  idleFrames: Frame[];
  koFrames: Frame[];
  damageFrames: Frame[];
  victoryFrames: Frame[];
}

// Get bounding box of non-transparent pixels in image data
function getContentBounds(ctx: CanvasRenderingContext2D, width: number, height: number): BoundingBox {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 10) { // Threshold for "visible" pixel
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  
  // If no content found, return full frame
  if (minX > maxX || minY > maxY) {
    return { x: 0, y: 0, width, height };
  }
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

export default function Home() {
  // Step management
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  // Step 1: Character generation
  const [characterInputMode, setCharacterInputMode] = useState<"text" | "image">("text");
  const [characterPrompt, setCharacterPrompt] = useState("");
  const [inputImageUrl, setInputImageUrl] = useState("");
  const [characterImageUrl, setCharacterImageUrl] = useState<string | null>(null);
  const [isGeneratingCharacter, setIsGeneratingCharacter] = useState(false);

  // Step 2: Sprite sheet generation
  const [walkSpriteSheetUrl, setWalkSpriteSheetUrl] = useState<string | null>(null);
  const [dodgeSpriteSheetUrl, setDodgeSpriteSheetUrl] = useState<string | null>(null);
  const [attackSpriteSheetUrl, setAttackSpriteSheetUrl] = useState<string | null>(null);
  const [idleSpriteSheetUrl, setIdleSpriteSheetUrl] = useState<string | null>(null);
  const [koSpriteSheetUrl, setKoSpriteSheetUrl] = useState<string | null>(null);
  const [damageSpriteSheetUrl, setDamageSpriteSheetUrl] = useState<string | null>(null);
  const [victorySpriteSheetUrl, setVictorySpriteSheetUrl] = useState<string | null>(null);
  const [isGeneratingSpriteSheet, setIsGeneratingSpriteSheet] = useState(false);

  // Step 3: Background removal
  const [walkBgRemovedUrl, setWalkBgRemovedUrl] = useState<string | null>(null);
  const [dodgeBgRemovedUrl, setDodgeBgRemovedUrl] = useState<string | null>(null);
  const [attackBgRemovedUrl, setAttackBgRemovedUrl] = useState<string | null>(null);
  const [idleBgRemovedUrl, setIdleBgRemovedUrl] = useState<string | null>(null);
  const [koBgRemovedUrl, setKoBgRemovedUrl] = useState<string | null>(null);
  const [damageBgRemovedUrl, setDamageBgRemovedUrl] = useState<string | null>(null);
  const [victoryBgRemovedUrl, setVictoryBgRemovedUrl] = useState<string | null>(null);
  const [isRemovingBg, setIsRemovingBg] = useState(false);

  // Step 4: Frame extraction (grid-based) - walk
  const [walkGridCols, setWalkGridCols] = useState(2);
  const [walkGridRows, setWalkGridRows] = useState(2);
  const [walkVerticalDividers, setWalkVerticalDividers] = useState<number[]>([]);
  const [walkHorizontalDividers, setWalkHorizontalDividers] = useState<number[]>([]);
  const [walkExtractedFrames, setWalkExtractedFrames] = useState<Frame[]>([]);
  const [walkSpriteSheetDimensions, setWalkSpriteSheetDimensions] = useState({ width: 0, height: 0 });
  const walkSpriteSheetRef = useRef<HTMLImageElement>(null);

  // Step 4: Frame extraction (grid-based) - jump
  const [dodgeGridCols, setDodgeGridCols] = useState(2);
  const [dodgeGridRows, setDodgeGridRows] = useState(2);
  const [dodgeVerticalDividers, setDodgeVerticalDividers] = useState<number[]>([]);
  const [dodgeHorizontalDividers, setDodgeHorizontalDividers] = useState<number[]>([]);
  const [dodgeExtractedFrames, setDodgeExtractedFrames] = useState<Frame[]>([]);
  const [dodgeSpriteSheetDimensions, setDodgeSpriteSheetDimensions] = useState({ width: 0, height: 0 });
  const dodgeSpriteSheetRef = useRef<HTMLImageElement>(null);

  // Step 4: Frame extraction (grid-based) - attack
  const [attackGridCols, setAttackGridCols] = useState(2);
  const [attackGridRows, setAttackGridRows] = useState(2);
  const [attackVerticalDividers, setAttackVerticalDividers] = useState<number[]>([]);
  const [attackHorizontalDividers, setAttackHorizontalDividers] = useState<number[]>([]);
  const [attackExtractedFrames, setAttackExtractedFrames] = useState<Frame[]>([]);
  const [attackSpriteSheetDimensions, setAttackSpriteSheetDimensions] = useState({ width: 0, height: 0 });
  const attackSpriteSheetRef = useRef<HTMLImageElement>(null);

  // Step 4: Frame extraction (grid-based) - idle
  const [idleGridCols, setIdleGridCols] = useState(2);
  const [idleGridRows, setIdleGridRows] = useState(2);
  const [idleVerticalDividers, setIdleVerticalDividers] = useState<number[]>([]);
  const [idleHorizontalDividers, setIdleHorizontalDividers] = useState<number[]>([]);
  const [idleExtractedFrames, setIdleExtractedFrames] = useState<Frame[]>([]);
  const [idleSpriteSheetDimensions, setIdleSpriteSheetDimensions] = useState({ width: 0, height: 0 });
  const idleSpriteSheetRef = useRef<HTMLImageElement>(null);

  // Step 4: Frame extraction (grid-based) - ko
  const [koGridCols, setKoGridCols] = useState(2);
  const [koGridRows, setKoGridRows] = useState(2);
  const [koVerticalDividers, setKoVerticalDividers] = useState<number[]>([]);
  const [koHorizontalDividers, setKoHorizontalDividers] = useState<number[]>([]);
  const [koExtractedFrames, setKoExtractedFrames] = useState<Frame[]>([]);
  const [koSpriteSheetDimensions, setKoSpriteSheetDimensions] = useState({ width: 0, height: 0 });
  const koSpriteSheetRef = useRef<HTMLImageElement>(null);

  // Step 4: Frame extraction (grid-based) - damage
  const [damageGridCols, setDamageGridCols] = useState(2);
  const [damageGridRows, setDamageGridRows] = useState(2);
  const [damageVerticalDividers, setDamageVerticalDividers] = useState<number[]>([]);
  const [damageHorizontalDividers, setDamageHorizontalDividers] = useState<number[]>([]);
  const [damageExtractedFrames, setDamageExtractedFrames] = useState<Frame[]>([]);
  const [damageSpriteSheetDimensions, setDamageSpriteSheetDimensions] = useState({ width: 0, height: 0 });
  const damageSpriteSheetRef = useRef<HTMLImageElement>(null);

  // Step 4: Frame extraction (grid-based) - victory
  const [victoryGridCols, setVictoryGridCols] = useState(2);
  const [victoryGridRows, setVictoryGridRows] = useState(2);
  const [victoryVerticalDividers, setVictoryVerticalDividers] = useState<number[]>([]);
  const [victoryHorizontalDividers, setVictoryHorizontalDividers] = useState<number[]>([]);
  const [victoryExtractedFrames, setVictoryExtractedFrames] = useState<Frame[]>([]);
  const [victorySpriteSheetDimensions, setVictorySpriteSheetDimensions] = useState({ width: 0, height: 0 });
  const victorySpriteSheetRef = useRef<HTMLImageElement>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Which sprite sheet is being edited
  const [activeSheet, setActiveSheet] = useState<"walk" | "dodge" | "attack" | "idle" | "ko" | "damage" | "victory">("walk");

  // Step 5: Animation preview
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [fps, setFps] = useState(8);
  const [direction, setDirection] = useState<"right" | "left">("right");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Step 6: Sandbox
  const [backgroundMode, setBackgroundMode] = useState<"default" | "custom">("default");
  const [customBackgroundLayers, setCustomBackgroundLayers] = useState<{
    layer1Url: string | null;
    layer2Url: string | null;
    layer3Url: string | null;
  }>({ layer1Url: null, layer2Url: null, layer3Url: null });
  const [isGeneratingBackground, setIsGeneratingBackground] = useState(false);

  // Archive
  const [archive, setArchive] = useState<SpriteArchiveEntry[]>(() => {
    if (typeof window !== "undefined") {
      // Clear old localStorage data that may be filling up storage
      localStorage.removeItem("sprite-archive");
    }
    return [];
  });

  // Error handling
  const [error, setError] = useState<string | null>(null);

  // Initialize walk divider positions when grid changes
  useEffect(() => {
    if (walkSpriteSheetDimensions.width > 0) {
      const vPositions: number[] = [];
      for (let i = 1; i < walkGridCols; i++) {
        vPositions.push((i / walkGridCols) * 100);
      }
      setWalkVerticalDividers(vPositions);

      const hPositions: number[] = [];
      for (let i = 1; i < walkGridRows; i++) {
        hPositions.push((i / walkGridRows) * 100);
      }
      setWalkHorizontalDividers(hPositions);
    }
  }, [walkGridCols, walkGridRows, walkSpriteSheetDimensions.width]);

  // Initialize jump divider positions when grid changes
  useEffect(() => {
    if (dodgeSpriteSheetDimensions.width > 0) {
      const vPositions: number[] = [];
      for (let i = 1; i < dodgeGridCols; i++) {
        vPositions.push((i / dodgeGridCols) * 100);
      }
      setDodgeVerticalDividers(vPositions);

      const hPositions: number[] = [];
      for (let i = 1; i < dodgeGridRows; i++) {
        hPositions.push((i / dodgeGridRows) * 100);
      }
      setDodgeHorizontalDividers(hPositions);
    }
  }, [dodgeGridCols, dodgeGridRows, dodgeSpriteSheetDimensions.width]);

  // Initialize attack divider positions when grid changes
  useEffect(() => {
    if (attackSpriteSheetDimensions.width > 0) {
      const vPositions: number[] = [];
      for (let i = 1; i < attackGridCols; i++) {
        vPositions.push((i / attackGridCols) * 100);
      }
      setAttackVerticalDividers(vPositions);

      const hPositions: number[] = [];
      for (let i = 1; i < attackGridRows; i++) {
        hPositions.push((i / attackGridRows) * 100);
      }
      setAttackHorizontalDividers(hPositions);
    }
  }, [attackGridCols, attackGridRows, attackSpriteSheetDimensions.width]);

  // Initialize idle divider positions when grid changes
  useEffect(() => {
    if (idleSpriteSheetDimensions.width > 0) {
      const vPositions: number[] = [];
      for (let i = 1; i < idleGridCols; i++) {
        vPositions.push((i / idleGridCols) * 100);
      }
      setIdleVerticalDividers(vPositions);

      const hPositions: number[] = [];
      for (let i = 1; i < idleGridRows; i++) {
        hPositions.push((i / idleGridRows) * 100);
      }
      setIdleHorizontalDividers(hPositions);
    }
  }, [idleGridCols, idleGridRows, idleSpriteSheetDimensions.width]);

  // Initialize ko divider positions when grid changes
  useEffect(() => {
    if (koSpriteSheetDimensions.width > 0) {
      const vPositions: number[] = [];
      for (let i = 1; i < koGridCols; i++) vPositions.push((i / koGridCols) * 100);
      setKoVerticalDividers(vPositions);
      const hPositions: number[] = [];
      for (let i = 1; i < koGridRows; i++) hPositions.push((i / koGridRows) * 100);
      setKoHorizontalDividers(hPositions);
    }
  }, [koGridCols, koGridRows, koSpriteSheetDimensions.width]);

  // Initialize damage divider positions when grid changes
  useEffect(() => {
    if (damageSpriteSheetDimensions.width > 0) {
      const vPositions: number[] = [];
      for (let i = 1; i < damageGridCols; i++) vPositions.push((i / damageGridCols) * 100);
      setDamageVerticalDividers(vPositions);
      const hPositions: number[] = [];
      for (let i = 1; i < damageGridRows; i++) hPositions.push((i / damageGridRows) * 100);
      setDamageHorizontalDividers(hPositions);
    }
  }, [damageGridCols, damageGridRows, damageSpriteSheetDimensions.width]);

  // Initialize victory divider positions when grid changes
  useEffect(() => {
    if (victorySpriteSheetDimensions.width > 0) {
      const vPositions: number[] = [];
      for (let i = 1; i < victoryGridCols; i++) vPositions.push((i / victoryGridCols) * 100);
      setVictoryVerticalDividers(vPositions);
      const hPositions: number[] = [];
      for (let i = 1; i < victoryGridRows; i++) hPositions.push((i / victoryGridRows) * 100);
      setVictoryHorizontalDividers(hPositions);
    }
  }, [victoryGridCols, victoryGridRows, victorySpriteSheetDimensions.width]);

  // Extract walk frames when divider positions change
  useEffect(() => {
    if (walkBgRemovedUrl && walkSpriteSheetDimensions.width > 0) {
      extractWalkFrames();
    }
  }, [walkBgRemovedUrl, walkVerticalDividers, walkHorizontalDividers, walkSpriteSheetDimensions]);

  // Extract jump frames when divider positions change
  useEffect(() => {
    if (dodgeBgRemovedUrl && dodgeSpriteSheetDimensions.width > 0) {
      extractDodgeFrames();
    }
  }, [dodgeBgRemovedUrl, dodgeVerticalDividers, dodgeHorizontalDividers, dodgeSpriteSheetDimensions]);

  // Extract attack frames when divider positions change
  useEffect(() => {
    if (attackBgRemovedUrl && attackSpriteSheetDimensions.width > 0) {
      extractAttackFrames();
    }
  }, [attackBgRemovedUrl, attackVerticalDividers, attackHorizontalDividers, attackSpriteSheetDimensions]);

  // Extract idle frames when divider positions change
  useEffect(() => {
    if (idleBgRemovedUrl && idleSpriteSheetDimensions.width > 0) {
      extractIdleFrames();
    }
  }, [idleBgRemovedUrl, idleVerticalDividers, idleHorizontalDividers, idleSpriteSheetDimensions]);

  // Extract ko frames when divider positions change
  useEffect(() => {
    if (koBgRemovedUrl && koSpriteSheetDimensions.width > 0) extractKoFrames();
  }, [koBgRemovedUrl, koVerticalDividers, koHorizontalDividers, koSpriteSheetDimensions]);

  // Extract damage frames when divider positions change
  useEffect(() => {
    if (damageBgRemovedUrl && damageSpriteSheetDimensions.width > 0) extractDamageFrames();
  }, [damageBgRemovedUrl, damageVerticalDividers, damageHorizontalDividers, damageSpriteSheetDimensions]);

  // Extract victory frames when divider positions change
  useEffect(() => {
    if (victoryBgRemovedUrl && victorySpriteSheetDimensions.width > 0) extractVictoryFrames();
  }, [victoryBgRemovedUrl, victoryVerticalDividers, victoryHorizontalDividers, victorySpriteSheetDimensions]);

  // Animation loop (uses walk frames for preview)
  useEffect(() => {
    if (!isPlaying || walkExtractedFrames.length === 0) return;

    const interval = setInterval(() => {
      setCurrentFrameIndex((prev) => (prev + 1) % walkExtractedFrames.length);
    }, 1000 / fps);

    return () => clearInterval(interval);
  }, [isPlaying, fps, walkExtractedFrames.length]);

  // Draw current frame on canvas (uses walk frames for preview)
  useEffect(() => {
    if (walkExtractedFrames.length === 0 || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const frame = walkExtractedFrames[currentFrameIndex];
    if (!frame) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (direction === "left") {
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(img, -canvas.width, 0);
        ctx.restore();
      } else {
        ctx.drawImage(img, 0, 0);
      }
    };
    img.src = frame.dataUrl;
  }, [currentFrameIndex, walkExtractedFrames, direction]);

  // Keyboard controls for Step 5
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (currentStep !== 5) return;

      if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") {
        setDirection("right");
        if (!isPlaying) setIsPlaying(true);
      } else if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") {
        setDirection("left");
        if (!isPlaying) setIsPlaying(true);
      } else if (e.key === " ") {
        e.preventDefault();
        setIsPlaying(false);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (currentStep !== 5) return;

      if (
        e.key === "d" ||
        e.key === "D" ||
        e.key === "ArrowRight" ||
        e.key === "a" ||
        e.key === "A" ||
        e.key === "ArrowLeft"
      ) {
        setIsPlaying(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [currentStep, isPlaying]);

  // Sandbox keyboard controls and game loop are now handled inside PixiSandbox component

  // API calls
  const generateCharacter = async () => {
    // Validate based on input mode
    if (characterInputMode === "text" && !characterPrompt.trim()) {
      setError("Please enter a prompt");
      return;
    }
    if (characterInputMode === "image" && !inputImageUrl.trim()) {
      setError("Please enter an image URL");
      return;
    }

    setError(null);
    setIsGeneratingCharacter(true);

    try {
      const requestBody = characterInputMode === "image"
        ? { imageUrl: inputImageUrl, prompt: characterPrompt || undefined }
        : { prompt: characterPrompt };

      const response = await fetch("/api/generate-character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate character");
      }

      setCharacterImageUrl(data.imageUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate character");
    } finally {
      setIsGeneratingCharacter(false);
    }
  };

  const generateSpriteSheet = async () => {
    if (!characterImageUrl) return;

    setError(null);
    setIsGeneratingSpriteSheet(true);

    try {
      const types = ["walk", "dodge", "attack", "idle", "ko", "damage", "victory"] as const;
      const responses = await Promise.all(
        types.map((type) =>
          fetch("/api/generate-sprite-sheet", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ characterImageUrl, type, customPrompt: customPrompts[type] || undefined }),
          })
        )
      );
      const dataArr = await Promise.all(responses.map((r) => r.json()));
      for (let i = 0; i < responses.length; i++) {
        if (!responses[i].ok) throw new Error(dataArr[i].error || `Failed to generate ${types[i]} sprite sheet`);
      }
      const setters: Record<string, (url: string) => void> = {
        walk: setWalkSpriteSheetUrl, dodge: setDodgeSpriteSheetUrl, attack: setAttackSpriteSheetUrl,
        idle: setIdleSpriteSheetUrl, ko: setKoSpriteSheetUrl, damage: setDamageSpriteSheetUrl, victory: setVictorySpriteSheetUrl,
      };
      types.forEach((type, i) => setters[type](dataArr[i].imageUrl));
      setCompletedSteps((prev) => new Set([...prev, 1]));
      setCurrentStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate sprite sheets");
    } finally {
      setIsGeneratingSpriteSheet(false);
    }
  };

  type AnimationType = "walk" | "dodge" | "attack" | "idle" | "ko" | "damage" | "victory";
  const [regeneratingSpriteSheet, setRegeneratingSpriteSheet] = useState<AnimationType | null>(null);
  const [customPrompts, setCustomPrompts] = useState<Record<AnimationType, string>>({
    walk: "", dodge: "", attack: "", idle: "", ko: "", damage: "", victory: "",
  });
  const updateCustomPrompt = (type: AnimationType, value: string) => {
    setCustomPrompts((prev) => ({ ...prev, [type]: value }));
  };

  const regenerateSpriteSheet = async (type: AnimationType) => {
    if (!characterImageUrl) return;

    setError(null);
    setRegeneratingSpriteSheet(type);

    try {
      const response = await fetch("/api/generate-sprite-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterImageUrl, type, customPrompt: customPrompts[type] || undefined }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to generate ${type} sprite sheet`);
      }

      const setters: Record<string, (url: string) => void> = {
        walk: setWalkSpriteSheetUrl, dodge: setDodgeSpriteSheetUrl, attack: setAttackSpriteSheetUrl,
        idle: setIdleSpriteSheetUrl, ko: setKoSpriteSheetUrl, damage: setDamageSpriteSheetUrl, victory: setVictorySpriteSheetUrl,
      };
      setters[type]?.(data.imageUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to regenerate ${type} sprite sheet`);
    } finally {
      setRegeneratingSpriteSheet(null);
    }
  };

  const removeBackground = async () => {
    const sheets = [
      { type: "walk", url: walkSpriteSheetUrl },
      { type: "dodge", url: dodgeSpriteSheetUrl },
      { type: "attack", url: attackSpriteSheetUrl },
      { type: "idle", url: idleSpriteSheetUrl },
      { type: "ko", url: koSpriteSheetUrl },
      { type: "damage", url: damageSpriteSheetUrl },
      { type: "victory", url: victorySpriteSheetUrl },
    ];
    if (sheets.some((s) => !s.url)) return;

    setError(null);
    setIsRemovingBg(true);

    const bgSetters: Record<string, (url: string) => void> = {
      walk: setWalkBgRemovedUrl, dodge: setDodgeBgRemovedUrl, attack: setAttackBgRemovedUrl,
      idle: setIdleBgRemovedUrl, ko: setKoBgRemovedUrl, damage: setDamageBgRemovedUrl, victory: setVictoryBgRemovedUrl,
    };
    const dimSetters: Record<string, (d: { width: number; height: number }) => void> = {
      walk: setWalkSpriteSheetDimensions, dodge: setDodgeSpriteSheetDimensions, attack: setAttackSpriteSheetDimensions,
      idle: setIdleSpriteSheetDimensions, ko: setKoSpriteSheetDimensions, damage: setDamageSpriteSheetDimensions, victory: setVictorySpriteSheetDimensions,
    };

    try {
      // Process sequentially to avoid rate limiting
      for (const sheet of sheets) {
        const response = await fetch("/api/remove-background", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: sheet.url }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `Failed to remove ${sheet.type} background`);
        bgSetters[sheet.type](data.imageUrl);
        dimSetters[sheet.type]({ width: data.width, height: data.height });
      }
      setCompletedSteps((prev) => new Set([...prev, 2]));
      setCurrentStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove background");
    } finally {
      setIsRemovingBg(false);
    }
  };

  const generateBackground = async () => {
    if (!characterImageUrl) return;

    setError(null);
    setIsGeneratingBackground(true);

    try {
      const response = await fetch("/api/generate-background", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterImageUrl,
          characterPrompt: characterPrompt || "pixel art game character",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate background");
      }

      setCustomBackgroundLayers({
        layer1Url: data.layer1Url,
        layer2Url: data.layer2Url,
        layer3Url: data.layer3Url,
      });
      setBackgroundMode("custom");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate background");
    } finally {
      setIsGeneratingBackground(false);
    }
  };

  const [regeneratingLayer, setRegeneratingLayer] = useState<number | null>(null);

  const regenerateBackgroundLayer = async (layerNumber: 1 | 2 | 3) => {
    if (!characterImageUrl || !characterPrompt || !customBackgroundLayers.layer1Url) return;

    setError(null);
    setRegeneratingLayer(layerNumber);

    try {
      const response = await fetch("/api/generate-background", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterImageUrl,
          characterPrompt,
          regenerateLayer: layerNumber,
          existingLayers: customBackgroundLayers,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to regenerate layer");
      }

      setCustomBackgroundLayers({
        layer1Url: data.layer1Url,
        layer2Url: data.layer2Url,
        layer3Url: data.layer3Url,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to regenerate layer");
    } finally {
      setRegeneratingLayer(null);
    }
  };

  const extractWalkFrames = useCallback(async () => {
    if (!walkBgRemovedUrl) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      const frames: Frame[] = [];
      const colPositions = [0, ...walkVerticalDividers, 100];
      const rowPositions = [0, ...walkHorizontalDividers, 100];

      for (let row = 0; row < rowPositions.length - 1; row++) {
        const startY = Math.round((rowPositions[row] / 100) * img.height);
        const endY = Math.round((rowPositions[row + 1] / 100) * img.height);
        const frameHeight = endY - startY;

        for (let col = 0; col < colPositions.length - 1; col++) {
          const startX = Math.round((colPositions[col] / 100) * img.width);
          const endX = Math.round((colPositions[col + 1] / 100) * img.width);
          const frameWidth = endX - startX;

          const canvas = document.createElement("canvas");
          canvas.width = frameWidth;
          canvas.height = frameHeight;
          const ctx = canvas.getContext("2d");

          if (ctx) {
            ctx.drawImage(img, startX, startY, frameWidth, frameHeight, 0, 0, frameWidth, frameHeight);
            const contentBounds = getContentBounds(ctx, frameWidth, frameHeight);
            frames.push({
              dataUrl: canvas.toDataURL("image/png"),
              x: startX,
              y: startY,
              width: frameWidth,
              height: frameHeight,
              contentBounds,
            });
          }
        }
      }

      setWalkExtractedFrames(frames);
    };

    img.src = walkBgRemovedUrl;
  }, [walkBgRemovedUrl, walkVerticalDividers, walkHorizontalDividers]);

  const extractDodgeFrames = useCallback(async () => {
    if (!dodgeBgRemovedUrl) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      const frames: Frame[] = [];
      const colPositions = [0, ...dodgeVerticalDividers, 100];
      const rowPositions = [0, ...dodgeHorizontalDividers, 100];

      for (let row = 0; row < rowPositions.length - 1; row++) {
        const startY = Math.round((rowPositions[row] / 100) * img.height);
        const endY = Math.round((rowPositions[row + 1] / 100) * img.height);
        const frameHeight = endY - startY;

        for (let col = 0; col < colPositions.length - 1; col++) {
          const startX = Math.round((colPositions[col] / 100) * img.width);
          const endX = Math.round((colPositions[col + 1] / 100) * img.width);
          const frameWidth = endX - startX;

          const canvas = document.createElement("canvas");
          canvas.width = frameWidth;
          canvas.height = frameHeight;
          const ctx = canvas.getContext("2d");

          if (ctx) {
            ctx.drawImage(img, startX, startY, frameWidth, frameHeight, 0, 0, frameWidth, frameHeight);
            const contentBounds = getContentBounds(ctx, frameWidth, frameHeight);
            frames.push({
              dataUrl: canvas.toDataURL("image/png"),
              x: startX,
              y: startY,
              width: frameWidth,
              height: frameHeight,
              contentBounds,
            });
          }
        }
      }

      setDodgeExtractedFrames(frames);
    };

    img.src = dodgeBgRemovedUrl;
  }, [dodgeBgRemovedUrl, dodgeVerticalDividers, dodgeHorizontalDividers]);

  const extractAttackFrames = useCallback(async () => {
    if (!attackBgRemovedUrl) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      const frames: Frame[] = [];
      const colPositions = [0, ...attackVerticalDividers, 100];
      const rowPositions = [0, ...attackHorizontalDividers, 100];

      for (let row = 0; row < rowPositions.length - 1; row++) {
        const startY = Math.round((rowPositions[row] / 100) * img.height);
        const endY = Math.round((rowPositions[row + 1] / 100) * img.height);
        const frameHeight = endY - startY;

        for (let col = 0; col < colPositions.length - 1; col++) {
          const startX = Math.round((colPositions[col] / 100) * img.width);
          const endX = Math.round((colPositions[col + 1] / 100) * img.width);
          const frameWidth = endX - startX;

          const canvas = document.createElement("canvas");
          canvas.width = frameWidth;
          canvas.height = frameHeight;
          const ctx = canvas.getContext("2d");

          if (ctx) {
            ctx.drawImage(img, startX, startY, frameWidth, frameHeight, 0, 0, frameWidth, frameHeight);
            const contentBounds = getContentBounds(ctx, frameWidth, frameHeight);
            frames.push({
              dataUrl: canvas.toDataURL("image/png"),
              x: startX,
              y: startY,
              width: frameWidth,
              height: frameHeight,
              contentBounds,
            });
          }
        }
      }

      setAttackExtractedFrames(frames);
    };

    img.src = attackBgRemovedUrl;
  }, [attackBgRemovedUrl, attackVerticalDividers, attackHorizontalDividers]);

  const extractIdleFrames = useCallback(async () => {
    if (!idleBgRemovedUrl) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      const frames: Frame[] = [];
      const colPositions = [0, ...idleVerticalDividers, 100];
      const rowPositions = [0, ...idleHorizontalDividers, 100];

      for (let row = 0; row < rowPositions.length - 1; row++) {
        const startY = Math.round((rowPositions[row] / 100) * img.height);
        const endY = Math.round((rowPositions[row + 1] / 100) * img.height);
        const frameHeight = endY - startY;

        for (let col = 0; col < colPositions.length - 1; col++) {
          const startX = Math.round((colPositions[col] / 100) * img.width);
          const endX = Math.round((colPositions[col + 1] / 100) * img.width);
          const frameWidth = endX - startX;

          const canvas = document.createElement("canvas");
          canvas.width = frameWidth;
          canvas.height = frameHeight;
          const ctx = canvas.getContext("2d");

          if (ctx) {
            ctx.drawImage(img, startX, startY, frameWidth, frameHeight, 0, 0, frameWidth, frameHeight);
            const contentBounds = getContentBounds(ctx, frameWidth, frameHeight);
            frames.push({
              dataUrl: canvas.toDataURL("image/png"),
              x: startX,
              y: startY,
              width: frameWidth,
              height: frameHeight,
              contentBounds,
            });
          }
        }
      }

      setIdleExtractedFrames(frames);
    };

    img.src = idleBgRemovedUrl;
  }, [idleBgRemovedUrl, idleVerticalDividers, idleHorizontalDividers]);

  // Walk vertical divider drag handling
  const handleWalkVerticalDividerDrag = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    const imgRect = walkSpriteSheetRef.current?.getBoundingClientRect();
    if (!imgRect) return;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const relativeX = moveEvent.clientX - imgRect.left;
      const percentage = Math.max(0, Math.min(100, (relativeX / imgRect.width) * 100));

      const newPositions = [...walkVerticalDividers];
      const minPos = index > 0 ? newPositions[index - 1] + 2 : 2;
      const maxPos = index < newPositions.length - 1 ? newPositions[index + 1] - 2 : 98;
      newPositions[index] = Math.max(minPos, Math.min(maxPos, percentage));
      setWalkVerticalDividers(newPositions);
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Walk horizontal divider drag handling
  const handleWalkHorizontalDividerDrag = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    const imgRect = walkSpriteSheetRef.current?.getBoundingClientRect();
    if (!imgRect) return;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const relativeY = moveEvent.clientY - imgRect.top;
      const percentage = Math.max(0, Math.min(100, (relativeY / imgRect.height) * 100));

      const newPositions = [...walkHorizontalDividers];
      const minPos = index > 0 ? newPositions[index - 1] + 2 : 2;
      const maxPos = index < newPositions.length - 1 ? newPositions[index + 1] - 2 : 98;
      newPositions[index] = Math.max(minPos, Math.min(maxPos, percentage));
      setWalkHorizontalDividers(newPositions);
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Jump vertical divider drag handling
  const handleDodgeVerticalDividerDrag = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    const imgRect = dodgeSpriteSheetRef.current?.getBoundingClientRect();
    if (!imgRect) return;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const relativeX = moveEvent.clientX - imgRect.left;
      const percentage = Math.max(0, Math.min(100, (relativeX / imgRect.width) * 100));

      const newPositions = [...dodgeVerticalDividers];
      const minPos = index > 0 ? newPositions[index - 1] + 2 : 2;
      const maxPos = index < newPositions.length - 1 ? newPositions[index + 1] - 2 : 98;
      newPositions[index] = Math.max(minPos, Math.min(maxPos, percentage));
      setDodgeVerticalDividers(newPositions);
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Jump horizontal divider drag handling
  const handleDodgeHorizontalDividerDrag = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    const imgRect = dodgeSpriteSheetRef.current?.getBoundingClientRect();
    if (!imgRect) return;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const relativeY = moveEvent.clientY - imgRect.top;
      const percentage = Math.max(0, Math.min(100, (relativeY / imgRect.height) * 100));

      const newPositions = [...dodgeHorizontalDividers];
      const minPos = index > 0 ? newPositions[index - 1] + 2 : 2;
      const maxPos = index < newPositions.length - 1 ? newPositions[index + 1] - 2 : 98;
      newPositions[index] = Math.max(minPos, Math.min(maxPos, percentage));
      setDodgeHorizontalDividers(newPositions);
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Attack vertical divider drag handling
  const handleAttackVerticalDividerDrag = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    const imgRect = attackSpriteSheetRef.current?.getBoundingClientRect();
    if (!imgRect) return;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const relativeX = moveEvent.clientX - imgRect.left;
      const percentage = Math.max(0, Math.min(100, (relativeX / imgRect.width) * 100));

      const newPositions = [...attackVerticalDividers];
      const minPos = index > 0 ? newPositions[index - 1] + 2 : 2;
      const maxPos = index < newPositions.length - 1 ? newPositions[index + 1] - 2 : 98;
      newPositions[index] = Math.max(minPos, Math.min(maxPos, percentage));
      setAttackVerticalDividers(newPositions);
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Attack horizontal divider drag handling
  const handleAttackHorizontalDividerDrag = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    const imgRect = attackSpriteSheetRef.current?.getBoundingClientRect();
    if (!imgRect) return;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const relativeY = moveEvent.clientY - imgRect.top;
      const percentage = Math.max(0, Math.min(100, (relativeY / imgRect.height) * 100));

      const newPositions = [...attackHorizontalDividers];
      const minPos = index > 0 ? newPositions[index - 1] + 2 : 2;
      const maxPos = index < newPositions.length - 1 ? newPositions[index + 1] - 2 : 98;
      newPositions[index] = Math.max(minPos, Math.min(maxPos, percentage));
      setAttackHorizontalDividers(newPositions);
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Idle vertical divider drag handling
  const handleIdleVerticalDividerDrag = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    const imgRect = idleSpriteSheetRef.current?.getBoundingClientRect();
    if (!imgRect) return;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const relativeX = moveEvent.clientX - imgRect.left;
      const percentage = Math.max(0, Math.min(100, (relativeX / imgRect.width) * 100));

      const newPositions = [...idleVerticalDividers];
      const minPos = index > 0 ? newPositions[index - 1] + 2 : 2;
      const maxPos = index < newPositions.length - 1 ? newPositions[index + 1] - 2 : 98;
      newPositions[index] = Math.max(minPos, Math.min(maxPos, percentage));
      setIdleVerticalDividers(newPositions);
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Idle horizontal divider drag handling
  const handleIdleHorizontalDividerDrag = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    const imgRect = idleSpriteSheetRef.current?.getBoundingClientRect();
    if (!imgRect) return;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const relativeY = moveEvent.clientY - imgRect.top;
      const percentage = Math.max(0, Math.min(100, (relativeY / imgRect.height) * 100));

      const newPositions = [...idleHorizontalDividers];
      const minPos = index > 0 ? newPositions[index - 1] + 2 : 2;
      const maxPos = index < newPositions.length - 1 ? newPositions[index + 1] - 2 : 98;
      newPositions[index] = Math.max(minPos, Math.min(maxPos, percentage));
      setIdleHorizontalDividers(newPositions);
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Export functions
  const exportWalkSpriteSheet = () => {
    if (!walkBgRemovedUrl) return;
    const link = document.createElement("a");
    link.href = walkBgRemovedUrl;
    link.download = "walk-sprite-sheet.png";
    link.click();
  };

  const exportDodgeSpriteSheet = () => {
    if (!dodgeBgRemovedUrl) return;
    const link = document.createElement("a");
    link.href = dodgeBgRemovedUrl;
    link.download = "dodge-sprite-sheet.png";
    link.click();
  };

  const exportAttackSpriteSheet = () => {
    if (!attackBgRemovedUrl) return;
    const link = document.createElement("a");
    link.href = attackBgRemovedUrl;
    link.download = "attack-sprite-sheet.png";
    link.click();
  };

  const exportIdleSpriteSheet = () => {
    if (!idleBgRemovedUrl) return;
    const link = document.createElement("a");
    link.href = idleBgRemovedUrl;
    link.download = "idle-sprite-sheet.png";
    link.click();
  };

  // --- KO extract, dividers, export ---
  const extractKoFrames = useCallback(async () => {
    if (!koBgRemovedUrl) return;
    const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = () => {
      const frames: Frame[] = [];
      const colPositions = [0, ...koVerticalDividers, 100];
      const rowPositions = [0, ...koHorizontalDividers, 100];
      for (let row = 0; row < rowPositions.length - 1; row++) {
        const startY = Math.round((rowPositions[row] / 100) * img.height);
        const endY = Math.round((rowPositions[row + 1] / 100) * img.height);
        for (let col = 0; col < colPositions.length - 1; col++) {
          const startX = Math.round((colPositions[col] / 100) * img.width);
          const endX = Math.round((colPositions[col + 1] / 100) * img.width);
          const fw = endX - startX, fh = endY - startY;
          const canvas = document.createElement("canvas"); canvas.width = fw; canvas.height = fh;
          const ctx = canvas.getContext("2d");
          if (ctx) { ctx.drawImage(img, startX, startY, fw, fh, 0, 0, fw, fh);
            frames.push({ dataUrl: canvas.toDataURL("image/png"), x: startX, y: startY, width: fw, height: fh, contentBounds: getContentBounds(ctx, fw, fh) }); }
        }
      }
      setKoExtractedFrames(frames);
    };
    img.src = koBgRemovedUrl;
  }, [koBgRemovedUrl, koVerticalDividers, koHorizontalDividers]);

  const handleKoVerticalDividerDrag = (index: number, e: React.MouseEvent) => {
    e.preventDefault(); const imgRect = koSpriteSheetRef.current?.getBoundingClientRect(); if (!imgRect) return;
    const handleMouseMove = (ev: MouseEvent) => { const p = Math.max(0, Math.min(100, ((ev.clientX - imgRect.left) / imgRect.width) * 100)); const np = [...koVerticalDividers]; const min = index > 0 ? np[index-1]+2 : 2; const max = index < np.length-1 ? np[index+1]-2 : 98; np[index] = Math.max(min, Math.min(max, p)); setKoVerticalDividers(np); };
    const handleMouseUp = () => { window.removeEventListener("mousemove", handleMouseMove); window.removeEventListener("mouseup", handleMouseUp); };
    window.addEventListener("mousemove", handleMouseMove); window.addEventListener("mouseup", handleMouseUp);
  };
  const handleKoHorizontalDividerDrag = (index: number, e: React.MouseEvent) => {
    e.preventDefault(); const imgRect = koSpriteSheetRef.current?.getBoundingClientRect(); if (!imgRect) return;
    const handleMouseMove = (ev: MouseEvent) => { const p = Math.max(0, Math.min(100, ((ev.clientY - imgRect.top) / imgRect.height) * 100)); const np = [...koHorizontalDividers]; const min = index > 0 ? np[index-1]+2 : 2; const max = index < np.length-1 ? np[index+1]-2 : 98; np[index] = Math.max(min, Math.min(max, p)); setKoHorizontalDividers(np); };
    const handleMouseUp = () => { window.removeEventListener("mousemove", handleMouseMove); window.removeEventListener("mouseup", handleMouseUp); };
    window.addEventListener("mousemove", handleMouseMove); window.addEventListener("mouseup", handleMouseUp);
  };
  const exportKoSpriteSheet = () => { if (!koBgRemovedUrl) return; const l = document.createElement("a"); l.href = koBgRemovedUrl; l.download = "ko-sprite-sheet.png"; l.click(); };

  // --- Damage extract, dividers, export ---
  const extractDamageFrames = useCallback(async () => {
    if (!damageBgRemovedUrl) return;
    const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = () => {
      const frames: Frame[] = [];
      const colPositions = [0, ...damageVerticalDividers, 100];
      const rowPositions = [0, ...damageHorizontalDividers, 100];
      for (let row = 0; row < rowPositions.length - 1; row++) {
        const startY = Math.round((rowPositions[row] / 100) * img.height);
        const endY = Math.round((rowPositions[row + 1] / 100) * img.height);
        for (let col = 0; col < colPositions.length - 1; col++) {
          const startX = Math.round((colPositions[col] / 100) * img.width);
          const endX = Math.round((colPositions[col + 1] / 100) * img.width);
          const fw = endX - startX, fh = endY - startY;
          const canvas = document.createElement("canvas"); canvas.width = fw; canvas.height = fh;
          const ctx = canvas.getContext("2d");
          if (ctx) { ctx.drawImage(img, startX, startY, fw, fh, 0, 0, fw, fh);
            frames.push({ dataUrl: canvas.toDataURL("image/png"), x: startX, y: startY, width: fw, height: fh, contentBounds: getContentBounds(ctx, fw, fh) }); }
        }
      }
      setDamageExtractedFrames(frames);
    };
    img.src = damageBgRemovedUrl;
  }, [damageBgRemovedUrl, damageVerticalDividers, damageHorizontalDividers]);

  const handleDamageVerticalDividerDrag = (index: number, e: React.MouseEvent) => {
    e.preventDefault(); const imgRect = damageSpriteSheetRef.current?.getBoundingClientRect(); if (!imgRect) return;
    const handleMouseMove = (ev: MouseEvent) => { const p = Math.max(0, Math.min(100, ((ev.clientX - imgRect.left) / imgRect.width) * 100)); const np = [...damageVerticalDividers]; const min = index > 0 ? np[index-1]+2 : 2; const max = index < np.length-1 ? np[index+1]-2 : 98; np[index] = Math.max(min, Math.min(max, p)); setDamageVerticalDividers(np); };
    const handleMouseUp = () => { window.removeEventListener("mousemove", handleMouseMove); window.removeEventListener("mouseup", handleMouseUp); };
    window.addEventListener("mousemove", handleMouseMove); window.addEventListener("mouseup", handleMouseUp);
  };
  const handleDamageHorizontalDividerDrag = (index: number, e: React.MouseEvent) => {
    e.preventDefault(); const imgRect = damageSpriteSheetRef.current?.getBoundingClientRect(); if (!imgRect) return;
    const handleMouseMove = (ev: MouseEvent) => { const p = Math.max(0, Math.min(100, ((ev.clientY - imgRect.top) / imgRect.height) * 100)); const np = [...damageHorizontalDividers]; const min = index > 0 ? np[index-1]+2 : 2; const max = index < np.length-1 ? np[index+1]-2 : 98; np[index] = Math.max(min, Math.min(max, p)); setDamageHorizontalDividers(np); };
    const handleMouseUp = () => { window.removeEventListener("mousemove", handleMouseMove); window.removeEventListener("mouseup", handleMouseUp); };
    window.addEventListener("mousemove", handleMouseMove); window.addEventListener("mouseup", handleMouseUp);
  };
  const exportDamageSpriteSheet = () => { if (!damageBgRemovedUrl) return; const l = document.createElement("a"); l.href = damageBgRemovedUrl; l.download = "damage-sprite-sheet.png"; l.click(); };

  // --- Victory extract, dividers, export ---
  const extractVictoryFrames = useCallback(async () => {
    if (!victoryBgRemovedUrl) return;
    const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = () => {
      const frames: Frame[] = [];
      const colPositions = [0, ...victoryVerticalDividers, 100];
      const rowPositions = [0, ...victoryHorizontalDividers, 100];
      for (let row = 0; row < rowPositions.length - 1; row++) {
        const startY = Math.round((rowPositions[row] / 100) * img.height);
        const endY = Math.round((rowPositions[row + 1] / 100) * img.height);
        for (let col = 0; col < colPositions.length - 1; col++) {
          const startX = Math.round((colPositions[col] / 100) * img.width);
          const endX = Math.round((colPositions[col + 1] / 100) * img.width);
          const fw = endX - startX, fh = endY - startY;
          const canvas = document.createElement("canvas"); canvas.width = fw; canvas.height = fh;
          const ctx = canvas.getContext("2d");
          if (ctx) { ctx.drawImage(img, startX, startY, fw, fh, 0, 0, fw, fh);
            frames.push({ dataUrl: canvas.toDataURL("image/png"), x: startX, y: startY, width: fw, height: fh, contentBounds: getContentBounds(ctx, fw, fh) }); }
        }
      }
      setVictoryExtractedFrames(frames);
    };
    img.src = victoryBgRemovedUrl;
  }, [victoryBgRemovedUrl, victoryVerticalDividers, victoryHorizontalDividers]);

  const handleVictoryVerticalDividerDrag = (index: number, e: React.MouseEvent) => {
    e.preventDefault(); const imgRect = victorySpriteSheetRef.current?.getBoundingClientRect(); if (!imgRect) return;
    const handleMouseMove = (ev: MouseEvent) => { const p = Math.max(0, Math.min(100, ((ev.clientX - imgRect.left) / imgRect.width) * 100)); const np = [...victoryVerticalDividers]; const min = index > 0 ? np[index-1]+2 : 2; const max = index < np.length-1 ? np[index+1]-2 : 98; np[index] = Math.max(min, Math.min(max, p)); setVictoryVerticalDividers(np); };
    const handleMouseUp = () => { window.removeEventListener("mousemove", handleMouseMove); window.removeEventListener("mouseup", handleMouseUp); };
    window.addEventListener("mousemove", handleMouseMove); window.addEventListener("mouseup", handleMouseUp);
  };
  const handleVictoryHorizontalDividerDrag = (index: number, e: React.MouseEvent) => {
    e.preventDefault(); const imgRect = victorySpriteSheetRef.current?.getBoundingClientRect(); if (!imgRect) return;
    const handleMouseMove = (ev: MouseEvent) => { const p = Math.max(0, Math.min(100, ((ev.clientY - imgRect.top) / imgRect.height) * 100)); const np = [...victoryHorizontalDividers]; const min = index > 0 ? np[index-1]+2 : 2; const max = index < np.length-1 ? np[index+1]-2 : 98; np[index] = Math.max(min, Math.min(max, p)); setVictoryHorizontalDividers(np); };
    const handleMouseUp = () => { window.removeEventListener("mousemove", handleMouseMove); window.removeEventListener("mouseup", handleMouseUp); };
    window.addEventListener("mousemove", handleMouseMove); window.addEventListener("mouseup", handleMouseUp);
  };
  const exportVictorySpriteSheet = () => { if (!victoryBgRemovedUrl) return; const l = document.createElement("a"); l.href = victoryBgRemovedUrl; l.download = "victory-sprite-sheet.png"; l.click(); };

  const exportAllFrames = () => {
    const allSets = [
      { frames: walkExtractedFrames, prefix: "walk" },
      { frames: dodgeExtractedFrames, prefix: "dodge" },
      { frames: attackExtractedFrames, prefix: "attack" },
      { frames: idleExtractedFrames, prefix: "idle" },
      { frames: koExtractedFrames, prefix: "ko" },
      { frames: damageExtractedFrames, prefix: "damage" },
      { frames: victoryExtractedFrames, prefix: "victory" },
    ];
    allSets.forEach(({ frames, prefix }) => {
      frames.forEach((frame, index) => {
        const link = document.createElement("a");
        link.href = frame.dataUrl;
        link.download = `${prefix}-frame-${index + 1}.png`;
        link.click();
      });
    });
  };

  const proceedToFrameExtraction = () => {
    setCompletedSteps((prev) => new Set([...prev, 3]));
    setCurrentStep(4);
  };

  const proceedToSandbox = () => {
    setCompletedSteps((prev) => new Set([...prev, 4, 5]));
    setCurrentStep(6);
  };

  const [archiveOpen, setArchiveOpen] = useState(false);

  const downloadArchiveEntry = async (entry: SpriteArchiveEntry) => {
    const stitchAndDownload = (frames: Frame[], animName: string) => {
      if (frames.length === 0) return;
      const cols = 2;
      const rows = Math.ceil(frames.length / cols);
      const frameWidth = frames[0].width;
      const frameHeight = frames[0].height;
      const canvas = document.createElement("canvas");
      canvas.width = frameWidth * cols;
      canvas.height = frameHeight * rows;
      const ctx = canvas.getContext("2d")!;
      let loaded = 0;
      frames.forEach((frame, i) => {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, (i % cols) * frameWidth, Math.floor(i / cols) * frameHeight);
          loaded++;
          if (loaded === frames.length) {
            const link = document.createElement("a");
            link.href = canvas.toDataURL("image/png");
            link.download = `${entry.name.replace(/[^a-z0-9]/gi, "_")}-${animName}.png`;
            link.click();
          }
        };
        img.src = frame.dataUrl;
      });
    };
    stitchAndDownload(entry.walkFrames, "walk");
    setTimeout(() => stitchAndDownload(entry.dodgeFrames, "dodge"), 200);
    setTimeout(() => stitchAndDownload(entry.attackFrames, "attack"), 400);
    setTimeout(() => stitchAndDownload(entry.idleFrames, "idle"), 600);
    setTimeout(() => stitchAndDownload(entry.koFrames || [], "ko"), 800);
    setTimeout(() => stitchAndDownload(entry.damageFrames || [], "damage"), 1000);
    setTimeout(() => stitchAndDownload(entry.victoryFrames || [], "victory"), 1200);
  };

  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const quickPreview = useCallback(async () => {
    if (!walkSpriteSheetUrl || !dodgeSpriteSheetUrl || !attackSpriteSheetUrl || !idleSpriteSheetUrl || !koSpriteSheetUrl || !damageSpriteSheetUrl || !victorySpriteSheetUrl) return;
    setIsLoadingPreview(true);
    setError(null);

    const sheets = [
      { name: "walk", url: walkSpriteSheetUrl, cols: 2, rows: 2 },
      { name: "dodge", url: dodgeSpriteSheetUrl, cols: 2, rows: 2 },
      { name: "attack", url: attackSpriteSheetUrl, cols: 2, rows: 2 },
      { name: "idle", url: idleSpriteSheetUrl, cols: 2, rows: 2 },
      { name: "ko", url: koSpriteSheetUrl, cols: 2, rows: 2 },
      { name: "damage", url: damageSpriteSheetUrl, cols: 2, rows: 2 },
      { name: "victory", url: victorySpriteSheetUrl, cols: 2, rows: 2 },
    ];

    try {
      const results = await Promise.all(
        sheets.map(
          (sheet) =>
            new Promise<{ name: string; frames: Frame[] }>((resolve, reject) => {
              const img = new Image();
              img.crossOrigin = "anonymous";
              img.onload = () => {
                const frames: Frame[] = [];
                const frameWidth = Math.round(img.width / sheet.cols);
                const frameHeight = Math.round(img.height / sheet.rows);
                for (let row = 0; row < sheet.rows; row++) {
                  for (let col = 0; col < sheet.cols; col++) {
                    const canvas = document.createElement("canvas");
                    canvas.width = frameWidth;
                    canvas.height = frameHeight;
                    const ctx = canvas.getContext("2d")!;
                    ctx.drawImage(img, col * frameWidth, row * frameHeight, frameWidth, frameHeight, 0, 0, frameWidth, frameHeight);
                    const contentBounds = getContentBounds(ctx, frameWidth, frameHeight);
                    frames.push({ dataUrl: canvas.toDataURL("image/png"), x: col * frameWidth, y: row * frameHeight, width: frameWidth, height: frameHeight, contentBounds });
                  }
                }
                resolve({ name: sheet.name, frames });
              };
              img.onerror = () => reject(new Error(`Failed to load ${sheet.name} sprite sheet`));
              img.src = sheet.url;
            })
        )
      );

      const frameSetters: Record<string, (f: Frame[]) => void> = {
        walk: setWalkExtractedFrames, dodge: setDodgeExtractedFrames, attack: setAttackExtractedFrames,
        idle: setIdleExtractedFrames, ko: setKoExtractedFrames, damage: setDamageExtractedFrames, victory: setVictoryExtractedFrames,
      };
      for (const { name, frames } of results) frameSetters[name]?.(frames);

      setCompletedSteps((prev) => new Set(Array.from(prev).concat([1, 2])));
      setCurrentStep(6);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load preview");
    } finally {
      setIsLoadingPreview(false);
    }
  }, [walkSpriteSheetUrl, dodgeSpriteSheetUrl, attackSpriteSheetUrl, idleSpriteSheetUrl]);

  const saveToArchive = () => {
    if (!walkExtractedFrames.length && !dodgeExtractedFrames.length) return;
    const name = characterPrompt.trim()
      ? characterPrompt.slice(0, 50)
      : new Date().toLocaleString();
    const entry: SpriteArchiveEntry = {
      id: Date.now().toString(),
      name,
      createdAt: Date.now(),
      characterImageUrl,
      walkFrames: walkExtractedFrames,
      dodgeFrames: dodgeExtractedFrames,
      attackFrames: attackExtractedFrames,
      idleFrames: idleExtractedFrames,
      koFrames: koExtractedFrames,
      damageFrames: damageExtractedFrames,
      victoryFrames: victoryExtractedFrames,
    };
    // Download as JSON file for local backup
    exportArchiveEntry(entry);
    // Keep in memory for current session
    const updated = [entry, ...archive];
    setArchive(updated);
  };

  const loadFromArchive = (entry: SpriteArchiveEntry) => {
    setWalkExtractedFrames(entry.walkFrames);
    setDodgeExtractedFrames(entry.dodgeFrames);
    setAttackExtractedFrames(entry.attackFrames);
    setIdleExtractedFrames(entry.idleFrames);
    setKoExtractedFrames(entry.koFrames || []);
    setDamageExtractedFrames(entry.damageFrames || []);
    setVictoryExtractedFrames(entry.victoryFrames || []);
    if (entry.characterImageUrl) setCharacterImageUrl(entry.characterImageUrl);
    setCompletedSteps(new Set([1, 2, 3, 4, 5, 6]));
    setCurrentStep(6);
  };

  const deleteFromArchive = (id: string) => {
    const updated = archive.filter((e) => e.id !== id);
    setArchive(updated);
  };

  // Export a single archive entry as a JSON file for local backup
  const exportArchiveEntry = (entry: SpriteArchiveEntry) => {
    const json = JSON.stringify(entry);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${entry.name.replace(/[^a-z0-9]/gi, "_")}-sprites.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Import an archive entry from a JSON file
  const importArchiveEntry = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const entry = JSON.parse(ev.target?.result as string) as SpriteArchiveEntry;
          if (!entry.id || !entry.name || !entry.walkFrames) {
            setError("Invalid sprite archive file.");
            return;
          }
          // Give it a new ID to avoid collisions
          entry.id = Date.now().toString();
          const updated = [entry, ...archive];
          setArchive(updated);
        } catch {
          setError("Failed to parse sprite archive file.");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <main className="container">
      <header className="header">
        <div className="header-logo">
          <FalLogo size={36} />
          <h1>Sprite Sheet Creator</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <p>Create pixel art sprite sheets using fal.ai</p>
          <button
            className={`btn ${archiveOpen ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setArchiveOpen((v) => !v)}
            style={{ whiteSpace: "nowrap" }}
          >
            Archive{archive.length > 0 ? ` (${archive.length})` : ""}
          </button>
        </div>
      </header>

      {/* Archive panel */}
      {archiveOpen && (
        <div className="step-container" style={{ marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h2 className="step-title" style={{ margin: 0 }}>Saved Sprite Sets</h2>
            <button className="btn btn-secondary" style={{ fontSize: "0.82rem" }} onClick={importArchiveEntry}>
              Import JSON
            </button>
          </div>
          {archive.length === 0 ? (
            <p style={{ color: "var(--text-secondary)", textAlign: "center", padding: "2rem 0" }}>
              No saved sprite sets yet. Complete the full flow and click &ldquo;Save to Archive&rdquo; in the Sandbox step.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {archive.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                    padding: "0.75rem 1rem",
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "8px",
                  }}
                >
                  {entry.characterImageUrl ? (
                    <img
                      src={entry.characterImageUrl}
                      alt="character"
                      style={{ width: 48, height: 48, objectFit: "contain", imageRendering: "pixelated", borderRadius: 4, background: "var(--bg-tertiary)", flexShrink: 0 }}
                    />
                  ) : (
                    <div style={{ width: 48, height: 48, borderRadius: 4, background: "var(--bg-tertiary)", flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.95rem", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.name}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: "0.15rem" }}>
                      {new Date(entry.createdAt).toLocaleString()} &middot; {[entry.walkFrames.length, entry.dodgeFrames.length, entry.attackFrames.length, entry.idleFrames.length, (entry.koFrames || []).length, (entry.damageFrames || []).length, (entry.victoryFrames || []).length].filter(Boolean).length} animations
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
                    <button
                      className="btn btn-success"
                      style={{ padding: "0.35rem 0.75rem", fontSize: "0.82rem" }}
                      onClick={() => { loadFromArchive(entry); setArchiveOpen(false); }}
                    >
                      Load
                    </button>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: "0.35rem 0.75rem", fontSize: "0.82rem" }}
                      onClick={() => downloadArchiveEntry(entry)}
                    >
                      PNG
                    </button>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: "0.35rem 0.75rem", fontSize: "0.82rem" }}
                      onClick={() => exportArchiveEntry(entry)}
                    >
                      JSON
                    </button>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: "0.35rem 0.5rem", fontSize: "0.82rem" }}
                      onClick={() => deleteFromArchive(entry.id)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Steps indicator */}
      <div className="steps-indicator">
        {[1, 2, 3, 4, 5].map((displayStep) => {
          // Map display step 5 to internal step 6 (sandbox)
          const internalStep = displayStep === 5 ? 6 : displayStep;
          return (
            <div
              key={displayStep}
              className={`step-dot ${currentStep === internalStep ? "active" : ""} ${
                completedSteps.has(internalStep) ? "completed" : ""
              }`}
            />
          );
        })}
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Step 1: Generate Character */}
      {currentStep === 1 && (
        <div className="step-container">
          <h2 className="step-title">
            <span className="step-number">1</span>
            Generate Character
          </h2>

          {/* Input mode tabs */}
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
            <button
              className={`btn ${characterInputMode === "text" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setCharacterInputMode("text")}
            >
              Text Prompt
            </button>
            <button
              className={`btn ${characterInputMode === "image" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setCharacterInputMode("image")}
            >
              From Image
            </button>
          </div>

          {characterInputMode === "text" ? (
            <div className="input-group">
              <label htmlFor="prompt">Character Prompt</label>
              <textarea
                id="prompt"
                className="text-input"
                rows={3}
                spellCheck={false}
                placeholder="Describe your pixel art character (e.g., 'pixel art knight with sword and shield, medieval armor, 32-bit style')"
                value={characterPrompt}
                onChange={(e) => setCharacterPrompt(e.target.value)}
              />
            </div>
          ) : (
            <>
              <div className="input-group">
                <label>Upload Image</label>
                {!inputImageUrl ? (
                  <label
                    htmlFor="imageUpload"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "2rem",
                      border: "2px dashed var(--border-color)",
                      borderRadius: "8px",
                      cursor: "pointer",
                      transition: "border-color 0.2s, background 0.2s",
                      background: "var(--bg-secondary)",
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.borderColor = "var(--accent-color)";
                      e.currentTarget.style.background = "var(--bg-tertiary)";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.borderColor = "var(--border-color)";
                      e.currentTarget.style.background = "var(--bg-secondary)";
                    }}
                  >
                    <svg
                      width="48"
                      height="48"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ color: "var(--text-tertiary)", marginBottom: "0.75rem" }}
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <span style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
                      Click to upload an image
                    </span>
                    <span style={{ color: "var(--text-tertiary)", fontSize: "0.8rem", marginTop: "0.25rem" }}>
                      PNG, JPG, WEBP supported
                    </span>
                    <input
                      id="imageUpload"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            setInputImageUrl(event.target?.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      style={{ display: "none" }}
                    />
                  </label>
                ) : (
                  <div
                    style={{
                      position: "relative",
                      display: "inline-block",
                      padding: "1rem",
                      border: "2px solid var(--border-color)",
                      borderRadius: "8px",
                      background: "var(--bg-secondary)",
                    }}
                  >
                    <img
                      src={inputImageUrl}
                      alt="Uploaded preview"
                      style={{ maxWidth: "250px", maxHeight: "250px", borderRadius: "4px", display: "block" }}
                    />
                    <button
                      onClick={() => setInputImageUrl("")}
                      style={{
                        position: "absolute",
                        top: "0.5rem",
                        right: "0.5rem",
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        border: "none",
                        background: "var(--bg-primary)",
                        color: "var(--text-secondary)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "1.2rem",
                        lineHeight: 1,
                      }}
                      title="Remove image"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
              <div className="input-group" style={{ marginTop: "1rem" }}>
                <label htmlFor="promptOptional">Additional Instructions (optional)</label>
                <textarea
                  id="promptOptional"
                  className="text-input"
                  rows={2}
                  spellCheck={false}
                  placeholder="Any additional instructions for the pixel art conversion..."
                  value={characterPrompt}
                  onChange={(e) => setCharacterPrompt(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="button-group">
            <button
              className="btn btn-primary"
              onClick={generateCharacter}
              disabled={
                isGeneratingCharacter ||
                (characterInputMode === "text" && !characterPrompt.trim()) ||
                (characterInputMode === "image" && !inputImageUrl.trim())
              }
            >
              {isGeneratingCharacter
                ? "Generating..."
                : characterInputMode === "image"
                ? "Convert to Pixel Art"
                : "Generate Character"}
            </button>
            {characterInputMode === "image" && inputImageUrl && (
              <button
                className="btn btn-secondary"
                onClick={() => setCharacterImageUrl(inputImageUrl)}
                disabled={isGeneratingCharacter}
              >
                Use Image Directly
              </button>
            )}
          </div>

          {isGeneratingCharacter && (
            <div className="loading">
              <FalSpinner />
              <span className="loading-text">
                {characterInputMode === "image"
                  ? "Converting to pixel art..."
                  : "Generating your character..."}
              </span>
            </div>
          )}

          {characterImageUrl && (
            <>
              <div className="image-preview">
                <img src={characterImageUrl} alt="Generated character" />
              </div>

              <div className="button-group">
                <button
                  className="btn btn-secondary"
                  onClick={generateCharacter}
                  disabled={isGeneratingCharacter}
                >
                  Regenerate
                </button>
                <button
                  className="btn btn-success"
                  onClick={generateSpriteSheet}
                  disabled={isGeneratingSpriteSheet}
                >
                  {isGeneratingSpriteSheet ? "Creating Sprite Sheet..." : "Use for Sprite Sheet →"}
                </button>
              </div>

              {isGeneratingSpriteSheet && (
                <div className="loading">
                  <FalSpinner />
                  <span className="loading-text">Creating sprite sheets...</span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Step 2: Sprite Sheets Generated */}
      {currentStep === 2 && (
        <div className="step-container">
          <h2 className="step-title">
            <span className="step-number">2</span>
            Sprite Sheets Generated
          </h2>

          <p className="description-text">
            Walk, dodge, and attack sprite sheets have been generated. If poses don&apos;t look right, try regenerating.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            {([
              { type: "walk" as AnimationType, label: "Walk", url: walkSpriteSheetUrl },
              { type: "dodge" as AnimationType, label: "Dodge", url: dodgeSpriteSheetUrl },
              { type: "attack" as AnimationType, label: "Attack", url: attackSpriteSheetUrl },
              { type: "idle" as AnimationType, label: "Idle", url: idleSpriteSheetUrl },
              { type: "ko" as AnimationType, label: "K.O.", url: koSpriteSheetUrl },
              { type: "damage" as AnimationType, label: "Damage", url: damageSpriteSheetUrl },
              { type: "victory" as AnimationType, label: "Victory", url: victorySpriteSheetUrl },
            ]).map(({ type, label, url }) => (
              <div key={type}>
                <h4 style={{ marginBottom: "0.5rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>{label} (4 frames)</h4>
                {url && (
                  <div className="image-preview" style={{ margin: 0, opacity: regeneratingSpriteSheet === type ? 0.5 : 1 }}>
                    <img src={url} alt={`${label} sprite sheet`} />
                  </div>
                )}
                <input
                  type="text"
                  placeholder={`Custom ${label.toLowerCase()} prompt...`}
                  value={customPrompts[type]}
                  onChange={(e) => updateCustomPrompt(type, e.target.value)}
                  spellCheck={false}
                  style={{ width: "100%", fontSize: "0.72rem", padding: "0.25rem 0.4rem", marginTop: "0.4rem", background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: "4px", color: "var(--text-primary)" }}
                />
                <button
                  className="btn btn-secondary"
                  onClick={() => regenerateSpriteSheet(type)}
                  disabled={isGeneratingSpriteSheet || regeneratingSpriteSheet !== null || isRemovingBg}
                  style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem", marginTop: "0.35rem", width: "100%" }}
                >
                  {regeneratingSpriteSheet === type ? "Regenerating..." : `Regen ${label}`}
                </button>
              </div>
            ))}
          </div>

          {(isGeneratingSpriteSheet || regeneratingSpriteSheet) && (
            <div className="loading">
              <FalSpinner />
              <span className="loading-text">
                {isGeneratingSpriteSheet ? "Regenerating all sprite sheets..." : `Regenerating ${regeneratingSpriteSheet} sprite sheet...`}
              </span>
            </div>
          )}

          <div className="button-group">
            <button className="btn btn-secondary" onClick={() => setCurrentStep(1)}>
              ← Back to Character
            </button>
            <button
              className="btn btn-secondary"
              onClick={generateSpriteSheet}
              disabled={isGeneratingSpriteSheet || isRemovingBg}
            >
              Regenerate All
            </button>
            <button
              className="btn btn-secondary"
              onClick={quickPreview}
              disabled={isLoadingPreview || isGeneratingSpriteSheet || isRemovingBg || !walkSpriteSheetUrl || !dodgeSpriteSheetUrl}
            >
              {isLoadingPreview ? "Loading..." : "Quick Preview →"}
            </button>
            <button
              className="btn btn-success"
              onClick={removeBackground}
              disabled={isRemovingBg || isGeneratingSpriteSheet || !walkSpriteSheetUrl || !dodgeSpriteSheetUrl || !attackSpriteSheetUrl}
            >
              {isRemovingBg ? "Removing Backgrounds..." : "Remove Backgrounds →"}
            </button>
          </div>

          {isRemovingBg && (
            <div className="loading">
              <FalSpinner />
              <span className="loading-text">Removing backgrounds from all sheets...</span>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Background Removed */}
      {currentStep === 3 && (
        <div className="step-container">
          <h2 className="step-title">
            <span className="step-number">3</span>
            Backgrounds Removed
          </h2>

          <p className="description-text">
            Backgrounds have been removed. Now let&apos;s extract the individual frames.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <h4 style={{ marginBottom: "0.5rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>Walk Cycle</h4>
              {walkBgRemovedUrl && (
                <div className="image-preview" style={{ margin: 0 }}>
                  <img src={walkBgRemovedUrl} alt="Walk sprite sheet with background removed" />
                </div>
              )}
            </div>
            <div>
              <h4 style={{ marginBottom: "0.5rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>Dodge</h4>
              {dodgeBgRemovedUrl && (
                <div className="image-preview" style={{ margin: 0 }}>
                  <img src={dodgeBgRemovedUrl} alt="Dodge sprite sheet with background removed" />
                </div>
              )}
            </div>
            <div>
              <h4 style={{ marginBottom: "0.5rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>Attack</h4>
              {attackBgRemovedUrl && (
                <div className="image-preview" style={{ margin: 0 }}>
                  <img src={attackBgRemovedUrl} alt="Attack sprite sheet with background removed" />
                </div>
              )}
            </div>
            <div>
              <h4 style={{ marginBottom: "0.5rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>Idle</h4>
              {idleBgRemovedUrl && (
                <div className="image-preview" style={{ margin: 0 }}>
                  <img src={idleBgRemovedUrl} alt="Idle sprite sheet with background removed" />
                </div>
              )}
            </div>
            <div>
              <h4 style={{ marginBottom: "0.5rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>K.O.</h4>
              {koBgRemovedUrl && (
                <div className="image-preview" style={{ margin: 0 }}>
                  <img src={koBgRemovedUrl} alt="KO sprite sheet with background removed" />
                </div>
              )}
            </div>
            <div>
              <h4 style={{ marginBottom: "0.5rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>Damage</h4>
              {damageBgRemovedUrl && (
                <div className="image-preview" style={{ margin: 0 }}>
                  <img src={damageBgRemovedUrl} alt="Damage sprite sheet with background removed" />
                </div>
              )}
            </div>
            <div>
              <h4 style={{ marginBottom: "0.5rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>Victory</h4>
              {victoryBgRemovedUrl && (
                <div className="image-preview" style={{ margin: 0 }}>
                  <img src={victoryBgRemovedUrl} alt="Victory sprite sheet with background removed" />
                </div>
              )}
            </div>
          </div>

          <div className="button-group">
            <button className="btn btn-secondary" onClick={() => setCurrentStep(2)}>
              ← Back
            </button>
            <button className="btn btn-success" onClick={proceedToFrameExtraction}>
              Extract Frames →
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Frame Extraction */}
      {currentStep === 4 && (
        <div className="step-container">
          <h2 className="step-title">
            <span className="step-number">4</span>
            Extract Frames
          </h2>

          <p className="description-text">
            Drag the dividers to adjust frame boundaries. Purple = columns, pink = rows.
          </p>

          {/* Tab buttons */}
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
            <button
              className={`btn ${activeSheet === "walk" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setActiveSheet("walk")}
            >
              Walk Cycle
            </button>
            <button
              className={`btn ${activeSheet === "dodge" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setActiveSheet("dodge")}
            >
              Dodge
            </button>
            <button
              className={`btn ${activeSheet === "attack" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setActiveSheet("attack")}
            >
              Attack
            </button>
            <button
              className={`btn ${activeSheet === "idle" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setActiveSheet("idle")}
            >
              Idle
            </button>
            <button className={`btn ${activeSheet === "ko" ? "btn-primary" : "btn-secondary"}`} onClick={() => setActiveSheet("ko")}>K.O.</button>
            <button className={`btn ${activeSheet === "damage" ? "btn-primary" : "btn-secondary"}`} onClick={() => setActiveSheet("damage")}>Damage</button>
            <button className={`btn ${activeSheet === "victory" ? "btn-primary" : "btn-secondary"}`} onClick={() => setActiveSheet("victory")}>Victory</button>
          </div>

          {/* Walk frame extraction */}
          {activeSheet === "walk" && (
            <>
              <div className="frame-controls">
                <label htmlFor="walkGridCols">Columns:</label>
                <input
                  id="walkGridCols"
                  type="number"
                  className="frame-count-input"
                  min={1}
                  max={8}
                  value={walkGridCols}
                  onChange={(e) => setWalkGridCols(Math.max(1, Math.min(8, parseInt(e.target.value) || 3)))}
                />
                <label htmlFor="walkGridRows" style={{ marginLeft: "1rem" }}>Rows:</label>
                <input
                  id="walkGridRows"
                  type="number"
                  className="frame-count-input"
                  min={1}
                  max={8}
                  value={walkGridRows}
                  onChange={(e) => setWalkGridRows(Math.max(1, Math.min(8, parseInt(e.target.value) || 2)))}
                />
                <span style={{ marginLeft: "1rem", color: "var(--text-tertiary)", fontSize: "0.875rem" }}>
                  ({walkGridCols * walkGridRows} frames)
                </span>
              </div>

              {walkBgRemovedUrl && (
                <div className="frame-extractor" ref={containerRef}>
                  <div className="sprite-sheet-container">
                    <img
                      ref={walkSpriteSheetRef}
                      src={walkBgRemovedUrl}
                      alt="Walk sprite sheet"
                      onLoad={(e) => {
                        const img = e.target as HTMLImageElement;
                        setWalkSpriteSheetDimensions({ width: img.naturalWidth, height: img.naturalHeight });
                      }}
                    />
                    <div className="divider-overlay">
                      {walkVerticalDividers.map((pos, index) => (
                        <div
                          key={`wv-${index}`}
                          className="divider-line divider-vertical"
                          style={{ left: `${pos}%` }}
                          onMouseDown={(e) => handleWalkVerticalDividerDrag(index, e)}
                        />
                      ))}
                      {walkHorizontalDividers.map((pos, index) => (
                        <div
                          key={`wh-${index}`}
                          className="divider-line divider-horizontal"
                          style={{ top: `${pos}%` }}
                          onMouseDown={(e) => handleWalkHorizontalDividerDrag(index, e)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {walkExtractedFrames.length > 0 && (
                <div className="frames-preview">
                  {walkExtractedFrames.map((frame, index) => (
                    <div key={index} className="frame-thumb">
                      <img src={frame.dataUrl} alt={`Walk frame ${index + 1}`} />
                      <div className="frame-label">Walk {index + 1}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Jump frame extraction */}
          {activeSheet === "dodge" && (
            <>
              <div className="frame-controls">
                <label htmlFor="dodgeGridCols">Columns:</label>
                <input
                  id="dodgeGridCols"
                  type="number"
                  className="frame-count-input"
                  min={1}
                  max={8}
                  value={dodgeGridCols}
                  onChange={(e) => setDodgeGridCols(Math.max(1, Math.min(8, parseInt(e.target.value) || 2)))}
                />
                <label htmlFor="dodgeGridRows" style={{ marginLeft: "1rem" }}>Rows:</label>
                <input
                  id="dodgeGridRows"
                  type="number"
                  className="frame-count-input"
                  min={1}
                  max={8}
                  value={dodgeGridRows}
                  onChange={(e) => setDodgeGridRows(Math.max(1, Math.min(8, parseInt(e.target.value) || 2)))}
                />
                <span style={{ marginLeft: "1rem", color: "var(--text-tertiary)", fontSize: "0.875rem" }}>
                  ({dodgeGridCols * dodgeGridRows} frames)
                </span>
              </div>

              {dodgeBgRemovedUrl && (
                <div className="frame-extractor">
                  <div className="sprite-sheet-container">
                    <img
                      ref={dodgeSpriteSheetRef}
                      src={dodgeBgRemovedUrl}
                      alt="Dodge sprite sheet"
                      onLoad={(e) => {
                        const img = e.target as HTMLImageElement;
                        setDodgeSpriteSheetDimensions({ width: img.naturalWidth, height: img.naturalHeight });
                      }}
                    />
                    <div className="divider-overlay">
                      {dodgeVerticalDividers.map((pos, index) => (
                        <div
                          key={`jv-${index}`}
                          className="divider-line divider-vertical"
                          style={{ left: `${pos}%` }}
                          onMouseDown={(e) => handleDodgeVerticalDividerDrag(index, e)}
                        />
                      ))}
                      {dodgeHorizontalDividers.map((pos, index) => (
                        <div
                          key={`jh-${index}`}
                          className="divider-line divider-horizontal"
                          style={{ top: `${pos}%` }}
                          onMouseDown={(e) => handleDodgeHorizontalDividerDrag(index, e)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {dodgeExtractedFrames.length > 0 && (
                <div className="frames-preview">
                  {dodgeExtractedFrames.map((frame, index) => (
                    <div key={index} className="frame-thumb">
                      <img src={frame.dataUrl} alt={`Dodge frame ${index + 1}`} />
                      <div className="frame-label">Dodge {index + 1}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Attack frame extraction */}
          {activeSheet === "attack" && (
            <>
              <div className="frame-controls">
                <label htmlFor="attackGridCols">Columns:</label>
                <input
                  id="attackGridCols"
                  type="number"
                  className="frame-count-input"
                  min={1}
                  max={8}
                  value={attackGridCols}
                  onChange={(e) => setAttackGridCols(Math.max(1, Math.min(8, parseInt(e.target.value) || 2)))}
                />
                <label htmlFor="attackGridRows" style={{ marginLeft: "1rem" }}>Rows:</label>
                <input
                  id="attackGridRows"
                  type="number"
                  className="frame-count-input"
                  min={1}
                  max={8}
                  value={attackGridRows}
                  onChange={(e) => setAttackGridRows(Math.max(1, Math.min(8, parseInt(e.target.value) || 2)))}
                />
                <span style={{ marginLeft: "1rem", color: "var(--text-tertiary)", fontSize: "0.875rem" }}>
                  ({attackGridCols * attackGridRows} frames)
                </span>
              </div>

              {attackBgRemovedUrl && (
                <div className="frame-extractor">
                  <div className="sprite-sheet-container">
                    <img
                      ref={attackSpriteSheetRef}
                      src={attackBgRemovedUrl}
                      alt="Attack sprite sheet"
                      onLoad={(e) => {
                        const img = e.target as HTMLImageElement;
                        setAttackSpriteSheetDimensions({ width: img.naturalWidth, height: img.naturalHeight });
                      }}
                    />
                    <div className="divider-overlay">
                      {attackVerticalDividers.map((pos, index) => (
                        <div
                          key={`av-${index}`}
                          className="divider-line divider-vertical"
                          style={{ left: `${pos}%` }}
                          onMouseDown={(e) => handleAttackVerticalDividerDrag(index, e)}
                        />
                      ))}
                      {attackHorizontalDividers.map((pos, index) => (
                        <div
                          key={`ah-${index}`}
                          className="divider-line divider-horizontal"
                          style={{ top: `${pos}%` }}
                          onMouseDown={(e) => handleAttackHorizontalDividerDrag(index, e)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {attackExtractedFrames.length > 0 && (
                <div className="frames-preview">
                  {attackExtractedFrames.map((frame, index) => (
                    <div key={index} className="frame-thumb">
                      <img src={frame.dataUrl} alt={`Attack frame ${index + 1}`} />
                      <div className="frame-label">Attack {index + 1}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Idle frame extraction */}
          {activeSheet === "idle" && (
            <>
              <div className="frame-controls">
                <label htmlFor="idleGridCols">Columns:</label>
                <input
                  id="idleGridCols"
                  type="number"
                  className="frame-count-input"
                  min={1}
                  max={8}
                  value={idleGridCols}
                  onChange={(e) => setIdleGridCols(Math.max(1, Math.min(8, parseInt(e.target.value) || 2)))}
                />
                <label htmlFor="idleGridRows" style={{ marginLeft: "1rem" }}>Rows:</label>
                <input
                  id="idleGridRows"
                  type="number"
                  className="frame-count-input"
                  min={1}
                  max={8}
                  value={idleGridRows}
                  onChange={(e) => setIdleGridRows(Math.max(1, Math.min(8, parseInt(e.target.value) || 2)))}
                />
                <span style={{ marginLeft: "1rem", color: "var(--text-tertiary)", fontSize: "0.875rem" }}>
                  ({idleGridCols * idleGridRows} frames)
                </span>
              </div>

              {idleBgRemovedUrl && (
                <div className="frame-extractor">
                  <div className="sprite-sheet-container">
                    <img
                      ref={idleSpriteSheetRef}
                      src={idleBgRemovedUrl}
                      alt="Idle sprite sheet"
                      onLoad={(e) => {
                        const img = e.target as HTMLImageElement;
                        setIdleSpriteSheetDimensions({ width: img.naturalWidth, height: img.naturalHeight });
                      }}
                    />
                    <div className="divider-overlay">
                      {idleVerticalDividers.map((pos, index) => (
                        <div
                          key={`iv-${index}`}
                          className="divider-line divider-vertical"
                          style={{ left: `${pos}%` }}
                          onMouseDown={(e) => handleIdleVerticalDividerDrag(index, e)}
                        />
                      ))}
                      {idleHorizontalDividers.map((pos, index) => (
                        <div
                          key={`ih-${index}`}
                          className="divider-line divider-horizontal"
                          style={{ top: `${pos}%` }}
                          onMouseDown={(e) => handleIdleHorizontalDividerDrag(index, e)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {idleExtractedFrames.length > 0 && (
                <div className="frames-preview">
                  {idleExtractedFrames.map((frame, index) => (
                    <div key={index} className="frame-thumb">
                      <img src={frame.dataUrl} alt={`Idle frame ${index + 1}`} />
                      <div className="frame-label">Idle {index + 1}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* KO frame extraction */}
          {activeSheet === "ko" && (
            <>
              <div className="frame-controls">
                <label htmlFor="koGridCols">Columns:</label>
                <input id="koGridCols" type="number" className="frame-count-input" min={1} max={8} value={koGridCols} onChange={(e) => setKoGridCols(Math.max(1, Math.min(8, parseInt(e.target.value) || 2)))} />
                <label htmlFor="koGridRows" style={{ marginLeft: "1rem" }}>Rows:</label>
                <input id="koGridRows" type="number" className="frame-count-input" min={1} max={8} value={koGridRows} onChange={(e) => setKoGridRows(Math.max(1, Math.min(8, parseInt(e.target.value) || 2)))} />
                <span style={{ marginLeft: "1rem", color: "var(--text-tertiary)", fontSize: "0.875rem" }}>({koGridCols * koGridRows} frames)</span>
              </div>
              {koBgRemovedUrl && (
                <div className="frame-extractor"><div className="sprite-sheet-container">
                  <img ref={koSpriteSheetRef} src={koBgRemovedUrl} alt="KO sprite sheet" onLoad={(e) => { const img = e.target as HTMLImageElement; setKoSpriteSheetDimensions({ width: img.naturalWidth, height: img.naturalHeight }); }} />
                  <div className="divider-overlay">
                    {koVerticalDividers.map((pos, index) => (<div key={`kv-${index}`} className="divider-line divider-vertical" style={{ left: `${pos}%` }} onMouseDown={(e) => handleKoVerticalDividerDrag(index, e)} />))}
                    {koHorizontalDividers.map((pos, index) => (<div key={`kh-${index}`} className="divider-line divider-horizontal" style={{ top: `${pos}%` }} onMouseDown={(e) => handleKoHorizontalDividerDrag(index, e)} />))}
                  </div>
                </div></div>
              )}
              {koExtractedFrames.length > 0 && (
                <div className="frames-preview">{koExtractedFrames.map((frame, index) => (<div key={index} className="frame-thumb"><img src={frame.dataUrl} alt={`KO frame ${index + 1}`} /><div className="frame-label">K.O. {index + 1}</div></div>))}</div>
              )}
            </>
          )}

          {/* Damage frame extraction */}
          {activeSheet === "damage" && (
            <>
              <div className="frame-controls">
                <label htmlFor="damageGridCols">Columns:</label>
                <input id="damageGridCols" type="number" className="frame-count-input" min={1} max={8} value={damageGridCols} onChange={(e) => setDamageGridCols(Math.max(1, Math.min(8, parseInt(e.target.value) || 2)))} />
                <label htmlFor="damageGridRows" style={{ marginLeft: "1rem" }}>Rows:</label>
                <input id="damageGridRows" type="number" className="frame-count-input" min={1} max={8} value={damageGridRows} onChange={(e) => setDamageGridRows(Math.max(1, Math.min(8, parseInt(e.target.value) || 2)))} />
                <span style={{ marginLeft: "1rem", color: "var(--text-tertiary)", fontSize: "0.875rem" }}>({damageGridCols * damageGridRows} frames)</span>
              </div>
              {damageBgRemovedUrl && (
                <div className="frame-extractor"><div className="sprite-sheet-container">
                  <img ref={damageSpriteSheetRef} src={damageBgRemovedUrl} alt="Damage sprite sheet" onLoad={(e) => { const img = e.target as HTMLImageElement; setDamageSpriteSheetDimensions({ width: img.naturalWidth, height: img.naturalHeight }); }} />
                  <div className="divider-overlay">
                    {damageVerticalDividers.map((pos, index) => (<div key={`dv-${index}`} className="divider-line divider-vertical" style={{ left: `${pos}%` }} onMouseDown={(e) => handleDamageVerticalDividerDrag(index, e)} />))}
                    {damageHorizontalDividers.map((pos, index) => (<div key={`dh-${index}`} className="divider-line divider-horizontal" style={{ top: `${pos}%` }} onMouseDown={(e) => handleDamageHorizontalDividerDrag(index, e)} />))}
                  </div>
                </div></div>
              )}
              {damageExtractedFrames.length > 0 && (
                <div className="frames-preview">{damageExtractedFrames.map((frame, index) => (<div key={index} className="frame-thumb"><img src={frame.dataUrl} alt={`Damage frame ${index + 1}`} /><div className="frame-label">Damage {index + 1}</div></div>))}</div>
              )}
            </>
          )}

          {/* Victory frame extraction */}
          {activeSheet === "victory" && (
            <>
              <div className="frame-controls">
                <label htmlFor="victoryGridCols">Columns:</label>
                <input id="victoryGridCols" type="number" className="frame-count-input" min={1} max={8} value={victoryGridCols} onChange={(e) => setVictoryGridCols(Math.max(1, Math.min(8, parseInt(e.target.value) || 2)))} />
                <label htmlFor="victoryGridRows" style={{ marginLeft: "1rem" }}>Rows:</label>
                <input id="victoryGridRows" type="number" className="frame-count-input" min={1} max={8} value={victoryGridRows} onChange={(e) => setVictoryGridRows(Math.max(1, Math.min(8, parseInt(e.target.value) || 2)))} />
                <span style={{ marginLeft: "1rem", color: "var(--text-tertiary)", fontSize: "0.875rem" }}>({victoryGridCols * victoryGridRows} frames)</span>
              </div>
              {victoryBgRemovedUrl && (
                <div className="frame-extractor"><div className="sprite-sheet-container">
                  <img ref={victorySpriteSheetRef} src={victoryBgRemovedUrl} alt="Victory sprite sheet" onLoad={(e) => { const img = e.target as HTMLImageElement; setVictorySpriteSheetDimensions({ width: img.naturalWidth, height: img.naturalHeight }); }} />
                  <div className="divider-overlay">
                    {victoryVerticalDividers.map((pos, index) => (<div key={`vv-${index}`} className="divider-line divider-vertical" style={{ left: `${pos}%` }} onMouseDown={(e) => handleVictoryVerticalDividerDrag(index, e)} />))}
                    {victoryHorizontalDividers.map((pos, index) => (<div key={`vh-${index}`} className="divider-line divider-horizontal" style={{ top: `${pos}%` }} onMouseDown={(e) => handleVictoryHorizontalDividerDrag(index, e)} />))}
                  </div>
                </div></div>
              )}
              {victoryExtractedFrames.length > 0 && (
                <div className="frames-preview">{victoryExtractedFrames.map((frame, index) => (<div key={index} className="frame-thumb"><img src={frame.dataUrl} alt={`Victory frame ${index + 1}`} /><div className="frame-label">Victory {index + 1}</div></div>))}</div>
              )}
            </>
          )}

          <div className="button-group">
            <button className="btn btn-secondary" onClick={() => setCurrentStep(3)}>
              ← Back
            </button>
            <button
              className="btn btn-success"
              onClick={proceedToSandbox}
              disabled={walkExtractedFrames.length === 0 || dodgeExtractedFrames.length === 0 || attackExtractedFrames.length === 0 || idleExtractedFrames.length === 0}
            >
              Try in Sandbox →
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Animation Preview & Export */}
      {currentStep === 5 && (
        <div className="step-container">
          <h2 className="step-title">
            <span className="step-number">5</span>
            Preview & Export
          </h2>

          <p className="description-text">Walk animation preview. Test walk, dodge, and attack in the sandbox!</p>

          <div className="animation-preview">
            <div className="animation-canvas-container">
              <canvas ref={canvasRef} className="animation-canvas" />
              <div className="direction-indicator">
                {direction === "right" ? "→ Walking Right" : "← Walking Left"}
              </div>
            </div>

            <div className="keyboard-hint">
              Hold <kbd>D</kbd> or <kbd>→</kbd> to walk right | Hold <kbd>A</kbd> or <kbd>←</kbd> to walk left | <kbd>Space</kbd> to stop
            </div>

            <div className="animation-controls">
              <button
                className={`btn ${isPlaying ? "btn-secondary" : "btn-primary"}`}
                onClick={() => setIsPlaying(!isPlaying)}
              >
                {isPlaying ? "Stop" : "Play"}
              </button>

              <div className="fps-control">
                <label>FPS: {fps}</label>
                <input
                  type="range"
                  className="fps-slider"
                  min={1}
                  max={24}
                  value={fps}
                  onChange={(e) => setFps(parseInt(e.target.value))}
                />
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", margin: "1rem 0" }}>
            <div>
              <h4 style={{ marginBottom: "0.5rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>Walk Frames</h4>
              <div className="frames-preview" style={{ margin: 0, justifyContent: "flex-start" }}>
                {walkExtractedFrames.map((frame, index) => (
                  <div
                    key={index}
                    className={`frame-thumb ${currentFrameIndex === index ? "active" : ""}`}
                    onClick={() => setCurrentFrameIndex(index)}
                  >
                    <img src={frame.dataUrl} alt={`Walk ${index + 1}`} />
                    <div className="frame-label">{index + 1}</div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 style={{ marginBottom: "0.5rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>Dodge Frames</h4>
              <div className="frames-preview" style={{ margin: 0, justifyContent: "flex-start" }}>
                {dodgeExtractedFrames.map((frame, index) => (
                  <div key={index} className="frame-thumb">
                    <img src={frame.dataUrl} alt={`Dodge ${index + 1}`} />
                    <div className="frame-label">{index + 1}</div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 style={{ marginBottom: "0.5rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>Attack Frames</h4>
              <div className="frames-preview" style={{ margin: 0, justifyContent: "flex-start" }}>
                {attackExtractedFrames.map((frame, index) => (
                  <div key={index} className="frame-thumb">
                    <img src={frame.dataUrl} alt={`Attack ${index + 1}`} />
                    <div className="frame-label">{index + 1}</div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 style={{ marginBottom: "0.5rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>Idle Frames</h4>
              <div className="frames-preview" style={{ margin: 0, justifyContent: "flex-start" }}>
                {idleExtractedFrames.map((frame, index) => (<div key={index} className="frame-thumb"><img src={frame.dataUrl} alt={`Idle ${index + 1}`} /><div className="frame-label">{index + 1}</div></div>))}
              </div>
            </div>
            <div>
              <h4 style={{ marginBottom: "0.5rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>K.O. Frames</h4>
              <div className="frames-preview" style={{ margin: 0, justifyContent: "flex-start" }}>
                {koExtractedFrames.map((frame, index) => (<div key={index} className="frame-thumb"><img src={frame.dataUrl} alt={`KO ${index + 1}`} /><div className="frame-label">{index + 1}</div></div>))}
              </div>
            </div>
            <div>
              <h4 style={{ marginBottom: "0.5rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>Damage Frames</h4>
              <div className="frames-preview" style={{ margin: 0, justifyContent: "flex-start" }}>
                {damageExtractedFrames.map((frame, index) => (<div key={index} className="frame-thumb"><img src={frame.dataUrl} alt={`Damage ${index + 1}`} /><div className="frame-label">{index + 1}</div></div>))}
              </div>
            </div>
            <div>
              <h4 style={{ marginBottom: "0.5rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>Victory Frames</h4>
              <div className="frames-preview" style={{ margin: 0, justifyContent: "flex-start" }}>
                {victoryExtractedFrames.map((frame, index) => (<div key={index} className="frame-thumb"><img src={frame.dataUrl} alt={`Victory ${index + 1}`} /><div className="frame-label">{index + 1}</div></div>))}
              </div>
            </div>
          </div>

          <div className="export-section">
            <h3 style={{ marginBottom: "0.75rem" }}>Export</h3>
            <div className="export-options">
              <button className="btn btn-primary" onClick={exportWalkSpriteSheet}>Walk Sheet</button>
              <button className="btn btn-primary" onClick={exportDodgeSpriteSheet}>Dodge Sheet</button>
              <button className="btn btn-primary" onClick={exportAttackSpriteSheet}>Attack Sheet</button>
              <button className="btn btn-primary" onClick={exportIdleSpriteSheet}>Idle Sheet</button>
              <button className="btn btn-primary" onClick={exportKoSpriteSheet}>K.O. Sheet</button>
              <button className="btn btn-primary" onClick={exportDamageSpriteSheet}>Damage Sheet</button>
              <button className="btn btn-primary" onClick={exportVictorySpriteSheet}>Victory Sheet</button>
              <button className="btn btn-secondary" onClick={exportAllFrames}>
                All Frames
              </button>
            </div>
          </div>

          <div className="button-group" style={{ marginTop: "1.5rem" }}>
            <button className="btn btn-secondary" onClick={() => setCurrentStep(4)}>
              ← Back to Frame Extraction
            </button>
            <button
              className="btn btn-success"
              onClick={() => {
                setCompletedSteps((prev) => new Set([...prev, 5]));
                setCurrentStep(6);
              }}
            >
              Try in Sandbox →
            </button>
          </div>
        </div>
      )}

      {/* Step 6: Sandbox */}
      {currentStep === 6 && (
        <div className="step-container">
          <h2 className="step-title">
            <span className="step-number">5</span>
            Sandbox
          </h2>

          <p className="description-text">
            Walk, dodge, and attack with your character! Use the keyboard to control movement.
          </p>

          {/* Background mode tabs */}
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
            <button
              className={`btn ${backgroundMode === "default" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setBackgroundMode("default")}
            >
              Default Background
            </button>
            <button
              className={`btn ${backgroundMode === "custom" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setBackgroundMode("custom")}
            >
              Custom Background
            </button>
          </div>

          {/* Custom background generation UI */}
          {backgroundMode === "custom" && (
            <div style={{ marginBottom: "1rem", padding: "1rem", background: "var(--bg-secondary)", borderRadius: "8px" }}>
              {!customBackgroundLayers.layer1Url ? (
                <>
                  <p style={{ marginBottom: "0.75rem", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                    Generate a custom parallax background that matches your character&apos;s world.
                  </p>
                  <button
                    className="btn btn-success"
                    onClick={generateBackground}
                    disabled={isGeneratingBackground}
                  >
                    {isGeneratingBackground ? "Generating Background..." : "Generate Custom Background"}
                  </button>
                  {isGeneratingBackground && (
                    <div className="loading" style={{ marginTop: "1rem" }}>
                      <FalSpinner />
                      <span className="loading-text">Creating 3-layer parallax background (this may take a moment)...</span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p style={{ marginBottom: "0.75rem", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                    Custom background generated! Click on a layer to regenerate just that one.
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", marginBottom: "0.75rem" }}>
                    <div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "0.25rem" }}>Layer 1 (Sky)</div>
                      <img src={customBackgroundLayers.layer1Url} alt="Background layer" style={{ width: "100%", borderRadius: "4px", opacity: regeneratingLayer === 1 ? 0.5 : 1 }} />
                      <button
                        className="btn btn-secondary"
                        onClick={() => regenerateBackgroundLayer(1)}
                        disabled={isGeneratingBackground || regeneratingLayer !== null}
                        style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem", marginTop: "0.25rem", width: "100%" }}
                      >
                        {regeneratingLayer === 1 ? "..." : "Regen"}
                      </button>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "0.25rem" }}>Layer 2 (Mid)</div>
                      <img src={customBackgroundLayers.layer2Url!} alt="Midground layer" style={{ width: "100%", borderRadius: "4px", background: "#333", opacity: regeneratingLayer === 2 ? 0.5 : 1 }} />
                      <button
                        className="btn btn-secondary"
                        onClick={() => regenerateBackgroundLayer(2)}
                        disabled={isGeneratingBackground || regeneratingLayer !== null}
                        style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem", marginTop: "0.25rem", width: "100%" }}
                      >
                        {regeneratingLayer === 2 ? "..." : "Regen"}
                      </button>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "0.25rem" }}>Layer 3 (Front)</div>
                      <img src={customBackgroundLayers.layer3Url!} alt="Foreground layer" style={{ width: "100%", borderRadius: "4px", background: "#333", opacity: regeneratingLayer === 3 ? 0.5 : 1 }} />
                      <button
                        className="btn btn-secondary"
                        onClick={() => regenerateBackgroundLayer(3)}
                        disabled={isGeneratingBackground || regeneratingLayer !== null}
                        style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem", marginTop: "0.25rem", width: "100%" }}
                      >
                        {regeneratingLayer === 3 ? "..." : "Regen"}
                      </button>
                    </div>
                  </div>
                  <button
                    className="btn btn-secondary"
                    onClick={generateBackground}
                    disabled={isGeneratingBackground || regeneratingLayer !== null}
                    style={{ fontSize: "0.85rem" }}
                  >
                    {isGeneratingBackground ? "Regenerating All..." : "Regenerate All Layers"}
                  </button>
                </>
              )}
            </div>
          )}

          <div className="sandbox-container">
            <Suspense fallback={
              <div className="loading">
                <FalSpinner />
                <span className="loading-text">Loading sandbox...</span>
              </div>
            }>
              <PixiSandbox
                walkFrames={walkExtractedFrames}
                dodgeFrames={dodgeExtractedFrames}
                attackFrames={attackExtractedFrames}
                idleFrames={idleExtractedFrames}
                koFrames={koExtractedFrames}
                damageFrames={damageExtractedFrames}
                victoryFrames={victoryExtractedFrames}
                fps={fps}
                customBackgroundLayers={backgroundMode === "custom" ? customBackgroundLayers : undefined}
              />
            </Suspense>
          </div>

          <div className="keyboard-hint" style={{ marginTop: "1rem" }}>
            <kbd>A</kbd>/<kbd>←</kbd> walk left | <kbd>D</kbd>/<kbd>→</kbd> walk right | <kbd>Shift</kbd> dodge | <kbd>J</kbd> attack | <kbd>G</kbd> damage | <kbd>K</kbd> K.O. | <kbd>R</kbd> reset K.O. | <kbd>V</kbd> victory
          </div>

          <div className="animation-controls" style={{ marginTop: "1rem" }}>
            <div className="fps-control">
              <label>Animation Speed (FPS): {fps}</label>
              <input
                type="range"
                className="fps-slider"
                min={4}
                max={16}
                value={fps}
                onChange={(e) => setFps(parseInt(e.target.value))}
              />
            </div>
          </div>

          <div className="button-group" style={{ marginTop: "1.5rem" }}>
            <button className="btn btn-secondary" onClick={() => setCurrentStep(4)}>
              ← Back to Frame Extraction
            </button>
            <button
              className="btn btn-primary"
              onClick={saveToArchive}
              disabled={!walkExtractedFrames.length && !dodgeExtractedFrames.length}
            >
              Save to Archive
            </button>
            <button className="btn btn-secondary" onClick={() => {
              // Reset everything
              setCurrentStep(1);
              setCompletedSteps(new Set());
              setCharacterImageUrl(null);
              setWalkSpriteSheetUrl(null);
              setDodgeSpriteSheetUrl(null);
              setAttackSpriteSheetUrl(null);
              setIdleSpriteSheetUrl(null);
              setWalkBgRemovedUrl(null);
              setDodgeBgRemovedUrl(null);
              setAttackBgRemovedUrl(null);
              setIdleBgRemovedUrl(null);
              setKoSpriteSheetUrl(null);
              setDamageSpriteSheetUrl(null);
              setVictorySpriteSheetUrl(null);
              setKoBgRemovedUrl(null);
              setDamageBgRemovedUrl(null);
              setVictoryBgRemovedUrl(null);
              setWalkExtractedFrames([]);
              setDodgeExtractedFrames([]);
              setAttackExtractedFrames([]);
              setIdleExtractedFrames([]);
              setKoExtractedFrames([]);
              setDamageExtractedFrames([]);
              setVictoryExtractedFrames([]);
              setCharacterPrompt("");
              setInputImageUrl("");
              setCharacterInputMode("text");
              setBackgroundMode("default");
              setCustomBackgroundLayers({ layer1Url: null, layer2Url: null, layer3Url: null });
            }}>
              Start New Sprite
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
