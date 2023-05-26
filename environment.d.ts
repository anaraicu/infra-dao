declare global {
  namespace NodeJS {
    interface ProcessEnv {
      METAMASK_ADDRESS: string;
      SEPOLIA_PRIVATE_KEY: string;
    }
  }
}

// If this file has no import/export statements (i.e. is a script)
// convert it into a module by adding an empty export statement.
export {};
