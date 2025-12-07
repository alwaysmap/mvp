/**
 * Type declarations for topojson-client module
 * This provides type safety for the topojson-client library
 */

declare module 'topojson-client' {
	import { Topology, GeometryCollection } from 'topojson-specification';
	import { GeoJSON } from 'geojson';

	export function feature<T extends GeometryCollection>(
		topology: Topology,
		object: T
	): GeoJSON.FeatureCollection | GeoJSON.Feature;

	export function mesh(
		topology: Topology,
		object?: GeometryCollection,
		filter?: (a: any, b: any) => boolean
	): GeoJSON.MultiLineString;

	export function merge(topology: Topology, objects: GeometryCollection[]): GeoJSON.MultiPolygon;
}
