import { AppModule } from './app.module.js';
import { FsArchAppBuilder } from "@fsarch/server";
import { DATABASE_OPTIONS } from "./database/index.js";

const app = await new FsArchAppBuilder(AppModule, {
  name: 'Image-Server',
  version: '1.0.0',
})
  .addSwagger({
    title: 'Image-Server',
    description: 'The Image-Server API description',
    version: '1.0',
  })
  .enableAuth()
  .setDatabase(DATABASE_OPTIONS)
  .build();

await app.listen(process.env.PORT ?? 3000);
