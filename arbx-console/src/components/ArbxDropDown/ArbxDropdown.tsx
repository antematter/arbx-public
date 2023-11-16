import React from 'react';
import { useState, FC } from 'react';
import { ArbxDropdownProps } from './ArbxDropDown.type';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';

const ArbxDropdown: FC<ArbxDropdownProps> = ({ height, width, options, onChange }) => {
  const [currentValue, setCurrentValue] = useState(options[0]);

  return (
    <div className="flex flex-col ">
      <div className="flex">
        <form className={' ' + width}>
          <Select
            className={
              ' flex bg-white border-1  border-2 border-t-[#2c2b2b] border-l-[#353434] rounded-none text-black ' +
              width +
              ' ' +
              height
            }
            variant="standard"
            disableUnderline
            onChange={(event: SelectChangeEvent) => {
              setCurrentValue(event.target.value);
              onChange(event.target.value);
            }}
            value={currentValue}>
            {options.map((option) => (
              <MenuItem className="bg-white" key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </Select>
        </form>
      </div>
    </div>
  );
};

export default ArbxDropdown;
