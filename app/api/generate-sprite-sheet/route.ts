import { fal } from "@fal-ai/client";
import { NextRequest, NextResponse } from "next/server";

// Configure fal client with API key from environment
fal.config({
  credentials: process.env.FAL_KEY,
});

const WALK_SPRITE_PROMPT = `Create a 4-frame pixel art walk cycle sprite sheet of this character.

Arrange the 4 frames in a 2x2 grid on white background. The character is walking to the right. This is a FULL walk cycle showing BOTH legs alternating steps.

Top row (frames 1-2):
Frame 1 (top-left): RIGHT foot stepping forward, left foot behind - first stride
Frame 2 (top-right): Both feet passing each other mid-step, weight centered - first transition

Bottom row (frames 3-4):
Frame 3 (bottom-left): LEFT foot stepping forward, right foot behind - second stride (mirror of frame 1)
Frame 4 (bottom-right): Both feet passing each other mid-step, weight centered - second transition (mirror of frame 2)

IMPORTANT: Frames 1 and 3 must show OPPOSITE legs forward — this creates a proper two-step walk cycle, not a single repeated step. The loop goes: right step → pass → left step → pass → repeat.

CRITICAL: The character must look EXACTLY like the reference image — same body proportions, same face, same size, same outfit, same colors. Do NOT change the character's build, musculature, or any physical features. Only the leg positions change.

Use detailed 32-bit pixel art style with proper shading and highlights. Character facing right.`;

const DODGE_SPRITE_PROMPT = `Create a 4-frame pixel art dodge animation sprite sheet of this character.

Arrange the 4 frames in a 2x2 grid on white background. The character performs a quick in-place dodge to evade an incoming hit — no rolling or dashing forward, just a sharp reactive body movement while staying roughly in the same spot.

Top row (frames 1-2):
Frame 1 (top-left): Reaction - character starts to recoil, eyes wide, knees slightly bending
Frame 2 (top-right): Dodge peak - body sharply leaning or ducking to one side, head low, weight shifted to avoid the hit

Bottom row (frames 3-4):
Frame 3 (bottom-left): Hold - character stays low/aside at the dodge position for a beat
Frame 4 (bottom-right): Recovery - straightening back up, returning to ready stance

Keep the character in roughly the same horizontal position throughout — this is a reactive evasion, not a dash.

CRITICAL: The character must look EXACTLY like the reference image — same body proportions, same face, same size, same outfit, same colors. Do NOT alter the character's build or facial features. Only the body pose changes.

Use detailed 32-bit pixel art style with proper shading and highlights. Character facing right.`;

const ATTACK_SPRITE_PROMPT = `Create a 4-frame pixel art claw swipe attack animation sprite sheet of this character.

Arrange the 4 frames in a 2x2 grid on white background. The character is performing a fierce claw slash/swipe attack — NOT a punch, NOT a kick. The attack is a wild, aggressive claw strike with visible claw marks or slash trails.

Top row (frames 1-2):
Frame 1 (top-left): Wind-up - character raises arm/paw with claws extended, pulling back for the swipe
Frame 2 (top-right): Swipe in motion - arm slashing forward diagonally, claw trails visible

Bottom row (frames 3-4):
Frame 3 (bottom-left): Impact - claws at full extension, slash effect or claw marks visible in the air
Frame 4 (bottom-right): Recovery - arm returning, settling back into ready stance

CRITICAL: The character must look EXACTLY like the reference image — same body proportions, same size, same face, same outfit, same colors. Do NOT make the character more muscular, larger, buffer, or change their physique in any way. The character's body build must remain IDENTICAL to the original. Only the pose and arm positions change for the claw swipe.

Use detailed 32-bit pixel art style with proper shading and highlights. Character facing right.`;

const KO_SPRITE_PROMPT = `Create a 4-frame pixel art knockout/death animation sprite sheet of this character.

Arrange the 4 frames in a 2x2 grid on white background. The character has been defeated and is falling down.

Top row (frames 1-2):
Frame 1 (top-left): Hit reaction - character recoils from a final blow, eyes shut, body jerking back
Frame 2 (top-right): Falling - character losing balance, tilting backward or sideways, limbs going limp

Bottom row (frames 3-4):
Frame 3 (bottom-left): Collapse - character nearly on the ground, body crumpling
Frame 4 (bottom-right): Down - character flat on the ground, knocked out, motionless

CRITICAL: The character must look EXACTLY like the reference image — same body proportions, same face, same size, same outfit, same colors. Do NOT alter the character's build or facial features. Only the body pose changes.

Use detailed 32-bit pixel art style with proper shading and highlights. Character facing right.`;

const DAMAGE_SPRITE_PROMPT = `Create a 4-frame pixel art damage/hit reaction animation sprite sheet of this character.

Arrange the 4 frames in a 2x2 grid on white background. The character is getting hit and reacting to damage but NOT knocked out — they recover.

Top row (frames 1-2):
Frame 1 (top-left): Impact - character gets struck, body flinches, flash of pain
Frame 2 (top-right): Recoil - character staggers back slightly, hurt expression, eyes squinting

Bottom row (frames 3-4):
Frame 3 (bottom-left): Stagger - character still off-balance, hand on wound or bracing
Frame 4 (bottom-right): Recovery - character shakes it off, returning to ready fighting stance

CRITICAL: The character must look EXACTLY like the reference image — same body proportions, same face, same size, same outfit, same colors. Do NOT alter the character's build or facial features. Only the body pose changes.

Use detailed 32-bit pixel art style with proper shading and highlights. Character facing right.`;

const VICTORY_SPRITE_PROMPT = `Create a 4-frame pixel art victory animation sprite sheet of this character.

Arrange the 4 frames in a 2x2 grid on white background. The character has won the fight and shows a victory pose.

Top row (frames 1-2):
Frame 1 (top-left): Triumph start - character raises fist or weapon overhead
Frame 2 (top-right): Victory pose peak - full power pose, fist pumped or weapon raised high

Bottom row (frames 3-4):
Frame 3 (bottom-left): Confident stance - character stands tall, arms crossed or weapon resting on shoulder
Frame 4 (bottom-right): Return to ready stance, still looking dominant

CRITICAL: The character must look EXACTLY like the reference image — same body proportions, same size, same outfit, same colors. The facial FEATURES (eye shape, face shape, nose, mouth structure, scars, markings) must remain IDENTICAL to the original. The expression CAN change to fit the victory mood (e.g. a grin, a smirk), but the underlying face structure and features must not change. Do NOT redesign the face.

Use detailed 32-bit pixel art style with proper shading and highlights. Character facing right.`;

const IDLE_SPRITE_PROMPT = `Create a 4-frame pixel art idle/breathing animation sprite sheet of this character.

Arrange the 4 frames in a 2x2 grid on white background. The character is standing still but with subtle idle animation.

Top row (frames 1-2):
Frame 1 (top-left): Neutral standing pose - relaxed stance
Frame 2 (top-right): Slight inhale - chest/body rises subtly, maybe slight arm movement

Bottom row (frames 3-4):
Frame 3 (bottom-left): Full breath - slight upward posture
Frame 4 (bottom-right): Exhale - returning to neutral, slight settle

Keep movements SUBTLE - this is a gentle breathing/idle loop, not dramatic motion. Character should look alive but relaxed.

CRITICAL: The character must look EXACTLY like the reference image — same body proportions, same face, same size, same outfit, same colors. Do NOT alter the character's build or facial features.

Use detailed 32-bit pixel art style with proper shading and highlights. Character facing right.`;

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
