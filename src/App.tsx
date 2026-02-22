/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  ShoppingBasket, 
  User, 
  Truck, 
  Store, 
  Plus, 
  Minus, 
  ShoppingCart, 
  CheckCircle2, 
  Package, 
  Clock,
  ChevronRight,
  LogOut,
  Tag,
  AlertTriangle,
  Calendar,
  ShieldCheck,
  CreditCard,
  History,
  MapPin,
  Trash2,
  Edit,
  ArrowLeft,
  Eye,
  EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from './lib/supabase';

// Types
interface Product {
  id: number;
  name: string;
  description: string;
  category: string;
  image: string;
  unit_type: 'unidad' | 'peso' | 'puerca';
  price_unit: number;
  price_kg: number;
  price_lb: number;
  stock: number;
  min_stock: number;
  cost_price: number;
  expiry_date: string;
  active: boolean;
  created_at: string;
}

interface Rider {
  id: string;
  full_name: string;
  id_number: string;
  phone: string;
  email: string;
  vehicle_type: 'motocicleta' | 'bicicleta' | 'auto';
  plate_number?: string;
  status: 'Activo' | 'Inactivo';
  created_at: string;
}

interface OrderItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
}

interface Order {
  id: number;
  client_id: string;
  rider_id: string | null;
  status: 'Pendiente' | 'En camino' | 'Entregado' | 'Cancelado';
  total_price: number;
  payment_method_id: number;
  payment_status: 'Pagado' | 'Pendiente';
  created_at: string;
  items?: OrderItem[]; // For legacy compatibility
}

interface Invoice {
  id: number;
  pedido_id: number;
  subtotal: number;
  tax: number;
  total: number;
  created_at: string;
}

interface PaymentMethod {
  id: number;
  name: string;
}

type Role = 'client' | 'store' | 'delivery' | null;

