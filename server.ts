import express from "express";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Auth Endpoints
  app.get("/api/auth/google/url", async (req, res) => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${process.env.APP_URL}/auth/callback`,
        skipBrowserRedirect: true
      }
    });
    
    if (error) return res.status(500).json({ error: error.message });
    res.json({ url: data.url });
  });

  app.get("/api/auth/github/url", async (req, res) => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${process.env.APP_URL}/auth/callback`,
        skipBrowserRedirect: true
      }
    });
    
    if (error) return res.status(500).json({ error: error.message });
    res.json({ url: data.url });
  });

  app.get("/auth/callback", async (req, res) => {
    // Supabase handles the session via query params/hash usually.
    // We just need to notify the opener and close.
    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Autenticación exitosa. Esta ventana se cerrará automáticamente.</p>
        </body>
      </html>
    `);
  });

  // API Routes
  app.get("/api/products", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name");
      
      if (error) throw error;
      
      // Automatic Offers Logic: If freshness is low (e.g., expires in < 2 days), apply 30% discount
      const processedProducts = data.map(p => {
        if (p.expiry_date) {
          const expiry = new Date(p.expiry_date);
          const now = new Date();
          const diffDays = (expiry.getTime() - now.getTime()) / (1000 * 3600 * 24);
          if (diffDays > 0 && diffDays < 2) {
            return { ...p, discount: 0.3, original_price: p.price, price: p.price * 0.7 };
          }
        }
        return p;
      });

      res.json(processedProducts);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/orders", async (req, res) => {
    try {
      const { client_id, items, total_price } = req.body;
      console.log("Recibiendo pedido:", { client_id, itemsCount: items?.length, total_price });
      
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert([{ client_id, items, total_price, status: 'pending' }])
        .select()
        .single();

      if (orderError) {
        console.error("Error de Supabase al insertar pedido:", orderError);
        throw orderError;
      }

      console.log("Pedido creado con éxito:", order.id);
      res.json(order);
    } catch (err: any) {
      console.error("Error en el servidor al procesar pedido:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/orders", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/orders/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { status, delivery_id } = req.body;
      
      const updateData: any = {};
      if (status) updateData.status = status;
      if (delivery_id) updateData.delivery_id = delivery_id;

      const { error } = await supabase
        .from("orders")
        .update(updateData)
        .eq("id", id);
      
      if (error) throw error;
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin: Create Product
  app.post("/api/products", async (req, res) => {
    try {
      const product = req.body;
      const { data, error } = await supabase
        .from("products")
        .insert([product])
        .select()
        .single();
      
      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/products/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      const { error } = await supabase
        .from("products")
        .update(updateData)
        .eq("id", id);
      
      if (error) throw error;
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
