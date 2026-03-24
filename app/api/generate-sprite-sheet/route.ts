import { fal } from "@fal-ai/client";
import { NextRequest, NextResponse } from "next/server";

// Configure fal client with API key from environment
fal.config({
  credentials: process.env.FAL_KEY,
});

const WALK_SPRITE_PROMPT = `Create a 4-frame pixel art walk cycle sprite sheet of this character.

Arrange the 4 frames in a 2x2 grid on white background. The character is walking to the right.

Top row (frames 1-2):
Frame 1 (top-left): Right leg forward, left leg back - stride position
Frame 2 (top-right): Legs close together, passing/crossing - transition

Bottom row (frames 3-4):
Frame 3 (bottom-left): Left leg forward, right leg back - opposite stride
Frame 4 (bottom-right): Legs close together, passing/crossing - transition back

Each frame shows a different phase of the walking motion. This creates a smooth looping walk cycle.

Use detailed 32-bit pixel art style with proper shading and highlights. Same character design in all frames. Character facing right.`;

const DODGE_SPRITE_PROMPT = `Create a 4-frame pixel art dodge animation sprite sheet of this character.

Arrange the 4 frames in a 2x2 grid on white background. The character performs a quick in-place dodge to evade an incoming hit — no rolling or dashing forward, just a sharp reactive body movement while staying roughly in the same spot.

Top row (frames 1-2):
Frame 1 (top-left): Reaction - character starts to recoil, eyes wide, knees slightly bending
Frame 2 (top-right): Dodge peak - body sharply leaning or ducking to one side, head low, weight shifted to avoid the hit

Bottom row (frames 3-4):
Frame 3 (bottom-left): Hold - character stays low/aside at the dodge position for a beat
Frame 4 (bottom-right): Recovery - straightening back up, returning to ready stance

Keep the character in roughly the same horizontal position throughout — this is a reactive evasion, not a dash. Use detailed 32-bit pixel art style with proper shading and highlights. Same character design in all frames. Character facing right.`;

const ATTACK_SPRITE_PROMPT = `Create a 4-frame pixel art attack animation sprite sheet of this character.

Arrange the 4 frames in a 2x2 grid on white background. The character is performing an attack that fits their design - could be a sword slash, magic spell, punch, kick, or energy blast depending on what suits the character best.

Top row (frames 1-2):
Frame 1 (top-left): Wind-up/anticipation - character preparing to attack, pulling back weapon or gathering energy
Frame 2 (top-right): Attack in motion - the strike or spell being unleashed

Bottom row (frames 3-4):
Frame 3 (bottom-left): Impact/peak - maximum extension of attack, weapon fully swung or spell at full power
Frame 4 (bottom-right): Recovery - returning to ready stance

Use detailed 32-bit pixel art style with proper shading and highlights. Same character design in all frames. Character facing right. Make the attack visually dynamic and exciting.`;

const KO_SPRITE_PROMPT = `Create a 4-frame pixel art knockout/death animation sprite sheet of this character.

Arrange the 4 frames in a 2x2 grid on white background. The character has been defeated and is falling down.

Top row (frames 1-2):
Frame 1 (top-left): Hit reaction - character recoils from a final blow, eyes shut, body jerking back
Frame 2 (top-right): Falling - character losing balance, tilting backward or sideways, limbs going limp

Bottom row (frames 3-4):
Frame 3 (bottom-left): Collapse - character nearly on the ground, body crumpling
Frame 4 (bottom-right): Down - character flat on the ground, knocked out, motionless

Use detailed 32-bit pixel art style with proper shading and highlights. Same character design in all frames. Character facing right. Make the defeat feel dramatic.`;

const DAMAGE_SPRITE_PROMPT = `Create a 4-frame pixel art damage/hit reaction animation sprite sheet of this character.

Arrange the 4 frames in a 2x2 grid on white background. The character is getting hit and reacting to damage but NOT knocked out — they recover.

Top row (frames 1-2):
Frame 1 (top-left): Impact - character gets struck, body flinches, flash of pain
Frame 2 (top-right): Recoil - character staggers back slightly, hurt expression, eyes squinting

Bottom row (frames 3-4):
Frame 3 (bottom-left): Stagger - character still off-balance, hand on wound or bracing
Frame 4 (bottom-right): Recovery - character shakes it off, returning to ready fighting stance

Use detailed 32-bit pixel art style with proper shading and highlights. Same character design in all frames. Character facing right. Show clear pain but resilience.`;

