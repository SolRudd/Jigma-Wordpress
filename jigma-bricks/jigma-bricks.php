<?php
/**
 * Plugin Name: Jigma Bricks
 * Plugin URI: https://jigma.co.uk/
 * Update URI: https://jigma.co.uk/jigma-bricks
 * Description: Focused Jigma beta dock for converting HTML, CSS, and optional JavaScript into Bricks Builder structures.
 * Version: 0.2.3-beta
 * Author: Jigma
 * Text Domain: jigma-bricks
 * Requires at least: 6.4
 * Requires PHP: 7.4
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'JIGMA_BRICKS_VERSION', '0.2.3-beta' );
define( 'JIGMA_BRICKS_TARGET_VERSION', '2.3.7' );
define( 'JIGMA_BRICKS_COMPATIBILITY_SCHEMA_VERSION', 'bricks-compatibility.v1' );
define( 'JIGMA_BRICKS_PLUGIN_FILE', __FILE__ );
define( 'JIGMA_BRICKS_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'JIGMA_BRICKS_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

$jigma_bricks_updater_file = JIGMA_BRICKS_PLUGIN_DIR . 'includes/class-jigma-plugin-updater.php';
if ( is_readable( $jigma_bricks_updater_file ) ) {
	require_once $jigma_bricks_updater_file;

	if ( class_exists( 'Jigma_Bricks_Plugin_Updater' ) ) {
		Jigma_Bricks_Plugin_Updater::register( JIGMA_BRICKS_PLUGIN_FILE, JIGMA_BRICKS_VERSION );
	}
}

/**
 * Detects Bricks without requiring one specific implementation detail.
 *
 * Bricks is commonly active as a theme, and builder internals may not be loaded
 * on every admin request. Keep this broad and conservative for the beta.
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

function jigma_bricks_get_request_value( string $key ): string {
	if ( ! isset( $_GET[ $key ] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		return '';
	}

	return sanitize_text_field( wp_unslash( $_GET[ $key ] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
}

function jigma_bricks_current_user_can_load_builder(): bool {
	$post_id = jigma_bricks_get_builder_post_id();

	if ( $post_id > 0 ) {
		return current_user_can( 'edit_post', $post_id );
	}

	return current_user_can( 'edit_posts' ) || current_user_can( 'edit_pages' );
}

function jigma_bricks_is_debug_override(): bool {
	if ( '1' !== jigma_bricks_get_request_value( 'jigma_debug' ) || ! is_user_logged_in() ) {
		return false;
	}

	return jigma_bricks_current_user_can_load_builder();
}

function jigma_bricks_request_has_builder_signal(): bool {
	$query_keys = array(
		'bricks',
		'bricks_preview',
		'bricks-preview',
		'brickspreview',
		'bricks_builder',
		'bricks-builder',
		'bricksbuilder',
		'bricks_edit',
		'bricks-edit',
		'bricks_iframe',
		'bricks-iframe',
		'bricks_nonce',
		'bricks_post_id',
		'bricks_template',
	);

	foreach ( $query_keys as $key ) {
		if ( jigma_bricks_request_value_contains_bricks( $key ) ) {
			return true;
		}
	}

	foreach ( array_keys( $_GET ) as $key ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( is_string( $key ) && 0 === stripos( $key, 'bricks' ) ) {
			return true;
		}
	}

	return false;
}

function jigma_bricks_core_reports_builder_context(): bool {
	$checks = array(
		'bricks_is_builder',
		'bricks_is_builder_main',
	);

	foreach ( $checks as $function_name ) {
		if ( function_exists( $function_name ) ) {
			try {
				if ( (bool) call_user_func( $function_name ) ) {
					return true;
				}
			} catch ( Throwable $error ) {
				continue;
			}
		}
	}

	if ( defined( 'BRICKS_IS_BUILDER' ) && BRICKS_IS_BUILDER ) {
		return true;
	}

	if ( defined( 'BRICKS_BUILDER' ) && BRICKS_BUILDER ) {
		return true;
	}

	return false;
}

function jigma_bricks_detect_builder_context(): array {
	$debug_override = jigma_bricks_is_debug_override();
	$reasons        = array();

	if ( $debug_override ) {
		$reasons[] = 'debug_override';
	}

	if ( jigma_bricks_core_reports_builder_context() ) {
		$reasons[] = 'bricks_helper';
	}

	if ( jigma_bricks_request_has_builder_signal() ) {
		$reasons[] = 'request_parameter';
	}

	if ( is_admin() ) {
		$page = jigma_bricks_get_request_value( 'page' );

		if ( false !== stripos( $page, 'bricks' ) ) {
			$reasons[] = 'admin_page';
		}

		if ( function_exists( 'get_current_screen' ) ) {
			$screen = get_current_screen();
			if ( $screen && false !== stripos( (string) $screen->id, 'bricks' ) ) {
				$reasons[] = 'admin_screen';
			}
		}
	}

	$bricks_active = jigma_bricks_is_bricks_active();
	$can_load      = jigma_bricks_current_user_can_load_builder();
	$builder_signal = in_array( 'bricks_helper', $reasons, true ) ||
		in_array( 'request_parameter', $reasons, true ) ||
		in_array( 'admin_page', $reasons, true ) ||
		in_array( 'admin_screen', $reasons, true );

	return array(
		'detected'      => $debug_override || ( $bricks_active && $can_load && $builder_signal ),
		'builderSignal' => $builder_signal,
		'debug'         => $debug_override,
		'bricksActive'  => $bricks_active,
		'canLoad'       => $can_load,
		'reasons'       => array_values( array_unique( $reasons ) ),
	);
}

function jigma_bricks_is_builder_context(): bool {
	$context = jigma_bricks_detect_builder_context();
	return (bool) $context['detected'];
}

function jigma_bricks_required_asset_files(): array {
	return array(
		'css'   => 'assets/jigma-bricks.css',
		'core'  => 'assets/jigma-core.js',
		'panel' => 'assets/jigma-bricks.js',
	);
}

function jigma_bricks_asset_path( string $relative_path ): string {
	return JIGMA_BRICKS_PLUGIN_DIR . $relative_path;
}

function jigma_bricks_asset_url( string $relative_path ): string {
	return JIGMA_BRICKS_PLUGIN_URL . $relative_path;
}

function jigma_bricks_get_asset_version( string $relative_path ): string {
	$path = jigma_bricks_asset_path( $relative_path );

	return is_readable( $path ) ? (string) filemtime( $path ) : JIGMA_BRICKS_VERSION;
}

function jigma_bricks_missing_asset_files(): array {
	$missing = array();

	foreach ( jigma_bricks_required_asset_files() as $label => $relative_path ) {
		if ( ! is_readable( jigma_bricks_asset_path( $relative_path ) ) ) {
			$missing[ $label ] = $relative_path;
		}
	}

	return $missing;
}

function jigma_bricks_register_development_error( string $message ): void {
	$GLOBALS['jigma_bricks_development_errors'][] = $message;
	add_action( 'admin_footer', 'jigma_bricks_render_development_errors' );
	add_action( 'wp_footer', 'jigma_bricks_render_development_errors' );
}

function jigma_bricks_render_development_errors(): void {
	static $rendered = false;

	if ( $rendered ) {
		return;
	}

	$errors = isset( $GLOBALS['jigma_bricks_development_errors'] ) && is_array( $GLOBALS['jigma_bricks_development_errors'] )
		? array_unique( array_map( 'sanitize_text_field', $GLOBALS['jigma_bricks_development_errors'] ) )
		: array();

	if ( empty( $errors ) ) {
		return;
	}

	$rendered = true;

	?>
	<div id="jigma-bricks-root" class="jigma-root" style="position:fixed;right:16px;bottom:16px;z-index:999999;background:#070a13;color:#f8fafc;border:1px solid #8b5cf6;border-radius:12px;box-shadow:0 18px 60px rgba(0,0,0,.45);font:13px/1.45 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:420px;padding:14px;">
		<strong><?php esc_html_e( 'Jigma development error', 'jigma-bricks' ); ?></strong>
		<ul style="margin:8px 0 0 18px;padding:0;">
			<?php foreach ( $errors as $error ) : ?>
				<li><?php echo esc_html( $error ); ?></li>
			<?php endforeach; ?>
		</ul>
	</div>
	<?php
}

function jigma_bricks_enqueue_assets(): void {
	$context = jigma_bricks_detect_builder_context();

	if ( ! $context['detected'] ) {
		return;
	}

	$post_id         = jigma_bricks_get_builder_post_id();
	$current_content = $post_id > 0 ? jigma_bricks_get_current_content( $post_id ) : array();
	$components      = $post_id > 0 ? jigma_bricks_get_components_registry( $post_id ) : array();
	$assets          = jigma_bricks_required_asset_files();
	$missing_assets  = jigma_bricks_missing_asset_files();

	if ( ! empty( $missing_assets ) ) {
		jigma_bricks_register_development_error(
			sprintf(
				/* translators: %s is a comma-separated list of missing plugin asset files. */
				__( 'Missing required Jigma asset file(s): %s', 'jigma-bricks' ),
				implode( ', ', array_values( $missing_assets ) )
			)
		);
		return;
	}

	wp_enqueue_style(
		'jigma-bricks-panel',
		jigma_bricks_asset_url( $assets['css'] ),
		array(),
		jigma_bricks_get_asset_version( $assets['css'] )
	);

	wp_enqueue_script(
		'jigma-core',
		jigma_bricks_asset_url( $assets['core'] ),
		array(),
		jigma_bricks_get_asset_version( $assets['core'] ),
		true
	);

	wp_enqueue_script(
		'jigma-bricks-panel',
		jigma_bricks_asset_url( $assets['panel'] ),
		array( 'jigma-core' ),
		jigma_bricks_get_asset_version( $assets['panel'] ),
		true
	);

	wp_localize_script(
		'jigma-bricks-panel',
		'JigmaBricksPlugin',
		array(
			'ajaxUrl'             => admin_url( 'admin-ajax.php' ),
			'bricksActive'         => jigma_bricks_is_bricks_active(),
			'builderContext'       => true,
			'debug'                => (bool) $context['debug'],
			'insertNonce'          => wp_create_nonce( 'jigma_bricks_insert' ),
			'postId'               => $post_id,
			'contentHash'          => jigma_bricks_content_hash( $current_content ),
			'contentSummary'       => jigma_bricks_summarize_content( $current_content ),
			'components'           => jigma_bricks_summarize_components( $components ),
			'iconUrl'              => jigma_bricks_asset_url( 'assets/jigma-icon.svg' ),
			'targetBricksVersion'  => JIGMA_BRICKS_TARGET_VERSION,
			'compatibilitySchemaVersion' => JIGMA_BRICKS_COMPATIBILITY_SCHEMA_VERSION,
			'sourceUrl'            => 'jigma.local',
			'version'              => JIGMA_BRICKS_VERSION,
			'insertLabel'          => __( 'Insert into Selected', 'jigma-bricks' ),
			'copyLabel'            => __( 'Copy Bricks Structure', 'jigma-bricks' ),
			'runPreviewLabel'      => __( 'Run Preview', 'jigma-bricks' ),
			'panelTitle'           => __( 'Jigma', 'jigma-bricks' ),
			'panelSubtitle'        => __( 'HTML/CSS/JS to Bricks structure', 'jigma-bricks' ),
		)
	);

	if ( $context['debug'] ) {
		wp_add_inline_script(
			'jigma-bricks-panel',
			'window.JigmaBricksDiagnostics = ' . wp_json_encode(
				array(
					'phpEnqueued'       => true,
					'builderDetected'   => (bool) $context['builderSignal'],
					'coreLoaded'        => false,
					'configLoaded'      => true,
					'mounted'           => false,
					'rootFound'         => false,
					'workspaceDetected' => false,
					'dockState'         => 'pending',
					'pluginVersion'     => JIGMA_BRICKS_VERSION,
					'errors'            => array(),
				)
			) . ';',
			'before'
		);
	}
}
add_action( 'admin_enqueue_scripts', 'jigma_bricks_enqueue_assets', 20 );
add_action( 'wp_enqueue_scripts', 'jigma_bricks_enqueue_assets', 20 );

