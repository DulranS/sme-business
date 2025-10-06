"use client";
import React, { useState, useMemo, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Phone,
  Facebook,
  Instagram,
  MapPin,
  Camera,
} from "lucide-react";

// Predefined leads array (moved outside the component)
import { leads } from "@/app/leads/LeadList";

const ListingPage = ({ params }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Memoize the listing to prevent unnecessary recalculations
  const listing = useMemo(
    () => leads.find((lead) => lead.id === params?.id),
    [params?.id]
  );

  // Memoize image navigation functions
  const nextImage = useCallback(() => {
    setCurrentImageIndex((prev) =>
      prev === (listing?.images?.length || 1) - 1 ? 0 : prev + 1
    );
  }, [listing]);

  const prevImage = useCallback(() => {
    setCurrentImageIndex((prev) =>
      prev === 0 ? (listing?.images?.length || 1) - 1 : prev - 1
    );
  }, [listing]);

  // Memoize formatted message to prevent unnecessary re-renders
  const formattedMessage = useMemo(() => {
    if (!listing) return null;
    return listing.message.split("\n").map((line, index) => {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith("•")) {
        return (
          <li key={index} className="ml-6 list-disc text-red-600">
            {trimmedLine.substring(1).trim()}
          </li>
        );
      }
      return (
        <p key={index} className="mb-2 text-gray-800">
          {trimmedLine}
        </p>
      );
    });
  }, [listing]);

  // Handle case when listing is not found
  if (!listing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-600">
        <div className="text-center max-w-2xl mx-auto px-4 py-16">
          <h1 className="text-4xl font-bold text-white mb-4">
            Listing Not Found
          </h1>
          <p className="text-gray-200 mb-8">
            The requested listing could not be found.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 bg-white text-red-600 font-semibold rounded-lg 
                       hover:bg-gray-100 transform hover:scale-105 transition-all duration-300 shadow-md"
          >
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-red-600 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-xl shadow-2xl overflow-hidden border-2 border-black">
          {/* Optimized Image Gallery */}
          <div className="relative h-96 bg-black">
            <Image
              src={listing.images[currentImageIndex]}
              alt={`${listing.name} - Image ${currentImageIndex + 1}`}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
              quality={75}
            />

            {listing.images.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-white hover:bg-gray-100 p-3 rounded-full
                             transform transition-transform duration-200 hover:scale-110 z-10 border border-black"
                >
                  <ChevronLeft className="w-6 h-6 text-red-600" />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-white hover:bg-gray-100 p-3 rounded-full
                             transform transition-transform duration-200 hover:scale-110 z-10 border border-black"
                >
                  <ChevronRight className="w-6 h-6 text-red-600" />
                </button>

                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2 z-10">
                  {listing.images.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentImageIndex(idx)}
                      className={`w-2 h-2 rounded-full transition-all duration-200 
                                ${
                                  idx === currentImageIndex
                                    ? "bg-red-600 w-4"
                                    : "bg-white"
                                }`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="p-8">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-4xl font-bold text-red-600 tracking-wide">
                {listing.name}
              </h1>
              <Link
                href="/"
                className="text-red-600 hover:text-red-700 transition-colors duration-200 text-lg"
              >
                ← Back to Gallery
              </Link>
            </div>

            <div className="prose max-w-none mb-8">{formattedMessage}</div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-red-600">
                  Contact Information
                </h2>
                <div className="space-y-2">
                  {Object.entries(listing.contact).map(([key, value]) => (
                    <div key={key} className="flex items-center space-x-2">
                      <Phone className="w-4 h-4 text-red-600" />
                      <span className="text-gray-800">
                        {value} <span className="text-red-600">({key})</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-red-600">Location</h2>
                <div className="flex items-center space-x-2">
                  <MapPin className="w-4 h-4 text-red-600" />
                  <span className="text-gray-800">{listing.location}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 mb-8">
              {listing.facebookURL && (
                <button
                  onClick={() => window.open(listing.facebookURL, "_blank")}
                  className="flex-1 inline-flex items-center justify-center px-6 py-3 bg-black text-white font-semibold rounded-lg 
                            hover:bg-gray-900 transform transition-all duration-300 border border-red-600"
                >
                  <Facebook className="w-5 h-5 mr-2" />
                  View on Facebook
                </button>
              )}
              {listing.instagramURL && (
                <button
                  onClick={() => window.open(listing.instagramURL, "_blank")}
                  className="flex-1 inline-flex items-center justify-center px-6 py-3 bg-black text-white font-semibold rounded-lg 
                            hover:bg-gray-900 transform transition-all duration-300 border border-red-600"
                >
                  <Instagram className="w-5 h-5 mr-2" />
                  View on Instagram
                </button>
              )}
            </div>

            <div className="flex items-center justify-between pt-6 border-t border-gray-200">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm text-gray-800 font-medium">
                  Available
                </span>
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <Camera className="w-4 h-4 mr-2" />
                Photos by {listing.photographer}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListingPage;
