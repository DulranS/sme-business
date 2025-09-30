import { create } from 'zustand';
import { 
  fetchProductById,
  createProduct as apiCreateProduct,
  updateProduct as apiUpdateProduct,
  deleteProduct as apiDeleteProduct,
  fetchProducts,
  fetchFeaturedProducts,
  bulkDeleteProducts as apiBulkDeleteProducts,
  bulkUpdateFeatured as apiBulkUpdateFeatured,
  uploadImages as apiUploadImages
} from './product-service';

export interface Product {
  id?: string;
  name: string;
  price: number;
  category: string;
  subcategory: string;
  brand?: string;
  description?: string;
  images: string[];
  stockQuantity: number;
  featured: boolean;
  vehicleType?: string[];
  partNumber?: string;
  discountPercentage?: number;
  sku?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface PaginationData {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginatedResponse {
  products: Product[];
  pagination: PaginationData;
}

export interface FilterOptions {
  page?: number;
  limit?: number;
  category?: string | string[];
  subcategory?: string | string[];
  brand?: string | string[];
  featured?: boolean;
  search?: string;
  vehicleType?: string | string[];
  sortBy?: string;
  order?: 'asc' | 'desc';
  minPrice?: number;
  maxPrice?: number;
  query?: string;
}

export type FetchStatus = 'idle' | 'loading' | 'completed' | 'error';

interface ProductStore {
  products: Product[];
  pagination: PaginationData | null;
  loading: boolean;
  error: string | null;
  fetchStatus: FetchStatus;
  lastFetchOptions: FilterOptions;
  
  setFetchStatus: (status: FetchStatus) => void;
  fetchProducts: (options?: FilterOptions) => Promise<void>;
  fetchFeaturedProducts: (options?: Partial<FilterOptions>) => Promise<void>;
  getProductById: (id: string) => Promise<Product | null>;
  addProduct: (product: Partial<Product>) => Promise<Product>;
  updateProduct: (product: Product) => Promise<Product>;
  deleteProduct: (id: string) => Promise<void>;
  uploadImages: (files: File[]) => Promise<string[]>;
  bulkDeleteProducts: (ids: string[]) => Promise<void>;
  bulkUpdateFeatured: (ids: string[], featured: boolean) => Promise<void>;
  clearStore: () => void;
}

// Helper function to normalize vehicle type to array
const normalizeVehicleType = (product: Partial<Product>): Partial<Product> => ({
  ...product,
  vehicleType: Array.isArray(product.vehicleType) ? product.vehicleType : 
               (product.vehicleType ? [product.vehicleType] : [])
});

// Helper function to process array parameters for API
const processFilterArrays = (filters: FilterOptions): Record<string, string | number | boolean | string[] | undefined> => {
  const processed = {...filters};
  
  Object.entries(processed).forEach(([key, value]) => {
    if (Array.isArray(value) && value.length === 1) {
      processed[key] = value[0];
    }
  });
  
  return processed;
};

// Helper function to compare filter options
const areOptionsEquivalent = (options1: FilterOptions = {}, options2: FilterOptions = {}): boolean => {
  const keys1 = Object.keys(options1);
  const keys2 = Object.keys(options2);
  
  if (keys1.length !== keys2.length) return false;
  
  return keys1.every(key => {
    const val1 = options1[key];
    const val2 = options2[key];
    
    // If both are arrays, check if they have the same elements
    if (Array.isArray(val1) && Array.isArray(val2)) {
      if (val1.length !== val2.length) return false;
      
      // Sort both arrays to ensure consistent comparison
      const sortedVal1 = [...val1].sort();
      const sortedVal2 = [...val2].sort();
      
      return sortedVal1.every((item, index) => item === sortedVal2[index]);
    }
    
    // Handle non-array values
    return val1 === val2;
  });
};

// Helper to ensure all required product fields have values
const ensureRequiredFields = (product: Partial<Product>): Partial<Product> => {
  const result = { ...product };
  
  if (result.featured === undefined) {
    result.featured = false;
  }
  
  if (!result.images) {
    result.images = [];
  }
  
  if (result.stockQuantity === undefined) {
    result.stockQuantity = 0;
  }
  
  return result;
};

export const useProductStore = create<ProductStore>((set, get) => ({
  products: [],
  pagination: null,
  loading: false,
  error: null,
  fetchStatus: 'idle',
  lastFetchOptions: {},
  
  setFetchStatus: (status) => set({ fetchStatus: status }),
  
  fetchProducts: async (options = {}) => {
    const currentState = get();
    const areOptionsEqual = areOptionsEquivalent(options, currentState.lastFetchOptions);
    
    // Skip re-fetching if we already have this data and not loading
    if (currentState.products.length > 0 && 
        currentState.fetchStatus === 'completed' && 
        areOptionsEqual &&
        !currentState.loading) {
      return;
    }
    
    set({ loading: true, error: null, fetchStatus: 'loading', lastFetchOptions: {...options} });
    
    try {
      const { page = 1, limit = 50, ...filters } = options;
      const processedFilters = processFilterArrays(filters);
      const response = await fetchProducts(page, limit, processedFilters);
      
      set({ 
        products: response.products,
        pagination: response.pagination,
        loading: false,
        fetchStatus: 'completed'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set({ 
        error: errorMessage, 
        loading: false,
        fetchStatus: 'error'
      });
      console.error('Error fetching products:', error);
    }
  },
  
  fetchFeaturedProducts: async (options = {}) => {
    set({ loading: true, error: null, fetchStatus: 'loading' });
    
    try {
      const { page = 1, limit = 10, ...filters } = options;
      const processedFilters = processFilterArrays(filters);
      const response = await fetchFeaturedProducts(page, limit, processedFilters);
      
      set({ 
        products: response.products,
        pagination: response.pagination,
        loading: false,
        fetchStatus: 'completed'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set({ 
        error: errorMessage, 
        loading: false,
        fetchStatus: 'error'
      });
      console.error('Error fetching featured products:', error);
    }
  },

  getProductById: async (id: string) => {
    set({ loading: true, error: null });
    
    try {
      const product = await fetchProductById(id);
      set({ loading: false });
      return product;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set({ error: errorMessage, loading: false });
      console.error('Error fetching product by ID:', error);
      return null;
    }
  },
  
  uploadImages: async (files: File[]) => {
    set({ loading: true, error: null });
    
    try {
      const result = await apiUploadImages(files);
      set({ loading: false });
      return result.imageUrls;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set({ error: errorMessage, loading: false });
      console.error('Error uploading images:', error);
      throw error;
    }
  },
  
  addProduct: async (product: Partial<Product>) => {
    set({ loading: true, error: null });
    
    try {
      // Apply transformations to ensure valid product
      let productToSave = normalizeVehicleType({ ...product });
      
      // Handle required fields
      productToSave = ensureRequiredFields(productToSave);
      
      // Remove empty ID field
      if (!productToSave.id || productToSave.id === '') {
        delete productToSave.id;
      }
      
      const newProduct = await apiCreateProduct(productToSave);
      
      set(state => ({ 
        products: [newProduct, ...state.products],
        loading: false 
      }));
      
      return newProduct;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set({ error: errorMessage, loading: false });
      console.error('Error adding product:', error);
      throw error;
    }
  },
  
  updateProduct: async (product: Product) => {
    if (!product.id) {
      throw new Error('Product ID is required for update');
    }
    
    set({ loading: true, error: null });
    
    try {
      // Apply transformations to ensure valid product
      let productToUpdate = normalizeVehicleType({ ...product });
      
      // Handle required fields
      productToUpdate = ensureRequiredFields(productToUpdate);
      
      const updatedProduct = await apiUpdateProduct(product.id, productToUpdate);
      
      set(state => ({
        products: state.products.map(p => p.id === product.id ? updatedProduct : p),
        loading: false
      }));
      
      return updatedProduct;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set({ error: errorMessage, loading: false });
      console.error('Error updating product:', error);
      throw error;
    }
  },
  
  deleteProduct: async (id: string) => {
    set({ loading: true, error: null });
    
    try {
      await apiDeleteProduct(id);
      
      set(state => ({
        products: state.products.filter(p => p.id !== id),
        loading: false
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set({ error: errorMessage, loading: false });
      console.error('Error deleting product:', error);
      throw error;
    }
  },
  
  bulkDeleteProducts: async (ids: string[]) => {
    if (!ids.length) return;
    
    set({ loading: true, error: null });
    
    try {
      await apiBulkDeleteProducts(ids);
      
      set(state => ({
        products: state.products.filter(p => !ids.includes(p.id as string)),
        loading: false
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set({ error: errorMessage, loading: false });
      console.error('Error bulk deleting products:', error);
      throw error;
    }
  },
  
  bulkUpdateFeatured: async (ids: string[], featured: boolean) => {
    if (!ids.length) return;
    
    set({ loading: true, error: null });
    
    try {
      await apiBulkUpdateFeatured(ids, featured);
      
      set(state => ({
        products: state.products.map(p => 
          ids.includes(p.id as string) ? { ...p, featured } : p
        ),
        loading: false
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set({ error: errorMessage, loading: false });
      console.error('Error updating featured status:', error);
      throw error;
    }
  },
  
  clearStore: () => {
    set({
      products: [],
      pagination: null,
      loading: false,
      error: null,
      fetchStatus: 'idle',
      lastFetchOptions: {}
    });
  }
}));