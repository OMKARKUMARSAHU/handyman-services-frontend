# Team / profile image

A client-requested profile-type visual on the About page (Phase 3 "major
homepage visual rework" pass, item 18). No image file or specific person
was supplied for this yet, so the page shows a neutral placeholder icon.

To activate the real photo, drop it here as:

- `founder.jpg` — square crop (1:1), at least 300×300px

No code change is needed — `src/app/about/page.tsx` already points at this
path (`ProfileImageSlot`) and will render the photo automatically once the
file exists.
