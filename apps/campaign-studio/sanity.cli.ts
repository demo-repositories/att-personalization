import {defineCliConfig} from "sanity/cli"

export default defineCliConfig({
  app: {
    organizationId: "oab7ManMj",
    entry: "./src/main.tsx",
  },
  deployment: {
    appId: "vjhgclbnnees2z5mkug5cctb",
  },
})
