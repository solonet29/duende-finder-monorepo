import os
import sys
from dotenv import load_dotenv
import pymongo
import requests
from pathlib import Path
import google.generativeai as genai
import time

# Carga las variables de entorno desde la carpeta del script
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path)

def get_config():
    """Carga y valida la configuración desde las variables de entorno."""
    config = {
        "MONGO_URI": os.getenv("MONGO_URI"),
        "DB_NAME": os.getenv("DB_NAME", "duende-finder"),
        "WP_URL": os.getenv("WP_URL"),
        "WP_USER": os.getenv("WP_USER"),
        "WP_PASSWORD": os.getenv("WP_PASSWORD"),
        "GEMINI_API_KEY": os.getenv("GEMINI_API_KEY"),
    }
    for key, value in config.items():
        if not value:
            print(f"Error: La variable de entorno {key} no está configurada.")
            sys.exit(1)
    
    if config["WP_URL"]:
        config["WP_URL"] = config["WP_URL"].rstrip('/')
        
    return config

def get_artists_from_db(config):
    """Obtiene todos los artistas con página de perfil desde MongoDB."""
    print("Conectando a MongoDB para obtener artistas...")
    try:
        client = pymongo.MongoClient(config['MONGO_URI'])
        db = client[config['DB_NAME']]
        artists_collection = db["artists"]
        
        query = {"hasProfilePage": True, "profilePageUrl": {"$exists": True}}
        projection = {"name": 1, "profilePageUrl": 1, "profileStatus": 1, "eventCount": 1}
        
        artists = list(artists_collection.find(query, projection).sort("eventCount", -1))
        client.close()
        print(f"Se encontraron {len(artists)} artistas con perfil.")
        return artists
    except pymongo.errors.ConnectionFailure as e:
        print(f"Error de conexión a MongoDB: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Error al obtener artistas de la base de datos: {e}")
        return []

def generate_seo_sentence(artist_name, api_key):
    """Genera una frase SEO única para un artista usando Gemini."""
    print(f"Generando frase SEO para {artist_name}...")
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-1.5-flash')
    prompt = f"Genera una frase corta (máximo 25 palabras), atractiva y única para el/la artista flamenco/a {artist_name}. El objetivo es animar al usuario a hacer clic para leer su biografía completa. La frase debe ser optimizada para SEO. No incluyas el nombre del artista en la respuesta."
    try:
        response = model.generate_content(prompt)
        time.sleep(1) # Pausa para no exceder los límites de la API
        return response.text.strip()
    except Exception as e:
        print(f"  - Error al generar frase SEO para {artist_name}: {e}")
        return f"Descubre la biografía completa de {artist_name} y su impacto en el mundo del flamenco."

def build_artist_index_html(artists, config):
    """Construye el HTML para la página de índice de artistas."""
    print("Construyendo el HTML del índice de artistas...")
    
    styles = """
<style>
    h1.entry-title { color: #000000 !important; }
    .artist-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; padding: 20px; max-width: 1200px; margin: auto; }
    .artist-card { background-color: #fff; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 8px rgba(0,0,0,0.1); transition: transform 0.3s ease, box-shadow 0.3s ease; display: flex; flex-direction: column; }
    .artist-card:hover { transform: translateY(-5px); box-shadow: 0 8px 16px rgba(0,0,0,0.2); }
    .artist-card-image { width: 100%; height: 200px; object-fit: cover; }
    .artist-card-content { padding: 20px; flex-grow: 1; display: flex; flex-direction: column; }
    .artist-card-title { font-size: 1.5em; font-weight: bold; color: #26145F; margin: 0 0 10px 0; }
    .artist-card-bio { font-size: 1em; color: #333; margin-bottom: 20px; flex-grow: 1; }
    .artist-card-button { display: inline-block; background-color: #E53935; color: #fff !important; padding: 10px 20px; border-radius: 5px; text-align: center; text-decoration: none; font-weight: bold; transition: background-color 0.3s ease; }
    .artist-card-button:hover { background-color: #C62828; }
    @media (max-width: 600px) { .artist-grid { padding: 10px; } }
</style>
"""

    cards_html = ""
    for artist in artists:
        artist_name = artist.get("name", "Artista Desconocido")
        profile_url = artist.get("profilePageUrl", "#")
        profile_status = artist.get("profileStatus")
        image_url = artist.get("meta", {}).get("main_artist_image_url") or "https://buscador.afland.es/assets/flamenco-placeholder.png"

        if profile_status == "complete":
            short_bio = generate_seo_sentence(artist_name, config['GEMINI_API_KEY'])
        else:
            short_bio = "Biografía no disponible."

        cards_html += f"""
        <div class="artist-card">
            <img src="{image_url}" alt="Imagen de {artist_name}" class="artist-card-image">
            <div class="artist-card-content">
                <h3 class="artist-card-title">{artist_name}</h3>
                <p class="artist-card-bio">{short_bio}</p>
                <a href="{profile_url}" class="artist-card-button">Ver Biografía Completa</a>
            </div>
        </div>
        """

    return f"{styles}<div class='artist-grid'>{cards_html}</div>"

def get_page_by_slug(config, slug):
    """Obtiene una página de WordPress por su slug."""
    print(f"Buscando página en WordPress con slug '{slug}'...")
    wp_api_url = f"{config['WP_URL']}/wp-json/wp/v2/pages"
    auth = (config['WP_USER'], config['WP_PASSWORD'])
    params = {'slug': slug, 'per_page': 1}
    try:
        response = requests.get(wp_api_url, auth=auth, params=params, timeout=30)
        response.raise_for_status()
        pages = response.json()
        if pages:
            print(f"Página encontrada con ID: {pages[0]['id']}")
            return pages[0]
    except requests.exceptions.RequestException as e:
        print(f"Error al buscar página en WordPress: {e}")
    print("No se encontró una página coincidente.")
    return None

def create_or_update_page(config, page_id, title, content, slug):
    """Crea o actualiza una página en WordPress."""
    if page_id:
        print(f"Actualizando página {page_id}...")
        url = f"{config['WP_URL']}/wp-json/wp/v2/pages/{page_id}"
    else:
        print("Creando nueva página...")
        url = f"{config['WP_URL']}/wp-json/wp/v2/pages"

    auth = (config['WP_USER'], config['WP_PASSWORD'])
    data = {
        "title": title,
        "content": content,
        "status": "publish",
        "slug": slug
    }

    try:
        response = requests.post(url, auth=auth, json=data, headers={"Content-Type": "application/json"}, timeout=30)
        if response.status_code in [200, 201]:
            page_data = response.json()
            print(f"¡Página '{title}' guardada con éxito! URL: {page_data['link']}")
            return page_data['link']
        else:
            print(f"Error al guardar en WordPress: {response.status_code}")
            print(response.text)
            return None
    except requests.exceptions.RequestException as e:
        print(f"Error de comunicación con WordPress: {e}")
        return None

def main():
    """Flujo principal del script."""
    print("--- Iniciando generador de índice de artistas ---")
    config = get_config()
    
    artists = get_artists_from_db(config)
    
    if not artists:
        print("No hay artistas para generar el índice. Saliendo.")
        return

    index_html = build_artist_index_html(artists, config)
    
    page_title = "Índice de Artistas"
    page_slug = "artistas"
    
    existing_page = get_page_by_slug(config, page_slug)
    page_id = existing_page['id'] if existing_page else None
    
    create_or_update_page(config, page_id, page_title, index_html, page_slug)
    
    print("--- Proceso finalizado ---")

if __name__ == "__main__":
    main()