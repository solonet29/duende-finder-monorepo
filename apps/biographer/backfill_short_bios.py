import os
import sys
import time
import re
from dotenv import load_dotenv
import pymongo
import requests
from bs4 import BeautifulSoup
from pathlib import Path

# Carga las variables de entorno
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path)

def get_config():
    """Carga la configuración desde las variables de entorno."""
    config = {
        "MONGO_URI": os.getenv("MONGO_URI"),
        "DB_NAME": os.getenv("DB_NAME", "duende-finder"),
        "WP_URL": os.getenv("WP_URL"),
        "WP_USER": os.getenv("WP_USER"),
        "WP_PASSWORD": os.getenv("WP_PASSWORD"),
    }
    for key, value in config.items():
        if not value:
            print(f"Error: La variable de entorno {key} no está configurada.")
            sys.exit(1)
            
    if config["WP_URL"]:
        config["WP_URL"] = config["WP_URL"].rstrip('/')
        
    return config

def get_artists_to_update(db):
    """Obtiene artistas con URL de perfil pero sin biografía corta."""
    print("Buscando artistas para actualizar...")
    query = {
        "profilePageUrl": {"$exists": True, "$ne": ""},
        "short_bio": {"$exists": False},
        "profileStatus": "complete"
    }
    artists = list(db.artists.find(query))
    print(f"Se encontraron {len(artists)} artistas para actualizar.")
    return artists

def extract_slug_from_url(url):
    """Extrae el slug de una URL de WordPress."""
    try:
        return url.strip('/').split('/')[-1]
    except:
        return None

def extract_short_bio_from_api(slug, config):
    """Extrae la biografía corta usando la API REST de WordPress."""
    wp_api_url = f"{config['WP_URL']}/wp-json/wp/v2/pages"
    auth = (config['WP_USER'], config['WP_PASSWORD'])
    params = {'slug': slug}
    
    try:
        response = requests.get(wp_api_url, auth=auth, params=params, timeout=30)
        response.raise_for_status()
        pages = response.json()
        
        if pages:
            content_html = pages[0].get('content', {}).get('rendered', '')
            if content_html:
                soup = BeautifulSoup(content_html, 'html.parser')
                title_box = soup.find('div', class_='artist-title-box')
                if title_box:
                    p_tag = title_box.find('p')
                    if p_tag and p_tag.text:
                        return p_tag.text.strip()
                        
    except requests.exceptions.RequestException as e:
        print(f"  - Error al llamar a la API de WordPress para el slug '{slug}': {e}")
    except Exception as e:
        print(f"  - Error al procesar la respuesta de la API para el slug '{slug}': {e}")
        
    return None

def main():
    """Flujo principal del script."""
    print("--- Iniciando script para rellenar biografías cortas (vía API) ---")
    config = get_config()
    
    try:
        client = pymongo.MongoClient(config['MONGO_URI'])
        db = client[config['DB_NAME']]
        artists_collection = db["artists"]
        print("✅ Conectado a MongoDB.")
    except pymongo.errors.ConnectionFailure as e:
        print(f"Error de conexión a MongoDB: {e}")
        sys.exit(1)

    artists_to_update = get_artists_to_update(db)
    
    if not artists_to_update:
        print("No hay artistas que necesiten ser actualizados. ¡Todo al día!")
        client.close()
        return

    updated_count = 0
    for artist in artists_to_update:
        artist_name = artist.get("name", "ID Desconocido")
        artist_id = artist["_id"]
        profile_url = artist["profilePageUrl"]
        
        print(f"\nProcesando a: {artist_name}...")
        
        slug = extract_slug_from_url(profile_url)
        
        if not slug:
            print(f"  - No se pudo extraer el slug de la URL: {profile_url}")
            continue
            
        short_bio = extract_short_bio_from_api(slug, config)
        
        if short_bio:
            artists_collection.update_one(
                {"_id": artist_id},
                {"$set": {"short_bio": short_bio}}
            )
            print(f"  ✅ Biografía corta encontrada y guardada: \"{short_bio}\"" )
            updated_count += 1
        else:
            print("  - No se pudo encontrar la biografía corta en la página (vía API).")
            
        time.sleep(0.5) # Pausa breve para no saturar la API

    print(f"\n--- Proceso Finalizado ---")
    print(f"Se han actualizado {updated_count} de {len(artists_to_update)} artistas.")
    
    client.close()
    print("Conexión a MongoDB cerrada.")

if __name__ == "__main__":
    main()