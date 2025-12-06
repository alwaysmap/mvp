# Design Risks & Open Questions

## Critical: $180 Print Quality & WYSIWYG Reproduction

These are the areas most likely to cause customer disappointment if the print doesn't match their screen preview.

---

## 🔴 HIGH RISK: Font Rendering Consistency (CLARIFIED)

### The Real Issue

**All text is SVG `<text>` elements** - this is not a problem, it's the correct approach:
- Map title (user input) → SVG `<text>`
- Country labels → SVG `<text>`
- Location annotations ("Alice Waters, 1903") → SVG `<text>`
- QR code is paths (not text)

**The actual risk**: Browser preview vs Puppeteer export might render SVG `<text>` differently.

### Why This Might Happen

**1. Font loading verification**
- Browser: Fonts load via CSS `@font-face`, verified with `document.fonts.check()`
- Puppeteer: Same fonts, same verification
- **Risk**: Timing - what if Puppeteer screenshots before fonts fully load?
- **Mitigation**: Our current code already waits for fonts (✅ should work)

**2. SVG text rendering engine differences**
- User previews in Safari/Firefox/Chrome on their machine
- Puppeteer uses specific Chrome version for screenshot
- Different browsers render SVG `<text>` slightly differently (letter-spacing, kerning)
- **Risk**: Preview in Safari, export in Puppeteer Chrome → looks different
- **Mitigation**: Accept minor differences OR tell users to preview in Chrome

**3. Subpixel rendering**
- Screen: 96 DPI with subpixel antialiasing (looks crisp)
- Export: 300 DPI, then printed (no subpixel rendering)
- **Risk**: Text looks "different" but not wrong
- **Mitigation**: This is expected, not a bug

### Revised Understanding

**User's concern was**: "Can I type text in a form and have it show up correctly in D3/Svelte SVG?"

**Answer**: Yes, absolutely:
```svelte
<script>
  let userTitle = $state("Our Family Journey");
</script>

<svg>
  <text x="100" y="50" font-family="Cormorant Garamond">
    {userTitle}
  </text>
</svg>
```

This works perfectly. D3 and Svelte both produce SVG `<text>` elements. No conversion needed.

### Real Open Questions

❓ **Q1 (REVISED)**: Should we require Chrome for preview?
- **Option A**: Support all browsers, accept minor rendering differences
- **Option B**: Show warning: "For best accuracy, preview in Chrome"
- **Recommendation**: Option A - differences will be negligible

❓ **Q2 (REVISED)**: Font loading verification sufficient?
- Current: Wait for `document.fonts.check()` to return true
- Add: Extra 2-second wait after fonts load (already doing this)
- **Recommendation**: Current approach is solid

❓ **Q3 (REVISED)**: How to test font rendering consistency?
```typescript
test('fonts render identically in preview and export', async ({ page }) => {
  // Render in browser
  await page.goto('/configure-print');
  const previewText = await page.locator('text[class="title"]').textContent();

  // Render in Puppeteer
  await page.goto('/render?data=...');
  await page.waitForFunction(() => window.__RENDER_READY__);
  const exportText = await page.locator('text[class="title"]').textContent();

  // Text content should match
  expect(previewText).toBe(exportText);

  // Visual regression test (optional)
  await expect(page).toHaveScreenshot('title-block.png');
});
```

### Proposed Solution

**Just use SVG `<text>` elements everywhere** (current approach):
- User input → Svelte bindings → SVG `<text>`
- D3 labels → D3's `text()` → SVG `<text>`
- Font loading verification ensures fonts are ready
- Accept minor browser differences as negligible

**No text-to-path conversion needed** - that was overthinking it.

**Testing strategy**:
1. E2E test verifying text content matches
2. Visual regression test for major UI elements
3. Actual print sample to validate quality

**Recommendation**: Keep current approach, add E2E test for font loading.

---

## 🔴 HIGH RISK: Color Reproduction

### Problem
Colors look different on screen vs. print due to:
- Screen: RGB, backlit, varies by monitor
- Print: CMYK conversion, reflective, paper dependent

### Specific Concerns

