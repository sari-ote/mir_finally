import React, { useState } from "react";
import "../styles/theme-tropical.css";

function TropicalDesignDemo() {
  const [selectedFilter, setSelectedFilter] = useState("Beach");

  const destinations = [
    { name: "Nusa Penida", location: "Bali, Indonesia", price: "$299", rating: 4.8 },
    { name: "Haathim Beach", location: "Maldives", price: "$599", rating: 4.9 },
    { name: "Tahiti Beach", location: "French Polynesia", price: "$799", rating: 5.0 },
    { name: "Turquoise Bay", location: "Australia", price: "$399", rating: 4.7 },
  ];

  const filters = ["Beach", "Mountain", "Temple", "City"];

  return (
    <div className="theme-tropical page-shell">
      <div className="page-shell__inner">
        {/* Header */}
        <header className="tropical-header">
          <div>
            <div className="tropical-subtitle">Discover</div>
            <h1 className="tropical-title-main">New Destinations</h1>
          </div>

          {/* Filters */}
          <div className="tropical-filters">
            {filters.map((filter) => (
              <button
                key={filter}
                className={`tropical-pill-filter ${
                  selectedFilter === filter ? "tropical-pill-filter--active" : ""
                }`}
                onClick={() => setSelectedFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </div>
        </header>

        {/* Alerts Section */}
        <section className="tropical-section">
          <h2 className="tropical-section-title">
            <span className="tropical-icon tropical-icon-primary">◉</span> Notifications
          </h2>
          <div className="tropical-alert tropical-alert-info">
            <strong>ℹ New Deal!</strong> Get 20% off on all beach destinations this week.
          </div>
          <div className="tropical-alert tropical-alert-success">
            <strong>✓ Success!</strong> Your booking has been confirmed.
          </div>
          <div className="tropical-alert tropical-alert-warning">
            <strong>⚠ Warning!</strong> Limited availability for this destination.
          </div>
        </section>

        {/* Stats Section */}
        <section className="tropical-section">
          <h2 className="tropical-section-title">
            <span className="tropical-icon tropical-icon-primary">▣</span> Travel Stats
          </h2>
          <div className="tropical-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
            <div className="tropical-stat">
              <div className="tropical-stat-value">
                <span className="tropical-icon tropical-icon-primary" style={{ fontSize: "1.2rem", marginRight: "8px" }}>◈</span>
                1,234
              </div>
              <div className="tropical-stat-label">Destinations</div>
            </div>
            <div className="tropical-stat">
              <div className="tropical-stat-value">
                <span className="tropical-icon tropical-icon-primary" style={{ fontSize: "1.2rem", marginRight: "8px" }}>◉</span>
                5,678
              </div>
              <div className="tropical-stat-label">Travelers</div>
            </div>
            <div className="tropical-stat">
              <div className="tropical-stat-value">
                <span className="tropical-icon tropical-icon-primary" style={{ fontSize: "1.2rem", marginRight: "8px" }}>◊</span>
                98%
              </div>
              <div className="tropical-stat-label">Satisfaction</div>
            </div>
          </div>
        </section>

        <div className="tropical-divider"></div>

        {/* Cards grid (responsive) */}
        <section className="tropical-section">
          <h2 className="tropical-section-title">
            <span className="tropical-icon tropical-icon-primary">◐</span> Popular Destinations
          </h2>
          <main className="tropical-grid">
            {destinations.map((destination, index) => (
              <article key={index} className="tropical-card">
                <div className="tropical-card__image">
                  <div
                    className="tropical-card__image-inner"
                    style={{
                      backgroundImage: "url('https://via.placeholder.com/600x400')",
                    }}
                  />
                </div>
                <div className="tropical-card__body">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: "1.1rem",
                          marginBottom: 4,
                          color: "var(--color-text-main)",
                        }}
                      >
                        {destination.name}
                      </div>
                      <div
                        style={{
                          fontSize: "0.85rem",
                          color: "var(--color-text-secondary)",
                        }}
                      >
                        {destination.location}
                      </div>
                    </div>
                    <span className="tropical-badge tropical-badge-primary">
                      <span className="tropical-icon-star">★</span> {destination.rating}
                    </span>
                  </div>
                  
                  <div style={{ marginBottom: 12, fontSize: "1.25rem", fontWeight: 700, color: "var(--color-primary)" }}>
                    {destination.price}
                    <span style={{ fontSize: "0.9rem", fontWeight: 400, color: "var(--color-text-secondary)" }}>/night</span>
                  </div>

                  <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    <button className="tropical-button-primary" style={{ flex: 1 }}>
                      Book Now
                    </button>
                    <button className="tropical-button-ghost" style={{ padding: "12px" }}>
                      <span className="tropical-icon-heart">♡</span>
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </main>
        </section>

        <div className="tropical-divider"></div>

        {/* Buttons Section */}
        <section className="tropical-section">
          <h2 className="tropical-section-title">
            <span className="tropical-icon tropical-icon-primary">◯</span> Button Styles
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: "400px" }}>
            <button className="tropical-button-primary">Primary Button</button>
            <button className="tropical-button-secondary">Secondary Button</button>
            <button className="tropical-button-ghost">Ghost Button</button>
          </div>
        </section>

        {/* Form Section */}
        <section className="tropical-section">
          <h2 className="tropical-section-title">
            <span className="tropical-icon tropical-icon-primary">◌</span> Contact Form
          </h2>
          <div style={{ maxWidth: "500px" }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 500, color: "var(--color-text-main)" }}>
                Name
              </label>
              <input
                type="text"
                className="tropical-input"
                placeholder="Enter your name"
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 500, color: "var(--color-text-main)" }}>
                Email
              </label>
              <input
                type="email"
                className="tropical-input"
                placeholder="Enter your email"
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 500, color: "var(--color-text-main)" }}>
                Message
              </label>
              <textarea
                className="tropical-input"
                placeholder="Enter your message"
                rows={4}
                style={{ resize: "vertical" }}
              />
            </div>
            <button className="tropical-button-primary">Send Message</button>
          </div>
        </section>

        {/* Badges Section */}
        <section className="tropical-section">
          <h2 className="tropical-section-title">
            <span className="tropical-icon tropical-icon-primary">◍</span> Badges & Tags
          </h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
            <span className="tropical-badge tropical-badge-primary">Primary</span>
            <span className="tropical-badge tropical-badge-success">Success</span>
            <span className="tropical-badge tropical-badge-warning">Warning</span>
            <span className="tropical-badge tropical-badge-error">Error</span>
          </div>
          <div className="tropical-tags">
            <span className="tropical-tag">Beach</span>
            <span className="tropical-tag">Tropical</span>
            <span className="tropical-tag">Adventure</span>
            <span className="tropical-tag">Relaxation</span>
            <span className="tropical-tag">Family Friendly</span>
          </div>
        </section>

        {/* Glass Card Section */}
        <section className="tropical-section">
          <h2 className="tropical-section-title">
            <span className="tropical-icon tropical-icon-primary">◔</span> Glass Card Effect
          </h2>
          <div className="tropical-card-glass" style={{ padding: "24px", maxWidth: "500px" }}>
            <h3 style={{ marginBottom: 12, color: "var(--color-text-main)" }}>Premium Experience</h3>
            <p style={{ color: "var(--color-text-secondary)", marginBottom: 16 }}>
              Enjoy our premium glass card design with backdrop blur effect. Perfect for modern, elegant interfaces.
            </p>
            <button className="tropical-button-primary">Learn More</button>
          </div>
        </section>
      </div>
    </div>
  );
}

export default TropicalDesignDemo;

