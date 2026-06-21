<?php
/**
 * Plugin Name: Jigma Bricks
 * Plugin URI: https://jigma.local
 * Description: Proof-of-concept Jigma panel for copying Bricks Builder structures from pasted HTML, CSS, and optional JavaScript.
 * Version: 0.1.0
 * Author: Jigma
 * Text Domain: jigma-bricks
 * Requires at least: 6.4
 * Requires PHP: 7.4
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'JIGMA_BRICKS_VERSION', '0.1.0' );
define( 'JIGMA_BRICKS_TARGET_VERSION', '2.3.7' );
define( 'JIGMA_BRICKS_PLUGIN_FILE', __FILE__ );
define( 'JIGMA_BRICKS_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'JIGMA_BRICKS_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

/**
 * Detects Bricks without requiring one specific implementation detail.
 *
 * Bricks is commonly active as a theme, and builder internals may not be loaded
 * on every admin request. Keep this broad and conservative for the POC.
 */
function jigma_bricks_is_bricks_active(): bool {
	if (
		defined( 'BRICKS_VERSION' ) ||
		class_exists( '\Bricks\Theme' ) ||
		class_exists( '\Bricks\Builder' ) ||
		class_exists( '\Bricks\Elements' )
	) {
		return true;
	}

	if ( function_exists( 'wp_get_theme' ) ) {
		$theme = wp_get_theme();
		$values = array(
			$theme->get( 'Name' ),
			$theme->get_template(),
			$theme->get_stylesheet(),
		);

		foreach ( $values as $value ) {
			if ( is_string( $value ) && false !== stripos( $value, 'bricks' ) ) {
				return true;
			}
		}
	}

	return false;
}

