"use client";
import React, { useState } from "react";
import { Card, CardContent, CardFooter } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Car, DollarSign, Calendar, Radio } from "lucide-react";
import Link from "next/link";

const VehicleListings = () => {
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Sample data
  const listings = {
    current: [
      {
        id: 1,
        title: "2019 Toyota Camry",
        price: "7,500,000",
        category: "sedan",
        mileage: "45,000",
        transmission: "Automatic",
        fuelType: "Petrol",
        year: 2019,
        image: "/api/placeholder/400/300",
        condition: "Used",
        location: "Colombo",
        sold: false,
        facebookUrl: "https://www.facebook.com/2019-toyota-camry-listing",
      },
      {
        id: 2,
        title: "2020 Honda Civic",
        price: "8,200,000",
        category: "sedan",
        mileage: "32,000",
        transmission: "Automatic",
        fuelType: "Petrol",
        year: 2020,
        image: "/api/placeholder/400/300",
        condition: "Used",
        location: "Kandy",
        sold: false,
        facebookUrl: "https://www.facebook.com/2020-honda-civic-listing",
      },
    ],
    sold: [
      {
        id: 3,
        title: "2018 BMW 3 Series",
        price: "12,500,000",
        category: "luxury",
        mileage: "55,000",
        transmission: "Automatic",
        fuelType: "Petrol",
        year: 2018,
        image: "/api/placeholder/400/300",
        soldDate: "2023-08-20",
        location: "Colombo",
        sold: true,
        facebookUrl: "https://www.facebook.com/2018-bmw-3-series-listing",
      },
    ],
  };

  const categories = [
    { id: "all", label: "All Vehicles" },
    { id: "sedan", label: "Sedan" },
    { id: "suv", label: "SUV" },
    { id: "luxury", label: "Luxury" },
    { id: "commercial", label: "Commercial" },
  ];

  const combinedListings = [...listings.current, ...listings.sold];

  const filteredListings = combinedListings.filter((listing) =>
    selectedCategory === "all" ? true : listing.category === selectedCategory
  );

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-bold text-gray-800">
          Explore Our Vehicle Listings
        </h1>
        <p className="text-gray-600">
          Find your next vehicle. All listings are subject to redirection to
          Facebook for full details.
        </p>
      </div>

      {/* Back Home Button */}
      <Link
        href={"/"}
        className="inline-block bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-3 rounded-lg font-semibold text-lg shadow-lg transition-all duration-300 hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl transform hover:scale-105"
      >
        Back Home
      </Link>

      {/* Categories */}
      <div className="flex flex-wrap gap-2 my-8 justify-center">
        {categories.map((category) => (
          <Button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            variant={selectedCategory === category.id ? "default" : "outline"}
            size="sm"
            className={`px-4 ${
              selectedCategory === category.id
                ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white"
                : "text-gray-700 border-gray-300"
            }`}
          >
            {category.label}
          </Button>
        ))}
      </div>

      {/* Listings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredListings.map((vehicle) => (
          <Card
            key={vehicle.id}
            className="overflow-hidden shadow-lg rounded-lg transform hover:scale-105 transition-transform duration-300"
          >
            <div className="relative">
              <img
                src={vehicle.image}
                alt={vehicle.title}
                className="w-full h-48 object-cover"
              />
              {vehicle.sold && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                  <span className="text-white text-lg font-bold px-4 py-2 bg-red-600 rounded">
                    SOLD
                  </span>
                </div>
              )}
            </div>
            <CardContent className="p-4">
              <h3 className="text-lg font-bold mb-2 text-gray-800">
                {vehicle.title}
              </h3>
              <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  <span>LKR {vehicle.price}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>{vehicle.year}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Car className="w-4 h-4" />
                  <span>{vehicle.mileage} km</span>
                </div>
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4" />
                  <span>{vehicle.transmission}</span>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2 text-gray-600">
                <span>📍 {vehicle.location}</span>
                <span>• {vehicle.condition}</span>
              </div>
            </CardContent>
            <CardFooter className="p-4 pt-0">
              <Button
                className="w-full"
                variant={vehicle.sold ? "outline" : "default"}
              >
                <Link href={`${vehicle.facebookUrl}`} target="_blank">
                  {vehicle.sold ? "View Details" : "Contact Seller"}
                </Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredListings.length === 0 && (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-600">
            No vehicles found in this category.
          </h3>
        </div>
      )}
    </div>
  );
};

export default VehicleListings;
