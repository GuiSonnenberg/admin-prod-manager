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
    const url = new URL(req.url);
    const method = req.method;
    const body = method !== 'GET' ? await req.json() : null;

    console.log(`${method} request to products-api`, { path: url.pathname, body });

    // GET /products - Lista produtos com filtros
    if (method === 'GET' && url.pathname.includes('/products')) {
      const params = new URLSearchParams(url.search);
      const queryString = params.toString();
      const endpoint = `/admin/products${queryString ? `?${queryString}` : ''}`;
      
      const response = await makeAuthenticatedRequest(endpoint);
      const data = await response.json();
      
      console.log('Products fetched successfully:', data);
      
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /products - Criar produto
    if (method === 'POST' && url.pathname.includes('/products')) {
      const response = await makeAuthenticatedRequest('/admin/products', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      
      const data = await response.json();
      console.log('Product created successfully:', data);
      
      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // PUT /products/:id - Atualizar produto
    if (method === 'PUT' && url.pathname.includes('/products/')) {
      const productId = url.pathname.split('/').pop();
      const response = await makeAuthenticatedRequest(`/admin/products/${productId}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      
      const data = await response.json();
      console.log('Product updated successfully:', data);
      
      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // DELETE /products/:id - Deletar produto
    if (method === 'DELETE' && url.pathname.includes('/products/')) {
      const productId = url.pathname.split('/').pop();
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
