# Epic Spoke Guard

A customizable 210 mm bicycle spoke guard. Use the browser customizer to set the rim text, dividers, centre hole diameter, and shoulder height, then generate and download an STL.

[Open the customizer](https://kingbain.github.io/epic-spoke-guard/)

Choose **Complete guard** for a single STL. For a two-colour print, export **Black body** and **White letter faces** with identical settings, then import them as parts of one object in your slicer.

## GitHub Pages

1. In the repository settings, open **Pages** and set **Build and deployment → Source** to **GitHub Actions**.
2. Merge the site changes to `main`. The **GitHub Pages** workflow builds and publishes the site on pushes to `main`. If you set the source after merging, run the workflow manually on `main`.

Pull requests run the production build for validation.

## Local development

Use Node.js 24.

```sh
npm ci
npm run dev
```

Use `npm run build` to make the static site in `dist/`, and `npm run preview` to serve that production build locally.

The site uses `Customizable_Spoke_Guard.scad` as the model source. An OpenSCAD WebAssembly worker renders the STL locally, and Three.js previews the exported mesh. You can also open the SCAD file directly in desktop OpenSCAD.
