import { FsArchAppBuilder } from '@fsarch/server';
import { AppModule } from './app.module.js';
import { DATABASE_OPTIONS } from './database/index.js';
import { Role } from './constants/role.enum.js';

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
  .enableUac(Object.values(Role))
  .setDatabase(DATABASE_OPTIONS)
  .build();

await app.listen(process.env.PORT ?? 3000);
