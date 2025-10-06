<?php
/**
 * Fichero para registrar el Custom Post Type "Viajes" y sus campos personalizados (ACF).
 */

// Hook para registrar el CPT al iniciar WordPress
add_action( 'init', 'df_registrar_cpt_viajes' );

/**
 * Registra el Custom Post Type "Viaje".
 */
function df_registrar_cpt_viajes() {

    $labels = array(
        'name'                  => _x( 'Viajes', 'Post Type General Name', 'text_domain' ),
        'singular_name'         => _x( 'Viaje', 'Post Type Singular Name', 'text_domain' ),
        'menu_name'             => __( 'Viajes Flamencos', 'text_domain' ),
        'name_admin_bar'        => __( 'Viaje', 'text_domain' ),
        'archives'              => __( 'Archivo de Viajes', 'text_domain' ),
        'attributes'            => __( 'Atributos del Viaje', 'text_domain' ),
        'parent_item_colon'     => __( 'Viaje Padre:', 'text_domain' ),
        'all_items'             => __( 'Todos los Viajes', 'text_domain' ),
        'add_new_item'          => __( 'Añadir Nuevo Viaje', 'text_domain' ),
        'add_new'               => __( 'Añadir Nuevo', 'text_domain' ),
        'new_item'              => __( 'Nuevo Viaje', 'text_domain' ),
        'edit_item'             => __( 'Editar Viaje', 'text_domain' ),
        'update_item'           => __( 'Actualizar Viaje', 'text_domain' ),
        'view_item'             => __( 'Ver Viaje', 'text_domain' ),
        'view_items'            => __( 'Ver Viajes', 'text_domain' ),
        'search_items'          => __( 'Buscar Viaje', 'text_domain' ),
    );
    $args = array(
        'label'                 => __( 'Viaje', 'text_domain' ),
        'description'           => __( 'Viajes y rutas flamencas organizadas por Afland.', 'text_domain' ),
        'labels'                => $labels,
        'supports'              => array( 'title', 'editor', 'thumbnail', 'revisions' ),
        'hierarchical'          => false,
        'public'                => true,
        'show_ui'               => true,
        'show_in_menu'          => true,
        'menu_position'         => 5,
        'menu_icon'             => 'dashicons-location-alt',
        'show_in_admin_bar'     => true,
        'show_in_nav_menus'     => true,
        'can_export'            => true,
        'has_archive'           => 'viajes', // Esto crea la URL afland.es/viajes/ para el listado
        'exclude_from_search'   => false,
        'publicly_queryable'    => true,
        'capability_type'       => 'post',
        'rewrite'               => array('slug' => 'viajes'),
    );
    register_post_type( 'viaje', $args );
}


// Hook para registrar los campos de ACF
add_action('acf/init', 'df_registrar_campos_viajes');

/**
 * Registra el grupo de campos personalizados para los Viajes.
 */
function df_registrar_campos_viajes() {
    if( function_exists('acf_add_local_field_group') ) {
        acf_add_local_field_group(array(
            'key' => 'group_viaje_detalles',
            'title' => 'Detalles del Viaje',
            'fields' => array(
                array('key' => 'field_viaje_subtitulo', 'label' => 'Subtítulo Gancho', 'name' => 'subtitulo_gancho', 'type' => 'text', 'instructions' => 'Frase corta y potente que aparece bajo el título principal.'),
                array('key' => 'field_viaje_hero', 'label' => 'Imagen Hero', 'name' => 'imagen_hero', 'type' => 'image', 'instructions' => 'La imagen principal de la landing page.', 'return_format' => 'url'),
                array('key' => 'field_viaje_precio', 'label' => 'Precio desde (€)', 'name' => 'precio', 'type' => 'number', 'instructions' => 'Indicar solo el número, sin el símbolo €.', 'prepend' => '€'),
                array('key' => 'field_viaje_duracion', 'label' => 'Duración', 'name' => 'duracion', 'type' => 'text', 'instructions' => 'Ej: "7 días / 6 noches"'),
                array('key' => 'field_viaje_fechas', 'label' => 'Próximas Fechas', 'name' => 'proximas_fechas', 'type' => 'text'),
                array('key' => 'field_viaje_itinerario', 'label' => 'Itinerario Detallado', 'name' => 'itinerario_detallado', 'type' => 'wysiwyg', 'tabs' => 'all', 'toolbar' => 'full'),
                array('key' => 'field_viaje_incluye', 'label' => 'Qué Incluye', 'name' => 'que_incluye', 'type' => 'textarea', 'instructions' => 'Escribe un elemento por línea. Se mostrará como una lista.'),
                array('key' => 'field_viaje_no_incluye', 'label' => 'Qué No Incluye', 'name' => 'que_no_incluye', 'type' => 'textarea', 'instructions' => 'Escribe un elemento por línea. Se mostrará como una lista.'),
                array('key' => 'field_viaje_cta_texto', 'label' => 'Texto del Botón Principal (CTA)', 'name' => 'texto_cta_principal', 'type' => 'text', 'default_value' => 'Solicitar Información'),
                array('key' => 'field_viaje_cta_enlace', 'label' => 'Enlace del Botón Principal (CTA)', 'name' => 'enlace_cta_principal', 'type' => 'url', 'instructions' => 'Enlace a la página de contacto o ancla al formulario.'),
            ),
            'location' => array(
                array(
                    array('param' => 'post_type', 'operator' => '==', 'value' => 'viaje'),
                ),
            ),
            'menu_order' => 0,
            'position' => 'normal',
            'style' => 'default',
            'label_placement' => 'top',
            'instruction_placement' => 'label',
            'active' => true,
        ));
    }
}
