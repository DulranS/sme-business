import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Check, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";

const PricingPackages = ({
  onSelectPackage,
  addOns,
  onAddAddon,
  selectedPackage,
  selectedAddons,
  monthlyPackages,
  onSelectMonthlyPackage,
  packageType,
}) => {
  const packages = [
    {
      name: "Starter Package",
      price: 2499,
      features: [
        "8 exterior pictures (Front view, Back view, 4 sides, 2 close-ups)",
        "4 interior pictures",
        "Full detailed caption",
      ],
    },
    {
      name: "Model Package",
      price: 3499,
      features: [
        "8 exterior pictures (Front view, Back view, 4 sides, 2 close-ups)",
        "4 interior pictures",
        "15 Second advertisement video",
        "Full detailed caption",
      ],
    },
    {
      name: "Green Screen Package",
      price: 4599,
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
      price: 6500,
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

  const handlePackageSelect = (pkg) => {
    if (packageType === "monthly") {
      onSelectMonthlyPackage(null);
    }
    onSelectPackage(pkg);
  };

  const handleMonthlyPackageSelect = (pkg) => {
    if (packageType === "normal") {
      onSelectPackage(null);
    }
    onSelectMonthlyPackage(pkg);
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6" id="contact">
      <h1 className="text font-bold text-gray-800 mb-12">
        📌 Note that all packages include a complimentary 1-hour consultancy session to help
        you get started.
      </h1>
      <div className="flex justify-center gap-4 mb-8">
        <Button
          variant="default"
          className={`bg-red-600 hover:bg-red-700 text-white ${
            packageType === "normal"
              ? "shadow-lg ring-2 ring-red-500"
              : "shadow-md"
          } transition-all duration-300`}
          onClick={() => handlePackageSelect("normal")}
        >
          One-time Packages
        </Button>
        <Button
          variant="default"
          className={`bg-red-600 hover:bg-red-700 text-white ${
            packageType === "monthly"
              ? "shadow-lg ring-2 ring-red-500"
              : "shadow-md"
          } transition-all duration-300`}
          onClick={() => handleMonthlyPackageSelect("monthly")}
        >
          Monthly Packages
        </Button>
      </div>
      {packageType === "normal" && (
        <>
          <h2 className="text-3xl font-bold mb-6 text-gray-800 text-center">
            Choose Your Package
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {packages.map((pkg) => (
              <Card
                key={pkg.name}
                onClick={() => handlePackageSelect(pkg)}
                className={`relative cursor-pointer border ${
                  selectedPackage?.name === pkg.name
                    ? "border-red-600 shadow-xl scale-105"
                    : "border-gray-200"
                } shadow-md transition-transform duration-200 hover:scale-105 hover:shadow-lg bg-white`}
              >
                {selectedPackage?.name === pkg.name && (
                  <div className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1">
                    <Check className="h-5 w-5" />
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-xl font-semibold text-gray-800">
                    {pkg.name}
                  </CardTitle>
                  <div className="text-2xl font-bold text-red-600">
                    LKR {pkg.price.toLocaleString()}
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {pkg.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2 text-gray-600"
                      >
                        <Check className="h-5 w-5 text-red-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-8">
            <h3 className="text-xl font-semibold mb-4 text-gray-800">
              Add-ons (Optional)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {addOns.map((addon) => (
                <Card
                  key={addon.name}
                  onClick={() => onAddAddon(addon)}
                  className={`cursor-pointer transform transition-all duration-300 ease-in-out ${
                    selectedAddons.some((a) => a.name === addon.name)
                      ? "bg-red-50 border-2 border-red-600 shadow-lg scale-105"
                      : "border-gray-200 hover:border-red-300 hover:shadow-lg"
                  }`}
                >
                  <CardContent className="flex justify-between items-center p-4">
                    <span
                      className={
                        selectedAddons.some((a) => a.name === addon.name)
                          ? "font-bold text-red-600"
                          : "text-gray-700"
                      }
                    >
                      {addon.name}
                    </span>
                    <span className="font-semibold">LKR {addon.price}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}

      {packageType === "monthly" && (
        <>
          <h2 className="text-3xl font-bold mb-6 text-gray-800 text-center">
            Monthly Packages
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            {monthlyPackages.map((pkg) => (
              <Card
                key={pkg.name}
                onClick={() => handleMonthlyPackageSelect(pkg)}
                className={`relative cursor-pointer border ${
                  selectedPackage?.name === pkg.name
                    ? "border-red-600 bg-red-50 shadow-lg"
                    : "border-gray-200"
                } shadow-md transition-transform duration-200 hover:scale-105 hover:shadow-lg`}
              >
                {selectedPackage?.name === pkg.name && (
                  <div className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1">
                    <Check className="h-5 w-5" />
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-lg font-medium">
                    {pkg.name}
                  </CardTitle>
                  <div
                    className={`text-xl font-bold ${
                      selectedPackage?.name === pkg.name
                        ? "text-red-600"
                        : "text-gray-800"
                    }`}
                  >
                    LKR {pkg.price}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-gray-600">{pkg.details}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const ContactComponent = () => {
  const { toast } = useToast();
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [selectedMonthlyPackage, setSelectedMonthlyPackage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [totalPrice, setTotalPrice] = useState(0);
  const [packageType, setPackageType] = useState("normal");

  const addOns = [
    { name: "Ikman Post", price: 1500 },
    { name: "360° Interior View", price: 1250 },
  ];

  const monthlyPackages = [
    {
      name: "Package 01 (1-5 Cars/Month)",
      price: 25000,
      details: "Add-on: LKR 3,500 per additional car exceeding 10",
    },
    {
      name: "Package 02 (5-20 Cars/Month)",
      price: 45000,
      details: "Add-on: LKR 2,000 per additional car exceeding limit",
    },
  ];

  const handleSelectPackage = (pkg) => {
    setPackageType("normal");
    setSelectedPackage(pkg);
    setSelectedMonthlyPackage(null);
  };

  const handleSelectMonthlyPackage = (pkg) => {
    setPackageType("monthly");
    setSelectedMonthlyPackage(pkg);
    setSelectedPackage(pkg);
    setSelectedAddons([]);
  };

  const handleAddonClick = (addon) => {
    setSelectedAddons((prevAddons) =>
      prevAddons.some((a) => a.name === addon.name)
        ? prevAddons.filter((a) => a.name !== addon.name)
        : [...prevAddons, addon]
    );
  };

  const calculateTotalPrice = () => {
    if (packageType === "monthly") {
      return selectedMonthlyPackage?.price || 0;
    } else {
      const packagePrice = selectedPackage?.price || 0;
      const addonPrices = selectedAddons.reduce(
        (total, addon) => total + addon.price,
        0
      );
      return packagePrice + addonPrices;
    }
  };

  useEffect(() => {
    setTotalPrice(calculateTotalPrice());
  }, [selectedPackage, selectedAddons, selectedMonthlyPackage, packageType]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const formData = new FormData(e.target);
      const submissionData = {
        name: formData.get("name"),
        email: formData.get("email"),
        phone: formData.get("phone"),
        notes: formData.get("notes"),
        packageType,
        package:
          packageType === "monthly"
            ? selectedMonthlyPackage?.name
            : selectedPackage?.name,
        addons: selectedAddons.map((addon) => addon.name),
        totalPrice,
        message: formData.get("notes"),
      };

      if (
        !submissionData.name ||
        !submissionData.phone ||
        !submissionData.package
      ) {
        toast({
          description:
            "Please fill in all required fields (Name, Phone, and select a Package)",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch("/api/submit-lead", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submissionData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to submit form.");
      }

      toast({
        description: (
          <div className="flex items-center space-x-2">
            <Check className="h-5 w-5 text-green-500" />
            <span className="font-medium">
              Thank you for reaching out to us! Our team will review your
              request and respond promptly 🚨
            </span>
          </div>
        ),
        duration: 5000,
      });

      e.target.reset();
      setSelectedPackage(null);
      setSelectedAddons([]);
      setSelectedMonthlyPackage(null);
    } catch (error) {
      console.error(error);
      toast({
        description: error.message || "Failed to submit form.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 to-white">
      <div className="container mx-auto py-12">
        <h1 className="text-4xl font-bold text-center text-gray-800 mb-8">
          Select Your Package
        </h1>

        <PricingPackages
          onSelectPackage={handleSelectPackage}
          addOns={addOns}
          onAddAddon={handleAddonClick}
          selectedPackage={selectedPackage}
          selectedAddons={selectedAddons}
          monthlyPackages={monthlyPackages}
          onSelectMonthlyPackage={handleSelectMonthlyPackage}
          packageType={packageType}
        />

        <div className="mt-12 max-w-2xl mx-auto bg-white p-8 shadow-lg rounded-md">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Contact Form
          </h2>

          <form onSubmit={onSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label htmlFor="name" className="block text-gray-600 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  id="name"
                  required
                  placeholder="John Doe"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-600 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-gray-600 mb-1">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  name="email"
                  id="email"
                  placeholder="John@gmail.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-600 focus:outline-none"
                />
              </div>
            </div>
            <div className="mb-4">
              <label htmlFor="phone" className="block text-gray-600 mb-1">
                Phone <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="phone"
                id="phone"
                required
                placeholder="Ex : 0741234567"
                minLength={10}
                maxLength={10}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-600 focus:outline-none"
              />
            </div>
            <div className="mb-4">
              <label htmlFor="notes" className="block text-gray-600 mb-1">
                Notes
              </label>
              <textarea
                name="notes"
                id="notes"
                rows="4"
                placeholder="Anything extra details"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-600 focus:outline-none"
              ></textarea>
            </div>
            <div className="mb-4">
              <label className="block text-gray-800 font-semibold">
                Selected Package:
              </label>
              <p className="text-gray-600">
                {packageType === "monthly"
                  ? selectedMonthlyPackage?.name || "None selected"
                  : selectedPackage?.name || "None selected"}
              </p>
            </div>
            <div className="mb-4">
              <label className="block text-gray-800 font-semibold">
                Selected Add-ons:
              </label>
              <ul className="text-gray-600 list-disc pl-5">
                {selectedAddons.length > 0 ? (
                  selectedAddons.map((addon) => (
                    <li key={addon.name}>{addon.name}</li>
                  ))
                ) : (
                  <li>No add-ons selected</li>
                )}
              </ul>
            </div>
            <div className="mb-4">
              <label className="block text-gray-800 font-semibold">
                Total Price:
              </label>
              <p className="text-gray-800 font-bold text-lg">
                LKR {totalPrice}
              </p>
            </div>
            <div className="mt-6">
              <Button
                type="submit"
                className="w-full bg-red-600 hover:bg-red-700 text-white"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                ) : (
                  "Submit"
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
      <Toaster />
    </div>
  );
};

export default ContactComponent;
