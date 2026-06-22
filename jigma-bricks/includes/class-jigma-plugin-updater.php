<?php
/**
 * First-party Jigma plugin update adapter.
 *
 * @package Jigma_Bricks
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'Jigma_Bricks_Plugin_Updater' ) ) {
	/**
	 * Connects WordPress' third-party Update URI flow to jigma.co.uk releases.
	 */
	final class Jigma_Bricks_Plugin_Updater {
		private const SLUG           = 'jigma-bricks';
		private const UPDATE_ID      = 'https://jigma.co.uk/jigma-bricks';
		private const UPDATE_HOST    = 'jigma.co.uk';
		private const METADATA_URL   = 'https://jigma.co.uk/releases/jigma-bricks/latest.json';
		private const TRANSIENT_KEY  = 'jigma_bricks_update_metadata';
		private const CACHE_TTL      = 21600;

		/**
		 * Main plugin file path.
		 *
		 * @var string
		 */
		private $plugin_file;

		/**
		 * Plugin basename used by WordPress update APIs.
		 *
		 * @var string
		 */
		private $plugin_basename;

		/**
		 * Installed plugin version.
		 *
		 * @var string
		 */
		private $local_version;

		/**
		 * Register update hooks.
		 *
		 * @param string $plugin_file   Main plugin file path.
		 * @param string $local_version Installed plugin version.
		 */
		public static function register( string $plugin_file, string $local_version ): void {
			$instance = new self( $plugin_file, $local_version );
			$instance->hooks();
		}

		private function __construct( string $plugin_file, string $local_version ) {
			$this->plugin_file     = $plugin_file;
			$this->plugin_basename = plugin_basename( $plugin_file );
			$this->local_version   = $local_version;
		}

		private function hooks(): void {
			add_filter( 'update_plugins_jigma.co.uk', array( $this, 'check_for_update' ), 10, 4 );
			add_filter( 'plugins_api', array( $this, 'plugin_information' ), 20, 3 );
		}

		/**
		 * Filter WordPress' Update URI result.
		 *
		 * @param false|array|object $update      Existing update response.
		 * @param array             $plugin_data Plugin header data.
		 * @param string            $plugin_file Plugin basename.
		 * @param array             $locales     Requested locales.
		 * @return false|array|object
		 */
		public function check_for_update( $update, $plugin_data, $plugin_file, $locales = array() ) {
			unset( $plugin_data, $locales );

			if ( $plugin_file !== $this->plugin_basename ) {
				return $update;
			}

			$metadata = $this->get_release_metadata();
			if ( ! $metadata || ! version_compare( $metadata['version'], $this->local_version, '>' ) ) {
				return false;
			}

			return (object) array(
				'id'           => self::UPDATE_ID,
				'slug'         => self::SLUG,
				'plugin'       => $this->plugin_basename,
				'new_version'  => $metadata['version'],
				'version'      => $metadata['version'],
				'url'          => $metadata['homepage'],
				'package'      => $metadata['download_url'],
				'tested'       => $metadata['tested'],
				'requires'     => $metadata['requires'],
				'requires_php' => $metadata['requires_php'],
			);
		}

		/**
		 * Provide the Plugins screen "View details" modal.
		 *
		 * @param false|object|array $result Existing result.
		 * @param string             $action Plugin API action.
		 * @param object             $args   Plugin API arguments.
		 * @return false|object|array
		 */
		public function plugin_information( $result, string $action, $args ) {
			if ( 'plugin_information' !== $action || ! is_object( $args ) || empty( $args->slug ) || self::SLUG !== $args->slug ) {
				return $result;
			}

			$metadata = $this->get_release_metadata();
			if ( ! $metadata ) {
				return $result;
			}

			return (object) array(
				'name'          => $metadata['name'],
				'slug'          => self::SLUG,
				'version'       => $metadata['version'],
				'author'        => 'Jigma',
				'homepage'      => $metadata['homepage'],
				'requires'      => $metadata['requires'],
				'requires_php'  => $metadata['requires_php'],
				'tested'        => $metadata['tested'],
				'download_link' => $metadata['download_url'],
				'sections'      => array(
					'description' => __( 'Jigma Bricks converts HTML, CSS, and optional JavaScript into Bricks-compatible structures.', 'jigma-bricks' ),
					'changelog'   => $metadata['changelog'] ? wp_kses_post( $metadata['changelog'] ) : __( 'No changelog was provided for this release.', 'jigma-bricks' ),
				),
			);
		}

		/**
		 * Fetch and validate release metadata.
		 *
		 * @return array<string,string>|null
		 */
		private function get_release_metadata(): ?array {
			$cached = get_site_transient( self::TRANSIENT_KEY );
			if ( is_array( $cached ) ) {
				$validated = self::validate_release_metadata( $cached );
				if ( $validated ) {
					return $validated;
				}
			}

			$response = wp_remote_get(
				self::METADATA_URL,
				array(
					'timeout'     => 8,
					'redirection' => 2,
					'headers'     => array(
						'Accept' => 'application/json',
					),
				)
			);

			if ( is_wp_error( $response ) ) {
				return null;
			}

			$status = (int) wp_remote_retrieve_response_code( $response );
			if ( 200 !== $status ) {
				return null;
			}

			$body = wp_remote_retrieve_body( $response );
			if ( ! is_string( $body ) || '' === trim( $body ) ) {
				return null;
			}

			$decoded = json_decode( $body, true );
			$metadata = self::validate_release_metadata( $decoded );
			if ( ! $metadata ) {
				return null;
			}

			set_site_transient( self::TRANSIENT_KEY, $metadata, self::CACHE_TTL );
			return $metadata;
		}

		/**
		 * Validate latest.json shape and package URL safety.
		 *
		 * @param mixed $metadata Decoded release metadata.
		 * @return array<string,string>|null
		 */
		public static function validate_release_metadata( $metadata ): ?array {
			if ( ! is_array( $metadata ) ) {
				return null;
			}

			$name         = self::clean_string( $metadata['name'] ?? '' );
			$slug         = sanitize_key( self::clean_string( $metadata['slug'] ?? '' ) );
			$version      = self::clean_string( $metadata['version'] ?? '' );
			$download_url = esc_url_raw( self::clean_string( $metadata['download_url'] ?? '' ) );
			$homepage     = esc_url_raw( self::clean_string( $metadata['homepage'] ?? 'https://jigma.co.uk/' ) );

			if ( '' === $name || self::SLUG !== $slug || ! self::is_valid_version( $version ) || ! self::is_allowed_package_url( $download_url ) ) {
				return null;
			}

			return array(
				'name'         => $name,
				'slug'         => self::SLUG,
				'version'      => $version,
				'download_url' => $download_url,
				'homepage'     => $homepage ? $homepage : 'https://jigma.co.uk/',
				'requires'     => self::clean_string( $metadata['requires'] ?? '6.4' ),
				'requires_php' => self::clean_string( $metadata['requires_php'] ?? '7.4' ),
				'tested'       => self::clean_string( $metadata['tested'] ?? '' ),
				'sha256'       => self::clean_sha256( $metadata['sha256'] ?? '' ),
				'changelog'    => is_scalar( $metadata['changelog'] ?? '' ) ? (string) $metadata['changelog'] : '',
			);
		}

		private static function is_allowed_package_url( string $url ): bool {
			$scheme = wp_parse_url( $url, PHP_URL_SCHEME );
			$host   = wp_parse_url( $url, PHP_URL_HOST );

			return 'https' === $scheme && self::UPDATE_HOST === strtolower( (string) $host );
		}

		private static function is_valid_version( string $version ): bool {
			return 1 === preg_match( '/^\d+(?:\.\d+){1,3}(?:[-+][A-Za-z0-9][A-Za-z0-9._-]*)?$/', $version );
		}

		private static function clean_string( $value ): string {
			if ( ! is_scalar( $value ) ) {
				return '';
			}

			return sanitize_text_field( (string) $value );
		}

		private static function clean_sha256( $value ): string {
			$value = self::clean_string( $value );
			return '' === $value || 1 === preg_match( '/^[a-f0-9]{64}$/i', $value ) ? strtolower( $value ) : '';
		}
	}
}
