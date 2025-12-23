// Style categories for organized browsing
export const STYLE_CATEGORIES = {
    'Classic Art Movements': [
        'Photorealistic', 'Impressionist', 'Expressionist', 'Baroque', 'Renaissance',
        'Rococo', 'Romanticism', 'Fauvism', 'Pointillism', 'Pre-Raphaelite'
    ],
    'Modern Art': [
        'Abstract', 'Minimalist', 'Pop Art', 'Cubist', 'Art Nouveau', 'Art Deco',
        'Dadaist', 'Bauhaus', 'Constructivist', 'Suprematist', 'De Stijl', 'Brutalist'
    ],
    'Digital & Contemporary': [
        'Digital Art', 'Hyperrealistic', 'Low Poly', 'Pixel Art', 'Isometric',
        'Flat Design', 'Glitch Art', 'Vaporwave', 'Synthwave', 'Memphis Design', 'Y2K Aesthetic'
    ],
    'Fantasy & Sci-Fi': [
        'Fantasy', 'Sci-Fi', 'Surreal', 'Cyberpunk', 'Steampunk', 'Retrofuturism',
        'Solarpunk', 'Afrofuturism', 'Dark Fantasy', 'High Fantasy', 'Ethereal',
        'Dreamlike', 'Whimsical', 'Mystical', 'Enchanted', 'Celestial', 'Cosmic', 'Eldritch'
    ],
    'Illustration & Drawing': [
        'Cartoon', 'Comic Book', 'Graphic Novel', 'Storybook', 'Line Art', 'Sketch',
        'Charcoal Drawing', 'Pen and Ink', 'Silhouette', 'Woodcut', 'Linocut', 'Etching'
    ],
    'Painting Techniques': [
        'Watercolor', 'Oil Painting', 'Acrylic', 'Gouache', 'Fresco', 'Tempera',
        'Chinese Ink Wash', 'Encaustic'
    ],
    'Asian & Anime': [
        'Anime', 'Manga', 'Chibi', 'Ukiyo-e'
    ],
    'Cultural & Folk': [
        'Folk Art', 'Tribal', 'Celtic', 'Byzantine', 'Persian Miniature', 'Aztec',
        'Madhubani', 'Aboriginal Dot Art', 'Art Brut'
    ],
    'Dark & Moody': [
        'Gothic', 'Noir', 'Film Noir', 'Vintage', 'Sepia', 'Grunge'
    ],
    'Textures & Materials': [
        'Metallic', 'Glass', 'Crystal', 'Mosaic', 'Stained Glass', 'Marble',
        'Embroidered', 'Knitted', 'Origami', 'Paper Cut', 'Clay'
    ],
    'Light & Color Effects': [
        'Neon', 'Holographic', 'Iridescent', 'Double Exposure', 'Long Exposure',
        'HDR', 'Infrared', 'Cross-processed'
    ],
    'Photography Styles': [
        'Polaroid', 'Lomography', 'Tilt-Shift', 'Cinematic', 'Documentary'
    ]
};

// Flat array of all styles for backward compatibility
export const STYLES = Object.values(STYLE_CATEGORIES).flat();

// Get category for a given style
export const getStyleCategory = (style) => {
    for (const [category, styles] of Object.entries(STYLE_CATEGORIES)) {
        if (styles.includes(style)) {
            return category;
        }
    }
    return null;
};
