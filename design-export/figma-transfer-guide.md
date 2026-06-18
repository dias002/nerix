# nomduchat Figma Transfer Guide

Use this folder to move only the visual part of nomduchat into Figma.

## What Is Inside

```text
screenshots/desktop   Desktop frames, 1440 x 1100
screenshots/mobile    Mobile frames, 390 x 844
contact-sheets        Two upload-ready PNG files when Figma limits file count
reference             Notes for rebuilding editable components
```

## Recommended Figma Flow

1. Open the target Figma file.
2. Create two pages:
   - `nomduchat Screens`
   - `nomduchat Components`
3. If Figma allows many images, drag all PNG files from `screenshots/desktop` and `screenshots/mobile` into `nomduchat Screens`.
4. If Figma limits upload to 10 files, drag only these two files:
   - `contact-sheets/desktop-contact-sheet.png`
   - `contact-sheets/mobile-contact-sheet.png`
5. Create matching frames:
   - Desktop: `1440 x 1100`
   - Mobile: `390 x 844`
6. Put each screenshot into its matching frame.
7. Rebuild editable components on top of the screenshots:
   - sidebar;
   - chat input;
   - agent cards;
   - balance cards;
   - settings rows;
   - landing sections;
   - language/country controls.
8. Move rebuilt components into `nomduchat Components`.
9. Hide or lock screenshot layers when the editable version is ready.

## If You Want Editable Layers Faster

Use a website-to-Figma plugin such as `html.to.design` or another HTML-to-Figma importer.

Flow:

1. Deploy a temporary preview of `apps/web`, or expose local Vite with a tunnel.
2. Import the URL into the plugin.
3. Use the PNG screenshots from this folder as the visual source of truth.
4. Clean plugin output manually.

Do not expect canvas animations, stars, planet rings, blur, and responsive layout to import perfectly. Treat plugin output as a starting draft, not the final Figma design.

## Important

Do not import the backend, API, repository structure, or source code into Figma. Figma should contain only:

- visual screens;
- reusable components;
- colors;
- typography;
- spacing rules;
- interaction notes.
