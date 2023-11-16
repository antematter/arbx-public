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
const DEFAULT_ANIMATION_UP_SPEED = 0.45; // seconds
const DEFAULT_ANIMATION_DOWN_SPEED = 0.6; // seconds
const WHEEL_SENSITIVITY = 1.25; ///deltay value change

/*const ANIMATION_DECELARATION_PER_SLIDE = (
  speed: number,
  decelarationPercentage: number
) => speed / decelarationPercentage;
*/
const ScrollViewAnimationData = (
  slideUpSpeed: number,
  SlideDownSpeed: number
) => {
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
        duration: slideUpSpeed,
        type: "linear",
      },
    },
    exit: {
      y: "100vh",
      x: "0vw",
      opacity: 1,
      transition: {
        duration: SlideDownSpeed,
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

const ViewDetails = () => {
  let allowWheelScroll = useRef(true);
  const [scrollDisplay, setScrollDisplay] = useState(DEFAULT_SCROLL_DISPLAY);
  const [showDownloadSlide, setshowDownloadSlide] = useState(false);

  let currentSlide = useRef(0);
  let wheeling: string | number | NodeJS.Timeout | undefined;

  const firstScrollView = () => {
    currentSlide.current = 0;
    setScrollDisplay(DEFAULT_SCROLL_DISPLAY);
  };

  const onScroll = (event: any) => {
    console.log("deltaY:", event.deltaY);

    clearTimeout(wheeling);

    if (allowWheelScroll.current) {
      allowWheelScroll.current = false;

      if (event.deltaY > WHEEL_SENSITIVITY) {
        // wheel down
        if (currentSlide.current < scrollDisplay.length - 1) {
          // wheel up not alowwed on last view as well

          currentSlide.current++;
          setScrollDisplay((display) => {
            const newDisplay = [...display];
            newDisplay[currentSlide.current] = true;
            return newDisplay;
          });
        }
      } else if (event.deltaY < -WHEEL_SENSITIVITY) {
        // wheel up
        if (currentSlide.current > 0) {
          // wheel down not alowwed on first view as well

          let deleteSlide = currentSlide.current;
          setScrollDisplay((display) => {
            const newDisplay = [...display];
            newDisplay[deleteSlide] = !newDisplay[deleteSlide];
            return newDisplay;
          });
          currentSlide.current--;
        }
      }

      event.stopPropagation();
    }
    wheeling = setTimeout(() => {
      // to control wheel scroll sensitivity

      allowWheelScroll.current = true;
    }, 0.1 * 1000); // seconds
  };
  useEffect(() => {
    window.addEventListener("wheel", onScroll);
    return () => {
      window.removeEventListener("wheel", onScroll);
    };
  }, []);

  return (
    <div className=" absolute flex bg-black overflow-hidden ">
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

      <div className={"fixed" + " " + (showDownloadSlide ? "opacity-50" : "")}>
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
              <FirstScrollViewButton
                onClick={firstScrollView}
                direction="down"
              />
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
              variants={ScrollViewAnimationData(
                DEFAULT_ANIMATION_UP_SPEED,
                DEFAULT_ANIMATION_DOWN_SPEED * 0.95
              )}
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
                  text2Width="w-[50rem]"
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
              variants={ScrollViewAnimationData(
                DEFAULT_ANIMATION_UP_SPEED,
                DEFAULT_ANIMATION_DOWN_SPEED * 0.9
              )}
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
              variants={ScrollViewAnimationData(
                DEFAULT_ANIMATION_UP_SPEED,
                DEFAULT_ANIMATION_DOWN_SPEED * 0.85
              )}
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
              variants={ScrollViewAnimationData(
                DEFAULT_ANIMATION_UP_SPEED,
                DEFAULT_ANIMATION_DOWN_SPEED * 0.8
              )}
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
                  text1="ABOVE  AND  BEYOND"
                  text2="ArbX is intended to work on multiple different chains, with multiple different DEXs. One engine to rule them all."
                  footer={<ViewScroll5Footer />}
                  text2Width="w-[40rem]"
                />
              </PageTemplate>
              <FirstScrollViewButton onClick={firstScrollView} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ViewDetails;
