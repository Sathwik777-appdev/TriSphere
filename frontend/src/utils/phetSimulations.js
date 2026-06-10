export const SIMULATIONS = {
  Physics: [
    { type: 'phet', slug: 'circuit-construction-kit-dc', label: "Circuit Construction Kit: DC" },
    { type: 'phet', slug: 'forces-and-motion-basics', label: "Forces and Motion: Basics" },
    { type: 'phet', slug: 'gravity-and-orbits', label: "Gravity and Orbits" },
    { type: 'phet', slug: 'projectile-motion', label: "Projectile Motion" },
    { type: 'phet', slug: 'pendulum-lab', label: "Pendulum Lab" },
    { type: 'phet', slug: 'wave-on-a-string', label: "Wave on a String" },
    { type: 'phet', slug: 'ohms-law', label: "Ohm's Law" },
    { type: 'phet', slug: 'bending-light', label: "Bending Light" },
    { type: 'phet', slug: 'energy-skate-park-basics', label: "Energy Skate Park Basics" },
    { type: 'phet', slug: 'collision-lab', label: "Collision Lab" },
    { type: 'phet', slug: 'capacitor-lab-basics', label: "Capacitor Lab Basics" }
  ],
  Chemistry: [
    { type: 'phet', slug: 'balancing-chemical-equations', label: "Balancing Chemical Equations" },
    { type: 'phet', slug: 'reactants-products-reversible', label: "Reactants, Products and Leftovers" },
    { type: 'phet', slug: 'ph-scale', label: "pH Scale" },
    { type: 'phet', slug: 'states-of-matter-basics', label: "States of Matter: Basics" },
    { type: 'phet', slug: 'molecular-shapes', label: "Molecular Shapes" },
    { type: 'phet', slug: 'concentration', label: "Concentration" },
    { type: 'phet', slug: 'density', label: "Density" },
    { type: 'phet', slug: 'gas-properties', label: "Gas Properties" },
    { type: 'phet', slug: 'acid-base-solutions', label: "Acid-Base Solutions" },
    { type: 'phet', slug: 'atomic-interactions', label: "Atomic Interactions" },
    { type: 'phet', slug: 'build-an-atom', label: "Build an Atom" }
  ],
  Biology: [
    { type: 'phet', slug: 'natural-selection', label: "Natural Selection" },
    { type: 'phet', slug: 'membrane-channels', label: "Membrane Channels" },
    { type: 'phet', slug: 'neuron', label: "Neuron" },
    { type: 'phet', slug: 'gene-expression-essentials', label: "Gene Expression: Essentials" },
    { type: 'phet', slug: 'enzyme-kinetics', label: "Enzyme Kinetics" },
    { type: 'phet', slug: 'photosynthesis', label: "Photosynthesis" }
  ],
  Mathematics: [
    { type: 'geogebra', slug: 'vd674zrn', label: "Trigonometric Functions" },
    { type: 'geogebra', slug: 'm94m23vz', label: "Pythagorean Theorem Demonstration" },
    { type: 'geogebra', slug: 'wwzq7yd8', label: "Quadratic Equations Explorer" },
    { type: 'geogebra', slug: 'cgdcrscz', label: "Linear Equations & Slope" },
    { type: 'geogebra', slug: '3d', label: "GeoGebra 3D Grapher" },
    { type: 'geogebra', slug: 'geometry', label: "GeoGebra Geometry Classic" },
    { type: 'geogebra', slug: 'graphing', label: "GeoGebra Graphing Calculator" }
  ]
};

export const getEmbedUrl = (type, slug, height = 600) => {
  if (!slug) return '';
  if (type === 'geogebra') {
    if (['3d', 'geometry', 'graphing', 'classic'].includes(slug)) {
      return `https://www.geogebra.org/${slug}`;
    }
    return `https://www.geogebra.org/material/iframe/id/${slug}/width/900/height/${height}/border/none/rc/false/ai/true/sdz/true/sfsb/true/smb/false/stb/true/stbh/false/ld/false/sri/true/allowUpscale/true`;
  } else {
    // phet
    return `https://phet.colorado.edu/sims/html/${slug}/latest/${slug}_en.html`;
  }
};
