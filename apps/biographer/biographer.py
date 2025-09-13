
import os
import sys
import json
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
    # Verifica que todas las variables necesarias estén presentes
    for key, value in config.items():
        if not value:
            print(f"Error: La variable de entorno {key} no está configurada.")
            sys.exit(1)
    return config

def get_artist_from_db(client, db_name):
    """Busca un artista en MongoDB que no tenga una página de perfil."""
    db = client[db_name]
    artists_collection = db["artists"]
    print("Buscando un artista sin página de perfil...")
    artist = artists_collection.find_one({"hasProfilePage": {"$ne": True}})
    return artist, artists_collection

def generate_biography(artist_name, api_key):
    """Genera una biografía del artista usando la API de Gemini y espera una salida JSON."""
    print(f"Generando biografías (corta y larga) para {artist_name} con Gemini...")
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-1.5-flash')
    prompt = (
        f"Eres un experto en flamenco y un talentoso escritor de biografías para blogs. "
        f"Necesito dos textos sobre el artista flamenco {artist_name}. "
        f"Devuelve la respuesta como un único objeto JSON válido con dos claves: "
        f"1. 'short_bio': una frase corta, concisa y en texto plano para una entradilla. "
        f"2. 'long_bio_html': la biografía completa y atractiva, centrada únicamente en su carrera y estilo, optimizada para SEO y formateada en HTML (usando párrafos <p> y negritas <strong> para datos clave). Importante: No incluyas ninguna frase al final que invite a visitar redes sociales o webs oficiales."
    )
    
    # Aseguramos que la respuesta sea tratada como JSON
    generation_config = genai.types.GenerationConfig(response_mime_type="application/json")
    response = model.generate_content(prompt, generation_config=generation_config)
    
    print("Biografías generadas.")
    return json.loads(response.text)


def find_youtube_videos(artist_name, api_key):
    """Busca videos de YouTube del artista."""
    print(f"Buscando vídeos de {artist_name} en YouTube...")
    youtube = build('youtube', 'v3', developerKey=api_key)
    request = youtube.search().list(
        q=f"{artist_name} en directo",
        part='snippet',
        type='video',
        maxResults=3
    )
    response = request.execute()
    video_urls = [f"https://www.youtube.com/watch?v={item['id']['videoId']}" for item in response.get('items', [])]
    print(f"Se encontraron {len(video_urls)} vídeos.")
    return video_urls

def find_main_image(artist_name, api_key, cx_id):
    """Busca una imagen principal usando Google Custom Search."""
    print(f"Buscando imagen principal para {artist_name}...")
    service = build("customsearch", "v1", developerKey=api_key)
    res = service.cse().list(
        q=f"{artist_name} flamenco",
        cx=cx_id,
        searchType='image',
        num=1
    ).execute()
    
    if 'items' in res and len(res['items']) > 0:
        image_url = res['items'][0]['link']
        print("Imagen encontrada.")
        return image_url
    else:
        print("No se encontró ninguna imagen.")
        return None

