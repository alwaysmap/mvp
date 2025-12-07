/**
 * Type declarations for d3-geo-projection module
 * This provides type safety for the d3-geo-projection library
 */

declare module 'd3-geo-projection' {
	import { GeoProjection } from 'd3-geo';

	export function geoRobinson(): GeoProjection;
	export function geoNaturalEarth1(): GeoProjection;
	// Add other projections as needed
}
