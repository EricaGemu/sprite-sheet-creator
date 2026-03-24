"use client";

import { useEffect, useRef, useCallback } from "react";

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Frame {
  dataUrl: string;
  width: number;
  height: number;
  contentBounds: BoundingBox;
}

interface CustomBackgroundLayers {
  layer1Url: string | null;
  layer2Url: string | null;
  layer3Url: string | null;
}

interface PixiSandboxProps {
  walkFrames: Frame[];
  dodgeFrames: Frame[];
  attackFrames: Frame[];
  idleFrames: Frame[];
  koFrames: Frame[];
  damageFrames: Frame[];
  victoryFrames: Frame[];
  fps: number;
  customBackgroundLayers?: CustomBackgroundLayers;
}

// Default side-scroller parallax layers
const DEFAULT_PARALLAX_LAYERS = [
  { url: "https://raw.githubusercontent.com/meiliizzsuju/game-parallax-backgrounds/main/assets/layer-1.png", speed: 0 },
  { url: "https://raw.githubusercontent.com/meiliizzsuju/game-parallax-backgrounds/main/assets/layer-2.png", speed: 0.1 },
  { url: "https://raw.githubusercontent.com/meiliizzsuju/game-parallax-backgrounds/main/assets/layer-3.png", speed: 0.3 },
  { url: "https://raw.githubusercontent.com/meiliizzsuju/game-parallax-backgrounds/main/assets/layer-4.png", speed: 0.5 },
  { url: "https://raw.githubusercontent.com/meiliizzsuju/game-parallax-backgrounds/main/assets/layer-5.png", speed: 0.7 },
];

// Custom parallax layer speeds (3 layers)
const CUSTOM_PARALLAX_SPEEDS = [0, 0.3, 0.6];

// Dodge constants
const DODGE_DURATION = 0.35; // seconds

