import { db } from "./db.js";
import { prepareUsabilityFixtures } from "./usability-fixtures.js";
try {
  if (process.env.PREPARE_USABILITY_FIXTURES !== "1")
    throw new Error(
      "Use the explicit demo:prepare command to reset named practice scenarios.",
    );
  console.log(JSON.stringify(await prepareUsabilityFixtures(), null, 2));
} finally {
  await db.$disconnect();
}
