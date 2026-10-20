import type { Product } from "./api";

// Local fixtures only. Nothing in this module writes to a database.
const users = [
  { id: 1, name: "Ahmed Alharbi", email: "seller1@demo.autonegotiater.com", role: "seller" },
  { id: 2, name: "Sara Alqahtani", email: "seller2@demo.autonegotiater.com", role: "seller" },
  { id: 3, name: "Khalid Alotaibi", email: "seller3@demo.autonegotiater.com", role: "seller" },
  { id: 4, name: "Noura Alshammari", email: "buyer1@demo.autonegotiater.com", role: "buyer" },
  { id: 5, name: "Faisal Aldosari", email: "buyer2@demo.autonegotiater.com", role: "buyer" },
  { id: 6, name: "Demo Administrator", email: "admin@demo.autonegotiater.com", role: "admin" },
];

export const mockProducts: Product[] = [
  { id: 1, seller_id: 1, name: "iPhone 15 Pro 256GB - Natural Titanium", description: "Natural Titanium, 95% battery health. Mint condition with zero scratches. Includes original retail box, braided USB-C cable, and 3 months remaining Jarir warranty.", category: "Electronics", base_price: "3850.00", stock_quantity: 2, image_url: null, created_at: "2026-10-01T09:00:00Z" },
  { id: 2, seller_id: 1, name: "Sony WH-1000XM5 Headphones", description: "Noise cancelling headphones, like new with carrying case.", category: "Electronics", base_price: "950.00", stock_quantity: 3, image_url: null, created_at: "2026-10-02T09:00:00Z" },
  { id: 3, seller_id: 2, name: "L-Shaped Sofa (Grey)", description: "Five-seat fabric sofa, two years old. Pickup in Riyadh.", category: "Furniture", base_price: "2200.00", stock_quantity: 1, image_url: null, created_at: "2026-10-03T09:00:00Z" },
  { id: 4, seller_id: 2, name: "Office Chair Ergonomic", description: "Mesh back, adjustable arms and lumbar support.", category: "Furniture", base_price: "650.00", stock_quantity: 4, image_url: null, created_at: "2026-10-04T09:00:00Z" },
  { id: 5, seller_id: 3, name: "Car Dash Camera 4K", description: "Front and rear cameras, GPS and 64GB memory card.", category: "Vehicles/Parts", base_price: "450.00", stock_quantity: 5, image_url: null, created_at: "2026-10-05T09:00:00Z" },
  { id: 6, seller_id: 3, name: "Treadmill Foldable", description: "Maximum speed 14 km/h, 120kg capacity, home use.", category: "Sports", base_price: "1700.00", stock_quantity: 1, image_url: null, created_at: "2026-10-06T09:00:00Z" },
  { id: 7, seller_id: 2, name: "iPhone 15 Pro 256GB - Blue Titanium", description: "Blue Titanium, 89% battery health. Minor cosmetic hairline scuff on bottom bezel. Screen protector applied from day one. Includes 2 MagSafe protective cases.", category: "Electronics", base_price: "3700.00", stock_quantity: 1, image_url: null, created_at: "2026-10-07T09:00:00Z" },
  { id: 8, seller_id: 3, name: "iPhone 15 Pro 256GB - Black Titanium", description: "Black Titanium, 92% battery health. Handset only (no box). Fully functional, Face ID and cameras tested 100%. Hand-to-hand pickup in Buraydah or fast courier shipping.", category: "Electronics", base_price: "3790.00", stock_quantity: 2, image_url: null, created_at: "2026-10-07T09:00:00Z" },
  { id: 9, seller_id: 1, name: "PlayStation 5 Slim Disc Edition 1TB", description: "Slim Disc Edition with 1TB SSD. Comes with two DualSense wireless controllers (White & Midnight Black) and 2 physical games (EA FC 24 and Spider-Man 2). Lightly used.", category: "Electronics", base_price: "1950.00", stock_quantity: 2, image_url: null, created_at: "2026-10-08T09:00:00Z" },
  { id: 10, seller_id: 2, name: "PlayStation 5 Digital Edition 1TB", description: "Digital Edition 1TB in pristine condition. Single white DualSense controller, high-speed HDMI 2.1 cable, original power lead, and original packaging. Zero fan noise.", category: "Electronics", base_price: "1720.00", stock_quantity: 1, image_url: null, created_at: "2026-10-08T09:00:00Z" },
  { id: 11, seller_id: 3, name: "PlayStation 5 Disc Edition 825GB", description: "Original Disc model with vertical cooling charging stand included. 1 DualSense controller. Clean thermals, regularly dusted, excellent operating condition.", category: "Electronics", base_price: "1820.00", stock_quantity: 2, image_url: null, created_at: "2026-10-08T09:00:00Z" },
  { id: 12, seller_id: 1, name: "Samsung Galaxy S24 Ultra 256GB Titanium Gray", description: "Titanium Gray, 256GB, 12GB RAM. Embedded S-Pen included. Factory screen protector intact, immaculate body condition, original 45W fast wall charger and box included.", category: "Electronics", base_price: "3700.00", stock_quantity: 2, image_url: null, created_at: "2026-10-09T09:00:00Z" },
  { id: 13, seller_id: 2, name: "Samsung Galaxy S24 Ultra 256GB Titanium Violet", description: "Titanium Violet, 256GB. Battery health excellent. Tiny surface mark near speaker grill, otherwise flawless. Comes with Samsung Smart View wallet cover.", category: "Electronics", base_price: "3550.00", stock_quantity: 1, image_url: null, created_at: "2026-10-09T09:00:00Z" },
  { id: 14, seller_id: 3, name: "Samsung Galaxy S24 Ultra 512GB Titanium Black", description: "Upgraded 512GB storage capacity, Titanium Black. Dual SIM (nano + eSIM). Clean IMEI, fully unlocked, with official Samsung clear grip case.", category: "Electronics", base_price: "3950.00", stock_quantity: 1, image_url: null, created_at: "2026-10-09T09:00:00Z" },
];

