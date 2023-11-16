import ArbxTitle from "../ArbxTitle/ArbxTitle";

import { useState } from "react";

import { motion } from "framer-motion";
import { PageTemplateProps } from "./PageTemplateProps";

import { FC } from "react";

const PageTemplate: FC<PageTemplateProps> = ({
  children,

  onDownloadClick,
}) => {
  const [downloadHoverd, setDownloadHoverd] = useState(false);

  return (
    <div className="flex  h-100vh w-100vw   overflow-hidden bg-black ">
      <div
        className={
          " fixed flex flex-col justify-between h-screen w-screen pt-5 z-0 bg-black "
        }
      >
        <div className="flex w-full px-6  justify-between items-center">
          <ArbxTitle />
          <motion.button
            onMouseEnter={() => {
              setDownloadHoverd(true);
            }}
            onMouseLeave={() => {
              setDownloadHoverd(false);
            }}
            onClick={() => {
              onDownloadClick && onDownloadClick();
              //setshowDownloadSlide(true);
            }}
            className={
              "flex w-fit font-roobert gap-1  items-center bg-transparent border-0" +
              " " +
              (downloadHoverd ? "text-primary" : "text-secondary")
            }
          >
            <p>DOWNLOAD</p>
            <p className="mb-[0.2rem]">|</p>
          </motion.button>
        </div>
        {children}
      </div>
    </div>
  );
};

export default PageTemplate;
