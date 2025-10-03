import React from "react";
import { Camera, Video, Target, Star, HeartHandshake } from "lucide-react";
import Link from "next/link";

export const WhyChooseSpeedLabs = () => {
  const features = [
    {
      title: "No Hassle Selling",
      description:
        "Whether you're selling a single car or an entire fleet, we handle all the details so you don't have to.",
      icon: HeartHandshake,
      gradient: "from-purple-500 to-pink-500",
    },
    {
      title: "High-Quality Videography",
      description:
        "Our expert team offers stunning car videography to showcase your vehicle's unique features.",
      icon: Video,
      gradient: "from-pink-500 to-rose-500",
    },
    {
      title: "Professional Photography",
      description:
        "We provide professional photography for that perfect first impression.",
      icon: Camera,
      gradient: "from-rose-500 to-orange-500",
    },
    {
      title: "Strategic Marketing",
      description:
        "Our tailored marketing and sales campaigns help you reach potential buyers faster.",
      icon: Target,
      gradient: "from-orange-500 to-amber-500",
    },
    {
      title: "Dedicated Support",
      description:
        "You'll receive dedicated support from our team throughout the entire listing and sales process.",
      icon: Star,
      gradient: "from-amber-500 to-purple-500",
    },
  ];

  return (
    <div className="bg-gradient-to-br from-red-50 via-red-100 to-red-50 py-16 px-6 lg:px-16">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl lg:text-5xl font-extrabold mb-6 bg-gradient-to-r from-red-600 to-red-800 inline-block text-transparent bg-clip-text">
            Why Choose Speed Labs?
          </h2>
          <p className="text-lg text-red-700 max-w-2xl mx-auto">
            Experience excellence in automotive marketing with our comprehensive
            suite of professional services
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group bg-white/90 backdrop-blur-sm p-8 rounded-xl shadow-lg 
                         hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2
                         border-2 border-transparent hover:border-red-200"
            >
              <div
                className="bg-gradient-to-r from-red-500 to-red-700 p-3 rounded-xl inline-block
                             shadow-lg transform group-hover:scale-110 transition-transform duration-500"
              >
                <feature.icon className="w-6 h-6 text-white" />
              </div>

              <h3
                className="text-2xl font-bold text-red-800 mt-6 mb-4 group-hover:text-red-600 
                           transition-colors duration-300"
              >
                {feature.title}
              </h3>

              <p className="text-red-700 leading-relaxed">
                {feature.description}
              </p>

              <div
                className="mt-6 h-1 w-12 bg-gradient-to-r from-red-500 to-red-700 rounded-full 
                            group-hover:w-full transition-all duration-500"
              />
            </div>
          ))}
        </div>

        <div className="mt-16 text-center" id="gallery">
          <Link 
          href={"#contact"}
            className="px-8 py-4 bg-gradient-to-r from-red-600 to-red-700 text-white 
                           font-bold rounded-xl shadow-lg hover:shadow-2xl transform hover:scale-105 
                           transition-all duration-300 hover:from-red-700 hover:to-red-800"
          >
            Get Started Today
          </Link>
        </div>
      </div>
    </div>
  );
};

export default WhyChooseSpeedLabs;
