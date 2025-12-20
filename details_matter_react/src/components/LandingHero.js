import React from 'react';

const LandingHero = ({ onBeginEvolution, onExploreExhibition, onCollapse, isCollapsed }) => {
    return (
        <section className={`rpg-landing-hero ${isCollapsed ? 'is-collapsed' : ''}`}>
            <div className="rpg-landing-hero__overlay"></div>

            {/* Main scrollable/collapsible content */}
            <div className="rpg-landing-hero__inner">
                <button
                    className="rpg-landing-hero__close"
                    onClick={onCollapse}
                    title="Minimize introduction"
                >
                    ❧
                </button>

                {/* Decorative Flourishes */}
                <span className="rpg-landing-hero__flourish-tl">❧</span>
                <span className="rpg-landing-hero__flourish-tr">❧</span>
                <span className="rpg-landing-hero__flourish-bl">❧</span>
                <span className="rpg-landing-hero__flourish-br">❧</span>

                <div className="rpg-landing-hero__content">



                </div>

                <div className="rpg-landing-hero__scroll-indicator" onClick={onExploreExhibition}>
                    <div className="mouse">
                        <div className="wheel"></div>
                    </div>
                    <span className="rpg-landing-hero__scroll-text">Scroll to Explore</span>
                </div>
            </div>
        </section>
    );
};

export default LandingHero;

