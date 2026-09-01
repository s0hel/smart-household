/**
 * Shared Tailwind design tokens for the household display, mobile, and web layouts.
 *
 * Theme: "Sapphire Standard" — a bold sapphire-and-gold identity on a white/ivory
 * ground. `sapphire` is the brand field/identity color, `gold` is the accent used
 * for trim, points, and rewards, `ink` replaces plain gray with a navy-tinted
 * neutral scale so text keeps a hint of the sapphire hue even at low saturation.
 * `household` is the distinct-person/category palette (jewel tones, chosen so
 * each also works as body text color on white — see PersonBadge).
 */
module.exports = {
  theme: {
    extend: {
      colors: {
        paper: "#FCFBF7",
        sapphire: {
          50: "#EEF3FA",
          100: "#DCE7F4",
          200: "#B7CCE8",
          300: "#8FADD9",
          400: "#5C82BE",
          500: "#33578F",
          600: "#1B3A6B",
          700: "#15305A",
          800: "#0F2440",
          900: "#0B1B30",
        },
        gold: {
          50: "#FBF6E7",
          100: "#F5EAC2",
          200: "#EAD68A",
          300: "#DFC257",
          400: "#D4AF37",
          500: "#B8952E",
          600: "#A8842A",
          700: "#8A6A1E",
          800: "#6B5218",
        },
        ink: {
          50: "#F5F6F8",
          100: "#E8EAEE",
          200: "#D3D7DF",
          300: "#AEB5C2",
          400: "#7C859A",
          500: "#5A6478",
          600: "#3F495C",
          700: "#2C3446",
          800: "#1B2333",
          900: "#0F1420",
        },
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
