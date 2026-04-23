import cheddr from "@cheddr/config-eslint";

export default [
  ...cheddr,
  {
    ignores: [".expo/**", "node_modules/**", "dist/**", ".turbo/**"],
  },
];