export default function PixiSandbox({ walkFrames, dodgeFrames, attackFrames, idleFrames, koFrames, damageFrames, victoryFrames, fps, customBackgroundLayers }: PixiSandboxProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const characterState = useRef({
    x: 400,
    y: 0,
    direction: "right" as "left" | "right",
    isWalking: false,
    isDodging: false,
    isAttacking: false,
    isKo: false,
    isDamaged: false,
    isVictory: false,
    walkFrameIndex: 0,
    dodgeFrameIndex: 0,
    attackFrameIndex: 0,
    idleFrameIndex: 0,
    koFrameIndex: 0,
    damageFrameIndex: 0,
    victoryFrameIndex: 0,
    frameTime: 0,
    dodgeFrameTime: 0,
    dodgeElapsed: 0,
    attackFrameTime: 0,
    idleFrameTime: 0,
    koFrameTime: 0,
    damageFrameTime: 0,
    victoryFrameTime: 0,
  });
  const keysPressed = useRef<Set<string>>(new Set());
  const animationRef = useRef<number>(0);
  const walkImagesRef = useRef<HTMLImageElement[]>([]);
  const dodgeImagesRef = useRef<HTMLImageElement[]>([]);
  const attackImagesRef = useRef<HTMLImageElement[]>([]);
  const idleImagesRef = useRef<HTMLImageElement[]>([]);
  const koImagesRef = useRef<HTMLImageElement[]>([]);
  const damageImagesRef = useRef<HTMLImageElement[]>([]);
  const victoryImagesRef = useRef<HTMLImageElement[]>([]);
  // Store frame metadata for bounding box info
  const walkFrameDataRef = useRef<Frame[]>([]);
  const dodgeFrameDataRef = useRef<Frame[]>([]);
  const attackFrameDataRef = useRef<Frame[]>([]);
  const idleFrameDataRef = useRef<Frame[]>([]);
  const koFrameDataRef = useRef<Frame[]>([]);
  const damageFrameDataRef = useRef<Frame[]>([]);
  const victoryFrameDataRef = useRef<Frame[]>([]);
  const bgLayersRef = useRef<HTMLImageElement[]>([]);
  const bgLoadedRef = useRef(false);
  // Custom background layers
  const customBgLayersRef = useRef<HTMLImageElement[]>([]);
  const customBgLoadedRef = useRef(false);
  const cameraX = useRef(0);
  const timeRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const fpsRef = useRef(fps);

  // Sync fpsRef immediately during render (not in useEffect which runs async)
  fpsRef.current = fps;

  const WORLD_WIDTH = 800;
  const WORLD_HEIGHT = 400;
  const GROUND_Y = 340;
  const MOVE_SPEED = 3;

  // Load default parallax background layers
  useEffect(() => {
    const loadLayers = async () => {
      const layers: HTMLImageElement[] = [];
      let loadedCount = 0;

      for (const layer of DEFAULT_PARALLAX_LAYERS) {
        const img = new Image();
        img.crossOrigin = "anonymous";

        await new Promise<void>((resolve) => {
          img.onload = () => {
            loadedCount++;
            resolve();
          };
          img.onerror = () => {
            console.log(`Layer failed to load: ${layer.url}`);
            resolve();
          };
          img.src = layer.url;
        });

        layers.push(img);
      }

      bgLayersRef.current = layers;
      bgLoadedRef.current = loadedCount === DEFAULT_PARALLAX_LAYERS.length;
    };

    loadLayers();
  }, []);

  // Load custom background layers when provided
  useEffect(() => {
    if (!customBackgroundLayers?.layer1Url) {
      customBgLoadedRef.current = false;
      customBgLayersRef.current = [];
      return;
    }

    const loadCustomLayers = async () => {
      const urls = [
        customBackgroundLayers.layer1Url,
        customBackgroundLayers.layer2Url,
        customBackgroundLayers.layer3Url,
      ].filter((url): url is string => url !== null);

      const layers: HTMLImageElement[] = [];
      let loadedCount = 0;

      for (const url of urls) {
        const img = new Image();
        img.crossOrigin = "anonymous";

        await new Promise<void>((resolve) => {
          img.onload = () => {
            loadedCount++;
            resolve();
          };
          img.onerror = () => {
            console.log(`Custom layer failed to load: ${url}`);
            resolve();
          };
          img.src = url;
        });

        layers.push(img);
      }

      customBgLayersRef.current = layers;
      customBgLoadedRef.current = loadedCount === urls.length && loadedCount > 0;
    };

    loadCustomLayers();
  }, [customBackgroundLayers]);

  // Load walk sprite frames
  useEffect(() => {
    const loadImages = async () => {
      const images: HTMLImageElement[] = [];
      for (const frame of walkFrames) {
        const img = new Image();
        img.src = frame.dataUrl;
        await new Promise((resolve) => {
          img.onload = resolve;
        });
        images.push(img);
      }
      walkImagesRef.current = images;
      walkFrameDataRef.current = walkFrames;
    };
    
    if (walkFrames.length > 0) {
      loadImages();
    }
  }, [walkFrames]);

  // Load dodge sprite frames
  useEffect(() => {
    const loadImages = async () => {
      const images: HTMLImageElement[] = [];
      for (const frame of dodgeFrames) {
        const img = new Image();
        img.src = frame.dataUrl;
        await new Promise((resolve) => {
          img.onload = resolve;
        });
        images.push(img);
      }
      dodgeImagesRef.current = images;
      dodgeFrameDataRef.current = dodgeFrames;
    };
    
    if (dodgeFrames.length > 0) {
      loadImages();
    }
  }, [dodgeFrames]);

  // Load attack sprite frames
  useEffect(() => {
    const loadImages = async () => {
      const images: HTMLImageElement[] = [];
      for (const frame of attackFrames) {
        const img = new Image();
        img.src = frame.dataUrl;
        await new Promise((resolve) => {
          img.onload = resolve;
        });
        images.push(img);
      }
      attackImagesRef.current = images;
      attackFrameDataRef.current = attackFrames;
    };
    
    if (attackFrames.length > 0) {
      loadImages();
    }
  }, [attackFrames]);

  // Load idle sprite frames
  useEffect(() => {
    const loadImages = async () => {
      const images: HTMLImageElement[] = [];
      for (const frame of idleFrames) {
        const img = new Image();
        img.src = frame.dataUrl;
        await new Promise((resolve) => {
          img.onload = resolve;
        });
        images.push(img);
      }
      idleImagesRef.current = images;
      idleFrameDataRef.current = idleFrames;
    };
    
    if (idleFrames.length > 0) {
      loadImages();
    }
  }, [idleFrames]);

  // Load ko sprite frames
  useEffect(() => {
    const loadImages = async () => {
      const images: HTMLImageElement[] = [];
      for (const frame of koFrames) {
        const img = new Image();
        img.src = frame.dataUrl;
        await new Promise((resolve) => { img.onload = resolve; });
        images.push(img);
      }
      koImagesRef.current = images;
      koFrameDataRef.current = koFrames;
    };
    if (koFrames.length > 0) loadImages();
  }, [koFrames]);

  // Load damage sprite frames
  useEffect(() => {
    const loadImages = async () => {
      const images: HTMLImageElement[] = [];
      for (const frame of damageFrames) {
        const img = new Image();
        img.src = frame.dataUrl;
        await new Promise((resolve) => { img.onload = resolve; });
        images.push(img);
      }
      damageImagesRef.current = images;
      damageFrameDataRef.current = damageFrames;
    };
    if (damageFrames.length > 0) loadImages();
  }, [damageFrames]);

  // Load victory sprite frames
  useEffect(() => {
    const loadImages = async () => {
      const images: HTMLImageElement[] = [];
      for (const frame of victoryFrames) {
        const img = new Image();
        img.src = frame.dataUrl;
        await new Promise((resolve) => { img.onload = resolve; });
        images.push(img);
      }
      victoryImagesRef.current = images;
      victoryFrameDataRef.current = victoryFrames;
    };
    if (victoryFrames.length > 0) loadImages();
  }, [victoryFrames]);

  // Main game loop
  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;

    // Calculate delta time for frame-rate independent animation
    const currentTime = performance.now();
    const deltaTime = (currentTime - lastTimeRef.current) / 1000; // Convert to seconds
    lastTimeRef.current = currentTime;

    const state = characterState.current;
    const walkImages = walkImagesRef.current;
    const dodgeImages = dodgeImagesRef.current;
    const attackImages = attackImagesRef.current;
    const idleImages = idleImagesRef.current;
    const koImages = koImagesRef.current;
    const damageImages = damageImagesRef.current;
    const victoryImages = victoryImagesRef.current;
    const bgLayers = bgLayersRef.current;
    // Accumulate time in seconds (not frames) for frame-rate independent effects
    timeRef.current += deltaTime;

    // Clear
    ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // Check if walking (horizontal movement) - can't walk while in any special animation
    const movingHorizontally = keysPressed.current.has("right") || keysPressed.current.has("left");
    const inSpecialAnim = state.isDodging || state.isAttacking || state.isKo || state.isDamaged || state.isVictory;
    state.isWalking = movingHorizontally && !inSpecialAnim;

    // Handle horizontal movement - not during special animations
    const canMove = !inSpecialAnim;
    const moveAmount = MOVE_SPEED * deltaTime * 60;
    if (canMove) {
      if (keysPressed.current.has("right")) {
        state.direction = "right";
        state.x += moveAmount;
        cameraX.current += moveAmount;
      }
      if (keysPressed.current.has("left")) {
        state.direction = "left";
        state.x -= moveAmount;
        cameraX.current -= moveAmount;
      }
    }

    state.x = Math.max(50, Math.min(WORLD_WIDTH - 50, state.x));


    // Draw background layers with parallax
    const useCustomBg = customBgLoadedRef.current && customBgLayersRef.current.length > 0;
    const customBgLayers = customBgLayersRef.current;

    if (useCustomBg) {
      // Render custom AI-generated background layers (no tiling - single wide image)
      // First, calculate the global max camera position based on the fastest layer
      // This ensures all layers stop scrolling together, maintaining parallax consistency
      const fastestSpeed = Math.max(...CUSTOM_PARALLAX_SPEEDS);
      let maxCameraX = Infinity;

      // Find the limiting camera position (where fastest layer hits its edge)
      for (const layer of customBgLayers) {
        if (layer.complete && layer.naturalWidth > 0) {
          const scale = WORLD_HEIGHT / layer.naturalHeight;
          const scaledWidth = layer.naturalWidth * scale;
          const maxOffset = Math.max(0, scaledWidth - WORLD_WIDTH);
          // maxOffset = cameraX * fastestSpeed, so cameraX = maxOffset / fastestSpeed
          if (fastestSpeed > 0) {
            maxCameraX = Math.min(maxCameraX, maxOffset / fastestSpeed);
          }
          break; // All layers have same dimensions, only need to check one
        }
      }

      // Clamp camera position globally
      const clampedCameraX = Math.max(0, Math.min(maxCameraX === Infinity ? 0 : maxCameraX, cameraX.current));

      customBgLayers.forEach((layer, index) => {
        if (layer.complete && layer.naturalWidth > 0) {
          const speed = CUSTOM_PARALLAX_SPEEDS[index] || 0;

          // Scale to fit height
          const scale = WORLD_HEIGHT / layer.naturalHeight;
          const scaledWidth = layer.naturalWidth * scale;

          // Calculate scroll offset using the globally clamped camera position
          const offset = clampedCameraX * speed;

          ctx.drawImage(layer, -offset, 0, scaledWidth, WORLD_HEIGHT);
        }
      });
    } else if (bgLoadedRef.current && bgLayers.length > 0) {
      // Render default parallax background layers
      bgLayers.forEach((layer, index) => {
        if (layer.complete && layer.naturalWidth > 0) {
          const speed = DEFAULT_PARALLAX_LAYERS[index].speed;
          const layerOffset = (cameraX.current * speed) % layer.naturalWidth;

          const scale = WORLD_HEIGHT / layer.naturalHeight;
          const scaledWidth = layer.naturalWidth * scale;

          let startX = -((layerOffset * scale) % scaledWidth);
          if (startX > 0) startX -= scaledWidth;

          for (let x = startX; x < WORLD_WIDTH; x += scaledWidth) {
            ctx.drawImage(layer, x, 0, scaledWidth, WORLD_HEIGHT);
          }
        }
      });
    } else {
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
      ctx.fillStyle = "#ffffff";
      ctx.font = "20px Arial";
      ctx.textAlign = "center";
      ctx.fillText("Loading...", WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
    }

    // Read current FPS from ref (so we always get the latest value)
    const currentFps = fpsRef.current;

    // Walk animation - using delta time for frame-rate independence
    if (state.isWalking && walkImages.length > 0) {
      state.frameTime += deltaTime;
      const frameDuration = 1 / currentFps; // Time per frame in seconds
      if (state.frameTime >= frameDuration) {
        state.frameTime -= frameDuration;
        state.walkFrameIndex = (state.walkFrameIndex + 1) % walkImages.length;
      }
    } else if (!inSpecialAnim) {
      state.walkFrameIndex = 0;
      state.frameTime = 0;
    }

    // Idle animation - plays when standing still (no special animation active)
    if (!state.isWalking && !inSpecialAnim && idleImages.length > 0) {
      state.idleFrameTime += deltaTime;
      const idleFrameDuration = 1 / (currentFps * 0.5); // Slower for subtle breathing
      if (state.idleFrameTime >= idleFrameDuration) {
        state.idleFrameTime -= idleFrameDuration;
        state.idleFrameIndex = (state.idleFrameIndex + 1) % idleImages.length;
      }
    }

    // Dodge animation - plays once then ends
    if (state.isDodging && dodgeImages.length > 0 && !state.isAttacking) {
      state.dodgeElapsed += deltaTime;
      state.dodgeFrameTime += deltaTime;
      const dodgeFrameDuration = DODGE_DURATION / dodgeImages.length;
      if (state.dodgeFrameTime >= dodgeFrameDuration) {
        state.dodgeFrameTime -= dodgeFrameDuration;
        state.dodgeFrameIndex = Math.min(state.dodgeFrameIndex + 1, dodgeImages.length - 1);
      }
      if (state.dodgeElapsed >= DODGE_DURATION) {
        state.isDodging = false;
        state.dodgeFrameIndex = 0;
        state.dodgeFrameTime = 0;
        state.dodgeElapsed = 0;
      }
    }

    // Attack animation - plays once then stops, using delta time for frame-rate independence
    if (state.isAttacking && attackImages.length > 0) {
      state.attackFrameTime += deltaTime;
      const attackFrameDuration = 1 / (currentFps * 1.2); // Slightly faster for attack
      if (state.attackFrameTime >= attackFrameDuration) {
        state.attackFrameTime -= attackFrameDuration;
        state.attackFrameIndex++;
        
        // Attack finished
        if (state.attackFrameIndex >= attackImages.length) {
          state.isAttacking = false;
          state.attackFrameIndex = 0;
          state.attackFrameTime = 0;
        }
      }
    }

    // KO animation - plays once then holds last frame
    if (state.isKo && koImages.length > 0) {
      state.koFrameTime += deltaTime;
      const koFrameDuration = 1 / (currentFps * 0.8);
      if (state.koFrameTime >= koFrameDuration) {
        state.koFrameTime -= koFrameDuration;
        if (state.koFrameIndex < koImages.length - 1) {
          state.koFrameIndex++;
        }
      }
    }

    // Damage animation - plays once then ends
    if (state.isDamaged && damageImages.length > 0) {
      state.damageFrameTime += deltaTime;
      const damageFrameDuration = 1 / (currentFps * 1.0);
      if (state.damageFrameTime >= damageFrameDuration) {
        state.damageFrameTime -= damageFrameDuration;
        state.damageFrameIndex++;
        if (state.damageFrameIndex >= damageImages.length) {
          state.isDamaged = false;
          state.damageFrameIndex = 0;
          state.damageFrameTime = 0;
        }
      }
    }

    // Victory animation - loops while held
    if (state.isVictory && victoryImages.length > 0) {
      state.victoryFrameTime += deltaTime;
      const victoryFrameDuration = 1 / (currentFps * 0.8);
      if (state.victoryFrameTime >= victoryFrameDuration) {
        state.victoryFrameTime -= victoryFrameDuration;
        state.victoryFrameIndex = (state.victoryFrameIndex + 1) % victoryImages.length;
      }
    }

    // Determine which sprite to draw (priority: ko > damage > victory > attack > dodge > walk > idle)
    let currentImg: HTMLImageElement | null = null;
    let currentFrameData: Frame | null = null;

    const walkFrameData = walkFrameDataRef.current;
    const dodgeFrameData = dodgeFrameDataRef.current;
    const attackFrameData = attackFrameDataRef.current;
    const idleFrameData = idleFrameDataRef.current;
    const koFrameData = koFrameDataRef.current;
    const damageFrameData = damageFrameDataRef.current;
    const victoryFrameData = victoryFrameDataRef.current;

    if (state.isKo && koImages.length > 0) {
      const idx = Math.min(state.koFrameIndex, koImages.length - 1);
      currentImg = koImages[idx];
      currentFrameData = koFrameData[idx] || null;
    } else if (state.isDamaged && damageImages.length > 0) {
      const idx = Math.min(state.damageFrameIndex, damageImages.length - 1);
      currentImg = damageImages[idx];
      currentFrameData = damageFrameData[idx] || null;
    } else if (state.isVictory && victoryImages.length > 0) {
      currentImg = victoryImages[state.victoryFrameIndex];
      currentFrameData = victoryFrameData[state.victoryFrameIndex] || null;
    } else if (state.isAttacking && attackImages.length > 0) {
      const idx = Math.min(state.attackFrameIndex, attackImages.length - 1);
      currentImg = attackImages[idx];
      currentFrameData = attackFrameData[idx] || null;
    } else if (state.isDodging && dodgeImages.length > 0) {
      currentImg = dodgeImages[state.dodgeFrameIndex];
      currentFrameData = dodgeFrameData[state.dodgeFrameIndex] || null;
    } else if (state.isWalking && walkImages.length > 0) {
      currentImg = walkImages[state.walkFrameIndex];
      currentFrameData = walkFrameData[state.walkFrameIndex] || null;
    } else if (idleImages.length > 0) {
      currentImg = idleImages[state.idleFrameIndex];
      currentFrameData = idleFrameData[state.idleFrameIndex] || null;
    } else if (walkImages.length > 0) {
      currentImg = walkImages[0];
      currentFrameData = walkFrameData[0] || null;
    }

    // Draw character
    if (currentImg && currentFrameData) {
      const targetContentHeight = 80; // Target height for the actual character content
      
      // Get reference content height from first walk frame
      const referenceFrameData = walkFrameData.length > 0 ? walkFrameData[0] : currentFrameData;
      const referenceContentHeight = referenceFrameData.contentBounds.height;
      
      // Scale based on actual character content, not frame dimensions
      const baseScale = targetContentHeight / referenceContentHeight;
      
      const scale = baseScale;
      
      const drawWidth = currentImg.width * scale;
      const drawHeight = currentImg.height * scale;
      
      // Calculate where the character's feet are within the current frame
      const contentBounds = currentFrameData.contentBounds;
      const feetY = (contentBounds.y + contentBounds.height) * scale; // Bottom of content in scaled coordinates
      
      // Only add bob when walking on ground
      // timeRef is now in seconds, so multiply by 18 (was 0.3 * 60fps) for same visual speed
      const bob = state.isWalking && !state.isDodging && !state.isAttacking ? Math.sin(timeRef.current * 18) * 2 : 0;
      
      // Position so feet are at GROUND_Y
      // drawY is top-left of the sprite, so: drawY + feetY = GROUND_Y
      const drawY = GROUND_Y - feetY + bob + state.y;
      
      // Center horizontally based on content center, not frame center
      const contentCenterX = (contentBounds.x + contentBounds.width / 2) * scale;
      const drawX = state.x - contentCenterX;

      // Shadow
      const shadowScale = Math.max(0.3, 1 + state.y / 100);
      ctx.fillStyle = `rgba(0, 0, 0, ${0.4 * shadowScale})`;
      ctx.beginPath();
      ctx.ellipse(state.x, GROUND_Y + 2, (contentBounds.width * scale / 3) * shadowScale, 6 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      if (state.direction === "left") {
        // Flip horizontally around the character's center
        ctx.translate(state.x * 2, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(currentImg, state.x - contentCenterX, drawY, drawWidth, drawHeight);
      } else {
        ctx.drawImage(currentImg, drawX, drawY, drawWidth, drawHeight);
      }
      ctx.restore();
    }

    // Vignette
    const vignette = ctx.createRadialGradient(
      WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_HEIGHT * 0.4,
      WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_HEIGHT
    );
    vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignette.addColorStop(1, "rgba(0, 0, 0, 0.35)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    animationRef.current = requestAnimationFrame(gameLoop);
  }, []);

  // Initialize
  useEffect(() => {
    if (!containerRef.current || walkFrames.length === 0) return;

    containerRef.current.innerHTML = "";
    
    const canvas = document.createElement("canvas");
    canvas.width = WORLD_WIDTH;
    canvas.height = WORLD_HEIGHT;
    canvas.style.display = "block";
    canvas.style.borderRadius = "8px";
    containerRef.current.appendChild(canvas);
    canvasRef.current = canvas;

    characterState.current.x = WORLD_WIDTH / 2;
    characterState.current.y = 0;
    characterState.current.isDodging = false;
    characterState.current.isAttacking = false;
    characterState.current.isKo = false;
    characterState.current.isDamaged = false;
    characterState.current.isVictory = false;
    cameraX.current = 0;
    lastTimeRef.current = performance.now(); // Reset time reference

    animationRef.current = requestAnimationFrame(gameLoop);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") {
        keysPressed.current.add("right");
      }
      if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") {
        keysPressed.current.add("left");
      }
      // Dodge on Shift - only if not already dodging or attacking
      if (e.key === "Shift" && !characterState.current.isDodging && !characterState.current.isAttacking) {
        characterState.current.isDodging = true;
        characterState.current.dodgeFrameIndex = 0;
        characterState.current.dodgeFrameTime = 0;
        characterState.current.dodgeElapsed = 0;
      }
      // Attack on J - only if not already attacking
      if ((e.key === "j" || e.key === "J") && !characterState.current.isAttacking && !characterState.current.isKo) {
        characterState.current.isAttacking = true;
        characterState.current.attackFrameIndex = 0;
        characterState.current.attackFrameTime = 0;
      }
      // KO on K - plays knockout, holds last frame until R to reset
      if ((e.key === "k" || e.key === "K") && !characterState.current.isKo) {
        characterState.current.isKo = true;
        characterState.current.koFrameIndex = 0;
        characterState.current.koFrameTime = 0;
        characterState.current.isDodging = false;
        characterState.current.isAttacking = false;
        characterState.current.isDamaged = false;
        characterState.current.isVictory = false;
      }
      // Reset from KO with R
      if ((e.key === "r" || e.key === "R") && characterState.current.isKo) {
        characterState.current.isKo = false;
        characterState.current.koFrameIndex = 0;
        characterState.current.koFrameTime = 0;
      }
      // Damage on G (get hit) - only if not KO
      if ((e.key === "g" || e.key === "G") && !characterState.current.isDamaged && !characterState.current.isKo) {
        characterState.current.isDamaged = true;
        characterState.current.damageFrameIndex = 0;
        characterState.current.damageFrameTime = 0;
      }
      // Victory on V - toggle
      if ((e.key === "v" || e.key === "V") && !characterState.current.isKo) {
        if (characterState.current.isVictory) {
          characterState.current.isVictory = false;
          characterState.current.victoryFrameIndex = 0;
          characterState.current.victoryFrameTime = 0;
        } else {
          characterState.current.isVictory = true;
          characterState.current.victoryFrameIndex = 0;
          characterState.current.victoryFrameTime = 0;
          characterState.current.isDodging = false;
          characterState.current.isAttacking = false;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") {
        keysPressed.current.delete("right");
      }
      if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") {
        keysPressed.current.delete("left");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      cancelAnimationFrame(animationRef.current);
    };
  }, [walkFrames, gameLoop]);

  return (
    <div className="pixi-sandbox-container">
      <div ref={containerRef} className="pixi-canvas-wrapper" />
    </div>
  );
}
