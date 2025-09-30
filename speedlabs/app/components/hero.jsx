import { useEffect, useState } from "react";
import Link from "next/link";

export const HeroPage = () => {
  const [videoLoaded, setVideoLoaded] = useState(false);

  useEffect(()=>{
    setTimeout(()=>{
      setVideoLoaded(true);
    },3000)
  },[])

  return (
    <div className="relative h-screen">
      {/* Image Background */}
      <div className={`absolute inset-0 ${videoLoaded ? "hidden" : "block"}`}>
        <img
          src="/hero.jpg"
          alt="Hero Background"
          className="w-full h-full object-cover opacity-98"
        />
      </div>

      {/* Video Background */}
      <video
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
          videoLoaded ? "opacity-100" : "opacity-0"
        }`}
        src="https://res.cloudinary.com/dsto9mmt0/video/upload/v1732312498/cywexdec9twkgwqyzoue.mp4"
        autoPlay
        loop
        muted
        playsInline
        onLoadedData={() => setVideoLoaded(true)}
      ></video>

      {/* Overlay for darkening effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-red-950/80 via-red-950/80 to-red-950/80"></div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full text-center text-white px-4">
        <h1 className="text-5xl font-extrabold tracking-tight mb-4 drop-shadow-lg">
          Welcome to Speed Labs!
        </h1>
        <p className="max-w-2xl text-lg sm:text-xl leading-relaxed mb-6 drop-shadow-md">
          From stunning videography and professional photography to tailored
          marketing strategies, we handle everything to make selling your car
          seamless and stress-free.
        </p>
        <button className="bg-red-800 text-white px-8 py-3 rounded-md shadow-md hover:bg-red-200 transition duration-300">
          <Link href="#contact">Get in Touch</Link>
        </button>
      </div>
    </div>
  );
};


