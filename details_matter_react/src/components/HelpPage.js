import React from 'react';

const HelpPage = ({ onClose }) => {
    return (
        <div className="help-page">
            <div className="help-page__overlay" onClick={onClose}></div>
            <div className="help-page__content">
                <button className="help-page__close" onClick={onClose}>✕</button>

                <h1 className="help-page__title">📜 About Only Details Matter</h1>

                <section className="help-page__section">
                    <h2>🎨 The Concept</h2>
                    <p>
                        <strong>Only Details Matter</strong> is an AI-powered creative experiment that explores
                        the evolution of visual narratives through iterative detail discovery.
                    </p>
                    <p>
                        You provide an initial spark—a prompt or image—and watch as the AI creates a chain
                        of images, each one picking a subtle detail from the previous image and weaving it
                        into an entirely new scene. It's like a visual game of telephone, where meaning
                        transforms through the lens of the machine's creative obsession.
                    </p>
                    <p>
                        🔬 <strong>Research Study:</strong> This project is also a study to understand how
                        generative models focus on details, select them, and use them across iterations.
                        If you're interested in accessing the public data for research purposes,
                        reach out on Twitter{' '}
                        <a href="https://twitter.com/mandubian" target="_blank" rel="noopener noreferrer">@mandubian</a>.
                    </p>
                </section>

                <section className="help-page__section">
                    <h2>⚙️ How It Works</h2>
                    <ol>
                        <li><strong>Begin:</strong> Enter a text prompt or upload an image to start your evolution</li>
                        <li><strong>Generate:</strong> The AI analyzes the image, picks an interesting detail, and creates a new scene featuring that detail</li>
                        <li><strong>Evolve:</strong> Each turn, a new detail is discovered and transformed into a fresh narrative</li>
                        <li><strong>Fork:</strong> Branch off at any turn to explore alternative evolutions</li>
                        <li><strong>Publish:</strong> Share your threads to the public Exhibition for others to explore and fork</li>
                    </ol>
                </section>

                <section className="help-page__section">
                    <h2>🔐 Privacy & API Keys</h2>
                    <div className="help-page__privacy-box">
                        <p>
                            <strong>Your API key stays with you.</strong> API keys are stored only in your
                            browser's local storage and are never transmitted to our servers. They are sent
                            directly from your browser to Google's API endpoints.
                        </p>
                        <p>
                            Get your free Gemini API key at{' '}
                            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">
                                Google AI Studio
                            </a>
                        </p>
                    </div>
                </section>

                <section className="help-page__section">
                    <h2>📚 Features</h2>
                    <ul>
                        <li><strong>Local Gallery:</strong> Your threads are auto-saved to your browser</li>
                        <li><strong>Cloud Exhibition:</strong> Publish and discover public threads</li>
                        <li><strong>Forking:</strong> Create your own branches from any thread or turn</li>
                        <li><strong>Genealogy Tree:</strong> Visualize the evolution lineage of your threads</li>
                        <li><strong>Search:</strong> Find threads by content or style</li>
                        <li><strong>Multiple Styles:</strong> Choose from various artistic styles</li>
                    </ul>
                </section>

                <section className="help-page__section">
                    <h2>🌐 Open Source</h2>
                    <p>
                        This project is open source. View the code, report issues, or contribute on GitHub:
                    </p>
                    <a
                        href="https://github.com/mandubian/details_matter"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="help-page__github-link"
                    >
                        <svg height="20" width="20" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                        </svg>
                        mandubian/details_matter
                    </a>
                </section>

                <section className="help-page__section help-page__credits">
                    <p>
                        Built with ❤️ using React and Google Gemini AI
                    </p>
                    <p style={{ marginTop: '15px', fontSize: '0.9rem' }}>
                        💡 If you have Google AI API credits to share (so users don't need their own keys),
                        feel free to reach out on Twitter:{' '}
                        <a href="https://twitter.com/mandubian" target="_blank" rel="noopener noreferrer">
                            @mandubian
                        </a>
                    </p>
                    <p style={{ marginTop: '10px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        ⚠️ This app is hosted on Cloudflare's free tier, so it may reach quota limits during high usage.
                    </p>
                </section>
            </div>
        </div>
    );
};

export default HelpPage;
