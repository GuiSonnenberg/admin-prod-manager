import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const API_BASE_URL = 'https://apicalvaodecria-production.up.railway.app/api/v1';
const API_EMAIL = 'admin@admin.com';
const API_PASSWORD = 'Password123!';

// Cache do token de autenticação
let authToken: string | null = null;
let tokenExpiry: number = 0;

async function getAuthToken(): Promise<string> {
  // Se o token ainda é válido, retorna o cache
  if (authToken && Date.now() < tokenExpiry) {
    return authToken;
  }

  console.log('Authenticating with external API...');
  
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: API_EMAIL,
      password: API_PASSWORD,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Authentication failed:', errorText);
    throw new Error(`Failed to authenticate: ${response.status}`);
  }

  const data = await response.json();
  
  // A API retorna o token em data.data.tokens.accessToken
  authToken = data.data?.tokens?.accessToken || data.token || data.access_token || data.accessToken;
  
  if (!authToken) {
    console.error('No token in response:', data);
    throw new Error('No authentication token received');
  }

  // Token válido por 50 minutos (assumindo 1 hora de validade)
  tokenExpiry = Date.now() + (50 * 60 * 1000);
  
  console.log('Authentication successful');
  return authToken;
}

async function makeAuthenticatedRequest(endpoint: string, options: RequestInit = {}) {
  const token = await getAuthToken();
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  // Se o token expirou, limpa o cache e tenta novamente
  if (response.status === 401) {
    console.log('Token expired, re-authenticating...');
    authToken = null;
    tokenExpiry = 0;
    const newToken = await getAuthToken();
    
    return fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${newToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  return response;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const method = body.method || 'GET';
    const productId = body.productId;
    const params = body.params || {};

    console.log(`${method} request to products-api`, { method, productId, body });

    // GET /products - Lista produtos com filtros
    if (method === 'GET') {
      const queryParams = new URLSearchParams(params);
      const queryString = queryParams.toString();
      const endpoint = `/admin/products${queryString ? `?${queryString}` : ''}`;
      
      const response = await makeAuthenticatedRequest(endpoint);
      const apiData = await response.json();
      
      console.log('API Response:', apiData);
      
      // Transformar resposta da API externa para o formato esperado pelo frontend
      const products = apiData.data?.products || apiData.products || apiData.data || [];
      
      // Transformar produtos para converter objetos de imagem em URLs
      const transformedProducts = products.map((product: any) => {
        let images = product.images || [];
        
        // Se images é um array de objetos com url, extrair apenas as URLs
        if (Array.isArray(images) && images.length > 0 && typeof images[0] === 'object' && images[0].url) {
          images = images.map((img: any) => img.url);
        }
        
        return {
          id: product.productId || product._id || product.id,
          name: product.name,
          description: product.description,
          price: product.price,
          promotionalPrice: product.promotionalPrice,
          isPromotionActive: product.isPromotionActive,
          stockQuantity: product.stockQuantity,
          images,
          isActive: product.isActive,
          createdAt: product.createdAt,
          updatedAt: product.updatedAt,
        };
      });
      
      const transformedData = {
        data: transformedProducts,
        pagination: {
          page: apiData.data?.currentPage || apiData.currentPage || 1,
          limit: apiData.data?.limit || apiData.limit || 10,
          total: apiData.data?.totalProducts || apiData.totalProducts || apiData.total || 0,
          totalPages: apiData.data?.totalPages || apiData.totalPages || 1,
        }
      };
      
      console.log('Transformed data:', transformedData);
      
      return new Response(JSON.stringify(transformedData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /products - Criar produto
    if (method === 'POST') {
      // Extrair apenas os campos válidos para a API externa
      const productData = {
        name: body.name,
        description: body.description,
        price: body.price,
        promotionalPrice: body.promotionalPrice,
        isPromotionActive: body.isPromotionActive,
        stockQuantity: body.stockQuantity,
        images: body.images || [],
        isActive: body.isActive !== undefined ? body.isActive : true,
      };
      
      console.log('Creating product with data:', productData);
      
      const response = await makeAuthenticatedRequest('/admin/products', {
        method: 'POST',
        body: JSON.stringify(productData),
      });
      
      const apiData = await response.json();
      console.log('Product created successfully:', apiData);
      
      // Transformar imagens se necessário
      let product = apiData.data || apiData;
      if (product.images && Array.isArray(product.images) && product.images.length > 0 && typeof product.images[0] === 'object' && product.images[0].url) {
        product.images = product.images.map((img: any) => img.url);
      }
      
      return new Response(JSON.stringify(product), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // PUT /products/:id - Atualizar produto
    if (method === 'PUT' && productId) {
      // Extrair apenas os campos válidos para a API externa
      const productData: any = {};
      
      if (body.name !== undefined) productData.name = body.name;
      if (body.description !== undefined) productData.description = body.description;
      if (body.price !== undefined) productData.price = body.price;
      if (body.promotionalPrice !== undefined) productData.promotionalPrice = body.promotionalPrice;
      if (body.isPromotionActive !== undefined) productData.isPromotionActive = body.isPromotionActive;
      if (body.stockQuantity !== undefined) productData.stockQuantity = body.stockQuantity;
      if (body.images !== undefined) productData.images = body.images;
      if (body.isActive !== undefined) productData.isActive = body.isActive;
      
      console.log('Updating product with data:', productData);
      
      const response = await makeAuthenticatedRequest(`/admin/products/${productId}`, {
        method: 'PUT',
        body: JSON.stringify(productData),
      });
      
      const apiData = await response.json();
      console.log('Product updated successfully:', apiData);
      
      // Transformar imagens se necessário
      let product = apiData.data || apiData;
      if (product.images && Array.isArray(product.images) && product.images.length > 0 && typeof product.images[0] === 'object' && product.images[0].url) {
        product.images = product.images.map((img: any) => img.url);
      }
      
      return new Response(JSON.stringify(product), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // DELETE /products/:id - Deletar produto
    if (method === 'DELETE' && productId) {
      const response = await makeAuthenticatedRequest(`/admin/products/${productId}`, {
        method: 'DELETE',
      });
      
      const data = await response.text();
      console.log('Product deleted successfully');
      
      return new Response(data, {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ error: 'Endpoint not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in products-api function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
