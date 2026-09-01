# Event background images

Drop image files here, named exactly after each event's `id` in
`src/data/events.ts`. Any of these extensions work:

    .jpg .jpeg .png .webp .avif

Examples:

    columbus.jpg
    moon-landing.png
    roman-empire.webp

The file is auto-loaded at build time and shown as a soft, blurred background
when the matching event is selected. If no file is found for an event, no
background image is shown.

To override the lookup for a specific event, you can also add an `image` field
to that event in `events.ts` whose value is an imported URL string.
