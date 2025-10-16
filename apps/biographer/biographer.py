import os
import sys
import time
import json
from pathlib import Path
from dotenv import load_dotenv
import pymongo
import requests
import google.generativeai as genai
from googleapiclient.discovery import build

# Carga las variables de entorno desde la carpeta del script
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path, override=True)

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
    
    # Asegurarse de que la URL de WP no tenga una barra al final
    if config["WP_URL"]:
        config["WP_URL"] = config["WP_URL"].rstrip('/')
        
    return config

def clean_gemini_response(text):
    """Limpia los caracteres extraños y marcadores de código de la respuesta de Gemini."""
    text = text.replace('```json', '').replace('```', '').strip()
    cleaned_text = text.replace('«`html', '').replace('`»', '').strip()
    cleaned_text = cleaned_text.replace('```html', '').replace('```', '').strip()
    return cleaned_text

def verify_artist_existence(artist_name, api_key):
    """Verifica con Gemini si existe información pública sobre un artista."""
    print(f"Verificando existencia de información para {artist_name}...")
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-1.5-flash')
    prompt = f"Basándote en tu conocimiento público, ¿existe información verificable y suficiente para escribir una biografía detallada sobre un/a artista de flamenco llamado/a '{artist_name}'? Responde únicamente con un objeto JSON con dos claves: 'artistExists' (true o false) y 'confidence' ('high', 'medium', o 'low')."
    response = model.generate_content(prompt)
    
    try:
        # Limpiar y parsear la respuesta JSON
        cleaned_response = clean_gemini_response(response.text)
        data = json.loads(cleaned_response)
        print(f"Verificación completada: {data}")
        return data
    except (json.JSONDecodeError, KeyError) as e:
        print(f"Error al decodificar la respuesta de verificación de Gemini: {e}")
        print(f"Respuesta recibida: {response.text}")
        return {"artistExists": False, "confidence": "low"} # Fallback seguro

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
    """Busca una imagen principal usando Google Custom Search con varias consultas."""
    print(f"Buscando imagen principal para {artist_name} con consultas mejoradas...")
    
    search_queries = [
        f"{artist_name} flamenco retrato primer plano",
        f"{artist_name} actuando en directo",
        f"{artist_name} flamenco"
    ]
    
    service = build("customsearch", "v1", developerKey=api_key)
    
    for query in search_queries:
        try:
            print(f"  - Intentando con la consulta: '{query}'")
            res = service.cse().list(q=query, cx=cx_id, searchType='image', num=1).execute()
            if 'items' in res and len(res['items']) > 0:
                image_url = res['items'][0]['link']
                print(f"  ✅ Imagen encontrada con éxito.")
                return image_url
        except Exception as e:
            print(f"    - Error en la consulta: {e}")
            continue
            
    print("  - No se encontró ninguna imagen tras varios intentos.")
    return None

def create_wordpress_page(config, artist_name, short_bio, long_bio_html, main_image_url, video_urls):
    """Publica una nueva página completa en WordPress."""
    print("Construyendo contenido COMPLETO y publicando en WordPress...")
    wp_api_url = f"{config['WP_URL']}/wp-json/wp/v2/pages"

    videos_html = "<h2>Actuaciones Destacadas</h2>"
    if video_urls:
        for url in video_urls:
            if "watch?v=" in url:
                embed_url = url.replace("watch?v=", "embed/")
                videos_html += f'''<div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; margin-bottom: 1em;">
<iframe src="{embed_url}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" frameborder="0" allowfullscreen></iframe>
</div>'''

    image_html = ""
    if main_image_url:
        image_html = f'''<div class="wp-block-column" style="flex-basis:33.33%"><figure class="wp-block-image size-large"><img src="{main_image_url}" alt="{artist_name}"/></figure></div>'''
    
    column_style = "66.66%" if main_image_url else "100%"
    text_column_style = f"flex-basis:{column_style};"
    if main_image_url:
        text_column_style += " margin-left: 20px;"

    gutenberg_content = f"""
<style>
h1.entry-title {{ color: #000000 !important; }}
.artist-profile-content p {{color: #333333 !important;}}
.artist-profile-content h2 {{color: #26145F !important;}}
.artist-title-box {{ background-color: #26145F; border-radius: 15px; padding: 20px; margin-bottom: 20px; }}
.artist-title-box h2 {{ color: #FFFFFF !important; }}
.artist-title-box p {{ color: #FFFFFF !important; font-style:italic; font-weight:700; }}
</style>
<div class="wp-block-group artist-profile-content">
  <div class="wp-block-columns">
    {image_html}
    <div class="wp-block-column" style="{text_column_style}">
      <div class="artist-title-box">
        <h2>{artist_name}</h2>
        <p>{short_bio}</p>
      </div>
    </div>
  </div>
  <hr class="wp-block-separator has-alpha-channel-opacity"/>
  {long_bio_html}
  {videos_html}
</div>
"""
    data = {
        "title": artist_name, "status": "publish", "content": gutenberg_content,
        "wf_page_folders": [40], "meta": {"main_artist_image_url": main_image_url or ""}
    }
    
    auth = (config['WP_USER'], config['WP_PASSWORD'])
    try:
        response = requests.post(wp_api_url, auth=auth, json=data, headers={"Content-Type": "application/json"}, timeout=30)
        
        if response.status_code == 201:
            page_data = response.json()
            print(f"¡Página para {artist_name} creada! URL: {page_data['link']}")
            return page_data['link']
        else:
            print(f"Error al publicar en WordPress para {artist_name}: {response.status_code}")
            print(response.text)
            return None
    except requests.exceptions.RequestException as e:
        print(f"Error al publicar en WordPress: {e}")
        return None

