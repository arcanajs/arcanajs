export const configFiles = [
  // project root files
  { src: "package.json", dest: "package.json" },
  { src: "tsconfig.json", dest: "tsconfig.json" },
  { src: "arcanajs.config.ts", dest: "arcanajs.config.ts" },
  { src: "postcss.config.js", dest: "postcss.config.js" },

  // types
  { src: "src/arcanajs.d.ts", dest: "src/arcanajs.d.ts" },

  // client
  { src: "src/client/globals.css", dest: "src/client/globals.css" },
  { src: "src/client/index.tsx", dest: "src/client/index.tsx" },

  // server
  { src: "src/server/index.ts", dest: "src/server/index.ts" },
  { src: "src/server/routes/web.ts", dest: "src/server/routes/web.ts" },
  { src: "src/server/routes/api.ts", dest: "src/server/routes/api.ts" },
  {
    src: "src/server/controllers/HomeController.ts",
    dest: "src/server/controllers/HomeController.ts",
  },
  {
    src: "src/server/controllers/UsersController.ts",
    dest: "src/server/controllers/UsersController.ts",
  },

  // views
  { src: "src/views/HomePage.tsx", dest: "src/views/HomePage.tsx" },
  { src: "src/views/NotFoundPage.tsx", dest: "src/views/NotFoundPage.tsx" },
  { src: "src/views/ErrorPage.tsx", dest: "src/views/ErrorPage.tsx" },

  //public
  {
    src: "public/arcanajs.png",
    dest: "public/arcanajs.png",
  },
  {
    src: "public/arcanajs.svg",
    dest: "public/arcanajs.svg",
  },
  {
    src: "public/favicon.ico",
    dest: "public/favicon.ico",
  },

  // optional DB templates
  { src: "src/db/mongo.ts", dest: "src/db/mongo.ts" },
  { src: "src/db/mongoose.ts", dest: "src/db/mongoose.ts" },
  { src: "src/db/mysql.ts", dest: "src/db/mysql.ts" },
  { src: "src/db/postgres.ts", dest: "src/db/postgres.ts" },
];

export const errorPages = ["NotFoundPage.tsx", "ErrorPage.tsx"];

export const requiredDirs = [
  "public",
  "src",
  "src/client",
  "src/server",
  "src/server/routes",
  "src/server/controllers",
  "src/views",
];
