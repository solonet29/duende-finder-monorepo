
import os
import sys
import time
from dotenv import load_dotenv
import pymongo
import requests
import google.generativeai as genai
from googleapiclient.discovery import build

# Carga las variables de entorno desde un archivo .env en el mismo directorio
load_dotenv()

def get_config():
    """Carga y valida la configuración desde las variables de entorno."""
    config = {
        "MONGO_URI": os.getenv("MONGO_URI"),
        "DB_NAME": os.getenv("DB_NAME", "duende-finder"),
        "GEMINI_API_KEY": os.getenv("GEMINI_API_KEY"),
        "GOOGLE_API_KEY": os.getenv("GOOGLE_API_KEY"),
        "CUSTOM_SEARCH_ENGINE_ID": os.getenv("CUSTOM_SEARCH_ENGINE_ID"),
        "WP_URL": os.getenv("WP_URL"),
        "WP_USER": os.getenv("WP_USER"),
        "WP_PASSWORD": os.getenv("WP_PASSWORD"),
    }
    for key, value in config.items():
        if not value:
            print(f"Error: La variable de entorno {key} no está configurada.")
            sys.exit(1)
    return config

def clean_gemini_response(text):
    """Limpia los caracteres extraños y marcadores de código de la respuesta de Gemini."""
    cleaned_text = text.replace('«`html', '').replace('`»', '').strip()
    cleaned_text = cleaned_text.replace('```html', '').replace('```', '').strip()
    return cleaned_text

def generate_long_biography(artist_name, api_key):
    """Genera una biografía larga y estructurada usando Gemini."""
    print(f"Generando biografía LARGA para {artist_name}..." )
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-1.5-flash')
    prompt = f"""Actúa como un periodista musical y biógrafo experto en flamenco. Tu tarea es investigar en tu base de conocimiento y escribir una biografía detallada y factual sobre el artista {artist_name}.
REGLA DE ESTRUCTURA CRÍTICA: Tu respuesta debe ser un bloque de código HTML. Estructura la biografía usando subtítulos <h2> para las secciones clave. Utiliza subtítulos como 'Inicios y Formación', 'Estilo e Influencias', 'Trayectoria y Colaboraciones', y 'Discografía o Espectáculos Relevantes'.
REGLA DE CONTENIDO CRÍTICA: No utilices frases genéricas o de relleno. Céntrate solo en información verificable y no incluyas frases al final invitando a visitar redes sociales.
La salida debe ser únicamente el HTML de los párrafos y los subtítulos."""
    response = model.generate_content(prompt)
    return clean_gemini_response(response.text)

def generate_short_biography(artist_name, api_key):
    """Genera una biografía corta de una frase usando Gemini."""
    print(f"Generando biografía CORTA para {artist_name}...")
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-1.5-flash')
    prompt = f"Resume la carrera del artista flamenco {artist_name} en una sola frase impactante y concisa de no más de 25 palabras."
    response = model.generate_content(prompt)
    return clean_gemini_response(response.text)

def find_youtube_videos(artist_name, api_key):
    """Busca videos de YouTube del artista."""
    print(f"Buscando vídeos de {artist_name} en YouTube...")
    youtube = build('youtube', 'v3', developerKey=api_key)
    request = youtube.search().list(q=f"{artist_name} en directo", part='snippet', type='video', maxResults=3)
    response = request.execute()
    video_urls = [f"https://www.youtube.com/watch?v={item['id']['videoId']}" for item in response.get('items', [])]
    print(f"Se encontraron {len(video_urls)} vídeos.")
    return video_urls

def find_main_image(artist_name, api_key, cx_id):
    """Busca una imagen principal usando Google Custom Search."""
    print(f"Buscando imagen principal para {artist_name}...")
    service = build("customsearch", "v1", developerKey=api_key)
    res = service.cse().list(q=f"{artist_name} flamenco", cx=cx_id, searchType='image', num=1).execute()
    if 'items' in res and len(res['items']) > 0:
        image_url = res['items'][0]['link']
        print("Imagen encontrada.")
        return image_url
    else:
        print("No se encontró ninguna imagen.")
        return None

