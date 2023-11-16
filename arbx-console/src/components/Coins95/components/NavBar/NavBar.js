import React from 'react';
import { withRouter } from 'react-router-dom';

import styled from 'styled-components';

import { AppBar, Button, Toolbar } from 'react95';

import GearsIcon from '../../assets/img/emblem-system.png';
import WorldIcon from '../../assets/img/worldIcon.png';
import UserIcon from '../../assets/img/avatar-default.png';
import HomeIcon from '../../assets/img/homeIcon.png';

const NavBar = (props) => {
  const currentLocation = props.location.pathname;
  return (
    <Nav fixed>
      <SToolbar>
        <SwitchButton
          active={currentLocation.startsWith('/market-watch/coins')}
          onClick={() => props.history.push('/market-watch/coins')}
          fullWidth
          size="lg">
          <Icon
            active={currentLocation.startsWith('/market-watch/coins')}
            src={HomeIcon}
            alt="icon"
          />
        </SwitchButton>
        <SwitchButton
          active={currentLocation.startsWith('/market-watch/wallet')}
          onClick={() => props.history.push('/market-watch/wallet')}
          fullWidth
          size="lg">
          <Icon
            style={{ height: 21, opacity: 0.9 }}
            active={currentLocation.startsWith('/market-watch/wallet')}
            src={UserIcon}
            alt="icon"
          />
        </SwitchButton>
        <SwitchButton
          active={currentLocation.startsWith('/market-watch/news')}
          onClick={() => props.history.push('/market-watch/news')}
          fullWidth
          size="lg">
          <Icon
            active={currentLocation.startsWith('/market-watch/news')}
            src={WorldIcon}
            alt="icon"
          />
        </SwitchButton>
      </SToolbar>
    </Nav>
  );
};

export default withRouter(NavBar);

const Nav = styled(AppBar)`
  top: auto;
  bottom: 0;
  z-index: 2;
  bottom: var(--safe-area-inset-bottom);
`;
const Icon = styled.img`
  /* image-rendering: pixelated; */
  filter: grayscale(1);
  height: 24px;
`;

const SwitchButton = styled(Button)`
  margin: 0 1px;
`;
const SToolbar = styled(Toolbar)`
  margin: 0 -1px;
`;
