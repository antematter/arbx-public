import { useState } from "react";
import { FC } from "react";
import { ArbxTitleProps } from "./ArbxTitleProps";
import { useNavigate } from "react-router-dom";

const ArbxTitle: FC<ArbxTitleProps> = () => {
  const navigateTo = useNavigate();
  const [hover, setHover] = useState(false);
  return (
    <button
      className="flex gap-1.5 justify-start items-center w-fit"
      onMouseEnter={() => {
        setHover(true);
      }}
      onMouseLeave={() => {
        setHover(false);
      }}
      onClick={() => {
        navigateTo("/");
      }}
    >
      <img
        className=" h-[1.2rem] w-[1.2rem]"
        src={require("../../data/images/arbxLogo.png")}
        alt="arbx logo"
      />
      <img
        className=" h-[1rem] w-[4rem]"
        src={
          hover
            ? require("../../data/images/arbxTextHighlight.png")
            : require("../../data/images/arbxText.png")
        }
        alt="arbx text"
      />
    </button>
  );
};

export default ArbxTitle;
