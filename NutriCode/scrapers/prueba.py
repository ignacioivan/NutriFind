import cloudscraper
from bs4 import BeautifulSoup
import json
import polars as pl
from supabase import create_client, Client
import os
from dotenv import load_dotenv

# Cargamos el archivo secreto .env
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

pl.Config.set_tbl_rows(-1)

# Nuestro sabueso ahora es una función independiente
# Nuestro sabueso ahora es una función independiente
def buscar_productos(elemento, lista_destino):
    if isinstance(elemento, dict):
        nombre = elemento.get('displayName') or elemento.get('skuDisplayName') or elemento.get('name')
        precio_info = elemento.get('price')
        
        # Extracción de imagen
        imagen = None
        if elemento.get('images') and isinstance(elemento.get('images'), list):
            imagen = elemento.get('images')[0]
        elif elemento.get('imageUrl'):
            imagen = elemento.get('imageUrl')
        elif elemento.get('image'):
            imagen = elemento.get('image')

        # --- EXTRACCIÓN DE MARCA Y URL (VERSIÓN DEFINITIVA) ---
        marca = elemento.get('brand') or elemento.get('brandName') or "Sin marca"
        
        # 1. Buscamos el enlace perfecto que ya viene oculto en los datos
        ruta_prearmada = (elemento.get('canonicalUrl') or 
                          elemento.get('seoUrl') or 
                          elemento.get('destUrl') or 
                          elemento.get('linkText'))
        
        url_origen = ""
        if ruta_prearmada:
            ruta_str = str(ruta_prearmada)
            if "lider.cl" in ruta_str:
                url_origen = ruta_str
            elif ruta_str.startswith("/"):
                url_origen = f"https://www.lider.cl{ruta_str}"
            else:
                url_origen = f"https://www.lider.cl/{ruta_str}"
        else:
            # 2. Si no viene pre-armado, lo construimos usando el Código de Barras (EAN)
            codigo_largo = (elemento.get('ean') or 
                            elemento.get('upc') or 
                            elemento.get('itemNumber') or 
                            elemento.get('sku') or 
                            elemento.get('id'))
            
            slug = str(nombre).lower().strip().replace(" ", "-").replace("/", "-")
            
            # Extraemos la categoría real de la lista de categorías del producto
            categorias = elemento.get('categories')
            cat_real = "supermercado"
            if categorias and isinstance(categorias, list) and len(categorias) > 0:
                cat_real = str(categorias[0]).lower().strip().replace(" ", "-").replace("/", "-")
                
            url_origen = f"https://www.lider.cl/ip/{cat_real}/{slug}/{codigo_largo}"
        # ------------------------------------------------------
        
        if nombre and precio_info:
            precio_final = precio_info.get('BasePriceSales') or precio_info.get('price') if isinstance(precio_info, dict) else precio_info
            
            if precio_final:
                lista_destino.append({
                    "nombre": str(nombre).strip(),
                    "precio": int(precio_final),
                    "supermercado": "Lider",
                    "imagen_url": str(imagen) if imagen else "",
                    "marca": str(marca).strip(),           # <- Se envía a Supabase
                    "url_origen": str(url_origen).strip()  # <- Se envía a Supabase
                })
                
        for valor in elemento.values():
            buscar_productos(valor, lista_destino)
            
    elif isinstance(elemento, list):
        for item in elemento:
            buscar_productos(item, lista_destino)
def extraer_y_subir_lider(url_base):
    print(f"\n[HACKEANDO] Iniciando extracción masiva de: {url_base}")
    
    scraper = cloudscraper.create_scraper(browser={'browser': 'chrome', 'platform': 'windows', 'desktop': True})
    
    todos_los_productos = []
    nombres_vistos = set() # Nuestro registro para saber si la página nos repite productos
    pagina = 1
    
    # Bucle infinito que solo se detiene cuando no hay productos nuevos
    while True:
        # Construimos la URL agregándole el número de página al final
        separador = "&" if "?" in url_base else "?"
        url_pagina = f"{url_base}{separador}page={pagina}"
        
        respuesta = scraper.get(url_pagina)
        if respuesta.status_code != 200:
            print(f"Error {respuesta.status_code}. Deteniendo búsqueda.")
            break
            
        soup = BeautifulSoup(respuesta.text, 'html.parser')
        etiqueta_json = soup.find('script', id='__NEXT_DATA__')
        
        if not etiqueta_json:
            print("No se encontró la base de datos en esta página. Fin del recorrido.")
            break

        datos_completos = json.loads(etiqueta_json.string)
        productos_de_esta_pagina = []
        
        # El sabueso rastrea solo esta página
        buscar_productos(datos_completos, productos_de_esta_pagina)
        
        # Filtramos para ver cuántos productos son realmente NUEVOS
        productos_nuevos = 0
        for prod in productos_de_esta_pagina:
            if prod["nombre"] not in nombres_vistos:
                nombres_vistos.add(prod["nombre"])
                todos_los_productos.append(prod)
                productos_nuevos += 1
                
        print(f"   {productos_nuevos} productos.")
        
        # Si la página no nos dio ningún producto nuevo, significa que llegamos al final
        if productos_nuevos == 0:
            print("¡Finalizado!")
            break
            
        pagina += 1 # Pasamos a la siguiente página

    # --- FASE DE SUBIDA ---
    if not todos_los_productos:
        print("No se encontraron productos.")
        return
        
    print(f"\nTotal recolectado: {len(todos_los_productos)} productos. Subiendo a supabase")
    
    # Pasamos por Polars como última capa de seguridad
    df = pl.DataFrame(todos_los_productos)
    df_limpio = df.unique(subset=["nombre"])
    datos_para_subir = df_limpio.to_dicts()
    
    try:
        respuesta_db = supabase.table('productos_demo').upsert(datos_para_subir, on_conflict="nombre").execute()
        print(f"¡Éxito total! Se actualizaron/insertaron {len(respuesta_db.data)} productos en Supabase.")
    except Exception as e:
        print(f"Error al subir a Supabase: {e}")

if __name__ == "__main__":
    urls_lider = [
        "https://www.lider.cl/browse/alimentacion/mundo-saludable/sin-gluten/94975735_74790401_95993612"
    ]
    
    for enlace in urls_lider:
        extraer_y_subir_lider(enlace)