const VICTORY_SPRITE_PROMPT = `Create a 4-frame pixel art victory celebration animation sprite sheet of this character.

Arrange the 4 frames in a 2x2 grid on white background. The character has won the fight and is celebrating.

Top row (frames 1-2):
Frame 1 (top-left): Triumph start - character raises fist or weapon overhead, victorious expression
Frame 2 (top-right): Celebration peak - full celebration pose, jumping or pumping fist, big smile or battle cry

Bottom row (frames 3-4):
Frame 3 (bottom-left): Showoff - character flexes, poses proudly, or does a signature taunt
Frame 4 (bottom-right): Cool down - character settles into a confident standing pose, still looking victorious

Use detailed 32-bit pixel art style with proper shading and highlights. Same character design in all frames. Character facing right. Make the celebration feel earned and energetic.`;

const IDLE_SPRITE_PROMPT = `Create a 4-frame pixel art idle/breathing animation sprite sheet of this character.

Arrange the 4 frames in a 2x2 grid on white background. The character is standing still but with subtle idle animation.

Top row (frames 1-2):
Frame 1 (top-left): Neutral standing pose - relaxed stance
Frame 2 (top-right): Slight inhale - chest/body rises subtly, maybe slight arm movement

Bottom row (frames 3-4):
Frame 3 (bottom-left): Full breath - slight upward posture
Frame 4 (bottom-right): Exhale - returning to neutral, slight settle

Keep movements SUBTLE - this is a gentle breathing/idle loop, not dramatic motion. Character should look alive but relaxed.

Use detailed 32-bit pixel art style with proper shading and highlights. Same character design in all frames. Character facing right.`;

type SpriteType = "walk" | "dodge" | "attack" | "idle" | "ko" | "damage" | "victory";

const PROMPTS: Record<SpriteType, string> = {
  walk: WALK_SPRITE_PROMPT,
  dodge: DODGE_SPRITE_PROMPT,
  attack: ATTACK_SPRITE_PROMPT,
  idle: IDLE_SPRITE_PROMPT,
  ko: KO_SPRITE_PROMPT,
  damage: DAMAGE_SPRITE_PROMPT,
  victory: VICTORY_SPRITE_PROMPT,
};

const ASPECT_RATIOS: Record<SpriteType, string> = {
  walk: "1:1",
  dodge: "1:1",
  attack: "1:1",
  idle: "1:1",
  ko: "1:1",
  damage: "1:1",
  victory: "1:1",
};

export async function POST(request: NextRequest) {
  try {
    const { characterImageUrl, type = "walk", customPrompt } = await request.json();

    if (!characterImageUrl) {
      return NextResponse.json(
        { error: "Character image URL is required" },
        { status: 400 }
      );
    }

    const spriteType = (type as SpriteType) || "walk";
    const prompt = customPrompt || PROMPTS[spriteType] || PROMPTS.walk;
    const aspectRatio = ASPECT_RATIOS[spriteType] || ASPECT_RATIOS.walk;

    const result = await fal.subscribe("fal-ai/nano-banana-pro/edit", {
      input: {
        prompt,
        image_urls: [characterImageUrl],
        num_images: 1,
        aspect_ratio: aspectRatio,
        output_format: "png",
        resolution: "1K",
      },
    });

    const data = result.data as {
      images: Array<{ url: string; width: number; height: number }>;
    };

    if (!data.images || data.images.length === 0) {
      return NextResponse.json(
        { error: "No sprite sheet generated" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      imageUrl: data.images[0].url,
      width: data.images[0].width,
      height: data.images[0].height,
      type: spriteType,
    });
  } catch (error) {
    console.error("Error generating sprite sheet:", error);
    return NextResponse.json(
      { error: "Failed to generate sprite sheet" },
      { status: 500 }
    );
  }
}
