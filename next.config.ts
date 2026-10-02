import type { NextConfig } from "next";

// CSP "razonable" sin nonces: Next.js inyecta datos de hidratación (RSC
// payload) como <script> inline y Tailwind usa algunos estilos inline, así
// que script-src/style-src necesitan 'unsafe-inline'. A cambio, se cierra
// todo lo demás (sin orígenes externos, sin objetos, sin ser embebido en
// otros sitios). next/font autoaloja las fuentes de Google en build time,
// así que no hace falta permitir fonts.gstatic.com. img-src permite https:
// porque la vista previa del boletín (admin) embebe imágenes externas que
// el admin pega en la portada del correo.
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self';
  connect-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`
  .replace(/\s{2,}/g, " ")
  .trim();

const nextConfig: NextConfig = {
  // El formulario diario permite adjuntar una foto (hasta 5MB, ver
  // src/lib/response-photos.ts) vía Server Action — el límite por default
  // de Next para el body de una Server Action es 1MB. Viaja en base64
  // (+33%), y aunque normalmente el navegador ya la reduce antes, si no
  // puede (formato que no sabe decodificar) llega completa: 5MB → ~6.7MB.
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: cspHeader },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
