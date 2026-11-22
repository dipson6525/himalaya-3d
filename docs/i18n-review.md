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
| `panel.comingSoon` | Trek selection, flythrough and planning tools are being built. … | पदयात्रा छनोट, उडान दृश्य (flythrough) र योजना उपकरणहरू बन्दैछन्। … | Needs review | |
| `credits.osm` | © OpenStreetMap contributors | © OpenStreetMap contributors (kept in English) | Needs review: does the OSMF Attribution Guideline allow a Nepali wording? (TODO(team): verify) | |
| `routes.loading` | Loading treks… | पदयात्राहरू लोड हुँदैछन्… | Needs review | |
| `routes.none` | No trek data yet. Route files are added by the data-prep pipeline (issues #9–#12). | अहिलेसम्म पदयात्राको डाटा छैन। … | Needs review | |
| `routes.error` | Could not load the trek list. … | पदयात्राको सूची लोड गर्न सकिएन। … | Needs review | |
| `routes.showing` | Showing {name}: {count} overnight stops. Click a marker for details. | {name} देखाइँदैछ: {count} वटा रात बस्ने ठाउँ। … | Needs review (keep {name} and {count}) | |
| `stop.altitude` | Altitude | उचाइ | Needs review | |
| `stop.source` | Altitude source | उचाइको स्रोत | Needs review | |
| `stop.day` | Arrive on day | पुग्ने दिन | Needs review | |
| `disclaimer.medical` | Safety information in this app is general guidance only, not medical advice. … | यस एपको सुरक्षा जानकारी सामान्य मार्गदर्शन मात्र हो, चिकित्सा सल्लाह होइन। … | Needs review (safety wording — high priority) | |

Full text of each string is in `app/src/i18n/en.json` and `app/src/i18n/ne.json`.
