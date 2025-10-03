import { useState, useEffect } from "react";
import { Product, categories, categoryGroups } from "@/types";
import { useProductStore } from "@/lib/product-store";
import { brands } from "@/lib/data";

interface ProductFormProps {
  editProduct?: Product;
  onSubmit?: () => void;
  onCancel?: () => void; // Make sure parent component passes this function
}

export function ProductForm({ editProduct, onSubmit, onCancel }: ProductFormProps) {
  const { addProduct, updateProduct } = useProductStore();

  // Define empty product for initial state
  const emptyProduct: Product = {
    name: "",
    description: "",
    price: 0,
    category: "",
    subcategory: "",
    vehicleType: [],
    brand: "",
    partNumber: "",
    stockQuantity: 0,
    images: [],
    featured: false,
    discountPercentage: 0,
  };

  const [product, setProduct] = useState<Product>(editProduct || emptyProduct);
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [availableSubcategories, setAvailableSubcategories] = useState<
    string[]
  >([]);
  const [submissionStatus, setSubmissionStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");

  // Initialize form if editProduct changes
  useEffect(() => {
    if (editProduct) {
      setProduct(editProduct);

      // Set available subcategories based on the category
      const categoryGroup = categoryGroups.find(
        (group) => group.name === editProduct.category
      );
      if (categoryGroup) {
        setAvailableSubcategories(categoryGroup.subcategories);
      }
    }
  }, [editProduct]);

  // Handle input changes
  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setProduct((prev) => ({ ...prev, [name]: value }));
  };

  // Handle category selection
  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setProduct((prev) => ({ ...prev, category: value, subcategory: "" }));

    // Update available subcategories
    const categoryGroup = categoryGroups.find((group) => group.name === value);
    if (categoryGroup) {
      setAvailableSubcategories(categoryGroup.subcategories);
    } else {
      setAvailableSubcategories([]);
    }
  };

  // Handle vehicle type selection (multiple)
  const handleVehicleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(e.target.selectedOptions).map(
      (option) => option.value
    );
    setProduct((prev) => ({ ...prev, vehicleType: selectedOptions }));
  };

  // Handle image file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...selectedFiles]);

      // Create preview URLs
      const newPreviewUrls = selectedFiles.map((file) =>
        URL.createObjectURL(file)
      );
      setPreviewUrls((prev) => [...prev, ...newPreviewUrls]);
    }
  };

  // Handle removing an image preview
  const handleRemoveImage = (index: number) => {
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle existing image removal
  const handleRemoveExistingImage = (index: number) => {
    setProduct((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmissionStatus("loading");

    try {
      // Step 1: Upload images if any are selected
      let imageUrls = [...product.images];

      if (files.length > 0) {
        const uploadedUrls = await uploadImages(files);
        imageUrls = [...imageUrls, ...uploadedUrls];
      }

      // Add validation for required fields
      if (
        !product.name ||
        product.price === undefined ||
        isNaN(Number(product.price))
      ) {
        console.error(
          "Missing required fields: name and valid price are required"
        );
        setSubmissionStatus("error");
        return;
      }

      // Step 2: Create or update product with image URLs and properly formatted data
      const updatedProduct = {
        ...product,
        images: imageUrls,
        price: Number(product.price),
        stockQuantity: Number(product.stockQuantity || 0),
        discountPercentage: Number(product.discountPercentage || 0),
        // Keep vehicleType as an array - do NOT join it to a string
        vehicleType: Array.isArray(product.vehicleType)
          ? product.vehicleType
          : product.vehicleType
          ? [product.vehicleType]
          : [],
      } as Product;

      console.log("Submitting product data:", updatedProduct);

      if (editProduct?.id) {
        await updateProduct({
          ...updatedProduct,
          id: editProduct.id,
          category: updatedProduct.category || '', // Ensure category is not undefined
          vehicleType: updatedProduct.vehicleType,
          price: updatedProduct.price ?? 0, // Ensure price is defined
        });
      } else {
        await addProduct({
          ...updatedProduct,
          vehicleType: updatedProduct.vehicleType,
          price: updatedProduct.price ?? 0,
          category: updatedProduct.category || '', // Ensure category is not undefined
        });
      }

      // Reset form on success
      if (!editProduct) {
        setProduct(emptyProduct);
        setFiles([]);
        setPreviewUrls([]);
      }

      setSubmissionStatus("success");
      if (onSubmit) onSubmit();
    } catch (err) {
      console.error(
        "Failed to submit product:",
        err,
        typeof err === "object" ? (err as Error).message : ""
      );
      setSubmissionStatus("error");
    }
  };

  // Handle cancel button click
  // Ensure we call the onCancel prop function passed from parent component
  const handleCancel = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent any form submission
    if (onCancel) {
      onCancel(); // This should close the menu in the parent component
    }
  };

  // Placeholder for image upload function
  const uploadImages = async (files: File[]): Promise<string[]> => {
    if (!files.length) return [];

    const formData = new FormData();
    files.forEach((file) => {
      formData.append("images", file);
    });

    try {
      const API_URL = "https://sisira-auto-cart.onrender.com";
      const response = await fetch(`${API_URL}/api/upload-images`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Image upload failed:", errorData);
        throw new Error(errorData.message || "Failed to upload images");
      }

      const result = await response.json();
      console.log("Upload successful:", result);
      return result.imageUrls || [];
    } catch (error) {
      console.error("Error uploading images:", error);
      throw error;
    }
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Product Basic Info */}
      <div className="space-y-4">
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-gray-700"
          >
            Product Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            placeholder="Enter Product Name"
            value={product.name}
            onChange={handleChange}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium text-gray-700"
          >
            Description
          </label>
          <textarea
            id="description"
            placeholder="Enter Product Description"
            name="description"
            value={product.description}
            onChange={handleChange}
            rows={4}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div>
          <label
            htmlFor="price"
            className="block text-sm font-medium text-gray-700"
          >
            Price
          </label>
          <input
            type="number"
            id="price"
            name="price"
            value={product.price}
            onChange={handleChange}
            required
            min="0"
            step="0.01"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Category Selection */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="category"
            className="block text-sm font-medium text-gray-700"
          >
            Category
          </label>
          <select
            id="category"
            name="category"
            value={product.category}
            onChange={handleCategoryChange}
            required
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
          >
            <option value="" disabled>
              Select a category
            </option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        {/* Subcategory Selection */}
        <div>
          <label
            htmlFor="subcategory"
            className="block text-sm font-medium text-gray-700"
          >
            Subcategory
          </label>
          <select
            id="subcategory"
            name="subcategory"
            value={product.subcategory}
            onChange={handleChange}
            required
            disabled={!product.category}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md disabled:bg-gray-100 disabled:text-gray-500"
          >
            <option value="" disabled>
              Select a subcategory
            </option>
            {availableSubcategories.map((subcategory) => (
              <option key={subcategory} value={subcategory}>
                {subcategory}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Vehicle Type Selection */}
      <div>
        <label
          htmlFor="vehicleType"
          className="block text-sm font-medium text-gray-700"
        >
          Vehicle Type
        </label>
        <select
          id="vehicleType"
          name="vehicleType"
          value={product.vehicleType[0] || ""}
          onChange={handleVehicleChange}
          className="mt-1 block w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        >
          <option value="">Select a vehicle type</option>
          {[
            "Sedan",
            "SUV",
            "Truck",
            "Van",
            "Motorcycle",
            "Hatchback",
            "Commercial",
          ].map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      {/* Brand & Part Number */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="brand"
            className="block text-sm font-medium text-gray-700"
          >
            Brand
          </label>
          <select
            id="brand"
            name="brand"
            value={product.brand}
            onChange={handleChange}
            required
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
          >
            <option value="" disabled>
              Select a brand
            </option>
            {brands.map((brand) => (
              <option key={brand} value={brand}>
                {brand}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="partNumber"
            className="block text-sm font-medium text-gray-700"
          >
            Part Number
          </label>
          <input
            type="text"
            id="partNumber"
            name="partNumber"
            placeholder="Enter Part Number"
            value={product.partNumber}
            onChange={handleChange}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Stock Quantity & Featured */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="stockQuantity"
            className="block text-sm font-medium text-gray-700"
          >
            Stock Quantity
          </label>
          <input
            type="number"
            id="stockQuantity"
            name="stockQuantity"
            value={product.stockQuantity}
            onChange={handleChange}
            required
            min="0"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div className="flex items-center h-full pt-6">
          <input
            type="checkbox"
            id="featured"
            name="featured"
            checked={product.featured}
            onChange={(e) =>
              setProduct((prev) => ({ ...prev, featured: e.target.checked }))
            }
            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
          />
          <label
            htmlFor="featured"
            className="ml-2 block text-sm text-gray-900"
          >
            Featured Product
          </label>
        </div>
      </div>

      {/* Optional Discount */}
      <div>
        <label
          htmlFor="discountPercentage"
          className="block text-sm font-medium text-gray-700"
        >
          Discount Percentage (Optional)
        </label>
        <input
          type="number"
          id="discountPercentage"
          name="discountPercentage"
          placeholder="Enter Discount Percentage"
          value={product.discountPercentage || ""}
          onChange={handleChange}
          min="0"
          max="100"
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      {/* Image Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Product Images
        </label>
        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
          <div className="space-y-1 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
              aria-hidden="true"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="flex text-sm text-gray-600">
              <label
                htmlFor="file-upload"
                className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
              >
                <span>Upload files</span>
                <input
                  id="file-upload"
                  name="file-upload"
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileChange}
                  className="sr-only"
                />
              </label>
              <p className="pl-1">or drag and drop</p>
            </div>
            <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
          </div>
        </div>
      </div>

      {/* Image Previews */}
      {(previewUrls.length > 0 || product.images.length > 0) && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            Image Previews
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* Existing product images */}
            {product.images.map((imageUrl, index) => (
              <div key={`existing-${index}`} className="relative">
                <img
                  src={imageUrl}
                  alt={`Product ${index}`}
                  className="h-24 w-full object-cover rounded-md"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveExistingImage(index)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center"
                >
                  ×
                </button>
              </div>
            ))}

            {/* New image previews */}
            {previewUrls.map((url, index) => (
              <div key={`preview-${index}`} className="relative">
                <img
                  src={url}
                  alt={`Preview ${index}`}
                  className="h-24 w-full object-cover rounded-md"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveImage(index)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submission Status */}
      {submissionStatus === "success" && (
        <div className="bg-green-50 border border-green-400 text-green-700 px-4 py-3 rounded">
          Product saved successfully!
        </div>
      )}

      {submissionStatus === "error" && (
        <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded">
          Error saving product. Please try again.
        </div>
      )}

      {/* Form Actions - Updated Cancel button with proper event handling */}
      <div className="flex justify-end space-x-4">
        {/* <button
          type="button" // Important: type="button" prevents form submission
          onClick={handleCancel}
          className="py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Cancel
        </button> */}
        <button
          type="submit"
          disabled={submissionStatus === "loading"}
          className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {submissionStatus === "loading"
            ? "Saving..."
            : editProduct
            ? "Update Product"
            : "Create Product"}
        </button>
      </div>
    </form>
  );
}