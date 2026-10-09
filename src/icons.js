/* Original vector icon system; every structure can later use a PNG through ASSET_CONFIG. */
const ICON_PATHS={
 jet:'M16 2l3 11 11 7v3l-11-3v6l5 4h-5l-3-2-3 2H8l5-4v-6L2 23v-3l11-7z',
 launcher:'M5 25h22v4H5z M8 24l7-12 3 2-7 12 M15 12l5-9 5-2-1 6-5 8z M7 20l-2 5 M22 15l5 10',
 sam:'M5 27h22v3H5z M7 25V11h5v14 M14 25V7h5v18 M21 25V12h5v13 M14 7l2.5-5L19 7',
 aaa:'M7 27h20 M11 27v-8h12v8 M12 19l9-13 3 2-9 14 M18 19L27 6l3 2-9 14 M5 14l7-2v6H5z',
 radar:'M7 7q-3 13 11 15 M7 7l19 15 M7 7q13-3 19 15 M16 16l8-10 M21 8l5-5 M15 22v7 M7 29h20',
 factory:'M3 28V15l9-5v6l9-5v8h8v9z M24 19V4h4v15 M7 21v4 M13 21v4 M19 21v4 M25 22v3',
 oilrig:'M7 29l5-15h5l6 15 M9 22h11 M3 10l24-6 2 5-24 6z M25 10v16 M21 28h8 M13 15V9 M4 29h22',
 airbase:'M3 28h26 M5 25V13l11-7 11 7v12 M10 25v-9h12v9 M16 2v7 M11 5l5 2 5-2',
 city:'M4 28V15h7v13 M12 28V6h8v22 M21 28V12h7v16 M15 10h2 M15 15h2 M15 20h2 M6 19h2 M23 17h2 M23 22h2',
 missile:'M9 22L22 4l6-2-1 6-15 17z M11 19l-7 1-2 7 7-4 M17 24l-2 6 7-4v-7 M5 28l-2 2',
 cruise:'M3 17h26l-4-3H12l-7 1z M12 16l5-9h3l-3 9 M16 18l7 6h-5l-7-6',
 drone:'M16 3v24 M3 12l13-4 13 4-13 3z M9 25l7-4 7 4',
 satellite:'M12 12h8v8h-8z M2 5l7-3 5 8-7 3z M19 22l6-3 5 8-7 3z M20 12l6-6 M22 4q8 0 8 8',
 money:'M3 9h26v17H3z M8 13h2 M22 22h2 M19 17a3 3 0 1 0-6 0 3 3 0 1 0 6 0',
 oil:'M16 3C14 8 6 16 6 21a10 10 0 0 0 20 0C26 16 18 8 16 3z M11 22q0 5 5 5',
 tech:'M12 3h8 M14 3v10L6 25q-2 5 4 5h12q6 0 4-5l-8-12V3 M10 21h12',
 people:'M12 8a4 4 0 1 0-8 0 4 4 0 1 0 8 0 M28 8a4 4 0 1 0-8 0 4 4 0 1 0 8 0 M2 28V18q6-6 12 0v10 M18 28V18q6-6 12 0v10',
 build:'M6 3l6 6-4 4-6-6q-2 9 8 9l15 14 5-5-14-15Q18 2 6 3z',
 operations:'M5 7h22v22H5z M10 7V3h12v4 M10 13h13 M10 19h13 M10 25h8',
 shield:'M16 2L4 7v9q1 9 12 14 11-5 12-14V7z M10 15l4 4 8-9',
 diplomacy:'M4 10l6-5 6 4 6-4 7 5-4 14-8 4-12-9 M11 14l6-5 7 9 M7 21l4-6 10 8',
 settings:'M12 3h8l1 5 5 1 3 7-4 4 1 6-7 4-4-4-6 1-5-7 4-4-1-6 5-3z M21 16a5 5 0 1 0-10 0 5 5 0 1 0 10 0',
 news:'M5 4h22v25H5z M9 9h14 M9 15h6 M9 20h6 M19 15h4v9h-4 M9 25h6',
 target:'M16 2v6 M16 24v6 M2 16h6 M24 16h6 M25 16a9 9 0 1 0-18 0 9 9 0 1 0 18 0 M18 16a2 2 0 1 0-4 0 2 2 0 1 0 4 0',
 pause:'M11 5v22 M21 5v22',play:'M9 4l19 12L9 28z',close:'M8 8l16 16 M24 8L8 24',chevron:'M11 6l10 10-10 10',save:'M5 4h20l3 4v21H4V4h4v8h16V4 M9 29V19h14v10',map:'M3 7l8-4 10 4 8-4v23l-8 4-10-4-8 4z M11 3v23 M21 7v23',plus:'M16 5v22 M5 16h22',minus:'M5 16h22',alert:'M16 3L2 29h28z M16 11v9 M16 24v1',check:'M5 16l7 7L27 7',speaker:'M4 12h6l8-7v22l-8-7H4z M22 10q9 6 0 12',star:'M16 2l4 9 10 1-8 7 3 11-9-6-9 6 3-11-8-7 10-1z',arrow:'M3 16h25 M20 8l8 8-8 8',fuel:'M6 28V4h14v24 M8 7h10v8H8z M20 11l7 4v9q0 5-4 2V15 M3 29h20'
};
function icon(name,cls=''){return `<svg viewBox="0 0 32 32" class="ico ${cls}" aria-hidden="true"><path d="${ICON_PATHS[name]||ICON_PATHS.target}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`}
