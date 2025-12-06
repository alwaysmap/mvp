# CLI Export Tool - Quick Reference

## Installation

After cloning the repository, install dependencies and Chrome:

```bash
pnpm install
npx puppeteer browsers install chrome
```

## Basic Commands

### Export with Sample Data

The simplest way to test the export tool:

```bash
pnpm export --sample output.png
```

This will:
1. Use built-in sample map data
2. Export to `output.png` at 18×24 inches (default)
3. Take approximately 7-8 seconds
4. Produce a ~114KB PNG file at 5475×7275 pixels

### Export from JSON File

Export your own map definition:

```bash
pnpm export data/my-map.json output.png
```

### Specify Print Size

Choose from three standard sizes:

```bash
# 12×16 inches (3675×4875px @ 300 DPI)
pnpm export --sample output.png --size 12x16

# 18×24 inches (5475×7275px @ 300 DPI) - DEFAULT
pnpm export --sample output.png --size 18x24

# 24×36 inches (7275×10875px @ 300 DPI)
pnpm export --sample output.png --size 24x36
```

### Get Help

```bash
pnpm export --help
```

## Map Definition Format

Create a JSON file with this structure:

```json
{
  "title": "Your Map Title",
  "subtitle": "2010-2024",
  "people": [
    {
      "id": "unique-id",
      "name": "Person Name",
      "color": "#FF6B6B",
      "locations": [
        {
          "countryCode": "US",
          "longitude": -74.006,
          "latitude": 40.7128,
          "date": "2010-01-01"
        }
      ]
    }
  ],
  "rotation": [-20, -30, 0]
}
```

See `data/sample-map.json` for a complete example.

## What You Get

Each export produces a print-ready PNG with:

- ✅ Exact dimensions for chosen print size at 300 DPI
- ✅ Embedded sRGB ICC color profile (required by Printful)
- ✅ Maximum quality PNG compression
- ✅ All fonts loaded and verified
- ✅ Validated output

## Common Issues

### "Could not find Chrome"

Install Puppeteer's Chrome:
```bash
npx puppeteer browsers install chrome
```

### Port Already in Use

The tool will automatically try different ports if 5173 is taken.

### Validation Warning: "Unusual bit depth: uchar"

This warning is normal and can be safely ignored.

## Output Validation

The tool automatically validates:

- Dimensions match print specification
- sRGB color space
- ICC profile is embedded
- PNG format

If validation fails, the tool will report specific errors.

## Performance

Typical export times:
- 12×16: ~6.8 seconds
- 18×24: ~7.6 seconds  
- 24×36: ~10-12 seconds (larger file)

## Architecture

The CLI tool:
1. Validates your map definition
2. Starts Vite dev server programmatically
3. Waits for server to be ready (HTTP polling)
4. Launches Puppeteer headless Chrome
5. Renders map at exact pixel dimensions
6. Verifies all fonts loaded
7. Takes full-page screenshot
8. Embeds sRGB ICC profile with Sharp
9. Validates output
10. Stops server (always, even on error)

**No manual server start required!**