**1. sRGB → CMYK conversion**
- We embed sRGB ICC profile (correct)
- But Printful converts sRGB → CMYK for printing
- Some colors can't be represented in CMYK (gamut issue)
- Bright blues, saturated greens often shift

**2. Monitor calibration variance**
- Customer's monitor might not be calibrated
- They see colors differently than we intend
- Print will be accurate to sRGB, but won't match their uncalibrated screen
- This is technically "correct" but customer might be unhappy

**3. Our antique parchment background**
- Current: `#f4ebe1` (light beige)
- Will this look good printed on white paper?
- Should we add texture for print version?

### Open Questions

❓ **Q4**: Should we show a "print preview" mode that simulates CMYK?
- Can we convert sRGB → CMYK in browser to show realistic preview?
- Libraries exist (e.g., colorjs.io) but adds complexity
- Worth the effort for POC?

❓ **Q5**: Do we need a color profile warning?
- "Colors may vary slightly from screen to print"
- Standard disclaimer, but feels unsatisfying
- Better to just accept some variance?

❓ **Q6**: Should background be solid color or printed texture?
- Solid color: cheaper, consistent
- Texture: more "premium" feel, hides slight color variations
- Does Printful support textured backgrounds?

### Proposed Solution

**Phase 1 (POC)**: Accept color variance
- Embed sRGB profile (already doing)
- Use Printful's standard sRGB→CMYK conversion
- Add disclaimer: "Colors optimized for print, may vary slightly from screen"

**Phase 2 (Production)**: CMYK preview
- Convert to CMYK in browser preview
- Show side-by-side: "Screen colors" vs "Print colors"
- Let user see realistic preview

**Recommendation**: Phase 1 for POC, revisit if customers complain.

---

## 🟡 MEDIUM RISK: D3 Projection Precision

### Problem
D3's geographic projections involve heavy math (trigonometry, etc.). Does the same projection code produce pixel-identical results in different environments?

### Specific Concerns

**1. Floating-point precision differences**
- Browser JavaScript engine (V8, SpiderMonkey, etc.)
- Puppeteer's V8 version might differ from user's browser
- Tiny differences in floating-point math could shift paths by pixels

**2. Path rendering differences**
- D3 generates SVG `<path>` elements
- Path data is strings like "M10,10 L20,20 Q30,30 40,40"
- Different SVG renderers might interpret curves slightly differently
- Especially for graticule (lots of curves)

**3. Clipping and anti-aliasing**
- Orthographic projection clips paths at hemisphere edge
- Browser and Puppeteer might clip differently
- Anti-aliasing settings could differ

### Open Questions

❓ **Q7**: Do we need to lock D3 and browser versions?
- Pin exact D3 version (already doing)
- Pin Puppeteer/Chrome version (should we?)
- Warn if user's browser version is too different?

❓ **Q8**: Should we validate projection output?
- Compare browser-generated paths to Puppeteer-generated paths
- String-compare SVG `<path d="...">` attributes
- If different, which one is "correct"?

❓ **Q9**: Tolerance for geometric differences?
- Some pixel-level differences might be inevitable
- What's acceptable? 0.1%, 0.01%, 0.001%?
- How do we measure this?

### Proposed Solution

**Testing approach**:
```typescript
// E2E test: Compare browser vs Puppeteer SVG output
test('projection produces identical paths', async ({ page }) => {
  const mapDef = SAMPLE_MAP;

  // Render in browser
  const browserSVG = await page.evaluate(() => {
    return document.querySelector('#map-svg').outerHTML;
  });

  // Render in Puppeteer
  await page.goto('/render?data=...');
  const puppeteerSVG = await page.evaluate(() => {
    return document.querySelector('#map-svg').outerHTML;
  });

  // Compare path data
  expect(browserSVG).toEqual(puppeteerSVG);
});
```

If differences found:
1. Identify source (D3 version? Browser engine?)
2. Pin versions to eliminate variance
3. Accept minor differences if below threshold

**Recommendation**: Write comparison test, investigate if failures occur.

---

## 🟡 MEDIUM RISK: Layout Calculation Consistency

