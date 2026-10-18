import json
import polars as pl
from supabase import create_client, Client
import os
from dotenv import load_dotenv
# --- 1. CONFIGURACIÓN DE SUPABASE ---
# IMPORTANTE: Reemplaza esto con tus datos, pero NO subas este archivo a GitHub con tus llaves.
# Cargamos el archivo secreto .env
load_dotenv()

# --- 1. CONFIGURACIÓN DE SUPABASE ---
# Ahora saca los datos del archivo .env de forma segura
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Mostrar todas las filas en Polars
pl.Config.set_tbl_rows(-1)

def procesar_y_subir_lider():
    print("Abriendo la caja fuerte (datos_lider.json)...")
    
    with open('datos_lider.json', 'r', encoding='utf-8') as archivo:
        datos_completos = json.load(archivo)
        
    productos_encontrados = []

    def sabueso(elemento):
        if isinstance(elemento, dict):
            nombre = elemento.get('displayName') or elemento.get('skuDisplayName') or elemento.get('name')
            precio_info = elemento.get('price')
            
            if nombre and precio_info:
                precio_final = None
                if isinstance(precio_info, dict):
                    precio_final = precio_info.get('BasePriceSales') or precio_info.get('price')
                else:
                    precio_final = precio_info
                
                if precio_final:
                    # NOTA: Cambiamos los nombres a minúsculas para que coincidan con Supabase
                    productos_encontrados.append({
                        "nombre": str(nombre).strip(),
                        "precio": int(precio_final),
                        "supermercado": "Lider" # Agregamos esta etiqueta para tu app
                    })
            
            for valor in elemento.values():
                sabueso(valor)
                
        elif isinstance(elemento, list):
            for item in elemento:
                sabueso(item)

    print("Procesando datos...")
    sabueso(datos_completos)
    
    # Pasamos a Polars para limpiar duplicados
    df = pl.DataFrame(productos_encontrados)
    df_limpio = df.unique(subset=["nombre"])
    
    print("\nTabla lista para subir:")
    print(df_limpio.head(5)) # Solo mostramos los 5 primeros en consola para no ensuciar
    
    # --- 2. SUBIR A SUPABASE ---
    print("\nConectando con Supabase...")
    
    # Convertimos el DataFrame de Polars a una lista de diccionarios (el formato que lee Supabase)
    datos_para_subir = df_limpio.to_dicts()
    
    try:
        # Usamos .upsert() o .insert() para subir los datos a la tabla 'productos'
        respuesta = supabase.table('productos_demo').insert(datos_para_subir).execute()
        print(f"¡Éxito! Se subieron {len(respuesta.data)} productos a tu base de datos.")
    except Exception as e:
        print(f"Hubo un error al subir a Supabase: {e}")

if __name__ == "__main__":
    procesar_y_subir_lider()