function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full = clean.length === 3
    ? clean.split("").map((c) => c + c).join("")
    : clean;
  const value = parseInt(full, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

function mix(hex: string, target: [number, number, number], amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex([
    r + (target[0] - r) * amount,
    g + (target[1] - g) * amount,
    b + (target[2] - b) * amount,
  ]);
}

/** A light tint of `hex` suitable for a card background — mixes toward white. */
export function tintColor(hex: string, amount = 0.85): string {
  return mix(hex, [255, 255, 255], amount);
}

/** A darkened shade of `hex` suitable for text on a tinted background — mixes toward black. */
export function shadeColor(hex: string, amount = 0.35): string {
  return mix(hex, [0, 0, 0], amount);
}

/**
 * The color(s) an event should be visually keyed by: each assignee's own
 * color so a card reads as "whose event is this" at a glance, falling back
 * to the event's own colorHex when nobody is assigned yet.
 */
export function eventAccentColors(event: { colorHex: string; assignees: { colorHex: string }[] }): string[] {
  return event.assignees.length > 0 ? event.assignees.map((a) => a.colorHex) : [event.colorHex];
}

/**
 * A CSS `background` value for a set of colors: a plain value for one color,
 * or a diagonal gradient blending all of them for multiple — so an event
 * shared by several people reads as "everyone's", not just the first one.
 */
export function colorBackground(colors: string[], transform: (hex: string) => string = (hex) => hex): string {
  if (colors.length === 1) return transform(colors[0]!);
  const stops = colors.map((c, i) => `${transform(c)} ${Math.round((i / (colors.length - 1)) * 100)}%`);
  return `linear-gradient(135deg, ${stops.join(", ")})`;
}
