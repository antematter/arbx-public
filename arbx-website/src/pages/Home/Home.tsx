import { AnimatePresence, motion } from "framer-motion";
import PageTemplate from "../../components/PageTemplate/PageTemplate";
import MainBody from "./MainBody";
import { useState } from "react";
import DownloadSlide from "../../components/downloadSlide/DownloadSlide";

const downloadDropIn = {
  hidden: {
    x: "80vw",
    opacity: 0,
  },
  visible: {
    x: "0",
    opacity: 1,
    transition: {
      duration: 0.75,
      type: "linear",
    },
  },
  exit: {
    x: "80vw",
    opacity: 0,
    transition: {
      duration: 0.75,
      type: "linear",
    },
  },
};

const Home = () => {
  const [showDownloadSlide, setshowDownloadSlide] = useState(false);
  return (
    <div className=" fixed flex">
      <AnimatePresence>
        {showDownloadSlide && (
          <motion.div
            className=" fixed z-[1000] w-screen flex justify-end"
            onClick={(e) => e.stopPropagation()}
            variants={downloadDropIn}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <DownloadSlide
              onClose={() => {
                setshowDownloadSlide(false);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
      <div className={showDownloadSlide ? "opacity-50" : ""}>
        <PageTemplate
          onDownloadClick={() => {
            setshowDownloadSlide(true);
          }}
        >
          <MainBody />
        </PageTemplate>
      </div>
    </div>
  );
};

export default Home;
