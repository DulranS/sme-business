import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Check } from "lucide-react";

const PricingPackages = () => {
  const packages = [
    {
      name: "Starter Package",
      price: "LKR 2,499",
      features: [
        "8 exterior pictures (Front view, Back view, 4 sides, 2 close-ups)",
        "4 interior pictures",
        "Full detailed caption",
      ],
    },
    {
      name: "Model Package",
      price: "LKR 3,499",
      features: [
        "8 exterior pictures (Front view, Back view, 4 sides, 2 close-ups)",
        "4 interior pictures",
        "15 Second advertisement video",
        "Full detailed caption",
      ],
    },
    {
      name: "Green Screen Package",
      price: "LKR 4,599",
      features: [
        "8 exterior pictures (Front view, Back view, 4 sides, 2 close-ups)",
        "4 interior pictures",
        "15 Second advertisement video",
        "Full detailed caption",
        "Green screen edit for 2-3 exterior & 1 interior pictures",
      ],
    },
    {
      name: "Premium Speed Labs Pro Package",
      price: "LKR 6,500",
      features: [
        "Photography",
        "Videography",
        "Green screen",
        "360° view",
        "Ikman posting",
        "Best value package",
      ],
      highlighted: true,
    },
  ];

  const addOns = [
    {
      name: "Ikman Post",
      price: "LKR 1,500",
    },
    {
      name: "360° Interior View",
      price: "LKR 1,250",
    },
  ];

  const monthlyPackages = [
    {
      name: "Package 01 (1-5 Cars/Month)",
      price: "LKR 25,000",
      details: "Add-on: LKR 3,500 per additional car exceeding 10",
    },
    {
      name: "Package 02 (5-20 Cars/Month)",
      price: "LKR 45,000",
      details: "Add-on: LKR 2,000 per additional car exceeding limit",
    },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-12">
      <h1 className="text-4xl font-extrabold text-center text-gray-800">Packages</h1>
      <p className="text-center text-gray-600 text-lg">
        Note: All packages have a standard duration time of 1 hour.
      </p>

      {/* Photography Packages */}
      <div>
        <h2 className="text-3xl font-bold mb-6 text-gray-800">Photography Packages</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {packages.map((pkg) => (
            <Card
              key={pkg.name}
              className={`${
                pkg.highlighted ? "border-blue-500 border-4" : "border-gray-200"
              } shadow-md`}
            >
              <CardHeader>
                <CardTitle className="text-xl font-semibold">{pkg.name}</CardTitle>
                <div className="text-2xl font-bold text-blue-600">{pkg.price}</div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {pkg.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-500" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Add-on Services */}
      <div>
        <h2 className="text-3xl font-bold mb-6 text-gray-800">Add-on Services</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {addOns.map((addon) => (
            <Card key={addon.name} className="border-gray-200 shadow-md">
              <CardHeader>
                <CardTitle className="text-xl font-semibold">{addon.name}</CardTitle>
                <div className="text-xl font-bold text-blue-600">{addon.price}</div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>

      {/* Monthly Packages */}
      <div>
        <h2 className="text-3xl font-bold mb-6 text-gray-800">Car Sale Monthly Packages</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {monthlyPackages.map((pkg) => (
            <Card key={pkg.name} className="border-gray-200 shadow-md">
              <CardHeader>
                <CardTitle className="text-xl font-semibold">{pkg.name}</CardTitle>
                <div className="text-xl font-bold text-blue-600">{pkg.price}</div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">{pkg.details}</p>
                <p className="font-medium text-gray-800">Includes:</p>
                <ul className="list-disc pl-5 text-gray-600 space-y-2">
                  <li>Premium Speed Labs Pro Package for each car</li>
                  <li>Social media management (Instagram & Facebook)</li>
                  <li>Ikman page management</li>
                  <li>Special dedicated banner edit with car sale logo</li>
                  <li>Minimum 3-month contract period</li>
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PricingPackages;
