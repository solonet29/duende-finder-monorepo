<?php
/**
 * La plantilla para mostrar un único "Viaje" (CPT).
 */

get_header();
?>

<div id="primary" class="content-area">
    <main id="main" class="site-main">

        <?php
        if (have_posts()) :
            while (have_posts()) : the_post();
        ?>
                <article id="post-<?php the_ID(); ?>" <?php post_class('viaje-single-layout'); ?>>
                    
                    <header class="viaje-header">
                        <?php the_title('<h1 class="entry-title viaje-title">', '</h1>'); ?>
                        <?php if (has_post_thumbnail()) : ?>
                            <div class="viaje-featured-image">
                                <?php the_post_thumbnail('large'); ?>
                            </div>
                        <?php endif; ?>
                    </header>

                    <div class="viaje-content-wrapper">
                        <div class="viaje-main-content">
                            <div class="entry-content">
                                <?php the_content(); ?>
                            </div>
                        </div>

                        <aside class="viaje-sidebar">
                            <div class="viaje-details-box">
                                <h2>Detalles del Viaje</h2>
                                <ul>
                                    <?php if (get_field('duracion')) : ?>
                                        <li><strong>Duración:</strong> <?php the_field('duracion'); ?></li>
                                    <?php endif; ?>

                                    <?php if (get_field('precio_estimado')) : ?>
                                        <li><strong>Precio:</strong> <?php the_field('precio_estimado'); ?></li>
                                    <?php endif; ?>
                                </ul>

                                <?php if (get_field('enlace_de_reserva_afiliado')) : ?>
                                    <a href="<?php the_field('enlace_de_reserva_afiliado'); ?>" class="button-reserva" target="_blank" rel="nofollow sponsored">
                                        Reservar Ahora
                                    </a>
                                <?php endif; ?>
                            </div>
                        </aside>
                    </div>
                </article>

        <?php
            endwhile;
        endif;
        ?>

    </main>
</div>

<?php
get_footer();
?>