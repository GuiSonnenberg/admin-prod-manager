import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Product, ProductsResponse, CreateProductData, UpdateProductData, ProductFilters } from '@/types/product';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

async function fetchProducts(filters: ProductFilters = {}): Promise<ProductsResponse> {
  const params = new URLSearchParams();
  
  if (filters.page) params.append('page', filters.page.toString());
  if (filters.limit) params.append('limit', filters.limit.toString());
  if (filters.search) params.append('search', filters.search);
  if (filters.sortBy) params.append('sortBy', filters.sortBy);
  if (filters.order) params.append('order', filters.order);
  if (filters.isActive !== undefined) params.append('isActive', filters.isActive.toString());

  const { data, error } = await supabase.functions.invoke('products-api/products', {
    method: 'GET',
  });

  if (error) {
    console.error('Error fetching products:', error);
    throw new Error('Erro ao buscar produtos');
  }

  return data;
}

async function createProduct(data: CreateProductData): Promise<Product> {
  const { data: result, error } = await supabase.functions.invoke('products-api/products', {
    method: 'POST',
    body: data,
  });

  if (error) {
    console.error('Error creating product:', error);
    throw new Error('Erro ao criar produto');
  }

  return result;
}

async function updateProduct(id: string, data: UpdateProductData): Promise<Product> {
  const { data: result, error } = await supabase.functions.invoke(`products-api/products/${id}`, {
    method: 'PUT',
    body: data,
  });

  if (error) {
    console.error('Error updating product:', error);
    throw new Error('Erro ao atualizar produto');
  }

  return result;
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