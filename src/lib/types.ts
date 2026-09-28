export type SiteSettings = {
  store_name: string;
  store_logo_url: string | null;
  store_favicon_url: string | null;
  contact_whatsapp: string | null;
  contact_email: string | null;
  contact_instagram: string | null;
  origin_address: string | null;
  origin_lat: number | null;
  origin_lng: number | null;
  service_fee_percent: number;
  service_fee_fixed: number;
  announcement_text: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  position: number;
  active: boolean;
};

export type Product = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_cents: number;
  compare_at_price_cents: number | null;
  cost_cents: number | null;
  images: string[];
  category_id: string | null;
  stock: number;
  active: boolean;
  created_at: string;
};

export type ProductFlavor = {
  id: string;
  product_id: string;
  name: string;
  stock: number;
  image_url: string | null;
  position: number;
};

export type ProductWithFlavors = Product & {
  product_flavors?: Pick<ProductFlavor, "id" | "stock">[];
};

export type ProductWithFullFlavors = Product & {
  product_flavors?: ProductFlavor[];
};

export type ProductWithCategory = Product & {
  category?: Pick<Category, "id" | "name" | "slug"> | null;
};

export type ShippingZone = {
  id: string;
  name: string;
  cities: string[];
  neighborhoods: string[];
  base_fee_cents: number;
  km_from_origin: number;
  active: boolean;
};

export type OrderStatus =
  | "awaiting_payment"
  | "paid"
  | "confirmed"
  | "preparing"
  | "shipped"
  | "delivered"
  | "cancelled";

export type Order = {
  id: string;
  user_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  shipping_address: Record<string, unknown>;
  shipping_zone_id: string | null;
  status: OrderStatus;
  subtotal_cents: number;
  shipping_fee_cents: number;
  service_fee_cents: number;
  total_cents: number;
  payment_provider: string;
  payment_id: string | null;
  payment_status: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  flavor_id: string | null;
  flavor_name: string | null;
  unit_price_cents: number;
  unit_cost_cents: number | null;
  quantity: number;
};

export type CartItem = {
  productId: string;
  name: string;
  slug: string;
  priceCents: number;
  image: string | null;
  quantity: number;
  stock: number;
  flavorId?: string | null;
  flavorName?: string | null;
};
