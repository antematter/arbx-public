/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#FFFFFF",
        secondary: "#828282",
        errorState: "#CC0000",
        Black: "#000000",
        unfocused: "rgba(0, 0, 0, 0.6)",
        viewHoverd: " #FFEF82",
        gradient:
          "linear-gradient(91.61deg, #FFC414 -6.28%, #FF2B2B 16.16%, #FF0C67 31.33%, #FF65EB 57.06%, #62BCFF 78.17%, #41FFFC 99.28%, #52FF65 119.73%);",
      },
      fontFamily: {
        roobert: ["Roobert", "sans-serif"],
        roobertRegular: ["Roobert-Regular", "sans-serif"],
      },
    },
  },
  plugins: [],
};
