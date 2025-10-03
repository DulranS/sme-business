import { Link } from "react-router-dom";
import { categories, categoryGroups } from "@/types";
import { useState, useEffect } from "react";
import { Search, X } from "lucide-react";

// Category Item Component (only shows main category)
function CategoryItem({ category, categoryIcons, getCategoryUrl }) {
  return (
    <div className="flex flex-col bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      {/* Main Category Link */}
      <Link 
        to={getCategoryUrl(category)}
        className="flex items-center p-4 w-full text-left hover:bg-gray-50 transition-all duration-200"
      >
        <span className="text-2xl mr-3" aria-hidden="true">
          {categoryIcons[category] || '🔧'}
        </span>
        <span className="text-base font-medium">
          {category}
        </span>
      </Link>
    </div>
  );
}

// List View Category Item (only shows main category)
function ListViewCategoryItem({ category, categoryIcons, getCategoryUrl }) {
  return (
    <div className="mb-2 border border-gray-200 rounded overflow-hidden">
      <Link 
        to={getCategoryUrl(category)}
        className="flex items-center p-4 w-full text-left bg-white hover:bg-gray-50"
      >
        <span className="text-2xl mr-3" aria-hidden="true">
          {categoryIcons[category] || '🔧'}
        </span>
        <span className="text-base font-medium">
          {category}
        </span>
      </Link>
    </div>
  );
}

export function CategoryShowcase() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeView, setActiveView] = useState("grid"); // 'grid' or 'list'

  // Icons for categories (simplified with emoji for this example)
  const categoryIcons = {
    "Engines & Engine Parts": "🔧",
    "Brake System": "🛑",
    "Transmission": "⚙️",
    "Electrical": "⚡",
    "Suspension": "🔄",
    "Cooling System": "❄️",
    "Exhaust": "💨",
    "Body Parts": "🚗",
    "Lights": "💡",
    "Interior Parts": "🪑",
    "Locks": "🔒"
  };

  // Filter categories based on search term
  const filteredCategories = categories.filter((category) =>
    category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handle search clear
  const clearSearch = () => {
    setSearchTerm("");
  };

  // Create proper URL for category links
  const getCategoryUrl = (category) => {
    // Format matches how the ProductsPage component expects the query parameter
    return `/products?category=${encodeURIComponent(category)}`;
  };

  return (
    <div className="w-full bg-white md:bg-gray-50 md:rounded-lg md:shadow-sm">
      <div className="sticky top-0 z-10 bg-white p-4 border-b md:border-none">
        <h2 className="text-xl font-bold text-center mb-3">
          Browse By Category
        </h2>

        {/* Search input with responsive styling */}
        <div className="relative mb-3">
          <input
            type="text"
            placeholder="Search categories..."
            className="w-full p-3 pl-10 pr-10 border border-gray-300 rounded-full bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Search className="absolute left-3 top-3.5 text-gray-500" size={18} />
          {searchTerm && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* View toggle buttons (only on mobile) */}
        {/* <div className="flex justify-center space-x-2 mb-3 md:hidden">
          <button
            className={`px-4 py-2 rounded-full text-sm font-medium ${
              activeView === "grid"
                ? "bg-blue-500 text-white"
                : "bg-gray-100 text-gray-600"
            }`}
            onClick={() => setActiveView("grid")}
          >
            Grid View
          </button>
          <button
            className={`px-4 py-2 rounded-full text-sm font-medium ${
              activeView === "list"
                ? "bg-blue-500 text-white"
                : "bg-gray-100 text-gray-600"
            }`}
            onClick={() => setActiveView("list")}
          >
            List View
          </button>
        </div> */}
      </div>

      {/* Show No Results */}
      {filteredCategories.length === 0 && (
        <div className="text-center p-6 text-gray-500">
          <div className="text-5xl mb-3">🔍</div>
          <div className="font-medium mb-1">No categories found</div>
          <div className="text-sm">Try a different search term</div>
        </div>
      )}

      {/* Grid View */}
      {filteredCategories.length > 0 && (activeView === 'grid' || !activeView) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-2 md:p-4">
          {filteredCategories.map((category, index) => (
            <CategoryItem 
              key={index} 
              category={category} 
              categoryIcons={categoryIcons} 
              getCategoryUrl={getCategoryUrl}
            />
          ))}
        </div>
      )}

      {/* List View - Mobile only */}
      {/* {filteredCategories.length > 0 && activeView === 'list' && (
        <div className="md:hidden">
          {filteredCategories.map((category, index) => (
            <ListViewCategoryItem 
              key={index} 
              category={category} 
              categoryIcons={categoryIcons} 
              getCategoryUrl={getCategoryUrl}
            />
          ))}
        </div>
      )} */}
    </div>
  );
}