#!/bin/bash
set -e

echo "Downloading assets for AlwaysMap POC..."

# Create directories
mkdir -p static/fonts static/data profiles

# Download geographic data from world-atlas
echo "Downloading geographic data..."
curl -L -o static/data/countries-110m.json https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json
curl -L -o static/data/land-110m.json https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json

# Download sRGB ICC profile
echo "Downloading sRGB ICC profile..."
curl -L -o profiles/sRGB2014.icc https://www.color.org/sRGB_IEC61966-2-1_black_scaled.icc

echo "✓ Geographic data downloaded"
echo "✓ ICC profile downloaded"
echo ""

# Download Google Fonts
echo "Downloading Google Fonts..."

# Cormorant Garamond (using gwfh.mranftl.com validated URLs)
curl -L "https://fonts.gstatic.com/s/cormorantgaramond/v21/co3umX5slCNuHLi8bLeY9MK7whWMhyjypVO7abI26QOD_v86KnTOjw.ttf" -o static/fonts/CormorantGaramond-Regular.ttf
curl -L "https://fonts.gstatic.com/s/cormorantgaramond/v21/co3umX5slCNuHLi8bLeY9MK7whWMhyjypVO7abI26QOD_iE9KnTOjw.ttf" -o static/fonts/CormorantGaramond-SemiBold.ttf
curl -L "https://fonts.gstatic.com/s/cormorantgaramond/v21/co3umX5slCNuHLi8bLeY9MK7whWMhyjypVO7abI26QOD_hg9KnTOjw.ttf" -o static/fonts/CormorantGaramond-Bold.ttf
curl -L "https://fonts.gstatic.com/s/cormorantgaramond/v21/co3smX5slCNuHLi8bLeY9MK7whWMhyjYrGFEsdtdc62E6zd58jD-iNM5.ttf" -o static/fonts/CormorantGaramond-Italic.ttf

# DM Sans (using gwfh.mranftl.com validated URLs - v17)
curl -L "https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwAop1RSW3z.ttf" -o static/fonts/DMSans-Regular.ttf
curl -L "https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwAkJxRSW3z.ttf" -o static/fonts/DMSans-Medium.ttf
curl -L "https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwAfJtRSW3z.ttf" -o static/fonts/DMSans-SemiBold.ttf

echo "✓ Fonts downloaded"
echo ""
echo "Setup complete! All assets downloaded."
