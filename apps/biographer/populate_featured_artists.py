import os
import sys
import requests
from dotenv import load_dotenv
import pymongo
from pathlib import Path
import base64
from html.parser import HTMLParser
from datetime import datetime

# --- Parser para extraer el H2 ---
class H2Parser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_h2 = False
        self.h2_content = ''
        self.found_h2 = False

    def handle_starttag(self, tag, attrs):
        if tag == 'h2' and not self.found_h2:
            self.in_h2 = True

    def handle_data(self, data):
        if self.in_h2:
            self.h2_content += data

    def handle_endtag(self, tag):
        if tag == 'h2' and self.in_h2:
            self.in_h2 = False
            self.found_h2 = True

def get_h2_content(html_content):
    parser = H2Parser()
    parser.feed(html_content)
    return parser.h2_content.strip()

# --- Lógica principal del script ---
def get_config():
    """Carga la configuración desde las variables de entorno."""
    env_path = Path(__file__).parent / '.env'
    load_dotenv(dotenv_path=env_path)
    
    config = {
        "MONGO_URI": os.getenv("MONGO_URI"),
        "DB_NAME": os.getenv("DB_NAME", "duende-finder"),
        "PAYLOAD_API_URL": os.getenv("PAYLOAD_API_URL", "https://cms-duendefinder.vercel.app/api"),
        "PAYLOAD_API_KEY": os.getenv("PAYLOAD_API_KEY"),
        "WORDPRESS_URL": os.getenv("WORDPRESS_URL"),
        "WORDPRESS_USER": os.getenv("WORDPRESS_USER"),
        "WORDPRESS_APP_PASSWORD": os.getenv("WORDPRESS_APP_PASSWORD"),
        "ARTIST_CATEGORY_ID": 66
    }
    
    for key in config:
        if config[key] is None and key != "ARTIST_CATEGORY_ID": # ARTIST_CATEGORY_ID has a default
            print(f"Error: La variable de entorno {key} no está configurada en .env.")
            sys.exit(1)
    return config

def get_wordpress_auth(user, password):
    """Genera el token de autenticación para WordPress."""
    credentials = f"{user}:{password}"
    token = base64.b64encode(credentials.encode())
    return {'Authorization': f'Basic {token.decode("utf-8")}'}

def get_featured_image_url(media_url, auth_headers):
    """Obtiene la URL de la imagen destacada desde su endpoint de media."""
    try:
        res = requests.get(media_url, headers=auth_headers)
        res.raise_for_status()
        media_data = res.json()
        return media_data.get('source_url', None)
    except requests.exceptions.RequestException as e:
        print(f"  - Error al obtener la imagen destacada desde {media_url}: {e}")
        return None

def sync_artist_with_db(db, artist_data):
    """Crea o encuentra un artista en MongoDB y devuelve su ID."""
    artist_name = artist_data['name']
    
    # 1. Buscar si el artista ya existe
    existing_artist = db.artists.find_one({"name": artist_name})
    
    if existing_artist:
        print(f"  - Artista '{artist_name}' ya existe en MongoDB (ID: {existing_artist['_id']}).")
        return str(existing_artist['_id'])
    else:
        # 2. Si no existe, crearlo
        print(f"  - Artista '{artist_name}' no encontrado. Creando nuevo registro...")
        new_artist = {
            "name": artist_name,
            "bio": artist_data.get('bio', ''),
            "image": artist_data.get('imageUrl', ''), # Asumiendo que tienes un campo de texto para la URL
            # Aquí podrías añadir más campos si los necesitas
            "createdAt": datetime.now(),
            "updatedAt": datetime.now()
        }
        result = db.artists.insert_one(new_artist)
        print(f"  - Nuevo artista creado con ID: {result.inserted_id}")
        return str(result.inserted_id)

