import os
import sys
import requests
from dotenv import load_dotenv
import pymongo
from pathlib import Path
from datetime import datetime, timedelta

def get_config():
    """Carga la configuración desde las variables de entorno."""
    env_path = Path(__file__).parent / '.env'
    load_dotenv(dotenv_path=env_path)
    
    config = {
        "MONGO_URI": os.getenv("MONGO_URI"),
        "DB_NAME": os.getenv("DB_NAME", "duende-finder"),
        "PAYLOAD_API_URL": os.getenv("PAYLOAD_API_URL", "https://cms-duendefinder.vercel.app/api"),
        "PAYLOAD_API_KEY": os.getenv("PAYLOAD_API_KEY"),
    }
    
    for key in ["MONGO_URI", "PAYLOAD_API_URL", "PAYLOAD_API_KEY"]:
        if not config[key]:
            print(f"Error: La variable de entorno {key} no está configurada en .env.")
            sys.exit(1)
    return config

def update_payload_slider(config, slider_title, event_ids):
    """Crea o actualiza un slider en PayloadCMS con una lista de IDs de eventos."""
    api_url = config["PAYLOAD_API_URL"]
    headers = {
    "Authorization": f"api-keys API-Key {config['PAYLOAD_API_KEY']}",
    "Content-Type": "application/json"
}
    
    print(f"\n--- Procesando slider: {slider_title} ---")
    print(f"Buscando el slider en Payload...")
    get_url = f"{api_url}/sliders?where[title][equals]={slider_title}"
    
    try:
        res = requests.get(get_url, headers=headers)
        res.raise_for_status()
        existing_sliders = res.json()
        
        payload_items = [{"relationTo": "events", "value": event_id} for event_id in event_ids]
        
        payload_data = {
            "title": slider_title,
            "sliderItems": payload_items
        }

        if existing_sliders.get("totalDocs", 0) > 0:
            slider_id = existing_sliders["docs"][0]["id"]
            print(f"Slider encontrado (ID: {slider_id}). Actualizando con {len(event_ids)} items...")
            patch_url = f"{api_url}/sliders/{slider_id}"
            update_res = requests.patch(patch_url, json=payload_data, headers=headers)
            update_res.raise_for_status()
            print(f"¡Slider '{slider_title}' actualizado con éxito!")
        else:
            print(f"Slider no encontrado. Creando uno nuevo con {len(event_ids)} items...")
            post_url = f"{api_url}/sliders"
            create_res = requests.post(post_url, json=payload_data, headers=headers)
            create_res.raise_for_status()
            print(f"¡Slider '{slider_title}' creado con éxito!")

    except requests.exceptions.RequestException as e:
        print(f"Error al comunicarse con la API de Payload: {e}")
        if e.response:
            print(f"Detalles del error: {e.response.text}")

def get_newest_events(db, limit=10):
    """Obtiene los eventos más recientemente creados."""
    print(f"Buscando los {limit} eventos más nuevos..." )
    try:
        events = list(db.events.find({}).sort([("_id", pymongo.DESCENDING)]).limit(limit))
        print(f"Se encontraron {len(events)} eventos.")
        return [str(event['_id']) for event in events]
    except Exception as e:
        print(f"Error al consultar los eventos más nuevos en MongoDB: {e}")
        return []

def get_upcoming_events(db, days=15, limit=10):
    """Obtiene los eventos de los próximos X días."""
    print(f"Buscando los {limit} eventos para los próximos {days} días...")
    try:
        today = datetime.now()
        end_date = today + timedelta(days=days)
        
        query = {
            "date": {
                "$gte": today.strftime('%Y-%m-%d'),
                "$lte": end_date.strftime('%Y-%m-%d')
            }
        }
        
        events = list(db.events.find(query).sort([("date", pymongo.ASCENDING)]).limit(limit))
        print(f"Se encontraron {len(events)} eventos.")
        return [str(event['_id']) for event in events]
    except Exception as e:
        print(f"Error al consultar los próximos eventos en MongoDB: {e}")
        return []

def get_featured_events(db, limit=10):
    """Obtiene los eventos marcados como 'featured'."""
    print(f"Buscando los {limit} eventos destacados ('featured')...")
    try:
        events = list(db.events.find({"featured": True}).limit(limit))
        print(f"Se encontraron {len(events)} eventos.")
        return [str(event['_id']) for event in events]
    except Exception as e:
        print(f"Error al consultar los eventos destacados en MongoDB: {e}")
        return []

def get_themed_nights_events(db, limit=10):
    """Obtiene eventos que tienen un plan de noche generado."""
    print(f"Buscando los {limit} eventos con 'Plan de Noche' creado...")
    try:
        query = {
            "content.nightPlanMarkdown": {"$exists": True, "$ne": ""}
        }
        events = list(db.events.find(query).sort([("_id", pymongo.DESCENDING)]).limit(limit))
        print(f"Se encontraron {len(events)} eventos.")
        return [str(event['_id']) for event in events]
    except Exception as e:
        print(f"Error al consultar eventos con plan de noche en MongoDB: {e}")
        return []

def main():
    """Flujo principal del script."""
    print("--- Iniciando script para poblar sliders de eventos en Payload CMS ---")
    config = get_config()
    
    try:
        client = pymongo.MongoClient(config['MONGO_URI'])
        db = client[config['DB_NAME']]
    except pymongo.errors.ConnectionFailure as e:
        print(f"Error de conexión a MongoDB: {e}")
        sys.exit(1)

    # --- 1. Poblar "Novedades en Duende Finder" ---
    newest_event_ids = get_newest_events(db)
    if newest_event_ids:
        update_payload_slider(config, "Novedades en Duende Finder", newest_event_ids)

    # --- 2. Poblar "¡No te lo pierdas! Próximos 15 días" ---
    upcoming_event_ids = get_upcoming_events(db, days=15)
    if upcoming_event_ids:
        update_payload_slider(config, "¡No te lo pierdas! Próximos 15 días", upcoming_event_ids)

    # --- 3. Poblar "Artistas Destacados 2025" ---
    featured_event_ids = get_featured_events(db)
    if featured_event_ids:
        update_payload_slider(config, "Artistas Destacados 2025", featured_event_ids)

    # --- 4. Poblar "Noches Temáticas por Duende Finder" ---
    themed_nights_event_ids = get_themed_nights_events(db)
    if themed_nights_event_ids:
        update_payload_slider(config, "Noches Temáticas por Duende Finder", themed_nights_event_ids)

    client.close()
    print("\n--- Proceso Finalizado ---")

if __name__ == "__main__":
    main()
