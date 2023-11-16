import React from 'react';
import { Switch, Route } from 'react-router-dom';

import { connect, Provider } from 'react-redux';

import { createGlobalStyle, ThemeProvider, css } from 'styled-components';
import { styleReset } from 'react95';

import original from 'react95/dist/themes/original';
import rose from 'react95/dist/themes/rose';
import rainyDay from 'react95/dist/themes/rainyDay';
import travel from 'react95/dist/themes/travel';
import marine from 'react95/dist/themes/marine';
import olive from 'react95/dist/themes/olive';
import theSixtiesUSA from 'react95/dist/themes/theSixtiesUSA';
import candy from 'react95/dist/themes/candy';
import tokyoDark from 'react95/dist/themes/tokyoDark';
import vaporTeal from 'react95/dist/themes/vaporTeal';

import ms_sans_serif from 'react95/dist/fonts/ms_sans_serif.woff2';
import ms_sans_serif_bold from 'react95/dist/fonts/ms_sans_serif_bold.woff2';

import Dashboard from './views/Dashboard/Dashboard';
import CoinDetails from './views/CoinDetails/CoinDetails';
import CoinSearch from './views/CoinSearch/CoinSearch';
import Wallet from './views/Wallet/Wallet';
import News from './views/News/News';
import Settings from './views/Settings/Settings';
import Viewport from './components/Viewport/Viewport';
import NavBar from './components/NavBar/NavBar';

import store from './store';

const themes = {
  original,
  rose,
  rainyDay,
  travel,
  marine,
  olive,
  theSixtiesUSA,
  candy,
  tokyoDark,
  vaporTeal
};

export const ResetStyles = createGlobalStyle`
  body {
    color: ${({ theme }) => theme.materialText};
    --safe-area-inset-bottom: constant(safe-area-inset-bottom); 
    --safe-area-inset-bottom: env(safe-area-inset-bottom);
    &:before {
      content: '';
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: var(--safe-area-inset-bottom);
      background: black;
      z-index: 9999999;
    }
    ${({ scanLines, scanLinesIntensity }) =>
      scanLines &&
      css`
        &:after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          z-index: 99999;
          opacity: 0.7;
          filter: alpha(opacity=70);
          position: fixed;
          left: 0;
          top: 0;
          right: 0;
          bottom: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
          pointer-events: none;
          background-image: radial-gradient(
              ellipse at center,
              transparent 0,
              transparent 60%,
              rgba(0, 0, 0, ${(0.15 * scanLinesIntensity) / 100}) 100%
            ),
            repeating-linear-gradient(
              0deg,
              transparent,
              transparent 1px,
              rgba(0, 0, 0, ${(0.35 * scanLinesIntensity) / 100}) 3px
            );
          background-size: 100% 100%, 100% 6px;
          -webkit-animation: flicker 0.3s linear infinite;
          animation: flicker 0.3s linear infinite;
        }
      `} 
  }
  #background {
    position: fixed;
    z-index: -1;
    top: 0;
    bottom: 0;
    left:0;
    right: 0;
    height: 100vh;
    width: 100vw;
    background: ${({ background }) => background};
    background-attachment: fixed;
    background-repeat: repeat;
  }
  
  
  * {
    scrollbar-width: none
  }
  ::-webkit-scrollbar {
    width: 0px; /* Remove scrollbar space */
    background: transparent; /* Optional: just make scrollbar invisible */
  }
  /* Optional: show position indicator in red */
  ::-webkit-scrollbar-thumb {
    background: transparent;
  }
`;

class Coins95App extends React.Component {
  render() {
    const { theme, background, vintageFont, fontSize, scanLines, scanLinesIntensity } = this.props;
    return (
      <Viewport>
        <ThemeProvider theme={themes[theme]}>
          <>
            <ResetStyles
              vintageFont={vintageFont}
              fontSize={fontSize}
              scanLines={scanLines}
              scanLinesIntensity={scanLinesIntensity}
              background={background.value}
            />
            <Switch>
              <Route exact path={'/market-watch/coins/:coin'} component={null} />
              <Route exact path={'/market-watch/search'} component={null} />
              <NavBar />
            </Switch>
            <Switch>
              <Route exact path={'/market-watch/'} component={Dashboard} />
              <Route exact path={'/market-watch/coins'} component={Dashboard} />
              <Route exact path={'/market-watch/coins/:coin'} component={CoinDetails} />
              <Route exact path={'/market-watch/search'} component={CoinSearch} />
              <Route path={'/market-watch/wallet/'} component={Wallet} />
              <Route exact path={'/market-watch/news'} component={News} />
              <Route exact path={'/market-watch/settings'} component={Settings} />
            </Switch>
          </>
        </ThemeProvider>
      </Viewport>
    );
  }
}

const mapStateToProps = (state) => ({
  theme: state.user.theme,
  background: state.user.background,
  vintageFont: state.user.vintageFont,

  scanLines: state.user.scanLines,
  scanLinesIntensity: state.user.scanLinesIntensity
});

const Coins95Body = () => {
  const App = connect(mapStateToProps, null)(Coins95App);

  return (
    <Provider store={store}>
      <App />
    </Provider>
  );
};

export default Coins95Body;
