import os
import sys
import time
import json
import re
from dotenv import load_dotenv
import pymongo
import requests
import google.generativeai as genai
from googleapiclient.discovery import build
from pathlib import Path

# Carga las variables de entorno desde la carpeta del script
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path)

# --- CONFIGURACIÓN Y HELPERS ---

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
    """Limpia la respuesta de Gemini para obtener JSON o HTML limpio."""
    text = re.sub(r'^```(json|html)?', '', text, flags=re.MULTILINE)
    text = re.sub(r'```$', '', text, flags=re.MULTILINE)
    return text.strip()

def strip_html(html_string):
    """Elimina las etiquetas HTML de un string."""
    return re.sub('<[^<]+?>', '', html_string)

# --- FUNCIONES DE API (GEMINI, GOOGLE, WORDPRESS) ---

def verify_artist_existence(artist_name, api_key):
    """Verifica con Gemini si existe información pública sobre un artista."""
    print(f"Verificando existencia de información para {artist_name}...")
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-1.5-flash')
    prompt = f"Basándote en tu conocimiento público, ¿existe información verificable y suficiente para escribir una biografía detallada sobre un/a artista de flamenco llamado/a '{artist_name}'? Responde únicamente con un objeto JSON con dos claves: 'artistExists' (true o false) y 'confidence' ('high', 'medium', o 'low')."
    try:
        response = model.generate_content(prompt)
        data = json.loads(clean_gemini_response(response.text))
        print(f"Verificación completada: {data}")
        return data
    except (json.JSONDecodeError, Exception) as e:
        print(f"Error en la verificación de Gemini para {artist_name}: {e}")
        return {"artistExists": False, "confidence": "low"}

def reformat_biography(artist_name, raw_text, api_key):
    """Usa Gemini para reformatear un texto plano a una biografía HTML estructurada."""
    print(f"Reformateando biografía para {artist_name}...")
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-1.5-flash')
    prompt = f"""Actúa como un editor de contenido. Toma el siguiente texto biográfico sobre {artist_name} y reestructúralo en formato HTML. No inventes información nueva. Utiliza subtítulos <h2> para las secciones clave como 'Inicios y Formación', 'Estilo e Influencias', y 'Trayectoria y Colaboraciones'. La salida debe ser únicamente el HTML de los párrafos y los subtítulos.

TEXTO A FORMATEAR:
{raw_text}"""
    response = model.generate_content(prompt)
    return clean_gemini_response(response.text)

def generate_short_biography(artist_name, api_key):
    """Genera una biografía corta de una frase."""
    print(f"Generando biografía CORTA para {artist_name}...")
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-1.5-flash')
    prompt = f"Resume la carrera del artista flamenco {artist_name} en una sola frase impactante y concisa de no más de 25 palabras."
    response = model.generate_content(prompt)
    return clean_gemini_response(response.text)

def find_youtube_videos(artist_name, api_key):
    """Busca videos de YouTube del artista."""
    print(f"Buscando vídeos de {artist_name} en YouTube...")
    try:
        youtube = build('youtube', 'v3', developerKey=api_key)
        request = youtube.search().list(q=f"{artist_name} en directo", part='snippet', type='video', maxResults=3)
        response = request.execute()
        video_urls = [f"https://www.youtube.com/watch?v={item['id']['videoId']}" for item in response.get('items', [])]
        print(f"Se encontraron {len(video_urls)} vídeos.")
        return video_urls
    except Exception as e:
        print(f"No se pudieron buscar vídeos: {e}")
        return []

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

def get_page_by_title(config, artist_name):
    """Obtiene los datos de una página de WordPress por su título."""
    print(f"Buscando página en WordPress para '{artist_name}'...")
    wp_api_url = f"{config['WP_URL']}/wp-json/wp/v2/pages"
    auth = (config['WP_USER'], config['WP_PASSWORD'])
    params = {'search': artist_name, 'per_page': 1}
    try:
        response = requests.get(wp_api_url, auth=auth, params=params, timeout=30)
        response.raise_for_status()
        pages = response.json()
        if pages and pages[0]['title']['rendered'] == artist_name:
            print(f"Página encontrada con ID: {pages[0]['id']}")
            return pages[0]
    except requests.exceptions.RequestException as e:
        print(f"Error al buscar página en WordPress: {e}")
    print("No se encontró una página coincidente.")
    return None

def update_wordpress_page(config, page_id, title, content, meta):
    """Actualiza una página existente en WordPress."""
    print(f"Actualizando página {page_id} en WordPress...")
    wp_api_url = f"{config['WP_URL']}/wp-json/wp/v2/pages/{page_id}"
    auth = (config['WP_USER'], config['WP_PASSWORD'])
    data = {"title": title, "content": content, "meta": meta}
    
    try:
        response = requests.post(wp_api_url, auth=auth, json=data, headers={"Content-Type": "application/json"}, timeout=30)
        
        if response.status_code == 200:
            page_data = response.json()
            print(f"¡Página para {title} actualizada! URL: {page_data['link']}")
            return page_data['link']
        else:
            print(f"Error al actualizar en WordPress para {title}: {response.status_code}")
            print(response.text)
            return None
    except requests.exceptions.RequestException as e:
        print(f"Error al actualizar página en WordPress: {e}")
        return None

# --- LÓGICA DE CONSTRUCCIÓN DE CONTENIDO ---