export default function App() {
  const [role, setRole] = useState<Role>(null);
  const [user, setUser] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<number>(1);
  
  // Rider Registration Fields
  const [idNumber, setIdNumber] = useState('');
  const [vehicleType, setVehicleType] = useState<'motocicleta' | 'bicicleta' | 'auto'>('motocicleta');
  const [plateNumber, setPlateNumber] = useState('');
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [preLoginRole, setPreLoginRole] = useState<Role>(null);

  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    category: 'Verduras',
    image: '',
    unit_type: 'unidad' as 'unidad' | 'peso' | 'puerca',
    price_unit: 0,
    price_kg: 0,
    price_lb: 0,
    stock: 10,
    min_stock: 5,
    cost_price: 0,
    active: true,
    expiry_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  });

  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL || 'admin@recadito.com';

  useEffect(() => {
    checkUser();
    fetchData();
    
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        checkUser();
      }
    };
    window.addEventListener('message', handleMessage);

    const interval = setInterval(fetchData, 5000);
    return () => {
      window.removeEventListener('message', handleMessage);
      clearInterval(interval);
    };
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUser(user);
      // Determine role from metadata or email
      if (user.email === adminEmail) {
        setRole('store');
      } else {
        setRole(user.user_metadata?.role || 'client');
      }
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    
    if (preLoginRole === 'store' && email !== adminEmail) {
      setAuthError("Este correo no tiene permisos de administrador.");
      return;
    }

    try {
      if (authMode === 'register') {
        if (preLoginRole === 'store') {
          setAuthError("No se pueden registrar nuevos administradores.");
          return;
        }

        const { data: authData, error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            data: {
              full_name: fullName,
              phone: phone,
              address: address,
              role: preLoginRole
            }
          }
        });
        if (error) throw error;

        // If it's a rider, save to repartidores table
        if (preLoginRole === 'delivery' && authData.user) {
          const { error: riderError } = await supabase
            .from('repartidores')
            .insert([{
              id: authData.user.id,
              full_name: fullName,
              id_number: idNumber,
              phone: phone,
              email: email,
              vehicle_type: vehicleType,
              plate_number: vehicleType !== 'bicicleta' ? plateNumber : null,
              status: 'Activo'
            }]);
          if (riderError) console.error("Error saving rider profile:", riderError);
        }

        alert("Registro exitoso. Revisa tu correo para confirmar o intenta ingresar.");
        setAuthMode('login');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        checkUser();
      }
    } catch (error: any) {
      setAuthError(error.message);
    }
  };

  const signInWithGoogle = async () => {
    try {
      const res = await fetch('/api/auth/google/url');
      const { url } = await res.json();
      
      const width = 500;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      window.open(
        url,
        'google_auth',
        `width=${width},height=${height},left=${left},top=${top}`
      );
    } catch (error) {
      console.error("Error getting auth URL:", error);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
  };

  const fetchData = async () => {
    try {
      // Products still fetched from server to apply automatic discount logic
      let prodData = [];
      try {
        const prodRes = await fetch('/api/products');
        if (prodRes.ok) {
          prodData = await prodRes.json();
        } else {
          console.warn("API products failed, falling back to direct Supabase fetch");
          const { data } = await supabase.from("products").select("*").order("name");
          prodData = data || [];
        }
      } catch (e) {
        console.error("API fetch error:", e);
        const { data } = await supabase.from("products").select("*").order("name");
        prodData = data || [];
      }
      
      if (Array.isArray(prodData)) {
        setProducts(prodData);
      } else {
        setProducts([]);
      }

      // Orders fetched directly from Supabase to respect RLS
      const { data: orderData, error: orderError } = await supabase
        .from("pedidos")
        .select("*")
        .order("created_at", { ascending: false });

      if (orderError) {
        console.error("Error fetching orders:", orderError);
      } else {
        setOrders(orderData || []);
      }

      // Fetch Payment Methods
      const { data: payMethods } = await supabase.from("metodos_pago").select("*");
      if (payMethods) setPaymentMethods(payMethods);

      // Fetch Riders (Admin only)
      if (role === 'store') {
        const { data: riderData } = await supabase.from("repartidores").select("*");
        if (riderData) setRiders(riderData);
      }

      // Fetch Invoices
      const { data: invoiceData } = await supabase.from("facturas").select("*");
      if (invoiceData) setInvoices(invoiceData);
    } catch (error) {
      console.error("Error fetching data:", error);
      setProducts([]);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product: Product, priceType: 'unit' | 'kg' | 'lb' = 'unit') => {
    const factor = priceType === 'kg' ? 2.20462 : 1;
    
    setCart(prev => {
      // Calculate total stock used in cart for this product
      const totalUsed = prev
        .filter(item => item.id === product.id)
        .reduce((sum, item) => {
          const f = (item as any).priceType === 'kg' ? 2.20462 : 1;
          return sum + (item.quantity * f);
        }, 0);

      if (totalUsed + factor > product.stock) {
        alert(`No hay suficiente stock. Disponible: ${product.stock.toFixed(2)} ${product.unit_type === 'peso' ? 'Lbs' : 'unidades'}`);
        return prev;
      }

      const existing = prev.find(item => item.id === product.id && (item as any).priceType === priceType);
      
      let price = product.price_unit;
      let nameSuffix = "";

      if (product.unit_type === 'peso') {
        if (priceType === 'kg') {
          price = product.price_kg;
          nameSuffix = " (Kg)";
        } else {
          price = product.price_lb;
          nameSuffix = " (Lb)";
        }
      }

      if (existing) {
        return prev.map(item => 
          (item.id === product.id && (item as any).priceType === priceType) 
          ? { ...item, quantity: item.quantity + 1 } 
          : item
        );
      }
      
      return [...prev, { 
        id: product.id, 
        name: `${product.name}${nameSuffix}`, 
        price, 
        quantity: 1,
        priceType
      } as any];
    });
  };

  const removeFromCart = (productId: number, priceType: string = 'unit') => {
    setCart(prev => {
      const existing = prev.find(item => item.id === productId && (item as any).priceType === priceType);
      if (existing && existing.quantity > 1) {
        return prev.map(item => 
          (item.id === productId && (item as any).priceType === priceType) 
          ? { ...item, quantity: item.quantity - 1 } 
          : item
        );
      }
      return prev.filter(item => !(item.id === productId && (item as any).priceType === priceType));
    });
  };

  const placeOrder = async () => {
    if (cart.length === 0) return;
    if (!user) {
      alert("Debes iniciar sesión para realizar un pedido.");
      return;
    }
    
    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    try {
      // 1. Crear el pedido en la tabla 'pedidos'
      const { data: pedido, error: pedidoError } = await supabase
        .from("pedidos")
        .insert([{ 
          client_id: user.id, 
          total_price: total,
          status: 'Pendiente',
          payment_method_id: selectedPaymentMethod,
          payment_status: 'Pendiente'
        }])
        .select()
        .single();
      
      if (pedidoError) {
        alert(`Error al crear pedido: ${pedidoError.message}`);
        return;
      }

      // 2. Crear los detalles en 'detalle_pedido'
      const detalles = cart.map(item => ({
        pedido_id: pedido.id,
        product_id: item.id,
        quantity: item.quantity,
        unit_price: item.price
      }));

      const { error: detalleError } = await supabase
        .from("detalle_pedido")
        .insert(detalles);

      if (detalleError) {
        alert(`Error al guardar detalles: ${detalleError.message}`);
        return;
      }
      
      setCart([]);
      fetchData();
      alert("¡Recadito enviado con éxito!");
    } catch (error) {
      console.error("Error placing order:", error);
      alert("Error inesperado al enviar el pedido.");
    }
  };

  const updateOrderStatus = async (orderId: number, status: string, riderId?: string) => {
    try {
      const updateData: any = { status };
      if (riderId) updateData.rider_id = riderId;

      const { error } = await supabase
        .from("pedidos")
        .update(updateData)
        .eq("id", orderId);

      if (error) {
        alert(`Error al actualizar pedido: ${error.message}`);
      } else {
        fetchData();
        if (status === 'Entregado') {
          alert("Pedido entregado. Factura generada automáticamente.");
        }
      }
    } catch (error) {
      console.error("Error updating order:", error);
    }
  };

  const createProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        const { error } = await supabase
          .from("products")
          .update(newProduct)
          .eq("id", editingProduct.id);

        if (error) {
          alert(`Error al actualizar producto: ${error.message}`);
        } else {
          setShowAddProduct(false);
          setEditingProduct(null);
          resetNewProduct();
          fetchData();
          alert("Producto actualizado con éxito");
        }
      } else {
        const { error } = await supabase
          .from("products")
          .insert([newProduct]);

        if (error) {
          alert(`Error al crear producto: ${error.message}`);
        } else {
          setShowAddProduct(false);
          resetNewProduct();
          fetchData();
          alert("Producto creado con éxito");
        }
      }
    } catch (error) {
      console.error("Error saving product:", error);
    }
  };

  const resetNewProduct = () => {
    setNewProduct({
      name: '',
      description: '',
      category: 'Verduras',
      image: '',
      unit_type: 'unidad',
      price_unit: 0,
      price_kg: 0,
      price_lb: 0,
      stock: 10,
      min_stock: 5,
      cost_price: 0,
      active: true,
      expiry_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    });
  };

  const updateProduct = async (id: number, data: any) => {
    try {
      const { error } = await supabase
        .from("products")
        .update(data)
        .eq("id", id);

      if (error) {
        console.error("Error updating product:", error.message);
      } else {
        fetchData();
      }
    } catch (error) {
      console.error("Error updating product:", error);
    }
  };

  const deleteProduct = async (id: number) => {
    if (!confirm("¿Estás seguro de eliminar este producto?")) return;
    try {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", id);

      if (error) {
        alert(`Error al eliminar: ${error.message}`);
      } else {
        fetchData();
      }
    } catch (error) {
      console.error("Error deleting product:", error);
    }
  };

  const getFreshnessStatus = (expiryDate: string) => {
    const expiry = new Date(expiryDate);
    const now = new Date();
    const diffDays = (expiry.getTime() - now.getTime()) / (1000 * 3600 * 24);
    
    if (diffDays < 0) return { label: 'Expirado', color: 'text-red-600', bg: 'bg-red-50' };
    if (diffDays < 2) return { label: 'Pronto a expirar', color: 'text-amber-600', bg: 'bg-amber-50' };
    return { label: 'Fresco', color: 'text-emerald-600', bg: 'bg-emerald-50' };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f0] flex items-center justify-center">
        <div className="animate-pulse text-[#5A5A40] font-serif text-2xl italic">Cargando Recadito...</div>
      </div>
    );
  }

  if (!user) {
    if (!preLoginRole) {
      return (
        <div className="min-h-screen bg-[#f5f5f0] flex flex-col items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md w-full text-center space-y-12"
          >
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="p-5 bg-emerald-600 rounded-[2.5rem] shadow-xl shadow-emerald-100 text-white">
                  <ShoppingBasket size={48} />
                </div>
              </div>
              <h1 className="text-7xl font-serif font-bold text-[#1a1a1a] tracking-tighter">Recadito</h1>
              <p className="text-xl text-[#5A5A40] italic font-serif">¿Cómo deseas ingresar?</p>
            </div>

            <div className="grid gap-4">
              <button 
                onClick={() => setPreLoginRole('client')}
                className="group flex items-center justify-between p-6 bg-white rounded-3xl shadow-sm border border-black/5 hover:border-[#5A5A40] transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                    <User size={24} />
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-lg">Soy Cliente</div>
                    <div className="text-sm text-gray-500">Quiero hacer compras</div>
                  </div>
                </div>
                <ChevronRight className="text-gray-300 group-hover:text-[#5A5A40]" />
              </button>

              <button 
                onClick={() => setPreLoginRole('delivery')}
                className="group flex items-center justify-between p-6 bg-white rounded-3xl shadow-sm border border-black/5 hover:border-[#5A5A40] transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-50 rounded-2xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <Truck size={24} />
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-lg">Soy Repartidor</div>
                    <div className="text-sm text-gray-500">Registro interno de Riders</div>
                  </div>
                </div>
                <ChevronRight className="text-gray-300 group-hover:text-[#5A5A40]" />
              </button>

              <button 
                onClick={() => setPreLoginRole('store')}
                className="group flex items-center justify-between p-6 bg-white rounded-3xl shadow-sm border border-black/5 hover:border-[#5A5A40] transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-amber-50 rounded-2xl text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                    <Store size={24} />
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-lg">Administrador</div>
                    <div className="text-sm text-gray-500">Gestión de la tienda</div>
                  </div>
                </div>
                <ChevronRight className="text-gray-300 group-hover:text-[#5A5A40]" />
              </button>
            </div>
          </motion.div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#f5f5f0] flex flex-col items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full text-center space-y-8"
        >
          <div className="flex items-center gap-4">
            <button onClick={() => setPreLoginRole(null)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
              <Minus size={20} />
            </button>
            <div className="text-left">
              <h1 className="text-3xl font-serif font-bold text-[#1a1a1a]">
                {preLoginRole === 'client' ? 'Cliente' : preLoginRole === 'store' ? 'Admin' : 'Repartidor'}
              </h1>
              <p className="text-xs text-[#5A5A40] uppercase tracking-widest font-bold">Recadito</p>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[32px] shadow-sm border border-black/5 space-y-6">
            <div className="flex p-1 bg-gray-100 rounded-2xl">
              <button 
                onClick={() => setAuthMode('login')}
                className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${authMode === 'login' ? 'bg-white shadow-sm text-[#1a1a1a]' : 'text-gray-400'}`}
              >
                Ingresar
              </button>
              {preLoginRole !== 'store' && (
                <button 
                  onClick={() => setAuthMode('register')}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${authMode === 'register' ? 'bg-white shadow-sm text-[#1a1a1a]' : 'text-gray-400'}`}
                >
                  Registrar
                </button>
              )}
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-4 text-left">
              {authMode === 'register' && preLoginRole === 'client' && (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-2">Nombre Completo</label>
                    <input 
                      type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)}
                      placeholder="Juan Pérez" className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-2">Teléfono</label>
                    <input 
                      type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)}
                      placeholder="+56 9 1234 5678" className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-2">Dirección</label>
                    <input 
                      type="text" required value={address} onChange={(e) => setAddress(e.target.value)}
                      placeholder="Av. Siempre Viva 123" className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                    />
                  </div>
                </>
              )}

              {authMode === 'register' && preLoginRole === 'delivery' && (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-2">Nombre Completo</label>
                    <input 
                      type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)}
                      placeholder="Juan Pérez" className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-2">Cédula / ID</label>
                    <input 
                      type="text" required value={idNumber} onChange={(e) => setIdNumber(e.target.value)}
                      placeholder="8-000-000" className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-2">Celular</label>
                    <input 
                      type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)}
                      placeholder="+56 9 1234 5678" className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-2">Tipo de Vehículo</label>
                    <select 
                      value={vehicleType} onChange={(e) => setVehicleType(e.target.value as any)}
                      className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                    >
                      <option value="motocicleta">Motocicleta</option>
                      <option value="bicicleta">Bicicleta</option>
                      <option value="auto">Auto</option>
                    </select>
                  </div>
                  {vehicleType !== 'bicicleta' && (
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-2">Número de Placa</label>
                      <input 
                        type="text" required value={plateNumber} onChange={(e) => setPlateNumber(e.target.value)}
                        placeholder="ABC-123" className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                      />
                    </div>
                  )}
                </>
              )}

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-2">Correo Electrónico</label>
                <input 
                  type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com" className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-2">Contraseña</label>
                <input 
                  type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                />
              </div>

              {authError && (
                <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl flex items-center gap-2">
                  <AlertTriangle size={14} /> {authError}
                </div>
              )}

              <button 
                type="submit"
                className="w-full py-4 bg-[#5A5A40] text-white rounded-2xl font-bold hover:bg-[#4a4a35] transition-all shadow-lg shadow-gray-100"
              >
                {authMode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
              </button>
            </form>

            {preLoginRole === 'client' && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
                  <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-bold text-gray-300">
                    <span className="bg-white px-4">O también</span>
                  </div>
                </div>

                <button 
                  onClick={signInWithGoogle}
                  className="w-full flex items-center justify-center gap-4 p-4 bg-white rounded-2xl border border-black/5 hover:bg-gray-50 transition-all font-bold text-sm"
                >
                  <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
                  Continuar con Google
                </button>
              </>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="min-h-screen bg-[#f5f5f0] flex flex-col items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center space-y-8"
        >
          <div className="space-y-2">
            <h1 className="text-5xl font-serif font-bold text-[#1a1a1a] tracking-tight">Bienvenido</h1>
            <p className="text-[#5A5A40] italic">{user.email}</p>
          </div>

          <div className="grid gap-4">
            <button 
              onClick={() => setRole('client')}
              className="group flex items-center justify-between p-6 bg-white rounded-3xl shadow-sm border border-black/5 hover:border-[#5A5A40] transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <User size={24} />
                </div>
                <div className="text-left">
                  <div className="font-bold text-lg">Cliente</div>
                  <div className="text-sm text-gray-500">Haz tu recadito hoy</div>
                </div>
              </div>
              <ChevronRight className="text-gray-300 group-hover:text-[#5A5A40]" />
            </button>

            <button 
              onClick={() => setRole('store')}
              className="group flex items-center justify-between p-6 bg-white rounded-3xl shadow-sm border border-black/5 hover:border-[#5A5A40] transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-50 rounded-2xl text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                  <Store size={24} />
                </div>
                <div className="text-left">
                  <div className="font-bold text-lg">Admin Tienda</div>
                  <div className="text-sm text-gray-500">Gestión de stock y frescura</div>
                </div>
              </div>
              <ChevronRight className="text-gray-300 group-hover:text-[#5A5A40]" />
            </button>

            <button 
              onClick={() => setRole('delivery')}
              className="group flex items-center justify-between p-6 bg-white rounded-3xl shadow-sm border border-black/5 hover:border-[#5A5A40] transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-50 rounded-2xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Truck size={24} />
                </div>
                <div className="text-left">
                  <div className="font-bold text-lg">Repartidor</div>
                  <div className="text-sm text-gray-500">Entrega frescura a domicilio</div>
                </div>
              </div>
              <ChevronRight className="text-gray-300 group-hover:text-[#5A5A40]" />
            </button>
          </div>

          <button 
            onClick={signOut}
            className="text-sm text-gray-400 hover:text-red-500 transition-colors flex items-center justify-center gap-2 mx-auto"
          >
            <LogOut size={16} /> Cerrar Sesión
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f0] text-[#1a1a1a]">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-black/5 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <ShoppingBasket className="text-emerald-600" size={28} />
          <span className="text-2xl font-serif font-bold">Recadito</span>
          <span className="ml-2 px-2 py-0.5 bg-gray-100 rounded-full text-[10px] uppercase tracking-wider font-bold text-gray-500">
            {role === 'client' ? 'Cliente' : role === 'store' ? 'Admin' : 'Repartidor'}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {role && (
            <button 
              onClick={() => setRole(null)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-bold transition-all text-[#5A5A40]"
            >
              <ArrowLeft size={16} /> <span className="hidden sm:inline">Menú Principal</span>
            </button>
          )}
          {user && <span className="text-sm text-gray-500 hidden sm:block">{user.email}</span>}
          <button 
            onClick={signOut}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-red-500"
          >
            <LogOut size={20} />
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6">
        {role === 'client' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Products List */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex justify-between items-end">
                <h2 className="text-3xl font-serif font-bold italic">Frescura del día</h2>
                <div className="text-sm text-[#5A5A40] flex items-center gap-1">
                  <ShieldCheck size={16} /> Calidad Certificada
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {products.filter(p => p.active).map(product => {
                  const freshness = getFreshnessStatus(product.expiry_date);
                  return (
                    <motion.div 
                      key={product.id}
                      layout
                      className="bg-white p-4 rounded-3xl shadow-sm border border-black/5 flex gap-4 relative overflow-hidden"
                    >
                      {product.discount && (
                        <div className="absolute top-0 right-0 bg-red-500 text-white px-3 py-1 rounded-bl-2xl text-xs font-bold flex items-center gap-1">
                          <Tag size={12} /> {product.discount * 100}% OFF
                        </div>
                      )}
                      
                      <img 
                        src={product.image} 
                        alt={product.name}
                        className="w-28 h-28 rounded-2xl object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start">
                            <div className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">
                              {product.category}
                            </div>
                            <div className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${freshness.bg} ${freshness.color}`}>
                              {freshness.label}
                            </div>
                          </div>
                          <div className="font-bold text-lg leading-tight mt-1">{product.name}</div>
                          {product.description && (
                            <div className="text-[10px] text-gray-400 italic line-clamp-2 mt-1 mb-2 leading-relaxed">
                              {product.description}
                            </div>
                          )}
                          <div className="space-y-0.5">
                            {product.unit_type === 'peso' ? (
                              <>
                                <div className="text-[10px] flex justify-between items-center bg-gray-50 p-1 rounded-lg mb-1">
                                  <span className="text-gray-400">Kilo: ${product.price_kg.toFixed(2)}</span>
                                  <button 
                                    onClick={() => addToCart(product, 'kg')}
                                    className="px-2 py-0.5 bg-emerald-600 text-white rounded-md text-[8px] font-bold"
                                  >
                                    + Kg
                                  </button>
                                </div>
                                <div className="text-[10px] flex justify-between items-center bg-gray-50 p-1 rounded-lg">
                                  <span className="text-gray-400">Libra: ${product.price_lb.toFixed(2)}</span>
                                  <button 
                                    onClick={() => addToCart(product, 'lb')}
                                    className="px-2 py-0.5 bg-emerald-600 text-white rounded-md text-[8px] font-bold"
                                  >
                                    + Lb
                                  </button>
                                </div>
                              </>
                            ) : (
                              <div className="text-[10px] flex justify-between items-center">
                                <span className="text-gray-400">{product.unit_type === 'puerca' ? 'Bolsa:' : 'Unidad:'}</span>
                                <span className="font-bold text-emerald-600">${product.price_unit.toFixed(2)}</span>
                              </div>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-400 mt-1">
                            Stock: {product.stock.toFixed(1)} {product.unit_type === 'peso' ? 'Lbs' : product.unit_type === 'puerca' ? 'Paquetes' : 'unidades'}
                          </div>
                        </div>
                        {product.unit_type !== 'peso' && (
                          <button 
                            onClick={() => addToCart(product, 'unit')}
                            disabled={product.stock <= 0}
                            className={`mt-2 w-full py-2 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 ${
                              product.stock > 0 
                              ? 'bg-[#5A5A40] text-white hover:bg-[#4a4a35]' 
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}
                          >
                            {product.stock > 0 ? <><Plus size={16} /> Agregar</> : 'Sin Stock'}
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Cart & History */}
            <div className="space-y-8">
              <div className="bg-white p-6 rounded-[32px] shadow-sm border border-black/5 sticky top-24">
                <div className="flex items-center gap-2 mb-6">
                  <ShoppingCart size={20} className="text-[#5A5A40]" />
                  <h3 className="text-xl font-serif font-bold">Tu Recadito</h3>
                </div>
                
                {cart.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 italic">No has agregado nada aún</div>
                ) : (
                  <div className="space-y-4">
                    {cart.map((item: any) => (
                      <div key={`${item.id}-${item.priceType}`} className="flex justify-between items-center">
                        <div>
                          <div className="font-bold">{item.name}</div>
                          <div className="text-xs text-gray-500">${(item.price * item.quantity).toFixed(2)}</div>
                        </div>
                        <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-2 py-1">
                          <button onClick={() => removeFromCart(item.id, item.priceType)} className="text-gray-400 hover:text-red-500"><Minus size={14} /></button>
                          <span className="font-bold text-sm w-4 text-center">{item.quantity}</span>
                          <button onClick={() => addToCart(products.find(p => p.id === item.id)!, item.priceType)} className="text-gray-400 hover:text-emerald-600"><Plus size={14} /></button>
                        </div>
                      </div>
                    ))}
                    <div className="pt-4 border-t border-dashed border-gray-200">
                      <div className="flex justify-between items-center mb-4">
                        <span className="font-serif italic text-gray-500">Total</span>
                        <span className="text-2xl font-bold">${cart.reduce((s, i) => s + i.price * i.quantity, 0).toFixed(2)}</span>
                      </div>
                      
                      <div className="mb-6 space-y-3">
                        <div className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Método de Pago</div>
                        <div className="grid grid-cols-2 gap-2">
                          {paymentMethods.map(method => (
                            <button 
                              key={method.id}
                              onClick={() => setSelectedPaymentMethod(method.id)}
                              className={`flex items-center gap-2 p-3 rounded-xl border transition-all text-xs font-bold ${
                                selectedPaymentMethod === method.id 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                : 'bg-gray-50 text-gray-500 border-gray-100'
                              }`}
                            >
                              {method.name === 'Tarjeta' ? <CreditCard size={14} /> : 
                               method.name === 'Efectivo' ? <Plus size={14} /> : 
                               method.name === 'Yappy' ? <CheckCircle2 size={14} /> : <History size={14} />}
                              {method.name}
                            </button>
                          ))}
                        </div>
                        {selectedPaymentMethod === 2 && ( // Transferencia
                          <div className="p-3 bg-amber-50 rounded-xl text-[10px] text-amber-700 leading-relaxed border border-amber-100">
                            <strong>Nota:</strong> Para transferencias, envía el comprobante al WhatsApp de la tienda una vez realizado el pedido.
                          </div>
                        )}
                      </div>

                      <button 
                        onClick={placeOrder}
                        className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                      >
                        Enviar Recadito
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Order History for Client */}
              <div className="bg-white p-6 rounded-[32px] shadow-sm border border-black/5">
                <div className="flex items-center gap-2 mb-6">
                  <History size={20} className="text-[#5A5A40]" />
                  <h3 className="text-xl font-serif font-bold">Mis Pedidos</h3>
                </div>
                
                <div className="space-y-4">
                  {orders.filter(o => o.client_id === user.id).length === 0 ? (
                    <div className="text-center py-4 text-gray-400 text-sm italic">No tienes pedidos anteriores</div>
                  ) : (
                    orders.filter(o => o.client_id === user.id).map(order => (
                      <div key={order.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="font-bold text-sm">Pedido #{order.id}</div>
                            <div className="text-[10px] text-gray-400">{new Date(order.created_at).toLocaleDateString()}</div>
                          </div>
                          <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${
                            order.status === 'delivered' ? 'bg-emerald-100 text-emerald-600' :
                            order.status === 'out_for_delivery' ? 'bg-blue-100 text-blue-600' :
                            'bg-amber-100 text-amber-600'
                          }`}>
                            {order.status === 'pending' ? 'Pendiente' : 
                             order.status === 'preparing' ? 'Preparando' :
                             order.status === 'out_for_delivery' ? 'En camino' : 'Entregado'}
                          </span>
                        </div>
                        <div className="text-xs font-bold text-[#5A5A40]">${order.total_price.toFixed(2)}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {role === 'store' && (
          <div className="space-y-8">
            <div className="flex justify-between items-center">
              <h2 className="text-4xl font-serif font-bold italic">Gestión Recadito</h2>
              <div className="flex gap-4">
                <button 
                  onClick={() => {
                    if (showAddProduct) {
                      setEditingProduct(null);
                      resetNewProduct();
                    }
                    setShowAddProduct(!showAddProduct);
                  }}
                  className="bg-[#5A5A40] text-white px-6 py-3 rounded-2xl shadow-sm flex items-center gap-2 font-bold hover:bg-[#4a4a35] transition-all"
                >
                  <Plus size={20} /> {showAddProduct ? 'Cerrar' : editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
                </button>
                <div className="bg-white px-6 py-3 rounded-2xl shadow-sm border border-black/5 text-center">
                  <div className="text-xs text-gray-400 uppercase font-bold">Stock Crítico</div>
                  <div className="text-2xl font-bold text-red-600">{products.filter(p => p.stock < 5).length}</div>
                </div>
              </div>
            </div>

            <AnimatePresence>
              {showAddProduct && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-white rounded-[32px] shadow-sm border border-black/5 overflow-hidden"
                >
                  <form onSubmit={createProduct} className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-2">Nombre del Producto</label>
                      <input 
                        type="text" required value={newProduct.name} onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                        placeholder="Ej. Tomate Roma" className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-2">Categoría</label>
                      <select 
                        value={newProduct.category} onChange={(e) => setNewProduct({...newProduct, category: e.target.value})}
                        className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                      >
                        <option value="Verduras">Verduras</option>
                        <option value="Frutas">Frutas</option>
                        <option value="Abarrotes">Abarrotes</option>
                        <option value="Puercas">Puercas (Paquetes Mixtos)</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-2">Tipo de Venta</label>
                      <select 
                        value={newProduct.unit_type} onChange={(e) => setNewProduct({...newProduct, unit_type: e.target.value as any})}
                        className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                      >
                        <option value="unidad">Por Unidad</option>
                        <option value="peso">Por Peso (Kg/Lb)</option>
                        <option value="puerca">Como "Puerca" (Bolsa)</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-2">URL de la Foto</label>
                      <input 
                        type="text" required value={newProduct.image} onChange={(e) => setNewProduct({...newProduct, image: e.target.value})}
                        placeholder="https://images.unsplash.com/..." className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                      />
                    </div>
                    
                    {newProduct.unit_type === 'peso' ? (
                      <>
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-2">Precio por Kilo ($)</label>
                          <input 
                            type="number" step="0.01" value={newProduct.price_kg} onChange={(e) => setNewProduct({...newProduct, price_kg: parseFloat(e.target.value)})}
                            className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-2">Precio por Libra ($)</label>
                          <input 
                            type="number" step="0.01" value={newProduct.price_lb} onChange={(e) => setNewProduct({...newProduct, price_lb: parseFloat(e.target.value)})}
                            className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                          />
                        </div>
                      </>
                    ) : (
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-2">Precio por Unidad/Bolsa ($)</label>
                        <input 
                          type="number" step="0.01" value={newProduct.price_unit} onChange={(e) => setNewProduct({...newProduct, price_unit: parseFloat(e.target.value)})}
                          className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                        />
                      </div>
                    )}

                    <div className="space-y-1 lg:col-span-2">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-2">Descripción</label>
                      <textarea 
                        value={newProduct.description} onChange={(e) => setNewProduct({...newProduct, description: e.target.value})}
                        placeholder="Describe el producto o el contenido del paquete..."
                        className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm h-24"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-2">
                        Stock Inicial ({newProduct.unit_type === 'peso' ? 'Libras' : newProduct.unit_type === 'puerca' ? 'Paquetes' : 'Unidades'})
                      </label>
                      <input 
                        type="number" step="0.1" value={newProduct.stock} onChange={(e) => setNewProduct({...newProduct, stock: parseFloat(e.target.value)})}
                        className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-2">
                        Costo de Compra (por {newProduct.unit_type === 'peso' ? 'Lb' : 'Un/Pq'})
                      </label>
                      <input 
                        type="number" step="0.01" value={newProduct.cost_price} onChange={(e) => setNewProduct({...newProduct, cost_price: parseFloat(e.target.value)})}
                        className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-2 p-4 bg-gray-50 rounded-2xl">
                      <input 
                        type="checkbox" 
                        id="active"
                        checked={newProduct.active} 
                        onChange={(e) => setNewProduct({...newProduct, active: e.target.checked})}
                        className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500"
                      />
                      <label htmlFor="active" className="text-sm font-bold text-gray-600 cursor-pointer">Producto Activo (Visible en tienda)</label>
                    </div>
                    <div className="lg:col-span-3 flex justify-end gap-4 pt-4">
                      <button 
                        type="button" onClick={() => setShowAddProduct(false)}
                        className="px-8 py-4 text-gray-400 font-bold hover:text-gray-600 transition-all"
                      >
                        Cancelar
                      </button>
                      <button 
                        type="submit"
                        className="px-12 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                      >
                        {editingProduct ? 'Actualizar Producto' : 'Guardar Producto'}
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              {/* Inventory & Freshness Control */}
              <div className="bg-white rounded-[32px] shadow-sm border border-black/5 overflow-hidden">
                <div className="p-6 border-b border-gray-50 flex justify-between items-center">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Package size={20} className="text-[#5A5A40]" /> Inventario
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-xs font-bold uppercase text-gray-400">Producto</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase text-gray-400">Stock</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase text-gray-400">Precios</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase text-gray-400">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {products.map(product => (
                        <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-bold text-sm">{product.name}</div>
                            <div className="text-[10px] text-gray-400 capitalize">{product.unit_type}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1">
                              <input 
                                type="number" step="0.1" value={product.stock}
                                onChange={(e) => updateProduct(product.id, { stock: parseFloat(e.target.value) })}
                                className="w-16 bg-transparent border-none focus:ring-0 text-sm"
                              />
                              <span className="text-[10px] text-gray-400 uppercase">
                                {product.unit_type === 'peso' ? 'Lb' : product.unit_type === 'puerca' ? 'Pq' : 'Un'}
                              </span>
                            </div>
                            <div className="text-[10px] text-gray-400 mt-1">
                              Costo: ${product.cost_price?.toFixed(2) || '0.00'}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-[10px]">
                            {product.unit_type === 'peso' ? (
                              <div className="space-y-1">
                                <div className="flex justify-between gap-4">
                                  <span>Kg: ${product.price_kg.toFixed(2)}</span>
                                  <span className="text-emerald-600 font-bold">+{((product.price_kg / 2.20462) - (product.cost_price || 0)).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span>Lb: ${product.price_lb.toFixed(2)}</span>
                                  <span className="text-emerald-600 font-bold">+{(product.price_lb - (product.cost_price || 0)).toFixed(2)}</span>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col">
                                <span className="font-bold text-emerald-600">${product.price_unit.toFixed(2)}</span>
                                <span className="text-[9px] text-emerald-700 font-bold">Ganancia: +{(product.price_unit - (product.cost_price || 0)).toFixed(2)}</span>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              <button 
                                onClick={() => updateProduct(product.id, { active: !product.active })}
                                className={`p-2 rounded-lg transition-colors ${product.active ? 'text-emerald-600 hover:bg-emerald-50' : 'text-gray-400 hover:bg-gray-50'}`}
                                title={product.active ? 'Desactivar' : 'Activar'}
                              >
                                {product.active ? <Eye size={16} /> : <EyeOff size={16} />}
                              </button>
                              <button 
                                onClick={() => {
                                  setEditingProduct(product);
                                  setNewProduct({
                                    name: product.name,
                                    description: product.description,
                                    category: product.category,
                                    image: product.image,
                                    unit_type: product.unit_type,
                                    price_unit: product.price_unit,
                                    price_kg: product.price_kg,
                                    price_lb: product.price_lb,
                                    stock: product.stock,
                                    min_stock: product.min_stock,
                                    cost_price: product.cost_price || 0,
                                    active: product.active,
                                    expiry_date: product.expiry_date?.split('T')[0] || ''
                                  });
                                  setShowAddProduct(true);
                                }}
                                className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                              >
                                <Edit size={16} />
                              </button>
                              <button 
                                onClick={() => deleteProduct(product.id)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Rider Management */}
              <div className="bg-white rounded-[32px] shadow-sm border border-black/5 overflow-hidden">
                <div className="p-6 border-b border-gray-50">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Truck size={20} className="text-[#5A5A40]" /> Repartidores Registrados
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-xs font-bold uppercase text-gray-400">Nombre</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase text-gray-400">Vehículo</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase text-gray-400">Estado</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase text-gray-400">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {riders.map(rider => (
                        <tr key={rider.id}>
                          <td className="px-6 py-4">
                            <div className="font-bold text-sm">{rider.full_name}</div>
                            <div className="text-[10px] text-gray-400">{rider.phone}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-xs capitalize">{rider.vehicle_type}</div>
                            <div className="text-[10px] text-gray-400">{rider.plate_number || 'N/A'}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${rider.status === 'Activo' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                              {rider.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <button className="text-xs font-bold text-[#5A5A40] hover:underline">Editar</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Order Assignment */}
              <div className="bg-white rounded-[32px] shadow-sm border border-black/5 overflow-hidden xl:col-span-2">
                <div className="p-6 border-b border-gray-50">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Clock size={20} className="text-[#5A5A40]" /> Asignación de Pedidos
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-xs font-bold uppercase text-gray-400">ID</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase text-gray-400">Total</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase text-gray-400">Estado</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase text-gray-400">Repartidor</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase text-gray-400">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {orders.map(order => (
                        <tr key={order.id}>
                          <td className="px-6 py-4 font-bold text-sm">#{order.id}</td>
                          <td className="px-6 py-4 text-sm">${order.total_price.toFixed(2)}</td>
                          <td className="px-6 py-4">
                            <span className="text-[10px] px-2 py-1 bg-amber-100 text-amber-600 rounded-full font-bold">{order.status}</span>
                          </td>
                          <td className="px-6 py-4">
                            <select 
                              value={order.rider_id || ''}
                              onChange={(e) => updateOrderStatus(order.id, order.status, e.target.value)}
                              className="text-xs p-2 bg-gray-50 rounded-lg border-none focus:ring-2 focus:ring-emerald-500"
                            >
                              <option value="">Sin asignar</option>
                              {riders.map(r => (
                                <option key={r.id} value={r.id}>{r.full_name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              <button onClick={() => updateOrderStatus(order.id, 'En camino', order.rider_id || undefined)} className="text-[10px] font-bold text-blue-600 hover:underline">Enviar</button>
                              <button onClick={() => updateOrderStatus(order.id, 'Cancelado')} className="text-[10px] font-bold text-red-600 hover:underline">Cancelar</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {role === 'delivery' && (
          <div className="space-y-8">
            <div className="flex justify-between items-center">
              <h2 className="text-4xl font-serif font-bold italic">Ruta de Frescura</h2>
              <div className="bg-emerald-600 text-white px-6 py-3 rounded-2xl shadow-lg shadow-emerald-100 flex items-center gap-2">
                <CheckCircle2 size={20} />
                <span className="font-bold">En Línea</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Available Orders */}
              <div className="space-y-6">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Package size={20} className="text-[#5A5A40]" /> Pedidos Disponibles
                </h3>
                <div className="grid gap-4">
                  {orders.filter(o => (o.status === 'Pendiente' || o.status === 'Preparando') && !o.rider_id).length === 0 ? (
                    <div className="bg-white p-8 rounded-[32px] text-center text-gray-400 italic border border-black/5">
                      No hay pedidos nuevos por ahora
                    </div>
                  ) : (
                    orders.filter(o => (o.status === 'Pendiente' || o.status === 'Preparando') && !o.rider_id).map(order => (
                      <div key={order.id} className="bg-white p-6 rounded-[32px] shadow-sm border border-black/5 flex justify-between items-center">
                        <div>
                          <div className="font-bold text-lg">Pedido #{order.id}</div>
                          <div className="text-sm text-gray-500 mb-2">${order.total_price.toFixed(2)}</div>
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <MapPin size={14} /> Dirección del cliente
                          </div>
                        </div>
                        <button 
                          onClick={() => updateOrderStatus(order.id, 'En camino', user.id)}
                          className="px-6 py-3 bg-[#5A5A40] text-white rounded-xl font-bold hover:bg-[#4a4a35] transition-all"
                        >
                          Aceptar Entrega
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* My Active Deliveries */}
              <div className="space-y-6">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Truck size={20} className="text-[#5A5A40]" /> Mis Entregas Activas
                </h3>
                <div className="grid gap-4">
                  {orders.filter(o => o.rider_id === user.id && o.status === 'En camino').map(order => (
                    <motion.div 
                      key={order.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-[#5A5A40] text-white p-6 rounded-[32px] shadow-xl"
                    >
                      <div className="flex justify-between items-start mb-6">
                        <div className="p-3 bg-white/10 text-white rounded-2xl">
                          <Truck size={24} />
                        </div>
                        <div className="text-right">
                          <div className="text-xs opacity-60 font-bold uppercase">En Camino</div>
                          <div className="text-lg font-bold">#{order.id}</div>
                        </div>
                      </div>
                      <div className="mb-6">
                        <div className="text-sm opacity-60">Dirección de Entrega</div>
                        <div className="font-bold text-lg">Calle Principal #123, Sector Norte</div>
                      </div>
                      <button 
                        onClick={() => updateOrderStatus(order.id, 'Entregado', user.id)}
                        className="w-full py-4 bg-white text-[#5A5A40] rounded-2xl font-bold hover:bg-gray-100 transition-all"
                      >
                        Marcar como Entregado
                      </button>
                    </motion.div>
                  ))}
                  {orders.filter(o => o.rider_id === user.id && o.status === 'En camino').length === 0 && (
                    <div className="bg-white p-8 rounded-[32px] text-center text-gray-400 italic border border-black/5">
                      No tienes entregas en curso
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-20 border-t border-black/5 p-12 text-center text-gray-400 text-sm">
        <div className="font-serif italic text-2xl text-[#5A5A40] mb-2">Recadito</div>
        <p>© 2026 - Tecnología al servicio de tu mesa</p>
      </footer>
    </div>
  );
}
