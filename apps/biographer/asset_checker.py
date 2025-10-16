import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import pymongo

# Carga las variables de entorno desde la carpeta del script
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path)

def get_config():
    """Carga la configuración de MongoDB."""
    config = {
        "MONGO_URI": os.getenv("MONGO_URI"),
        "DB_NAME": os.getenv("DB_NAME", "duende-finder"),
    }
    if not config["MONGO_URI"]:
        print("Error: La variable de entorno MONGO_URI no está configurada.")
        sys.exit(1)
    return config

def get_cities_from_db(db):
    """Obtiene una lista de todas las ciudades únicas de la colección de eventos."""
    print("Obteniendo ciudades desde la base de datos...")
    try:
        events_collection = db["events"]
        # Usamos distinct para obtener una lista de ciudades únicas
        cities = events_collection.distinct("city")
        # Filtramos None, strings vacíos y normalizamos a minúsculas
        db_cities = {city.lower() for city in cities if isinstance(city, str) and city.strip()}
        print(f"  -> Se encontraron {len(db_cities)} ciudades únicas en la base de datos.")
        return db_cities
    except Exception as e:
        print(f"Error al obtener ciudades de la base de datos: {e}")
        return set()

def get_image_assets():
    """Obtiene los nombres de las imágenes de ciudades del directorio de assets."""
    print("Escaneando la carpeta de assets/cities...")
    # La ruta es relativa a la raíz del monorepo, asumiendo que el script se ejecuta desde allí.
    # Si se ejecuta desde `apps/biographer`, necesitamos subir dos niveles.
    assets_path = Path(__file__).parent.parent.parent / 'apps' / 'nuevo-buscador' / 'assets' / 'cities'
    
    if not assets_path.exists():
        print(f"  -> La carpeta de assets no existe en: {assets_path}")
        return set()
        
    # Obtenemos el nombre del archivo sin la extensión (ej: 'sevilla' de 'sevilla.webp')
    # y sin variantes numéricas (ej: 'sevilla' de 'sevilla-2.webp')
    image_names = {f.stem.split('-')[0] for f in assets_path.glob('*.webp')}
    print(f"  -> Se encontraron {len(image_names)} tipos de imágenes de ciudades.")
    return image_names

def main():
    """Flujo principal para comprobar los assets de las ciudades."""
    print("--- Iniciando el comprobador de assets de ciudades ---")
    config = get_config()
    
    try:
        client = pymongo.MongoClient(config['MONGO_URI'])
        db = client[config['DB_NAME']]
        print("Conectado a MongoDB.")
    except pymongo.errors.ConnectionFailure as e:
        print(f"Error de conexión a MongoDB: {e}")
        sys.exit(1)

    db_cities = get_cities_from_db(db)
    image_assets = get_image_assets()
    
    client.close()
    print("Conexión a MongoDB cerrada.\n")

    missing_images = db_cities - image_assets
    orphaned_images = image_assets - db_cities

    print("--- INFORME DE ASSETS ---")
    if missing_images:
        print(f"\n🟡 CIUDADES CON EVENTOS QUE NECESITAN IMAGEN ({len(missing_images)}):")
        for city in sorted(list(missing_images)):
            print(f"  - {city.title()}")
    else:
        print("\n✅ ¡Genial! Todas las ciudades con eventos tienen al menos una imagen asociada.")

    if orphaned_images:
        print(f"\n⚪️ IMÁGENES HUÉRFANAS (podrían eliminarse si no se usan) ({len(orphaned_images)}):")
        for image in sorted(list(orphaned_images)):
            print(f"  - {image.title()}")

    print("\n--- FIN DEL INFORME ---")

if __name__ == "__main__":
    main()