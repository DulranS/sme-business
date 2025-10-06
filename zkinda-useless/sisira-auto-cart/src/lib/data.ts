import { Product, Category, VehicleType } from "@/types";

// Sample product data
export const products: Product[] = [
  {
    id: "1",
    name: "Oil Filter",
    description: "High-quality oil filter for optimal engine protection.",
    price: 1200,
    category: "Filters",
    vehicleType: ["Sedan", "SUV", "Hatchback"],
    brand: "Toyota",
    partNumber: "OF-12345",
    stockQuantity: 25,
    images: [],
    subcategory: "General",
    featured: true,
  },
  {
    id: "2",
    name: "Brake Pads (Front)",
    description: "Durable ceramic brake pads for reliable stopping power.",
    price: 3500,
    category: "Brake System",
    vehicleType: ["Sedan", "SUV"],
    brand: "Honda",
    partNumber: "BP-67890",
    stockQuantity: 15,
    images: [],
    subcategory: "Brake Pads",
    featured: true,
  },
  {
    id: "3",
    name: "Spark Plugs (Set of 4)",
    description: "High-performance spark plugs for improved fuel efficiency.",
    price: 2600,
    category: "Engine Parts",
    vehicleType: ["Sedan", "Hatchback"],
    brand: "Suzuki",
    partNumber: "SP-23456",
    stockQuantity: 30,
    images: [],
    subcategory: "Ignition",
    featured: false,
  },

];



export const vehicleTypes: VehicleType[] = [
  "Sedan",
  "SUV",
  "Truck",
  "Van",
  "Motorcycle",
  "Hatchback",
  "Commercial",
];

export const brands: string[] = [
  "Toyota",
  "Honda",
  "Suzuki",
  "Mitsubishi",
  "Nissan",
  "Mazda",
  "Ford",
  "Hyundai",
  "Daihatsu",
  "Subaru",
];
