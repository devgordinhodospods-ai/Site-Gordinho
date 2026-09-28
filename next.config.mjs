/** @type {import('next').NextConfig} */
const nextConfig = {
  // O catálogo agora fica só na home — links antigos (e a busca) vão pra lá.
  async redirects() {
    return [{ source: "/produtos", destination: "/", permanent: false }];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "placehold.co",
      },
    ],
  },
};

export default nextConfig;
