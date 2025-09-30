import { useState, useEffect, useRef } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { PriceFormatter } from "@/components/ui/price-formatter";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { useProductStore } from "@/lib/product-store";

import { Product } from "@/types";
import {
  Search,
  Pencil,
  Trash,
  Plus,
  Check,
  X,
  Loader,
  Download,
  Upload,
} from "lucide-react";
import { ProductForm } from "./product-form";

export function ProductList() {
  const {
    products,
    fetchProducts,
    deleteProduct,
    addProduct,
    updateProduct,
    loading,
    error,
  } = useProductStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importStats, setImportStats] = useState<{
    added: number;
    updated: number;
    errors: number;
  } | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch products on component mount
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Filter products based on search term
  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.partNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.brand?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate discounted price
  const calculateDiscountedPrice = (originalPrice: number, discountPercentage: number) => {
    if (!discountPercentage || discountPercentage <= 0) return originalPrice;
    return originalPrice * (1 - discountPercentage / 100);
  };

  // Parse CSV file and return array of objects
  const parseCSV = (csvText: string) => {
    const lines = csvText.split("\n");
    const headers = lines[0].split(",").map(
      (header) => header.trim().replace(/^"(.*)"$/, "$1") // Remove quotes
    );

    const results = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue; // Skip empty lines

      // Handle quoted values with commas within them
      const values = [];
      let isQuoted = false;
      let currentValue = "";

      for (let char of lines[i]) {
        if (char === '"') {
          isQuoted = !isQuoted;
        } else if (char === "," && !isQuoted) {
          values.push(currentValue);
          currentValue = "";
        } else {
          currentValue += char;
        }
      }
      values.push(currentValue); // Add the last value

      // Create object with header keys and values
      const obj: Record<string, any> = {};
      for (let j = 0; j < headers.length; j++) {
        if (j < values.length) {
          let value = values[j].replace(/^"(.*)"$/, "$1"); // Remove quotes

          // Convert numeric values
          if (!isNaN(Number(value)) && value.trim() !== "") {
            if (
              headers[j].toLowerCase().includes("price") ||
              headers[j].toLowerCase().includes("discount") ||
              headers[j].toLowerCase().includes("quantity") ||
              headers[j].toLowerCase().includes("stock")
            ) {
              obj[headers[j]] = Number(value);
              continue;
            }
          }

          // Convert boolean values
          if (value.toLowerCase() === "true" || value.toLowerCase() === "yes") {
            obj[headers[j]] = true;
          } else if (
            value.toLowerCase() === "false" ||
            value.toLowerCase() === "no"
          ) {
            obj[headers[j]] = false;
          } else {
            obj[headers[j]] = value;
          }
        }
      }

      results.push(obj);
    }

    return results;
  };

  // Convert parsed CSV data to product objects
  const convertToProducts = (parsedData: Record<string, any>[]) => {
    return parsedData
      .map((item) => {
        // Create a new product object with appropriate field mapping
        const product: Partial<Product> = {
          name: "", // Required field
          subcategory: "", // Required field
          stockQuantity: 0, // Required field
          images: [], // Required field
          featured: false, // Required field
        };

        // Map fields from CSV to Product interface
        if (item["ID"]) product.id = item["ID"];
        if (item["Product Name"]) product.name = item["Product Name"];
        if (item["Part Number"]) product.partNumber = item["Part Number"];
        if (item["Brand"]) product.brand = item["Brand"];
        if (item["Description"]) product.description = item["Description"];
        if (item["Category"]) product.category = item["Category"];
        if (item["Subcategory"]) product.subcategory = item["Subcategory"];

        // Handle vehicle type as array
        if (item["Vehicle Type"]) {
          // Check if value appears to be an array in string form
          if (
            item["Vehicle Type"].startsWith("[") &&
            item["Vehicle Type"].endsWith("]")
          ) {
            try {
              product.vehicleType = JSON.parse(item["Vehicle Type"]);
            } catch (e) {
              // If parsing fails, treat as comma-separated string
              product.vehicleType = item["Vehicle Type"]
                .split(",")
                .map((v) => v.trim())
                .filter((v) => v);
            }
          } else {
            // Treat as single value or comma-separated list
            product.vehicleType = item["Vehicle Type"]
              .split(",")
              .map((v) => v.trim())
              .filter((v) => v);
          }
        }

        // Handle numeric fields
        if (item["Price"] !== undefined) product.price = Number(item["Price"]);
        if (item["Discount Percentage"] !== undefined)
          product.discountPercentage = Number(item["Discount Percentage"]);
        if (item["Stock Quantity"] !== undefined)
          product.stockQuantity = Number(item["Stock Quantity"]);

        // Handle boolean fields
        if (item["Featured"] !== undefined) {
          product.featured =
            item["Featured"] === true ||
            item["Featured"] === "true" ||
            item["Featured"] === "Yes" ||
            item["Featured"] === "yes";
        }

        // Handle date fields
        if (item["Created At"] && item["Created At"].trim()) {
          product.createdAt = new Date(item["Created At"]);
        }
        if (item["Updated At"] && item["Updated At"].trim()) {
          product.updatedAt = new Date(item["Updated At"]);
        }

        // Handle image fields - collect them into an array
        const images: string[] = [];

        // Check for main image
        if (item["Main Image URL"] && item["Main Image URL"].trim()) {
          images.push(item["Main Image URL"]);
        }

        // Collect additional images
        for (let i = 2; i <= 20; i++) {
          // Allow up to 20 images
          const key = `Image URL ${i}`;
          if (item[key] && item[key].trim()) {
            images.push(item[key]);
          }
        }

        // If no specific image fields are found, check for direct 'images' field
        if (images.length === 0 && item["Images"]) {
          try {
            // Try to parse as JSON
            const parsedImages = JSON.parse(item["Images"]);
            if (Array.isArray(parsedImages)) {
              images.push(...parsedImages);
            }
          } catch (e) {
            // If parsing fails, treat as comma-separated string
            const splitImages = item["Images"]
              .split(",")
              .map((img) => img.trim())
              .filter((img) => img);
            images.push(...splitImages);
          }
        }

        // Set images array
        if (images.length > 0) {
          product.images = images;
        }

        return product as Product;
      })
      .filter((product) => {
        // Validate required fields
        return product.name && product.subcategory && product.images.length > 0;
      });
  };

  // Import products from CSV file
  const importFromCSV = async (file: File) => {
    setImportLoading(true);
    setImportError(null);
    setImportStats(null);

    try {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const csvText = e.target?.result as string;
          const parsedData = parseCSV(csvText);
          const productsToImport = convertToProducts(parsedData);

          if (productsToImport.length === 0) {
            setImportError(
              "No valid products found in the CSV file. Please check the format."
            );
            setImportLoading(false);
            return;
          }

          // Import statistics
          const stats = { added: 0, updated: 0, errors: 0 };

          // Process each product
          for (const product of productsToImport) {
            try {
              if (product.id) {
                // If product has ID, update it
                await updateProduct(product);
                stats.updated++;
              } else {
                // Otherwise add as new product
                await addProduct(product);
                stats.added++;
              }
            } catch (error) {
              console.error("Error importing product:", product, error);
              stats.errors++;
            }
          }

          // Update stats and refresh product list
          setImportStats(stats);
          fetchProducts();
        } catch (error) {
          console.error("Error processing CSV:", error);
          setImportError(
            "Failed to process CSV file. Please ensure it's in the correct format."
          );
        } finally {
          setImportLoading(false);
        }
      };

      reader.onerror = () => {
        setImportError("Error reading the file");
        setImportLoading(false);
      };

      reader.readAsText(file);
    } catch (error) {
      setImportError("Error reading the file");
      setImportLoading(false);
    }
  };

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type === "text/csv" || file.name.endsWith(".csv")) {
        importFromCSV(file);
      } else {
        setImportError("Please select a valid CSV file");
      }
    }
  };

  // Export products to CSV with all fields
  const exportToCSV = () => {
    // Determine the maximum number of images any product has to create appropriate headers
    let maxImagesCount = 0;

    filteredProducts.forEach((product) => {
      // Update max images count
      maxImagesCount = Math.max(maxImagesCount, product.images.length);
    });

    // Create image column headers based on the maximum number found
    const imageHeaders = Array.from({ length: maxImagesCount }, (_, i) =>
      i === 0 ? "Main Image URL" : `Image URL ${i + 1}`
    );

    // Define comprehensive CSV headers including individual image columns
    const headers = [
      "ID",
      "Part Number",
      "Product Name",
      "Brand",
      "Description",
      "Category",
      "Subcategory",
      "Vehicle Type",
      "Price",
      "Discount Percentage",
      "Discounted Price", // Added discounted price column
      "Stock Quantity",
      "Featured",
      ...imageHeaders,
      "Created At",
      "Updated At",
    ];

    // Convert products data to CSV rows with ALL fields
    const productRows = filteredProducts.map((product) => {
      // Calculate discounted price
      const discountedPrice = calculateDiscountedPrice(
        product.price || 0,
        product.discountPercentage || 0
      );

      // Fill in image URLs or empty strings for each column
      const imageValues = Array.from({ length: maxImagesCount }, (_, i) =>
        i < product.images.length ? product.images[i] : ""
      );

      // Format vehicleType array as string
      const vehicleTypeString = product.vehicleType
        ? Array.isArray(product.vehicleType)
          ? product.vehicleType.join(", ")
          : product.vehicleType
        : "";

      // Build the complete row with all product data
      return [
        product.id || "",
        product.partNumber || "",
        product.name || "",
        product.brand || "",
        product.description || "",
        product.category || "",
        product.subcategory || "",
        vehicleTypeString,
        product.price?.toString() || "0",
        product.discountPercentage?.toString() || "0",
        discountedPrice.toString(), // Add the calculated discounted price
        product.stockQuantity?.toString() || "0",
        product.featured ? "Yes" : "No",
        ...imageValues,
        product.createdAt ? product.createdAt : "",
        product.updatedAt ? product.updatedAt : "",
      ];
    });

    // Combine headers and data
    const csvContent = [
      headers.join(","),
      ...productRows.map((row) =>
        row
          .map((cell) => {
            // Properly escape fields with commas, quotes, or newlines
            const escaped = cell.toString().replace(/"/g, '""');
            return `"${escaped}"`;
          })
          .join(",")
      ),
    ].join("\n");

    // Create blob and download link
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    // Set up and trigger download
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `products-export-${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Action bar */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={exportToCSV}
            className="gap-2"
            disabled={loading || filteredProducts.length === 0}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>

          <Button
            variant="outline"
            onClick={() => setShowImportDialog(true)}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            Import CSV
          </Button>

          <Button
            onClick={() => setShowAddForm(!showAddForm)}
            className="gap-1"
          >
            <Plus className="h-4 w-4" />
            {showAddForm ? "Cancel" : "Add New Product"}
          </Button>
        </div>
      </div>

      {/* CSV Import Dialog */}
      <AlertDialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Import Products from CSV</AlertDialogTitle>
            <AlertDialogDescription>
              Upload a CSV file to import products. The CSV should match the
              format of the exported CSV.
              <div className="mt-2 text-sm">
                <strong>Required fields:</strong> Product Name, Subcategory, at
                least one image URL, and Stock Quantity
              </div>
              <div className="mt-2 text-sm">
                Products with an ID will be updated, others will be added as new
                products.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-4">
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv"
              onChange={handleFileInputChange}
              className="hidden"
            />

            <Button
              onClick={() => fileInputRef.current?.click()}
              className="w-full"
              disabled={importLoading}
            >
              {importLoading ? (
                <>
                  <Loader className="mr-2 h-4 w-4 animate-spin" /> Importing...
                </>
              ) : (
                <>Select CSV File</>
              )}
            </Button>

            {importError && (
              <div className="mt-3 p-3 text-sm text-red-600 bg-red-50 rounded-md">
                {importError}
              </div>
            )}

            {importStats && (
              <div className="mt-3 p-3 text-sm bg-green-50 text-green-800 rounded-md">
                Import completed:
                <ul className="mt-1 list-disc list-inside">
                  <li>{importStats.added} new products added</li>
                  <li>{importStats.updated} existing products updated</li>
                  {importStats.errors > 0 && (
                    <li className="text-amber-600">
                      {importStats.errors} errors encountered
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add/Edit Product Form */}
      {(showAddForm || editProduct) && (
        <div className="mb-6">
          <ProductForm
            editProduct={editProduct || undefined}
            onSubmit={() => {
              setShowAddForm(false);
              setEditProduct(null);
              // Refresh products after submission
              fetchProducts();
            }}
            onCancel={() => setIsEditing(false)}
          />
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-md border border-red-200">
          Error: {error}
        </div>
      )}

      {/* Products Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Part Number</TableHead>
              <TableHead>Product Name</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Sub-Category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Discount</TableHead>
              <TableHead>Final Price</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Featured</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8">
                  <div className="flex justify-center items-center gap-2">
                    <Loader className="h-5 w-5 animate-spin" />
                    <span>Loading products...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={10}
                  className="text-center py-6 text-muted-foreground"
                >
                  No products found.
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product, index) => {
                const hasDiscount = product.discountPercentage > 0;
                const originalPrice = product.price || 0;
                const finalPrice = calculateDiscountedPrice(
                  originalPrice,
                  product.discountPercentage || 0
                );
                
                return (
                  <TableRow key={product.id || index}>
                    <TableCell className="font-mono">
                      {product.partNumber || "N/A"}
                    </TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>{product.brand || "N/A"}</TableCell>
                    <TableCell>{product.category}</TableCell>
                    <TableCell>{product.subcategory}</TableCell>
                    <TableCell className={hasDiscount ? "line-through text-muted-foreground" : ""}>
                      <PriceFormatter price={originalPrice} />
                    </TableCell>
                    <TableCell>
                      {product.discountPercentage > 0 ? (
                        <span className="text-green-600 font-medium">
                          {product.discountPercentage}%
                        </span>
                      ) : (
                        "None"
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      <PriceFormatter price={finalPrice} />
                    </TableCell>
                    <TableCell>{product.stockQuantity || 0}</TableCell>
                    <TableCell>
                      {product.featured ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditProduct(product)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>

                        <AlertDialog
                          open={productToDelete === product.id}
                          onOpenChange={(open) => {
                            if (!open) setProductToDelete(null);
                          }}
                        >
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() => setProductToDelete(product.id)}
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Product</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{product.name}"?
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground"
                                onClick={async () => {
                                  try {
                                    await deleteProduct(product.id!);
                                    setProductToDelete(null);
                                  } catch (error) {
                                    console.error(
                                      "Failed to delete product:",
                                      error
                                    );
                                  }
                                }}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}