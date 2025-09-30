import { useState, useEffect, useRef, useCallback } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { vehicleTypes, brands } from "@/lib/data";
import {
  X,
  RotateCw,
  SlidersHorizontal,
  ChevronRight,
  Search,
  ArrowLeft,
  Filter,
} from "lucide-react";
import { categoryGroups } from "@/types";

// Shuffle utility function
const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export function ProductFilters({
  selectedProducts,
  totalProducts,
  setSearchParams,
  searchParams,
  loading,
  searchQuery, // Add these new props
  setSearchQuery,
  onSearchChange,
  onSearchSubmit,
}) {
  const isInitialMount = useRef(true);

  // Local filter state (decoupled from URL)
  const [priceRange, setPriceRange] = useState([0, 20000]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedSubcategories, setSelectedSubcategories] = useState([]);
  const [selectedVehicles, setSelectedVehicles] = useState([]);
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [shuffleKey, setShuffleKey] = useState(Date.now());
  const [isOpen, setIsOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [filtersChanged, setFiltersChanged] = useState(false);

  // Mobile-specific state
  const [activeMobileSection, setActiveMobileSection] = useState(null);
  const [showSearchInput, setShowSearchInput] = useState(false);

  const updateSearchParams = useCallback(
    (immediate = false) => {
      const params = new URLSearchParams(searchParams);

      // Clear existing filter params
      params.delete("category");
      params.delete("subcategory");
      params.delete("vehicle");
      params.delete("brand");
      params.delete("minPrice");
      params.delete("maxPrice");
      params.delete("query"); // Clear existing query

      // Set new ones
      if (selectedCategories.length) {
        selectedCategories.forEach((cat) => params.append("category", cat));
      }

      if (selectedSubcategories.length) {
        selectedSubcategories.forEach((subcat) =>
          params.append("subcategory", subcat)
        );
      }

      if (selectedVehicles.length) {
        selectedVehicles.forEach((vehicle) =>
          params.append("vehicle", vehicle)
        );
      }

      if (selectedBrands.length) {
        selectedBrands.forEach((brand) => params.append("brand", brand));
      }

      if (priceRange[0] > 0) params.set("minPrice", priceRange[0].toString());
      if (priceRange[1] < 20000)
        params.set("maxPrice", priceRange[1].toString());

      if (searchQuery) params.set("query", searchQuery);

      // Add shuffle key for randomization
      params.set("shuffle", shuffleKey.toString());

      // Use React Router's setSearchParams
      if (immediate) {
        setSearchParams(params);
        setFiltersChanged(false);
      } else {
        const newUrl =
          window.location.pathname +
          (params.toString() ? `?${params.toString()}` : "");
        window.history.replaceState({}, "", newUrl);
      }
    },
    [
      searchParams,
      selectedCategories,
      selectedSubcategories,
      selectedVehicles,
      selectedBrands,
      priceRange,
      searchQuery,
      shuffleKey,
      setSearchParams,
    ]
  );

  // Debounce handlers
  const priceChangeTimeout = useRef(null);
  const urlUpdateTimeout = useRef(null);

  // Get active filter count for mobile badge
  const activeFilterCount =
    (selectedCategories.length > 0 ? 1 : 0) +
    (selectedSubcategories.length > 0 ? 1 : 0) +
    (selectedVehicles.length > 0 ? 1 : 0) +
    (selectedBrands.length > 0 ? 1 : 0) +
    (priceRange[0] > 0 || priceRange[1] < 20000 ? 1 : 0);

  // Initialize filters from URL params on first load
  useEffect(() => {
    // Only pull from URL on initial mount
    if (isInitialMount.current) {
      const category = searchParams.getAll("category");
      const subcategory = searchParams.getAll("subcategory");
      const vehicle = searchParams.getAll("vehicle");
      const brand = searchParams.getAll("brand");
      const minPrice = searchParams.get("minPrice");
      const maxPrice = searchParams.get("maxPrice");
      const query = searchParams.get("query");

      if (category.length) setSelectedCategories(category);
      if (subcategory.length) setSelectedSubcategories(subcategory);
      if (vehicle.length) setSelectedVehicles(vehicle);
      if (brand.length) setSelectedBrands(brand);
      if (minPrice && maxPrice)
        setPriceRange([parseInt(minPrice), parseInt(maxPrice)]);
      if (query) setSearchQuery(query);

      // Auto-expand categories that have selected subcategories
      if (subcategory.length) {
        const parentsToExpand = {};
        subcategory.forEach((subcat) => {
          const parentGroup = categoryGroups.find((g) =>
            g.subcategories.includes(subcat)
          );
          if (parentGroup) {
            parentsToExpand[parentGroup.name] = true;
          }
        });
        setExpandedCategories((prev) => ({ ...prev, ...parentsToExpand }));
      }

      isInitialMount.current = false;
    }
  }, [searchParams]);

  // Track filter changes
  useEffect(() => {
    if (!isInitialMount.current) {
      setFiltersChanged(true);
    }
  }, [
    priceRange,
    selectedCategories,
    selectedSubcategories,
    selectedVehicles,
    selectedBrands,
    searchQuery,
  ]);

  // Debounced URL update - this prevents URL updates for every tiny filter change
  // Add immediate check to prevent unnecessary URL updates
  useEffect(() => {
    // Skip first render
    if (isInitialMount.current) return;

    // Clear any existing timeout
    if (urlUpdateTimeout.current) {
      clearTimeout(urlUpdateTimeout.current);
    }

    // Set a new timeout to update URL params after 500ms of filter inactivity
    urlUpdateTimeout.current = setTimeout(() => {
      // We'll just mark that filters have changed, but not update the URL directly
      setFiltersChanged(true);
    }, 500);

    // Cleanup
    return () => {
      if (urlUpdateTimeout.current) {
        clearTimeout(urlUpdateTimeout.current);
      }
    };
  }, [
    priceRange,
    selectedCategories,
    selectedSubcategories,
    selectedVehicles,
    selectedBrands,
    searchQuery,
  ]);

  // Manually trigger shuffle without waiting for debounce
  useEffect(() => {
    if (!isInitialMount.current) {
      updateSearchParams(true);
    }
  }, [shuffleKey, updateSearchParams]);

  // Trigger a manual shuffle
  const shuffleProducts = () => {
    setShuffleKey(Date.now());
  };

  // Apply filters
  const applyFilters = () => {
    updateSearchParams(true);
    setIsOpen(false);
  };

  // Clear all filters
  const clearFilters = () => {
    setSelectedCategories([]);
    setSelectedSubcategories([]);
    setSelectedVehicles([]);
    setSelectedBrands([]);
    setPriceRange([0, 20000]);
    setSearchQuery("");
    setShuffleKey(Date.now());
    setFiltersChanged(false);

    // Clear all URL params except shuffle
    const newParams = new URLSearchParams();
    newParams.set("shuffle", Date.now().toString());
    setSearchParams(newParams);
  };

  // Toggle category selection - only for categories with no subcategories
  const toggleCategory = (category) => {
    const group = categoryGroups.find((g) => g.name === category);

    // If category has subcategories, we don't allow direct selection
    if (group && group.subcategories.length > 0) {
      // Instead, toggle the expanded state
      toggleExpandCategory(category);
      return;
    }

    // For categories without subcategories, allow selection
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  // Toggle subcategory selection
  const toggleSubcategory = (subcategory, parentCategory) => {
    setSelectedSubcategories((prev) => {
      const newSelection = prev.includes(subcategory)
        ? prev.filter((sc) => sc !== subcategory)
        : [...prev, subcategory];

      // Ensure parent category stays expanded when subcategories are selected
      if (!prev.includes(subcategory) && parentCategory) {
        setExpandedCategories((prevExpanded) => ({
          ...prevExpanded,
          [parentCategory]: true,
        }));
      }

      return newSelection;
    });
  };

  // Toggle category expanded state
  const toggleExpandCategory = (category) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  // Toggle vehicle type selection
  const toggleVehicleType = (vehicle) => {
    setSelectedVehicles((prev) =>
      prev.includes(vehicle)
        ? prev.filter((v) => v !== vehicle)
        : [...prev, vehicle]
    );
  };

  // Toggle brand selection
  const toggleBrand = (brand) => {
    setSelectedBrands((prev) =>
      prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand]
    );
  };

  // Handle price range with debounce
  const handlePriceChange = (value) => {
    // Update the UI immediately
    setPriceRange(value);

    // Debounce the actual parameter update
    clearTimeout(priceChangeTimeout.current);
    priceChangeTimeout.current = setTimeout(() => {
      setPriceRange(value);
    }, 300);
  };

  // Handle search input
  const handleSearchChange = (e) => {
    const newQuery = e.target.value;
    setSearchQuery(newQuery);

    // Clear any existing timeout
    if (urlUpdateTimeout.current) {
      clearTimeout(urlUpdateTimeout.current);
    }

    // Set a new timeout to update filters
    urlUpdateTimeout.current = setTimeout(() => {
      setFiltersChanged(true);
    }, 500);
  };

  // Check if a category has any selected subcategories
  const hasSelectedSubcategories = (categoryName) => {
    const group = categoryGroups.find((g) => g.name === categoryName);
    if (!group) return false;

    return group.subcategories.some((subcat) =>
      selectedSubcategories.includes(subcat)
    );
  };

  // Count selected subcategories for a category
  const getSelectedSubcategoriesCount = (categoryName) => {
    const group = categoryGroups.find((g) => g.name === categoryName);
    if (!group) return 0;

    return group.subcategories.filter((subcat) =>
      selectedSubcategories.includes(subcat)
    ).length;
  };

  // Get all selected filter items for display
  const getAllSelectedFilters = () => {
    // Get categories without subcategories that are selected
    const selectedCategoriesWithoutSubcats = selectedCategories.filter(
      (cat) => {
        const group = categoryGroups.find((g) => g.name === cat);
        return !group || group.subcategories.length === 0;
      }
    );

    // Map subcategories to their display format
    const selectedSubcatsWithParents = selectedSubcategories.map((subcat) => {
      const parentGroup = categoryGroups.find((g) =>
        g.subcategories.includes(subcat)
      );
      const parentName = parentGroup ? parentGroup.name : "";
      return { subcat, parentName };
    });

    return {
      categories: selectedCategoriesWithoutSubcats,
      subcategories: selectedSubcatsWithParents,
      vehicles: selectedVehicles,
      brands: selectedBrands,
      price: priceRange[0] > 0 || priceRange[1] < 20000,
    };
  };

  // Active filters display for mobile - redesigned for better space efficiency
  const ActiveFiltersDisplay = () => {
    if (activeFilterCount === 0) return null;

    const selectedFilters = getAllSelectedFilters();

    return (
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            Active filters
          </h3>
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-6 px-2 py-0 text-xs text-muted-foreground"
            >
              Clear all
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {selectedFilters.categories.map((category) => (
            <Badge
              key={`active-cat-${category}`}
              variant="outline"
              className="px-2 py-0.5 text-xs flex items-center gap-1 bg-primary/5"
            >
              {category}
              <button
                onClick={() => toggleCategory(category)}
                className="inline-flex items-center"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}

          {selectedFilters.subcategories.map(({ subcat, parentName }) => (
            <Badge
              key={`active-subcat-${subcat}`}
              variant="outline"
              className="px-2 py-0.5 text-xs flex items-center gap-1 bg-primary/5"
            >
              {parentName ? `${parentName}: ${subcat}` : subcat}
              <button
                onClick={() => toggleSubcategory(subcat, parentName)}
                className="inline-flex items-center"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}

          {selectedFilters.vehicles.map((vehicle) => (
            <Badge
              key={`active-vehicle-${vehicle}`}
              variant="outline"
              className="px-2 py-0.5 text-xs flex items-center gap-1 bg-primary/5"
            >
              {vehicle}
              <button
                onClick={() => toggleVehicleType(vehicle)}
                className="inline-flex items-center"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}

          {selectedFilters.brands.map((brand) => (
            <Badge
              key={`active-brand-${brand}`}
              variant="outline"
              className="px-2 py-0.5 text-xs flex items-center gap-1 bg-primary/5"
            >
              {brand}
              <button
                onClick={() => toggleBrand(brand)}
                className="inline-flex items-center"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}

          {selectedFilters.price && (
            <Badge
              variant="outline"
              className="px-2 py-0.5 text-xs bg-primary/5"
            >
              Rs. {priceRange[0].toLocaleString()} - Rs.{" "}
              {priceRange[1].toLocaleString()}
            </Badge>
          )}
        </div>
      </div>
    );
  };

  // Filter content - shared between desktop and mobile views
  const FilterContent = () => (
    <>
      {/* <div className="mb-6">
        <Label htmlFor="search-products" className="sr-only">
          Search
        </Label>
        <div className="flex gap-2">
          <Input
            id="search-products"
            placeholder="Search products..."
            value={searchQuery}
            onChange={onSearchChange}
            className="h-9"
          />
        </div>
      </div> */}

      <Accordion
        type="single"
        collapsible
        defaultValue="category"
        className="space-y-2"
      >
        <AccordionItem value="price" className="border-b-0">
          <AccordionTrigger className="py-2">
            Price Range
            {(priceRange[0] > 0 || priceRange[1] < 20000) && (
              <span className="ml-auto mr-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                Active
              </span>
            )}
          </AccordionTrigger>
          <AccordionContent>
            <div className="py-2">
              <Slider
                defaultValue={[0, 20000]}
                min={0}
                max={20000}
                step={100}
                value={priceRange}
                onValueChange={handlePriceChange}
                className="my-4"
              />
              <div className="flex justify-between text-sm">
                <span>Rs. {priceRange[0].toLocaleString()}</span>
                <span>Rs. {priceRange[1].toLocaleString()}</span>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="category" className="border-b-0">
          <AccordionTrigger className="py-2">
            Categories
            {(selectedCategories.length > 0 ||
              selectedSubcategories.length > 0) && (
              <span className="ml-auto mr-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {selectedCategories.length + selectedSubcategories.length}
              </span>
            )}
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2">
              {categoryGroups.map((group) => {
                const hasSelectedSubs = hasSelectedSubcategories(group.name);
                const selectedSubsCount = getSelectedSubcategoriesCount(
                  group.name
                );

                return (
                  <div key={group.name} className="mb-3">
                    <div
                      className={`flex items-center space-x-2 ${
                        hasSelectedSubs ? "text-primary font-medium" : ""
                      }`}
                    >
                      {/* Only show checkbox for categories without subcategories */}
                      {group.subcategories.length === 0 ? (
                        <>
                          <Checkbox
                            id={`category-${group.name}`}
                            checked={selectedCategories.includes(group.name)}
                            onCheckedChange={() => toggleCategory(group.name)}
                          />
                          <Label
                            htmlFor={`category-${group.name}`}
                            className="text-sm font-medium cursor-pointer"
                          >
                            {group.name}
                          </Label>
                        </>
                      ) : (
                        <>
                          {/* For categories with subcategories, no checkbox, just expand/collapse */}
                          <div className="w-4">
                            {hasSelectedSubs && (
                              <div className="w-2 h-2 rounded-full bg-primary"></div>
                            )}
                          </div>
                          <div
                            className="flex items-center justify-between w-full cursor-pointer"
                            onClick={() => toggleExpandCategory(group.name)}
                          >
                            <div className="flex items-center">
                              <span className="text-sm font-medium">
                                {group.name}
                              </span>
                              {hasSelectedSubs && (
                                <Badge
                                  variant="secondary"
                                  className="ml-2 text-xs px-1.5 py-0 h-5"
                                >
                                  {selectedSubsCount}
                                </Badge>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpandCategory(group.name);
                              }}
                            >
                              <ChevronRight
                                className={`h-4 w-4 transition-transform ${
                                  expandedCategories[group.name]
                                    ? "rotate-90"
                                    : ""
                                }`}
                              />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Subcategories */}
                    {expandedCategories[group.name] &&
                      group.subcategories.length > 0 && (
                        <div className="ml-6 mt-2 space-y-1">
                          {group.subcategories.map((subcategory) => (
                            <div
                              key={subcategory}
                              className="flex items-center space-x-2"
                            >
                              <Checkbox
                                id={`subcategory-${subcategory}`}
                                checked={selectedSubcategories.includes(
                                  subcategory
                                )}
                                onCheckedChange={() =>
                                  toggleSubcategory(subcategory, group.name)
                                }
                              />
                              <Label
                                htmlFor={`subcategory-${subcategory}`}
                                className={`text-sm cursor-pointer ${
                                  selectedSubcategories.includes(subcategory)
                                    ? "text-primary font-medium"
                                    : ""
                                }`}
                              >
                                {subcategory}
                              </Label>
                            </div>
                          ))}
                        </div>
                      )}
                  </div>
                );
              })}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="vehicle" className="border-b-0">
          <AccordionTrigger className="py-2">
            Vehicle Type
            {selectedVehicles.length > 0 && (
              <span className="ml-auto mr-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {selectedVehicles.length}
              </span>
            )}
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2">
              {vehicleTypes.map((vehicle) => (
                <div key={vehicle} className="flex items-center space-x-2">
                  <Checkbox
                    id={`vehicle-${vehicle}`}
                    checked={selectedVehicles.includes(vehicle)}
                    onCheckedChange={() => toggleVehicleType(vehicle)}
                  />
                  <Label
                    htmlFor={`vehicle-${vehicle}`}
                    className={`text-sm cursor-pointer ${
                      selectedVehicles.includes(vehicle)
                        ? "text-primary font-medium"
                        : ""
                    }`}
                  >
                    {vehicle}
                  </Label>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="brand" className="border-b-0">
          <AccordionTrigger className="py-2">
            Brands
            {selectedBrands.length > 0 && (
              <span className="ml-auto mr-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {selectedBrands.length}
              </span>
            )}
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {shuffleArray(brands).map((brand) => (
                <div key={brand} className="flex items-center space-x-2">
                  <Checkbox
                    id={`brand-${brand}`}
                    checked={selectedBrands.includes(brand)}
                    onCheckedChange={() => toggleBrand(brand)}
                  />
                  <Label
                    htmlFor={`brand-${brand}`}
                    className={`text-sm cursor-pointer ${
                      selectedBrands.includes(brand)
                        ? "text-primary font-medium"
                        : ""
                    }`}
                  >
                    {brand}
                  </Label>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </>
  );

  // New component for mobile filter sections
  const MobileFilterSection = ({ title, backFn, children }) => (
    <div className="flex flex-col h-full">
      <div className="flex items-center py-3 px-4 border-b sticky top-0 bg-white z-10">
        <Button
          variant="ghost"
          size="sm"
          className="mr-2 p-0 h-8 w-8"
          onClick={backFn}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h3 className="font-medium">{title}</h3>
      </div>
      <div className="flex-1 overflow-auto p-4">{children}</div>
    </div>
  );

  // Render specific mobile filter section based on active section
  const renderMobileFilterSection = () => {
    if (activeMobileSection === "price") {
      return (
        <MobileFilterSection
          title="Price Range"
          backFn={() => setActiveMobileSection(null)}
        >
          <div className="py-4">
            <Slider
              defaultValue={[0, 20000]}
              min={0}
              max={20000}
              step={100}
              value={priceRange}
              onValueChange={handlePriceChange}
              className="my-6"
            />
            <div className="flex justify-between text-sm mt-2">
              <span>Rs. {priceRange[0].toLocaleString()}</span>
              <span>Rs. {priceRange[1].toLocaleString()}</span>
            </div>
          </div>
        </MobileFilterSection>
      );
    }

    if (activeMobileSection === "category") {
      return (
        <MobileFilterSection
          title="Categories"
          backFn={() => setActiveMobileSection(null)}
        >
          <div className="space-y-3">
            {categoryGroups.map((group) => {
              const hasSelectedSubs = hasSelectedSubcategories(group.name);
              const selectedSubsCount = getSelectedSubcategoriesCount(
                group.name
              );

              return (
                <div key={group.name} className="py-1">
                  <div
                    className={`flex items-center space-x-2 ${
                      hasSelectedSubs ? "text-primary font-medium" : ""
                    }`}
                  >
                    {group.subcategories.length === 0 ? (
                      <>
                        <Checkbox
                          id={`category-mobile-${group.name}`}
                          checked={selectedCategories.includes(group.name)}
                          onCheckedChange={() => toggleCategory(group.name)}
                        />
                        <Label
                          htmlFor={`category-mobile-${group.name}`}
                          className="text-sm font-medium cursor-pointer flex-1"
                        >
                          {group.name}
                        </Label>
                      </>
                    ) : (
                      <>
                        <div className="w-4 h-4 flex items-center justify-center">
                          {hasSelectedSubs && (
                            <div className="w-2 h-2 rounded-full bg-primary"></div>
                          )}
                        </div>
                        <div
                          className="flex items-center justify-between w-full cursor-pointer"
                          onClick={() => toggleExpandCategory(group.name)}
                        >
                          <span className="text-sm font-medium">
                            {group.name}
                            {hasSelectedSubs && (
                              <span className="ml-2 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                                {selectedSubsCount}
                              </span>
                            )}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                          >
                            <ChevronRight
                              className={`h-4 w-4 transition-transform ${
                                expandedCategories[group.name]
                                  ? "rotate-90"
                                  : ""
                              }`}
                            />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Subcategories - improved spacing */}
                  {expandedCategories[group.name] &&
                    group.subcategories.length > 0 && (
                      <div className="ml-6 mt-3 space-y-2">
                        {group.subcategories.map((subcategory) => (
                          <div
                            key={subcategory}
                            className="flex items-center space-x-2 py-1"
                          >
                            <Checkbox
                              id={`subcategory-mobile-${subcategory}`}
                              checked={selectedSubcategories.includes(
                                subcategory
                              )}
                              onCheckedChange={() =>
                                toggleSubcategory(subcategory, group.name)
                              }
                            />
                            <Label
                              htmlFor={`subcategory-mobile-${subcategory}`}
                              className={`text-sm cursor-pointer ${
                                selectedSubcategories.includes(subcategory)
                                  ? "text-primary font-medium"
                                  : ""
                              }`}
                            >
                              {subcategory}
                            </Label>
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              );
            })}
          </div>
        </MobileFilterSection>
      );
    }

    if (activeMobileSection === "vehicle") {
      return (
        <MobileFilterSection
          title="Vehicle Type"
          backFn={() => setActiveMobileSection(null)}
        >
          <div className="space-y-2 py-2">
            {vehicleTypes.map((vehicle) => (
              <div key={vehicle} className="flex items-center space-x-2 py-2">
                <Checkbox
                  id={`vehicle-mobile-${vehicle}`}
                  checked={selectedVehicles.includes(vehicle)}
                  onCheckedChange={() => toggleVehicleType(vehicle)}
                />
                <Label
                  htmlFor={`vehicle-mobile-${vehicle}`}
                  className={`text-sm cursor-pointer ${
                    selectedVehicles.includes(vehicle)
                      ? "text-primary font-medium"
                      : ""
                  }`}
                >
                  {vehicle}
                </Label>
              </div>
            ))}
          </div>
        </MobileFilterSection>
      );
    }

    if (activeMobileSection === "brand") {
      return (
        <MobileFilterSection
          title="Brands"
          backFn={() => setActiveMobileSection(null)}
        >
          <div className="py-2">
            <Input
              placeholder="Search brands..."
              className="mb-4"
              onChange={(e) => {
                // You could add brand search functionality here
              }}
            />
            <div className="space-y-1">
              {shuffleArray(brands).map((brand) => (
                <div key={brand} className="flex items-center space-x-2 py-2">
                  <Checkbox
                    id={`brand-mobile-${brand}`}
                    checked={selectedBrands.includes(brand)}
                    onCheckedChange={() => toggleBrand(brand)}
                  />
                  <Label
                    htmlFor={`brand-mobile-${brand}`}
                    className={`text-sm cursor-pointer ${
                      selectedBrands.includes(brand)
                        ? "text-primary font-medium"
                        : ""
                    }`}
                  >
                    {brand}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </MobileFilterSection>
      );
    }

    // Main filter menu
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h3 className="font-medium text-lg">Filters</h3>
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={shuffleProducts}
              className="mr-2 h-8 w-8 p-0"
              title="Shuffle products"
            >
              <RotateCw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-8 text-xs text-muted-foreground"
            >
              Clear all
            </Button>
          </div>
        </div>

        <div className="p-4">
          <div className="relative mb-6">
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={onSearchChange}
              className="pr-8"
              autoFocus
            />
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
          </div>

          <div className="space-y-4">
            {/* Quick filter navigation items */}
            <div
              className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-slate-50"
              onClick={() => setActiveMobileSection("price")}
            >
              <div>
                <h4 className="font-medium">Price Range</h4>
                {(priceRange[0] > 0 || priceRange[1] < 20000) && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Rs. {priceRange[0].toLocaleString()} - Rs.{" "}
                    {priceRange[1].toLocaleString()}
                  </p>
                )}
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>

            <div
              className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-slate-50"
              onClick={() => setActiveMobileSection("category")}
            >
              <div>
                <h4 className="font-medium">Categories</h4>
                {(selectedCategories.length > 0 ||
                  selectedSubcategories.length > 0) && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedCategories.length + selectedSubcategories.length}{" "}
                    selected
                  </p>
                )}
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>

            <div
              className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-slate-50"
              onClick={() => setActiveMobileSection("vehicle")}
            >
              <div>
                <h4 className="font-medium">Vehicle Type</h4>
                {selectedVehicles.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedVehicles.length} selected
                  </p>
                )}
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>

            <div
              className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-slate-50"
              onClick={() => setActiveMobileSection("brand")}
            >
              <div>
                <h4 className="font-medium">Brands</h4>
                {selectedBrands.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedBrands.length} selected
                  </p>
                )}
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
        </div>

        <div className="mt-auto p-4 border-t">
          <Button
            className="w-full"
            onClick={() => {
              updateSearchParams(true);
              setIsOpen(false);
            }}
          >
            Apply Filters
          </Button>
        </div>
      </div>
    );
  };

  // Mobile filters - completely redesigned
  const MobileFilters = () => (
    <div className="md:hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1.5"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge className="ml-1 h-5 px-1.5 text-xs">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </DialogTrigger>
            <DialogContent className="p-0 w-full h-[85vh] max-h-[85vh] sm:max-w-md m-0 rounded-t-xl bottom-0 top-auto translate-y-0">
              {renderMobileFilterSection()}
            </DialogContent>
          </Dialog>

          <Button
            variant={showSearchInput ? "default" : "outline"}
            size="sm"
            className="flex items-center w-9 p-0 justify-center"
            onClick={() => setShowSearchInput(!showSearchInput)}
          >
            <Search className="h-4 w-4" />
          </Button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={shuffleProducts}
          className="h-8 w-8 p-0"
          title="Shuffle products"
        >
          <RotateCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Expandable search input for mobile */}
      {showSearchInput && (
        <div className="mb-4 relative animate-slideDown">
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="pr-8"
            autoFocus
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
              onClick={() => {
                // Call with empty string to clear
                onSearchChange({ target: { value: "" } });
                // Apply filters immediately
                setTimeout(() => updateSearchParams(true), 0);
              }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}

      <ActiveFiltersDisplay />
    </div>
  );

  // Desktop filters - unchanged
  const DesktopFilters = () => (
    <div className="hidden md:block bg-white rounded-lg border p-4 sticky top-20">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-lg">Filters</h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={shuffleProducts}
            className="h-8 px-2"
            title="Shuffle products"
          >
            <RotateCw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-8 px-2 text-muted-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        </div>
      </div>

      <FilterContent />

      <div className="text-xs text-muted-foreground mt-6 text-center">
        Filtering happens instantly
      </div>
    </div>
  );

  return (
    <>
      <MobileFilters />
      <DesktopFilters />
    </>
  );
}
