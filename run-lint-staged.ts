// eslint-disable-next-line n/no-unpublished-import
import lintStaged from "lint-staged";
import config from "./.lintstagedrc";

const runLintStaged = async (): Promise<void> => {
  try {
    const success = (await lintStaged(config)) as boolean;
    if (!success) {
      throw new Error("lint-staged failed");
    }
  } catch (error) {
    console.error(
      "lint-staged failed:",
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }
};

await runLintStaged();
