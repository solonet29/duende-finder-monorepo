import os
import sys
from dotenv import load_dotenv
import pymongo
from pathlib import Path

# Carga las variables de entorno
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path)

def get_config():
    """Carga la configuración desde las variables de entorno."""
    config = {
        "MONGO_URI": os.getenv("MONGO_URI"),
        "DB_NAME": os.getenv("DB_NAME", "duende-finder"),
    }
    for key, value in config.items():
        if not value:
            print(f"Error: La variable de entorno {key} no está configurada.")
            sys.exit(1)
    return config

def get_top_artists(db, limit=10):
    """Obtiene los artistas más populares desde MongoDB."""
    print(f"Buscando los {limit} artistas más populares...")
    query = {
        "profileStatus": "complete",
        "meta.main_artist_image_url": {"$exists": True, "$ne": ""}
    }
    projection = {"name": 1, "profilePageUrl": 1, "meta.main_artist_image_url": 1, "eventCount": 1}
    
    artists = list(db.artists.find(query, projection).sort("eventCount", -1).limit(limit))
    print(f"Se encontraron {len(artists)} artistas.")
    return artists

def build_slider_code(artists):
    """Construye el código HTML, CSS y JS para el slider de artistas."""
    print("Construyendo el código del slider...")

    # --- HTML ---
    cards_html = ""
    for artist in artists:
        artist_name = artist.get("name", "Artista Desconocido")
        profile_url = artist.get("profilePageUrl", "#")
        image_url = artist.get("meta", {}).get("main_artist_image_url") or "https://buscador.afland.es/assets/flamenco-placeholder.png"
        
        cards_html += f"""
        <div class="swiper-slide">
            <div class="artist-card">
                <img src="{image_url}" alt="Imagen de {artist_name}" class="artist-card-image">
                <div class="artist-card-content">
                    <h3 class="artist-card-title">{artist_name}</h3>
                    <a href="{profile_url}" class="artist-card-button">Ver Biografía</a>
                </div>
            </div>
        </div>
        """

    html_structure = f"""
    <!-- Slider main container -->
    <div class="swiper artist-slider">
        <div class="swiper-wrapper">
            {cards_html}
        </div>
        <!-- Add Pagination -->
        <div class="swiper-pagination"></div>
        <!-- Add Navigation -->
        <div class="swiper-button-next"></div>
        <div class="swiper-button-prev"></div>
    </div>
    <div style="text-align: center; margin-top: 20px;">
        <a href="/artistas/" class="slider-main-button">Ver todos los artistas</a>
    </div>
    """

    # --- CSS ---
    css_styles = """
    <style>
        /* Estilos para el contenedor del slider y el botón principal */
        .artist-slider-container {
            padding: 20px;
            background: #170837;
        }
        .artist-slider {
            width: 100%;
            height: 100%;
            padding-bottom: 40px; /* Espacio para la paginación */
        }
        .swiper-slide {
            display: flex;
            justify-content: center;
            align-items: center;
        }
        .slider-main-button {
            display: inline-block;
            background-color: #26145F;
            color: #fff !important;
            padding: 12px 25px;
            border-radius: 5px;
            text-align: center;
            text-decoration: none;
            font-weight: bold;
            transition: background-color 0.3s ease;
        }
        .slider-main-button:hover {
            background-color: #1a0e4a;
        }

        /* Estilos de las tarjetas (similares al índice) */
        .artist-card {
            width: 280px;
            background-color: #fff;
            border-radius: 15px;
            overflow: hidden;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
            display: flex;
            flex-direction: column;
            height: 350px;
        }
        .artist-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 8px 16px rgba(0,0,0,0.2);
        }
        .artist-card-image {
            width: 100%;
            height: 200px;
            object-fit: cover;
            object-position: center top;
        }
        .artist-card-content {
            padding: 20px;
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
            text-align: center;
        }
        .artist-card-title {
            font-size: 1.5em;
            font-weight: bold;
            color: #26145F;
            margin: 0 0 15px 0;
        }
        .artist-card-button {
            display: inline-block;
            background-color: #E53935;
            color: #fff !important;
            padding: 10px 20px;
            border-radius: 5px;
            text-align: center;
            text-decoration: none;
            font-weight: bold;
            transition: background-color 0.3s ease;
        }
        .artist-card-button:hover {
            background-color: #C62828;
        }

        /* Estilos para la navegación de Swiper */
        .swiper-button-next, .swiper-button-prev {
            color: #26145F;
        }
        .swiper-pagination-bullet-active {
            background: #26145F;
        }
    </style>
    """

    # --- JavaScript ---
    js_code = """
    <script src="https://unpkg.com/swiper/swiper-bundle.min.js"></script>
    <script>
        document.addEventListener('DOMContentLoaded', function () {
            var swiper = new Swiper('.artist-slider', {
                slidesPerView: 1,
                spaceBetween: 30,
                loop: true,
                pagination: {
                    el: '.swiper-pagination',
                    clickable: true,
                },
                navigation: {
                    nextEl: '.swiper-button-next',
                    prevEl: '.swiper-button-prev',
                },
                breakpoints: {
                    640: {
                        slidesPerView: 2,
                        spaceBetween: 20,
                    },
                    768: {
                        slidesPerView: 3,
                        spaceBetween: 40,
                    },
                    1024: {
                        slidesPerView: 3,
                        spaceBetween: 50,
                    },
                }
            });
        });
    </script>
    """
    
    # --- Swiper CSS ---
    swiper_css = '<link rel="stylesheet" href="https://unpkg.com/swiper/swiper-bundle.min.css" />'

    return f"{swiper_css}\n{css_styles}\n<div class='artist-slider-container'>{html_structure}</div>\n{js_code}"

def main():
    """Flujo principal del script."""
    print("--- Iniciando generador de slider de artistas ---")
    config = get_config()
    
    try:
        client = pymongo.MongoClient(config['MONGO_URI'])
        db = client[config['DB_NAME']]
    except pymongo.errors.ConnectionFailure as e:
        print(f"Error de conexión a MongoDB: {e}")
        sys.exit(1)

    top_artists = get_top_artists(db)
    
    if not top_artists:
        print("No se encontraron artistas para generar el slider.")
        client.close()
        return

    slider_code = build_slider_code(top_artists)
    
    project_root = Path(__file__).parent.parent.parent
    output_file = project_root / "slider_code.html"
    with open(output_file, "w", encoding="utf-8") as f:
        f.write(slider_code)
        
    print(f"\n--- Proceso Finalizado ---")
    print(f"El código del slider se ha guardado en el fichero: {output_file}")
    
    client.close()

if __name__ == "__main__":
    main()