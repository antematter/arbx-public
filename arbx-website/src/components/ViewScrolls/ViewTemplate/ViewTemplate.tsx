import React from "react";
import { FC } from "react";
import { ViewTemplateProps } from "./ViewTemplateProps";
const ViewTemplate: FC<ViewTemplateProps> = ({
  text1,
  text2,
  text2Width,
  footer,
}) => {
  return (
    <div className="flex flex-col justify-center items-center gap-[5rem] bg-black">
      <div className="flex flex-col justify-center w-full  items-center gap-[1rem]">
        <p className=" flex justify-center text-7xl font-roobert w-[80vw]">
          {text1}
        </p>
        <p
          className={
            "flex justify-center break-normal font-light text-xl" +
            " " +
            (text2Width ? text2Width : "w-[47.5vw]")
          }
        >
          {text2}
        </p>
      </div>
      {footer}
    </div>
  );
};

export default ViewTemplate;