function jigma_bricks_request_value_contains_bricks( string $key ): bool {
	if ( ! isset( $_GET[ $key ] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		return false;
	}

	$value = sanitize_text_field( wp_unslash( $_GET[ $key ] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
	return '' === $value ||
		false !== stripos( $value, 'bricks' ) ||
		in_array( $value, array( 'run', 'builder', 'preview' ), true );
}

function jigma_bricks_is_builder_context(): bool {
	if ( ! jigma_bricks_is_bricks_active() || ! current_user_can( 'edit_posts' ) ) {
		return false;
	}

	$query_keys = array(
		'bricks',
		'bricks_preview',
		'bricks-preview',
		'brickspreview',
		'bricks_builder',
		'bricks_template',
	);

	foreach ( $query_keys as $key ) {
		if ( jigma_bricks_request_value_contains_bricks( $key ) ) {
			return true;
		}
	}

	if ( is_admin() ) {
		$page = isset( $_GET['page'] ) // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			? sanitize_text_field( wp_unslash( $_GET['page'] ) ) // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			: '';

		if ( false !== stripos( $page, 'bricks' ) ) {
			return true;
		}

		if ( function_exists( 'get_current_screen' ) ) {
			$screen = get_current_screen();
			if ( $screen && false !== stripos( (string) $screen->id, 'bricks' ) ) {
				return true;
			}
		}
	}

	return false;
}

function jigma_bricks_enqueue_assets(): void {
	if ( ! jigma_bricks_is_builder_context() ) {
		return;
	}

	wp_enqueue_style(
		'jigma-bricks-panel',
		JIGMA_BRICKS_PLUGIN_URL . 'assets/jigma-bricks.css',
		array(),
		JIGMA_BRICKS_VERSION
	);

	wp_enqueue_script(
		'jigma-bricks-panel',
		JIGMA_BRICKS_PLUGIN_URL . 'assets/jigma-bricks.js',
		array(),
		JIGMA_BRICKS_VERSION,
		true
	);

	wp_localize_script(
		'jigma-bricks-panel',
		'JigmaBricksPlugin',
		array(
			'ajaxUrl'             => admin_url( 'admin-ajax.php' ),
			'bricksActive'         => jigma_bricks_is_bricks_active(),
			'builderContext'       => true,
			'insertNonce'          => wp_create_nonce( 'jigma_bricks_insert' ),
			'postId'               => jigma_bricks_get_builder_post_id(),
			'targetBricksVersion'  => JIGMA_BRICKS_TARGET_VERSION,
			'version'              => JIGMA_BRICKS_VERSION,
			'insertLabel'          => __( 'Insert Into Page', 'jigma-bricks' ),
			'copyLabel'            => __( 'Copy Bricks Structure', 'jigma-bricks' ),
			'runPreviewLabel'      => __( 'Run Preview', 'jigma-bricks' ),
			'panelTitle'           => __( 'Jigma', 'jigma-bricks' ),
			'panelSubtitle'        => __( 'HTML/CSS/JS to Bricks structure', 'jigma-bricks' ),
		)
	);
}
add_action( 'admin_enqueue_scripts', 'jigma_bricks_enqueue_assets' );
add_action( 'wp_enqueue_scripts', 'jigma_bricks_enqueue_assets' );

function jigma_bricks_get_builder_post_id(): int {
	$query_keys = array( 'post', 'post_id', 'p', 'page_id', 'bricks_preview', 'bricks_post_id' );

	foreach ( $query_keys as $key ) {
		if ( ! isset( $_GET[ $key ] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			continue;
		}

		$value = absint( wp_unslash( $_GET[ $key ] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( $value > 0 ) {
			return $value;
		}
	}

	$queried_id = absint( get_queried_object_id() );
	if ( $queried_id > 0 ) {
		return $queried_id;
	}

	global $post;
	return $post instanceof WP_Post ? absint( $post->ID ) : 0;
}

/**
 * Bricks persistence adapter.
 *
 * Bricks documents page content as a flat element array stored in post meta.
 * Keep this lookup isolated so the key can be changed after version testing.
 */
function jigma_bricks_get_content_meta_key(): string {
	if ( defined( 'BRICKS_DB_PAGE_CONTENT' ) && is_string( BRICKS_DB_PAGE_CONTENT ) ) {
		return BRICKS_DB_PAGE_CONTENT;
	}

	return '_bricks_page_content_2';
}

function jigma_bricks_get_global_classes_option_name(): string {
	if ( defined( 'BRICKS_DB_GLOBAL_CLASSES' ) && is_string( BRICKS_DB_GLOBAL_CLASSES ) ) {
		return BRICKS_DB_GLOBAL_CLASSES;
	}

	return 'bricks_global_classes';
}

function jigma_bricks_get_current_content( int $post_id ): array {
	$content = get_post_meta( $post_id, jigma_bricks_get_content_meta_key(), true );
	return is_array( $content ) ? array_values( $content ) : array();
}

function jigma_bricks_get_current_global_classes(): array {
	$classes = get_option( jigma_bricks_get_global_classes_option_name(), array() );
	return is_array( $classes ) ? array_values( $classes ) : array();
}

function jigma_bricks_generate_element_id( array $used_ids ): string {
	do {
		$id = strtolower( wp_generate_password( 6, false, false ) );
	} while ( isset( $used_ids[ $id ] ) );

	return $id;
}

function jigma_bricks_is_valid_bricks_id( string $id ): bool {
	return 1 === preg_match( '/^[a-z0-9]{6}$/', $id );
}

function jigma_bricks_clean_string( $value ): string {
	$value = is_scalar( $value ) ? (string) $value : '';
	$value = wp_check_invalid_utf8( $value );
	return str_replace( "\0", '', $value );
}

function jigma_bricks_clean_settings( array $settings ): array {
	$clean = array();

	foreach ( $settings as $key => $value ) {
		$key = jigma_bricks_clean_string( $key );
		if ( '' === $key || 0 === strpos( $key, '_jigma' ) ) {
			continue;
		}

		if ( is_array( $value ) ) {
			$clean[ $key ] = jigma_bricks_clean_settings( $value );
		} elseif ( is_bool( $value ) || is_int( $value ) || is_float( $value ) || null === $value ) {
			$clean[ $key ] = $value;
		} else {
			$clean[ $key ] = jigma_bricks_clean_string( $value );
		}
	}

	return $clean;
}

function jigma_bricks_sort_recursive( $value ) {
	if ( ! is_array( $value ) ) {
		return $value;
	}

	foreach ( $value as $key => $item ) {
		$value[ $key ] = jigma_bricks_sort_recursive( $item );
	}

	if ( ! empty( $value ) && array_keys( $value ) !== range( 0, count( $value ) - 1 ) ) {
		ksort( $value );
	}

	return $value;
}

function jigma_bricks_settings_differ( array $left, array $right ): bool {
	return wp_json_encode( jigma_bricks_sort_recursive( $left ) ) !==
		wp_json_encode( jigma_bricks_sort_recursive( $right ) );
}

function jigma_bricks_normalize_global_class( array $class, array $used_ids ): array {
	$id       = isset( $class['id'] ) ? sanitize_key( $class['id'] ) : '';
	$name     = isset( $class['name'] ) ? jigma_bricks_clean_string( $class['name'] ) : '';
	$settings = isset( $class['settings'] ) && is_array( $class['settings'] )
		? jigma_bricks_clean_settings( $class['settings'] )
		: array();

	if ( '' === $id || ! jigma_bricks_is_valid_bricks_id( $id ) || isset( $used_ids[ $id ] ) ) {
		$id = jigma_bricks_generate_element_id( $used_ids );
	}

	return array(
		'id'       => $id,
		'name'     => $name,
		'settings' => $settings,
	);
}

function jigma_bricks_merge_global_classes( array $incoming_classes, array $existing_classes, array &$warnings ): array {
	$merged           = array_values( $existing_classes );
	$used_ids         = array();
	$existing_by_name = array();
	$id_map           = array();

	foreach ( $merged as $index => $class ) {
		if ( ! is_array( $class ) ) {
			continue;
		}

		if ( isset( $class['id'] ) ) {
			$used_ids[ (string) $class['id'] ] = true;
		}

		if ( isset( $class['name'] ) && '' !== (string) $class['name'] ) {
			$existing_by_name[ (string) $class['name'] ] = array(
				'index' => $index,
				'class' => $class,
			);
		}
	}

	foreach ( $incoming_classes as $incoming ) {
		if ( ! is_array( $incoming ) || empty( $incoming['name'] ) ) {
			continue;
		}

		$incoming_id = isset( $incoming['id'] ) ? (string) $incoming['id'] : '';
		$normalized  = jigma_bricks_normalize_global_class( $incoming, $used_ids );
		$name        = $normalized['name'];

		if ( '' === $name ) {
			continue;
		}

		if ( isset( $existing_by_name[ $name ] ) ) {
			$existing = $existing_by_name[ $name ]['class'];
			$id_map[ $incoming_id ] = isset( $existing['id'] ) ? (string) $existing['id'] : $normalized['id'];

			$existing_settings = isset( $existing['settings'] ) && is_array( $existing['settings'] )
				? $existing['settings']
				: array();
			if ( jigma_bricks_settings_differ( $existing_settings, $normalized['settings'] ) ) {
				$warnings[] = sprintf(
					/* translators: %s: Bricks global class name. */
					__( 'Existing Bricks class "%s" was reused, but its saved CSS differs from the generated Jigma CSS.', 'jigma-bricks' ),
					$name
				);
			}
			continue;
		}

		$used_ids[ $normalized['id'] ] = true;
		$merged[]                     = $normalized;
		$existing_by_name[ $name ]    = array(
			'index' => count( $merged ) - 1,
			'class' => $normalized,
		);
		$id_map[ $incoming_id ]       = $normalized['id'];
	}

	return array(
		'classes' => $merged,
		'idMap'   => $id_map,
	);
}

function jigma_bricks_remap_global_class_ids( array $settings, array $global_class_id_map ): array {
	if ( empty( $settings['_cssGlobalClasses'] ) || ! is_array( $settings['_cssGlobalClasses'] ) ) {
		return $settings;
	}

	$settings['_cssGlobalClasses'] = array_values(
		array_filter(
			array_map(
				static function ( $class_id ) use ( $global_class_id_map ) {
					$class_id = (string) $class_id;
					return $global_class_id_map[ $class_id ] ?? $class_id;
				},
				$settings['_cssGlobalClasses']
			)
		)
	);

	return $settings;
}

function jigma_bricks_validate_global_class_references( array $elements, array $global_classes ): array {
	$warnings = array();
	$class_ids = array();

	foreach ( $global_classes as $class ) {
		if ( is_array( $class ) && ! empty( $class['id'] ) ) {
			$class_ids[ (string) $class['id'] ] = true;
		}
	}

	foreach ( $elements as $element ) {
		if ( ! is_array( $element ) || empty( $element['settings']['_cssGlobalClasses'] ) || ! is_array( $element['settings']['_cssGlobalClasses'] ) ) {
			continue;
		}

		foreach ( $element['settings']['_cssGlobalClasses'] as $class_id ) {
			$class_id = (string) $class_id;
			if ( ! isset( $class_ids[ $class_id ] ) ) {
				$warnings[] = sprintf(
					/* translators: %1$s: class ID. %2$s: element ID. */
					__( 'Jigma class reference "%1$s" on element "%2$s" is missing from Bricks global classes.', 'jigma-bricks' ),
					$class_id,
					isset( $element['id'] ) ? (string) $element['id'] : ''
				);
			}
		}
	}

	return array_values( array_unique( $warnings ) );
}

function jigma_bricks_request_css_regeneration( int $post_id ): bool {
	update_post_meta( $post_id, '_jigma_bricks_css_regeneration_requested', time() );

	if ( has_action( 'bricks/generate_css_file' ) ) {
		do_action( 'bricks/generate_css_file', $post_id );
		return true;
	}

	return false;
}

function jigma_bricks_normalize_elements_for_insert( array $incoming_elements, array $existing_elements, bool $include_js_code, array $global_class_id_map ): array {
	$allowed_element_names = array(
		'section',
		'container',
		'block',
		'div',
		'heading',
		'text-basic',
		'text-link',
		'button',
		'image',
		'svg',
		'code',
		'html',
		'ul',
		'ol',
		'li',
	);
	$allowed_lookup = array_fill_keys( $allowed_element_names, true );
	$used_ids       = array();
	$id_map         = array();

	foreach ( $existing_elements as $element ) {
		if ( is_array( $element ) && isset( $element['id'] ) ) {
			$used_ids[ (string) $element['id'] ] = true;
		}
	}

	foreach ( $incoming_elements as $element ) {
		if ( ! is_array( $element ) || empty( $element['id'] ) ) {
			continue;
		}

		$name = isset( $element['name'] ) ? sanitize_key( $element['name'] ) : '';
		if ( ! isset( $allowed_lookup[ $name ] ) ) {
			$name = 'div';
		}

		$element_settings = isset( $element['settings'] ) && is_array( $element['settings'] )
			? $element['settings']
			: array();
		$has_css_code     = 'code' === $name && (
			! empty( $element_settings['css'] ) ||
			! empty( $element_settings['cssCode'] )
		);
		$has_js_code      = 'code' === $name && (
			! empty( $element_settings['javascriptCode'] ) ||
			! empty( $element_settings['javascript'] ) ||
			! empty( $element_settings['js'] )
		);

		if ( 'code' === $name && $has_js_code && ! $has_css_code && ! $include_js_code ) {
			continue;
		}

		$new_id                         = jigma_bricks_generate_element_id( $used_ids );
		$used_ids[ $new_id ]            = true;
		$id_map[ (string) $element['id'] ] = $new_id;
	}

	$normalized = array();

	foreach ( $incoming_elements as $element ) {
		if ( ! is_array( $element ) || empty( $element['id'] ) || empty( $id_map[ (string) $element['id'] ] ) ) {
			continue;
		}

		$name = isset( $element['name'] ) ? sanitize_key( $element['name'] ) : '';
		if ( ! isset( $allowed_lookup[ $name ] ) ) {
			$name = 'div';
		}

		$old_parent = isset( $element['parent'] ) ? (string) $element['parent'] : '0';
		$children   = isset( $element['children'] ) && is_array( $element['children'] )
			? $element['children']
			: array();

		$settings = isset( $element['settings'] ) && is_array( $element['settings'] )
			? jigma_bricks_clean_settings( $element['settings'] )
			: array();
		$settings = jigma_bricks_remap_global_class_ids( $settings, $global_class_id_map );

		$has_css_code = 'code' === $name && (
			! empty( $settings['css'] ) ||
			! empty( $settings['cssCode'] )
		);
		$has_js_code  = 'code' === $name && (
			! empty( $settings['javascriptCode'] ) ||
			! empty( $settings['javascript'] ) ||
			! empty( $settings['js'] )
		);

		if ( 'code' === $name && $has_js_code && ! $has_css_code && ! $include_js_code ) {
			continue;
		}

		if ( 'code' === $name ) {
			$code_class = isset( $settings['_cssClasses'] ) ? $settings['_cssClasses'] : '';
			$css_code   = isset( $settings['css'] ) ? $settings['css'] : ( $settings['cssCode'] ?? '' );
			$js_code    = isset( $settings['javascriptCode'] ) ? $settings['javascriptCode'] : ( $settings['javascript'] ?? ( $settings['js'] ?? '' ) );
			$settings   = array(
				'executeCode' => false,
			);

			if ( '' !== $code_class ) {
				$settings['_cssClasses'] = $code_class;
			}

			if ( '' !== $css_code ) {
				$settings['css']     = $css_code;
				$settings['cssCode'] = $css_code;
			}

			if ( '' !== $js_code && $include_js_code ) {
				$settings['javascriptCode'] = $js_code;
			}
		} else {
			unset(
				$settings['code'],
				$settings['cssCode'],
				$settings['executeCode'],
				$settings['javascriptCode'],
				$settings['noRoot'],
				$settings['parseDynamicData'],
				$settings['prettify'],
				$settings['supressPhpErrors']
			);
		}

		$normalized[] = array(
			'id'       => $id_map[ (string) $element['id'] ],
			'name'     => $name,
			'parent'   => '0' === $old_parent || ! isset( $id_map[ $old_parent ] )
				? 0
				: $id_map[ $old_parent ],
			'children' => array_values(
				array_filter(
					array_map(
						static function ( $child_id ) use ( $id_map ) {
							$child_id = (string) $child_id;
							return $id_map[ $child_id ] ?? null;
						},
						$children
					)
				)
			),
			'settings' => $settings,
			'label'    => isset( $element['label'] ) ? sanitize_text_field( $element['label'] ) : '',
		);
	}

	return $normalized;
}

function jigma_bricks_insert_generated_elements(): void {
	check_ajax_referer( 'jigma_bricks_insert', 'nonce' );

	$post_id = isset( $_POST['postId'] ) ? absint( wp_unslash( $_POST['postId'] ) ) : 0;
	if ( $post_id <= 0 || ! current_user_can( 'edit_post', $post_id ) ) {
		wp_send_json_error(
			array( 'message' => __( 'Jigma could not identify an editable Bricks post.', 'jigma-bricks' ) ),
			403
		);
	}

	if ( ! jigma_bricks_is_bricks_active() ) {
		wp_send_json_error(
			array( 'message' => __( 'Bricks Builder was not detected.', 'jigma-bricks' ) ),
			400
		);
	}

	$payload_json = isset( $_POST['payload'] ) ? wp_unslash( $_POST['payload'] ) : '';
	$payload      = json_decode( (string) $payload_json, true );

	if ( ! is_array( $payload ) || empty( $payload['content'] ) || ! is_array( $payload['content'] ) ) {
		wp_send_json_error(
			array( 'message' => __( 'Jigma did not receive a valid Bricks structure.', 'jigma-bricks' ) ),
			400
		);
	}

	$include_js_code  = ! empty( $_POST['includeJsCode'] );
	$current_content  = jigma_bricks_get_current_content( $post_id );
	$current_classes  = jigma_bricks_get_current_global_classes();
	$class_warnings   = array();
	$class_merge      = jigma_bricks_merge_global_classes(
		isset( $payload['globalClasses'] ) && is_array( $payload['globalClasses'] )
			? $payload['globalClasses']
			: array(),
		$current_classes,
		$class_warnings
	);
	$incoming_content = array_slice( $payload['content'], 0, 250 );
	$new_elements     = jigma_bricks_normalize_elements_for_insert(
		$incoming_content,
		$current_content,
		$include_js_code,
		$class_merge['idMap']
	);
	$class_warnings   = array_merge(
		$class_warnings,
		jigma_bricks_validate_global_class_references( $new_elements, $class_merge['classes'] )
	);

	if ( empty( $new_elements ) ) {
		wp_send_json_error(
			array( 'message' => __( 'No insertable Bricks elements were generated.', 'jigma-bricks' ) ),
			400
		);
	}

	$old_elements_indexed = array();
	foreach ( $current_content as $element ) {
		if ( is_array( $element ) && isset( $element['id'] ) ) {
			$old_elements_indexed[ (string) $element['id'] ] = $element;
		}
	}

	$new_elements = apply_filters(
		'bricks/security_check_before_save/new_elements',
		$new_elements,
		$old_elements_indexed
	);

	if ( ! is_array( $new_elements ) ) {
		wp_send_json_error(
			array( 'message' => __( 'Bricks rejected the generated element payload.', 'jigma-bricks' ) ),
			400
		);
	}

	if ( ! empty( $class_merge['classes'] ) ) {
		update_option( jigma_bricks_get_global_classes_option_name(), $class_merge['classes'], false );
	}

	$updated_content = array_values( array_merge( $current_content, $new_elements ) );
	update_post_meta( $post_id, jigma_bricks_get_content_meta_key(), $updated_content );
	update_post_meta( $post_id, '_bricks_editor_mode', 'bricks' );
	$css_regenerated = jigma_bricks_request_css_regeneration( $post_id );
	clean_post_cache( $post_id );

	wp_send_json_success(
		array(
			'message'       => __( 'Jigma elements inserted. Reload the Bricks builder to show the updated canvas.', 'jigma-bricks' ),
			'insertedCount' => count( $new_elements ),
			'globalClasses' => count( $class_merge['classes'] ),
			'classWarnings' => $class_warnings,
			'totalCount'    => count( $updated_content ),
			'metaKey'       => jigma_bricks_get_content_meta_key(),
			'cssRegenerated' => $css_regenerated,
			'reloadNeeded'  => true,
		)
	);
}
add_action( 'wp_ajax_jigma_bricks_insert', 'jigma_bricks_insert_generated_elements' );

function jigma_bricks_admin_notice(): void {
	if ( ! current_user_can( 'activate_plugins' ) || jigma_bricks_is_bricks_active() ) {
		return;
	}

	?>
	<div class="notice notice-warning">
		<p>
			<?php esc_html_e( 'Jigma Bricks is active, but Bricks Builder was not detected. The Jigma panel only loads inside the Bricks builder context.', 'jigma-bricks' ); ?>
		</p>
	</div>
	<?php
}
add_action( 'admin_notices', 'jigma_bricks_admin_notice' );