def update_payload_slider(config, slider_title, artist_ids):
    # (Esta función es similar a la del otro script, adaptada para artistas)
    api_url = config["PAYLOAD_API_URL"]
    headers = {
        "Authorization": f"users API-Key {config['PAYLOAD_API_KEY']}",
        "Content-Type": "application/json"
    }
    
    print(f"\n--- Procesando slider: {slider_title} ---")
    get_url = f"{api_url}/sliders?where[title][equals]={slider_title}"
    
    try:
        res = requests.get(get_url, headers=headers)
        res.raise_for_status()
        existing_sliders = res.json()
        
        payload_items = [{"relationTo": "artists", "value": artist_id} for artist_id in artist_ids]
        
        payload_data = {"title": slider_title, "sliderItems": payload_items}

        if existing_sliders.get("totalDocs", 0) > 0:
            slider_id = existing_sliders["docs"][0]["id"]
            print(f"Slider encontrado (ID: {slider_id}). Actualizando con {len(artist_ids)} artistas...")
            patch_url = f"{api_url}/sliders/{slider_id}"
            requests.patch(patch_url, json=payload_data, headers=headers).raise_for_status()
            print(f"¡Slider '{slider_title}' actualizado con éxito!")
        else:
            print(f"Slider no encontrado. Creando uno nuevo con {len(artist_ids)} artistas...")
            requests.post(f"{api_url}/sliders", json=payload_data, headers=headers).raise_for_status()
            print(f"¡Slider '{slider_title}' creado con éxito!")

    except requests.exceptions.RequestException as e:
        print(f"Error al comunicarse con la API de Payload: {e}")
        if e.response: print(f"Detalles: {e.response.text}")

def main():
    print("--- Iniciando script para poblar slider de Artistas Destacados desde WordPress ---")
    config = get_config()
    auth_headers = get_wordpress_auth(config['WORDPRESS_USER'], config['WORDPRESS_APP_PASSWORD'])
    
    # 1. Obtener posts de WordPress
    wp_url = f"{config['WORDPRESS_URL']}/wp-json/wp/v2/posts?categories={config['ARTIST_CATEGORY_ID']}&per_page=20"
    print(f"Obteniendo artistas de WordPress (categoría {config['ARTIST_CATEGORY_ID']})...")
    
    try:
        response = requests.get(wp_url, headers=auth_headers)
        response.raise_for_status()
        posts = response.json()
        print(f"Se encontraron {len(posts)} artistas en WordPress.")
    except requests.exceptions.RequestException as e:
        print(f"Error al obtener posts de WordPress: {e}")
        sys.exit(1)

    if not posts:
        print("No se encontraron posts en la categoría especificada. Saliendo.")
        return

    # 2. Conectar a MongoDB
    try:
        client = pymongo.MongoClient(config['MONGO_URI'])
        db = client[config['DB_NAME']]
    except pymongo.errors.ConnectionFailure as e:
        print(f"Error de conexión a MongoDB: {e}")
        sys.exit(1)

    # 3. Procesar cada post y sincronizar con MongoDB
    artist_ids_for_slider = []
    for post in posts:
        print(f"\nProcesando post: '{post['title']['rendered']}'")
        
        # Extraer datos básicos
        artist_name = post['title']['rendered']
        bio_h2 = get_h2_content(post['content']['rendered'])
        
        # Obtener URL de la imagen destacada
        image_url = None
        if post['_links'].get('wp:featuredmedia'):
            media_url = post['_links']['wp:featuredmedia'][0]['href']
            image_url = get_featured_image_url(media_url, auth_headers)
        
        if not image_url:
            print("  - Advertencia: No se pudo obtener la imagen destacada para este artista.")

        # Sincronizar con DB y obtener ID
        artist_id = sync_artist_with_db(db, {
            "name": artist_name,
            "bio": bio_h2,
            "imageUrl": image_url
        })
        artist_ids_for_slider.append(artist_id)

    # 4. Actualizar el slider en Payload
    if artist_ids_for_slider:
        update_payload_slider(config, "Artistas Destacados 2025", artist_ids_for_slider)

    client.close()
    print("\n--- Proceso Finalizado ---")

if __name__ == "__main__":
    main()
