<?php
/**
 * Opt-in media importer scaffold for Jigma assets.
 *
 * This class is intentionally not wired into insertion yet. Native insertion
 * remains URL-preserving until import is explicitly enabled and tested.
 *
 * @package Jigma_Bricks
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Jigma_Media_Importer {
	private const REQUEST_TIMEOUT = 10;
	private const MAX_BYTES       = 10485760;

	public function import_url( string $url ) {
		$valid = Jigma_Asset_Security::validate_url( $url );
		if ( is_wp_error( $valid ) ) {
			return $valid;
		}

		return new WP_Error(
			'jigma_asset_import_not_enabled',
			__( 'Jigma media importing is not enabled in this proof of concept.', 'jigma-bricks' ),
			array(
				'url'       => esc_url_raw( $url ),
				'timeout'   => self::REQUEST_TIMEOUT,
				'max_bytes' => self::MAX_BYTES,
			)
		);
	}
}