### Problem
Our layout engine calculates exact pixel positions for furniture. If calculation differs between preview and export, furniture will be misaligned.

### Specific Concerns

**1. JavaScript number precision**
- Layout calculations use floating-point math
- Rounding differences could shift elements by pixels
- Example: `Math.round(5400 / 3)` vs `Math.floor(5400 / 3)`

**2. Font measurement for title block**
- We measure title text to calculate box size
- `measureTitleBlock()` needs to measure text dimensions
- SVG `getBBox()` might return different values in different environments

**3. DPI scaling calculations**
- Converting 18×24" @ 300 DPI → pixels
- Formula: `(inches * 72) * (dpi / 72)`
- Any rounding errors compound

### Open Questions

❓ **Q10**: Should layout calculation be deterministic pure function?
- **Decision**: Start simple - use DOM measurements (`getBBox()`) for now
- User needs ability to tweak map zoom/center/rotation
- Can optimize for purity later if we see inconsistency issues
- **Recommendation**: Pragmatic approach, measure then optimize

❓ **Q11**: How do we validate layout consistency?
- Same input → same output (unit test)
- Browser vs Puppeteer → same LayoutResult
- Serialize LayoutResult, compare JSON?

❓ **Q12**: Rounding strategy?
- Always `Math.round()`? `Math.floor()`? `Math.ceil()`?
- Consistent rounding prevents accumulation errors
- Document the strategy

### Proposed Solution

**Make layout calculation pure and deterministic**:
```typescript
// Pure function - no DOM access
export function calculateLayout(
  style: MapStyle,
  data: UserMapData,
  layout: PageLayout
): LayoutResult {
  // All calculations use same rounding strategy
  const round = Math.round; // Consistent

  // Font dimensions from pre-measured constants
  const titleHeight = TITLE_FONT_HEIGHT[layout.furniture.title.text.length];

  // No getBBox(), no DOM measurements
  // Just math

  return { /* deterministic result */ };
}
```

**Validation**:
- Unit test: same input → identical output (100 times)
- E2E test: browser LayoutResult === Puppeteer LayoutResult

**Recommendation**: Make layout calculation pure, extensively test.

---

## 🟡 MEDIUM RISK: SVG Viewport and Scaling

### Problem
We render SVG at 300 DPI (e.g., 5475×7275px), then scale down for browser preview. CSS transform scaling might introduce rendering artifacts.

### Specific Concerns

**1. CSS transform vs native SVG viewBox**
- Current plan: `svg.style.transform = 'scale(0.15)'`
- Alternative: Use SVG `viewBox` attribute
- Which produces better quality preview?

**2. Scaling artifacts**
- Downscaling by 85% (5475px → 800px viewport)
- Browser resampling might blur or alias
- Preview might not look crisp

**3. Interactive rotation performance**
- Rotating 5475×7275px SVG might be slow
- Especially with versor drag (10 interpolation steps)
- Browser might lag, feeling "janky"

### Open Questions

❓ **Q13**: CSS transform or SVG viewBox for scaling?
- `transform: scale(0.15)` - CSS, might be faster
- `viewBox="0 0 5475 7275" width="800"` - SVG native, might be crisper
- **Decision**: Needs experimentation - try both, measure performance and visual quality
- **Recommendation**: Start with one, A/B test if issues arise

❓ **Q14**: Do we need two SVG sizes?
- Preview: Render at screen resolution (800×1066px)
- Export: Render at print resolution (5475×7275px)
- More work, but better performance

❓ **Q15**: Performance testing with real data?
- 5475×7275px SVG with globe, paths, etc.
- Rotate via drag - is it smooth?
- Test on lower-end devices

### Proposed Solution

**Option A: Single SVG, CSS scaled** (Current plan)
- Render once at 300 DPI
- Scale with CSS transform
- Simpler, guaranteed identical

**Option B: Dual SVG approach**
- Preview: 96 DPI (screen resolution)
- Export: 300 DPI (print resolution)
- Better performance, but must verify identical rendering

**Recommendation**: Start with Option A, measure performance, switch to Option B if too slow.

---

## 🟢 LOW RISK: QR Code Reproduction

