/** @type {import('next').NextConfig} */
const nextConfig = {
  // O catálogo agora fica só na home — links antigos (e a busca) vão pra lá.
  // Cabeçalhos de segurança em todas as páginas: impede o site (e o painel)
  // de ser aberto dentro de outro site (clickjacking), o navegador de
  // "adivinhar" tipo de arquivo, e corta câmera/microfone/localização.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  async redirects() {
    return [{ source: "/produtos", destination: "/", permanent: false }];
  },
  images: {
    // As fotos têm endereço único (nome com data), então dá pra guardar a
    // versão otimizada por 30 dias em vez de buscar de novo no Supabase.
    minimumCacheTTL: 60 * 60 * 24 * 30,
    // Menos tamanhos gerados = menos downloads do original no Supabase.
    deviceSizes: [640, 828, 1080, 1200, 1920],
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
