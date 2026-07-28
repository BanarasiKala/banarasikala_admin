import { requiredEnv } from "../utils/env";

const API_BASE_URL = requiredEnv("VITE_API_URL");

export const API_ENDPOINTS = {
  base: API_BASE_URL,
  products: `${API_BASE_URL}/api/products`,
  colors: `${API_BASE_URL}/api/colors`,
  materials: `${API_BASE_URL}/api/materials`,
  varieties: `${API_BASE_URL}/api/varieties`,
  occasions: `${API_BASE_URL}/api/occasions`,
  orders: `${API_BASE_URL}/api/orders`,
  coupons: `${API_BASE_URL}/api/coupons`,
  feedback: `${API_BASE_URL}/api/feedback`,
  adminReviews: `${API_BASE_URL}/api/admin-reviews`,
  stockNotifications: `${API_BASE_URL}/api/stock-notifications`,
  reels: `${API_BASE_URL}/api/reels`,
  royale: `${API_BASE_URL}/api/royale`,
  boxSections: `${API_BASE_URL}/api/box-sections`,
  marketplaces: `${API_BASE_URL}/api/marketplaces`,
  auth: `${API_BASE_URL}/api/auth`,
  support: `${API_BASE_URL}/api/support`,
  newsletter: `${API_BASE_URL}/api/newsletter`,
};

export default API_ENDPOINTS;