def create_wordpress_page(config, artist_name, short_bio, long_bio_html, main_image_url, embed_urls):
    """Publica una nueva página en WordPress usando bloques de Gutenberg."""
    print("Construyendo contenido Gutenberg y publicando en WordPress...")
    wp_api_url = f"{config['WP_URL']}/wp-json/wp/v2/pages"
    
    # ID de la categoría "Artistas". Recordado de interacciones previas.
    artist_category_id = 96

    # Construir los bloques de video
    video_blocks = ""
    if embed_urls:
        for url in embed_urls:
            video_blocks += f'''<figure class="wp-block-embed is-provider-youtube"><div class="wp-block-embed__wrapper">{url}</div></figure>'''

    # Construir el contenido completo con la estructura de Gutenberg
    gutenberg_content = f'''
<!-- wp:columns -->
<div class="wp-block-columns"><!-- wp:column {{"width":"33.33%"}} -->
<div class="wp-block-column" style="flex-basis:33.33%"><!-- wp:image {{"sizeSlug":"large"}} -->
<figure class="wp-block-image size-large"><img src="{main_image_url}" alt="{artist_name}"/></figure>
<!-- /wp:image --></div>
<!-- /wp:column -->

<!-- wp:column {{"width":"66.66%"}} -->
<div class="wp-block-column" style="flex-basis:66.66%"><!-- wp:heading -->
<h2>{artist_name}</h2>
<!-- /wp:heading -->

<!-- wp:paragraph {{"style":{{"typography":{{"fontStyle":"italic","fontWeight":"700"}}}}}} -->
<p style="font-style:italic;font-weight:700">{short_bio}</p>
<!-- /wp:paragraph --></div>
<!-- /wp:column --></div>
<!-- /wp:columns -->

<!-- wp:separator -->
<hr class="wp-block-separator has-alpha-channel-opacity"/>
<!-- /wp:separator -->

<!-- wp:heading -->
<h2>Biografía</h2>
<!-- /wp:heading -->

{long_bio_html}

<!-- wp:heading -->
<h2>Actuaciones Destacadas</h2>
<!-- /wp:heading -->

{video_blocks}
'''

    data = {
        "title": artist_name,
        "status": "publish",
        "content": gutenberg_content,
        "categories": [artist_category_id],
        "meta": {
            "main_artist_image_url": main_image_url or ""
        }
    }
    
    auth = (config['WP_USER'], config['WP_PASSWORD'])
    
    response = requests.post(wp_api_url, auth=auth, json=data, headers={"Content-Type": "application/json"})
    
    if response.status_code == 201:
        page_data = response.json()
        print(f"¡Página creada con éxito! URL: {page_data['link']}")
        return page_data['link']
    else:
        print(f"Error al publicar en WordPress: {response.status_code}")
        print(response.text)
        return None

def main():
    """Flujo principal del script."""
    config = get_config()
    
    try:
        client = pymongo.MongoClient(config['MONGO_URI'])
        print("Conectado a MongoDB.")
    except pymongo.errors.ConnectionFailure as e:
        print(f"Error de conexión a MongoDB: {e}")
        sys.exit(1)

    artist, artists_collection = get_artist_from_db(client, config['DB_NAME'])

    if not artist:
        print("No se encontraron artistas que necesiten una página de perfil. Finalizando.")
        client.close()
        return

    artist_name = artist["name"]
    print(f"Artista encontrado: {artist_name} (ID: {artist['_id']})")

    try:
        # 1. Generar contenido
        bio_data = generate_biography(artist_name, config['GEMINI_API_KEY'])
        short_bio = bio_data.get('short_bio', '')
        long_bio_html = bio_data.get('long_bio_html', '<p>No se pudo generar la biografía.</p>')
        
        video_urls = find_youtube_videos(artist_name, config['GOOGLE_API_KEY'])
        main_image_url = find_main_image(artist_name, config['GOOGLE_API_KEY'], config['CUSTOM_SEARCH_ENGINE_ID'])

        # Convertir las URLs de YouTube al formato 'embed' que Gutenberg prefiere
        embed_urls = []
        if video_urls:
            for url in video_urls:
                if "watch?v=" in url:
                    embed_url = url.replace("watch?v=", "embed/")
                    embed_urls.append(embed_url)
                else:
                    embed_urls.append(url) # Mantener la URL si ya tiene otro formato

        # 2. Publicar en WordPress
        new_page_url = create_wordpress_page(
            config, 
            artist_name, 
            short_bio, 
            long_bio_html, 
            main_image_url, 
            embed_urls
        )

        # 3. Actualizar la base de datos si la publicación fue exitosa
        if new_page_url:
            artists_collection.update_one(
                {"_id": artist["_id"]},
                {"$set": {"hasProfilePage": True, "profilePageUrl": new_page_url}}
            )
            print("Base de datos actualizada.")

    except Exception as e:
        print(f"Ocurrió un error inesperado: {e}")
    finally:
        client.close()
        print("Conexión a MongoDB cerrada.")

if __name__ == "__main__":
    main()
