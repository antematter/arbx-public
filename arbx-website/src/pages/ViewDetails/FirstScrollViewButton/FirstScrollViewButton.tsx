import { motion } from "framer-motion";
import { FC, useState } from "react";
import { FirstScrollViewButtonProps } from "./FirstScrollViewButton.type";
import {
  WhiteUpArrow,
  WhiteDownArrow,
  LightWhiteDownArrow,
  LightWhiteUpArrow,
} from "../../../data/svgs";

const FirstScrollViewButton: FC<FirstScrollViewButtonProps> = ({
  onClick,
  direction,
}) => {
  const [ScrollToFirstHoverd, setScrollToFirstHoverd] = useState(false);
  return (
    <motion.button
      onMouseEnter={() => {
        console.log("direction", direction);
        setScrollToFirstHoverd(true);
      }}
      onMouseLeave={() => {
        setScrollToFirstHoverd(false);
      }}
      onClick={onClick}
      className={
        "fixed z-10  left-[6rem] bottom-[7.5rem]  bg-transparent" +
        " " +
        (ScrollToFirstHoverd ? "text-white" : "text-secondary")
      }
    >
      <div className="flex gap-2 items-center">
        <div className="h-[1rem]">
          {direction === "down" ? (
            ScrollToFirstHoverd ? (
              <WhiteDownArrow />
            ) : (
              <LightWhiteDownArrow />
            )
          ) : ScrollToFirstHoverd ? (
            <WhiteUpArrow />
          ) : (
            <LightWhiteUpArrow />
          )}
        </div>
        <p>SCROLL</p>
      </div>
    </motion.button>
  );
};

export default FirstScrollViewButton;
