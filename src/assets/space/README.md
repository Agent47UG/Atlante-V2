# Space background texture

Drop **one** equirectangular (2:1) star-map image in this folder and it is picked
up automatically at build time, wrapped onto a sky-sphere behind the globe, and
kept in sync with the globe's rotation. If this folder is empty, the app falls
back to the built-in procedural stars.

Recommended name: `starmap.jpg` (any `.jpg/.jpeg/.png/.webp/.avif` works).

## Where to get a free, realistic one

- **Solar System Scope – Textures** (`solarsystemscope.com/textures`): download
  "Stars Milky Way" (2k/8k). Free, CC BY 4.0 (attribution required).
- **NASA SVS – "Deep Star Maps 2020"** (`svs.gsfc.nasa.gov`): public-domain
  equirectangular star maps in several resolutions.
- **ESO Milky Way panorama** (`eso.org`): high-res 360° Milky Way, CC BY 4.0.

Pick an **equirectangular / 2:1** image (not a cube map). 2k–4k is plenty and
keeps things fast; 8k looks sharper but is heavier.

Please respect each source's license/attribution terms.
