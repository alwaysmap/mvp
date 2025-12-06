<script lang="ts">
	// Landing page for AlwaysMap
</script>

<svelte:head>
	<title>AlwaysMap - Turn Your Family's Journey Into Art</title>
</svelte:head>

<div class="hero">
	<div class="container">
		<h1>AlwaysMap</h1>
		<p class="tagline">Turn your family's journey into beautiful wall art</p>
		<p class="description">
			Create stunning, print-ready maps that visualize your family's migration across the globe.
			Perfect for gifts, family gatherings, or documenting your heritage.
		</p>
		<a href="/create-map" class="cta-button">Create Your Map</a>
	</div>
</div>

<div class="features">
	<div class="container">
		<h2>How It Works</h2>
		<div class="feature-grid">
			<div class="feature">
				<div class="feature-icon">🗺️</div>
				<h3>Add Locations</h3>
				<p>Track your family's movements across countries and continents over time</p>
			</div>
			<div class="feature">
				<div class="feature-icon">🎨</div>
				<h3>Customize Design</h3>
				<p>Choose colors, add titles, and personalize your map to tell your story</p>
			</div>
			<div class="feature">
				<div class="feature-icon">🖼️</div>
				<h3>Print & Frame</h3>
				<p>Order high-quality prints delivered to your door, ready to hang</p>
			</div>
		</div>
	</div>
</div>

<div class="tech-specs">
	<div class="container">
		<h2>Museum-Quality Prints</h2>
		<ul>
			<li><strong>300 DPI</strong> resolution for crisp detail</li>
			<li><strong>Multiple sizes</strong> available (12×16", 18×24", 24×36")</li>
			<li><strong>sRGB color profile</strong> for accurate reproduction</li>
			<li><strong>Premium paper</strong> with archival quality</li>
		</ul>
	</div>
</div>

<footer>
	<div class="container">
		<p>AlwaysMap POC - Phase 1 Complete</p>
		<p class="tech-note">Built with SvelteKit 5, D3.js, and Printful API</p>
	</div>
</footer>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		font-family: 'DM Sans', sans-serif;
		color: #1a1a1a;
	}

	.container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 0 2rem;
	}

	/* Hero Section */
	.hero {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		padding: 6rem 2rem;
		text-align: center;
	}

	h1 {
		font-family: 'Cormorant Garamond', serif;
		font-size: 4rem;
		font-weight: 700;
		margin: 0 0 1rem 0;
	}

	.tagline {
		font-size: 1.5rem;
		font-weight: 500;
		margin: 0 0 1rem 0;
		opacity: 0.95;
	}

	.description {
		font-size: 1.1rem;
		max-width: 600px;
		margin: 0 auto 2rem auto;
		opacity: 0.9;
		line-height: 1.6;
	}

	.cta-button {
		display: inline-block;
		background: white;
		color: #667eea;
		padding: 1rem 2.5rem;
		border-radius: 50px;
		text-decoration: none;
		font-weight: 600;
		font-size: 1.1rem;
		transition: all 0.3s ease;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	}

	.cta-button:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
	}

	/* Features Section */
	.features {
		padding: 4rem 2rem;
		background: white;
	}

	.features h2 {
		font-family: 'Cormorant Garamond', serif;
		font-size: 2.5rem;
		text-align: center;
		margin-bottom: 3rem;
		color: #1a1a1a;
	}

	.feature-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 2rem;
	}

	.feature {
		text-align: center;
		padding: 2rem;
	}

	.feature-icon {
		font-size: 3rem;
		margin-bottom: 1rem;
	}

	.feature h3 {
		font-family: 'Cormorant Garamond', serif;
		font-size: 1.5rem;
		margin-bottom: 0.5rem;
	}

	.feature p {
		color: #666;
		line-height: 1.6;
	}

	/* Tech Specs Section */
	.tech-specs {
		padding: 4rem 2rem;
		background: #f8f9fa;
	}

	.tech-specs h2 {
		font-family: 'Cormorant Garamond', serif;
		font-size: 2.5rem;
		text-align: center;
		margin-bottom: 2rem;
	}

	.tech-specs ul {
		list-style: none;
		padding: 0;
		max-width: 600px;
		margin: 0 auto;
	}

	.tech-specs li {
		padding: 1rem;
		background: white;
		margin-bottom: 0.5rem;
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
	}

	.tech-specs strong {
		color: #667eea;
		font-weight: 600;
	}

	/* Footer */
	footer {
		padding: 3rem 2rem;
		background: #1a1a1a;
		color: white;
		text-align: center;
	}

	footer p {
		margin: 0.5rem 0;
	}

	.tech-note {
		font-size: 0.9rem;
		opacity: 0.7;
	}
</style>
