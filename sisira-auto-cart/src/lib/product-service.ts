import { Product } from "../types";
import axios from "axios";
const API_URL = "https://sisira-auto-cart.onrender.com/api";

// Define the API response types to match the backend
interface ProductsResponse {
  products: Product[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export async function fetchProducts(
  page = 1,
  limit = 50,
  filters?: {
    category?: string;
    subcategory?: string;
    brand?: string;
    featured?: boolean;
    search?: string;
    vehicleType?: string;
    sortBy?: string;
    order?: "asc" | "desc";
  }
): Promise<ProductsResponse> {
  // Build query parameters
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  // Add any filters if provided
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });
  }

  const response = await fetch(`${API_URL}/products?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch products: ${response.statusText}`);
  }

  return await response.json();
}

interface PaginatedResponse {
  products: Product[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export async function fetchFeaturedProducts(
  page = 1,
  limit = 10,
  filters?: {
    category?: string;
    vehicleType?: string;
    sortBy?: string;
    order?: "asc" | "desc";
  }
): Promise<{
  products: Product[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}> {
  try {
    // Build query parameters
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    
    // Add any filters if provided
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });
    }
    
    const response = await axios.get(
      `${API_URL}/featured-products?${params.toString()}`
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Failed to fetch featured products: ${
          error.response?.data?.message || error.message
        }`
      );
    }
    throw error;
  }
}

export async function fetchProductById(id: string): Promise<Product> {
  const response = await fetch(`${API_URL}/products/${id}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch product: ${response.statusText}`);
  }

  return await response.json();
}

export async function createProduct(
  product: Omit<Product, "id">
): Promise<Product> {
  const response = await fetch(`${API_URL}/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(product),
  });

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    throw new Error(`Failed to create product: ${errorData.message}`);
  }

  return await response.json();
}

export async function updateProduct(
  id: string,
  product: Partial<Product>
): Promise<Product> {
  const response = await fetch(`${API_URL}/products/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(product),
  });

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    throw new Error(`Failed to update product: ${errorData.message}`);
  }

  return await response.json();
}

export async function deleteProduct(
  id: string
): Promise<{ message: string; id: string }> {
  const response = await fetch(`${API_URL}/products/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    throw new Error(`Failed to delete product: ${errorData.message}`);
  }

  return await response.json();
}

export async function bulkDeleteProducts(ids: string[]): Promise<{
  message: string;
  deletedCount: number;
  imagesDeleted?: number;
}> {
  const response = await fetch(`${API_URL}/products/bulk-delete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ids }),
  });

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    throw new Error(`Failed to bulk delete products: ${errorData.message}`);
  }

  return await response.json();
}

export async function bulkUpdateFeatured(
  ids: string[],
  featured: boolean
): Promise<{
  message: string;
  updatedCount: number;
}> {
  const response = await fetch(`${API_URL}/products/bulk-update-featured`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ids, featured }),
  });

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    throw new Error(`Failed to update featured status: ${errorData.message}`);
  }

  return await response.json();
}

export async function uploadImages(
  files: File[]
): Promise<{ imageUrls: string[] }> {
  const formData = new FormData();

  files.forEach((file) => {
    formData.append("images", file);
  });

  const response = await fetch(`${API_URL}/upload-images`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    throw new Error(`Failed to upload images: ${errorData.message}`);
  }

  return await response.json();
}

export async function fetchCategories(): Promise<
  Array<{ name: string; subcategories: string[] }>
> {
  const response = await fetch(`${API_URL}/categories`);

  if (!response.ok) {
    throw new Error(`Failed to fetch categories: ${response.statusText}`);
  }

  return await response.json();
}

export async function fetchSubcategories(
  categoryName: string
): Promise<string[]> {
  const response = await fetch(
    `${API_URL}/categories/${encodeURIComponent(categoryName)}/subcategories`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch subcategories: ${response.statusText}`);
  }

  return await response.json();
}

export async function fetchVehicleTypes(): Promise<string[]> {
  const response = await fetch(`${API_URL}/vehicle-types`);

  if (!response.ok) {
    throw new Error(`Failed to fetch vehicle types: ${response.statusText}`);
  }

  return await response.json();
}

export async function fetchBrands(): Promise<string[]> {
  const response = await fetch(`${API_URL}/brands`);

  if (!response.ok) {
    throw new Error(`Failed to fetch brands: ${response.statusText}`);
  }

  return await response.json();
}

export async function fetchStats(): Promise<{
  totalProducts: number;
  featuredProducts: number;
  vehicleTypeCounts: Record<string, number>;
  categoryCounts: Record<string, number>;
}> {
  const response = await fetch(`${API_URL}/stats`);

  if (!response.ok) {
    throw new Error(`Failed to fetch stats: ${response.statusText}`);
  }

  return await response.json();
}
