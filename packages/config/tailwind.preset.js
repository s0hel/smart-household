/** Shared Tailwind design tokens for the household display, mobile, and web layouts. */
module.exports = {
  theme: {
    extend: {
      colors: {
        household: {
          blue: "#3B82F6",
          green: "#22C55E",
          purple: "#A855F7",
          orange: "#F97316",
          pink: "#EC4899",
          teal: "#14B8A6",
          red: "#EF4444",
          yellow: "#EAB308",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
};
