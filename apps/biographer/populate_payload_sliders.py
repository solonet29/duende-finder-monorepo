
'''
Este script se encarga de poblar la colección de Sliders en PayloadCMS 
con los artistas más populares obtenidos de la base de datos de MongoDB.
'''
import os
import sys
import requests
from dotenv import load_dotenv
import pymongo
from pathlib import Path

def get_config():
    '''Carga la configuración desde las variables de entorno.'''
    # Asume que el .env está en el mismo directorio que el script
    env_path = Path(__file__).parent / '.env'
    load_dotenv(dotenv_path=env_path)
    
    config = {
        "MONGO_URI": os.getenv("MONGO_URI"),
        "DB_NAME": os.getenv("DB_NAME", "duende-finder"),
        "PAYLOAD_API_URL": os.getenv("PAYLOAD_API_URL", "https://cms-duendefinder.vercel.app/api"),
        "PAYLOAD_API_KEY": os.getenv("PAYLOAD_API_KEY"),
        "SLIDER_TITLE": "Artistas Populares"
    }
    
    for key in ["MONGO_URI", "PAYLOAD_API_URL", "PAYLOAD_API_KEY"]:
        if not config[key]:
            print(f"Error: La variable de entorno {key} no está configurada en .env.")
            sys.exit(1)
    return config

def get_top_artists(db, limit=10):
    '''Obtiene los artistas más populares desde MongoDB.'''
    print(f"Buscando los {limit} artistas más populares en MongoDB...")
    query = {
        "profileStatus": "complete",
        "meta.main_artist_image_url": {"$exists": True, "$ne": ""}
    }
    projection = {"name": 1, "profilePageUrl": 1, "meta.main_artist_image_url": 1, "eventCount": 1}
    
    try:
        artists = list(db.artists.find(query, projection).sort("eventCount", -1).limit(limit))
        print(f"Se encontraron {len(artists)} artistas.")
        return artists
    except Exception as e:
        print(f"Error al consultar los artistas en MongoDB: {e}")
        sys.exit(1)

def format_for_payload(artists):
    '''Formatea la lista de artistas al formato que espera el array de Payload.'''
    print("Formateando artistas para la API de Payload...")
    items = []
    for artist in artists:
        items.append({
            "artistName": artist.get("name", "Artista Desconocido"),
            "artistImageURL": artist.get("meta", {}).get("main_artist_image_url", ""),
            "artistProfileURL": artist.get("profilePageUrl", "#")
        })
    return items

def update_payload_slider(config, slider_items):
    '''Crea o actualiza el slider en PayloadCMS.'''
    slider_title = config["SLIDER_TITLE"]
    api_url = config["PAYLOAD_API_URL"]
    headers = {
        # El formato estándar de Payload para claves de API de colección
        "Authorization": f"users API-Key {config['PAYLOAD_API_KEY']}",
        "Content-Type": "application/json"
    }
    
    # 1. Buscar si el slider ya existe
    print(f"Buscando el slider '{slider_title}' en Payload...")
    get_url = f"{api_url}/sliders?where[title][equals]={slider_title}"
    
    try:
        res = requests.get(get_url, headers=headers)
        res.raise_for_status()
        existing_sliders = res.json()
        
        payload_data = {
            "title": slider_title,
            "sliderItems": slider_items
        }

        if existing_sliders.get("totalDocs", 0) > 0:
            # 2a. Si existe, se actualiza (PATCH)
            slider_id = existing_sliders["docs"][0]["id"]
            print(f"Slider encontrado (ID: {slider_id}). Actualizando...")
            patch_url = f"{api_url}/sliders/{slider_id}"
            update_res = requests.patch(patch_url, json=payload_data, headers=headers)
            update_res.raise_for_status()
            print("¡Slider actualizado en Payload con éxito!")
        else:
            # 2b. Si no existe, se crea (POST)
            print("Slider no encontrado. Creando uno nuevo...")
            post_url = f"{api_url}/sliders"
            create_res = requests.post(post_url, json=payload_data, headers=headers)
            create_res.raise_for_status()
            print("¡Slider creado en Payload con éxito!")

    except requests.exceptions.RequestException as e:
        print(f"Error al comunicarse con la API de Payload: {e}")
        if e.response:
            print(f"Detalles del error: {e.response.text}")
        sys.exit(1)

def main():
    '''Flujo principal del script.'''
    print("--- Iniciando script para poblar sliders en Payload CMS ---")
    config = get_config()
    
    try:
        client = pymongo.MongoClient(config['MONGO_URI'])
        db = client[config['DB_NAME']]
    except pymongo.errors.ConnectionFailure as e:
        print(f"Error de conexión a MongoDB: {e}")
        sys.exit(1)

    top_artists = get_top_artists(db)
    
    if not top_artists:
        print("No se encontraron artistas para generar el slider. Saliendo.")
        client.close()
        return

    payload_items = format_for_payload(top_artists)
    update_payload_slider(config, payload_items)
    
    client.close()
    print("\n--- Proceso Finalizado ---")

if __name__ == "__main__":
    main()
