import React, { useState } from 'react';
import styled, { css } from 'styled-components';
import { createDisabledTextStyles } from '../../utils';

import {
  Tab,
  Tabs,
  TabBody,
  Fieldset,
  Radio,
  Checkbox,
  Slider,
  Select,
  ColorInput,
  Desktop
} from 'react95';

import Fullpage from '../../components/Fullpage/Fullpage';

import useLockBodyScroll from '../../hooks/useLockBodyScroll';

const Layout = ({
  theme,
  setTheme,
  scanLines,
  toggleScanLines,
  scanLinesIntensity,
  setScanLinesIntensity,
  background,
  backgrounds,
  setBackground,
  setCustomBackground,
  vintageFont,
  toggleVintageFont,
  fontSize,
  setFontSize
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const handleChange = (e, value) => setActiveTab(value);
  useLockBodyScroll();
  return (
    <Fullpage style={{ paddingTop: '0.5rem' }}>
      <div>
        <SField>
          <Fieldset label="Theme:">
            <Radio
              value="original"
              onChange={() => setTheme('original')}
              checked={theme === 'original'}
              label="original"
            />
            <br />
            <Radio
              value="rose"
              onChange={() => setTheme('rose')}
              checked={theme === 'rose'}
              label="🌹 Rose"
            />
            <br />
            <Radio
              value="rainyDay"
              onChange={() => setTheme('rainyDay')}
              checked={theme === 'rainyDay'}
              label="☔️ Rainy Day"
            />
            <br />
            <Radio
              value="travel"
              onChange={() => setTheme('travel')}
              checked={theme === 'travel'}
              label="🧳 Travel"
            />
            <br />
            <Radio
              value="marine"
              onChange={() => setTheme('marine')}
              checked={theme === 'marine'}
              label="🛳 Marine"
            />
            <br />
            <Radio
              value="olive"
              onChange={() => setTheme('olive')}
              checked={theme === 'olive'}
              label="🍸 Olive"
            />
            <br />
            <Radio
              value="theSixtiesUSA"
              onChange={() => setTheme('theSixtiesUSA')}
              checked={theme === 'theSixtiesUSA'}
              label="🌷 The 60's USA"
            />
            <br />
            <Radio
              value="candy"
              onChange={() => setTheme('candy')}
              checked={theme === 'candy'}
              label="🍭 Candy"
            />
            <br />
            <Radio
              value="tokyoDark"
              onChange={() => setTheme('tokyoDark')}
              checked={theme === 'tokyoDark'}
              label="📟 Tokyo Dark"
            />
            <br />
            <Radio
              value="vaporTeal"
              onChange={() => setTheme('vaporTeal')}
              checked={theme === 'vaporTeal'}
              label="💨 Vapor Teal"
            />
          </Fieldset>
        </SField>
      </div>
    </Fullpage>
  );
};

export default Layout;

// const Text = styled.div`
//   line-height: 1.5;
// `;

const CustomColorField = styled.div`
  float: right;
  margin-right: 0px;
  margin-top: 1rem;
  display: flex;
  align-items: center;
  label {
    font-size: 1rem;
    padding-right: 1rem;
    ${({ isDisabled }) =>
      isDisabled &&
      css`
        ${createDisabledTextStyles()}
      `}
  }
`;

const SField = styled.div`
  margin-bottom: 30px;
`;

const SliderLabel = styled.label`
  display: inline-block
  margin-bottom: 0.5rem;
  margin-left: -1rem;
  ${({ isDisabled }) =>
    isDisabled &&
    css`
      ${createDisabledTextStyles()}
    `}
`;
const Pad = styled.div`
  padding: 8px 16px;
`;

const CenteredDesktop = styled(Desktop)`
  position: relative;
  left: 50%;
  transform: translateX(-50%);
`;
