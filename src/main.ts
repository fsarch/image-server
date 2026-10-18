import { FsArchAppBuilder } from '@fsarch/server';
import { descriptor } from './lib/index.js';

// `descriptor.module.register()` with no arguments = default TypeORM
// connection, no guards applied — identical to the plain `AppModule` this
// used to pass. The builder calls below are unchanged from before; they
// now just read their values from `descriptor` instead of duplicating
// them, so this stays the single source of truth shared with a
// mono-service harness's `.addService({ id, ...descriptor })`.
const app = await new FsArchAppBuilder(descriptor.module.register(), {
  name: 'Image-Server',
  version: '1.0.0',
})
  .addSwagger(descriptor.swagger)
  .enableAuth()
  .enableUac(descriptor.uac.roles)
  .setDatabase({ entities: descriptor.entities, migrations: descriptor.migrations })
  .build();

await app.listen(process.env.PORT ?? 3000);
