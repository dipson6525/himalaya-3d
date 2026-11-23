# Nepali translation review

Owner: Dipson Gurung · Related FR: FR9 · Issue #27

All Nepali strings below were **machine-drafted** and must be checked by a native speaker
before the final presentation. When a string is reviewed, change its status to "Reviewed",
add the reviewer's name, and fix `app/src/i18n/ne.json` if needed.

| Key | English | Nepali (draft) | Status | Reviewer |
| --- | --- | --- | --- | --- |
| `app.title` | Himalaya 3D | हिमालय ३डी | Needs review | |
| `app.tagline` | Explore and plan Nepal's trekking routes in 3D | नेपालका पदयात्रा मार्गहरू ३डीमा हेर्नुहोस् र योजना बनाउनुहोस् | Needs review | |
| `globe.label` | 3D globe | ३डी ग्लोब | Needs review | |
| `globe.noToken` | No Cesium ion token configured: … | Cesium ion टोकन मिलाइएको छैन: … | Needs review | |
| `credits.osm` | © OpenStreetMap contributors | © OpenStreetMap contributors (kept in English) | Needs review: does the OSMF Attribution Guideline allow a Nepali wording? (TODO(team): verify) | |
| `routes.loading` | Loading treks… | पदयात्राहरू लोड हुँदैछन्… | Needs review | |
| `routes.none` | No trek data yet. Route files are added by the data-prep pipeline (issues #9–#12). | अहिलेसम्म पदयात्राको डाटा छैन। … | Needs review | |
| `routes.error` | Could not load the trek data. … | पदयात्राको डाटा लोड गर्न सकिएन। … | Needs review | |
| `routes.showing` | Showing {name}: {count} overnight stops. Click a marker for details. | {name} देखाइँदैछ: {count} वटा रात बस्ने ठाउँ। … | Needs review (keep {name} and {count}) | |
| `stop.altitude` | Altitude | उचाइ | Needs review | |
| `stop.source` | Altitude source | उचाइको स्रोत | Needs review | |
| `stop.day` | Arrive on day | पुग्ने दिन | Needs review | |
| `tabs.label` | Side panel sections | साइड प्यानलका खण्डहरू | Needs review | |
| `tabs.trek` | Trek | पदयात्रा | Needs review | |
| `tabs.plan` | Plan | योजना | Needs review | |
| `tabs.layers` | Layers | तहहरू | Needs review: is "लेयरहरू" clearer for map layers? | |
| `trek.choose` | Choose a trek | पदयात्रा छान्नुहोस् | Needs review | |
| `stops.heading` | Overnight stops | रात बस्ने ठाउँहरू | Needs review | |
| `stops.item` | Day {day} · {name} · {altitude} m | दिन {day} · {name} · {altitude} मि. | Needs review (keep {day}, {name}, {altitude}; is "मि." the right abbreviation for metres?) | |
| `plan.comingSoon` | The itinerary editor and acclimatization warnings arrive with issue #24. | यात्रा-तालिका सम्पादक र उचाइ-अनुकूलन चेतावनीहरू इस्यु #२४ मा आउँछन्। | Needs review | |
| `stops.hint` | Choose a day to highlight the trail walked that day. | त्यस दिन हिँडिने बाटो नक्सामा देखाउन दिन छान्नुहोस्। | Needs review | |
| `stops.stageLength` | {km} km along the trail from the previous stop | अघिल्लो बिसौनीबाट बाटो हुँदै {km} कि.मि. | Needs review (keep {km}) | |
| `fly.play` | Play flythrough | उडान दृश्य चलाउनुहोस् | Needs review | |
| `fly.resume` | Resume flythrough | उडान दृश्य जारी राख्नुहोस् | Needs review | |
| `fly.pause` | Pause flythrough | उडान दृश्य रोक्नुहोस् | Needs review | |
| `fly.preparing` | Preparing flythrough… | उडान दृश्य तयार हुँदैछ… | Needs review | |
| `fly.error` | The flythrough could not start. Press the button to try again. | उडान दृश्य सुरु हुन सकेन। फेरि प्रयास गर्न बटन थिच्नुहोस्। | Needs review | |
| `fly.speed` | Speed | गति | Needs review | |
| `fly.speedOption` | {speed}× | {speed}× | Needs review (keep {speed}) | |
| `fly.jumpLabel` | Jump to the start of a day | कुनै दिनको सुरुमा जानुहोस् | Needs review (group label above the "Day N" buttons) | |
| `fly.jumpTo` | Jump to the start of day {day} | दिन {day} को सुरुमा जानुहोस् | Needs review (keep {day}; the screen-reader name of each "Day N" button) | |
| `fly.day` | Day {day} | दिन {day} | Needs review (keep {day}) | |
| `profile.heading` | Elevation profile | उचाइ प्रोफाइल | Needs review | |
| `profile.show` | Show profile | प्रोफाइल देखाउनुहोस् | Needs review | |
| `profile.hide` | Hide profile | प्रोफाइल लुकाउनुहोस् | Needs review | |
| `profile.loading` | Sampling the terrain along the trail… | बाटोभरिको भू-सतहको उचाइ लिइँदैछ… | Needs review | |
| `profile.error` | Could not load the terrain heights for this trek. … | यस पदयात्राको भू-सतहको उचाइ लोड गर्न सकिएन। … | Needs review | |
| `profile.noTerrain` | No Cesium ion token: there is no terrain, so every height is 0 m. | Cesium ion टोकन छैन: … सबै उचाइ ० मि. देखिन्छ। | Needs review | |
| `profile.stats` | Total ascent {ascent} m · Total descent {descent} m · Highest point {highest} m at {at} km | जम्मा चढाइ {ascent} मि. · जम्मा ओरालो {descent} मि. · … ({at} कि.मि. मा) | Needs review (keep all four placeholders) | |
| `profile.chartLabel` | Elevation profile of {name}: {length} km long, highest point {highest} m. | {name} को उचाइ प्रोफाइल: … | Needs review (screen-reader summary of the chart) | |
| `profile.source` | Terrain heights from Cesium World Terrain, above the WGS84 ellipsoid, every 50 m. … | भू-सतहको उचाइ Cesium World Terrain बाट, WGS84 एलिप्सोइडमाथि, … | Needs review (accuracy note: high priority) | |
| `profile.axisDistance` | Distance along the trail (km) | बाटोमा दूरी (कि.मि.) | Needs review | |
| `profile.axisHeight` | Height (m) | उचाइ (मि.) | Needs review | |
| `profile.stopTooltip` | Day {day} · {name} · cited altitude {altitude} m | दिन {day} · {name} · उद्धृत उचाइ {altitude} मि. | Needs review (keep {day}, {name}, {altitude}) | |
| `profile.heightTooltip` | Terrain {height} m | भू-सतह {height} मि. | Needs review (keep {height}) | |
| `layers.comingSoon` | Live earthquake and weather layers arrive with issues #25 and #26. | भूकम्प र मौसमका प्रत्यक्ष तहहरू इस्यु #२५ र #२६ मा आउँछन्। | Needs review | |
| `disclaimer.medical` | Safety information in this app is general guidance only, not medical advice. … | यस एपको सुरक्षा जानकारी सामान्य मार्गदर्शन मात्र हो, चिकित्सा सल्लाह होइन। … | Needs review (safety wording — high priority) | |

Full text of each string is in `app/src/i18n/en.json` and `app/src/i18n/ne.json`.
