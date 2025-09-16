import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Product, ProductsResponse, CreateProductData, UpdateProductData, ProductFilters } from '@/types/product';
import { toast } from '@/hooks/use-toast';

// Mock API functions (replace with real API calls)
const apiUrl = '/api/v1/admin/products';

async function fetchProducts(filters: ProductFilters = {}): Promise<ProductsResponse> {
  // Mock data - replace with real API call
  const mockProducts: Product[] = [
    {
      id: '1',
      name: 'iPhone 15 Pro',
      description: 'Latest iPhone with advanced features',
      price: 999.99,
      promotionalPrice: 899.99,
      isPromotionActive: true,
      stockQuantity: 50,
      images: ['https://via.placeholder.com/200x200/3b82f6/ffffff?text=iPhone'],
      isActive: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: '2',
      name: 'Samsung Galaxy S24',
      description: 'Premium Android smartphone',
      price: 899.99,
      stockQuantity: 30,
      images: ['https://via.placeholder.com/200x200/ef4444/ffffff?text=Samsung'],
      isActive: true,
      createdAt: '2024-01-02T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
    },
    {
      id: '3',
      name: 'MacBook Air M2',
      description: 'Powerful laptop for professionals',
      price: 1199.99,
      stockQuantity: 15,
      images: ['https://via.placeholder.com/200x200/10b981/ffffff?text=MacBook'],
      isActive: false,
      createdAt: '2024-01-03T00:00:00Z',
      updatedAt: '2024-01-03T00:00:00Z',
    },
  ];

  // Apply filters
  let filteredProducts = [...mockProducts];
  
  if (filters.search) {
    filteredProducts = filteredProducts.filter(product =>
      product.name.toLowerCase().includes(filters.search!.toLowerCase())
    );
  }

  if (filters.isActive !== undefined) {
    filteredProducts = filteredProducts.filter(product => product.isActive === filters.isActive);
  }

  if (filters.sortBy) {
    filteredProducts.sort((a, b) => {
      const aVal = a[filters.sortBy!];
      const bVal = b[filters.sortBy!];
      const multiplier = filters.order === 'desc' ? -1 : 1;
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return aVal.localeCompare(bVal) * multiplier;
      }
      
      return ((aVal as number) - (bVal as number)) * multiplier;
    });
  }

  const page = filters.page || 1;
  const limit = filters.limit || 10;
  const startIndex = (page - 1) * limit;
  const paginatedProducts = filteredProducts.slice(startIndex, startIndex + limit);

  return {
    data: paginatedProducts,
    pagination: {
      page,
      limit,
      total: filteredProducts.length,
      totalPages: Math.ceil(filteredProducts.length / limit),
    },
  };
}

async function createProduct(data: CreateProductData): Promise<Product> {
  // Mock creation - replace with real API call
  const newProduct: Product = {
    id: Date.now().toString(),
    ...data,
    isActive: data.isActive ?? true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return newProduct;
}

async function updateProduct(id: string, data: UpdateProductData): Promise<Product> {
  // Mock update - replace with real API call
  const existingProduct = {
    id,
    name: 'Updated Product',
    description: 'Updated description',
    price: 100,
    stockQuantity: 10,
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: new Date().toISOString(),
    ...data,
  } as Product;
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return existingProduct;
}

export function useProducts(filters: ProductFilters = {}) {
  return useQuery({
    queryKey: ['products', filters],
    queryFn: () => fetchProducts(filters),
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: 'Produto criado',
        description: 'Produto criado com sucesso!',
      });
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Erro ao criar produto. Tente novamente.',
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProductData }) => updateProduct(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: 'Produto atualizado',
        description: 'Produto atualizado com sucesso!',
      });
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar produto. Tente novamente.',
        variant: 'destructive',
      });
    },
  });
}