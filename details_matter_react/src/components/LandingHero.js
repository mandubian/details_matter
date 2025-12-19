import React from 'react';

const LandingHero = ({ onBeginEvolution, onExploreExhibition }) => {
    return (
        <section className="rpg-landing-hero">
            <div className="rpg-landing-hero__overlay"></div>

            {/* Decorative Flourishes */}
            <span className="rpg-landing-hero__flourish-tl">❧</span>
            <span className="rpg-landing-hero__flourish-tr">❧</span>
            <span className="rpg-landing-hero__flourish-bl">❧</span>
            <span className="rpg-landing-hero__flourish-br">❧</span>

            <div className="rpg-landing-hero__content">
                <h1 className="rpg-landing-hero__title">Only Details Matter</h1>
                <p className="rpg-landing-hero__tagline">
                    Discovery: The Art of Subtle Creation
                    <span className="rpg-landing-hero__tagline-sub">One Spark. Infinite Echoes.</span>
                </p>

                <div className="rpg-landing-hero__description-box">
                    <p className="rpg-landing-hero__description">
                        Witness the machine's creative obsession. Provide a spark, then watch
                        the model anchor, weaving an autonomous narrative across the evolution
                        of its own discovered details.
                    </p>
                </div>

                <div className="rpg-landing-hero__actions">
                    <button className="rpg-landing-hero__btn primary" onClick={onBeginEvolution}>
                        <span className="icon">📜</span> Begin New Evolution
                    </button>
                </div>
            </div>

            <div className="rpg-landing-hero__scroll-indicator" onClick={onExploreExhibition}>
                <div className="mouse">
                    <div className="wheel"></div>
                </div>
                <span className="rpg-landing-hero__scroll-text">Scroll to Explore</span>
            </div>
        </section>
    );
};

export default LandingHero;
