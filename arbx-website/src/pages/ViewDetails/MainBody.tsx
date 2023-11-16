import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import FirstScrollViewButton from "./FirstScrollViewButton/FirstScrollViewButton";
import DownloadSlide from "../../components/downloadSlide/DownloadSlide";
import ViewTemplate from "../../components/ViewScrolls/ViewTemplate/ViewTemplate";
import PageTemplate from "../../components/PageTemplate/PageTemplate";
import {
  ViewScroll1Footer,
  ViewScroll2Footer,
  ViewScroll3Footer,
  ViewScroll4Footer,
  ViewScroll5Footer,
} from "../../data/svgs";

const DEFAULT_SCROLL_DISPLAY = [true, false, false, false, false];
const ANIMATION_TIME = 0.75; // seconds

const ScrollViewAnimationData = (exitAnimationDecrement: number) => {
  // in seconds

  return {
    hidden: {
      y: "100vh",
      x: "0vw",
      opacity: 1,
    },
    visible: {
      y: "0vh",
      x: "0vw",
      opacity: 1,

      transition: {
        duration: ANIMATION_TIME,
        type: "linear",
      },
    },
    exit: {
      y: "100vh",
      x: "0vw",
      opacity: 1,
      transition: {
        duration: ANIMATION_TIME - exitAnimationDecrement,
        type: "linear",
      },
    },
  };
};

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

const MainBody = () => {
  let allowWheelScroll = true;
  const [scrollDisplay, setScrollDisplay] = useState(DEFAULT_SCROLL_DISPLAY);
  const [showDownloadSlide, setshowDownloadSlide] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  //let currentSlide = useRef(0);
  const firstScrollView = () => {
    setCurrentSlide(0);
    setScrollDisplay(DEFAULT_SCROLL_DISPLAY);
  };
  useEffect(() => {
    const onScroll = (event: { deltaY: any }) => {
      if (allowWheelScroll) {
        allowWheelScroll = false;
        setTimeout(() => {
          // to control wheel scroll sensitivity
          allowWheelScroll = true;
        }, (2 * ANIMATION_TIME + ANIMATION_TIME / 1.75) * 1000);

        if (event.deltaY > 0) {
          console.log("scrolling down");
          // wheel down
          if (currentSlide < scrollDisplay.length - 1) {
            // wheel up not alowwed on last view as well
            setCurrentSlide(currentSlide + 1);
            setScrollDisplay((display) => {
              const newDisplay = [...display];
              newDisplay[currentSlide] = true;
              return newDisplay;
            });
            console.log("current Slide : ", currentSlide);
          }
        } else {
          // wheel up
          if (currentSlide > 0) {
            console.log("scrolling up");
            // wheel down not alowwed on first view as well
            console.log("deleted Slide : ", currentSlide);
            let deleteSlide = currentSlide;
            setScrollDisplay((display) => {
              const newDisplay = [...display];
              newDisplay[deleteSlide] = !newDisplay[deleteSlide];
              return newDisplay;
            });
            setCurrentSlide(currentSlide - 1);
            console.log("current Slide : ", currentSlide);
          }
        }
        console.log("SCROLL COMPLETED");
      }
    };
    window.addEventListener("wheel", onScroll);
    return () => {
      window.removeEventListener("wheel", onScroll);
    };
  }, []);
  useEffect(() => {
    console.log("scrollDisplay", scrollDisplay);
  });

  return (
    <div className=" absolute flex bg-black overflow-hidden ">
      <AnimatePresence>
        {scrollDisplay[0] && (
          <motion.div
            className=" fixed z-0 flex h-screen w-screen"
            onScroll={(event) => {
              console.log(event.currentTarget.scrollTop);
              console.log("working");
            }}
          >
            <PageTemplate
              onDownloadClick={() => {
                setshowDownloadSlide(true);
              }}
            >
              <ViewTemplate
                text1="YOUR KEYS ARE YOURS"
                text2="The console runs locally, all your transactions created and signed on
            your own machine. You can rest assured that your keys never leave your
            machine."
                footer={<ViewScroll1Footer />}
              />
            </PageTemplate>
            <FirstScrollViewButton onClick={firstScrollView} direction="down" />
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {scrollDisplay[1] && (
          <motion.div
            className=" fixed z-10 flex h-screen w-screen"
            onClick={(e) => {
              e.stopPropagation();
            }}
            variants={ScrollViewAnimationData(0)}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <PageTemplate
              onDownloadClick={() => {
                setshowDownloadSlide(true);
              }}
            >
              <ViewTemplate
                text1="YOUR ASSETS ARE SECURE"
                text2="The console has built-in security mechanisms to never let your holdings wildly depreciate in value. Easily configure the engine with your own trading parameters."
                footer={<ViewScroll2Footer />}
              />
            </PageTemplate>
            <FirstScrollViewButton onClick={firstScrollView} />
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {scrollDisplay[2] && (
          <motion.div
            className=" fixed z-20 flex h-screen w-screen"
            onClick={(e) => {
              e.stopPropagation();
            }}
            variants={ScrollViewAnimationData(0.05)}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <PageTemplate
              onDownloadClick={() => {
                setshowDownloadSlide(true);
              }}
            >
              <ViewTemplate
                text1="ARBITRAGES ARE WILD"
                text2="We aggregate data in real-time from various different DEXs and AMMs to hunt down the wildest arbitrage opportunities. Be there when that happens!"
                footer={<ViewScroll3Footer />}
              />
            </PageTemplate>
            <FirstScrollViewButton onClick={firstScrollView} />
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {scrollDisplay[3] && (
          <motion.div
            className=" fixed z-30 flex h-screen w-screen"
            onClick={(e) => {
              e.stopPropagation();
            }}
            variants={ScrollViewAnimationData(0.1)}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <PageTemplate
              onDownloadClick={() => {
                setshowDownloadSlide(true);
              }}
            >
              <ViewTemplate
                text1="KNOW YOUR TRADE WELL"
                text2="Know exactly what profit was made, what loss incurred, what arbitrage pathways executed and what were missed. Configure accordingly and keep growing."
                footer={<ViewScroll4Footer />}
              />
            </PageTemplate>
            <FirstScrollViewButton onClick={firstScrollView} />
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {scrollDisplay[4] && (
          <motion.div
            className=" fixed z-40 flex h-screen w-screen"
            onClick={(e) => {
              e.stopPropagation();
            }}
            variants={ScrollViewAnimationData(0.15)}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <PageTemplate
              onDownloadClick={() => {
                setshowDownloadSlide(true);
              }}
            >
              <ViewTemplate
                text1="KNOW YOUR TRADE WELL"
                text2="Know exactly what profit was made, what loss incurred, what arbitrage pathways executed and what were missed. Configure accordingly and keep growing."
                footer={<ViewScroll5Footer />}
              />
            </PageTemplate>
            <FirstScrollViewButton onClick={firstScrollView} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MainBody;
