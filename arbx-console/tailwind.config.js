const { fontSize } = require('@xstyled/styled-components');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        inputBoxBorderTop: '#2c2b2b',
        inputBoxBorderLeft: '#353434',
        arbxButtonBlue: '#001CF5',
        arbxTextBlue: '#000EA3',
        arbxTextDarkGreen: '#008282',
        arbxTextLightGreen: '#26B50F',
        arbxAltRowColor: 'rgba(0, 28, 245, 0.05)',
        white: '#ffffff',
        arbxPurple: '#5400BE',
        gray91: '#E8E8E8'
      },
      boxShadow: {
        arbxButton:
          'inset -2px -2px 0px #262626, inset 2px 2px 0px #F0F0F0, inset -4px -4px 0px #7E7E7E, inset 4px 4px 0px #B1B1B1',
        arbxFrame:
          'inset 2px 2px 0px rgba(38, 38, 38, 0.5), inset -2px -2px 0px #F0F0F0, inset 4px 4px 0px #7E7E7E',
        arbxInputField:
          'inset 2px 2px 0px #262626, inset -2px -2px 0px #F0F0F0, inset 4px 4px 0px #7E7E7E',
        arbxBotInstance: '-1px -1px 0px 1px #7E7E7E, 1px 1px 0px 1px #FFFFFF'
      },
      fontSize: {
        xxs: '10px'
      },
      fontFamily: {
        W95FA: ['W95FA'],
        'Red-Thinker': ['Red Thinker']
      },
      backgroundImage: {
        wallPaper1: "url('../assets/images/windows95Wallpaper1_1920x1080.png')"
      }
    }
  },
  plugins: [require('tailwind-scrollbar-hide')]
};
