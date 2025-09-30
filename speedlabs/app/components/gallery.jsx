"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Camera, ChevronLeft, ChevronRight, ArrowRight, Rotate3d } from "lucide-react";

export const TheGallery = ({ leads }) => {
  if (!leads?.length) {
    return (
      <div
        className="min-h-[400px] flex items-center justify-center bg-gradient-to-br from-red-50 via-red-100 to-red-50"
        id="gallery"
      >
        <div className="text-center max-w-2xl mx-auto px-4 py-16">
          <Camera className="mx-auto mb-6 text-red-500" size={48} />
          <h3 className="text-3xl font-bold text-red-800 mb-4">
            We're Just Getting Started
          </h3>
          <p className="text-red-700 text-lg leading-relaxed">
            Our gallery will soon be filled with amazing transformations and
            success stories. Check back soon to see our latest work!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-red-50 via-red-100 to-red-50 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12 bg-white/50 backdrop-blur-sm rounded-2xl p-8 shadow-lg">
          <h2 className="text-4xl font-bold text-red-800 mb-4 bg-gradient-to-r from-red-600 to-red-800 inline-block text-transparent bg-clip-text">
            Our Featured Vehicles
          </h2>
          <p className="text-red-700 text-lg mb-0 max-w-3xl mx-auto">
            Discover our collection of carefully curated vehicles, each with its
            own unique story and character.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {leads.map((lead, index) => (
            <Link href={`/listings/${lead.id}`} key={lead.id}>
              <VehicleCard lead={lead} index={lead.id} />
            </Link>
          ))}
        </div>
        <div id="services"></div>
      </div>
    </div>
  );
};

const VehicleCard = ({ lead, index }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [is360View, setIs360View] = useState(false);
  const [rotation, setRotation] = useState(0);

  const is360Image = (url) => {
    // Check if the image URL suggests a 360-degree view
    return url?.includes('photos.app.goo.gl') || url?.includes('360');
  };

  const nextImage = (e) => {
    e.preventDefault();
    if (is360View) {
      setRotation((prev) => (prev + 45) % 360);
    } else {
      setCurrentImageIndex((prev) =>
        prev === lead.images.length - 1 ? 0 : prev + 1
      );
    }
  };

  const prevImage = (e) => {
    e.preventDefault();
    if (is360View) {
      setRotation((prev) => (prev - 45 + 360) % 360);
    } else {
      setCurrentImageIndex((prev) =>
        prev === 0 ? lead.images.length - 1 : prev - 1
      );
    }
  };

  const toggle360View = () => {
    if (is360Image(lead.images[0])) {
      setIs360View(!is360View);
      setRotation(0);
    }
  };

  // Convert message with bullet points to proper format
  const formattedMessage = lead.message.split("\n").map((line, index) => {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith("•")) {
      return (
        <li key={index} className="ml-4">
          {trimmedLine.substring(1).trim()}
        </li>
      );
    }
    return (
      <p key={index} className="mb-2">
        {trimmedLine}
      </p>
    );
  });

  return (
    <div
      className="group bg-white/90 backdrop-blur-sm rounded-xl shadow-lg hover:shadow-2xl 
                    transform hover:-translate-y-1 transition-all duration-300 overflow-hidden
                    border-2 border-transparent hover:border-red-300 relative"
    >
      <div className="relative">
        <div className="aspect-w-16 aspect-h-9 overflow-hidden relative">
          {/* 360-degree view or standard image view */}
          {is360View && is360Image(lead.images[0]) ? (
            <div 
              className="w-full h-64 flex items-center justify-center bg-gray-100 relative"
              style={{
                transform: `rotateY(${rotation}deg)`,
                transition: 'transform 0.5s ease'
              }}
            >
              <img
                src={lead.images[0]}
                alt={`${lead.name} - 360° View`}
                className="max-w-full max-h-full object-contain"
              />
            </div>
          ) : (
            <img
              src={lead.images[currentImageIndex]}
              alt={`${lead.name} - Image ${currentImageIndex + 1}`}
              className="w-full h-64 object-cover transform group-hover:scale-105 transition-transform duration-500"
            />
          )}

          {/* Image Navigation */}
          {lead.images.length > 1 && !is360View && (
            <>
              <button
                onClick={prevImage}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white p-2 rounded-full
                           transform transition-transform duration-200 hover:scale-110 z-10"
              >
                <ChevronLeft className="w-6 h-6 text-red-600" />
              </button>
              <button
                onClick={nextImage}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white p-2 rounded-full
                           transform transition-transform duration-200 hover:scale-110 z-10"
              >
                <ChevronRight className="w-6 h-6 text-red-600" />
              </button>

              {/* Image Indicators */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex space-x-2 z-10">
                {lead.images.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={(e) => {
                      e.preventDefault();
                      setCurrentImageIndex(idx);
                    }}
                    className={`w-2 h-2 rounded-full transition-all duration-200 
                              ${
                                idx === currentImageIndex
                                  ? "bg-red-600 w-4"
                                  : "bg-white/80"
                              }`}
                  />
                ))}
              </div>
            </>
          )}

          {/* 360 View Toggle Button */}
          {is360Image(lead.images[0]) && (
            <button
              onClick={toggle360View}
              className="absolute top-2 right-2 bg-white/80 hover:bg-white p-2 rounded-full
                         transform transition-transform duration-200 hover:scale-110 z-10"
              title={is360View ? "Exit 360° View" : "Enter 360° View"}
            >
              <Rotate3d className={`w-6 h-6 ${is360View ? 'text-green-600' : 'text-red-600'}`} />
            </button>
          )}

          {/* 360 View Controls */}
          {is360View && is360Image(lead.images[0]) && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex space-x-2 z-10">
              <button
                onClick={prevImage}
                className="bg-white/80 hover:bg-white p-2 rounded-full
                           transform transition-transform duration-200 hover:scale-110"
              >
                <ChevronLeft className="w-4 h-4 text-red-600" />
              </button>
              <button
                onClick={nextImage}
                className="bg-white/80 hover:bg-white p-2 rounded-full
                           transform transition-transform duration-200 hover:scale-110"
              >
                <ChevronRight className="w-4 h-4 text-red-600" />
              </button>
            </div>
          )}

          <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 text-sm font-semibold text-red-600">
            #{String(index + 1).padStart(3, "0")}
          </div>
        </div>
      </div>

      <div className="p-6">
        <h3 className="text-2xl font-bold text-red-800 mb-2 group-hover:text-red-600 transition-colors duration-300">
          {lead.name}
        </h3>

        <div className="text-red-700 mb-6 line-clamp-3">{formattedMessage}</div>

        <div className="flex items-center justify-between border-t pt-4 mt-2">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm text-red-600 font-medium">Available</span>
          </div>
          <div className="text-sm text-red-600">
            <p>Contact: {lead.contact.primary}</p>
          </div>
        </div>

        {/* New View More Button */}
        <div className="mt-4 flex justify-center">
          <div
            className="inline-flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-full 
                        transform transition-all duration-300 group-hover:bg-red-700 
                        group-hover:scale-105 cursor-pointer"
          >
            View Details
            <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform duration-300" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TheGallery;