import cloudscraper
from bs4 import BeautifulSoup
import json

def extraer_json_oculto():
    print("Poniéndonos el traje ninja (Cloudscraper)...")
    
    # Creamos el scraper que engaña a las protecciones antibot
    scraper = cloudscraper.create_scraper(
        browser={
            'browser': 'chrome',
            'platform': 'windows',
            'desktop': True
        }
    )
    
    url = "https://www.lider.cl/browse/alimentacion/mundo-saludable/sin-gluten/94975735_74790401_95993612"
    
    print("Descargando la página a la velocidad de la luz...")
    respuesta = scraper.get(url)
    
    # Verificamos si Lider nos dejó entrar
    if respuesta.status_code != 200:
        print(f"Error {respuesta.status_code}: Lider nos bloqueó el paso.")
        return
        
    print("Analizando el HTML en busca de la caja fuerte...")
    soup = BeautifulSoup(respuesta.text, 'html.parser')
    
    # Buscamos la etiqueta oculta de Next.js
    etiqueta_json = soup.find('script', id='__NEXT_DATA__')
    
    if etiqueta_json:
        print("¡Bingo! Encontramos la base de datos oculta.")
        
        # Convertimos el texto en un diccionario de Python
        datos_completos = json.loads(etiqueta_json.string)
        
        # Guardamos todo en un archivo JSON en tu carpeta
        with open('datos_lider.json', 'w', encoding='utf-8') as archivo:
            json.dump(datos_completos, archivo, indent=4, ensure_ascii=False)
            
        print("\n¡Éxito! Revisa la carpeta de tu proyecto. Se creó un archivo llamado 'datos_lider.json'.")
    else:
        print("No se encontró el __NEXT_DATA__. Lider cambió su estructura HTML.")

if __name__ == "__main__":
    extraer_json_oculto()
    