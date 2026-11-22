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
| `layers.comingSoon` | Live earthquake and weather layers arrive with issues #25 and #26. | भूकम्प र मौसमका प्रत्यक्ष तहहरू इस्यु #२५ र #२६ मा आउँछन्। | Needs review | |
| `disclaimer.medical` | Safety information in this app is general guidance only, not medical advice. … | यस एपको सुरक्षा जानकारी सामान्य मार्गदर्शन मात्र हो, चिकित्सा सल्लाह होइन। … | Needs review (safety wording — high priority) | |

Full text of each string is in `app/src/i18n/en.json` and `app/src/i18n/ne.json`.
