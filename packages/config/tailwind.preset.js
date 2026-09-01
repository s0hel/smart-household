/**
 * Shared Tailwind design tokens for the household display, mobile, and web layouts.
 *
 * Theme: "Sapphire Standard" — a bold sapphire-and-gold identity on a white/ivory
 * ground. `sapphire` is the brand field/identity color, `gold` is the accent used
 * for trim, points, and rewards, `ink` replaces plain gray with a navy-tinted
 * neutral scale so text keeps a hint of the sapphire hue even at low saturation.
 * `household` is the distinct-person/category palette (jewel tones, chosen so
 * each also works as body text color on white — see PersonBadge).
 *
 * `paper`, `surface`, `ink`, `sapphire`, and `gold` are backed by CSS custom
 * properties (see apps/app/src/app/globals.css) so the same utility classes
 * (bg-paper, text-ink-900, bg-sapphire-600, ...) resolve to different actual
 * colors depending on the `data-theme` attribute set by the theme switcher —
 * no `dark:` variants needed anywhere in component code. `household` is left
 * as plain hex and intentionally NOT themed: per-person badge colors are an
 * identity, not a surface color, and should stay recognizable across themes.
 */
function withOpacity(variableName) {
  return `rgb(var(${variableName}) / <alpha-value>)`;
}

function themedScale(prefix, shades) {
  return Object.fromEntries(shades.map((shade) => [shade, withOpacity(`--color-${prefix}-${shade}`)]));
}

module.exports = {
  theme: {
    extend: {
      colors: {
        paper: withOpacity("--color-paper"),
        surface: withOpacity("--color-surface"),
        sapphire: themedScale("sapphire", [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]),
        gold: themedScale("gold", [50, 100, 200, 300, 400, 500, 600, 700, 800]),
        ink: themedScale("ink", [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]),
        household: {
          blue: "#2851A3",
          green: "#1F6F5C",
          purple: "#6B3FA0",
          orange: "#B5541F",
          pink: "#9B2242",
          teal: "#0E7C86",
          red: "#8C2F39",
          yellow: "#A8842A",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      keyframes: {
        "task-burst": {
          "0%": { transform: "translate(-50%, -50%) scale(0.4)", opacity: "1" },
          "60%": { opacity: "1" },
          "100%": {
            transform:
              "translate(calc(-50% + var(--burst-x, 0px)), calc(-50% + var(--burst-y, 0px))) scale(1.1)",
            opacity: "0",
          },
        },
      },
      animation: {
        "task-burst": "task-burst 700ms ease-out forwards",
      },
    },
  },
};
