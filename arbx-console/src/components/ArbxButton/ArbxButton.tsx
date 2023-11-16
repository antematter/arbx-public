import React from 'react';
import { FC, useState, useEffect } from 'react';
import { ArbxButtonProps } from './ArbxButton.type';

const ArbxButton: FC<ArbxButtonProps> = ({ text, focused, onClick, textColor }) => {
  const [focusStyle, setfocusStyle] = useState(focused ? focused : false);

  useEffect(() => {
    setfocusStyle(focused);
  }, [focused]);
  return (
    <button
      className={
        'bg-mono-100  text-sm flex justify-center items-center h-[2rem] w-[8rem] ' +
        (focusStyle
          ? ' bg-arbxButtonBlue text-white '
          : 'bg-mono-100 shadow-arbxButton ' +
            (textColor &&
              (textColor === 'green'
                ? 'text-green-700'
                : textColor === 'red'
                ? 'text-red-700'
                : 'text-black')))
      }
      onClick={() => {
        onClick();
      }}>
      <p>{text}</p>
    </button>
  );
};

export default ArbxButton;
