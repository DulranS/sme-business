// src/types.ts
export interface CategoryGroup {
  name: string;
  subcategories: string[];
}

export const categoryGroups: CategoryGroup[] = [
  {
    name: "Engines & Engine Parts",
    subcategories: ["Engines", "Engine Parts"],
  },
  {
    name: "Brake System",
    subcategories: [
      "Brake Pads",
      "Brake Discs",
      "Brake Calipers",
      "Brake Shoes",
      "Brake Boosters",
      "Brake Lines",
      "Brake Sensors",
      "Handbrake Cables",
      "Handbrake Levers",
    ],
  },
  {
    name: "Transmission",
    subcategories: ["Gearboxes", "Gear Cables", "Gear Shifters"],
  },
  {
    name: "Electrical",
    subcategories: [
      "Alternators",
      "ECUs",
      "Speedometers",
      "Door Window Motors",
      "Power Window Switches",
      "Wiring Harnesses",
      "Headlight Switches",
      "Ignition Coils",
      "Fuel Pumps",
      "Starter Motors",
      "Fuses",
      "Relays",
      "Fuse Boxes",
      "Ignition Switches",
      "Wiring Connectors",
      "Headlights",
      "Tail Lights",
      "Head , Tail & Turn Signal Light Switches",
      "Heater",
    ],
  },
  {
    name: "Suspension",
    subcategories: [
      "Shock Absorbers",
      "Front Shocks",
      "Rear Shocks",
      "Strut Bars",
    ],
  },
  {
    name: "Cooling System",
    subcategories: [
      "Radiators",
      "Water Pumps",
      "Radiator Fan Motors",
      "AC Condensers",
    ],
  },
  {
    name: "Exhaust",
    subcategories: [
      "Exhaust Pipes",
      "Mufflers",
      "Catalytic Converters",
      "Exhaust Manifolds",
    ],
  },
  {
    name: "Body Parts",
    subcategories: [
      "Bonnet",
      "Doors",
      "Fender",
      "Front buffer",
      "Rear buffer",
      "Side mirrors",
      "Dickey door",
      "Fuel body cap",
      "Mudlaps",
      "Door Handles",
      "Inner guards",
      "Spoiler",
      "Side skirts",
      "Buffer Lips",
      "Dickey Garnish",
      "Windscreens",
      "Door Window Glass",
      "Shells"
    ],
  },
  {
    name: "Locks",
    subcategories: [
      "Inner Door Locks",
      "Outer Door Locks",
      "Dickey Locks",
      "Bonnet Locks",
      "Steering Lock",
      "Ignition Lock",
      "Fuel Cap Lock",
      "Glove Box Lock",
      "Tool Box Lock",
    ],
  },
  {
    name: "Lights",
    subcategories: [
      "Head lights",
      "Parking lights",
      "Signal lights",
      "Fender signal lights",
      "Fog lights",
      "Tail lights",
    ],
  },
  {
    name: "Interior Parts",
    subcategories: [
      "Dashboard",
      "Door Boards",
      "Steering Wheels",
      "Steering Columns",
      "Airbags",
      "Seat Belts",
      "Headliners",
      "Sun Visors",
      "Rear View Mirrors",
      "Door Handles",
      "Plastic Parts",
    ],
  },
];

export interface Product {
  id?: string;
  name: string;
  description?: string;
  price?: number;
  category?: string; // Main category (category group name)
  subcategory: string; // Subcategory within the category group
  vehicleType?: string[];
  brand?: string;
  partNumber?: string;
  stockQuantity: number;
  images: string[];
  featured: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  discountPercentage?: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

// Updated Category type to handle groups
export type Category =
  | "Engines & Engine Parts"
  | "Brake System"
  | "Transmission"
  | "Electrical"
  | "Suspension"
  | "Cooling System"
  | "Exhaust"
  | "Body Parts"
  | "Lights"
  | "Interior Parts"
  | "Locks";

// Categories will now be derived from categoryGroups
export const categories: Category[] = categoryGroups
  .map((group) => group.name)
  .filter((name): name is Category =>
    (
      [
        "Engines & Engine Parts",
        "Brake System",
        "Transmission",
        "Electrical",
        "Suspension",
        "Cooling System",
        "Exhaust",
        "Body Parts",
        "Lights",
        "Interior Parts",
        "Locks",
      ] as readonly string[]
    ).includes(name)
  ) as Category[];

// Vehicle Types
export type VehicleType =
  | "Sedan"
  | "SUV"
  | "Truck"
  | "Van"
  | "Motorcycle"
  | "Hatchback"
  | "Commercial";