def create_wordpress_placeholder_page(config, artist_name, main_image_url):
    """Publica una página 'placeholder' en WordPress."""
    print(f"Creando página PLACEHOLDER para {artist_name}...")
    wp_api_url = f"{config['WP_URL']}/wp-json/wp/v2/pages"
    image_url = main_image_url or "https://buscador.afland.es/assets/flamenco-placeholder.webp"

    verified_image_html = f'<figure class="wp-block-image size-large artist-placeholder-image"><img src="{image_url}" alt="Imagen no disponible"/></figure>'

    placeholder_text = f"""
<p>En Andalucía Flamenco Land, estamos continuamente comprobando y verificando datos y biografías de los artistas flamencos de todo el mundo.</p>
<p>Actualmente no disponemos de información biográfica detallada para <strong>{artist_name}</strong>. Nuestro equipo está trabajando para ampliar nuestro archivo.</p>
<p>Mientras tanto, te invitamos a buscar sus próximas actuaciones y eventos en nuestro buscador especializado:</p>
<div class="wp-block-buttons"><div class="wp-block-button is-style-fill"><a class="wp-block-button__link has-white-color has-vivid-red-background-color has-text-color has-background" href="https://buscador.afland.es/?q={artist_name.replace(' ', '%20')}" target="_blank" rel="noreferrer noopener">Buscar eventos de {artist_name}</a></div></div>
"""

    gutenberg_content_placeholder = f"""
<style>
h1.entry-title {{ color: #000000 !important; }}
.artist-placeholder-image {{
    max-width: 300px;
    margin: auto;
}}
.artist-profile-content p {{color: #333333 !important;}}
.artist-title-box {{ background-color: #26145F; border-radius: 15px; padding: 20px; margin-bottom: 20px; }}
.artist-title-box h2 {{ color: #FFFFFF !important; }}
</style>
<div class="wp-block-group artist-profile-content">
    <div class="artist-title-box">
        <h2>{artist_name}</h2>
    </div>
  {verified_image_html}
  {placeholder_text}
</div>
"""
    data = {
        "title": artist_name, "status": "publish", "content": gutenberg_content_placeholder,
        "wf_page_folders": [40], "meta": {"main_artist_image_url": image_url}
    }

    auth = (config['WP_USER'], config['WP_PASSWORD'])
    try:
        response = requests.post(wp_api_url, auth=auth, json=data, headers={"Content-Type": "application/json"}, timeout=30)

        if response.status_code == 201:
            page_data = response.json()
            print(f"¡Página placeholder para {artist_name} creada! URL: {page_data['link']}")
            return page_data['link']
        else:
            print(f"Error al publicar placeholder en WordPress para {artist_name}: {response.status_code}")
            print(response.text)
            return None
    except requests.exceptions.RequestException as e:
        print(f"Error al publicar placeholder en WordPress: {e}")
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
        artists_to_process_cursor = artists_collection.find({"hasProfilePage": {"$ne": True}}).sort("eventCount", -1).limit(5)
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

                    # 1. Verificación previa con Gemini
                    verification_data = verify_artist_existence(artist_name, config['GEMINI_API_KEY'])
                    artist_exists = verification_data.get("artistExists", False)

                    new_page_url = None
                    profile_status = "failed"
                    short_bio = None
                    main_image_url = None

                    if artist_exists:
                        # CASO A: El artista existe, crear perfil completo
                        print(f"Información encontrada para {artist_name}. Creando perfil completo.")
                        long_bio_html = generate_long_biography(artist_name, config['GEMINI_API_KEY'])
                        short_bio = generate_short_biography(artist_name, config['GEMINI_API_KEY'])
                        video_urls = find_youtube_videos(artist_name, config['GOOGLE_API_KEY'])
                        main_image_url = find_main_image(artist_name, config['GOOGLE_API_KEY'], config['CUSTOM_SEARCH_ENGINE_ID'])
                        
                        new_page_url = create_wordpress_page(
                            config, artist_name, short_bio, long_bio_html, main_image_url, video_urls
                        )
                        if new_page_url:
                            profile_status = "complete"

                    else:
                        # CASO B: El artista no existe o no hay info, crear placeholder
                        print(f"No se encontró información suficiente para {artist_name}. Creando perfil placeholder.")
                        main_image_url = find_main_image(artist_name, config['GOOGLE_API_KEY'], config['CUSTOM_SEARCH_ENGINE_ID'])
                        
                        new_page_url = create_wordpress_placeholder_page(config, artist_name, main_image_url)
                        if new_page_url:
                            profile_status = "placeholder"

                    # 3. Actualizar la base de datos si la publicación fue exitosa
                    if new_page_url:
                        update_set = {
                            "hasProfilePage": True, 
                            "profilePageUrl": new_page_url,
                            "profileStatus": profile_status
                        }
                        if short_bio:
                            update_set["short_bio"] = short_bio
                        if main_image_url:
                            update_set["meta"] = {"main_artist_image_url": main_image_url}

                        artists_collection.update_one(
                            {"_id": artist["_id"]},
                            {"$set": update_set}
                        )
                        print(f"Base de datos actualizada para {artist_name} con estado '{profile_status}'.")

                    print("Pausando 15 segundos antes del siguiente artista...")
                    time.sleep(15)

                except Exception as e:
                    print(f"!! ERROR al procesar a {artist.get('name', 'ID desconocido')}: {e}")
                    continue

            print("Procesamiento del lote finalizado.")

        print("\n--- Regenerando el índice de artistas ---")
        os.system("python apps/biographer/generate_artist_index.py")

    except Exception as e:
        print(f"Ocurrió un error general durante la ejecución: {e}")
    finally:
        if 'client' in locals() and client:
            client.close()
            print("Conexión a MongoDB cerrada.")

if __name__ == "__main__":
    main()