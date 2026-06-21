<?php
/**
 * Asset URL security helpers for future opt-in media importing.
 *
 * @package Jigma_Bricks
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Jigma_Asset_Security {
	public const ALLOWED_SCHEMES = array( 'http', 'https' );

	public static function validate_url( string $url ) {
		$url = esc_url_raw( $url );

		if ( '' === $url ) {
			return new WP_Error( 'jigma_asset_empty_url', __( 'Asset URL is empty.', 'jigma-bricks' ) );
		}

		$parts = wp_parse_url( $url );
		if ( ! is_array( $parts ) || empty( $parts['scheme'] ) || empty( $parts['host'] ) ) {
			return new WP_Error( 'jigma_asset_invalid_url', __( 'Asset URL must be absolute before import.', 'jigma-bricks' ) );
		}

		if ( ! in_array( strtolower( (string) $parts['scheme'] ), self::ALLOWED_SCHEMES, true ) ) {
			return new WP_Error( 'jigma_asset_invalid_scheme', __( 'Asset URL scheme is not allowed.', 'jigma-bricks' ) );
		}

		$host = strtolower( (string) $parts['host'] );
		if ( self::is_private_host( $host ) ) {
			return new WP_Error( 'jigma_asset_private_host', __( 'Private or internal asset hosts cannot be imported.', 'jigma-bricks' ) );
		}

		return true;
	}

	private static function is_private_host( string $host ): bool {
		if (
			'localhost' === $host ||
			self::ends_with( $host, '.local' ) ||
			self::ends_with( $host, '.internal' )
		) {
			return true;
		}

		$ip = filter_var( $host, FILTER_VALIDATE_IP );
		if ( false === $ip ) {
			return false;
		}

		return false === filter_var(
			$ip,
			FILTER_VALIDATE_IP,
			FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE
		);
	}

	private static function ends_with( string $value, string $suffix ): bool {
		return substr( $value, -strlen( $suffix ) ) === $suffix;
	}
}
