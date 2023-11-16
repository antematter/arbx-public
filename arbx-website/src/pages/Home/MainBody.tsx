import React, { useState } from "react";
import { MainFooter } from "../../data/svgs";
import { useNavigate } from "react-router-dom";

const MainBody = () => {
  const [viewDetailsHoverd, setViewDetailsHoverd] = useState(false);
  const navigateTo = useNavigate();

  return (
    <div className="flex flex-col">
      <div className="flex flex-col text-white ml-[3.5rem] mt-[3rem] text-left">
        <div className="flex flex-col gap-2 font-roobertRegular text-7xl ">
          <p>ARBX</p>
          <p>THE CONSOLE</p>
        </div>
        <p className="font-roobert break-normal font-[100] tracking-[.02em] w-[24rem] ml-10 mt-[1rem]">
          The ultimate platform for cross-chain cryptocurrency arbitrages. It’s
          passive income made accessible .
        </p>
      </div>
      <div className="flex w-screen font-medium justify-center bg-transparent">
        <button
          className={
            "bg-transparent border-0" +
            " " +
            (viewDetailsHoverd ? "text-viewHoverd" : "text-white")
          }
          onMouseEnter={() => {
            setViewDetailsHoverd(true);
          }}
          onMouseLeave={() => {
            setViewDetailsHoverd(false);
          }}
          onClick={() => {
            navigateTo("/features");
          }}
        >
          VIEW DETAILS
        </button>
      </div>
      <div className="flex w-full h-fit justify-center mt-5">
        <MainFooter />
      </div>
    </div>
  );
};

export default MainBody;
