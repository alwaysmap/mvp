-- AlwaysMap MVP Database Schema
-- Minimal structure: only model the 1:M relationship explicitly
-- Everything else in JSONB for maximum iteration flexibility

-- User Maps table (core map data)
CREATE TABLE user_maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Everything stored as JSONB for iteration flexibility
  -- Structure: { title, subtitle, people[], projection, rotation, zoom, pan, style, ... }
  data JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create GIN index for JSONB queries (e.g., searching by title)
CREATE INDEX idx_user_maps_data ON user_maps USING GIN (data);

-- Printable Maps table (1:M with user_maps)
CREATE TABLE printable_maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign key (only explicit relationship in schema)
  user_map_id UUID NOT NULL REFERENCES user_maps(id) ON DELETE CASCADE,

  -- Print config as JSONB
  -- Structure: { pageSize, orientation, style, showBoundary, ... }
  data JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for 1:M lookups
CREATE INDEX idx_printable_maps_user_map ON printable_maps(user_map_id);

-- Updated timestamp trigger for user_maps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_maps_updated_at
  BEFORE UPDATE ON user_maps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Insert sample data for MVP testing
INSERT INTO user_maps (data) VALUES (
  '{
    "title": "Our Family Journey",
    "subtitle": "2010-2024",
    "projection": "orthographic",
    "rotation": [-20, -30, 0],
    "zoom": 1.0,
    "pan": [0, 0],
    "style": "vintage",
    "people": [
      {
        "id": "alice",
        "name": "Alice",
        "color": "#e74c3c",
        "locations": [
          {"id": "1", "name": "New York", "latitude": 40.7128, "longitude": -74.0060, "type": "birth"},
          {"id": "2", "name": "London", "latitude": 51.5074, "longitude": -0.1278, "type": "transit"},
          {"id": "3", "name": "Tokyo", "latitude": 35.6762, "longitude": 139.6503, "type": "arrival"}
        ]
      },
      {
        "id": "bob",
        "name": "Bob",
        "color": "#3498db",
        "locations": [
          {"id": "4", "name": "Toronto", "latitude": 43.6532, "longitude": -79.3832, "type": "birth"},
          {"id": "5", "name": "Paris", "latitude": 48.8566, "longitude": 2.3522, "type": "transit"},
          {"id": "6", "name": "Sydney", "latitude": -33.8688, "longitude": 151.2093, "type": "arrival"}
        ]
      }
    ]
  }'::jsonb
);

COMMENT ON TABLE user_maps IS 'Core map data - all fields in JSONB for iteration flexibility';
COMMENT ON TABLE printable_maps IS 'Print configurations - 1:M relationship with user_maps';
COMMENT ON COLUMN user_maps.data IS 'Map content: title, subtitle, people, projection, zoom, style, etc.';
COMMENT ON COLUMN printable_maps.data IS 'Print settings: pageSize, orientation, style, showBoundary, etc.';