### Problem
QR codes must be scannable after printing. Any blur or distortion breaks them.

### Specific Concerns

**1. QR code minimum size**
- Too small → can't scan
- Need sufficient "quiet zone" (border)
- What's minimum size at 300 DPI for reliable scanning?

**2. QR code positioning**
- Must be in safe area (not cut off)
- Layout engine handles this, but need to validate

**3. Error correction level**
- QR codes have error correction levels (L, M, Q, H)
- Higher level = more resilient to damage, but denser pattern
- What level do we use?

### Open Questions

❓ **Q16**: What's the minimum QR code size for print?
- Industry standard: 0.5" × 0.5" minimum
- We're using 1" × 1" (should be fine)
- Test with actual print sample?

❓ **Q17**: Error correction level?
- Current code might not specify
- Recommend Level H (30% error correction)
- Overkill? Or worth the safety?

❓ **Q18**: QR code testing?
- Generate QR → screenshot → decode
- Verify URL matches input
- E2E test with actual QR scanning?

### Proposed Solution

**Best practices**:
- Size: 1" × 1" minimum (300×300px @ 300 DPI)
- Error correction: Level H (highest)
- Position: Always in safe area, never clipped
- Testing: Automated decode verification

**Recommendation**: Follow best practices, low risk area.

---

## 🟢 LOW RISK: Bleed and Safe Area Visualization

### Problem
Customer needs to understand what will be cut (bleed) vs what's safe (safe area).

### Specific Concerns

**1. Bleed visualization clarity**
- Dashed lines for trim/safe might be unclear
- Need visual explanation?

**2. Safe area enforcement**
- Layout engine must keep furniture in safe area
- Validation needed

### Open Questions

❓ **Q19**: How to clearly show bleed vs safe?
- Current: dashed rectangles
- Better: Color-coded overlays?
- Tooltip explanations?

❓ **Q20**: Should we prevent furniture in bleed area?
- Hard constraint: error if furniture outside safe area
- Soft constraint: warning only
- Auto-adjust: move furniture inward

### Proposed Solution

**Visual approach**:
- Light gray overlay for bleed area
- Dashed line for trim
- Inner dashed line for safe area
- Tooltip: "Anything outside this line may be cut off"

**Enforcement**: Hard constraint - error if furniture placed outside safe area.

**Recommendation**: Clear visualization, strict enforcement.

---

## Summary: Risk Mitigation Priorities

### Must Address Before Launch

1. **Font rendering validation** (HIGH)
   - Decision: Text-to-path conversion or strict verification?
   - Testing: Pixel-level comparison

2. **Layout calculation determinism** (MEDIUM)
   - Make pure function
   - Extensive testing

3. **Projection precision testing** (MEDIUM)
   - Browser vs Puppeteer comparison
   - Pin versions if needed

### Can Address Post-Launch

4. **Color CMYK preview** (MEDIUM)
   - Phase 2 enhancement
   - Disclaimer sufficient for POC

5. **Performance optimization** (MEDIUM)
   - Dual SVG approach if needed
   - Measure first

6. **Enhanced bleed visualization** (LOW)
   - Nice-to-have
   - Current approach sufficient

---

## Recommended Next Steps

1. **Create test harness** for WYSIWYG validation
   - Browser screenshot
   - Puppeteer screenshot
   - Pixel-diff comparison
   - Fail if >0.1% difference

2. **Font rendering decision**
   - Test current approach (font loading verification)
   - If issues, switch to text-to-path

3. **Layout calculation hardening**
   - Make pure function
   - Unit test 1000 times with same input
   - Verify identical output

4. **Projection comparison test**
   - E2E test comparing browser vs Puppeteer paths
   - String-compare SVG output
   - Document acceptable variance

5. **Print sample testing**
   - Order actual print from Printful
   - Compare to screen preview
   - Validate colors, sharpness, QR code scannability
   - **This is the ultimate test**

---

## Open for Discussion

Which of these concerns are most important to address first?
What's your risk tolerance for color variance, font differences, etc.?
Should we prioritize pixel-perfect matching or faster iteration?