const sessions = [
  { session_id: 101, buyer_id: 4, product_id: 1, max_budget: 3500, mode: "semi_automated", status: "active", started_at: "2026-10-13T08:00:00Z" },
  { session_id: 102, buyer_id: 4, product_id: 3, max_budget: 1900, mode: "semi_automated", status: "completed", started_at: "2026-10-12T08:00:00Z" },
  { session_id: 103, buyer_id: 4, product_id: 5, max_budget: 380, mode: "automated", status: "cancelled", started_at: "2026-10-11T08:00:00Z" },
  { session_id: 104, buyer_id: 5, product_id: 6, max_budget: 1500, mode: "semi_automated", status: "active", started_at: "2026-10-13T07:00:00Z" },
  { session_id: 105, buyer_id: 5, product_id: 2, max_budget: 850, mode: "automated", status: "completed", started_at: "2026-10-10T08:00:00Z" },
];

const deals = [
  { deal_id: 201, session_id: 102, final_price: 1850, agreed_conditions: { delivery: "Buyer pickup", warranty_months: 0 }, buyer_confirmed: true, seller_confirmed: true, created_at: "2026-10-12T09:00:00Z" },
  { deal_id: 202, session_id: 105, final_price: 830, agreed_conditions: { delivery: "Within 3 days", warranty_months: 1 }, buyer_confirmed: true, seller_confirmed: true, created_at: "2026-10-10T09:00:00Z" },
];

function findUser(id: number, role: string) {
  const user = users.find((entry) => entry.id === id && entry.role === role);
  if (!user) throw new Error(`Mock ${role} not found (${id})`);
  return user;
}

export function getMockSellerDashboard(sellerId: number) {
  const seller = findUser(sellerId, "seller");
  const products = mockProducts.filter((product) => product.seller_id === sellerId);
  const sellerSessions = sessions.filter((session) => products.some((product) => product.id === session.product_id));
  return {
    seller: { id: seller.id, name: seller.name, email: seller.email },
    stats: { total_products: products.length, active_negotiations: sellerSessions.filter((session) => session.status === "active").length, completed_deals: sellerSessions.filter((session) => session.status === "completed").length },
    products: products.map((product) => ({ id: product.id, name: product.name, category: product.category, base_price: Number(product.base_price), min_acceptable_price: Number(product.base_price) * 0.8, stock_quantity: product.stock_quantity, has_rules: product.id % 2 === 1, auto_accept_threshold: product.id % 2 === 1 ? Number(product.base_price) * 0.95 : null, max_rounds: product.id % 2 === 1 ? 6 : null })),
    recent_sessions: sellerSessions.map((session) => ({ id: session.session_id, product_id: session.product_id, buyer_id: session.buyer_id, status: session.status, mode: session.mode, started_at: session.started_at })),
  };
}

export function getMockBuyerDashboard(buyerId: number) {
  const buyer = findUser(buyerId, "buyer");
  const buyerSessions = sessions.filter((session) => session.buyer_id === buyerId);
  return {
    buyer: { id: buyer.id, name: buyer.name, email: buyer.email },
    stats: { active_negotiations: buyerSessions.filter((session) => session.status === "active").length, completed_deals: buyerSessions.filter((session) => session.status === "completed").length, total_sessions: buyerSessions.length },
    sessions: buyerSessions.map((session) => {
      const product = mockProducts.find((entry) => entry.id === session.product_id)!;
      return { session_id: session.session_id, product_id: product.id, product_name: product.name, base_price: Number(product.base_price), max_budget: session.max_budget, status: session.status, mode: session.mode, started_at: session.started_at };
    }),
    deals: deals.filter((deal) => buyerSessions.some((session) => session.session_id === deal.session_id)),
  };
}

export function getMockAdminDashboard() {
  return {
    metrics: { total_users: users.length, total_buyers: 2, total_sellers: 3, total_products: mockProducts.length, total_sessions: sessions.length, active_sessions: sessions.filter((session) => session.status === "active").length, completed_deals: deals.length },
    users: users.map((user) => ({ ...user, phone: null, is_active: true, registered_at: "2026-10-01" })),
    recent_audit_logs: [
      { id: 301, user_id: 4, action: "negotiation_started", details: { session_id: 101, product_id: 1 }, timestamp: "2026-10-13T08:00:00Z" },
      { id: 302, user_id: 4, action: "deal_confirmed", details: { session_id: 102, deal_id: 201 }, timestamp: "2026-10-12T09:00:00Z" },
      { id: 303, user_id: 4, action: "negotiation_cancelled", details: { session_id: 103 }, timestamp: "2026-10-11T09:00:00Z" },
    ],
  };
}
