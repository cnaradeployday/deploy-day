import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // playwright-core lee browsers.json de su propia carpeta en runtime; sin esto
  // el trace de la funcion serverless no lo incluye y la captura de portada
  // automatica de Presentaciones falla con "Cannot find module .../browsers.json".
  outputFileTracingIncludes: {
    '/api/presentaciones/upload': [
      './node_modules/playwright-core/**/*',
      './node_modules/@sparticuz/chromium/**/*',
    ],
  },
}

export default nextConfig
