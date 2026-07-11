module.exports = {
  ci: {
    collect: {
      startServerCommand: "npm run preview -- --port 4174",
      startServerReadyPattern: "Local",
      url: ["http://127.0.0.1:4174/", "http://127.0.0.1:4174/privacy"],
      numberOfRuns: 1,
      settings: {
        chromeFlags: "--headless --no-sandbox",
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["warn", { minScore: 0.75 }],
        "categories:accessibility": ["error", { minScore: 0.9 }],
        "categories:best-practices": ["error", { minScore: 0.9 }],
        "first-contentful-paint": ["warn", { maxNumericValue: 2500 }],
        "largest-contentful-paint": ["warn", { maxNumericValue: 3500 }],
      },
    },
    upload: {
      target: "temporary-public-storage",
    },
  },
};
