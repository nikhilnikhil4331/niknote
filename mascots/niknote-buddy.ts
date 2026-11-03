import type { CharacterSpec } from 'wobnimo';

/*
  Niko — NikNote's living notebook buddy.
  Plan: a rounded purple notebook with a page edge, springy magenta bookmark,
  warm-gold corner sparkle, tiny arms and an expressive low-set face. The body
  stands on the floor; only accessories spring. Palette and materials stay
  matte/satin like paper and a soft book cover rather than glossy plastic.
*/
export const niknoteBuddy: CharacterSpec = {
  id: 'niknote-buddy',
  name: 'Niko',
  tagline: 'A little NikNote notebook that saves ideas and celebrates every small win',
  accent: '#CB289D',
  frame: { target: 0.39, radius: 0.6 },
  bound: { y: 0.39, radius: 0.59 },
  motion: { hop: 0.1, squash: 0.85, snap: 1, talkSquash: 0.45 },
  materials: {
    cover: { color: '#8020A2', f0: 0.035, spec: 0.45, shininess: 34, rim: 0.65, sheen: 0.35, gloss: 0.25 },
    spine: { color: '#501090', f0: 0.04, spec: 0.5, shininess: 42, rim: 0.55, sheen: 0.25 },
    bookmark: { color: '#CB289D', f0: 0.045, spec: 0.7, shininess: 65, rim: 0.6, gloss: 0.45 },
    pages: { color: '#F2E7F0', f0: 0.025, spec: 0.25, shininess: 18, rim: 0.35, sss: 0.15, sssColor: '#FFF4FA' },
    pageLine: { color: '#B98FAC', f0: 0.02, spec: 0.2, shininess: 16, rim: 0.25 },
    sparkle: { color: '#E0A040', f0: 0.05, spec: 0.9, shininess: 90, rim: 0.75, gloss: 0.65, emit: '#ED808E', emitStrength: 0.06 },
  },
  bones: [
    { name: 'body', pivot: [0, 0, 0], drive: { rx: [['pitch', -0.25]], ry: [['yaw', 0.45]], rz: [['roll', 0.4]] }, wave: { rz: [0.018, 0.45, 0] } },
    { name: 'bookmark', parent: 'body', pivot: [0.17, 0.68, 0.105], jiggle: { axis: [0, 1, 0], length: 0.12, freq: 2.2, damping: 0.14, maxAngle: 0.55 } },
    { name: 'sparkle', parent: 'body', pivot: [-0.19, 0.65, 0.11], jiggle: { axis: [0, 1, 0], length: 0.07, freq: 2.8, damping: 0.16 } },
    { name: 'armL', parent: 'body', pivot: [-0.26, 0.36, 0], rest: { rz: 0.25 }, drive: { rz: [['flap', -0.75]] } },
    { name: 'armR', parent: 'body', pivot: [0.26, 0.36, 0], rest: { rz: -0.25 }, drive: { rz: [['flap', 0.75]] } },
  ],
  parts: [
    /* Page block peeks past the cover on the right and at the back. */
    { bone: 'body', shape: 'roundBox', at: [0.075, 0.43, -0.005], half: [0.245, 0.28, 0.06], round: 0.025, material: 'pages' },
    { bone: 'body', shape: 'roundBox', at: [0, 0.39, 0.04], half: [0.27, 0.31, 0.05], round: 0.04, material: 'cover' },
    { bone: 'body', shape: 'roundBox', at: [-0.245, 0.39, 0.055], half: [0.045, 0.31, 0.06], round: 0.025, blend: 0.015, material: 'spine' },
    /* Fine lines along the exposed page edge, visible from three-quarter views. */
    { bone: 'body', shape: 'capsule', from: [0.321, 0.29, -0.055], to: [0.321, 0.29, 0.015], radius: 0.006, material: 'pageLine' },
    { bone: 'body', shape: 'capsule', from: [0.321, 0.43, -0.055], to: [0.321, 0.43, 0.015], radius: 0.006, material: 'pageLine' },
    { bone: 'body', shape: 'capsule', from: [0.321, 0.57, -0.055], to: [0.321, 0.57, 0.015], radius: 0.006, material: 'pageLine' },
    /* Ribbon sits on the front surface and moves from its top pivot. */
    { bone: 'bookmark', shape: 'plate', at: [0, -0.1, 0], half: [0.034, 0.12], corner: 0.008, depth: 0.012, material: 'bookmark' },
    /* Warm sparkle attached to the upper-left cover corner. */
    { bone: 'sparkle', shape: 'capsule', from: [0, -0.055, 0], to: [0, 0.055, 0], radius: 0.011, material: 'sparkle' },
    { bone: 'sparkle', shape: 'capsule', from: [-0.055, 0, 0], to: [0.055, 0, 0], radius: 0.011, material: 'sparkle' },
    { bone: 'sparkle', shape: 'sphere', at: [0, 0, 0.005], radius: 0.019, material: 'sparkle' },
    /* Small arms and feet keep the notebook grounded and expressive. */
    { bone: 'armL', shape: 'capsule', from: [0, 0, 0], to: [-0.105, 0.035, 0.015], radius: 0.034, material: 'spine' },
    { bone: 'armR', shape: 'capsule', from: [0, 0, 0], to: [0.105, 0.035, 0.015], radius: 0.034, material: 'spine' },
    { bone: 'body', shape: 'ellipsoid', at: [-0.14, 0.055, 0.025], radii: [0.085, 0.04, 0.065], material: 'spine' },
    { bone: 'body', shape: 'ellipsoid', at: [0.14, 0.055, 0.025], radii: [0.085, 0.04, 0.065], material: 'spine' },
  ],
  paints: [
    { bone: 'body', on: ['cover'], kind: 'sphere', at: [-0.18, 0.32, 0.09], radius: 0.045, color: '#ED808E', soft: 0.65, opacity: 0.68 },
    { bone: 'body', on: ['cover'], kind: 'sphere', at: [0.18, 0.32, 0.09], radius: 0.045, color: '#ED808E', soft: 0.65, opacity: 0.68 },
  ],
  eyes: { kind: 'ball', bone: 'body', at: [[-0.105, 0.41, 0.052], [0.105, 0.41, 0.052]], radius: 0.055, iris: '#21132B', irisSize: 0.84, pupilSize: 0.54, lid: 'cover' },
  face: { kind: 'mouth', bone: 'body', on: ['cover'], at: [0, 0.295, 0.092], width: 0.055, color: '#2B1535', tongue: '#ED808E' },
  anchors: {
    top: { bone: 'sparkle', at: [0, 0.09, 0] },
    mouth: { bone: 'body', at: [0, 0.295, 0.11] },
    ear: { bone: 'body', at: [-0.3, 0.41, 0] },
    feet: { bone: 'root', at: [0, 0.02, 0.15] },
  },
  acting: {
    idle: { sparkle: { rz: [0, 0.08, 0.7, 0] } },
    thinking: { body: { rz: 0.06 }, bookmark: { rz: 0.25 }, sparkle: { rz: [0, 0.18, 1.1, 0] } },
    listening: { body: { rz: -0.06 }, armL: { rz: -0.3 }, sparkle: { rx: -0.25 } },
    speaking: { armL: { rz: [-0.15, 0.2, 1.4, 0] }, armR: { rz: [0.15, 0.2, 1.4, 1.2] } },
    working: { bookmark: { ry: [0, 0, 0, 0, 5] }, armL: { rz: [-0.35, 0.18, 3, 0] }, armR: { rz: [0.35, 0.18, 3, 1.5] } },
    error: { sparkle: { rz: [0, 0.3, 9, 0] }, armL: { rz: -0.8 }, armR: { rz: 0.8 } },
    surprised: { armL: { rz: -0.9 }, armR: { rz: 0.9 }, sparkle: { rx: -0.4 } },
    celebrating: { bookmark: { ry: [0, 0, 0, 0, 11] }, sparkle: { ry: [0, 0, 0, 0, 9] }, armL: { rz: [-0.9, 0.25, 3.5, 0] }, armR: { rz: [0.9, 0.25, 3.5, 1.5] } },
    sad: { body: { rx: 0.14 }, bookmark: { rx: 0.7 }, armL: { rz: 0.35 }, armR: { rz: -0.35 } },
    sleeping: { body: { rz: 0.08 }, bookmark: { rx: 0.9 }, sparkle: { rz: 0.8 } },
  },
  fx: {
    happy: [{ glyph: 'sparkle', anchor: 'top', rate: 5, velocity: [0, 0.16, 0.03], jitter: 0.08, life: [0.8, 1.2], size: [0.025, 0.055], color: '#E0A040' }],
  },
};

export default niknoteBuddy;
