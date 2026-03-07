// API Configuration
// In development, use localhost
// In production, use environment variable or default

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// For production deployment, set VITE_API_URL in your .env file or Vercel environment variables
// Example: VITE_API_URL=https://your-api.onrender.com
