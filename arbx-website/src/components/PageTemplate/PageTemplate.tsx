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

          <div className="flex font-roobert gap-1  items-center bg-transparent border-0 text-secondary">
            
            <a
              href="https://github.com/antematter/arbx-public/tree/main"
              target="_blank"
              className="flex gap-1 hover:text-primary"
            >
              <p className="my-auto">GITHUB</p>
              <p className="mb-[0.2rem]">|</p>
            </a>

            <a
              href="https://antematter.gitbook.io/arbx/"
              target="_blank"
              className="flex gap-1 hover:text-primary"
            >
              <p className="my-auto">GITBOOK</p>
              <p className="mb-[0.2rem]">|</p>
            </a>

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
        </div>
        {children}
      </div>
    </div>
  );
};

export default PageTemplate;
