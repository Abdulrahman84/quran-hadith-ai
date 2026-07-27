import aggregate from "@convex-dev/aggregate/convex.config.js";
import { defineApp } from "convex/server";

const app = defineApp();
app.use(aggregate, { name: "questionRunStats" });

export default app;