def create_wordpress_page(config, artist_name, short_bio, long_bio_html, main_image_url, video_urls):
    """Publica una nueva página en WordPress usando la plantilla de contenido final."""
    print("Construyendo contenido final y publicando en WordPress...")
    wp_api_url = f"{config['WP_URL']}/wp-json/wp/v2/pages"

    # a. Prepara el HTML de los Vídeos
    videos_html = "<h2>Actuaciones Destacadas</h2>"
    if video_urls:
        for url in video_urls:
            if "watch?v=" in url:
                embed_url = url.replace("watch?v=", "embed/")
                videos_html += f'''<div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; margin-bottom: 1em;">
<iframe src="{embed_url}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" frameborder="0" allowfullscreen></iframe>
</div>'''

    # b. Construye el Contenido Final de la Página
    gutenberg_content = f"""
<style>.artist-profile-content p {{color: #333333 !important;}} .artist-profile-content h2 {{color: #26145F !important;}}</style>
<div class="wp-block-group artist-profile-content">
  <div class="wp-block-columns"><div class="wp-block-column" style="flex-basis:33.33%"><figure class="wp-block-image size-large"><img src="{main_image_url}" alt="{artist_name}"/></figure>
  </div>
  <div class="wp-block-column" style="flex-basis:66.66%"><h2>{artist_name}</h2>
  <p style="font-style:italic;font-weight:700">{short_bio}</p>
  </div>
  </div>
  <hr class="wp-block-separator has-alpha-channel-opacity"/>
  {long_bio_html}
  
  {videos_html}
  
</div>
"""

    data = {
        "title": artist_name,
        "status": "publish",
        "content": gutenberg_content,
        "wf_page_folders": [40], # ID 40 para la carpeta "ARTISTAS"
        "meta": {"main_artist_image_url": main_image_url or ""}
    }
    
    auth = (config['WP_USER'], config['WP_PASSWORD'])
    response = requests.post(wp_api_url, auth=auth, json=data, headers={"Content-Type": "application/json"})
    
    if response.status_code == 201:
        page_data = response.json()
        print(f"¡Página para {artist_name} creada! URL: {page_data['link']}")
        return page_data['link']
    else:
        print(f"Error al publicar en WordPress para {artist_name}: {response.status_code}")
        print(response.text)
        return None

def main():
    """Flujo principal del script para procesar artistas en lote."""
    config = get_config()
    
    try:
        client = pymongo.MongoClient(config['MONGO_URI'])
        db = client[config['DB_NAME']]
        artists_collection = db["artists"]
        print("Conectado a MongoDB.")
    except pymongo.errors.ConnectionFailure as e:
        print(f"Error de conexión a MongoDB: {e}")
        sys.exit(1)

    try:
        artists_to_process_cursor = artists_collection.find({"hasProfilePage": {"$ne": True}}).limit(5)
        artists_to_process = list(artists_to_process_cursor)
        artist_count = len(artists_to_process)

        if artist_count == 0:
            print("No hay nuevos artistas para procesar.")
        else:
            print(f"Se encontraron {artist_count} artistas. Procesando en lote...")
            for artist in artists_to_process:
                try:
                    artist_name = artist["name"]
                    print(f"--- Procesando a: {artist_name} (ID: {artist['_id']}) ---")

                    # 1. Generar contenido
                    long_bio_html = generate_long_biography(artist_name, config['GEMINI_API_KEY'])
                    short_bio = generate_short_biography(artist_name, config['GEMINI_API_KEY'])
                    
                    video_urls = find_youtube_videos(artist_name, config['GOOGLE_API_KEY'])
                    main_image_url = find_main_image(artist_name, config['GOOGLE_API_KEY'], config['CUSTOM_SEARCH_ENGINE_ID'])

                    # 2. Publicar en WordPress
                    new_page_url = create_wordpress_page(
                        config, artist_name, short_bio, long_bio_html, main_image_url, video_urls
                    )

                    # 3. Actualizar la base de datos si la publicación fue exitosa
                    if new_page_url:
                        artists_collection.update_one(
                            {"_id": artist["_id"]},
                            {"$set": {"hasProfilePage": True, "profilePageUrl": new_page_url}}
                        )
                        print(f"Base de datos actualizada para {artist_name}.")

                    print("Pausando 15 segundos antes del siguiente artista...")
                    time.sleep(15)

                except Exception as e:
                    print(f"!! ERROR al procesar a {artist.get('name', 'ID desconocido')}: {e}")
                    continue

            print("Procesamiento del lote finalizado.")

    except Exception as e:
        print(f"Ocurrió un error general durante la ejecución: {e}")
    finally:
        client.close()
        print("Conexión a MongoDB cerrada.")

if __name__ == "__main__":
    main()
