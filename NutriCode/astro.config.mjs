import { defineConfig, envField, fontProviders } from 'astro/config';
import react from '@astrojs/react';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'server',
  // Las imágenes vienen de las tiendas (walmartimages); no usamos astro:assets, así que no se necesita el binding IMAGES.
  adapter: cloudflare({ imageService: 'passthrough' }),
  integrations: [react()],
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Archivo',
      cssVariable: '--font-archivo',
      weights: [400, 700, 900],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['Helvetica Neue', 'Arial', 'sans-serif'],
    },
    {
      provider: fontProviders.google(),
      name: 'IBM Plex Mono',
      cssVariable: '--font-plex-mono',
      weights: [400, 600],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['ui-monospace', 'monospace'],
    },
  ],
  env: {
    schema: {
      SUPABASE_URL: envField.string({ context: 'server', access: 'public', url: true }),
      SUPABASE_ANON_KEY: envField.string({ context: 'server', access: 'secret' }),
    },
  },
  vite: {
    plugins: [tailwindcss()],
    server: {
      allowedHosts: ['dev.200369.xyz', '.200369.xyz'],
    },
  },
});
