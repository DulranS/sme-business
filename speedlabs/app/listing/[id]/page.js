import React from 'react';
import Link from 'next/link';

const ListingPage = ({ listings }) => {
  return (
    <div className="py-12 bg-gray-100 min-h-screen">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-extrabold text-gray-800 mb-8 text-center">Car Listings</h1>
        <p className="text-lg text-gray-600 text-center mb-12 max-w-2xl mx-auto">
          Browse our exclusive collection of cars available for purchase or viewing. Find the one that suits your style!
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
          {listings?.map((listing, index) => (
            <div
              key={index}
              className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300"
            >
              <img
                src={listing.imageUrl || "/api/placeholder/400/300"}
                alt={listing.title}
                className="w-full h-48 object-cover rounded-t-lg"
              />
              <div className="p-6">
                <h3 className="text-2xl font-semibold text-gray-800 mb-2">
                  {listing.title}
                </h3>
                <p className="text-gray-600 mb-4">{listing.description}</p>
                <Link
                  href={`/listings/${listing.id}`}
                  className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold transition duration-300 hover:bg-blue-700"
                >
                  View Details
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ListingPage;