function jigma_bricks_enqueue_debug_hint(): void {
	if ( jigma_bricks_is_builder_context() ) {
		return;
	}

	if ( '1' === jigma_bricks_get_request_value( 'jigma_debug' ) && is_user_logged_in() ) {
		jigma_bricks_register_development_error(
			__( 'Jigma debug requested, but this user cannot edit the current post or Bricks is not available in this request.', 'jigma-bricks' )
		);
	}
}
add_action( 'admin_footer', 'jigma_bricks_enqueue_debug_hint' );
add_action( 'wp_footer', 'jigma_bricks_enqueue_debug_hint' );

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

function jigma_bricks_get_components_meta_key(): string {
	return '_jigma_components_v1';
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

function jigma_bricks_content_hash( array $content ): string {
	return hash( 'sha256', (string) wp_json_encode( $content ) );
}

function jigma_bricks_element_accepts_children( array $element ): bool {
	$name = isset( $element['name'] ) ? sanitize_key( $element['name'] ) : '';
	return in_array(
		$name,
		array( 'section', 'container', 'block', 'div', 'ul', 'ol', 'li' ),
		true
	);
}

function jigma_bricks_element_is_locked( array $element ): bool {
	$settings = isset( $element['settings'] ) && is_array( $element['settings'] )
		? $element['settings']
		: array();

	foreach ( array( '_lock', '_locked', 'locked' ) as $key ) {
		if ( ! empty( $settings[ $key ] ) ) {
			return true;
		}
	}

	return false;
}

function jigma_bricks_find_element_index( array $content, string $element_id ) {
	foreach ( $content as $index => $element ) {
		if ( is_array( $element ) && isset( $element['id'] ) && (string) $element['id'] === $element_id ) {
			return $index;
		}
	}

	return false;
}

function jigma_bricks_summarize_content( array $content ): array {
	return array_values(
		array_filter(
			array_map(
				static function ( $element ) {
					if ( ! is_array( $element ) || empty( $element['id'] ) ) {
						return null;
					}

					return array(
						'id'              => (string) $element['id'],
						'name'            => isset( $element['name'] ) ? sanitize_key( $element['name'] ) : '',
						'label'           => isset( $element['label'] ) ? jigma_bricks_clean_string( $element['label'] ) : '',
						'acceptsChildren' => jigma_bricks_element_accepts_children( $element ) && ! jigma_bricks_element_is_locked( $element ),
						'locked'          => jigma_bricks_element_is_locked( $element ),
					);
				},
				$content
			)
		)
	);
}

function jigma_bricks_read_source_from_request(): array {
	return array(
		'html'       => isset( $_POST['html'] ) ? jigma_bricks_clean_string( wp_unslash( $_POST['html'] ) ) : '',
		'css'        => isset( $_POST['css'] ) ? jigma_bricks_clean_string( wp_unslash( $_POST['css'] ) ) : '',
		'javascript' => isset( $_POST['javascript'] ) ? jigma_bricks_clean_string( wp_unslash( $_POST['javascript'] ) ) : '',
	);
}

function jigma_bricks_source_hash( array $source ): string {
	return hash(
		'sha256',
		(string) wp_json_encode(
			array(
				'html'       => (string) ( $source['html'] ?? '' ),
				'css'        => (string) ( $source['css'] ?? '' ),
				'javascript' => (string) ( $source['javascript'] ?? '' ),
			)
		)
	);
}

function jigma_bricks_payload_hash( array $payload ): string {
	return hash( 'sha256', (string) wp_json_encode( $payload ) );
}

function jigma_bricks_normalize_id_list( $value ): array {
	if ( ! is_array( $value ) ) {
		return array();
	}

	return array_values(
		array_unique(
			array_filter(
				array_map(
					static function ( $id ) {
						$id = sanitize_key( (string) $id );
						return '' === $id ? null : $id;
					},
					$value
				)
			)
		)
	);
}

function jigma_bricks_normalize_component_record( $record ) {
	if ( ! is_array( $record ) || empty( $record['componentId'] ) ) {
		return null;
	}

	$source = array(
		'html'       => isset( $record['html'] ) ? jigma_bricks_clean_string( $record['html'] ) : '',
		'css'        => isset( $record['css'] ) ? jigma_bricks_clean_string( $record['css'] ) : '',
		'javascript' => isset( $record['javascript'] ) ? jigma_bricks_clean_string( $record['javascript'] ) : '',
	);

	return array(
		'componentId'     => sanitize_key( (string) $record['componentId'] ),
		'name'            => isset( $record['name'] ) ? jigma_bricks_clean_string( $record['name'] ) : '',
		'rootElementIds'  => jigma_bricks_normalize_id_list( $record['rootElementIds'] ?? array() ),
		'allElementIds'   => jigma_bricks_normalize_id_list( $record['allElementIds'] ?? array() ),
		'parentElementId' => isset( $record['parentElementId'] ) ? sanitize_key( (string) $record['parentElementId'] ) : '',
		'html'            => $source['html'],
		'css'             => $source['css'],
		'javascript'      => $source['javascript'],
		'sourceHash'      => isset( $record['sourceHash'] ) ? sanitize_text_field( (string) $record['sourceHash'] ) : jigma_bricks_source_hash( $source ),
		'payloadHash'     => isset( $record['payloadHash'] ) ? sanitize_text_field( (string) $record['payloadHash'] ) : '',
		'createdAt'       => isset( $record['createdAt'] ) ? sanitize_text_field( (string) $record['createdAt'] ) : current_time( 'mysql', true ),
		'updatedAt'       => isset( $record['updatedAt'] ) ? sanitize_text_field( (string) $record['updatedAt'] ) : current_time( 'mysql', true ),
		'schemaVersion'   => isset( $record['schemaVersion'] ) ? sanitize_text_field( (string) $record['schemaVersion'] ) : 'jigma-component.v1',
	);
}

function jigma_bricks_get_components_registry( int $post_id ): array {
	$raw = get_post_meta( $post_id, jigma_bricks_get_components_meta_key(), true );
	if ( ! is_array( $raw ) ) {
		return array();
	}

	return array_values(
		array_filter(
			array_map( 'jigma_bricks_normalize_component_record', $raw )
		)
	);
}

function jigma_bricks_save_components_registry( int $post_id, array $registry ): void {
	update_post_meta(
		$post_id,
		jigma_bricks_get_components_meta_key(),
		array_values(
			array_filter(
				array_map( 'jigma_bricks_normalize_component_record', $registry )
			)
		)
	);
}

function jigma_bricks_summarize_components( array $registry ): array {
	return array_values(
		array_filter(
			array_map(
				static function ( $record ) {
					return jigma_bricks_normalize_component_record( $record );
				},
				$registry
			)
		)
	);
}

function jigma_bricks_generate_component_id( array $registry ): string {
	$used_ids = array();
	foreach ( $registry as $record ) {
		if ( is_array( $record ) && ! empty( $record['componentId'] ) ) {
			$used_ids[ (string) $record['componentId'] ] = true;
		}
	}

	do {
		$id = 'jigma-' . substr( strtolower( str_replace( '-', '', wp_generate_uuid4() ) ), 0, 12 );
	} while ( isset( $used_ids[ $id ] ) );

	return $id;
}

function jigma_bricks_make_component_name( array $elements, array $root_element_ids ): string {
	foreach ( $root_element_ids as $root_id ) {
		foreach ( $elements as $element ) {
			if ( is_array( $element ) && isset( $element['id'] ) && (string) $element['id'] === (string) $root_id ) {
				$label = isset( $element['label'] ) ? jigma_bricks_clean_string( $element['label'] ) : '';
				if ( '' !== $label ) {
					return $label;
				}
			}
		}
	}

	return 'Jigma Component';
}

function jigma_bricks_make_component_record( string $component_id, array $source, array $payload, string $parent_id, array $root_element_ids, array $all_element_ids, array $elements, string $created_at = '' ): array {
	$now = current_time( 'mysql', true );

	return array(
		'componentId'     => $component_id,
		'name'            => jigma_bricks_make_component_name( $elements, $root_element_ids ),
		'rootElementIds'  => array_values( $root_element_ids ),
		'allElementIds'   => array_values( $all_element_ids ),
		'parentElementId' => $parent_id,
		'html'            => (string) ( $source['html'] ?? '' ),
		'css'             => (string) ( $source['css'] ?? '' ),
		'javascript'      => (string) ( $source['javascript'] ?? '' ),
		'sourceHash'      => jigma_bricks_source_hash( $source ),
		'payloadHash'     => jigma_bricks_payload_hash( $payload ),
		'createdAt'       => '' === $created_at ? $now : $created_at,
		'updatedAt'       => $now,
		'schemaVersion'   => 'jigma-component.v1',
	);
}

function jigma_bricks_find_component_index( array $registry, string $component_id ) {
	foreach ( $registry as $index => $record ) {
		if ( is_array( $record ) && (string) ( $record['componentId'] ?? '' ) === $component_id ) {
			return $index;
		}
	}

	return false;
}

function jigma_bricks_index_content_by_id( array $content ): array {
	$indexed = array();
	foreach ( $content as $element ) {
		if ( is_array( $element ) && isset( $element['id'] ) ) {
			$indexed[ (string) $element['id'] ] = $element;
		}
	}
	return $indexed;
}

function jigma_bricks_get_elements_by_ids( array $content, array $ids ): array {
	$wanted = array_fill_keys( array_map( 'strval', $ids ), true );
	return array_values(
		array_filter(
			$content,
			static function ( $element ) use ( $wanted ) {
				return is_array( $element ) && isset( $element['id'] ) && isset( $wanted[ (string) $element['id'] ] );
			}
		)
	);
}

function jigma_bricks_content_has_ids( array $content, array $ids ): bool {
	$indexed = jigma_bricks_index_content_by_id( $content );
	foreach ( $ids as $id ) {
		if ( ! isset( $indexed[ (string) $id ] ) ) {
			return false;
		}
	}
	return true;
}

function jigma_bricks_remove_elements_by_ids( array $content, array $ids ): array {
	$remove = array_fill_keys( array_map( 'strval', $ids ), true );
	$next   = array();

	foreach ( $content as $element ) {
		if ( ! is_array( $element ) || empty( $element['id'] ) || isset( $remove[ (string) $element['id'] ] ) ) {
			continue;
		}

		if ( isset( $element['children'] ) && is_array( $element['children'] ) ) {
			$element['children'] = array_values(
				array_filter(
					$element['children'],
					static function ( $child_id ) use ( $remove ) {
						return ! isset( $remove[ (string) $child_id ] );
					}
				)
			);
		}

		$next[] = $element;
	}

	return $next;
}

function jigma_bricks_replace_child_sequence( array $children, array $old_root_ids, array $new_root_ids ): array {
	$old_lookup = array_fill_keys( array_map( 'strval', $old_root_ids ), true );
	$next       = array();
	$inserted   = false;

	foreach ( $children as $child_id ) {
		if ( isset( $old_lookup[ (string) $child_id ] ) ) {
			if ( ! $inserted ) {
				$next     = array_merge( $next, $new_root_ids );
				$inserted = true;
			}
			continue;
		}

		$next[] = (string) $child_id;
	}

	if ( ! $inserted ) {
		$next = array_merge( $next, $new_root_ids );
	}

	return array_values( $next );
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

function jigma_bricks_validate_compatibility_payload( $payload ) {
	if ( ! is_array( $payload ) ) {
		return new WP_Error(
			'jigma_invalid_payload',
			__( 'Jigma did not receive a valid Bricks compatibility payload.', 'jigma-bricks' )
		);
	}

	$expected_keys = array(
		'content',
		'globalClasses',
		'globalElements',
		'source',
		'sourceUrl',
		'version',
	);

	foreach ( $expected_keys as $key ) {
		if ( ! array_key_exists( $key, $payload ) ) {
			return new WP_Error(
				'jigma_missing_payload_key',
				sprintf(
					/* translators: %s: payload key. */
					__( 'Jigma compatibility payload is missing "%s".', 'jigma-bricks' ),
					$key
				)
			);
		}
	}

	if ( 'bricksCopiedElements' !== (string) $payload['source'] ) {
		return new WP_Error(
			'jigma_invalid_payload_source',
			__( 'Jigma payload source must be bricksCopiedElements.', 'jigma-bricks' )
		);
	}

	if ( ! is_array( $payload['content'] ) || empty( $payload['content'] ) ) {
		return new WP_Error(
			'jigma_invalid_payload_content',
			__( 'Jigma compatibility payload does not contain insertable Bricks content.', 'jigma-bricks' )
		);
	}

	if ( ! is_array( $payload['globalClasses'] ) || ! is_array( $payload['globalElements'] ) ) {
		return new WP_Error(
			'jigma_invalid_payload_classes',
			__( 'Jigma compatibility payload must include globalClasses and globalElements arrays.', 'jigma-bricks' )
		);
	}

	return array(
		'content'        => array_values( $payload['content'] ),
		'globalClasses'  => array_values( $payload['globalClasses'] ),
		'globalElements' => array_values( $payload['globalElements'] ),
		'source'         => jigma_bricks_clean_string( $payload['source'] ),
		'sourceUrl'      => jigma_bricks_clean_string( $payload['sourceUrl'] ),
		'version'        => jigma_bricks_clean_string( $payload['version'] ),
	);
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
	$conflicts        = array();

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
				$conflicts[] = array(
					'type'     => 'global-class-name',
					'name'     => $name,
					'existing' => isset( $existing['id'] ) ? (string) $existing['id'] : '',
					'incoming' => $incoming_id,
					'message'  => sprintf(
						/* translators: %s: Bricks global class name. */
						__( 'A Bricks global class named "%s" already exists with different settings. Rename or remove the existing class before inserting this Jigma payload.', 'jigma-bricks' ),
						$name
					),
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
		'classes'   => $merged,
		'idMap'     => $id_map,
		'conflicts' => $conflicts,
	);
}

function jigma_bricks_collect_global_class_ids_from_elements( array $elements ): array {
	$class_ids = array();

	foreach ( $elements as $element ) {
		if ( ! is_array( $element ) || empty( $element['settings']['_cssGlobalClasses'] ) || ! is_array( $element['settings']['_cssGlobalClasses'] ) ) {
			continue;
		}

		foreach ( $element['settings']['_cssGlobalClasses'] as $class_id ) {
			$class_id = (string) $class_id;
			if ( '' !== $class_id ) {
				$class_ids[ $class_id ] = true;
			}
		}
	}

	return array_keys( $class_ids );
}

function jigma_bricks_count_class_usage_outside_elements( array $content, array $excluded_element_ids ): array {
	$excluded = array_fill_keys( array_map( 'strval', $excluded_element_ids ), true );
	$usage    = array();

	foreach ( $content as $element ) {
		if ( ! is_array( $element ) || empty( $element['id'] ) || isset( $excluded[ (string) $element['id'] ] ) ) {
			continue;
		}

		if ( empty( $element['settings']['_cssGlobalClasses'] ) || ! is_array( $element['settings']['_cssGlobalClasses'] ) ) {
			continue;
		}

		foreach ( $element['settings']['_cssGlobalClasses'] as $class_id ) {
			$class_id = (string) $class_id;
			$usage[ $class_id ] = isset( $usage[ $class_id ] ) ? $usage[ $class_id ] + 1 : 1;
		}
	}

	return $usage;
}

function jigma_bricks_merge_global_classes_for_component_update( array $incoming_classes, array $existing_classes, array $old_component_elements, array $current_content, array $old_component_ids, array &$warnings ): array {
	$merged               = array_values( $existing_classes );
	$used_ids             = array();
	$existing_by_name     = array();
	$id_map               = array();
	$conflicts            = array();
	$owned_class_ids      = array_fill_keys( jigma_bricks_collect_global_class_ids_from_elements( $old_component_elements ), true );
	$outside_class_usage  = jigma_bricks_count_class_usage_outside_elements( $current_content, $old_component_ids );

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
			$existing       = $existing_by_name[ $name ]['class'];
			$existing_id    = isset( $existing['id'] ) ? (string) $existing['id'] : '';
			$existing_index = $existing_by_name[ $name ]['index'];
			$id_map[ $incoming_id ] = '' !== $existing_id ? $existing_id : $normalized['id'];

			$existing_settings = isset( $existing['settings'] ) && is_array( $existing['settings'] )
				? $existing['settings']
				: array();

			if ( ! jigma_bricks_settings_differ( $existing_settings, $normalized['settings'] ) ) {
				continue;
			}

			$owned_by_component = '' !== $existing_id && isset( $owned_class_ids[ $existing_id ] );
			$used_elsewhere    = '' !== $existing_id && ! empty( $outside_class_usage[ $existing_id ] );

			if ( $owned_by_component && ! $used_elsewhere ) {
				$normalized['id']       = $existing_id;
				$merged[ $existing_index ] = $normalized;
				$existing_by_name[ $name ]['class'] = $normalized;
				continue;
			}

			$conflicts[] = array(
				'type'     => 'global-class-name',
				'name'     => $name,
				'existing' => $existing_id,
				'incoming' => $incoming_id,
				'message'  => sprintf(
					/* translators: %s: Bricks global class name. */
					__( 'A Bricks global class named "%s" already exists with different settings outside this Jigma component. Rename or resolve the class before updating.', 'jigma-bricks' ),
					$name
				),
			);
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
		'classes'   => $merged,
		'idMap'     => $id_map,
		'conflicts' => $conflicts,
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

function jigma_bricks_get_code_warnings( array $payload, bool $include_js_code ): array {
	if ( ! $include_js_code ) {
		return array();
	}

	foreach ( $payload['content'] as $incoming_element ) {
		if (
			is_array( $incoming_element ) &&
			isset( $incoming_element['name'], $incoming_element['settings'] ) &&
			'code' === $incoming_element['name'] &&
			is_array( $incoming_element['settings'] ) &&
			(
				! empty( $incoming_element['settings']['javascriptCode'] ) ||
				! empty( $incoming_element['settings']['javascript'] ) ||
				! empty( $incoming_element['settings']['js'] )
			)
		) {
			return array(
				__( 'JavaScript signature required. This section contains one unsigned Bricks Code element. Review and sign it inside Bricks before enabling execution.', 'jigma-bricks' ),
			);
		}
	}

	return array();
}

function jigma_bricks_request_css_regeneration( int $post_id ): bool {
	update_post_meta( $post_id, '_jigma_bricks_css_regeneration_requested', time() );

	if ( has_action( 'bricks/generate_css_file' ) ) {
		do_action( 'bricks/generate_css_file', $post_id );
		return true;
	}

	return false;
}

function jigma_bricks_split_css_blocks( string $css ): array {
	$blocks = preg_split( '/(?<=})\s+/', trim( $css ) );
	return array_values(
		array_filter(
			array_map(
				static function ( $block ) {
					return trim( (string) $block );
				},
				is_array( $blocks ) ? $blocks : array( $css )
			)
		)
	);
}

function jigma_bricks_merge_css_blocks( string $existing_css, string $incoming_css ): string {
	$seen   = array();
	$merged = array();

	foreach ( array_merge( jigma_bricks_split_css_blocks( $existing_css ), jigma_bricks_split_css_blocks( $incoming_css ) ) as $block ) {
		$key = preg_replace( '/\s+/', ' ', $block );
		if ( isset( $seen[ $key ] ) ) {
			continue;
		}
		$seen[ $key ] = true;
		$merged[]     = $block;
	}

	return implode( "\n\n", $merged );
}

function jigma_bricks_apply_page_styles( array $content, string $page_styles_css ): array {
	$page_styles_css = trim( $page_styles_css );
	if ( '' === $page_styles_css ) {
		return array(
			'content' => $content,
			'created' => false,
			'updated' => false,
		);
	}

	foreach ( $content as $index => $element ) {
		if ( ! is_array( $element ) || ( $element['label'] ?? '' ) !== 'Jigma Page Styles' ) {
			continue;
		}

		$settings = isset( $element['settings'] ) && is_array( $element['settings'] )
			? $element['settings']
			: array();
		$existing_css = isset( $settings['css'] ) ? (string) $settings['css'] : (string) ( $settings['cssCode'] ?? '' );
		$merged_css   = jigma_bricks_merge_css_blocks( $existing_css, $page_styles_css );
		$settings['executeCode'] = false;
		$settings['css']         = $merged_css;
		$settings['cssCode']     = $merged_css;
		$content[ $index ]['settings'] = $settings;

		return array(
			'content' => $content,
			'created' => false,
			'updated' => true,
		);
	}

	$used_ids = array();
	foreach ( $content as $element ) {
		if ( is_array( $element ) && isset( $element['id'] ) ) {
			$used_ids[ (string) $element['id'] ] = true;
		}
	}

	$content[] = array(
		'id'       => jigma_bricks_generate_element_id( $used_ids ),
		'name'     => 'code',
		'parent'   => 0,
		'children' => array(),
		'settings' => array(
			'executeCode' => false,
			'css'         => $page_styles_css,
			'cssCode'     => $page_styles_css,
		),
		'label'    => 'Jigma Page Styles',
	);

	return array(
		'content' => $content,
		'created' => true,
		'updated' => false,
	);
}

function jigma_bricks_normalize_elements_for_insert( array $incoming_elements, array $existing_elements, bool $include_js_code, array $global_class_id_map, string $target_id ): array {
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
				? $target_id
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

	if ( empty( $_POST['builderContext'] ) ) {
		wp_send_json_error(
			array( 'message' => __( 'Jigma insertion is only available from the Bricks builder context.', 'jigma-bricks' ) ),
			400
		);
	}

	$payload_json = isset( $_POST['payload'] ) ? wp_unslash( $_POST['payload'] ) : '';
	if ( strlen( (string) $payload_json ) > 2000000 ) {
		wp_send_json_error(
			array( 'message' => __( 'Jigma payload is too large for this beta insertion endpoint.', 'jigma-bricks' ) ),
			413
		);
	}

	$payload      = json_decode( (string) $payload_json, true );

	$payload = jigma_bricks_validate_compatibility_payload( $payload );
	if ( is_wp_error( $payload ) ) {
		wp_send_json_error(
			array(
				'message' => $payload->get_error_message(),
				'code'    => $payload->get_error_code(),
			),
			400
		);
	}
	$source = jigma_bricks_read_source_from_request();

	$target_id = isset( $_POST['targetId'] ) ? sanitize_key( wp_unslash( $_POST['targetId'] ) ) : '';
	if ( '' === $target_id ) {
		wp_send_json_error(
			array(
				'message' => __( 'Select a container in Bricks before inserting.', 'jigma-bricks' ),
				'code'    => 'jigma_missing_selected_target',
			),
			400
		);
	}

	$include_js_code  = ! empty( $_POST['includeJsCode'] );
	$code_warnings    = jigma_bricks_get_code_warnings( $payload, $include_js_code );
	$current_content  = jigma_bricks_get_current_content( $post_id );
	$current_classes  = jigma_bricks_get_current_global_classes();
	$components       = jigma_bricks_get_components_registry( $post_id );
	$posted_hash      = isset( $_POST['contentHash'] ) ? sanitize_text_field( wp_unslash( $_POST['contentHash'] ) ) : '';
	$current_hash     = jigma_bricks_content_hash( $current_content );

	if ( '' !== $posted_hash && ! hash_equals( $current_hash, $posted_hash ) ) {
		wp_send_json_error(
			array(
				'message' => __( 'The saved Bricks content changed after Jigma loaded. Reload the builder before inserting.', 'jigma-bricks' ),
				'code'    => 'jigma_content_version_changed',
			),
			409
		);
	}

	$target_index = jigma_bricks_find_element_index( $current_content, $target_id );
	if ( false === $target_index ) {
		wp_send_json_error(
			array(
				'message' => __( 'The selected Bricks element no longer exists. Select a container again before inserting.', 'jigma-bricks' ),
				'code'    => 'jigma_selected_target_missing',
			),
			400
		);
	}

	if ( ! jigma_bricks_element_accepts_children( $current_content[ $target_index ] ) ) {
		wp_send_json_error(
			array(
				'message' => __( 'The selected element cannot contain children. Select its parent container or another nestable element.', 'jigma-bricks' ),
				'code'    => 'jigma_selected_target_not_nestable',
			),
			400
		);
	}

	if ( jigma_bricks_element_is_locked( $current_content[ $target_index ] ) ) {
		wp_send_json_error(
			array(
				'message' => __( 'The selected element is locked or unsuitable for insertion. Select another nestable element.', 'jigma-bricks' ),
				'code'    => 'jigma_selected_target_locked',
			),
			400
		);
	}

	$class_warnings   = array();
	$class_merge      = jigma_bricks_merge_global_classes(
		$payload['globalClasses'],
		$current_classes,
		$class_warnings
	);

	if ( ! empty( $class_merge['conflicts'] ) ) {
		wp_send_json_error(
			array(
				'message'   => __( 'Jigma found Bricks class-name conflicts. No content was inserted.', 'jigma-bricks' ),
				'code'      => 'jigma_global_class_conflict',
				'conflicts' => $class_merge['conflicts'],
			),
			409
		);
	}

	$incoming_content = array_slice( $payload['content'], 0, 250 );
	$new_elements     = jigma_bricks_normalize_elements_for_insert(
		$incoming_content,
		$current_content,
		$include_js_code,
		$class_merge['idMap'],
		$target_id
	);
	$class_warnings   = array_merge(
		$class_warnings,
		jigma_bricks_validate_global_class_references( $new_elements, $class_merge['classes'] )
	);

	if ( ! empty( $class_warnings ) ) {
		wp_send_json_error(
			array(
				'message' => __( 'Jigma found invalid Bricks class references. No content was inserted.', 'jigma-bricks' ),
				'code'    => 'jigma_invalid_class_references',
				'errors'  => $class_warnings,
			),
			400
		);
	}

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

	$post_filter_class_errors = jigma_bricks_validate_global_class_references( $new_elements, $class_merge['classes'] );
	if ( ! empty( $post_filter_class_errors ) ) {
		wp_send_json_error(
			array(
				'message' => __( 'Bricks security filtering left invalid class references. No content was inserted.', 'jigma-bricks' ),
				'code'    => 'jigma_filtered_invalid_class_references',
				'errors'  => $post_filter_class_errors,
			),
			400
		);
	}

	$inserted_root_ids = array_values(
		array_filter(
			array_map(
				static function ( $element ) use ( $target_id ) {
					if ( ! is_array( $element ) || (string) ( $element['parent'] ?? '' ) !== $target_id ) {
						return null;
					}
					return isset( $element['id'] ) ? (string) $element['id'] : null;
				},
				$new_elements
			)
		)
	);

	if ( empty( $inserted_root_ids ) ) {
		wp_send_json_error(
			array(
				'message' => __( 'No component root remained under the selected target after Bricks validation. No content was inserted.', 'jigma-bricks' ),
				'code'    => 'jigma_no_selected_target_roots',
			),
			400
		);
	}

	if ( ! empty( $class_merge['classes'] ) ) {
		update_option( jigma_bricks_get_global_classes_option_name(), $class_merge['classes'], false );
	}

	$target_children = isset( $current_content[ $target_index ]['children'] ) && is_array( $current_content[ $target_index ]['children'] )
		? $current_content[ $target_index ]['children']
		: array();
	$current_content[ $target_index ]['children'] = array_values( array_merge( $target_children, $inserted_root_ids ) );

	$updated_content = array_values( array_merge( $current_content, $new_elements ) );
	$page_styles_css = isset( $_POST['pageStylesCss'] ) ? trim( (string) wp_unslash( $_POST['pageStylesCss'] ) ) : '';
	$page_styles     = jigma_bricks_apply_page_styles( $updated_content, $page_styles_css );
	$updated_content = $page_styles['content'];
	$component_id    = jigma_bricks_generate_component_id( $components );
	$all_element_ids = array_values(
		array_filter(
			array_map(
				static function ( $element ) {
					return is_array( $element ) && isset( $element['id'] ) ? (string) $element['id'] : null;
				},
				$new_elements
			)
		)
	);
	$component_record = jigma_bricks_make_component_record(
		$component_id,
		$source,
		$payload,
		$target_id,
		$inserted_root_ids,
		$all_element_ids,
		$new_elements
	);
	$components[] = $component_record;

	update_post_meta( $post_id, jigma_bricks_get_content_meta_key(), $updated_content );
	jigma_bricks_save_components_registry( $post_id, $components );
	update_post_meta( $post_id, '_bricks_editor_mode', 'bricks' );
	$css_regenerated = jigma_bricks_request_css_regeneration( $post_id );
	clean_post_cache( $post_id );

	wp_send_json_success(
		array(
			'message'       => __( 'Jigma elements inserted. Reload the Bricks builder to show the updated canvas.', 'jigma-bricks' ),
			'insertedCount' => count( $new_elements ),
			'componentId'   => $component_id,
			'component'     => $component_record,
			'components'    => jigma_bricks_summarize_components( $components ),
			'targetId'      => $target_id,
			'insertedRootIds' => $inserted_root_ids,
			'globalClasses' => count( $class_merge['classes'] ),
			'globalElements' => count( $payload['globalElements'] ),
			'pageStyles'    => array(
				'created' => (bool) $page_styles['created'],
				'updated' => (bool) $page_styles['updated'],
			),
			'compatibilitySchemaVersion' => JIGMA_BRICKS_COMPATIBILITY_SCHEMA_VERSION,
			'classWarnings' => $class_warnings,
			'codeWarnings'  => $code_warnings,
			'totalCount'    => count( $updated_content ),
			'metaKey'       => jigma_bricks_get_content_meta_key(),
			'contentHash'   => jigma_bricks_content_hash( $updated_content ),
			'contentSummary' => jigma_bricks_summarize_content( $updated_content ),
			'cssRegenerated' => $css_regenerated,
			'reloadNeeded'  => true,
		)
	);
}
add_action( 'wp_ajax_jigma_bricks_insert', 'jigma_bricks_insert_generated_elements' );

function jigma_bricks_update_component(): void {
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

	if ( empty( $_POST['builderContext'] ) ) {
		wp_send_json_error(
			array( 'message' => __( 'Jigma updates are only available from the Bricks builder context.', 'jigma-bricks' ) ),
			400
		);
	}

	$component_id = isset( $_POST['componentId'] ) ? sanitize_key( wp_unslash( $_POST['componentId'] ) ) : '';
	if ( '' === $component_id ) {
		wp_send_json_error(
			array(
				'message' => __( 'Jigma could not identify the component to update.', 'jigma-bricks' ),
				'code'    => 'jigma_missing_component_id',
			),
			400
		);
	}

	$payload_json = isset( $_POST['payload'] ) ? wp_unslash( $_POST['payload'] ) : '';
	if ( strlen( (string) $payload_json ) > 2000000 ) {
		wp_send_json_error(
			array( 'message' => __( 'Jigma payload is too large for this beta update endpoint.', 'jigma-bricks' ) ),
			413
		);
	}

	$payload = jigma_bricks_validate_compatibility_payload( json_decode( (string) $payload_json, true ) );
	if ( is_wp_error( $payload ) ) {
		wp_send_json_error(
			array(
				'message' => $payload->get_error_message(),
				'code'    => $payload->get_error_code(),
			),
			400
		);
	}

	$source          = jigma_bricks_read_source_from_request();
	$include_js_code = ! empty( $_POST['includeJsCode'] );
	$code_warnings   = jigma_bricks_get_code_warnings( $payload, $include_js_code );
	$current_content = jigma_bricks_get_current_content( $post_id );
	$current_classes = jigma_bricks_get_current_global_classes();
	$components      = jigma_bricks_get_components_registry( $post_id );
	$posted_hash     = isset( $_POST['contentHash'] ) ? sanitize_text_field( wp_unslash( $_POST['contentHash'] ) ) : '';
	$current_hash    = jigma_bricks_content_hash( $current_content );

	if ( '' !== $posted_hash && ! hash_equals( $current_hash, $posted_hash ) ) {
		wp_send_json_error(
			array(
				'message' => __( 'The saved Bricks content changed after Jigma loaded. Reload the builder before updating.', 'jigma-bricks' ),
				'code'    => 'jigma_content_version_changed',
			),
			409
		);
	}

	$component_index = jigma_bricks_find_component_index( $components, $component_id );
	if ( false === $component_index ) {
		wp_send_json_error(
			array(
				'message'          => __( 'This Jigma component is no longer registered on the current page. Insert it as a new component instead.', 'jigma-bricks' ),
				'code'             => 'jigma_component_missing',
				'allowInsertAsNew' => true,
			),
			409
		);
	}

	$component        = $components[ $component_index ];
	$parent_id        = (string) ( $component['parentElementId'] ?? '' );
	$old_root_ids     = jigma_bricks_normalize_id_list( $component['rootElementIds'] ?? array() );
	$old_all_ids      = jigma_bricks_normalize_id_list( $component['allElementIds'] ?? array() );
	$parent_index     = jigma_bricks_find_element_index( $current_content, $parent_id );

	if (
		'' === $parent_id ||
		false === $parent_index ||
		empty( $old_root_ids ) ||
		empty( $old_all_ids ) ||
		! jigma_bricks_content_has_ids( $current_content, $old_all_ids )
	) {
		wp_send_json_error(
			array(
				'message'          => __( 'The saved Jigma component subtree could not be found. Insert the current source as a new component.', 'jigma-bricks' ),
				'code'             => 'jigma_component_subtree_missing',
				'allowInsertAsNew' => true,
			),
			409
		);
	}

	$old_parent_children = isset( $current_content[ $parent_index ]['children'] ) && is_array( $current_content[ $parent_index ]['children'] )
		? array_values( $current_content[ $parent_index ]['children'] )
		: array();
	if ( count( array_intersect( array_map( 'strval', $old_root_ids ), array_map( 'strval', $old_parent_children ) ) ) !== count( $old_root_ids ) ) {
		wp_send_json_error(
			array(
				'message'          => __( 'The selected Jigma component no longer exists in its original position. Insert the current source as a new component.', 'jigma-bricks' ),
				'code'             => 'jigma_component_position_missing',
				'allowInsertAsNew' => true,
			),
			409
		);
	}

	$old_component_elements = jigma_bricks_get_elements_by_ids( $current_content, $old_all_ids );
	$content_without_old   = jigma_bricks_remove_elements_by_ids( $current_content, $old_all_ids );
	$parent_index_after    = jigma_bricks_find_element_index( $content_without_old, $parent_id );
	if ( false === $parent_index_after ) {
		wp_send_json_error(
			array(
				'message'          => __( 'The Jigma component parent could not be preserved. Insert the current source as a new component.', 'jigma-bricks' ),
				'code'             => 'jigma_component_parent_missing',
				'allowInsertAsNew' => true,
			),
			409
		);
	}

	$class_warnings = array();
	$class_merge    = jigma_bricks_merge_global_classes_for_component_update(
		$payload['globalClasses'],
		$current_classes,
		$old_component_elements,
		$current_content,
		$old_all_ids,
		$class_warnings
	);

	if ( ! empty( $class_merge['conflicts'] ) ) {
		wp_send_json_error(
			array(
				'message'   => __( 'Jigma found Bricks class-name conflicts. No content was updated.', 'jigma-bricks' ),
				'code'      => 'jigma_global_class_conflict',
				'conflicts' => $class_merge['conflicts'],
			),
			409
		);
	}

	$incoming_content = array_slice( $payload['content'], 0, 250 );
	$new_elements     = jigma_bricks_normalize_elements_for_insert(
		$incoming_content,
		$content_without_old,
		$include_js_code,
		$class_merge['idMap'],
		$parent_id
	);
	$class_warnings   = array_merge(
		$class_warnings,
		jigma_bricks_validate_global_class_references( $new_elements, $class_merge['classes'] )
	);

	if ( ! empty( $class_warnings ) ) {
		wp_send_json_error(
			array(
				'message' => __( 'Jigma found invalid Bricks class references. No content was updated.', 'jigma-bricks' ),
				'code'    => 'jigma_invalid_class_references',
				'errors'  => $class_warnings,
			),
			400
		);
	}

	if ( empty( $new_elements ) ) {
		wp_send_json_error(
			array( 'message' => __( 'No insertable Bricks elements were generated for this update.', 'jigma-bricks' ) ),
			400
		);
	}

	$old_elements_indexed = jigma_bricks_index_content_by_id( $current_content );
	$new_elements         = apply_filters(
		'bricks/security_check_before_save/new_elements',
		$new_elements,
		$old_elements_indexed
	);

	if ( ! is_array( $new_elements ) ) {
		wp_send_json_error(
			array( 'message' => __( 'Bricks rejected the regenerated element payload.', 'jigma-bricks' ) ),
			400
		);
	}

	$post_filter_class_errors = jigma_bricks_validate_global_class_references( $new_elements, $class_merge['classes'] );
	if ( ! empty( $post_filter_class_errors ) ) {
		wp_send_json_error(
			array(
				'message' => __( 'Bricks security filtering left invalid class references. No content was updated.', 'jigma-bricks' ),
				'code'    => 'jigma_filtered_invalid_class_references',
				'errors'  => $post_filter_class_errors,
			),
			400
		);
	}

	$updated_root_ids = array_values(
		array_filter(
			array_map(
				static function ( $element ) use ( $parent_id ) {
					if ( ! is_array( $element ) || (string) ( $element['parent'] ?? '' ) !== $parent_id ) {
						return null;
					}
					return isset( $element['id'] ) ? (string) $element['id'] : null;
				},
				$new_elements
			)
		)
	);

	if ( empty( $updated_root_ids ) ) {
		wp_send_json_error(
			array(
				'message' => __( 'No regenerated component root remained under the original parent after Bricks validation. No content was updated.', 'jigma-bricks' ),
				'code'    => 'jigma_no_component_roots',
			),
			400
		);
	}

	if ( ! empty( $class_merge['classes'] ) ) {
		update_option( jigma_bricks_get_global_classes_option_name(), $class_merge['classes'], false );
	}

	$content_without_old[ $parent_index_after ]['children'] = jigma_bricks_replace_child_sequence(
		$old_parent_children,
		$old_root_ids,
		$updated_root_ids
	);

	$updated_content = array_values( array_merge( $content_without_old, $new_elements ) );
	$page_styles_css = isset( $_POST['pageStylesCss'] ) ? trim( (string) wp_unslash( $_POST['pageStylesCss'] ) ) : '';
	$page_styles     = jigma_bricks_apply_page_styles( $updated_content, $page_styles_css );
	$updated_content = $page_styles['content'];
	$all_element_ids = array_values(
		array_filter(
			array_map(
				static function ( $element ) {
					return is_array( $element ) && isset( $element['id'] ) ? (string) $element['id'] : null;
				},
				$new_elements
			)
		)
	);
	$component_record = jigma_bricks_make_component_record(
		$component_id,
		$source,
		$payload,
		$parent_id,
		$updated_root_ids,
		$all_element_ids,
		$new_elements,
		(string) ( $component['createdAt'] ?? '' )
	);
	$components[ $component_index ] = $component_record;

	update_post_meta( $post_id, jigma_bricks_get_content_meta_key(), $updated_content );
	jigma_bricks_save_components_registry( $post_id, $components );
	update_post_meta( $post_id, '_bricks_editor_mode', 'bricks' );
	$css_regenerated = jigma_bricks_request_css_regeneration( $post_id );
	clean_post_cache( $post_id );

	wp_send_json_success(
		array(
			'message'       => __( 'Jigma component updated. Reload the Bricks builder to show the refreshed canvas.', 'jigma-bricks' ),
			'updatedCount'  => count( $new_elements ),
			'componentId'   => $component_id,
			'component'     => $component_record,
			'components'    => jigma_bricks_summarize_components( $components ),
			'parentElementId' => $parent_id,
			'updatedRootIds' => $updated_root_ids,
			'removedElementIds' => $old_all_ids,
			'globalClasses' => count( $class_merge['classes'] ),
			'globalElements' => count( $payload['globalElements'] ),
			'pageStyles'    => array(
				'created' => (bool) $page_styles['created'],
				'updated' => (bool) $page_styles['updated'],
			),
			'compatibilitySchemaVersion' => JIGMA_BRICKS_COMPATIBILITY_SCHEMA_VERSION,
			'classWarnings' => $class_warnings,
			'codeWarnings'  => $code_warnings,
			'totalCount'    => count( $updated_content ),
			'metaKey'       => jigma_bricks_get_content_meta_key(),
			'contentHash'   => jigma_bricks_content_hash( $updated_content ),
			'contentSummary' => jigma_bricks_summarize_content( $updated_content ),
			'cssRegenerated' => $css_regenerated,
			'reloadNeeded'  => true,
		)
	);
}
add_action( 'wp_ajax_jigma_bricks_update_component', 'jigma_bricks_update_component' );

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
