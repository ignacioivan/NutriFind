# Solo desarrollo local. Producción se despliega en Cloudflare Workers.
# Debian slim (no alpine): workerd, el runtime de Cloudflare que usa `astro dev`, necesita glibc.
FROM node:24-slim

# workerd necesita los certificados CA del sistema para hablar HTTPS con Supabase.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 4321
CMD ["npx", "astro", "dev", "--host", "0.0.0.0"]
