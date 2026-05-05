/** @type {import('next').NextConfig} */
import path from 'path';

const nextConfig = {
  webpack: (config) => {
    // Force resolver to prioritize this project's node_modules
    config.resolve.modules = [
      path.resolve(__dirname, 'node_modules'),
      ...config.resolve.modules,
    ];
    return config;
  },
  turbopack: {
    root: '/Users/franciscoacontellmonje/Desktop/SCITO/SCITO_webdev/Admin_Conferencias',
  },
};

export default nextConfig;
