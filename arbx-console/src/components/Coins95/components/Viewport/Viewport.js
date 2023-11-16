import React from 'react';
import styled from 'styled-components';
import useWindowSize from '../../hooks/useWindowSize';

const Viewport = styled.div`
  position: relative;
  left: 50%;
  top: 50%;

  transform: translate(-50%, -50%);
  height: ${({ maxHeight }) => maxHeight}px;
  width: ${({ maxWidth }) => maxWidth}px;

  @media only screen and (min-width: 450px) and (min-height: 600px) {
    height: 680px;
    width: 400px;

    &:before{
      border: 0px solid ${({ theme }) => theme.materialText};
    } // This is a hack to make the media query work,
    &:after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
    }
    &:before {
      box-sizing: content-box;
      height: 100%;
      width: 100%;
      border: 0px solid ${({ theme }) => theme.materialText};
    &:after {
      z-index: 99999;
      transform: translate(-50%, -50%);
      height: 852px;
      width: 461px;
    }
  }
  max-height: 100%;
  max-width: 100%;
  overflow: hidden;
  overflow: visible;
`;
const ViewportContent = styled.div`
  height: 100%;
  width: 100%;

  overflow: auto;
`;
const BottomCornersCover = styled.div`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 0;
  background: black;
  z-index: 999;
  height: 0;
  height: var(--safe-area-inset-bottom);
`;

export default ({ children, maxWidth = 450, maxHeight = 896 }) => {
  const [width, height] = useWindowSize();
  return width > maxWidth || height > maxHeight ? (
    <Viewport maxWidth={maxWidth} maxHeight={maxHeight} id="device">
      <ViewportContent>{children}</ViewportContent>
    </Viewport>
  ) : (
    <>
      {children}
      <BottomCornersCover />
    </>
  );
};