def build_complete_content(artist_name, short_bio, long_bio_html, main_image_url, video_urls):
    """Construye el HTML para una página de perfil completa."""
    videos_html = "<h2>Actuaciones Destacadas</h2>"
    if video_urls:
        for url in video_urls:
            embed_url = url.replace("watch?v=", "embed/")
            videos_html += f'''<div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; margin-bottom: 1em;">
<iframe src="{embed_url}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" frameborder="0" allowfullscreen></iframe>
</div>'''

    image_html = ""
    if main_image_url:
        image_html = f'''<div class="wp-block-column" style="flex-basis:33.33%"><figure class="wp-block-image size-large"><img src="{main_image_url}" alt="{artist_name}"/></figure></div>'''
    
    column_style = "66.66%" if main_image_url else "100%"

    return f"""
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
    <div class="wp-block-column" style="flex-basis:{column_style}">
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

def build_placeholder_content(artist_name):
    """Construye el HTML para una página placeholder."""
    image_url = "https://buscador.afland.es/assets/flamenco-placeholder.png"
    verified_image_html = f'<figure class="wp-block-image size-large artist-placeholder-image"><img src="{image_url}" alt="Imagen no disponible"/></figure>'

    placeholder_text = f"""
<p>En Andalucía Flamenco Land, estamos continuamente comprobando y verificando datos y biografías de los artistas flamencos de todo el mundo.</p>
<p>Actualmente no disponemos de información biográfica detallada para <strong>{artist_name}</strong>. Nuestro equipo está trabajando para ampliar nuestro archivo.</p>
<p>Mientras tanto, te invitamos a buscar sus próximas actuaciones y eventos en nuestro buscador especializado:</p>
<div class="wp-block-buttons"><div class="wp-block-button is-style-fill"><a class="wp-block-button__link has-white-color has-vivid-red-background-color has-text-color has-background" href="https://buscador.afland.es/?q={artist_name.replace(' ', '%20')}" target="_blank" rel="noreferrer noopener">Buscar eventos de {artist_name}</a></div></div>
"""
    return f"""
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

# --- FLUJO PRINCIPAL ---

def main():
    """Flujo principal para corregir y enriquecer perfiles de artistas existentes."""
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
        # Busca artistas con página pero sin el estado de perfil actualizado
        query = {"hasProfilePage": True, "profileStatus": {"$exists": False}}
        artists_to_process = list(artists_collection.find(query).limit(5))
        artist_count = len(artists_to_process)

        if artist_count == 0:
            print("No hay artistas para corregir.")
        else:
            print(f"Se encontraron {artist_count} artistas para corregir. Procesando...")
            for artist in artists_to_process:
                artist_name = artist["name"]
                print(f"--- Procesando a: {artist_name} (ID: {artist['_id']}) ---")

                page_data = get_page_by_title(config, artist_name)
                if not page_data:
                    print("No se encontró la página en WordPress. Saltando artista.")
                    continue
                
                page_id = page_data['id']
                verification = verify_artist_existence(artist_name, config['GEMINI_API_KEY'])
                
                new_content = ""
                new_meta = {}
                profile_status = "failed"
                short_bio = None

                if verification.get("artistExists"):
                    # CASO A: El artista existe -> Reformatear y enriquecer
                    print("Artista verificado. Reformateando y enriqueciendo perfil.")
                    
                    raw_content = page_data.get('content', {}).get('raw', '')
                    raw_text = strip_html(raw_content)

                    long_bio_html = reformat_biography(artist_name, raw_text, config['GEMINI_API_KEY'])
                    short_bio = generate_short_biography(artist_name, config['GEMINI_API_KEY'])
                    video_urls = find_youtube_videos(artist_name, config['GOOGLE_API_KEY'])
                    main_image_url = find_main_image(artist_name, config['GOOGLE_API_KEY'], config['CUSTOM_SEARCH_ENGINE_ID'])
                    
                    new_content = build_complete_content(artist_name, short_bio, long_bio_html, main_image_url, video_urls)
                    new_meta = {"main_artist_image_url": main_image_url or ""}
                    profile_status = "complete"
                else:
                    # CASO B: No hay info -> Crear placeholder
                    print("Artista no verificado. Creando perfil placeholder.")
                    new_content = build_placeholder_content(artist_name)
                    new_meta = {"main_artist_image_url": "https://buscador.afland.es/assets/flamenco-placeholder.png"}
                    profile_status = "placeholder"

                # Actualizar WordPress
                updated_url = update_wordpress_page(config, page_id, artist_name, new_content, new_meta)

                if updated_url:
                    # Actualizar MongoDB
                    update_set = {
                        "profileStatus": profile_status,
                        "profilePageUrl": updated_url
                    }
                    if short_bio:
                        update_set["short_bio"] = short_bio
                    if new_meta.get("main_artist_image_url"):
                        update_set["meta"] = new_meta

                    artists_collection.update_one(
                        {"_id": artist["_id"]},
                        {"$set": update_set}
                    )
                    print(f"Base de datos actualizada para {artist_name} con estado '{profile_status}'.")

                print("Pausando 15 segundos...")
                time.sleep(15)

    except Exception as e:
        print(f"Ocurrió un error general: {e}")
    finally:
        if 'client' in locals() and client:
            client.close()
            print("Conexión a MongoDB cerrada.")

if __name__ == "__main__":
    main()
